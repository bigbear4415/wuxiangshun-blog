const crypto = require("crypto");

const COOKIE_NAME = "blog_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;

const parseCookies = (cookieHeader = "") => {
  return cookieHeader
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((accumulator, item) => {
      const [key, ...rest] = item.split("=");
      accumulator[key] = decodeURIComponent(rest.join("="));
      return accumulator;
    }, {});
};

const toBase64Url = (value) => Buffer.from(value).toString("base64url");
const fromBase64Url = (value) => Buffer.from(value, "base64url").toString("utf8");

const signValue = (value, secret) => {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
};

const createSessionToken = (secret) => {
  const payload = {
    issuedAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
    nonce: crypto.randomUUID()
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signValue(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
};

const readSessionToken = (request, secret) => {
  try {
    const cookies = parseCookies(request.headers.cookie || "");
    const token = cookies[COOKIE_NAME];

    if (!token || !token.includes(".")) {
      return null;
    }

    const [encodedPayload, signature] = token.split(".");
    if (signValue(encodedPayload, secret) !== signature) {
      return null;
    }

    const payload = JSON.parse(fromBase64Url(encodedPayload));
    if (!payload.expiresAt || payload.expiresAt < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};

const buildCookie = (request, token) => {
  const parts = [`${COOKIE_NAME}=${encodeURIComponent(token)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${SESSION_TTL_MS / 1000}`];

  const isSecure = process.env.NODE_ENV === "production" || request.headers["x-forwarded-proto"] === "https";
  if (isSecure) {
    parts.push("Secure");
  }

  return parts.join("; ");
};

const clearCookie = (request) => {
  const parts = [`${COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  const isSecure = process.env.NODE_ENV === "production" || request.headers["x-forwarded-proto"] === "https";
  if (isSecure) {
    parts.push("Secure");
  }

  return parts.join("; ");
};

module.exports = {
  COOKIE_NAME,
  SESSION_TTL_MS,
  createSessionToken,
  readSessionToken,
  buildCookie,
  clearCookie
};
