# JxShap

> 新一代《三国杀》制图网站 —— 告别历史包袱，从0到1的彻底重构

此开源版前端项目，是一个开源的三国杀卡牌制作器。该工具有许多丰富的功能，可供大家使用。

- 此 Github 仓库由 ChessBrainIsNotHuman 从 Gitee 搬运并修改。

> 由于 gxkord 习惯用 Gitee，象棋脑又学业繁忙，进度可能会跟不上，尽情谅解。

## 🖥️ 本地运行与部署

### 环境要求

- Node.js 20.19+ 或 22.12+
- pnpm 10（可通过 Corepack 安装）

### 开发运行

```bash
git clone https://github.com/sgsshap/open-shap2-web.git
cd open-shap2-web
corepack enable
corepack prepare pnpm@10 --activate
pnpm install --frozen-lockfile
pnpm dev
```

启动后访问终端显示的本地地址，默认是 `http://localhost:5173/`。

### 本地部署生产版本

构建并预览生产版本：

```bash
pnpm build
pnpm preview -- --host 0.0.0.0
```

终端会显示访问地址；同一局域网的设备可使用电脑的局域网 IP 加端口访问。

若使用 Nginx、Caddy 或其他静态文件服务器部署，将构建生成的 `dist/` 目录作为网站根目录即可。本项目使用 Hash 路由，无需额外配置 SPA 刷新回退规则。


## 🔉开发者 gxkord 说

大家好，我是 sgs-shap 的作者。

曾经的 sgs-shap 陪伴了很多玩家，但由于早期的历史原因，底层设计存在诸多局限，导致代码维护困难，Bug 频出，用户体验始终无法达到理想状态。

为了彻底解决这些问题，我选择不再在旧代码上“打补丁”，而是直接推倒重来。

JxShap 是一个从 0 到 1 重构的开源项目。抛弃所有陈旧的技术负债，旨在构建一个现代化、高扩展性的制图工具，让制图变得更简单。

## 🎯 核心重构目标

我将致力于打造一个现代化、高性能的制图平台，主要特性规划如下：

| 特性维度      | 详细规划                               |
|:----------|:-----------------------------------|
| **印刷支持**  | ✅ 支持制图模板“出血”功能，满足线下实体卡牌印刷需求        |
| **设计自由**  | ✅ 重构势力色系统，支持全色域自由配置                |
| **多端适配**  | ✅ 完美兼容IOS、安卓、windows多端（尽量）             |
| **体验优化**  | ✅ 本地缓存制图历史、多语言国际化、深度主题定制           |
| **多UI模板** | ✅ 将原sgs-shap的模板重新复刻，提升用户体验，并增加新的模板 |

## 🤝 招募开源贡献者

**“汉室衰微，本人才疏学浅”**。虽然我希望能独自完成这个愿景，但为了将 JxShap 打造成一个真正完善的开源项目，我急需志同道合的伙伴。

**我们需要：**

* **前端：** 熟悉 Vue3 / TypeScript 的开发者（目前核心需求）。
* **后端：** 熟悉 SpringBoot / 文件存储 的开发者。
* **UI/UX：** 懂设计，能优化交互体验的大佬。
* **爱好者：** 无论技能深浅，只要热心开源，我们都热烈欢迎！

## 📢 加入我们

如果你对这个项目感兴趣，或者想学习一个完整的开源项目是如何从 0 搭建的，请加入我们的 QQ 群：

**网站普通用户群：799807498**（内测群、开发群入群后另行引导）

## 📚 开发文档

技术说明统一在 [`docs/`](./docs/README.md)（模板开发、composable、静态资源布局、Vue 规范索引等）。

## 🖥️ 本地运行与部署

### 环境要求

- Node.js 20.19+ 或 22.12+
- Corepack（随 Node.js 安装）

在 Windows 的非管理员终端中，不要执行 `corepack enable pnpm`：该命令需要向 `C:\Program Files\nodejs` 写入 pnpm shim，可能因权限不足失败。直接通过 Corepack 调用 pnpm 即可。

### 开发运行

```bash
git clone https://github.com/sgsshap/open-shap2-web.git
cd open-shap2-web
corepack pnpm@10 install --frozen-lockfile
corepack pnpm@10 dev
```

启动后访问终端显示的本地地址，默认是 `http://localhost:5173/`。

### 本地部署生产版本

构建并预览生产版本：

```bash
corepack pnpm@10 build
corepack pnpm@10 exec vite preview --host 0.0.0.0
```

终端会显示访问地址；同一局域网的设备可使用电脑的局域网 IP 加端口访问。

若使用 Nginx、Caddy 或其他静态文件服务器部署，将构建生成的 `dist/` 目录作为网站根目录即可。本项目使用 Hash 路由，无需额外配置 SPA 刷新回退规则。

## 👉 访问地址

**Github：**[JxShap 开源仓库](https://github.com/sgsshap/open-shap2-web)

**Gitee：** [JxShap 开源仓库](https://gitee.com/gxkord/open-shap2-web)

**JxShap 访问地址：** [JxShap 公测](http://www.sgsshap.cn:8200/)

**sgs-shap访问地址：** [sgs-shap地址](http://www.sgsshap.cn:8000/#/home)
