const fs = require("fs-extra");
const path = require("path");
const { rituals: ritualNames } = require("../rituals");
const { downloadAudio, generateProxy } = require("./ytdlp");
const { createZip } = require("./zip");
const { folderName, cleanFileBase } = require("../utils/files");
const { parseYoutubeId } = require("../utils/youtube");
const { ProjectRepository, SongRepository } = require("../db/repositories");

// We'll require io lazily to avoid circular dependencies
let io;

/**
 * Starts a background download job for a project using DB persistence.
 */
async function startDownloadJob(summary, projectRoot) {
  const projectId = summary.id;
  const project = ProjectRepository.getById(projectId);

  if (project.status === "downloading") {
    return { status: "downloading" };
  }

  ProjectRepository.updateStatus(projectId, "downloading");
  
  // Execute in background
  runJob(projectId, summary, projectRoot).catch(console.error);

  return { status: "downloading" };
}

async function runJob(projectId, summary, projectRoot) {
  if (!io) io = require("../server").io;

  try {
    const songs = SongRepository.getByProjectId(projectId);
    const totalSongs = songs.length;
    let completedCount = 0;

    console.log(`[QUEUE] Starting professional editor job ${projectId}.`);

    // Create Editor Workspace Structure
    const workspacePaths = {
      songs: path.join(summary.projectDir, "01_Songs"),
      exports: path.join(summary.projectDir, "02_Exports"),
      premiere: path.join(summary.projectDir, "03_Premiere_Project"),
      logs: path.join(summary.projectDir, "04_Logs")
    };

    for (const p of Object.values(workspacePaths)) await fs.ensureDir(p);
    
    // Sub-folders for exports
    await fs.ensureDir(path.join(workspacePaths.exports, "Reels"));
    await fs.ensureDir(path.join(workspacePaths.exports, "Teasers"));
    await fs.ensureDir(path.join(workspacePaths.exports, "Cinematic_Full"));

    const ritualSequence = {};
    let nextSeq = 1;

    for (const song of songs) {
      if (!ritualSequence[song.ritualName]) {
        ritualSequence[song.ritualName] = String(nextSeq++).padStart(2, "0");
      }
      
      const seq = ritualSequence[song.ritualName];
      const ritualDir = path.join(workspacePaths.songs, `${seq}_${folderName(song.ritualName)}`);
      const proxyDir = path.join(ritualDir, "proxies");
      await fs.ensureDir(ritualDir);
      await fs.ensureDir(proxyDir);

      const base = cleanFileBase(`${String(completedCount + 1).padStart(2, "0")} ${song.title || "Song"}`);
      const outputPath = path.join(ritualDir, `${base}.mp3`);
      const proxyPath = path.join(proxyDir, `${base}_proxy.mp3`);

      // 1. Smart Cache Check
      const cachedSong = SongRepository.findExistingByUrl(song.url);
      if (cachedSong && cachedSong.filePath && await fs.pathExists(cachedSong.filePath)) {
        console.log(`[CACHE] Reusing cached file for ${song.title}`);
        await fs.copy(cachedSong.filePath, outputPath);
        
        // Generate proxy for cached file too if missing
        if (!await fs.pathExists(proxyPath)) await generateProxy(outputPath, proxyPath).catch(() => null);
        
        SongRepository.updateStatus(song.id, "completed", null, outputPath);
        completedCount += 1;
        broadcastUpdate(projectId, { songId: song.id, status: "completed", progress: (completedCount / totalSongs) * 100 });
        continue;
      }

      // 2. Download
      try {
        broadcastUpdate(projectId, { songId: song.id, status: "downloading" });
        await downloadAudio(song.url, outputPath, (percent) => {});
        
        // Generate Proxy
        await generateProxy(outputPath, proxyPath).catch(err => console.error("[PROXY ERROR]", err));

        SongRepository.updateStatus(song.id, "completed", null, outputPath);
        completedCount += 1;
        broadcastUpdate(projectId, { songId: song.id, status: "completed", progress: (completedCount / totalSongs) * 100 });
      } catch (error) {
        console.error(`[QUEUE] Failed to download ${song.title}:`, error.message);
        SongRepository.updateStatus(song.id, "failed", error.message);
        broadcastUpdate(projectId, { songId: song.id, status: "failed", error: error.message });
      }
    }

    // Finalize ZIP
    ProjectRepository.updateStatus(projectId, "packaging");
    broadcastUpdate(projectId, { status: "packaging" });

    const zipPath = path.join(projectRoot, "submission.zip");
    await createZip(summary.projectDir, zipPath);
    
    // Optional: Google Drive Backup
    const googleDrive = require("./googleDrive");
    const driveLink = await googleDrive.uploadFile(zipPath, `wedding-music-${projectId}.zip`);
    if (driveLink) {
      console.log(`[QUEUE] Google Drive backup ready: ${driveLink}`);
      // You could add a googleDriveLink column to the projects table if needed
    }

    ProjectRepository.updateStatus(projectId, "completed");
    ProjectRepository.updateZipPath(projectId, zipPath);
    broadcastUpdate(projectId, { status: "completed", zipReady: true, driveLink });

  } catch (error) {
    console.error(`[QUEUE] Critical job failure for ${projectId}:`, error);
    ProjectRepository.updateStatus(projectId, "failed");
    broadcastUpdate(projectId, { status: "failed", error: error.message });
  }
}

function broadcastUpdate(projectId, data) {
  if (io) {
    io.emit(`project_update:${projectId}`, data);
    io.emit("admin_update", { projectId, ...data });
  }
}

function getJobStatus(projectId) {
  const project = ProjectRepository.getById(projectId);
  const songs = SongRepository.getByProjectId(projectId);
  return { project, songs };
}

module.exports = { startDownloadJob, getJobStatus };
