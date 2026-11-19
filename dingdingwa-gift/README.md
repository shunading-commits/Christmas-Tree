# 丁丁蛙的圣诞树礼物

[打开赠送页](https://dingdingwa.goldchurn9.chatgpt.site/)。填写名字、选照片并生成收礼链接，对方就能点开树下的礼物盒。

## 构建

在本目录运行 `node build.mjs`，产物位于 `dist/`。服务端 Worker 需要名为 `BUCKET` 的 R2 绑定。若通过 ChatGPT Sites 部署，先在本地的 `.openai/hosting.json` 填入对应站点的 `project_id`。
