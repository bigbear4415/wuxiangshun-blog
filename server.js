const { createApp } = require("./lib/createApp");

const app = createApp();
const port = process.env.PORT || 3000;

app.locals.store.ensureLocalFiles().then(() => {
  app.listen(port, () => {
    console.log(`Blog server is running at http://localhost:${port}`);
  });
}).catch((error) => {
  console.error("Failed to initialize blog server.", error);
  process.exit(1);
});
