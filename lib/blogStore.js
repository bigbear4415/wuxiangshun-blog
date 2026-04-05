const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const supportedAudioExtensions = new Set([".mp3", ".wav", ".ogg", ".m4a", ".aac"]);

const normalizePost = (post) => ({
  id: post.id,
  title: post.title,
  category: post.category,
  excerpt: post.excerpt,
  content: post.content,
  imageUrl: post.imageUrl || post.image_url || "",
  videoUrl: post.videoUrl || post.video_url || "",
  publishedAt: post.publishedAt || post.published_at,
  updatedAt: post.updatedAt || post.updated_at || post.publishedAt || post.published_at
});

const normalizeComment = (comment) => ({
  id: comment.id,
  authorName: comment.authorName || comment.author_name || "匿名用户",
  isAnonymous: Boolean(comment.isAnonymous ?? comment.is_anonymous),
  content: comment.content,
  createdAt: comment.createdAt || comment.created_at
});

const normalizeTopic = (topic) => ({
  id: topic.id,
  title: topic.title,
  description: topic.description,
  publishedAt: topic.publishedAt || topic.published_at,
  updatedAt: topic.updatedAt || topic.updated_at || topic.publishedAt || topic.published_at,
  comments: Array.isArray(topic.comments) ? topic.comments.map(normalizeComment) : []
});

const sortPosts = (posts) => posts.map(normalizePost).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
const sortComments = (comments) => comments.map(normalizeComment).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
const sortTopics = (topics) => topics.map(normalizeTopic).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

const createStore = ({ rootDir, dataDir, uploadsDir, musicDir, configFilePath, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey, supabaseStorageBucket, adminPasswordFallback }) => {
  const postsFilePath = path.join(dataDir, "posts.json");
  const topicsFilePath = path.join(dataDir, "topics.json");
  const isSupabaseEnabled = Boolean(supabaseUrl && supabaseServiceRoleKey && supabaseAnonKey);
  const supabase = isSupabaseEnabled ? createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } }) : null;

  const ensureLocalFiles = async () => {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.mkdir(musicDir, { recursive: true });

    const defaults = [
      [postsFilePath, "[]"],
      [topicsFilePath, "[]"],
      [configFilePath, JSON.stringify({ adminPassword: adminPasswordFallback }, null, 2)]
    ];

    for (const [filePath, content] of defaults) {
      try {
        await fs.access(filePath);
      } catch {
        await fs.writeFile(filePath, content, "utf8");
      }
    }
  };

  const readJsonFile = async (filePath) => {
    await ensureLocalFiles();
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content.replace(/^\uFEFF/, ""));
  };

  const writeJsonFile = async (filePath, data) => {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
  };

  const getAdminPassword = async () => {
    if (process.env.ADMIN_PASSWORD) {
      return process.env.ADMIN_PASSWORD;
    }

    try {
      const config = await readJsonFile(configFilePath);
      return config.adminPassword || adminPasswordFallback;
    } catch {
      return adminPasswordFallback;
    }
  };

  const removeFileIfExists = async (relativePath) => {
    if (!relativePath) {
      return;
    }

    const normalized = relativePath.replace(/^\/+/, "");
    const absolutePath = path.join(rootDir, normalized);

    try {
      await fs.unlink(absolutePath);
    } catch {
      // Ignore missing files.
    }
  };

  const createPublicMediaUrl = (storagePath) => {
    if (!supabase) {
      return "";
    }

    const { data } = supabase.storage.from(supabaseStorageBucket).getPublicUrl(storagePath);
    return data.publicUrl;
  };

  const extractStorageObjectPath = (mediaUrl) => {
    if (!mediaUrl || !isSupabaseEnabled) {
      return null;
    }

    try {
      const parsedUrl = new URL(mediaUrl);
      const marker = `/storage/v1/object/public/${supabaseStorageBucket}/`;
      const index = parsedUrl.pathname.indexOf(marker);
      if (index === -1) {
        return null;
      }

      return decodeURIComponent(parsedUrl.pathname.slice(index + marker.length));
    } catch {
      return null;
    }
  };

  const cleanupMediaUrl = async (mediaUrl) => {
    if (!mediaUrl) {
      return;
    }

    if (mediaUrl.startsWith("/uploads/")) {
      await removeFileIfExists(mediaUrl);
      return;
    }

    const objectPath = extractStorageObjectPath(mediaUrl);
    if (objectPath && supabase) {
      await supabase.storage.from(supabaseStorageBucket).remove([objectPath]);
    }
  };

  const listPosts = async () => {
    if (!isSupabaseEnabled) {
      try {
        return sortPosts(await readJsonFile(postsFilePath));
      } catch {
        return [];
      }
    }

    const { data, error } = await supabase.from("posts").select("*").order("published_at", { ascending: false });
    if (error) {
      throw error;
    }

    return sortPosts(data || []);
  };

  const getPost = async (postId) => {
    if (!isSupabaseEnabled) {
      try {
        const post = (await readJsonFile(postsFilePath)).find((item) => item.id === postId);
        return post ? normalizePost(post) : null;
      } catch {
        return null;
      }
    }

    const { data, error } = await supabase.from("posts").select("*").eq("id", postId).maybeSingle();
    if (error) {
      throw error;
    }

    return data ? normalizePost(data) : null;
  };

  const createPost = async (payload) => {
    const now = new Date().toISOString();
    const post = {
      id: crypto.randomUUID(),
      title: payload.title.trim(),
      category: payload.category.trim(),
      excerpt: payload.excerpt.trim(),
      content: payload.content.trim(),
      imageUrl: payload.imageUrl || "",
      videoUrl: payload.videoUrl || "",
      publishedAt: now,
      updatedAt: now
    };

    if (!isSupabaseEnabled) {
      const posts = await readJsonFile(postsFilePath);
      posts.unshift(post);
      await writeJsonFile(postsFilePath, posts);
      return normalizePost(post);
    }

    const insertPayload = {
      id: post.id,
      title: post.title,
      category: post.category,
      excerpt: post.excerpt,
      content: post.content,
      image_url: post.imageUrl,
      video_url: post.videoUrl,
      published_at: post.publishedAt,
      updated_at: post.updatedAt
    };

    const { data, error } = await supabase.from("posts").insert(insertPayload).select("*").single();
    if (error) {
      throw error;
    }

    return normalizePost(data);
  };

  const updatePost = async (postId, payload) => {
    const existingPost = await getPost(postId);
    if (!existingPost) {
      return null;
    }

    const nextPost = {
      ...existingPost,
      title: payload.title.trim(),
      category: payload.category.trim(),
      excerpt: payload.excerpt.trim(),
      content: payload.content.trim(),
      imageUrl: payload.imageUrl ?? existingPost.imageUrl ?? "",
      videoUrl: payload.videoUrl ?? existingPost.videoUrl ?? "",
      updatedAt: new Date().toISOString()
    };

    if (existingPost.imageUrl && existingPost.imageUrl !== nextPost.imageUrl) {
      await cleanupMediaUrl(existingPost.imageUrl);
    }
    if (existingPost.videoUrl && existingPost.videoUrl !== nextPost.videoUrl) {
      await cleanupMediaUrl(existingPost.videoUrl);
    }

    if (!isSupabaseEnabled) {
      const posts = await readJsonFile(postsFilePath);
      const index = posts.findIndex((item) => item.id === postId);
      posts[index] = nextPost;
      await writeJsonFile(postsFilePath, posts);
      return normalizePost(nextPost);
    }

    const updatePayload = {
      title: nextPost.title,
      category: nextPost.category,
      excerpt: nextPost.excerpt,
      content: nextPost.content,
      image_url: nextPost.imageUrl,
      video_url: nextPost.videoUrl,
      updated_at: nextPost.updatedAt
    };

    const { data, error } = await supabase.from("posts").update(updatePayload).eq("id", postId).select("*").single();
    if (error) {
      throw error;
    }

    return normalizePost(data);
  };

  const deletePost = async (postId) => {
    const existingPost = await getPost(postId);
    if (!existingPost) {
      return null;
    }

    await cleanupMediaUrl(existingPost.imageUrl);
    await cleanupMediaUrl(existingPost.videoUrl);

    if (!isSupabaseEnabled) {
      const posts = await readJsonFile(postsFilePath);
      const filteredPosts = posts.filter((item) => item.id !== postId);
      await writeJsonFile(postsFilePath, filteredPosts);
      return normalizePost(existingPost);
    }

    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) {
      throw error;
    }

    return normalizePost(existingPost);
  };

  const listTopics = async () => {
    if (!isSupabaseEnabled) {
      try {
        return sortTopics(await readJsonFile(topicsFilePath));
      } catch {
        return [];
      }
    }

    const [{ data: topics, error: topicsError }, { data: comments, error: commentsError }] = await Promise.all([
      supabase.from("topics").select("*").order("published_at", { ascending: false }),
      supabase.from("comments").select("*").order("created_at", { ascending: true })
    ]);

    if (topicsError) {
      throw topicsError;
    }
    if (commentsError) {
      throw commentsError;
    }

    const commentMap = new Map();
    for (const comment of comments || []) {
      const topicId = comment.topic_id;
      const list = commentMap.get(topicId) || [];
      list.push(normalizeComment(comment));
      commentMap.set(topicId, list);
    }

    return sortTopics((topics || []).map((topic) => ({
      ...topic,
      comments: sortComments(commentMap.get(topic.id) || [])
    })));
  };

  const getTopic = async (topicId) => {
    if (!isSupabaseEnabled) {
      try {
        const topic = (await readJsonFile(topicsFilePath)).find((item) => item.id === topicId);
        return topic ? normalizeTopic(topic) : null;
      } catch {
        return null;
      }
    }

    const [{ data: topic, error: topicError }, { data: comments, error: commentsError }] = await Promise.all([
      supabase.from("topics").select("*").eq("id", topicId).maybeSingle(),
      supabase.from("comments").select("*").eq("topic_id", topicId).order("created_at", { ascending: true })
    ]);

    if (topicError) {
      throw topicError;
    }
    if (commentsError) {
      throw commentsError;
    }

    if (!topic) {
      return null;
    }

    return normalizeTopic({
      ...topic,
      comments: sortComments(comments || [])
    });
  };

  const createTopic = async (payload) => {
    const now = new Date().toISOString();
    const topic = {
      id: crypto.randomUUID(),
      title: payload.title.trim(),
      description: payload.description.trim(),
      comments: [],
      publishedAt: now,
      updatedAt: now
    };

    if (!isSupabaseEnabled) {
      const topics = await readJsonFile(topicsFilePath);
      topics.unshift(topic);
      await writeJsonFile(topicsFilePath, topics);
      return normalizeTopic(topic);
    }

    const insertPayload = {
      id: topic.id,
      title: topic.title,
      description: topic.description,
      published_at: topic.publishedAt,
      updated_at: topic.updatedAt
    };

    const { data, error } = await supabase.from("topics").insert(insertPayload).select("*").single();
    if (error) {
      throw error;
    }

    return normalizeTopic({ ...data, comments: [] });
  };

  const updateTopic = async (topicId, payload) => {
    const existingTopic = await getTopic(topicId);
    if (!existingTopic) {
      return null;
    }

    const nextTopic = {
      ...existingTopic,
      title: payload.title.trim(),
      description: payload.description.trim(),
      updatedAt: new Date().toISOString()
    };

    if (!isSupabaseEnabled) {
      const topics = await readJsonFile(topicsFilePath);
      const index = topics.findIndex((item) => item.id === topicId);
      topics[index] = nextTopic;
      await writeJsonFile(topicsFilePath, topics);
      return normalizeTopic(nextTopic);
    }

    const { data, error } = await supabase.from("topics").update({
      title: nextTopic.title,
      description: nextTopic.description,
      updated_at: nextTopic.updatedAt
    }).eq("id", topicId).select("*").single();

    if (error) {
      throw error;
    }

    return normalizeTopic({ ...data, comments: existingTopic.comments || [] });
  };

  const deleteTopic = async (topicId) => {
    const existingTopic = await getTopic(topicId);
    if (!existingTopic) {
      return null;
    }

    if (!isSupabaseEnabled) {
      const topics = await readJsonFile(topicsFilePath);
      const filteredTopics = topics.filter((item) => item.id !== topicId);
      await writeJsonFile(topicsFilePath, filteredTopics);
      return normalizeTopic(existingTopic);
    }

    await supabase.from("comments").delete().eq("topic_id", topicId);
    const { error } = await supabase.from("topics").delete().eq("id", topicId);
    if (error) {
      throw error;
    }

    return normalizeTopic(existingTopic);
  };

  const addComment = async (topicId, payload) => {
    const topic = await getTopic(topicId);
    if (!topic) {
      return null;
    }

    const comment = {
      id: crypto.randomUUID(),
      topicId,
      authorName: payload.isAnonymous ? "匿名用户" : payload.authorName.trim(),
      isAnonymous: Boolean(payload.isAnonymous),
      content: payload.content.trim(),
      createdAt: new Date().toISOString()
    };

    if (!isSupabaseEnabled) {
      const topics = await readJsonFile(topicsFilePath);
      const index = topics.findIndex((item) => item.id === topicId);
      const comments = Array.isArray(topics[index].comments) ? topics[index].comments : [];
      topics[index].comments = [...comments, comment];
      topics[index].updatedAt = comment.createdAt;
      await writeJsonFile(topicsFilePath, topics);
      return normalizeComment(comment);
    }

    const insertPayload = {
      id: comment.id,
      topic_id: topicId,
      author_name: comment.authorName,
      is_anonymous: comment.isAnonymous,
      content: comment.content,
      created_at: comment.createdAt
    };

    const { data, error } = await supabase.from("comments").insert(insertPayload).select("*").single();
    if (error) {
      throw error;
    }

    await supabase.from("topics").update({ updated_at: comment.createdAt }).eq("id", topicId);
    return normalizeComment(data);
  };

  const createSignedUpload = async ({ filename, contentType, folder }) => {
    if (!isSupabaseEnabled || !supabase) {
      throw new Error("当前还没有启用 Supabase 存储。");
    }

    const safeFolder = folder === "videos" ? "videos" : "images";
    const extension = path.extname(filename || "") || (contentType?.startsWith("video/") ? ".mp4" : ".jpg");
    const objectPath = `${safeFolder}/${Date.now()}-${crypto.randomUUID()}${extension.toLowerCase()}`;
    const { data, error } = await supabase.storage.from(supabaseStorageBucket).createSignedUploadUrl(objectPath);

    if (error) {
      throw error;
    }

    return {
      bucket: supabaseStorageBucket,
      path: objectPath,
      token: data.token,
      signedUrl: data.signedUrl,
      publicUrl: createPublicMediaUrl(objectPath)
    };
  };

  const readPlayableMusicFiles = async () => {
    try {
      await fs.mkdir(musicDir, { recursive: true });
      const entries = await fs.readdir(musicDir, { withFileTypes: true });

      return entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((name) => supportedAudioExtensions.has(path.extname(name).toLowerCase()))
        .map((name) => ({ name, url: `/music/${encodeURIComponent(name)}` }));
    } catch {
      return [];
    }
  };

  return {
    isSupabaseEnabled,
    supabaseUrl,
    supabaseAnonKey,
    supabaseStorageBucket,
    ensureLocalFiles,
    getAdminPassword,
    listPosts,
    getPost,
    createPost,
    updatePost,
    deletePost,
    listTopics,
    getTopic,
    createTopic,
    updateTopic,
    deleteTopic,
    addComment,
    readPlayableMusicFiles,
    createSignedUpload
  };
};

module.exports = {
  createStore
};
