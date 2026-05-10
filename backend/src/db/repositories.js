const db = require("./index");

const ProjectRepository = {
  create(project) {
    const stmt = db.prepare(`
      INSERT INTO projects (id, clientName, weddingDate, status)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(project.id, project.clientName, project.weddingDate, project.status || "idle");
  },

  getById(id) {
    return db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  },

  getAll() {
    return db.prepare("SELECT * FROM projects ORDER BY createdAt DESC").all();
  },

  updateStatus(id, status) {
    db.prepare("UPDATE projects SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(status, id);
  },

  updateZipPath(id, zipPath) {
    db.prepare("UPDATE projects SET zipPath = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(zipPath, id);
  },

  delete(id) {
    db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  }
};

const SongRepository = {
  create(song) {
    const stmt = db.prepare(`
      INSERT INTO songs (id, projectId, ritualName, title, url, thumbnail, duration, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      song.id,
      song.projectId,
      song.ritualName,
      song.title || "",
      song.url,
      song.thumbnail || "",
      song.duration || "",
      song.status || "pending"
    );
  },

  getByProjectId(projectId) {
    return db.prepare("SELECT * FROM songs WHERE projectId = ?").all(projectId);
  },

  updateStatus(id, status, error = null, filePath = null) {
    db.prepare(`
      UPDATE songs 
      SET status = ?, error = ?, filePath = ?
      WHERE id = ?
    `).run(status, error, filePath, id);
  },

  findExistingByUrl(url) {
    return db.prepare("SELECT * FROM songs WHERE url = ? AND status = 'completed' LIMIT 1").get(url);
  }
};

module.exports = { ProjectRepository, SongRepository };
