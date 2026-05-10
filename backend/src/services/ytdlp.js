const { execFile, spawn } = require("child_process");
const { promisify } = require("util");
const path = require("path");
const os = require("os");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const { ytdlpPath, ffmpegPath, uploadTmpDir } = require("../config");

const execFileAsync = promisify(execFile);

// Set ffmpeg path for fluent-ffmpeg
// Priority: .env path > ffmpeg-static > system ffmpeg
const finalFfmpegPath = ffmpegPath || ffmpegStatic || "ffmpeg";
ffmpeg.setFfmpegPath(finalFfmpegPath);

/**
 * Detects if yt-dlp is available and working.
 */
async function hasYtdlp() {
  try {
    const { stdout } = await execFileAsync(ytdlpPath, ["--version"], { timeout: 5000 });
    const version = stdout.trim();
    console.log(`[DEBUG] yt-dlp version: ${version}`);
    return true;
  } catch (error) {
    console.error(`[ERROR] yt-dlp not found at ${ytdlpPath}: ${error.message}`);
    return false;
  }
}

/**
 * Automatically updates yt-dlp to the latest version.
 */
async function updateYtdlp() {
  console.log("[SYSTEM] Checking for yt-dlp updates...");
  try {
    // If installed via pip3, use pip3 update
    if (ytdlpPath.includes("python") || ytdlpPath.includes("bin/yt-dlp")) {
      await execFileAsync("pip3", ["install", "-U", "yt-dlp"], { timeout: 60000 });
    } else {
      // Otherwise try internal update
      await execFileAsync(ytdlpPath, ["-U"], { timeout: 60000 });
    }
    const { stdout } = await execFileAsync(ytdlpPath, ["--version"]);
    console.log(`[SYSTEM] yt-dlp updated successfully to version: ${stdout.trim()}`);
    return { success: true, version: stdout.trim() };
  } catch (error) {
    console.error("[SYSTEM] yt-dlp update failed:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Detects if ffmpeg is available and working.
 */
async function hasFfmpeg() {
  try {
    const { stdout } = await execFileAsync(finalFfmpegPath, ["-version"], { timeout: 5000 });
    console.log(`[DEBUG] ffmpeg found: ${stdout.split("\n")[0]}`);
    return true;
  } catch (error) {
    console.error(`[ERROR] ffmpeg not found: ${error.message}`);
    return false;
  }
}

/**
 * Fetches metadata for a YouTube URL.
 */
async function getMetadata(url, retryCount = 0) {
  console.log(`[DEBUG] Fetching metadata for: ${url} (Attempt ${retryCount + 1})`);
  
  const commonArgs = [
    "--no-cache-dir",
    "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "--referer", "https://www.google.com/"
  ];

  // Add cookies if available
  const cookiePath = path.join(process.cwd(), "cookies.txt");
  if (await fs.pathExists(cookiePath)) {
    commonArgs.push("--cookies", cookiePath);
  }

  try {
    const { stdout } = await execFileAsync(
      ytdlpPath, 
      [...commonArgs, "--dump-json", "--skip-download", url], 
      {
        timeout: 20000,
        maxBuffer: 1024 * 1024 * 4,
        env: { ...process.env, HOME: uploadTmpDir }
      }
    );
    
    const data = JSON.parse(stdout);
    return {
      title: data.title || "YouTube Song",
      duration: data.duration_string || secondsToDuration(data.duration),
      thumbnail: data.thumbnail || null,
      source: "yt-dlp"
    };
  } catch (error) {
    if (retryCount < 2) {
      console.warn(`[WARN] Metadata fetch failed, retrying... (${retryCount + 1})`);
      return getMetadata(url, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Downloads audio and converts to MP3 using yt-dlp's internal post-processor
 * or a fallback with fluent-ffmpeg.
 */
async function downloadAudio(url, outputPath, onProgress, retryCount = 0) {
  const outputBase = outputPath.replace(/\.mp3$/, "");
  const cookiePath = path.join(process.cwd(), "cookies.txt");
  
  console.log(`[DEBUG] Starting download: ${url} (Attempt ${retryCount + 1})`);
  
  const args = [
    "--no-cache-dir",
    "--ffmpeg-location", finalFfmpegPath,
    "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "--referer", "https://www.google.com/",
    "-x",
    "--audio-format", "mp3",
    "--audio-quality", "0",
    "--no-playlist",
    "-o", `${outputBase}.%(ext)s`,
    "--newline",
    url
  ];

  if (await fs.pathExists(cookiePath)) {
    args.push("--cookies", cookiePath);
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(ytdlpPath, args, {
      env: { ...process.env, HOME: uploadTmpDir }
    });

    let lastError = "";

    proc.stdout.on("data", (data) => {
      const line = data.toString();
      if (onProgress && line.includes("[download]") && line.includes("%")) {
        const match = line.match(/(\d+\.\d+)%/);
        if (match) onProgress(parseFloat(match[1]));
      }
    });

    proc.stderr.on("data", (data) => {
      lastError += data.toString();
    });

    proc.on("close", async (code) => {
      if (code === 0) {
        resolve(`${outputBase}.mp3`);
      } else {
        if (retryCount < 1) {
          console.warn(`[WARN] Download failed, retrying... (${retryCount + 1})`);
          try {
            const result = await downloadAudio(url, outputPath, onProgress, retryCount + 1);
            resolve(result);
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error(`yt-dlp failed with code ${code}: ${lastError}`));
        }
      }
    });
  });
}

async function generateProxy(inputPath, outputPath) {
  console.log(`[FFMPEG] Generating proxy for: ${path.basename(inputPath)}`);
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioBitrate(64)
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}

function secondsToDuration(seconds) {
  if (!Number.isFinite(seconds)) return "";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

module.exports = { 
  hasYtdlp, 
  updateYtdlp,
  hasFfmpeg, 
  getMetadata, 
  downloadAudio, 
  generateProxy,
  secondsToDuration,
  ffmpegPath: finalFfmpegPath
};
