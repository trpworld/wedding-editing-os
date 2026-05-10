const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const fs = require("fs-extra");
const http = require("http");
const { Server } = require("socket.io");
const rateLimit = require("express-rate-limit");
const { host, port, uploadTmpDir, projectsDir } = require("./config");
const publicRoutes = require("./routes/public");
const adminRoutes = require("./routes/admin");
const { cleanupOldProjects } = require("./services/cleanup");
const { updateYtdlp } = require("./services/ytdlp");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Security Layer
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

app.get("/health", (req, res) => res.json({ ok: true }));
app.use("/api", publicRoutes);
app.use("/api/admin", adminRoutes);

app.use(async (error, req, res, next) => {
  const logDir = path.join(process.cwd(), "logs");
  await fs.ensureDir(logDir);
  const logMessage = `[${new Date().toISOString()}] ${error.stack || error.message}\n`;
  await fs.appendFile(path.join(logDir, "errors.log"), logMessage);
  
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || "Something went wrong." });
});

io.on("connection", (socket) => {
  console.log(`[SOCKET] Admin connected: ${socket.id}`);
  socket.on("disconnect", () => console.log(`[SOCKET] Admin disconnected: ${socket.id}`));
});

async function start() {
  await fs.ensureDir(uploadTmpDir);
  await fs.ensureDir(projectsDir);

  // Update yt-dlp on startup
  updateYtdlp().catch(console.error);

  cleanupOldProjects().catch(console.error);
  setInterval(() => cleanupOldProjects().catch(console.error), 6 * 60 * 60 * 1000);
  
  // Update yt-dlp weekly
  setInterval(() => updateYtdlp().catch(console.error), 7 * 24 * 60 * 60 * 1000);

  server.listen(port, host, () => {
    console.log(`Wedding music API running on http://${host}:${port}`);
  });
}

start();

module.exports = { io };
