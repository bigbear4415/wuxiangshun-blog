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
// commentAnonymous: removed — replaced by disc-mode radio buttons
const commentMessage = document.querySelector("#comment-message");

// ── Toast 通知系统 ─────────────────────────────────────────
const toastContainer = document.querySelector("#toast-container");

const showToast = (text, type = "info") => {
  if (!toastContainer) return;
  const icons = { success: "✓", error: "✕", info: "·" };
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${text}</span>`;
  toastContainer.appendChild(toast);

  const dismiss = () => {
    toast.classList.add("is-exiting");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  };
  const timer = window.setTimeout(dismiss, 3400);
  toast.addEventListener("click", () => { window.clearTimeout(timer); dismiss(); });
};

// ── 骨架屏 Skeleton Loading ────────────────────────────────
const renderSkeleton = () => {
  if (!postsContainer) return;
  const lines = (specs) =>
    specs.map(([h, w]) =>
      `<div class="skeleton-line" style="height:${h};width:${w || "100%"}"></div>`
    ).join("");

  postsContainer.innerHTML = Array.from({ length: 3 }, (_, i) => `
    <article class="skeleton-card${i === 0 ? " post-card--featured" : ""}">
      ${lines([["0.68rem","55%"],["1.9rem","80%"],["1.7rem","65%"],["1rem","100%"],["1rem","90%"],["0.68rem","40%"]])}
    </article>
  `).join("");
};

// ── 预计阅读时长 Reading Time ─────────────────────────────
const calcReadingTime = (text) => {
  const mins = Math.max(1, Math.ceil(text.length / 350));
  return `约 ${mins} 分钟`;
};

// ── 汉堡菜单 Hamburger Menu ───────────────────────────────
const setupHamburger = () => {
  const hamburger = document.querySelector("#nav-hamburger");
  const navLinks = document.querySelector("#top-nav-links");
  const overlay = document.querySelector("#nav-overlay");
  if (!hamburger || !navLinks) return;

  const toggle = (open) => {
    hamburger.classList.toggle("is-open", open);
    navLinks.classList.toggle("is-open", open);
    overlay?.classList.toggle("is-open", open);
    hamburger.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.style.overflow = open ? "hidden" : "";
  };

  hamburger.addEventListener("click", () => {
    toggle(!navLinks.classList.contains("is-open"));
  });
  overlay?.addEventListener("click", () => toggle(false));
  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => toggle(false));
  });
};

// ── 滚动高亮导航 Active Nav on Scroll ────────────────────
const setupNavHighlight = () => {
  const sections = document.querySelectorAll("section[id]");
  const navLinks = document.querySelectorAll(".top-nav-links a[href^='#']");
  if (!sections.length || !navLinks.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
          link.classList.toggle(
            "is-active",
            link.getAttribute("href") === `#${entry.target.id}`
          );
        });
      });
    },
    { rootMargin: "-15% 0px -65% 0px", threshold: 0 }
  );

  sections.forEach((section) => observer.observe(section));
};

// ── 隐藏后台入口 Secret Admin Access ─────────────────────
const setupSecretAdmin = () => {
  const footerCopy = document.querySelector("#footer-copy");
  if (!footerCopy) return;

  let clickCount = 0;
  let resetTimer = null;

  footerCopy.style.cursor = "default";
  footerCopy.addEventListener("click", () => {
    clickCount++;
    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => { clickCount = 0; }, 1800);
    if (clickCount >= 5) {
      clickCount = 0;
      window.location.href = "/admin.html";
    }
  });

  // Keyboard shortcut: Ctrl+Shift+A
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === "A") {
      e.preventDefault();
      window.location.href = "/admin.html";
    }
  });
};

// ── 返回顶部 Back to Top ──────────────────────────────────
const setupBackToTop = () => {
  const btn = document.querySelector("#back-to-top");
  if (!btn) return;

  window.addEventListener(
    "scroll",
    () => { btn.classList.toggle("is-visible", window.scrollY > 600); },
    { passive: true }
  );

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
};

let currentTopicId = "";
let cachedTopics = [];
let runtimeConfig = { pollingIntervalMs: 15000 };
let pollTimer = null;
let introMusicReady = false;
let introMusicEnabled = true;
let musicTracks = [];        // { name, url }[]
let currentTrackIdx = 0;
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
      if (!response.ok) throw new Error("music endpoint unavailable");

      const tracks = await response.json();
      if (!tracks.length) throw new Error("no deployed tracks");

      musicTracks = tracks;
      currentTrackIdx = 0;
      introAudio.src = musicTracks[0].url;
      introMusicReady = true;
    } catch {
      const fallbackSrc = introAudio.dataset.fallbackSrc;
      if (fallbackSrc) {
        musicTracks = [{ name: "默认曲目", url: fallbackSrc }];
        currentTrackIdx = 0;
        introAudio.src = fallbackSrc;
        introMusicReady = true;
      }
    }

    renderMusicTrackList();
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

// ── 音乐播放器工具 Music Player Helpers ──────────────────────
const formatTrackName = (rawName) => {
  // 去掉扩展名
  let name = rawName.replace(/\.[^.]+$/, "");
  // 如果是 Supabase 随机文件名（obj_...长哈希），截短显示
  if (/^obj_\w{8,}/.test(name) || name.length > 60) {
    return name.slice(0, 30) + "…";
  }
  return name;
};

const renderMusicTrackList = () => {
  const listEl = document.querySelector("#music-track-list");
  if (!listEl) return;

  if (!musicTracks.length) {
    listEl.innerHTML = `<p class="music-track-empty">暂无曲目</p>`;
    return;
  }

  listEl.innerHTML = musicTracks.map((track, i) => `
    <button
      class="music-track-item ${i === currentTrackIdx ? "is-active" : ""}"
      data-track-idx="${i}"
      type="button"
      title="${track.name}"
    >
      <span class="music-track-icon" aria-hidden="true">${i === currentTrackIdx ? "▶" : "♩"}</span>
      <span class="music-track-name">${formatTrackName(track.name)}</span>
      ${i === currentTrackIdx ? '<span class="music-track-badge">播放中</span>' : ""}
    </button>
  `).join("");

  // 点击切歌
  listEl.querySelectorAll(".music-track-item").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.trackIdx);
      if (idx === currentTrackIdx && introMusicEnabled) return;

      currentTrackIdx = idx;
      const track = musicTracks[idx];
      introAudio.src = track.url;
      introAudio.currentTime = 0;

      if (!introMusicEnabled) {
        introMusicEnabled = true;
      }

      try {
        introAudio.volume = 0.55;
        await introAudio.play();
      } catch { /* ignore */ }

      renderMusicTrackList();
      syncMusicToggle();
    });
  });
};

const syncMusicToggle = () => {
  const widget = document.querySelector("#music-widget");
  if (!widget) return;

  widget.classList.toggle("hidden", !introMusicReady);

  const discEl = document.querySelector("#music-disc");
  const labelEl = document.querySelector("#music-play-label");
  const btn = document.querySelector("#music-toggle");

  if (discEl) discEl.classList.toggle("is-spinning", introMusicEnabled);
  if (labelEl) {
    const trackName = musicTracks[currentTrackIdx]
      ? formatTrackName(musicTracks[currentTrackIdx].name)
      : "音乐";
    labelEl.textContent = introMusicEnabled ? trackName : "已暂停";
  }
  if (btn) btn.setAttribute("aria-pressed", introMusicEnabled ? "true" : "false");
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
  const mediaMarkup = createMediaMarkup(post);
  featuredCard.className = `featured-spotlight editorial-card reveal visible ${mood.className}`;
  featuredCard.innerHTML = `
    <p class="hero-card-label">最新发布</p>
    <h2>${post.title}</h2>
    <p>${post.excerpt}</p>
    <p class="hero-card-tone">${mood.label}</p>
    ${mediaMarkup ? `<div class="post-media">${mediaMarkup}</div>` : ""}
    <a href="/post.html?id=${post.id}">查看详情</a>
  `;
  bindAdaptiveVideoFrames(featuredCard);
};

const createPostCard = (post, index) => {
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

  if (index === 0) {
    card.classList.add("post-card--featured");
  }

  card.classList.add(mood.className);
  if (post.videoUrl) {
    card.classList.add("has-video");
  }

  meta.textContent = `${formatDate(post.publishedAt)} · ${post.category} · ${calcReadingTime(post.content)}`;
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
  posts.forEach((post, index) => createPostCard(post, index));
  observeRevealItems();
  bindAdaptiveVideoFrames(postsContainer);
};

const renderComments = (comments, animate = false) => {
  if (!commentsList) {
    return;
  }

  if (!comments.length) {
    commentsList.innerHTML = `
      <div class="disc-comments-empty">
        <span class="disc-empty-icon">💬</span>
        <p>还没有留言，来说第一句话吧。</p>
      </div>
    `;
    return;
  }

  commentsList.innerHTML = comments
    .map(
      (comment, i) => {
        const name = comment.isAnonymous ? "匿名读者" : (comment.authorName || "读者");
        const initial = name[0].toUpperCase();
        const delay = animate ? `${i * 0.07}s` : "0s";
        return `
          <article class="comment-card disc-comment-card" style="animation-delay:${delay}">
            <div class="disc-comment-avatar" aria-hidden="true">${comment.isAnonymous ? "?" : initial}</div>
            <div class="disc-comment-body">
              <div class="disc-comment-meta">
                <strong class="disc-comment-author">${name}</strong>
                <span class="disc-comment-time">${formatDateTime(comment.createdAt)}</span>
              </div>
              <p class="disc-comment-text">${comment.content.replace(/\n/g, "<br>")}</p>
            </div>
          </article>
        `;
      }
    )
    .join("");
};

const showTopicDetail = (topic) => {
  currentTopicId = topic.id;
  discussionEmpty?.classList.add("hidden");

  const detail = discussionDetail;
  if (detail) {
    detail.classList.remove("hidden");
    // Trigger slide-in animation each time topic changes
    detail.classList.remove("disc-panel-enter");
    void detail.offsetWidth; // reflow
    detail.classList.add("disc-panel-enter");
  }

  if (discussionMeta) discussionMeta.textContent = `${formatDate(topic.publishedAt)} · ${topic.comments.length} 条留言`;
  if (discussionTitle) discussionTitle.textContent = topic.title;
  if (discussionDescription) discussionDescription.textContent = topic.description;
  renderComments(topic.comments || [], true);

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

  renderSkeleton();

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
setupHamburger();
setupNavHighlight();
setupBackToTop();
setupSecretAdmin();
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

// ── 讨论区：匿名/实名切换 ─────────────────────────────────
const discModeRadios = document.querySelectorAll("input[name='discussion-mode']");
const discAuthorInput = document.querySelector("#comment-author");

const syncDiscMode = () => {
  const isAnon = document.querySelector("input[name='discussion-mode']:checked")?.value === "anon";
  if (discAuthorInput) {
    discAuthorInput.classList.toggle("hidden", isAnon);
    if (isAnon) discAuthorInput.value = "";
  }
};
discModeRadios.forEach((r) => r.addEventListener("change", syncDiscMode));
syncDiscMode();

// ── 讨论区：字符计数 ──────────────────────────────────────
const discContentInput = document.querySelector("#comment-content");
const discCharCount = document.querySelector("#disc-char-count");
if (discContentInput && discCharCount) {
  discContentInput.addEventListener("input", () => {
    const len = discContentInput.value.length;
    discCharCount.textContent = `${len} / 500`;
    discCharCount.classList.toggle("disc-char-over", len >= 480);
  });
}

commentForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentTopicId) {
    showToast("请先选择一个讨论话题", "error");
    return;
  }

  const isAnon = document.querySelector("input[name='discussion-mode']:checked")?.value === "anon";
  const content = (discContentInput?.value || "").trim();
  const authorName = (discAuthorInput?.value || "").trim();

  if (!content) return;
  if (!isAnon && !authorName) {
    discAuthorInput?.focus();
    return;
  }

  const submitBtn = commentForm.querySelector(".disc-submit-btn");
  if (submitBtn) { submitBtn.disabled = true; submitBtn.classList.add("is-loading"); }

  const discMessage = document.querySelector("#comment-message");
  if (discMessage) { discMessage.textContent = ""; discMessage.className = "disc-message"; }

  const payload = { authorName, isAnonymous: isAnon, content };

  try {
    const response = await fetch(`/api/topics/${currentTopicId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    let result = {};
    try { result = await response.json(); } catch { /* non-JSON */ }
    if (!response.ok) throw new Error(result.message || "留言失败");

    showToast("留言成功，已发布到讨论区 ✓", "success");
    commentForm.reset();
    if (discCharCount) discCharCount.textContent = "0 / 500";
    const anonRadio = document.querySelector("input[name='discussion-mode'][value='anon']");
    if (anonRadio) { anonRadio.checked = true; syncDiscMode(); }
    await loadTopics();
  } catch (error) {
    if (discMessage) {
      discMessage.textContent = error.message || "留言失败，请稍后重试";
      discMessage.classList.add("disc-message-error");
    }
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.classList.remove("is-loading"); }
  }
});

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const emailInput = form.querySelector("input[type='email']");
  const email = emailInput.value.trim();

  if (!email) {
    showToast("请先输入你的邮箱地址", "error");
    return;
  }

  showToast(`订阅成功，已加入更新列表 ✓`, "success");
  form.reset();
});

musicToggle?.addEventListener("click", async () => {
  if (!introAudio || !introMusicReady) return;

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
