import { maker, scene } from './pages.js';

const maxPhotoBytes = 800000;
const giftRoute = /^\/gift\/([a-f0-9]{32})(\/photo)?$/;
const pageHeaders = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' blob: data:; frame-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'",
};
function page(body, status = 200) {
  return new Response(body, { status, headers: pageHeaders });
}
function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
function escapeHtml(value) {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value).replace(/[&<>"']/g, char => entities[char]);
}
function renderGift(name) {
  return scene.replace('%%RECIPIENT%%', () => escapeHtml(name));
}
function unavailable(status) {
  return page('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>圣诞树礼物</title><body style="margin:0;display:grid;min-height:100vh;place-items:center;background:#150b18;color:#ffe2f2;font:18px system-ui"><p>' +
    (status === 404 ? '找不到这份礼物，请确认收礼链接是否完整。' : '礼物暂时无法打开，请稍后刷新再试。') +
    '</p></body></html>', status);
}
async function readPhoto(body) {
  const reader = body.getReader();
  const data = new Uint8Array(maxPhotoBytes);
  let used = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return data.subarray(0, used);
      if (used + value.byteLength > maxPhotoBytes) {
        await reader.cancel();
        return null;
      }
      data.set(value, used);
      used += value.byteLength;
    }
  } finally { reader.releaseLock(); }
}
async function createGift(request, env, url) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== url.origin) return json({ error: '请在赠送页面上传照片。' }, 403);
  if (request.headers.get('Content-Type') !== 'image/jpeg' || !request.body) {
    return json({ error: '请上传一张照片。' }, 415);
  }
  let recipient;
  try { recipient = decodeURIComponent(request.headers.get('X-Recipient') || '').trim(); }
  catch { return json({ error: '请重新输入收礼人的名字。' }, 400); }
  if (!recipient || recipient.length > 40) return json({ error: '请输入 40 字以内的名字。' }, 400);
  if (Number(request.headers.get('Content-Length')) > maxPhotoBytes) {
    return json({ error: '照片太大。' }, 413);
  }
  const photo = await readPhoto(request.body);
  if (!photo) return json({ error: '照片太大。' }, 413);
  if (photo.length < 5 || photo[0] !== 255 || photo[1] !== 216 || photo[2] !== 255 ||
      photo.at(-2) !== 255 || photo.at(-1) !== 217) {
    return json({ error: '照片格式无法读取。' }, 422);
  }
  const id = crypto.randomUUID().replaceAll('-', '');
  await env.BUCKET.put('gifts/' + id, photo, {
    httpMetadata: { contentType: 'image/jpeg' },
    customMetadata: { recipient: encodeURIComponent(recipient) },
  });
  return json({ id }, 201);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const isCreate = path === '/api/gifts' && request.method === 'POST';
    try {
      if (isCreate) return await createGift(request, env, url);
      if (request.method !== 'GET') return new Response(null, { status: 405 });
      if (path === '/') return page(maker);
      if (path === '/scene') return page(renderGift('你想送礼物的人'));
      const match = path.match(giftRoute);
      if (!match) return unavailable(404);
      const key = 'gifts/' + match[1];
      if (match[2]) {
        const object = await env.BUCKET.get(key);
        if (!object) return new Response(null, { status: 404 });
        return new Response(object.body, {
          headers: {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
            'Cross-Origin-Resource-Policy': 'same-origin',
          },
        });
      }
      const object = await env.BUCKET.head(key);
      if (!object) return unavailable(404);
      return page(renderGift(decodeURIComponent(object.customMetadata.recipient)));
    } catch {
      return isCreate ? json({ error: '暂时无法保存礼物，请稍后再试。' }, 503) : unavailable(503);
    }
  },
};

