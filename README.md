# 📦 PermaStore · 永久存储

> 基于 GitHub Gist 的纯前端内容管理工具。  
> 无需后端服务器，数据存储在你的 GitHub Gist 中，可部署到 GitHub Pages。

---

## ✨ 功能

- **分区管理** — 创建多个分区，每个分区可包含文字区和图片区
- **文字块** — 自由编辑文字内容，支持复制
- **图片上传** — 上传图片并自动压缩，生成 dataURL 存储在 Gist 中
- **站点密码** — 为站点设置密码保护，查看者需解锁才能编辑
- **搜索** — 按分区或区域名称快速筛选
- **目录导航** — 一键跳转到任意分区
- **分享** — 生成永久链接和二维码，随时随地访问
- **自动保存** — 编辑内容自动保存到 GitHub Gist

---

## 🚀 部署到 GitHub Pages

### 1. 创建仓库

1. 登录 [GitHub](https://github.com)
2. 点右上角 **"+" → New repository**
3. 仓库名填 `perma-store`（或其他名称）
4. 仓库类型选 **Public**
5. 点 **Create repository**

### 2. 上传文件

```bash
# 或者直接在 GitHub 网页上传
git clone https://github.com/你的用户名/perma-store.git
cd perma-store
# 把 index.html, styles.css, app.js 复制到这个目录
git add .
git commit -m "初始提交"
git push
```

也可以在仓库页面点 **Add file → Upload files**，把三个文件拖进去提交。

### 3. 开启 GitHub Pages

1. 进入仓库 → **Settings → Pages**
2. **Source** 选 **Deploy from a branch**
3. **Branch** 选 `main`（或 `master`），目录选 `/ (root)`
4. 点 **Save**
5. 等待 1-2 分钟，访问 `https://你的用户名.github.io/perma-store/`

---

## 🔧 使用说明

### 配置 GitHub Token

1. 打开 [GitHub Personal Access Tokens](https://github.com/settings/tokens/new?description=perma-store&scopes=gist)
2. Note 填 `perma-store`
3. 勾选 **gist**（只需要这一个权限）
4. 点 **Generate token**，复制生成的密钥

> Token 只存储在浏览器 localStorage 中，仅用于调用 GitHub API。

### 创建站点

1. 点击首页 **"配置 GitHub"**，粘贴你的 Token
2. 点击 **"创建新站点"**
3. 进入站点页面，开始添加分区、文字区、图片区

### 分享站点

每个站点有一个唯一的 Gist ID，分享链接格式：
```
https://你的用户名.github.io/perma-store/?id=你的GistID
```

---

## 🏗️ 技术栈

- **存储**: GitHub Gist API (v3)
- **图片压缩**: Canvas API (dataURL / JPEG 0.8, 最长边 800px)
- **二维码**: QRCode.js (CDN 加载)
- **部署**: GitHub Pages (纯静态)
- **零后端**: 全部前端代码，无需服务器

---

## ⚠️ 注意事项

- 图片以 Base64 dataURL 形式存储在 Gist 中，大量大图会导致 Gist 体积过大（Gist 最大 10MB）
- Token 仅保存在浏览器 localStorage，清除浏览器数据后需重新配置
- 站点数据为公开 Gist，任何知道 ID 的人都可以查看内容
- 密码保护仅前端限制编辑，数据本身仍可被读取
