# Wedding Music Collection Web App

A premium, mobile-first music collection system for Bengali Hindu wedding video editors.

Clients open the webpage, paste YouTube or Spotify song links under wedding rituals, optionally upload local MP3 files, and submit. The backend creates a wedding project folder, ritual subfolders, metadata files, and a ZIP for the editor/admin panel. If `yt-dlp` is installed, YouTube audio is downloaded automatically.

## Tech Stack

- Frontend: React, Next.js, Tailwind CSS, Framer Motion
- Backend: Node.js, Express.js
- Downloads: `yt-dlp`
- ZIP generation: `archiver`

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

Client app: http://localhost:3000  
Hidden admin page: http://localhost:3000/admin

Default backend: http://localhost:4000

## Install yt-dlp

The app runs without `yt-dlp`, but YouTube audio download needs it.

macOS:

```bash
brew install yt-dlp
```

Linux:

```bash
python3 -m pip install -U yt-dlp
```

## Environment Variables

```bash
PORT=4000
NEXT_PUBLIC_API_URL=http://localhost:4000
ADMIN_KEY=change-this-admin-key
PROJECT_RETENTION_DAYS=14
MAX_FILE_MB=50
ENABLE_YTDLP=true
```

## Production Notes

- Put the Express API behind HTTPS.
- Set a strong `ADMIN_KEY`.
- Keep `backend/storage` on persistent disk.
- Install `yt-dlp` and `ffmpeg` on the server.
- Run the frontend and backend as separate services, or use a process manager such as PM2.
- Add a reverse proxy such as Nginx for TLS, upload limits, and caching.

## Folder Output

```text
Wedding_Project_2026-05-10/
├── Mehendi/
├── Ashirbad/
├── Gaye_Holud/
├── Sindur_Daan/
├── Bidai/
├── project.json
└── submission.zip
```
# wedding-editing-os
