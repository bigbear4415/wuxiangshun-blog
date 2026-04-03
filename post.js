const postDetail = document.querySelector("#post-detail");

const bindAdaptiveVideoFrames = (root = document) => {
  root.querySelectorAll("video").forEach((video) => {
    const applyRatio = () => {
      if (!video.videoWidth || !video.videoHeight) {
        return;
      }

      const ratio = `${video.videoWidth} / ${video.videoHeight}`;
      const frame = video.closest(".detail-media");

      if (frame) {
        frame.classList.add("video-frame");
        frame.style.aspectRatio = ratio;
      }
    };

    if (video.readyState >= 1) {
      applyRatio();
    } else {
      video.addEventListener("loadedmetadata", applyRatio, { once: true });
    }
  });
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

const createMediaMarkup = (post) => {
  const items = [];

  if (post.imageUrl) {
    items.push(`<img class="detail-image" src="${post.imageUrl}" alt="${post.title}">`);
  }

  if (post.videoUrl) {
    items.push(`<video class="detail-video" src="${post.videoUrl}" controls preload="metadata"></video>`);
  }

  if (!items.length) {
    return "";
  }

  return `<div class="detail-media">${items.join("")}</div>`;
};

const loadPost = async () => {
  if (!postDetail) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const postId = params.get("id");

  if (!postId) {
    postDetail.innerHTML = `
      <p class="post-meta">参数缺失</p>
      <h1>没有找到文章编号</h1>
      <p class="detail-content">请从首页重新进入文章详情页。</p>
    `;
    return;
  }

  try {
    const response = await fetch(`/api/posts/${postId}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "读取文章失败");
    }

    document.title = `${result.title} | 吴祥顺的个人博客`;
    postDetail.innerHTML = `
      <p class="post-meta">${formatDate(result.publishedAt)} - ${result.category}</p>
      <h1 class="detail-title">${result.title}</h1>
      <p class="detail-excerpt">${result.excerpt}</p>
      ${createMediaMarkup(result)}
      <div class="detail-content">${result.content.replace(/\n/g, "<br>")}</div>
      <div class="detail-actions">
        <a class="button button-secondary" href="/index.html">返回首页</a>
        <a class="button button-primary" href="/admin.html">进入后台</a>
      </div>
    `;
    bindAdaptiveVideoFrames(postDetail);
  } catch (error) {
    postDetail.innerHTML = `
      <p class="post-meta">加载失败</p>
      <h1>暂时无法读取这篇文章</h1>
      <p class="detail-content">${error.message}</p>
      <div class="detail-actions">
        <a class="button button-secondary" href="/index.html">返回首页</a>
      </div>
    `;
  }
};

loadPost();
