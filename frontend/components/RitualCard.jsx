"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Draggable, Droppable } from "@hello-pangea/dnd";
import { GripIcon, MusicIcon, PlusIcon, TrashIcon } from "./Icons";

export default function RitualCard({
  ritual,
  index,
  language,
  songs,
  files,
  onAddSong,
  onUpdateSong,
  onRemoveSong,
  onFetchMetadata,
  onFiles
}) {
  const title = language === "bn" ? ritual.bn : ritual.en;

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.02, 0.18) }}
      className="glass rounded-2xl p-4 sm:p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-gold/80">{String(index + 1).padStart(2, "0")}</p>
          <h2 className="mt-1 font-display text-2xl text-pearl">{title}</h2>
          {language === "bn" && <p className="text-sm text-champagne/65">{ritual.en}</p>}
        </div>
        <div className="rounded-full border border-gold/25 px-3 py-1 text-sm text-champagne">{songs.length} songs</div>
      </div>

      <Droppable droppableId={ritual.en}>
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
            <AnimatePresence initial={false}>
              {songs.map((song, songIndex) => (
                <Draggable key={song.id} draggableId={song.id} index={songIndex}>
                  {(dragProvided) => (
                    <motion.div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="rounded-xl border border-white/10 bg-black/20 p-3"
                    >
                      <div className="flex gap-3">
                        <button
                          type="button"
                          {...dragProvided.dragHandleProps}
                          className="mt-4 h-10 w-8 shrink-0 rounded-lg text-champagne/55"
                          aria-label="Sort song"
                          title="Sort song"
                        >
                          <GripIcon className="mx-auto h-5 w-5" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <input
                            value={song.url}
                            onChange={(event) => onUpdateSong(ritual.en, song.id, { url: event.target.value, error: "", loading: false })}
                            placeholder={language === "bn" ? "YouTube বা Spotify লিংক পেস্ট করুন" : "Paste YouTube or Spotify song link"}
                            className="min-h-14 w-full rounded-xl border border-gold/20 bg-ink/70 px-4 text-base text-pearl outline-none transition focus:border-gold"
                          />
                          {song.error && <p className="mt-2 text-sm text-red-300">{song.error}</p>}
                          {song.loading && <p className="mt-2 text-sm text-gold">Reading song details...</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveSong(ritual.en, song.id)}
                          className="mt-2 h-11 w-11 shrink-0 rounded-xl border border-white/10 text-champagne/75 transition hover:border-red-300/40 hover:text-red-200"
                          aria-label="Remove song"
                          title="Remove song"
                        >
                          <TrashIcon className="mx-auto h-5 w-5" />
                        </button>
                      </div>

                      {(song.thumbnail || song.title) && (
                        <div className="mt-3 flex gap-3 rounded-xl bg-white/[0.04] p-2">
                          {song.thumbnail ? (
                            <img src={song.thumbnail} alt="" className="h-16 w-24 rounded-lg object-cover" />
                          ) : (
                            <div className="grid h-16 w-24 place-items-center rounded-lg bg-gold/10">
                              <MusicIcon className="h-6 w-6 text-gold" />
                            </div>
                          )}
                          <div className="min-w-0 py-1">
                            <p className="truncate text-sm font-semibold text-pearl">{song.title || "Song link saved"}</p>
                            <p className="mt-1 text-xs text-champagne/60">{song.duration || song.provider || "Ready for editor"}</p>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </Draggable>
              ))}
            </AnimatePresence>
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onAddSong(ritual.en)}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gold px-4 font-semibold text-ink transition hover:bg-champagne"
        >
          <PlusIcon className="h-5 w-5" />
          {language === "bn" ? "আরও গান যোগ করুন" : "Add More Song"}
        </button>
        <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-gold/25 px-4 text-center text-sm font-semibold text-champagne transition hover:border-gold">
          {files.length ? `${files.length} MP3 selected` : language === "bn" ? "লোকাল MP3 আপলোড" : "Upload local MP3"}
          <input type="file" accept="audio/mpeg,audio/mp3" multiple className="hidden" onChange={(event) => onFiles(ritual.en, Array.from(event.target.files || []))} />
        </label>
      </div>
    </motion.section>
  );
}
