const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const multer = require("multer");
const { nanoid } = require("nanoid");
const { projectsDir, uploadTmpDir, maxFileMb, enableYtdlp } = require("../config");
const { rituals } = require("../rituals");
const { parseYoutubeId, thumbnailFor, isSpotify, isSupportedSongUrl } = require("../utils/youtube");
const { folderName, cleanFileBase, uniquePath } = require("../utils/files");
const { hasYtdlp, getMetadata } = require("../services/ytdlp");
const { createZip } = require("../services/zip");
const { ProjectRepository, SongRepository } = require("../db/repositories");

const router = express.Router();
const upload = multer({
  dest: uploadTmpDir,
  limits: { fileSize: maxFileMb * 1024 * 1024 }
});

router.get("/rituals", (req, res) => {
  res.json({ rituals });
});

router.post("/metadata", async (req, res) => {
  const { url } = req.body || {};
  if (!url || !isSupportedSongUrl(url)) {
    return res.status(400).json({ error: "Please paste a valid YouTube or Spotify link." });
  }

  const youtubeId = parseYoutubeId(url);
  if (youtubeId && enableYtdlp && (await hasYtdlp())) {
    try {
      const metadata = await getMetadata(url);
      return res.json({ provider: "youtube", id: youtubeId, ...metadata, thumbnail: metadata.thumbnail || thumbnailFor(youtubeId) });
    } catch {
      return res.json({
        provider: "youtube",
        id: youtubeId,
        title: "YouTube Song",
        duration: "",
        thumbnail: thumbnailFor(youtubeId),
        source: "fallback"
      });
    }
  }

  if (youtubeId) {
    const oembed = await fetchYoutubeOembed(url).catch(() => null);
    return res.json({
      provider: "youtube",
      id: youtubeId,
      title: oembed?.title || "YouTube Song",
      duration: "",
      thumbnail: oembed?.thumbnail_url || thumbnailFor(youtubeId),
      source: "fallback"
    });
  }

  if (isSpotify(url)) {
    return res.json({
      provider: "spotify",
      id: url,
      title: "Spotify Track",
      duration: "",
      thumbnail: "",
      source: "spotify-link"
    });
  }
});

async function fetchYoutubeOembed(url) {
  const endpoint = new URL("https://www.youtube.com/oembed");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("url", url);
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) return null;
  return response.json();
}

router.post("/submissions", upload.any(), async (req, res, next) => {
  try {
    const payload = JSON.parse(req.body.payload || "{}");
    const clientName = cleanFileBase(payload.clientName || "Wedding Client", "Wedding Client");
    const weddingDate = payload.weddingDate ? cleanFileBase(payload.weddingDate) : new Date().toISOString().slice(0, 10);
    const submittedRituals = Array.isArray(payload.rituals) ? payload.rituals : [];
    
    const projectId = `${Date.now()}_${nanoid(8)}`;
    const year = weddingDate ? weddingDate.split("-")[0] : new Date().getFullYear();
    const projectTitle = `${clientName}_${projectId}`;
    const projectDir = path.join(projectsDir, "WEDDINGS", String(year), projectTitle);
    const projectRoot = path.dirname(projectDir);

    await fs.ensureDir(projectDir);

    // Save to Database
    ProjectRepository.create({
      id: projectId,
      clientName,
      weddingDate: payload.weddingDate || null,
      status: "idle"
    });

    for (const ritual of submittedRituals) {
      const ritualName = rituals.includes(ritual.name) ? ritual.name : cleanFileBase(ritual.name, "Custom Ritual");
      const ritualDir = path.join(projectDir, folderName(ritualName));
      await fs.ensureDir(ritualDir);

      const songs = Array.isArray(ritual.songs) ? ritual.songs : [];
      for (const song of songs) {
        if (!song.url || !isSupportedSongUrl(song.url)) continue;
        
        SongRepository.create({
          id: nanoid(),
          projectId,
          ritualName,
          title: song.title,
          url: song.url.trim(),
          thumbnail: song.thumbnail,
          duration: song.duration,
          status: "pending"
        });
      }
    }

    // Handle file uploads (local MP3s)
    for (const file of req.files || []) {
      const [ritualNameRaw] = String(file.fieldname).replace("mp3:", "").split("::");
      const ritualName = rituals.includes(ritualNameRaw) ? ritualNameRaw : "Local Uploads";
      const ritualDir = path.join(projectDir, folderName(ritualName));
      await fs.ensureDir(ritualDir);
      
      const ext = path.extname(file.originalname) || ".mp3";
      const safeBase = cleanFileBase(path.basename(file.originalname, ext), "uploaded-song");
      const target = await uniquePath(ritualDir, safeBase, ext);
      await fs.move(file.path, target);

      SongRepository.create({
        id: nanoid(),
        projectId,
        ritualName,
        title: file.originalname,
        url: "local-file",
        status: "completed",
        filePath: target
      });
    }

    // Initial ZIP with whatever is available (metadata + uploads)
    const zipPath = path.join(projectRoot, "submission.zip");
    await createZip(projectDir, zipPath);
    ProjectRepository.updateZipPath(projectId, zipPath);

    res.status(201).json({
      id: projectId,
      message: "Project created and queued for processing.",
      ytdlpAvailable: await hasYtdlp()
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
