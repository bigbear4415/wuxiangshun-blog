const express = require("express");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { createStore } = require("./blogStore");
const { createSessionToken, readSessionToken, buildCookie, clearCookie } = require("./auth");

const createApp = () => {
  const rootDir = process.cwd();
  const dataDir = path.join(rootDir, "data");
  const uploadsDir = path.join(rootDir, "uploads");
  const musicDir = path.join(rootDir, "music");
  const configFilePath = path.join(dataDir, "config.json");
  const sessionSecret = process.env.SESSION_SECRET || "wuxiangshun-blog-session-secret";
  const adminPasswordFallback = "wxs574415";

  const store = createStore({
    rootDir,
    dataDir,
    uploadsDir,
    musicDir,
    configFilePath,
    supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET || "blog-media",
    adminPasswordFallback
  });

  const clients = new Set();
  store.ensureLocalFiles().catch((error) => {
    console.error('Failed to initialize local blog files.', error);
  });
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  if (!process.env.VERCEL) {
    app.use(express.static(rootDir));
  }

  const storage = multer.diskStorage({
    destination: uploadsDir,
    filename: (_request, file, callback) => {
      const extension = path.extname(file.originalname);
      callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
    }
  });

  const upload = multer({
    storage,
    limits: { fileSize: 200 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => {
      if (file.fieldname === "image" && file.mimetype.startsWith("image/")) {
        callback(null, true);
        return;
      }
      if (file.fieldname === "video" && file.mimetype.startsWith("video/")) {
        callback(null, true);
        return;
      }
      callback(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
    }
  });

  const uploadFieldsMiddleware = upload.fields([
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 }
  ]);

  const broadcast = (payload) => {
    if (!clients.size) {
      return;
    }

    const message = `data: ${JSON.stringify({ ...payload, timestamp: Date.now() })}\n\n`;
    clients.forEach((client) => client.write(message));
  };

  const getAuthState = (request) => Boolean(readSessionToken(request, sessionSecret));

  const requireAuth = (request, response, next) => {
    if (getAuthState(request)) {
      next();
      return;
    }

    response.status(401).json({ message: "请先登录后台。" });
  };

  const maybeHandleMultipart = (request, response, next) => {
    if (!request.is("multipart/form-data")) {
      next();
      return;
    }

    uploadFieldsMiddleware(request, response, next);
  };

  const validatePostPayload = (payload, response) => {
    if (!payload.title || !payload.category || !payload.excerpt || !payload.content) {
      response.status(400).json({ message: "标题、分类、摘要和正文都不能为空。" });
      return false;
    }

    return true;
  };

  const validateTopicPayload = (payload, response) => {
    if (!payload.title || !payload.description) {
      response.status(400).json({ message: "话题标题和说明都不能为空。" });
      return false;
    }

    return true;
  };

  const buildPostPayload = (request, previousPost) => {
    const body = request.body || {};
    const imageFile = request.files?.image?.[0];
    const videoFile = request.files?.video?.[0];

    const payload = {
      title: String(body.title || "").trim(),
      category: String(body.category || "").trim(),
      excerpt: String(body.excerpt || "").trim(),
      content: String(body.content || "").trim()
    };

    if (request.is("multipart/form-data")) {
      payload.imageUrl = imageFile ? `/uploads/${imageFile.filename}` : body.keepImage === "false" ? "" : previousPost?.imageUrl || "";
      payload.videoUrl = videoFile ? `/uploads/${videoFile.filename}` : body.keepVideo === "false" ? "" : previousPost?.videoUrl || "";
      return payload;
    }

    payload.imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : previousPost?.imageUrl || "";
    payload.videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : previousPost?.videoUrl || "";
    return payload;
  };

  app.get("/api/runtime-config", (_request, response) => {
    response.json({
      storageMode: store.isSupabaseEnabled ? "supabase" : "local",
      supabaseUrl: store.isSupabaseEnabled ? store.supabaseUrl : "",
      supabaseAnonKey: store.isSupabaseEnabled ? store.supabaseAnonKey : "",
      supabaseStorageBucket: store.supabaseStorageBucket,
      pollingIntervalMs: 15000,
      introAudioMode: "local-folder"
    });
  });

  app.get("/api/auth/status", (request, response) => {
    response.json({ authenticated: getAuthState(request) });
  });

  app.post("/api/auth/login", async (request, response) => {
    const password = String(request.body?.password || "").trim();
    const adminPassword = await store.getAdminPassword();

    if (password !== adminPassword) {
      response.status(401).json({ message: "密码不正确，请重试。" });
      return;
    }

    const token = createSessionToken(sessionSecret);
    response.setHeader("Set-Cookie", buildCookie(request, token));
    response.json({ message: "登录成功。" });
  });

  app.post("/api/auth/logout", (request, response) => {
    response.setHeader("Set-Cookie", clearCookie(request));
    response.json({ message: "已退出登录。" });
  });

  app.get("/api/posts", async (_request, response) => {
    try {
      response.json(await store.listPosts());
    } catch (error) {
      console.error(error);
      response.status(500).json({ message: "读取文章失败。" });
    }
  });

  app.get("/api/posts/:id", async (request, response) => {
    try {
      const post = await store.getPost(request.params.id);
      if (!post) {
        response.status(404).json({ message: "文章不存在。" });
        return;
      }
      response.json(post);
    } catch (error) {
      console.error(error);
      response.status(500).json({ message: "读取文章详情失败。" });
    }
  });

  app.post("/api/posts", requireAuth, maybeHandleMultipart, async (request, response) => {
    const payload = buildPostPayload(request);
    if (!validatePostPayload(payload, response)) {
      return;
    }

    try {
      const post = await store.createPost(payload);
      broadcast({ type: "posts-updated", postId: post.id, action: "created" });
      response.status(201).json(post);
    } catch (error) {
      console.error(error);
      response.status(500).json({ message: "保存文章失败。" });
    }
  });

  app.put("/api/posts/:id", requireAuth, maybeHandleMultipart, async (request, response) => {
    const previousPost = await store.getPost(request.params.id);
    if (!previousPost) {
      response.status(404).json({ message: "文章不存在。" });
      return;
    }

    const payload = buildPostPayload(request, previousPost);
    if (!validatePostPayload(payload, response)) {
      return;
    }

    try {
      const post = await store.updatePost(request.params.id, payload);
      broadcast({ type: "posts-updated", postId: post.id, action: "updated" });
      response.json(post);
    } catch (error) {
      console.error(error);
      response.status(500).json({ message: "更新文章失败。" });
    }
  });

  app.delete("/api/posts/:id", requireAuth, async (request, response) => {
    try {
      const removedPost = await store.deletePost(request.params.id);
      if (!removedPost) {
        response.status(404).json({ message: "文章不存在。" });
        return;
      }

      broadcast({ type: "posts-updated", postId: removedPost.id, action: "deleted" });
      response.json({ message: "文章已删除。" });
    } catch (error) {
      console.error(error);
      response.status(500).json({ message: "删除文章失败。" });
    }
  });

  app.get("/api/topics", async (_request, response) => {
    try {
      response.json(await store.listTopics());
    } catch (error) {
      console.error(error);
      response.status(500).json({ message: "读取讨论话题失败。" });
    }
  });

  app.get("/api/topics/:id", async (request, response) => {
    try {
      const topic = await store.getTopic(request.params.id);
      if (!topic) {
        response.status(404).json({ message: "话题不存在。" });
        return;
      }

      response.json(topic);
    } catch (error) {
      console.error(error);
      response.status(500).json({ message: "读取话题详情失败。" });
    }
  });

  app.post("/api/topics", requireAuth, async (request, response) => {
    if (!validateTopicPayload(request.body || {}, response)) {
      return;
    }

    try {
      const topic = await store.createTopic(request.body);
      broadcast({ type: "topics-updated", topicId: topic.id, action: "created" });
      response.status(201).json(topic);
    } catch (error) {
      console.error(error);
      response.status(500).json({ message: "发布话题失败。" });
    }
  });

  app.put("/api/topics/:id", requireAuth, async (request, response) => {
    if (!validateTopicPayload(request.body || {}, response)) {
      return;
    }

    try {
      const topic = await store.updateTopic(request.params.id, request.body);
      if (!topic) {
        response.status(404).json({ message: "话题不存在。" });
        return;
      }

      broadcast({ type: "topics-updated", topicId: topic.id, action: "updated" });
      response.json(topic);
    } catch (error) {
      console.error(error);
      response.status(500).json({ message: "更新话题失败。" });
    }
  });

  app.delete("/api/topics/:id", requireAuth, async (request, response) => {
    try {
      const removedTopic = await store.deleteTopic(request.params.id);
      if (!removedTopic) {
        response.status(404).json({ message: "话题不存在。" });
        return;
      }

      broadcast({ type: "topics-updated", topicId: removedTopic.id, action: "deleted" });
      response.json({ message: "话题已删除。" });
    } catch (error) {
      console.error(error);
      response.status(500).json({ message: "删除话题失败。" });
    }
  });

  app.post("/api/topics/:id/comments", async (request, response) => {
    const content = String(request.body?.content || "").trim();
    const isAnonymous = Boolean(request.body?.isAnonymous);
    const authorName = String(request.body?.authorName || "").trim();

    if (!content) {
      response.status(400).json({ message: "留言内容不能为空。" });
      return;
    }

    if (!isAnonymous && !authorName) {
      response.status(400).json({ message: "如果不匿名，请填写昵称。" });
      return;
    }

    try {
      const comment = await store.addComment(request.params.id, { content, isAnonymous, authorName });
      if (!comment) {
        response.status(404).json({ message: "话题不存在。" });
        return;
      }

      broadcast({ type: "comments-updated", topicId: request.params.id, action: "created" });
      response.status(201).json(comment);
    } catch (error) {
      console.error(error);
      response.status(500).json({ message: "提交留言失败。" });
    }
  });

  app.post("/api/storage/sign", requireAuth, async (request, response) => {
    const filename = String(request.body?.filename || "").trim();
    const contentType = String(request.body?.contentType || "").trim();
    const folder = String(request.body?.folder || "images").trim();

    if (!filename || !contentType) {
      response.status(400).json({ message: "缺少文件名或文件类型。" });
      return;
    }

    try {
      const uploadInfo = await store.createSignedUpload({ filename, contentType, folder });
      response.json(uploadInfo);
    } catch (error) {
      console.error(error);
      response.status(500).json({ message: error.message || "生成上传凭证失败。" });
    }
  });

  app.get("/api/music", async (_request, response) => {
    try {
      response.json(await store.readPlayableMusicFiles());
    } catch (error) {
      console.error(error);
      response.status(500).json({ message: "读取音乐文件失败。" });
    }
  });

  app.get("/api/stream/posts", (_request, response) => {
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });

    response.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
    clients.add(response);

    _request.on("close", () => {
      clients.delete(response);
    });
  });

  app.use((error, _request, response, _next) => {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        response.status(400).json({ message: "上传文件过大，请将单个图片或视频控制在 200MB 以内。" });
        return;
      }

      if (error.code === "LIMIT_UNEXPECTED_FILE") {
        response.status(400).json({ message: "上传失败，请确认图片使用图片文件，视频使用视频文件。" });
        return;
      }

      response.status(400).json({ message: "上传文件时出现问题，请检查后重试。" });
      return;
    }

    console.error("Unhandled app error", {
      message: error?.message,
      code: error?.code,
      path: error?.path,
      stack: error?.stack,
      cwd: process.cwd(),
      rootDir,
      vercel: process.env.VERCEL || ""
    });
    response.status(500).json({ message: "服务器处理请求时发生错误，请稍后重试。" });
  });

  app.locals.store = store;
  return app;
};

module.exports = {
  createApp
};
