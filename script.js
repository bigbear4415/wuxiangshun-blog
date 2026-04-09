const form = document.querySelector(".newsletter-form");
const message = document.querySelector(".form-message");
const postsContainer = document.querySelector("#posts-container");
const postTemplate = document.querySelector("#post-template");
const featuredCard = document.querySelector("#featured-card");
const introScreen = document.querySelector("#intro-screen");
const introSkip = document.querySelector("#intro-skip");
const introAudio = document.querySelector("#intro-audio");
const musicToggle = document.querySelector("#music-toggle");
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

  featuredCard.innerHTML = `
    <p class="hero-card-label">最新发布</p>
    <h2>${post.title}</h2>
    <p>${post.excerpt}</p>
    <a href="/post.html?id=${post.id}">查看详情</a>
  `;
};

const createPostCard = (post) => {
  if (!postTemplate || !postsContainer) {
    return;
  }

  const fragment = postTemplate.content.cloneNode(true);
  const media = fragment.querySelector(".post-media");
  const meta = fragment.querySelector(".post-meta");
  const title = fragment.querySelector("h3");
  const excerpt = fragment.querySelector(".post-excerpt");
  const body = fragment.querySelector(".post-body");
  const link = fragment.querySelector(".post-link");

  const mediaMarkup = createMediaMarkup(post);
  if (mediaMarkup) {
    media.classList.remove("hidden");
    media.innerHTML = mediaMarkup;
    bindAdaptiveVideoFrames(media);
  }

  meta.textContent = `${formatDate(post.publishedAt)} - ${post.category}`;
  title.textContent = post.title;
  excerpt.textContent = post.excerpt;
  body.textContent = post.content.length > 88 ? `${post.content.slice(0, 88)}...` : post.content;
  link.href = `/post.html?id=${post.id}`;

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
