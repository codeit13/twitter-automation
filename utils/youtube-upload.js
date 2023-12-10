var fs = require("fs");
var readline = require("readline");
var { google } = require("googleapis");

var OAuth2 = google.auth.OAuth2;
const path = require("path");

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/youtube-nodejs-quickstart.json
var SCOPES = ["https://www.googleapis.com/auth/youtube.upload"];
// var TOKEN_DIR = __dirname + "/.credentials";
const TOKEN_DIR = path.resolve(`.credentials`);

var TOKEN_PATH = TOKEN_DIR + "/youtube_credentials.json";

// video category IDs for YouTube:
const categoryIds = {
  Entertainment: 24,
  Education: 27,
  ScienceTechnology: 28,
};

// Load client secrets from a local file.
// fs.readFile(
//   "/home/sumit/_Projects/twitter_automation/tokens/client_secret.json",
//   function processClientSecrets(err, content) {
//     if (err) {
//       console.log("Error loading client secret file: " + err);
//       return;
//     }
//     // Authorize a client with the loaded credentials, then call the YouTube API.
//     authorize(JSON.parse(content), getChannel);
//   }
// );

const uploadToYoutube = async (payload) => {
  return new Promise((resolve, reject) => {
    fs.readFile(
      "/home/sumit/_Projects/twitter_automation/tokens/client_secret.json",
      function processClientSecrets(err, content) {
        if (err) {
          reject("Error loading client secret file: " + err);
          return;
        }
        // Authorize a client with the loaded credentials, then call the YouTube API.
        authorize(JSON.parse(content), (auth) =>
          uploadVideo(auth, payload, resolve, reject)
        );
      }
    );
  });
};

/**
 * Upload the video file.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function uploadVideo(auth, payload, resolve, reject) {
  const { title, description, tags, videoFilePath, thumbFilePath } = payload;

  const service = google.youtube("v3");

  let snippet = {
    title: `${title} | ${tags.split(" ").splice(0, 3).join(" ")}`,
    description,
    tags: tags.split(" ").splice(0, 3).join(" "),
    categoryId: categoryIds.Education,
    defaultLanguage: "en",
    defaultAudioLanguage: "en",
  };
  console.log(snippet);
  service.videos.insert(
    {
      auth: auth,
      part: "snippet,status",
      requestBody: {
        snippet,
        status: {
          privacyStatus: "public",
        },
      },
      media: {
        body: fs.createReadStream(videoFilePath),
      },
    },
    function (err, response) {
      if (err) {
        // console.log("The API returned an error: " + err);
        reject("The API returned an error: " + err);
        return;
      }
      console.log("Video uploaded, uploading thumbnail now");

      const insertData = response.data;

      service.thumbnails.set(
        {
          auth: auth,
          videoId: response.data.id,
          media: {
            body: fs.createReadStream(thumbFilePath),
          },
        },
        function (err, response) {
          if (err) {
            reject("The API returned an error: " + err);
            return;
          }
          console.log("Thumbnail uploaded");
          resolve({
            insertData: insertData,
            thumbnailData: response.data,
          });
        }
      );
    }
  );
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
async function authorize(credentials, callback) {
  return new Promise(async (resolve, reject) => {
    var clientSecret = credentials.web.client_secret;
    var clientId = credentials.web.client_id;
    var redirectUrl = credentials.web.redirect_uris[0];
    var oauth2Client = new OAuth2(clientId, clientSecret, redirectUrl);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, function (err, token) {
      if (err) {
        getNewToken(oauth2Client, callback);
      } else {
        oauth2Client.credentials = JSON.parse(token);
        callback(oauth2Client);
      }
    });
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  console.log("Authorize this app by visiting this url: ", authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question("Enter the code from that page here: ", function (code) {
    rl.close();
    oauth2Client.getToken(code, function (err, token) {
      if (err) {
        console.log("Error while trying to retrieve access token", err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != "EEXIST") {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
    if (err) throw err;
    console.log("Token stored to " + TOKEN_PATH);
  });
}

/**
 * Lists the names and IDs of up to 10 files.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function getChannel(auth) {
  var service = google.youtube("v3");
  service.channels.list(
    {
      auth: auth,
      part: "snippet,contentDetails,statistics",
      forUsername: "GoogleDevelopers",
    },
    function (err, response) {
      if (err) {
        console.log("The API returned an error: " + err);
        return;
      }
      var channels = response.data.items;
      if (channels.length == 0) {
        console.log("No channel found.");
      } else {
        console.log(
          "This channel's ID is %s. Its title is '%s', and " +
            "it has %s views.",
          channels[0].id,
          channels[0].snippet.title,
          channels[0].statistics.viewCount
        );
      }
    }
  );
}

(async () => {
  // read json file using await
  const data = await fs.readFileSync(
    "/home/sumit/_Projects/twitter_automation/assets/files/yt_upload_args.json"
  );

  const args = JSON.parse(data);
  try {
    await uploadToYoutube(args);
  } catch (error) {
    console.log(error);
  }
})();

// fs.readFile("./assets/files/yt_args.json", (err, data) => {
//   if (err) {
//     console.log(err);
//   } else {
//     JSON.parse(data)
//   }
// });
// uploadToYoutube({});

module.exports = { uploadToYoutube };
