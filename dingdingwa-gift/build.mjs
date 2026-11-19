import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
const maker = await readFile('index.html', 'utf8');
const scene = await readFile('scene.html', 'utf8');
const worker = await readFile('worker.mjs', 'utf8');
await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });
await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
await writeFile('dist/server/index.js', worker.replace("import { maker, scene } from './pages.js';",
  'const maker = ' + JSON.stringify(maker) + ';\nconst scene = ' + JSON.stringify(scene) + ';'));

