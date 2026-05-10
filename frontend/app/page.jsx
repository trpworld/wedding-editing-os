"use client";

import { useEffect, useMemo, useState } from "react";
import { DragDropContext } from "@hello-pangea/dnd";
import { motion } from "framer-motion";
import RitualCard from "../components/RitualCard";
import { MusicIcon } from "../components/Icons";
import { rituals } from "../lib/rituals";
import { fetchSongMetadata, submitWeddingProject } from "../lib/api";

function newSong(id) {
  return { id: id || crypto.randomUUID(), url: "", title: "", thumbnail: "", duration: "", provider: "", error: "", loading: false };
}

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [language, setLanguage] = useState("en");
  const [clientName, setClientName] = useState("");
  const [weddingDate, setWeddingDate] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const [songsByRitual, setSongsByRitual] = useState(() =>
    Object.fromEntries(rituals.map((ritual) => [ritual.en, [newSong(`initial-${ritual.en.toLowerCase().replace(/\s+/g, "-")}`)]]))
  );
  const [filesByRitual, setFilesByRitual] = useState({});
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const totalSongs = useMemo(
    () => Object.values(songsByRitual).flat().filter((song) => song.url.trim()).length,
    [songsByRitual]
  );

  function updateSong(ritual, songId, patch) {
    setSongsByRitual((current) => ({
      ...current,
      [ritual]: current[ritual].map((song) => (song.id === songId ? { ...song, ...patch } : song))
    }));
  }

  async function readMetadata(ritual, songId) {
    const song = songsByRitual[ritual].find((item) => item.id === songId);
    if (!song?.url.trim()) return;
    updateSong(ritual, songId, { loading: true, error: "" });
    try {
      const metadata = await fetchSongMetadata(song.url.trim());
      updateSong(ritual, songId, { ...metadata, loading: false, error: "" });
    } catch (error) {
      updateSong(ritual, songId, { loading: false, error: error.message });
    }
  }

  function addSong(ritual) {
    setSongsByRitual((current) => ({ ...current, [ritual]: [...current[ritual], newSong()] }));
  }

  function removeSong(ritual, songId) {
    setSongsByRitual((current) => ({
      ...current,
      [ritual]: current[ritual].length === 1 ? [newSong()] : current[ritual].filter((song) => song.id !== songId)
    }));
  }

  function onDragEnd(result) {
    if (!result.destination || result.source.droppableId !== result.destination.droppableId) return;
    const ritual = result.source.droppableId;
    setSongsByRitual((current) => {
      const next = [...current[ritual]];
      const [moved] = next.splice(result.source.index, 1);
      next.splice(result.destination.index, 0, moved);
      return { ...current, [ritual]: next };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("loading");
    setMessage(language === "bn" ? "গানগুলো সাজানো হচ্ছে..." : "Organizing your songs...");

    const payload = {
      clientName,
      weddingDate,
      rituals: rituals
        .map((ritual) => ({
          name: ritual.en,
          songs: songsByRitual[ritual.en]
            .filter((song) => song.url.trim())
            .map(({ error, loading, ...song }) => ({ ...song, url: song.url.trim() }))
        }))
        .filter((ritual) => ritual.songs.length || filesByRitual[ritual.name]?.length)
    };

    if (!clientName.trim() && !weddingDate.trim()) {
      setStatus("error");
      setMessage(language === "bn" ? "দয়া করে নাম এবং তারিখ উভয়ই দিন।" : "Please enter both name and date.");
      return;
    }

    if (!clientName.trim()) {
      setStatus("error");
      setMessage(language === "bn" ? "দয়া করে ক্লায়েন্টের নাম লিখুন।" : "Please enter a client name.");
      return;
    }

    if (!weddingDate.trim()) {
      setStatus("error");
      setMessage(language === "bn" ? "দয়া করে বিয়ের তারিখ নির্বাচন করুন।" : "Please select a wedding date.");
      return;
    }

    try {
      const result = await submitWeddingProject(payload, filesByRitual);
      setStatus("success");
      setMessage(
        result.ytdlpAvailable
          ? language === "bn"
            ? "গান সফলভাবে জমা হয়েছে।"
            : "Songs submitted successfully."
          : language === "bn"
            ? "জমা হয়েছে। অডিও ডাউনলোডের জন্য সার্ভারে yt-dlp ইনস্টল করুন।"
            : "Submitted. Install yt-dlp on the server for automatic audio downloads."
      );
    } catch (error) {
      setStatus("error");
      setMessage(error.message);
    }
  }

  if (!mounted) return <div className="min-h-screen bg-ink" />;

  if (status === "success") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink px-4 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass max-w-lg rounded-3xl p-8 shadow-glow sm:p-12"
        >
          <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full bg-gold text-ink">
            <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="font-display text-4xl text-pearl sm:text-5xl">
            {language === "bn" ? "সফলভাবে জমা হয়েছে!" : "Submission Successful!"}
          </h1>
          <p className="mt-4 text-lg text-champagne/80">
            {language === "bn"
              ? "আপনার গানগুলো সফলভাবে ভিডিও এডিটরের কাছে পৌঁছে গেছে। ধন্যবাদ!"
              : "Your song collection has been successfully sent to the video editor. Thank you!"}
          </p>
          <button
            onClick={() => {
              setStatus("idle");
              setClientName("");
              setWeddingDate("");
              setSongsByRitual(Object.fromEntries(rituals.map((ritual) => [ritual.en, [newSong(`initial-${ritual.en.toLowerCase().replace(/\s+/g, "-")}`)]])));
              setFilesByRitual({});
              setMessage("");
            }}
            className="mt-8 min-h-14 w-full rounded-xl bg-gold px-6 font-bold text-ink shadow-glow transition hover:bg-champagne"
          >
            {language === "bn" ? "আরেকটি জমা দিন" : "Submit Another Project"}
          </button>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-5 safe-bottom sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 overflow-hidden rounded-[1.75rem] border border-gold/20 bg-black/35 p-5 shadow-glow sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-gold text-ink">
                <MusicIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-gold/80">Wedding Editor Music Desk</p>
                <h1 className="font-display text-3xl text-pearl sm:text-5xl">Wedding Music Collection</h1>
              </div>
            </div>
            <div className="flex rounded-full border border-gold/25 bg-white/5 p-1">
              {["en", "bn"].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setLanguage(item)}
                  className={`h-10 rounded-full px-4 text-sm font-semibold transition ${language === item ? "bg-gold text-ink" : "text-champagne"}`}
                >
                  {item === "en" ? "English" : "বাংলা"}
                </button>
              ))}
            </div>
          </div>
          <div className="gold-line my-6 h-px" />
          <p className="max-w-2xl text-base leading-7 text-champagne/80">
            {language === "bn"
              ? "YouTube লিংক পেস্ট করুন, চাইলে MP3 আপলোড করুন, তারপর সাবমিট করুন। বাকি ফোল্ডার সাজানোর কাজ এডিটরের জন্য অটোমেটিক তৈরি হবে।"
              : "Paste YouTube links, add local MP3s if needed, then submit. The editor receives everything organized by Bengali wedding ritual folders."}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <section className="glass grid gap-4 rounded-2xl p-4 sm:grid-cols-2 sm:p-5">
            <div>
              <label className="text-sm font-semibold text-champagne">
                {language === "bn" ? "ক্লায়েন্ট/বিয়ের নাম" : "Client or wedding name"} <span className="text-red-400">*</span>
              </label>
              <input
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                placeholder={language === "bn" ? "যেমন: Rahul & Priya" : "Example: Rahul & Priya"}
                className="mt-2 min-h-14 w-full rounded-xl border border-gold/20 bg-ink/70 px-4 text-lg text-pearl outline-none transition focus:border-gold"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-champagne">
                {language === "bn" ? "বিয়ের তারিখ" : "Wedding date"} <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={weddingDate}
                onChange={(event) => setWeddingDate(event.target.value)}
                className="mt-2 min-h-14 w-full rounded-xl border border-gold/20 bg-ink/70 px-4 text-lg text-pearl outline-none transition focus:border-gold"
              />
            </div>
          </section>

          <DragDropContext onDragEnd={onDragEnd}>
            {rituals.map((ritual, index) => (
              <RitualCard
                key={ritual.en}
                ritual={ritual}
                index={index}
                language={language}
                songs={songsByRitual[ritual.en]}
                files={filesByRitual[ritual.en] || []}
                onAddSong={addSong}
                onUpdateSong={updateSong}
                onRemoveSong={removeSong}
                onFetchMetadata={readMetadata}
                onFiles={(name, files) => setFilesByRitual((current) => ({ ...current, [name]: files }))}
              />
            ))}
          </DragDropContext>

          <div className="sticky bottom-0 z-10 -mx-4 border-t border-gold/20 bg-ink/90 p-4 backdrop-blur-xl safe-bottom sm:mx-0 sm:rounded-2xl sm:border">
            <div className="mx-auto flex max-w-5xl items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-pearl">{totalSongs} song links ready</p>
                {message && <p className={`truncate text-sm ${status === "error" ? "text-red-300" : "text-champagne/70"}`}>{message}</p>}
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={status === "loading"}
                className="min-h-14 rounded-xl bg-gold px-6 font-bold text-ink shadow-glow transition hover:bg-champagne disabled:cursor-wait disabled:opacity-70"
              >
                {status === "loading" ? "Submitting..." : language === "bn" ? "সাবমিট" : "Submit"}
              </motion.button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
