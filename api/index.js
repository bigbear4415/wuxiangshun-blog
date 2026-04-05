const { createApp } = require("../lib/createApp");

let app;
let bootstrapError = null;

try {
  app = createApp();
} catch (error) {
  bootstrapError = error;
  console.error("API bootstrap failed", {
    message: error?.message,
    code: error?.code,
    path: error?.path,
    stack: error?.stack,
    cwd: process.cwd(),
    dirname: __dirname
  });
}

module.exports = bootstrapError
  ? (_request, response) => {
      response.status(500).json({
        message: "API bootstrap failed",
        error: {
          message: bootstrapError?.message || "Unknown error",
          code: bootstrapError?.code || "",
          path: bootstrapError?.path || ""
        }
      });
    }
  : app;
