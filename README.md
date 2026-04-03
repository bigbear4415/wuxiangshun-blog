# 吴祥顺的个人博客

这是一个带后台管理、讨论区、图片视频上传能力的个人博客项目。现在项目同时支持两种运行方式：

- 本地模式：继续使用本地 JSON 和 `uploads` 文件夹，适合你在电脑上直接开发和测试
- 云端模式：部署到 Vercel，文章/话题/评论交给 Supabase Database，图片/视频交给 Supabase Storage

## 当前能力

- 前台展示文章、图片、视频和文章详情页
- 后台登录后发布、编辑、删除文章
- 后台发布、编辑、删除讨论话题
- 前台访客可以匿名或署名留言
- 首屏开场动画与本地音乐文件夹播放
- 支持 Vercel + Supabase 的部署骨架

## 主要文件

- `index.html`：博客首页
- `admin.html`：后台管理页
- `post.html`：文章详情页
- `styles.css`：前后台共用样式
- `script.js`：前台逻辑
- `admin.js`：后台逻辑
- `post.js`：详情页逻辑
- `server.js`：本地 Node 服务入口
- `api/index.js`：Vercel 的 API 入口
- `lib/createApp.js`：后端路由与应用装配
- `lib/blogStore.js`：本地存储 / Supabase 存储双模式数据层
- `lib/auth.js`：后台登录 Cookie 签名逻辑
- `supabase/schema.sql`：Supabase 表结构与基础策略
- `.env.example`：部署时需要的环境变量示例
- `vercel.json`：Vercel 重写配置

## 本地运行

1. 在项目目录执行 `npm install`
2. 执行 `npm start`
3. 打开 `http://localhost:3000`
4. 后台地址：`http://localhost:3000/admin.html`

当前本地默认后台密码：

- `wxs574415`

## 部署到 Vercel + Supabase

### 1. 创建 Supabase 项目

在 Supabase 后台新建一个项目，然后执行：

- 打开 SQL Editor
- 运行 `supabase/schema.sql`

这会创建：

- `posts`
- `topics`
- `comments`
- `blog-media` 存储桶

### 2. 配置环境变量

把这些变量填到 Vercel 项目里：

- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`

可以直接参考：

- `.env.example`

### 3. 部署到 Vercel

1. 把项目推到 GitHub
2. 在 Vercel 导入这个仓库
3. 填好上面的环境变量
4. 部署完成后访问你的 Vercel 域名

### 4. 绑定公网域名

部署完成后，把你的域名 CNAME 或 A 记录解析到 Vercel 提供的地址，然后在 Vercel 后台绑定该域名。

## 一个重要说明

为了兼容 Vercel：

- 前端现在会优先使用 Supabase Storage 直传图片和视频
- 如果没有配置 Supabase，项目仍然会退回本地模式继续工作
- 前台内容同步改成了定时轮询，这样在 Vercel 上比长期 SSE 更稳一些

## 下一步建议

如果你准备真的上线，我接下来最推荐继续做这 2 件事：

1. 我帮你把 Supabase 的数据初始化和首篇文章迁移一起做完
2. 我帮你一步一步把项目真正部署到 Vercel 并绑定你的域名
