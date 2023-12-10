const fs = require("fs").promises;
const syncFs = require("fs");
const path = require("path");
const process = require("process");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");

// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/drive"];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.

const TOKEN_DIR = path.resolve(`.credentials`);

const TOKEN_PATH = TOKEN_DIR + "/drive_token.json";
const CREDENTIALS_PATH = TOKEN_DIR + "/drive_credentials.json";

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

const getSrtFileFromDrive = async (payload) => {
  return new Promise(async (resolve, reject) => {
    try {
      const { folderName, videoId } = payload;
      const authClient = await authorize();

      const drive = google.drive({ version: "v3", auth: authClient });

      const folderRes = await drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder'`,
        fields: "files(id)",
      });

      const folders = folderRes.data.files;

      if (folders.length === 0) {
        resolve({
          status: false,
          err: `Folder "${folderName}" not found.".`,
        });
        return;
      }

      const folderId = folders[0].id;

      // Search for the file by name within the specified folder
      const fileRes = await drive.files.list({
        q: `name='${videoId}.srt' and '${folderId}' in parents`,
        pageSize: 1,
        fields: "files(id, name)",
      });

      const subtitleFiles = fileRes.data.files;

      const videoRes = await drive.files.list({
        q: `name='${videoId}.mp4' and '${folderId}' in parents`,
        pageSize: 1,
        fields: "files(id, name)",
      });

      const videoFiles = videoRes.data.files;

      if (subtitleFiles.length === 0 || videoFiles.length === 0) {
        resolve({
          status: false,
          err: `File "${videoId}.srt" or "${videoId}.mp4" not found in your G-Drive at folder "${folderName}".`,
        });
        return;
      }
      const subtitle_FileId = subtitleFiles[0].id;
      const video_FileId = videoFiles[0].id;

      let downloadStatus = false,
        subPath,
        videoPath;
      // Download the files
      for (let i = 0; i < 2; i++) {
        let ext = i == 0 ? ".srt" : ".mp4";
        let fileId = i == 0 ? subtitle_FileId : video_FileId;
        if (ext == ".srt") {
          subPath = path.resolve(`./assets/files/${videoId}${ext}`);
        } else if (ext == ".mp4") {
          videoPath = path.resolve(`./assets/files/${videoId}${ext}`);
        }
        const dest = syncFs.createWriteStream(i == 0 ? subPath : videoPath);
        await drive.files
          .get({ fileId, alt: "media" }, { responseType: "stream" })
          .then((response) => {
            response.data
              .on("end", () => {
                downloadStatus = i == 1;
                if (downloadStatus) {
                  resolve({
                    status: true,
                    subPath,
                    videoPath,
                    err: "",
                  });
                }
              })
              .on("error", (err) => {
                resolve({
                  status: false,
                  err: err.message,
                });
              })
              .pipe(dest);
          });
      }
    } catch (error) {
      resolve({
        status: false,
        err: error.response ? error.response.data : error.message,
      });
    }
  });
};

module.exports = { getSrtFileFromDrive };
