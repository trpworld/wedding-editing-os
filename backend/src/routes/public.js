const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs-extra");
const { nanoid } = require("nanoid");
const { ProjectRepository, SongRepository } = require("../db/repositories");
const { rituals } = require("../rituals");
const { projectsDir } = require("../config");
const { folderName, cleanFileBase } = require("../utils/files");
const { isSupportedSongUrl } = require("../utils/youtube");
const queue = require("../services/queue");

router.post("/submissions", async (req, res, next) => {
  try {
    const { payload } = req.body;
    if (!payload || !payload.clientName) {
      return res.status(400).json({ error: "Missing client name or project data." });
    }

    const clientName = cleanFileBase(payload.clientName);
    const weddingDate = payload.weddingDate ? cleanFileBase(payload.weddingDate) : new Date().toISOString().slice(0, 10);
    const submittedRituals = Array.isArray(payload.rituals) ? payload.rituals : [];
    
    // 1. Create Unique IDs
    const projectId = `${Date.now()}_${nanoid(8)}`;

    // 2. Save Project to Database Instantly
    ProjectRepository.create({
      id: projectId,
      clientName,
      weddingDate: payload.weddingDate || null,
      status: "idle"
    });

    // 3. Save all songs to Database Instantly
    for (const ritual of submittedRituals) {
      const ritualName = rituals.includes(ritual.name) ? ritual.name : cleanFileBase(ritual.name, "Custom Ritual");
      const songs = Array.isArray(ritual.songs) ? ritual.songs : [];
      
      for (const [index, song] of songs.entries()) {
        if (!song.url || !isSupportedSongUrl(song.url)) continue;
        
        SongRepository.create({
          id: nanoid(),
          projectId,
          ritualName,
          title: song.title || "Pending Title",
          url: song.url.trim(),
          status: "pending",
          timelineOrder: index
        });
      }
    }

    // 4. Trigger background processing (fire and forget — do NOT await)
    queue.startDownloadJob({ projectId }, projectsDir).catch(console.error);

    // 5. Send success back to client immediately!
    res.json({ 
      success: true, 
      projectId, 
      message: "Submission successful! Your editor will receive the songs shortly." 
    });

  } catch (err) {
    next(err);
  }
});

router.post("/metadata", async (req, res) => {
  // Metadata check stays the same for individual links
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });
    const { getMetadata } = require("../services/ytdlp");
    const metadata = await getMetadata(url);
    res.json(metadata);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
