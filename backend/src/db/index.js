const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs-extra");
const { databaseUrl, storageDir } = require("../config");

// Better-sqlite3 expects a file path, so we strip "file:" if it exists
const dbPath = databaseUrl.replace(/^file:/, "");
fs.ensureDirSync(path.dirname(dbPath));

const db = new Database(dbPath);

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    clientName TEXT NOT NULL,
    weddingDate TEXT,
    status TEXT DEFAULT 'idle',
    zipPath TEXT,
    notes TEXT, -- Editor general notes
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS songs (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    ritualName TEXT NOT NULL,
    title TEXT,
    url TEXT NOT NULL,
    thumbnail TEXT,
    duration TEXT,
    status TEXT DEFAULT 'pending', 
    mood TEXT, -- cinematic, emotional, energetic, etc.
    notes TEXT, -- specific editing notes
    markers TEXT, -- JSON string of timing markers
    filePath TEXT,
    timelineOrder INTEGER,
    error TEXT,
    FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

module.exports = db;
