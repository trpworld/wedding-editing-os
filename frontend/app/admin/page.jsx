"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { io } from "socket.io-client";
import { API_URL, deleteAdminProject, fetchAdminProjects } from "../../lib/api";

export default function AdminPage() {
  const [projects, setProjects] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProjects();

    const socket = io(API_URL);
    socket.on("admin_update", (update) => {
      setProjects((current) =>
        current.map((p) => {
          if (p.id === update.projectId) {
            // Update individual song status if provided
            const nextLog = update.songId 
              ? p.downloadLog.map(s => s.id === update.songId ? { ...s, status: update.status, error: update.error } : s)
              : p.downloadLog;
            
            return { 
              ...p, 
              downloadStatus: update.status || p.downloadStatus, 
              downloadProgress: update.progress || p.downloadProgress,
              downloadLog: nextLog,
              zipExists: update.zipReady || p.zipExists
            };
          }
          return p;
        })
      );
    });

    return () => socket.disconnect();
  }, []);

  async function loadProjects(event) {
    event?.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      setProjects(await fetchAdminProjects());
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function removeProject(id) {
    await deleteAdminProject(id);
    setProjects((current) => current.filter((project) => project.id !== id));
  }

  async function handleDownload(projectId) {
    try {
      const response = await fetch(`${API_URL}/api/admin/projects/${projectId}/download`);
      const contentType = response.headers.get("content-type");

      if (contentType && contentType.includes("application/json")) {
        const result = await response.json();
        setMessage(result.message);
        // Refresh project list to show updated status
        loadProjects();
      } else {
        // It's a file download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `wedding-music-${projectId}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (error) {
      setMessage(`Download failed: ${error.message}`);
    }
  }

  const [searchTerm, setSearchTerm] = useState("");

  const filteredProjects = projects.filter(p => 
    p.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.weddingDate?.includes(searchTerm)
  );

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-gold/80">Editor Desk</p>
            <h1 className="font-display text-4xl text-pearl sm:text-5xl">Admin Dashboard</h1>
          </div>
          <div className="relative w-full max-w-xs">
            <input 
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-12 w-full rounded-2xl border border-gold/20 bg-black/40 px-5 text-sm text-pearl outline-none transition focus:border-gold"
            />
          </div>
        </header>

        <form onSubmit={loadProjects} className="glass mb-8 flex items-center gap-4 rounded-2xl p-4">
          <button disabled={loading} className="min-h-12 rounded-xl bg-gold px-6 font-bold text-ink transition hover:bg-champagne active:scale-95 disabled:opacity-50">
            {loading ? "Refreshing..." : "Refresh List"}
          </button>
          <p className="text-xs font-medium text-champagne/40 uppercase tracking-widest">
            {filteredProjects.length} Projects found
          </p>
        </form>

        {message && (
          <motion.p 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="mb-4 rounded-xl border border-gold/25 bg-gold/10 p-4 text-sm text-gold shadow-glow"
          >
            {message}
          </motion.p>
        )}

        {!loading && projects.length === 0 && (
          <div className="glass rounded-2xl p-8 text-center text-champagne/80">
            No submissions yet. Once a client submits songs, the project ZIP will appear here.
          </div>
        )}

        <div className="grid gap-6">
          {filteredProjects.map((project) => (
            <motion.article
              key={project.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass overflow-hidden rounded-[2rem] border border-gold/10 bg-black/40 shadow-xl"
            >
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div className="space-y-2">
                    <h2 className="font-display text-3xl text-pearl">{project.clientName}</h2>
                    <p className="flex items-center gap-2 text-sm text-champagne/60">
                      <span className="h-2 w-2 rounded-full bg-gold" />
                      {project.weddingDate ? `Wedding: ${project.weddingDate}` : "Date not specified"} • Submitted: {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                    {project.downloadStatus === "downloading" && (
                      <div className="mt-3 h-1.5 w-64 overflow-hidden rounded-full bg-white/5 border border-white/5">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${project.downloadProgress || 0}%` }}
                          className="h-full bg-gold shadow-glow"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-3">
                    <button
                      onClick={() => handleDownload(project.id)}
                      className={`min-h-[3.25rem] rounded-2xl px-6 font-bold transition active:scale-95 ${
                        project.downloadStatus === "downloading"
                          ? "bg-gold/20 text-gold animate-pulse cursor-wait"
                          : "bg-gold text-ink hover:bg-champagne shadow-glow"
                      }`}
                    >
                      {project.downloadStatus === "downloading" ? "Downloading..." : project.zipExists ? "Download ZIP" : "Prepare Songs & ZIP"}
                    </button>
                    <button 
                      onClick={() => removeProject(project.id)} 
                      className="min-h-[3.25rem] rounded-2xl border border-red-400/20 px-6 font-bold text-red-300 transition hover:bg-red-400/10 active:scale-95"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap gap-2">
                  {project.ritualFolders?.map((folder) => (
                    <span key={folder} className="rounded-full bg-white/5 px-4 py-1.5 text-xs font-medium tracking-wide text-champagne/80 border border-white/5">
                      {folder}
                    </span>
                  ))}
                </div>

                <div className="mt-8 overflow-hidden rounded-2xl border border-white/5 bg-black/30">
                  <div className="bg-white/5 px-5 py-3 border-b border-white/5 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-gold/90">Process Log</p>
                    {project.downloadStatus === "downloading" && (
                      <span className="text-[10px] font-bold text-gold animate-pulse">LIVE TRACKING</span>
                    )}
                  </div>
                  <div className="max-h-56 space-y-2.5 overflow-auto p-5 text-sm font-medium">
                    {project.downloadLog?.length > 0 ? (
                      project.downloadLog.map((item, index) => (
                        <div key={`${item.url || item.title}-${index}`} className="flex items-center justify-between gap-4 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                          <span className="truncate text-champagne/90">{item.ritual}: {item.title || "File"}</span>
                          <span className={`shrink-0 text-[10px] font-bold uppercase tracking-tighter ${
                            item.status === "completed" ? "text-green-400" : 
                            item.status === "failed" ? "text-red-400" : "text-gold/60"
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-4 text-champagne/40 italic">Click 'Prepare Songs' to begin processing YouTube links.</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </main>
  );
}
