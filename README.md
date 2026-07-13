# 📦 永久存储 - Gitee Pages 部署指南

## 前置条件
- 一个 [Gitee 账号](https://gitee.com)（免费注册）
- Worker 已经部署完成（知道 Worker 地址）

---

## 第一步：创建仓库

1. 登录 [Gitee](https://gitee.com)
2. 点右上角 **"+" → 新建仓库**
3. 仓库名称填：`perma-store`（或其他名字）
4. 仓库类型选：**公开**
5. 点击 **"创建"**

## 第二步：上传文件

1. 进入刚创建的仓库
2. 点 **"文件" → "上传文件"**
3. 把本文件夹里的三个文件拖进去：
   - `index.html`
   - `styles.css`
   - `app.js`
4. 点 **"提交"**

## 第三步：配置 API 地址

1. 在仓库的文件列表里，点击 `app.js`
2. 点右上角的 **"编辑"**（铅笔图标）
3. 找到配置部分，大约第 5-18 行：

```javascript
// ---- 配置 ----
const API_BASE = (() => {
  // ...
  // ★ 取消下面注释，填你的 Worker 域名
  // return "https://perma-store.xxx.workers.dev";
  return window.location.origin;
})();
```

4. 把最后两行改成：

```javascript
const API_BASE = (() => {
  // ...
  // ★ 填你的 Worker 域名
  return "https://perma-store.你的名字.workers.dev";
})();
```

5. 点 **"提交"** 保存

## 第四步：开启 Gitee Pages

1. 在仓库页面，点 **"服务" → "Gitee Pages"**
2. 如果是第一次使用，需要实名认证（手机号即可）
3. 部署分支选：`master`
4. 部署目录留空（默认就是根目录）
5. 点 **"启动"**
6. 等待几十秒，你会看到：
   ```
   https://你的用户名.gitee.io/perma-store/
   ```

## 第五步：使用

1. 打开上面的地址
2. 点 **"创建新站点"** → 会自动调你的 Worker 生成 ID
3. 开始添加分区、文字区、图片区
4. 点 **"分享"** → 生成二维码
5. 手机扫码即可访问

---

## 如果 Worker 还没部署

先看 `worker/deploy-worker.bat` 或 `worker/deploy-worker.ps1`
部署 Worker 获得地址后，再来第三步配置 API 地址
