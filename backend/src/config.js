require("dotenv").config();
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const storageDir = process.env.STORAGE_PATH || path.join(rootDir, "storage");
const uploadTmpDir = path.join(storageDir, "tmp");
const projectsDir = path.join(storageDir, "projects");

module.exports = {
  port: Number(process.env.PORT || 4000),
  host: process.env.HOST || "0.0.0.0",
  databaseUrl: process.env.DATABASE_URL || `file:${path.join(storageDir, "wedding.db")}`,
  adminKey: process.env.ADMIN_KEY || "change-this-admin-key",
  retentionDays: Number(process.env.PROJECT_RETENTION_DAYS || 14),
  maxFileMb: Number(process.env.MAX_FILE_MB || 50),
  enableYtdlp: process.env.ENABLE_YTDLP !== "false",
  ytdlpPath: process.env.YTDLP_PATH || path.join(rootDir, "bin", "yt-dlp"),
  ffmpegPath: process.env.FFMPEG_PATH || "ffmpeg",
  rootDir,
  storageDir,
  uploadTmpDir,
  projectsDir
};
