const form = document.querySelector(".newsletter-form");
const message = document.querySelector(".form-message");
const postsContainer = document.querySelector("#posts-container");
const postTemplate = document.querySelector("#post-template");
const featuredCard = document.querySelector("#featured-card");
const introScreen = document.querySelector("#intro-screen");
const introSkip = document.querySelector("#intro-skip");
const introAudio = document.querySelector("#intro-audio");
const musicToggle = document.querySelector("#music-toggle");
const themeOrb = document.querySelector("#theme-orb");
const themePanel = document.querySelector("#theme-panel");
const themeHue = document.querySelector("#theme-hue");
const themeReset = document.querySelector("#theme-reset");
const topicsList = document.querySelector("#topics-list");
const discussionEmpty = document.querySelector("#discussion-empty");
const discussionDetail = document.querySelector("#discussion-detail");
const discussionMeta = document.querySelector("#discussion-meta");
const discussionTitle = document.querySelector("#discussion-title");
const discussionDescription = document.querySelector("#discussion-description");
const commentsList = document.querySelector("#comments-list");
const commentForm = document.querySelector("#comment-form");
const commentAuthor = document.querySelector("#comment-author");
const commentAnonymous = document.querySelector("#comment-anonymous");
const commentMessage = document.querySelector("#comment-message");

let currentTopicId = "";
let cachedTopics = [];
let runtimeConfig = { pollingIntervalMs: 15000 };
let pollTimer = null;
let introMusicReady = false;
let introMusicEnabled = true;
let activeThemePreset = "warm";
const rootStyle = document.documentElement.style;
const DETAIL_TRANSITION_KEY = "blog-detail-transition";

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
      const frame = video.closest(".post-media") || video.closest(".detail-media");

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

const applyTimeTheme = () => {
  document.body.dataset.time = getTimeTheme();
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

const applyThemePreset = (presetName) => {
  const preset = themePresets[presetName] || themePresets.warm;
  activeThemePreset = presetName;
  themeHue && (themeHue.value = String(preset.hue));
  setThemeColors(preset);
  window.localStorage.setItem("blog-theme-preset", presetName);
};

const applyCustomHue = (hue) => {
  const numericHue = Number(hue);
  setThemeColors({
    hue: numericHue,
    gold: (numericHue + 30) % 360,
    sage: (numericHue + 150) % 360,
    berry: (numericHue + 330) % 360
  });
  window.localStorage.setItem("blog-theme-hue", String(numericHue));
  window.localStorage.setItem("blog-theme-preset", "custom");
  activeThemePreset = "custom";
};

const setupThemeOrb = () => {
  if (!themeOrb || !themePanel) {
    return;
  }

  const savedPreset = window.localStorage.getItem("blog-theme-preset");
  const savedHue = window.localStorage.getItem("blog-theme-hue");

  if (savedPreset && savedPreset !== "custom" && themePresets[savedPreset]) {
    applyThemePreset(savedPreset);
  } else if (savedHue) {
    themeHue && (themeHue.value = savedHue);
    applyCustomHue(savedHue);
  } else {
    applyThemePreset("warm");
  }

  const savedX = window.localStorage.getItem("theme-orb-x");
  const savedY = window.localStorage.getItem("theme-orb-y");
  if (savedX && savedY) {
    themeOrb.style.left = `${savedX}px`;
    themeOrb.style.top = `${savedY}px`;
    themeOrb.style.right = "auto";
    themeOrb.style.bottom = "auto";
  }

  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let isDragging = false;
  let didDrag = false;

  const onPointerMove = (event) => {
    if (!isDragging) {
      return;
    }

    const x = Math.max(8, Math.min(window.innerWidth - themeOrb.offsetWidth - 8, event.clientX - dragOffsetX));
    const y = Math.max(8, Math.min(window.innerHeight - themeOrb.offsetHeight - 8, event.clientY - dragOffsetY));
    didDrag = true;
    themeOrb.style.left = `${x}px`;
    themeOrb.style.top = `${y}px`;
    themeOrb.style.right = "auto";
    themeOrb.style.bottom = "auto";
    window.localStorage.setItem("theme-orb-x", String(Math.round(x)));
    window.localStorage.setItem("theme-orb-y", String(Math.round(y)));
  };

  const stopDragging = () => {
    isDragging = false;
    themeOrb.classList.remove("is-dragging");
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stopDragging);
    window.setTimeout(() => {
      didDrag = false;
    }, 0);
  };

  themeOrb.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    isDragging = true;
    const rect = themeOrb.getBoundingClientRect();
    dragOffsetX = event.clientX - rect.left;
    dragOffsetY = event.clientY - rect.top;
    themeOrb.classList.add("is-dragging");
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDragging);
  });

  themeOrb.addEventListener("click", () => {
    if (themeOrb.classList.contains("is-dragging") || didDrag) {
      return;
    }

    const isHidden = themePanel.classList.toggle("hidden");
    themeOrb.setAttribute("aria-expanded", isHidden ? "false" : "true");
  });

  themeHue?.addEventListener("input", (event) => {
    applyCustomHue(event.target.value);
  });

  themeReset?.addEventListener("click", () => {
    applyThemePreset("warm");
    window.localStorage.removeItem("blog-theme-hue");
  });

  document.querySelectorAll("[data-theme-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      applyThemePreset(button.dataset.themePreset);
      window.localStorage.removeItem("blog-theme-hue");
    });
  });
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

const rememberDetailTransition = (post, card) => {
  try {
    const payload = {
      id: post.id,
      moodClass: inferPostMood(post).className,
      title: post.title,
      excerpt: post.excerpt,
      category: post.category,
      timeTheme: getTimeTheme(),
      activeThemePreset,
      customHue: window.localStorage.getItem("blog-theme-hue")
    };

    if (card) {
      const rect = card.getBoundingClientRect();
      payload.origin = {
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height / 2)
      };
    }

    window.sessionStorage.setItem(DETAIL_TRANSITION_KEY, JSON.stringify(payload));
  } catch {
    // Ignore transition cache failures.
  }
};

const openIntro = () => {
  if (!introScreen) {
    return;
  }

  document.body.classList.add("is-intro-active");
  let hasOpened = false;
  const prepareIntroMusic = async () => {
    if (!introAudio) {
      return;
    }

    try {
      const response = await fetch("/api/music");
      if (!response.ok) {
        throw new Error("music endpoint unavailable");
      }

      const tracks = await response.json();
      if (!tracks.length) {
        throw new Error("no deployed tracks");
      }

      introAudio.src = tracks[0].url;
      introMusicReady = true;
    } catch {
      const fallbackSrc = introAudio.dataset.fallbackSrc;
      if (fallbackSrc) {
        introAudio.src = fallbackSrc;
        introMusicReady = true;
      }
    }

    syncMusicToggle();
  };

  const finish = () => {
    if (hasOpened) {
      return;
    }

    hasOpened = true;
    introScreen.classList.add("is-open");
    window.setTimeout(() => {
      introScreen.classList.add("is-hidden");
      document.body.classList.remove("is-intro-active");
    }, 1300);
  };

  const handleEnter = async () => {
    if (introMusicReady && introMusicEnabled && introAudio) {
      try {
        introAudio.volume = 0.55;
        await introAudio.play();
      } catch {
        // Ignore playback failures.
      }
    }

    finish();
  };

  prepareIntroMusic();
  introSkip?.addEventListener("click", handleEnter);
  introScreen.addEventListener("click", handleEnter);
};

const syncMusicToggle = () => {
  if (!musicToggle) {
    return;
  }

  musicToggle.classList.toggle("hidden", !introMusicReady);
  musicToggle.textContent = introMusicEnabled ? "音乐已开" : "音乐已关";
  musicToggle.setAttribute("aria-pressed", introMusicEnabled ? "true" : "false");
};

const observeRevealItems = () => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  document.querySelectorAll(".reveal").forEach((item, index) => {
    item.style.transitionDelay = `${index * 70}ms`;
    observer.observe(item);
  });
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
};

const formatDateTime = (dateString) => {
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
  if (post.videoUrl) {
    return `<video class="post-video" src="${post.videoUrl}" controls preload="metadata"></video>`;
  }

  if (post.imageUrl) {
    return `<img class="post-image" src="${post.imageUrl}" alt="${post.title}">`;
  }

  return "";
};

const updateFeaturedCard = (post) => {
  if (!featuredCard || !post) {
    return;
  }

  const mood = inferPostMood(post);
  featuredCard.className = `hero-card reveal ${mood.className}`;
  featuredCard.innerHTML = `
    <p class="hero-card-label">最新发布</p>
    <h2>${post.title}</h2>
    <p>${post.excerpt}</p>
    <p class="hero-card-tone">${mood.label}</p>
    <a href="/post.html?id=${post.id}">查看详情</a>
  `;
};

const createPostCard = (post) => {
  if (!postTemplate || !postsContainer) {
    return;
  }

  const fragment = postTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".post-card");
  const media = fragment.querySelector(".post-media");
  const meta = fragment.querySelector(".post-meta");
  const title = fragment.querySelector("h3");
  const excerpt = fragment.querySelector(".post-excerpt");
  const body = fragment.querySelector(".post-body");
  const links = fragment.querySelectorAll(".post-link");
  const tone = fragment.querySelector(".post-tone");
  const tags = fragment.querySelector(".post-tags");
  const mood = inferPostMood(post);
  const targetHref = `/post.html?id=${post.id}`;

  const mediaMarkup = createMediaMarkup(post);
  if (mediaMarkup) {
    media.classList.remove("hidden");
    media.innerHTML = mediaMarkup;
    bindAdaptiveVideoFrames(media);
  }

  card.classList.add(mood.className);
  if (post.videoUrl) {
    card.classList.add("has-video");
  }

  meta.textContent = `${formatDate(post.publishedAt)} - ${post.category}`;
  title.textContent = post.title;
  excerpt.textContent = post.excerpt;
  tone.textContent = mood.label;
  body.textContent = post.content.length > 108 ? `${post.content.slice(0, 108)}...` : post.content;
  tags.innerHTML = [post.category, ...mood.tags, post.videoUrl ? "视频" : post.imageUrl ? "图片" : "文字"]
    .slice(0, 4)
    .map((tag) => `<span class="post-tag">${tag}</span>`)
    .join("");
  links.forEach((link) => {
    link.href = targetHref;
  });

  card.addEventListener("click", (event) => {
    const interactive = event.target.closest("a, button, video, input, textarea");
    if (interactive && interactive.tagName !== "A") {
      return;
    }

    rememberDetailTransition(post, card);
    if (!interactive) {
      window.location.href = targetHref;
    }
  });

  postsContainer.appendChild(fragment);
};

const renderPosts = (posts) => {
  if (!postsContainer) {
    return;
  }

  postsContainer.innerHTML = "";

  if (!posts.length) {
    postsContainer.innerHTML = `
      <article class="post-card reveal visible">
        <p class="post-meta">还没有文章</p>
        <h3>后台发布后，这里会自动展示</h3>
        <p class="post-excerpt">你可以先进入后台发布第一篇文章，首页会自动或定时收到更新。</p>
      </article>
    `;
    return;
  }

  updateFeaturedCard(posts[0]);
  posts.forEach(createPostCard);
  observeRevealItems();
  bindAdaptiveVideoFrames(postsContainer);
};

const renderComments = (comments) => {
  if (!commentsList) {
    return;
  }

  if (!comments.length) {
    commentsList.innerHTML = `
      <article class="comment-card">
        <p class="post-meta">还没有留言</p>
        <p>成为第一个参与这个话题的人吧。</p>
      </article>
    `;
    return;
  }

  commentsList.innerHTML = comments
    .map(
      (comment) => `
        <article class="comment-card">
          <div class="comment-header">
            <strong>${comment.isAnonymous ? "匿名用户" : comment.authorName}</strong>
            <span>${formatDateTime(comment.createdAt)}</span>
          </div>
          <p>${comment.content}</p>
        </article>
      `
    )
    .join("");
};

const showTopicDetail = (topic) => {
  currentTopicId = topic.id;
  discussionEmpty?.classList.add("hidden");
  discussionDetail?.classList.remove("hidden");
  discussionMeta.textContent = `${formatDate(topic.publishedAt)} - ${topic.comments.length} 条留言`;
  discussionTitle.textContent = topic.title;
  discussionDescription.textContent = topic.description;
  renderComments(topic.comments || []);

  topicsList?.querySelectorAll(".topic-card").forEach((card) => {
    card.classList.toggle("is-active", card.dataset.topicId === topic.id);
  });
};

const renderTopics = (topics) => {
  cachedTopics = topics;

  if (!topicsList) {
    return;
  }

  if (!topics.length) {
    topicsList.innerHTML = `
      <article class="topic-card topic-card-empty">
        <p class="post-meta">还没有讨论话题</p>
        <h3>后台发布话题后，这里会自动出现</h3>
        <p>你可以先在后台创建一个话题，让大家开始留言。</p>
      </article>
    `;
    discussionEmpty?.classList.remove("hidden");
    discussionDetail?.classList.add("hidden");
    return;
  }

  topicsList.innerHTML = topics
    .map(
      (topic) => `
        <article class="topic-card ${currentTopicId === topic.id ? "is-active" : ""}" data-topic-id="${topic.id}">
          <p class="post-meta">${formatDate(topic.publishedAt)} - ${topic.comments.length} 条留言</p>
          <h3>${topic.title}</h3>
          <p>${topic.description}</p>
        </article>
      `
    )
    .join("");

  const activeTopic = topics.find((topic) => topic.id === currentTopicId) || topics[0];
  showTopicDetail(activeTopic);
};

const loadPosts = async () => {
  if (!postsContainer) {
    return;
  }

  try {
    const response = await fetch("/api/posts");
    if (!response.ok) {
      throw new Error("文章加载失败");
    }

    renderPosts(await response.json());
  } catch {
    postsContainer.innerHTML = `
      <article class="post-card reveal visible">
        <p class="post-meta">加载失败</p>
        <h3>暂时无法获取文章内容</h3>
        <p class="post-excerpt">请确认后端服务已经启动，然后刷新页面重试。</p>
      </article>
    `;
  }
};

const loadTopics = async () => {
  if (!topicsList) {
    return;
  }

  try {
    const response = await fetch("/api/topics");
    if (!response.ok) {
      throw new Error("话题加载失败");
    }

    renderTopics(await response.json());
  } catch {
    topicsList.innerHTML = `
      <article class="topic-card topic-card-empty">
        <p class="post-meta">加载失败</p>
        <h3>暂时无法获取讨论区</h3>
        <p>请确认后端服务已经启动，然后刷新页面重试。</p>
      </article>
    `;
  }
};

const loadRuntimeConfig = async () => {
  try {
    const response = await fetch("/api/runtime-config");
    if (!response.ok) {
      return;
    }

    runtimeConfig = await response.json();
  } catch {
    // Ignore and use defaults.
  }
};

const startPolling = () => {
  if (pollTimer) {
    window.clearInterval(pollTimer);
  }

  pollTimer = window.setInterval(() => {
    loadPosts();
    loadTopics();
  }, runtimeConfig.pollingIntervalMs || 15000);
};

openIntro();
applyTimeTheme();
setupThemeOrb();
observeRevealItems();

loadRuntimeConfig().then(() => {
  loadPosts();
  loadTopics();
  startPolling();
  syncMusicToggle();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    loadPosts();
    loadTopics();
  }
});

topicsList?.addEventListener("click", (event) => {
  const card = event.target.closest(".topic-card[data-topic-id]");
  if (!card) {
    return;
  }

  const topic = cachedTopics.find((item) => item.id === card.dataset.topicId);
  if (topic) {
    showTopicDetail(topic);
  }
});

commentAnonymous?.addEventListener("change", () => {
  if (commentAnonymous.checked) {
    commentAuthor.value = "";
    commentAuthor.disabled = true;
    commentAuthor.placeholder = "匿名留言时不需要填写昵称";
  } else {
    commentAuthor.disabled = false;
    commentAuthor.placeholder = "请输入你的昵称";
  }
});
commentAnonymous?.dispatchEvent(new Event("change"));

commentForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentTopicId) {
    commentMessage.textContent = "请先选择一个讨论话题。";
    return;
  }

  const payload = {
    authorName: commentAuthor.value.trim(),
    isAnonymous: commentAnonymous.checked,
    content: document.querySelector("#comment-content").value.trim()
  };

  try {
    const response = await fetch(`/api/topics/${currentTopicId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || "留言失败");
    }

    commentMessage.textContent = "留言成功，讨论区已经收到你的内容。";
    commentForm.reset();
    commentAnonymous.checked = true;
    commentAnonymous.dispatchEvent(new Event("change"));
    await loadTopics();
  } catch (error) {
    commentMessage.textContent = error.message;
  }
});

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const emailInput = form.querySelector("input[type='email']");
  const email = emailInput.value.trim();

  if (!email) {
    message.textContent = "请先输入你的邮箱地址。";
    return;
  }

  message.textContent = `订阅成功，${email} 已加入更新列表。`;
  form.reset();
});

musicToggle?.addEventListener("click", async () => {
  if (!introAudio || !introMusicReady) {
    return;
  }

  introMusicEnabled = !introMusicEnabled;
  syncMusicToggle();

  if (introMusicEnabled) {
    try {
      introAudio.volume = 0.55;
      await introAudio.play();
    } catch {
      introMusicEnabled = false;
      syncMusicToggle();
    }
    return;
  }

  introAudio.pause();
});

document.querySelectorAll(".post-link").forEach((link) => {
  link.addEventListener("click", (event) => {
    const card = event.target.closest(".post-card");
    if (!card) {
      return;
    }

    const title = card.querySelector("h3")?.textContent || "";
    rememberDetailTransition({
      id: new URL(event.currentTarget.href, window.location.origin).searchParams.get("id"),
      title,
      excerpt: card.querySelector(".post-excerpt")?.textContent || "",
      category: card.querySelector(".post-meta")?.textContent || "",
      content: ""
    }, card);
  });
});
