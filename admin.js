const loginPanel = document.querySelector("#login-panel");
const adminLayout = document.querySelector("#admin-layout");
const topicsLayout = document.querySelector("#topics-layout");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const postForm = document.querySelector("#post-form");
const adminMessage = document.querySelector("#admin-message");
const adminPosts = document.querySelector("#admin-posts");
const logoutButton = document.querySelector("#logout-button");
const editorTitle = document.querySelector("#editor-title");
const submitButton = document.querySelector("#submit-button");
const cancelEditButton = document.querySelector("#cancel-edit-button");
const currentMedia = document.querySelector("#current-media");
const currentImageBlock = document.querySelector("#current-image-block");
const currentVideoBlock = document.querySelector("#current-video-block");
const currentImage = document.querySelector("#current-image");
const currentVideo = document.querySelector("#current-video");
const removeImageButton = document.querySelector("#remove-image-button");
const removeVideoButton = document.querySelector("#remove-video-button");
const topicForm = document.querySelector("#topic-form");
const topicMessage = document.querySelector("#topic-message");
const adminTopics = document.querySelector("#admin-topics");
const topicEditorTitle = document.querySelector("#topic-editor-title");
const topicSubmitButton = document.querySelector("#topic-submit-button");
const topicCancelEditButton = document.querySelector("#topic-cancel-edit-button");
const repoToolsLayout = document.querySelector("#repo-tools-layout");

let editingPostId = "";
let keepImage = true;
let keepVideo = true;
let editingTopicId = "";
let runtimeConfig = {
  storageMode: "local",
  supabaseUrl: "",
  supabaseAnonKey: "",
  supabaseStorageBucket: "blog-media",
  localMusicUploadEnabled: true,
  localGitPushEnabled: true,
  runningOnVercel: false
};
let supabaseClient = null;
const resumableUploadThresholdBytes = 6 * 1024 * 1024;

const parseResponsePayload = async (response) => {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return { message: text || "服务器返回了无法识别的响应。" };
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};

const musicLayout = document.querySelector("#music-layout");
const setAuthenticatedView = (authenticated) => {
  loginPanel?.classList.toggle("hidden", authenticated);
  adminLayout?.classList.toggle("hidden", !authenticated);
  topicsLayout?.classList.toggle("hidden", !authenticated);
  musicLayout?.classList.toggle("hidden", !authenticated);
  repoToolsLayout?.classList.toggle("hidden", !authenticated);
};

const resetMediaState = () => {
  keepImage = true;
  keepVideo = true;
  postForm.elements.keepImage.value = "true";
  postForm.elements.keepVideo.value = "true";
  currentMedia?.classList.add("hidden");
  currentImageBlock?.classList.add("hidden");
  currentVideoBlock?.classList.add("hidden");
  if (currentImage) {
    currentImage.src = "";
    currentImage.dataset.mediaUrl = "";
  }
  if (currentVideo) {
    currentVideo.src = "";
    currentVideo.dataset.mediaUrl = "";
    currentVideo.load();
  }
};

const resetEditor = () => {
  editingPostId = "";
  editorTitle.textContent = "发布一篇新文章";
  submitButton.textContent = "发布文章";
  cancelEditButton.classList.add("hidden");
  postForm.reset();
  postForm.elements.postId.value = "";
  resetMediaState();
};

const resetTopicEditor = () => {
  editingTopicId = "";
  topicEditorTitle.textContent = "发布一个新话题";
  topicSubmitButton.textContent = "发布话题";
  topicCancelEditButton.classList.add("hidden");
  topicForm.reset();
  topicForm.elements.topicId.value = "";
};

const showCurrentMedia = (post) => {
  resetMediaState();

  const hasImage = Boolean(post.imageUrl);
  const hasVideo = Boolean(post.videoUrl);
  currentMedia?.classList.toggle("hidden", !hasImage && !hasVideo);

  if (hasImage) {
    currentImage.src = post.imageUrl;
    currentImage.dataset.mediaUrl = post.imageUrl;
    currentImageBlock.classList.remove("hidden");
  }

  if (hasVideo) {
    currentVideo.src = post.videoUrl;
    currentVideo.dataset.mediaUrl = post.videoUrl;
    currentVideoBlock.classList.remove("hidden");
    currentVideo.load();
  }
};

const renderAdminPosts = (posts) => {
  if (!adminPosts) {
    return;
  }

  if (!posts.length) {
    adminPosts.innerHTML = `
      <article class="admin-post-card">
        <h3>还没有已发布文章</h3>
        <p>你发布的第一篇文章会显示在这里，也会同步出现在博客首页。</p>
      </article>
    `;
    return;
  }

  adminPosts.innerHTML = posts
    .map(
      (post) => `
        <article class="admin-post-card">
          <div class="admin-post-cover ${post.imageUrl || post.videoUrl ? "" : "hidden"}">
            ${post.imageUrl ? `<img src="${post.imageUrl}" alt="${post.title}">` : ""}
            ${post.videoUrl ? `<video src="${post.videoUrl}" muted playsinline preload="metadata"></video>` : ""}
          </div>
          <p class="post-meta">${formatDate(post.publishedAt)} - ${post.category}</p>
          <h3>${post.title}</h3>
          <p>${post.excerpt}</p>
          <div class="admin-card-actions">
            <button class="button button-secondary button-small" type="button" data-post-action="edit" data-id="${post.id}">编辑</button>
            <button class="button button-secondary button-small danger-button" type="button" data-post-action="delete" data-id="${post.id}">删除</button>
            <a class="button button-secondary button-small" href="/post.html?id=${post.id}" target="_blank" rel="noreferrer">查看详情</a>
          </div>
        </article>
      `
    )
    .join("");
};

const renderAdminTopics = (topics) => {
  if (!adminTopics) {
    return;
  }

  if (!topics.length) {
    adminTopics.innerHTML = `
      <article class="admin-post-card">
        <h3>还没有讨论话题</h3>
        <p>你发布的第一个话题会出现在这里，前台也会同步开放留言。</p>
      </article>
    `;
    return;
  }

  adminTopics.innerHTML = topics
    .map(
      (topic) => `
        <article class="admin-post-card">
          <p class="post-meta">${formatDate(topic.publishedAt)} - ${topic.comments.length} 条留言</p>
          <h3>${topic.title}</h3>
          <p>${topic.description}</p>
          <div class="admin-card-actions">
            <button class="button button-secondary button-small" type="button" data-topic-action="edit" data-id="${topic.id}">编辑</button>
            <button class="button button-secondary button-small danger-button" type="button" data-topic-action="delete" data-id="${topic.id}">删除</button>
          </div>
        </article>
      `
    )
    .join("");
};

const loadRuntimeConfig = async () => {
  try {
    const response = await fetch("/api/runtime-config");
    if (!response.ok) {
      throw new Error("读取运行配置失败");
    }

    runtimeConfig = await response.json();
    if (runtimeConfig.storageMode === "supabase") {
      if (!window.supabase?.createClient) {
        throw new Error("未加载 Supabase 浏览器 SDK。");
      }

      supabaseClient = window.supabase.createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseAnonKey, {
        auth: { persistSession: false }
      });
    }

    syncLocalFeatureNotes();
  } catch (error) {
    loginMessage.textContent = error.message;
  }
};

const syncLocalFeatureNotes = () => {
  const musicModeNote = document.querySelector("#music-mode-note");
  const repoModeNote = document.querySelector("#repo-mode-note");

  if (musicModeNote) {
    musicModeNote.textContent = runtimeConfig.localMusicUploadEnabled
      ? "当前是本地运行模式：上传的音乐文件会直接写入项目的 music 文件夹。"
      : "当前是线上运行模式：这里不能把文件写回你电脑上的 music 文件夹。请在本地启动博客服务后再上传。";
    musicModeNote.classList.toggle("is-warning", !runtimeConfig.localMusicUploadEnabled);
  }

  if (repoModeNote) {
    repoModeNote.textContent = runtimeConfig.localGitPushEnabled
      ? "当前是本地运行模式：按钮会在本机项目目录执行 git add、commit、push。"
      : "当前是线上运行模式：这里不能替你操作本机 Git。请在本地启动博客服务后使用这个按钮。";
    repoModeNote.classList.toggle("is-warning", !runtimeConfig.localGitPushEnabled);
  }
};

const loadAdminPosts = async () => {
  try {
    const response = await fetch("/api/posts");
    if (!response.ok) {
      throw new Error("加载文章失败");
    }

    const posts = await response.json();
    renderAdminPosts(posts);
    return posts;
  } catch {
    if (adminPosts) {
      adminPosts.innerHTML = `
        <article class="admin-post-card">
          <h3>暂时无法读取文章</h3>
          <p>请确认后端服务已经启动，然后重新刷新页面。</p>
        </article>
      `;
    }
    return [];
  }
};

const loadAdminTopics = async () => {
  try {
    const response = await fetch("/api/topics");
    if (!response.ok) {
      throw new Error("加载话题失败");
    }

    const topics = await response.json();
    renderAdminTopics(topics);
    return topics;
  } catch {
    if (adminTopics) {
      adminTopics.innerHTML = `
        <article class="admin-post-card">
          <h3>暂时无法读取话题</h3>
          <p>请确认后端服务已经启动，然后重新刷新页面。</p>
        </article>
      `;
    }
    return [];
  }
};

const loadPostDetail = async (postId) => {
  const response = await fetch(`/api/posts/${postId}`);
  const result = await parseResponsePayload(response);

  if (!response.ok) {
    throw new Error(result.message || "读取文章详情失败");
  }

  return result;
};

const loadTopicDetail = async (topicId) => {
  const response = await fetch(`/api/topics/${topicId}`);
  const result = await parseResponsePayload(response);

  if (!response.ok) {
    throw new Error(result.message || "读取话题详情失败");
  }

  return result;
};

const fillEditor = (post) => {
  editingPostId = post.id;
  editorTitle.textContent = "编辑文章";
  submitButton.textContent = "保存更新";
  cancelEditButton.classList.remove("hidden");
  postForm.elements.postId.value = post.id;
  postForm.elements.title.value = post.title;
  postForm.elements.category.value = post.category;
  postForm.elements.excerpt.value = post.excerpt;
  postForm.elements.content.value = post.content;
  showCurrentMedia(post);
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const fillTopicEditor = (topic) => {
  editingTopicId = topic.id;
  topicEditorTitle.textContent = "编辑讨论话题";
  topicSubmitButton.textContent = "保存话题";
  topicCancelEditButton.classList.remove("hidden");
  topicForm.elements.topicId.value = topic.id;
  topicForm.elements.title.value = topic.title;
  topicForm.elements.description.value = topic.description;
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
};

const requestSignedUpload = async (file, folder) => {
  const response = await fetch("/api/storage/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      folder
    })
  });

  const result = await parseResponsePayload(response);
  if (!response.ok) {
    throw new Error(result.message || "获取上传凭证失败");
  }

  return result;
};

const getSupabaseProjectRef = () => {
  if (!runtimeConfig.supabaseUrl) {
    throw new Error("缺少 Supabase 项目地址，暂时无法上传媒体。");
  }

  const url = new URL(runtimeConfig.supabaseUrl);
  const [projectRef] = url.hostname.split(".");

  if (!projectRef) {
    throw new Error("无法识别 Supabase 项目标识。");
  }

  return projectRef;
};

const uploadMediaWithTus = async (file, uploadInfo) => {
  if (!window.tus?.Upload) {
    throw new Error("页面未加载可恢复上传组件，暂时无法上传大文件。");
  }

  const projectRef = getSupabaseProjectRef();
  const endpoint = `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;

  return new Promise((resolve, reject) => {
    const upload = new window.tus.Upload(file, {
      endpoint,
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 1000, 3000, 5000],
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: uploadInfo.bucket,
        objectName: uploadInfo.path,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600"
      },
      headers: {
        authorization: `Bearer ${runtimeConfig.supabaseAnonKey}`,
        "x-signature": uploadInfo.token,
        "x-upsert": "true"
      },
      onError: (error) => {
        reject(new Error(error?.message || "视频上传失败，请稍后重试。"));
      },
      onSuccess: () => resolve(uploadInfo.publicUrl)
    });

    upload.start();
  });
};

const uploadMediaToSupabase = async (file, folder) => {
  if (!file) {
    return "";
  }

  if (!supabaseClient) {
    throw new Error("Supabase 客户端未初始化，暂时无法上传媒体。");
  }

  const uploadInfo = await requestSignedUpload(file, folder);
  const shouldUseResumableUpload = file.size > resumableUploadThresholdBytes || file.type.startsWith("video/");

  if (shouldUseResumableUpload) {
    return uploadMediaWithTus(file, uploadInfo);
  }

  const { error } = await supabaseClient.storage
    .from(uploadInfo.bucket)
    .uploadToSignedUrl(uploadInfo.path, uploadInfo.token, file, {
      contentType: file.type,
      upsert: true
    });

  if (error) {
    throw new Error(error.message || "上传媒体到云存储失败");
  }

  return uploadInfo.publicUrl;
};

const buildSupabasePostPayload = async () => {
  const imageFile = postForm.elements.image.files?.[0] || null;
  const videoFile = postForm.elements.video.files?.[0] || null;
  let imageUrl = keepImage && currentImage?.dataset.mediaUrl ? currentImage.dataset.mediaUrl : "";
  let videoUrl = keepVideo && currentVideo?.dataset.mediaUrl ? currentVideo.dataset.mediaUrl : "";

  if (imageFile) {
    adminMessage.textContent = "正在上传图片到云端...";
    imageUrl = await uploadMediaToSupabase(imageFile, "images");
  }

  if (videoFile) {
    adminMessage.textContent = imageFile ? "图片已上传，正在上传视频到云端..." : "正在上传视频到云端...";
    videoUrl = await uploadMediaToSupabase(videoFile, "videos");
  }

  return {
    title: postForm.elements.title.value.trim(),
    category: postForm.elements.category.value.trim(),
    excerpt: postForm.elements.excerpt.value.trim(),
    content: postForm.elements.content.value.trim(),
    imageUrl,
    videoUrl
  };
};

const submitPost = async () => {
  const isEditing = Boolean(editingPostId);

  if (runtimeConfig.storageMode !== "supabase") {
    const formData = new FormData(postForm);
    const response = await fetch(isEditing ? `/api/posts/${editingPostId}` : "/api/posts", {
      method: isEditing ? "PUT" : "POST",
      body: formData
    });

    const result = await parseResponsePayload(response);
    if (!response.ok) {
      throw new Error(result.message || (isEditing ? "更新失败" : "发布失败"));
    }

    return result;
  }

  const payload = await buildSupabasePostPayload();
  const response = await fetch(isEditing ? `/api/posts/${editingPostId}` : "/api/posts", {
    method: isEditing ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const result = await parseResponsePayload(response);
  if (!response.ok) {
    throw new Error(result.message || (isEditing ? "更新失败" : "发布失败"));
  }

  return result;
};

const checkAuthStatus = async () => {
  try {
    const response = await fetch("/api/auth/status");
    if (!response.ok) {
      throw new Error("状态检查失败");
    }

    const result = await response.json();
    setAuthenticatedView(result.authenticated);

    if (result.authenticated) {
      await Promise.all([loadAdminPosts(), loadAdminTopics(), loadMusicLibrary()]);
    }
  } catch {
    setAuthenticatedView(false);
  }
};

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const password = String(formData.get("password") || "").trim();

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });

    const result = await parseResponsePayload(response);
    if (!response.ok) {
      throw new Error(result.message || "登录失败");
    }

    loginMessage.textContent = "登录成功，欢迎进入后台。";
    loginForm.reset();
    setAuthenticatedView(true);
    resetEditor();
    resetTopicEditor();
    await Promise.all([loadAdminPosts(), loadAdminTopics(), loadMusicLibrary()]);
  } catch (error) {
    loginMessage.textContent = error.message;
  }
});

postForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    await submitPost();
    adminMessage.textContent = editingPostId ? "文章已更新，前台会自动或定时收到最新版本。" : "文章已发布，前台会自动或定时收到更新。";
    resetEditor();
    await loadAdminPosts();
  } catch (error) {
    adminMessage.textContent = error.message;
  }
});

topicForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(topicForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const isEditing = Boolean(editingTopicId);
    const response = await fetch(isEditing ? `/api/topics/${editingTopicId}` : "/api/topics", {
      method: isEditing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: payload.title, description: payload.description })
    });

    const result = await parseResponsePayload(response);
    if (!response.ok) {
      throw new Error(result.message || (isEditing ? "更新话题失败" : "发布话题失败"));
    }

    topicMessage.textContent = isEditing ? "话题已更新，前台讨论区会自动或定时同步。" : "话题已发布，前台现在可以开始留言。";
    resetTopicEditor();
    await loadAdminTopics();
  } catch (error) {
    topicMessage.textContent = error.message;
  }
});

adminPosts?.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-post-action]");
  if (!target) {
    return;
  }

  const { postAction, id } = target.dataset;

  if (postAction === "edit") {
    try {
      fillEditor(await loadPostDetail(id));
      adminMessage.textContent = "";
    } catch (error) {
      adminMessage.textContent = error.message;
    }
    return;
  }

  if (postAction === "delete") {
    if (!window.confirm("确定要删除这篇文章吗？删除后前台会立刻或在下一次轮询时同步更新。")) {
      return;
    }

    try {
      const response = await fetch(`/api/posts/${id}`, { method: "DELETE" });
      const result = await parseResponsePayload(response);
      if (!response.ok) {
        throw new Error(result.message || "删除失败");
      }

      if (editingPostId === id) {
        resetEditor();
      }

      adminMessage.textContent = "文章已删除。";
      await loadAdminPosts();
    } catch (error) {
      adminMessage.textContent = error.message;
    }
  }
});

adminTopics?.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-topic-action]");
  if (!target) {
    return;
  }

  const { topicAction, id } = target.dataset;

  if (topicAction === "edit") {
    try {
      fillTopicEditor(await loadTopicDetail(id));
      topicMessage.textContent = "";
    } catch (error) {
      topicMessage.textContent = error.message;
    }
    return;
  }

  if (topicAction === "delete") {
    if (!window.confirm("确定要删除这个话题吗？对应留言也会一起删除。")) {
      return;
    }

    try {
      const response = await fetch(`/api/topics/${id}`, { method: "DELETE" });
      const result = await parseResponsePayload(response);
      if (!response.ok) {
        throw new Error(result.message || "删除话题失败");
      }

      if (editingTopicId === id) {
        resetTopicEditor();
      }

      topicMessage.textContent = "话题已删除。";
      await loadAdminTopics();
    } catch (error) {
      topicMessage.textContent = error.message;
    }
  }
});

removeImageButton?.addEventListener("click", () => {
  keepImage = false;
  postForm.elements.keepImage.value = "false";
  currentImageBlock.classList.add("hidden");
  currentImage.src = "";
  currentImage.dataset.mediaUrl = "";
  if (currentVideoBlock.classList.contains("hidden")) {
    currentMedia.classList.add("hidden");
  }
});

removeVideoButton?.addEventListener("click", () => {
  keepVideo = false;
  postForm.elements.keepVideo.value = "false";
  currentVideoBlock.classList.add("hidden");
  currentVideo.src = "";
  currentVideo.dataset.mediaUrl = "";
  currentVideo.load();
  if (currentImageBlock.classList.contains("hidden")) {
    currentMedia.classList.add("hidden");
  }
});

cancelEditButton?.addEventListener("click", () => {
  adminMessage.textContent = "已取消编辑，回到新建文章状态。";
  resetEditor();
});

topicCancelEditButton?.addEventListener("click", () => {
  topicMessage.textContent = "已取消编辑，回到新建话题状态。";
  resetTopicEditor();
});

logoutButton?.addEventListener("click", async () => {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } finally {
    adminMessage.textContent = "";
    topicMessage.textContent = "";
    loginMessage.textContent = "你已退出后台。";
    setAuthenticatedView(false);
    resetEditor();
    resetTopicEditor();
  }
});

// ── 音乐管理 Music Management ──────────────────────────────
const musicUploadForm = document.querySelector("#music-upload-form");
const musicFileInput = document.querySelector("#music-file-input");
const musicDropArea = document.querySelector("#music-drop-area");
const musicUploadQueue = document.querySelector("#music-upload-queue");
const musicQueueList = document.querySelector("#music-queue-list");
const musicQueueLabel = document.querySelector("#music-queue-label");
const musicUploadBtn = document.querySelector("#music-upload-btn");
const musicClearBtn = document.querySelector("#music-clear-btn");
const musicUploadMessage = document.querySelector("#music-upload-message");
const musicLibraryList = document.querySelector("#music-library-list");
const musicModeNote = document.querySelector("#music-mode-note");
const gitPushForm = document.querySelector("#git-push-form");
const gitCommitMessage = document.querySelector("#git-commit-message");
const gitPushBtn = document.querySelector("#git-push-btn");
const gitPushMessage = document.querySelector("#git-push-message");

let pendingMusicFiles = [];

const formatTrackNameAdmin = (rawName) => {
  return rawName.replace(/\.[^.]+$/, "");
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const syncMusicQueue = () => {
  if (!pendingMusicFiles.length) {
    musicUploadQueue?.classList.add("hidden");
    return;
  }

  musicUploadQueue?.classList.remove("hidden");
  if (musicQueueLabel) musicQueueLabel.textContent = `已选择 ${pendingMusicFiles.length} 个文件`;

  if (musicQueueList) {
    musicQueueList.innerHTML = pendingMusicFiles.map((f, i) => `
      <div class="music-queue-item">
        <span class="music-queue-icon">♩</span>
        <span class="music-queue-name">${formatTrackNameAdmin(f.name)}</span>
        <span class="music-queue-size">${formatFileSize(f.size)}</span>
        <button class="music-queue-remove" type="button" data-queue-idx="${i}" title="移除">✕</button>
      </div>
    `).join("");

    musicQueueList.querySelectorAll(".music-queue-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.queueIdx);
        pendingMusicFiles.splice(idx, 1);
        syncMusicQueue();
      });
    });
  }
};

const loadMusicLibrary = async () => {
  if (!musicLibraryList) return;

  if (!runtimeConfig.localMusicUploadEnabled) {
    musicLibraryList.innerHTML = `<p class="admin-text">线上环境不会读取你电脑里的 music 文件夹，所以这里不会显示本地曲库。请在本地运行后台时使用这个功能。</p>`;
    return;
  }

  try {
    const response = await fetch("/api/music");
    if (!response.ok) throw new Error();

    const tracks = await response.json();

    if (!tracks.length) {
      musicLibraryList.innerHTML = `<p class="admin-text">曲库为空，上传一些音乐文件吧。</p>`;
      return;
    }

    musicLibraryList.innerHTML = tracks.map((track) => `
      <div class="music-lib-item">
        <span class="music-lib-icon">🎵</span>
        <div class="music-lib-info">
          <span class="music-lib-name">${formatTrackNameAdmin(track.name)}</span>
          <audio class="music-lib-preview" controls preload="none" src="${track.url}"></audio>
        </div>
        <button class="button button-secondary button-small danger-button music-lib-delete" type="button" data-filename="${encodeURIComponent(track.name)}">删除</button>
      </div>
    `).join("");

    musicLibraryList.querySelectorAll(".music-lib-delete").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const filename = btn.dataset.filename;
        if (!window.confirm(`确定要删除这个音乐文件吗？`)) return;

        try {
          const response = await fetch(`/api/music/${filename}`, { method: "DELETE" });
          const result = await parseResponsePayload(response);
          if (!response.ok) throw new Error(result.message || "删除失败");
          await loadMusicLibrary();
        } catch (error) {
          if (musicUploadMessage) musicUploadMessage.textContent = error.message;
        }
      });
    });
  } catch {
    musicLibraryList.innerHTML = `<p class="admin-text">加载曲库失败，请刷新页面重试。</p>`;
  }
};

// 文件选择
musicFileInput?.addEventListener("change", () => {
  const files = Array.from(musicFileInput.files || []);
  pendingMusicFiles = [...pendingMusicFiles, ...files].slice(0, 10);
  musicFileInput.value = "";
  syncMusicQueue();
});

// 拖放
if (musicDropArea) {
  ["dragenter", "dragover"].forEach((evt) => {
    musicDropArea.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); musicDropArea.classList.add("is-dragover"); });
  });
  ["dragleave", "drop"].forEach((evt) => {
    musicDropArea.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); musicDropArea.classList.remove("is-dragover"); });
  });
  musicDropArea.addEventListener("drop", (e) => {
    const files = Array.from(e.dataTransfer?.files || []).filter((f) => /\.(mp3|wav|ogg|m4a|aac)$/i.test(f.name));
    pendingMusicFiles = [...pendingMusicFiles, ...files].slice(0, 10);
    syncMusicQueue();
  });
}

// 清空
musicClearBtn?.addEventListener("click", () => {
  pendingMusicFiles = [];
  syncMusicQueue();
  if (musicUploadMessage) musicUploadMessage.textContent = "";
});

// 上传
musicUploadForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!pendingMusicFiles.length) return;

  if (!runtimeConfig.localMusicUploadEnabled) {
    if (musicUploadMessage) musicUploadMessage.textContent = "当前是线上运行环境，不能把音乐文件写入你本机的 music 文件夹。";
    return;
  }

  if (musicUploadBtn) { musicUploadBtn.disabled = true; musicUploadBtn.textContent = "上传中…"; }
  if (musicUploadMessage) musicUploadMessage.textContent = "";

  try {
    const formData = new FormData();
    pendingMusicFiles.forEach((f) => formData.append("music", f));

    const response = await fetch("/api/music/upload", {
      method: "POST",
      body: formData
    });

    const result = await parseResponsePayload(response);
    if (!response.ok) throw new Error(result.message || "上传失败");

    if (musicUploadMessage) musicUploadMessage.textContent = result.message || "上传成功！";
    pendingMusicFiles = [];
    syncMusicQueue();
    await loadMusicLibrary();
  } catch (error) {
    if (musicUploadMessage) musicUploadMessage.textContent = error.message;
  } finally {
    if (musicUploadBtn) { musicUploadBtn.disabled = false; musicUploadBtn.textContent = "开始上传"; }
  }
});

gitPushForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!runtimeConfig.localGitPushEnabled) {
    if (gitPushMessage) gitPushMessage.textContent = "当前是线上运行环境，不能在这里执行本机 git push。";
    return;
  }

  if (gitPushBtn) {
    gitPushBtn.disabled = true;
    gitPushBtn.textContent = "正在推送…";
  }
  if (gitPushMessage) {
    gitPushMessage.textContent = "";
  }

  try {
    const response = await fetch("/api/local-tools/git-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: gitCommitMessage?.value?.trim() || ""
      })
    });

    const result = await parseResponsePayload(response);
    if (!response.ok) {
      throw new Error(result.message || "自动 git push 失败");
    }

    if (gitPushMessage) {
      gitPushMessage.textContent = result.message || "推送成功。";
    }

    if (gitCommitMessage && result.committed) {
      gitCommitMessage.value = "";
    }
  } catch (error) {
    if (gitPushMessage) {
      gitPushMessage.textContent = error.message;
    }
  } finally {
    if (gitPushBtn) {
      gitPushBtn.disabled = false;
      gitPushBtn.textContent = "一键 git push";
    }
  }
});

const init = async () => {
  await loadRuntimeConfig();
  await checkAuthStatus();
};

init();

