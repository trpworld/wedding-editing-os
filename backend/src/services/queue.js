const fs = require("fs-extra");
const path = require("path");
const { rituals: ritualNames } = require("../rituals");
const { downloadAudio, generateProxy, getMetadata } = require("./ytdlp");
const { createZip } = require("./zip");
const { folderName, cleanFileBase } = require("../utils/files");
const { parseYoutubeId } = require("../utils/youtube");
const { ProjectRepository, SongRepository } = require("../db/repositories");

let io;

/**
 * Starts a background download job for a project using DB persistence.
 */
async function startDownloadJob(summary, projectRoot) {
  const projectId = summary.projectId;
  const project = ProjectRepository.getById(projectId);

  if (!project) {
    console.error(`[QUEUE] Project ${projectId} not found.`);
    return { status: "not_found" };
  }

  if (project.status === "downloading") {
    return { status: "downloading" };
  }

  ProjectRepository.updateStatus(projectId, "downloading");
  
  // Execute in background
  runJob(projectId, project, projectRoot).catch(console.error);

  return { status: "downloading" };
}

async function runJob(projectId, projectData, projectRoot) {
  if (!io) io = require("../server").io;

  try {
    const songs = SongRepository.getByProjectId(projectId);
    const totalSongs = songs.length;
    let completedCount = 0;

    console.log(`[QUEUE] Starting professional editor job ${projectId}.`);

    // 1. Create Workspace Root
    const year = projectData.weddingDate ? projectData.weddingDate.split("-")[0] : new Date().getFullYear();
    const projectTitle = `${projectData.clientName}_${projectId}`;
    const projectDir = path.join(projectRoot, "WEDDINGS", String(year), projectTitle);
    
    const workspacePaths = {
      songs: path.join(projectDir, "01_Songs"),
      exports: path.join(projectDir, "02_Exports"),
      premiere: path.join(projectDir, "03_Premiere_Project"),
      logs: path.join(projectDir, "04_Logs")
    };

    for (const p of Object.values(workspacePaths)) await fs.ensureDir(p);
    
    const ritualSequence = {};
    let nextSeq = 1;

    for (const song of songs) {
      try {
        if (!ritualSequence[song.ritualName]) {
          ritualSequence[song.ritualName] = String(nextSeq++).padStart(2, "0");
        }
        
        const seq = ritualSequence[song.ritualName];
        const ritualDir = path.join(workspacePaths.songs, `${seq}_${folderName(song.ritualName)}`);
        const proxyDir = path.join(ritualDir, "proxies");
        await fs.ensureDir(ritualDir);
        await fs.ensureDir(proxyDir);

        // FETCH METADATA IF MISSING (THE KEY TO SPEED!)
        let currentTitle = song.title;
        if (!currentTitle || currentTitle === "Pending Title") {
          broadcastUpdate(projectId, { songId: song.id, status: "fetching_metadata" });
          const metadata = await getMetadata(song.url).catch(() => ({ title: "Unknown Song" }));
          currentTitle = metadata.title;
          // Update DB so we don't fetch it again
          // (Assuming SongRepository has an updateMetadata method or similar)
        }

        const base = cleanFileBase(`${String(completedCount + 1).padStart(2, "0")} ${currentTitle}`);
        const outputPath = path.join(ritualDir, `${base}.mp3`);
        const proxyPath = path.join(proxyDir, `${base}_proxy.mp3`);

        // Check Cache
        const cachedSong = SongRepository.findExistingByUrl(song.url);
        if (cachedSong && cachedSong.filePath && await fs.pathExists(cachedSong.filePath)) {
          console.log(`[CACHE] Reusing cached file for ${currentTitle}`);
          await fs.copy(cachedSong.filePath, outputPath);
          if (!await fs.pathExists(proxyPath)) await generateProxy(outputPath, proxyPath).catch(() => null);
          
          SongRepository.updateStatus(song.id, "completed", null, outputPath);
          completedCount += 1;
          broadcastUpdate(projectId, { songId: song.id, status: "completed", progress: (completedCount / totalSongs) * 100 });
          continue;
        }

        // Download
        broadcastUpdate(projectId, { songId: song.id, status: "downloading" });
        await downloadAudio(song.url, outputPath, (percent) => {
          broadcastUpdate(projectId, { songId: song.id, status: "downloading", percent });
        });
        
        // Proxy
        await generateProxy(outputPath, proxyPath).catch(err => console.error("[PROXY ERROR]", err));

        SongRepository.updateStatus(song.id, "completed", null, outputPath);
        completedCount += 1;
        broadcastUpdate(projectId, { songId: song.id, status: "completed", progress: (completedCount / totalSongs) * 100 });

      } catch (error) {
        console.error(`[QUEUE] Failed for song ${song.url}:`, error.message);
        SongRepository.updateStatus(song.id, "failed", error.message);
        broadcastUpdate(projectId, { songId: song.id, status: "failed", error: error.message });
      }
    }

    // Finalize
    ProjectRepository.updateStatus(projectId, "completed");
    broadcastUpdate(projectId, { status: "completed", zipReady: false });

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
