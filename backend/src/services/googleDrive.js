const { google } = require("googleapis");
const fs = require("fs-extra");
const path = require("path");

/**
 * Service to handle Google Drive backups for project ZIPs.
 * Requires a service_account.json or OAuth credentials.
 */
class GoogleDriveService {
  constructor() {
    this.auth = null;
    this.drive = null;
    this.init();
  }

  async init() {
    const keyPath = path.join(process.cwd(), "google_credentials.json");
    if (!(await fs.pathExists(keyPath))) {
      console.warn("[GOOGLE] No credentials found. Google Drive backup disabled.");
      return;
    }

    try {
      this.auth = new google.auth.GoogleAuth({
        keyFile: keyPath,
        scopes: ["https://www.googleapis.com/auth/drive.file"],
      });
      this.drive = google.drive({ version: "v3", auth: this.auth });
      console.log("[GOOGLE] Service initialized successfully.");
    } catch (error) {
      console.error("[GOOGLE] Failed to initialize:", error.message);
    }
  }

  async uploadFile(filePath, fileName, folderId = null) {
    if (!this.drive) return null;

    try {
      console.log(`[GOOGLE] Uploading ${fileName} to Drive...`);
      const fileMetadata = {
        name: fileName,
        parents: folderId ? [folderId] : []
      };
      const media = {
        body: fs.createReadStream(filePath)
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: "id, webViewLink"
      });

      // Set public permission (optional, based on user preference)
      await this.drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
          role: "reader",
          type: "anyone"
        }
      });

      console.log(`[GOOGLE] Upload successful: ${response.data.id}`);
      return response.data.webViewLink;
    } catch (error) {
      console.error("[GOOGLE] Upload failed:", error.message);
      return null;
    }
  }
}

module.exports = new GoogleDriveService();
