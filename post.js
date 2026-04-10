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

applySavedTheme();
loadPost();
