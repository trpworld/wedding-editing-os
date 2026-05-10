const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const { projectsDir } = require("../config");
const { ProjectRepository, SongRepository } = require("../db/repositories");
const { startDownloadJob, getJobStatus } = require("../services/queue");
const { hasYtdlp } = require("../services/ytdlp");
const { getSystemAnalytics } = require("../services/intelligence");
const db = require("../db");
const { folderName } = require("../utils/files");

const router = express.Router();

router.get("/analytics", (req, res) => {
  res.json(getSystemAnalytics(db));
});

router.get("/search", (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ projects: [], songs: [] });

  const projects = db.prepare(`
    SELECT * FROM projects 
    WHERE clientName LIKE ? OR weddingDate LIKE ? OR notes LIKE ?
  `).all(`%${q}%`, `%${q}%`, `%${q}%`);

  const songs = db.prepare(`
    SELECT s.*, p.clientName 
    FROM songs s 
    JOIN projects p ON s.projectId = p.id
    WHERE s.title LIKE ? OR s.ritualName LIKE ? OR s.mood LIKE ? OR s.notes LIKE ?
  `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);

  res.json({ projects, songs });
});

router.patch("/projects/:id/notes", (req, res) => {
  const { notes } = req.body;
  db.prepare("UPDATE projects SET notes = ? WHERE id = ?").run(notes, req.params.id);
  res.json({ ok: true });
});

router.patch("/songs/:id/metadata", (req, res) => {
  const { mood, notes, timelineOrder } = req.body;
  db.prepare(`
    UPDATE songs 
    SET mood = ?, notes = ?, timelineOrder = ?
    WHERE id = ?
  `).run(mood, notes, timelineOrder, req.params.id);
  res.json({ ok: true });
});

router.get("/projects", async (req, res, next) => {
  try {
    const projects = ProjectRepository.getAll();
    const enriched = await Promise.all(
      projects.map(async (project) => {
        const songs = SongRepository.getByProjectId(project.id);
        const zipExists = project.zipPath ? await fs.pathExists(project.zipPath) : false;
        
        // Find the actual project folder to list ritual names
        const projectBaseDir = path.join(projectsDir, project.id);
        const ritualFolders = await listRitualFolders(projectBaseDir);

        return {
          ...project,
          songs,
          zipExists,
          ritualFolders,
          downloadStatus: project.status,
          downloadLog: songs.map(s => ({ ritual: s.ritualName, title: s.title, status: s.status, error: s.error })),
          ytdlpAvailable: await hasYtdlp()
        };
      })
    );
    res.json({ projects: enriched });
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:id/download", async (req, res, next) => {
  try {
    const project = ProjectRepository.getById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found." });

    // 1. If ZIP is already done and no job is active, download it
    if (project.zipPath && await fs.pathExists(project.zipPath) && project.status !== "downloading") {
      return res.download(project.zipPath, `wedding-music-${project.clientName}.zip`);
    }

    // 2. Otherwise, trigger/track background job
    // We need the project directory for the queue
    const projectBaseDir = path.join(projectsDir, project.id);
    const contents = await fs.readdir(projectBaseDir);
    const innerFolder = contents.find(f => !f.endsWith(".zip") && !f.endsWith(".json"));
    const projectDir = path.join(projectBaseDir, innerFolder);

    const summary = {
      id: project.id,
      clientName: project.clientName,
      projectDir
    };

    const result = await startDownloadJob(summary, projectBaseDir);
    res.json({ 
      message: "Processing started in background.",
      status: result.status,
      job: getJobStatus(project.id)
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/projects/:id", async (req, res, next) => {
  try {
    const projectRoot = path.join(projectsDir, req.params.id);
    await fs.remove(projectRoot);
    ProjectRepository.delete(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

async function listRitualFolders(projectBaseDir) {
  if (!(await fs.pathExists(projectBaseDir))) return [];
  const contents = await fs.readdir(projectBaseDir);
  const innerFolder = contents.find(f => !f.endsWith(".zip") && !f.endsWith(".json"));
  if (!innerFolder) return [];
  
  const projectDir = path.join(projectBaseDir, innerFolder);
  const entries = await fs.readdir(projectDir);
  const folders = [];
  for (const entry of entries) {
    const stat = await fs.stat(path.join(projectDir, entry));
    if (stat.isDirectory()) folders.push(entry);
  }
  return folders;
}

module.exports = router;
