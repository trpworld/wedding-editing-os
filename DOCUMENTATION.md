# Wedding Music Collection - Setup Guide

## 1. Prerequisites
- Node.js (v18+)
- Python 3 (for yt-dlp)
- FFmpeg (automatically provided via ffmpeg-static)
- An External SSD (Recommended: 4TB SSD)

## 2. Installation
1. Clone the project to your SSD.
2. Install dependencies:
   ```bash
   npm install
   npm --prefix frontend install
   ```
3. Create your `.env` file from the `.env.example`.
4. Install `yt-dlp` globally:
   ```bash
   pip3 install -U yt-dlp
   ```

## 3. Running the App
Start both servers with a single command:
```bash
npm run dev
```
- Client Form: `http://localhost:3000`
- Admin Dashboard: `http://localhost:3000/admin`

## 4. Anti-Bot Protection
If YouTube blocks your IP:
1. Export your YouTube cookies using a "Get cookies.txt" browser extension.
2. Save it as `cookies.txt` in the root project folder.
3. The system will automatically detect and use it.

---

# Backup & Recovery Guide

## Daily Backup
The system stores everything in the `/WEDDINGS` folder on your SSD. 
To backup, simply copy the entire `/WEDDINGS` folder to an external HDD or NAS daily.

## Archive Strategy
Once a wedding edit is finished:
1. Move the project folder from your main SSD to your "Cold Storage" HDD.
2. The Admin dashboard will show it as "offline" if the files are moved, but the database will keep the metadata.

## Recovery
If your computer crashes:
1. Re-install Node.js and Python.
2. Re-run `npm install`.
3. Copy your `wedding.db` and `/WEDDINGS` folder back to the root.
4. Start the app—everything will be exactly as you left it.

## 5. Deployment

### Backend (Railway)
1. Link your GitHub repo to Railway.
2. In **Settings > Build & Deploy**, set the **Nixpacks Plan** or use a custom Dockerfile.
3. **Build Command**: 
   ```bash
   apt-get update && apt-get install -y ffmpeg python3 python3-pip && pip3 install yt-dlp
   ```
4. **Environment Variables**:
   - `PORT=4000`
   - `NODE_ENV=production`
   - `STORAGE_PATH=/app/storage` (Mount a Volume for persistence)

### Frontend (Vercel)
1. Link the `frontend/` directory to Vercel.
2. **Environment Variables**:
   - `NEXT_PUBLIC_API_URL=https://your-backend.railway.app`
