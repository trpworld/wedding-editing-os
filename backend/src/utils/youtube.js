const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "music.youtube.com"]);

function parseYoutubeId(value) {
  try {
    const url = new URL(value);
    if (!YOUTUBE_HOSTS.has(url.hostname)) return null;
    if (url.hostname === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || null;
    if (url.pathname.startsWith("/shorts/")) return url.pathname.split("/")[2] || null;
    return url.searchParams.get("v");
  } catch {
    return null;
  }
}

function isSpotify(value) {
  try {
    const url = new URL(value);
    return url.hostname.includes("spotify.com");
  } catch {
    return false;
  }
}

function thumbnailFor(id) {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

function isSupportedSongUrl(value) {
  return Boolean(parseYoutubeId(value) || isSpotify(value));
}

module.exports = { parseYoutubeId, thumbnailFor, isSpotify, isSupportedSongUrl };
