# public 静态资源

## 目录约定

```text
public/
├── favicon.ico
└── diy/                          # 制图业务域（整包迁移/CDN 换源时只动此目录）
    ├── fonts/                    # Web 字体 + font.css
    ├── shared/                   # 跨模板共享素材（角标、扩展势力、演示图）
    ├── templates/                # 按模板分的 skin 包
    │   └── <template-id>/
    │       └── assets/
    └── matting-models/           # 智能抠图 ONNX 模型（pnpm setup:matting-models）
```

路径常量见 `src/features/diy-card/constants/publicAssets.ts`。

主题 UI 背景（水墨、山海等）在 `src/shared/themes/bg/`，不在此目录。

## 字体

- 文件：`public/diy/fonts/woff2/*.woff2`（有官方英文文件名的用英文，如 `FZHeiTi-GBK`；无官方英文的保留中文，如 `金梅毛草行_GBK-Regular-9.01`）
- 声明：`public/diy/fonts/font.css`（url 相对 `./woff2/`，IDE 可校验）
- 引入：`index.html` → `/diy/fonts/font.css?v=<hash>`

## 抠图模型

```bash
pnpm setup:matting-models
```
