const postDetail = document.querySelector("#post-detail");
const DETAIL_TRANSITION_KEY = "blog-detail-transition";
const rootStyle = document.documentElement.style;

const themePresets = {
  warm: { hue: 16, gold: 38, sage: 165, berry: 344 },
  ocean: { hue: 202, gold: 44, sage: 183, berry: 326 },
  berry: { hue: 344, gold: 26, sage: 166, berry: 336 },
  sunset: { hue: 24, gold: 42, sage: 178, berry: 356 }
};

const moodThemes = {
  tech: {
    className: "mood-tech",
    label: "技术冷调",
    tags: ["技术", "理性", "结构"]
  },
  life: {
    className: "mood-life",
    label: "生活暖调",
    tags: ["生活", "感受", "日常"]
  },
  craft: {
    className: "mood-craft",
    label: "创作绿调",
    tags: ["创作", "作品", "过程"]
  },
  thought: {
    className: "mood-thought",
    label: "思考暮调",
    tags: ["思考", "表达", "沉淀"]
  }
};

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

const setThemeColors = ({ hue, gold, sage, berry }) => {
  rootStyle.setProperty("--primary", `hsl(${hue} 58% 52%)`);
  rootStyle.setProperty("--primary-deep", `hsl(${hue} 55% 33%)`);
  rootStyle.setProperty("--primary-soft", `hsl(${hue + 12} 76% 72%)`);
  rootStyle.setProperty("--gold", `hsl(${gold} 62% 56%)`);
  rootStyle.setProperty("--gold-soft", `hsl(${gold} 80% 82%)`);
  rootStyle.setProperty("--sage", `hsl(${sage} 26% 42%)`);
  rootStyle.setProperty("--sage-soft", `hsl(${sage} 35% 84% / 0.22)`);
  rootStyle.setProperty("--berry", `hsl(${berry} 42% 46%)`);
  rootStyle.setProperty("--berry-soft", `hsl(${berry} 42% 46% / 0.14)`);
};

const getTimeTheme = () => {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 11) {
    return "dawn";
  }

  if (hour >= 11 && hour < 17) {
    return "day";
  }

  if (hour >= 17 && hour < 21) {
    return "dusk";
  }

  return "night";
};

const applySavedTheme = () => {
  const savedPreset = window.localStorage.getItem("blog-theme-preset");
  const savedHue = window.localStorage.getItem("blog-theme-hue");

  if (savedPreset && savedPreset !== "custom" && themePresets[savedPreset]) {
    setThemeColors(themePresets[savedPreset]);
  } else if (savedHue) {
    const hue = Number(savedHue);
    setThemeColors({
      hue,
      gold: (hue + 30) % 360,
      sage: (hue + 150) % 360,
      berry: (hue + 330) % 360
    });
  }

  document.body.dataset.time = getTimeTheme();
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

const inferPostMood = (post) => {
  const content = `${post.category} ${post.title} ${post.excerpt} ${post.content}`.toLowerCase();
  const hasAny = (keywords) => keywords.some((keyword) => content.includes(keyword));

  if (hasAny(["代码", "编程", "开发", "技术", "算法", "系统", "api", "部署", "server", "debug"])) {
    return moodThemes.tech;
  }

  if (hasAny(["设计", "作品", "创作", "灵感", "摄影", "视频", "表达", "品牌"])) {
    return moodThemes.craft;
  }

  if (hasAny(["生活", "日常", "旅行", "朋友", "记录", "晚风", "咖啡", "电影", "成长"])) {
    return moodThemes.life;
  }

  return moodThemes.thought;
};

const readTransitionState = () => {
  try {
    const raw = window.sessionStorage.getItem(DETAIL_TRANSITION_KEY);
    if (!raw) {
      return null;
    }

    const data = JSON.parse(raw);
    window.sessionStorage.removeItem(DETAIL_TRANSITION_KEY);
    return data;
  } catch {
    return null;
  }
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
  const transitionState = readTransitionState();

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

    const mood = inferPostMood(result);
    document.title = `${result.title} | 吴祥顺的个人博客`;
    postDetail.className = `post-detail-card ${mood.className}`;
    if (transitionState?.origin) {
      rootStyle.setProperty("--detail-origin-x", `${transitionState.origin.x}px`);
      rootStyle.setProperty("--detail-origin-y", `${transitionState.origin.y}px`);
      postDetail.classList.add("is-entering");
      window.setTimeout(() => {
        postDetail.classList.remove("is-entering");
      }, 650);
    }

    postDetail.innerHTML = `
      <p class="post-meta">${formatDate(result.publishedAt)} - ${result.category}</p>
      <h1 class="detail-title">${result.title}</h1>
      <p class="detail-excerpt">${result.excerpt}</p>
      <div class="detail-tags">
        <span class="post-tag">${mood.label}</span>
        ${mood.tags.map((tag) => `<span class="post-tag">${tag}</span>`).join("")}
      </div>
      ${createMediaMarkup(result)}
      <div class="detail-content">${result.content.replace(/\n/g, "<br>")}</div>
      <div class="detail-actions">
        <a class="button button-secondary" href="/index.html">← 返回首页</a>
        <button class="post-like-btn" id="post-like-btn" type="button" data-post-id="${result.id}">
          <span class="like-icon">♡</span>
          <span class="like-count" id="like-count">…</span>
        </button>
      </div>
      <section class="post-comments-section" id="post-comments-section">
        <div class="post-comments-header">
          <h2 class="post-comments-title">留言</h2>
          <span class="post-comments-count" id="post-comments-count"></span>
        </div>
        <div class="post-comments-list" id="post-comments-list">
          <p class="post-comments-loading">加载中…</p>
        </div>
        <form class="post-comment-form" id="post-comment-form">
          <div class="comment-mode-row">
            <label class="comment-mode-option">
              <input type="radio" name="comment-mode" value="anon" checked>
              <span>匿名</span>
            </label>
            <label class="comment-mode-option">
              <input type="radio" name="comment-mode" value="named">
              <span>实名</span>
            </label>
          </div>
          <input
            class="post-comment-author hidden"
            id="post-comment-author"
            type="text"
            placeholder="你的昵称（必填）"
            autocomplete="nickname"
          >
          <textarea
            class="post-comment-content"
            id="post-comment-content"
            rows="3"
            placeholder="说点什么……"
            required
          ></textarea>
          <div class="post-comment-submit-row">
            <button class="button button-primary button-small" type="submit">发布留言</button>
            <p class="post-comment-error hidden" id="post-comment-error"></p>
          </div>
        </form>
      </section>
    `;
    bindAdaptiveVideoFrames(postDetail);
    setupLikeButton(result.id);
    setupPostComments(result.id);
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

// ── 点赞 Like Button ─────────────────────────────────────
const setupLikeButton = async (postId) => {
  const btn = document.querySelector("#post-like-btn");
  const countEl = document.querySelector("#like-count");
  if (!btn || !countEl) return;

  const LIKED_KEY = "blog-liked-posts";
  const getLikedSet = () => {
    try { return new Set(JSON.parse(window.localStorage.getItem(LIKED_KEY) || "[]")); }
    catch { return new Set(); }
  };
  const saveLikedSet = (set) => {
    window.localStorage.setItem(LIKED_KEY, JSON.stringify([...set]));
  };

  // Load current count
  try {
    const res = await fetch(`/api/posts/${postId}/likes`);
    if (res.ok) {
      const data = await res.json();
      countEl.textContent = typeof data.likes === "number" ? data.likes : 0;
    } else {
      countEl.textContent = "0";
    }
  } catch {
    countEl.textContent = "0";
  }

  // Restore liked state
  const liked = getLikedSet();
  if (liked.has(postId)) {
    btn.classList.add("is-liked");
    btn.querySelector(".like-icon").textContent = "♥";
  }

  // Particle burst helper
  const burstParticles = () => {
    const emojis = ["✨", "💖", "⭐", "🌸", "💫"];
    for (let i = 0; i < 7; i++) {
      const p = document.createElement("span");
      p.className = "like-particle";
      p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      const angle = (i / 7) * 360;
      const dist = 38 + Math.random() * 24;
      const dx = Math.round(Math.cos((angle * Math.PI) / 180) * dist);
      const dy = Math.round(Math.sin((angle * Math.PI) / 180) * dist);
      p.style.setProperty("--dx", `${dx}px`);
      p.style.setProperty("--dy", `${dy}px`);
      p.style.left = "50%";
      p.style.top = "50%";
      btn.appendChild(p);
      p.addEventListener("animationend", () => p.remove(), { once: true });
    }
  };

  btn.addEventListener("click", async () => {
    const liked = getLikedSet();
    if (liked.has(postId)) return; // already liked

    // Animate
    btn.classList.add("is-liked", "like-burst");
    btn.querySelector(".like-icon").textContent = "♥";
    burstParticles();
    window.setTimeout(() => btn.classList.remove("like-burst"), 500);

    // Persist locally
    liked.add(postId);
    saveLikedSet(liked);

    // Call API
    try {
      const res = await fetch(`/api/posts/${postId}/like`, { method: "POST" });
      if (res.ok) {
        try {
          const data = await res.json();
          if (typeof data.likes === "number") countEl.textContent = data.likes;
        } catch { /* non-JSON, keep optimistic count */ }
      }
    } catch {
      countEl.textContent = String(Number(countEl.textContent) + 1);
    }
  });
};

// ── 文章评论 Post Comments ────────────────────────────────
const formatCommentDate = (dateString) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  }).format(date);
};

const setupPostComments = async (postId) => {
  const listEl = document.querySelector("#post-comments-list");
  const countEl = document.querySelector("#post-comments-count");
  const form = document.querySelector("#post-comment-form");
  const authorInput = document.querySelector("#post-comment-author");
  const contentInput = document.querySelector("#post-comment-content");
  const modeRadios = document.querySelectorAll("input[name='comment-mode']");
  if (!listEl || !form) return;

  // Mode toggle: show/hide author field
  modeRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      const isAnon = document.querySelector("input[name='comment-mode']:checked")?.value === "anon";
      authorInput.classList.toggle("hidden", isAnon);
      if (isAnon) authorInput.value = "";
    });
  });

  const renderComments = (comments) => {
    if (countEl) countEl.textContent = `${comments.length} 条留言`;
    if (!comments.length) {
      listEl.innerHTML = `<p class="post-comments-empty">还没有留言，来说第一句话吧。</p>`;
      return;
    }
    listEl.innerHTML = comments.map((c) => `
      <article class="post-comment-card">
        <div class="post-comment-meta">
          <strong class="post-comment-author-name">${c.isAnonymous ? "匿名读者" : c.authorName}</strong>
          <span class="post-comment-time">${formatCommentDate(c.createdAt)}</span>
        </div>
        <p class="post-comment-body">${c.content.replace(/\n/g, "<br>")}</p>
      </article>
    `).join("");
  };

  // Load comments
  const loadComments = async () => {
    try {
      const res = await fetch(`/api/posts/${postId}/comments`);
      if (!res.ok) throw new Error();
      renderComments(await res.json());
    } catch {
      listEl.innerHTML = `<p class="post-comments-empty">评论加载失败，请刷新重试。</p>`;
    }
  };

  await loadComments();

  // Submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const isAnon = document.querySelector("input[name='comment-mode']:checked")?.value === "anon";
    const author = authorInput.value.trim();
    const content = contentInput.value.trim();

    if (!isAnon && !author) {
      contentInput.setCustomValidity("");
      authorInput.focus();
      return;
    }

    const submitBtn = form.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "发布中…";

    const errorEl = document.querySelector("#post-comment-error");
    if (errorEl) { errorEl.textContent = ""; errorEl.classList.add("hidden"); }

    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, isAnonymous: isAnon, authorName: author })
      });
      let result = {};
      try { result = await res.json(); } catch { /* non-JSON response */ }
      if (!res.ok) throw new Error(result.message || "提交评论失败，请检查服务是否正常运行");

      form.reset();
      // Re-check anon (reset unchecks radio group)
      document.querySelector("input[name='comment-mode'][value='anon']").checked = true;
      authorInput.classList.add("hidden");

      await loadComments();
      // Scroll to newest comment
      listEl.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message || "提交评论失败，请稍后重试";
        errorEl.classList.remove("hidden");
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "发布留言";
    }
  });
};

// ── 阅读进度条 Reading Progress Bar ─────────────────────
const setupReadingProgress = () => {
  const bar = document.querySelector("#read-progress-bar");
  if (!bar) return;

  const update = () => {
    const doc = document.documentElement;
    const scrolled = doc.scrollTop || document.body.scrollTop;
    const total = doc.scrollHeight - doc.clientHeight;
    bar.style.width = total > 0 ? `${(scrolled / total) * 100}%` : "0%";
  };

  window.addEventListener("scroll", update, { passive: true });
  update();
};

applySavedTheme();
loadPost().then(() => {
  setupReadingProgress();
});
