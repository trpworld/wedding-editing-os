const fs = require("fs-extra");
const path = require("path");
const { projectsDir, retentionDays } = require("../config");

async function cleanupOldProjects() {
  await fs.ensureDir(projectsDir);
  const entries = await fs.readdir(projectsDir);
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(projectsDir, entry);
      const stats = await fs.stat(target);
      if (stats.isDirectory() && stats.mtimeMs < cutoff) {
        await fs.remove(target);
      }
    })
  );
}

module.exports = { cleanupOldProjects };
