require("dotenv").config();

const OAuth = require("oauth-1.0a");
const crypto = require("crypto");
const FormData = require("form-data");
const syncFs = require("fs");
const fs = require("fs").promises;
const path = require("path");
const axios = require("axios");
const OpenAI = require("openai");
// const js_beautify = require("js-beautify");
const prettier = require("prettier");
const ffmpeg = require("fluent-ffmpeg");
const ffprobe = require("ffprobe");
const ffprobeStatic = require("ffprobe-static");

ffmpeg.setFfmpegPath(require("@ffmpeg-installer/ffmpeg").path);
ffmpeg.setFfprobePath(require("@ffprobe-installer/ffprobe").path);

const config = require("./config.json");

const { generateImage } = require("./generateImage");

const { uploadToYoutube } = require("./youtube-upload");
const { getImagesFromLexica } = require("./lexica");

// Your keys and tokens
const CONSUMER_KEY = process.env.CONSUMER_KEY;
const CONSUMER_SECRET = process.env.CONSUMER_SECRET;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const ACCESS_SECRET = process.env.ACCESS_SECRET;
const BEARER_TOKEN = process.env.BEARER_TOKEN;
const OAUTH_2_CLIENT_ID = process.env.OAUTH_2_CLIENT_ID;
const OAUTH_2_CLIENT_SECRET = process.env.OAUTH_2_CLIENT_SECRET;

// The user token
const token = { key: ACCESS_TOKEN, secret: ACCESS_SECRET };

// Initialize OAuth1.0a with your app's keys and hashing method
const oauth = OAuth({
  consumer: { key: CONSUMER_KEY, secret: CONSUMER_SECRET },
  signature_method: "HMAC-SHA1",
  hash_function(base_string, key) {
    return crypto.createHmac("sha1", key).update(base_string).digest("base64");
  },
});

async function uploadMedia(mediaPath) {
  return new Promise(async (resolve, reject) => {
    try {
      // Prepare request data
      const formData = new FormData();
      formData.append("media", syncFs.createReadStream(mediaPath));
      formData.append("media_category", "tweet_image");

      // Prepare the OAuth Authorization header
      const request_data = {
        url: "https://upload.twitter.com/1.1/media/upload.json",
        method: "POST",
      };

      const headers = oauth.toHeader(oauth.authorize(request_data, token));
      Object.assign(headers, formData.getHeaders()); // This will add the Content-Type with boundary

      // Make the request
      const { data } = await axios.post(request_data.url, formData, {
        headers,
      });

      // Resolve with media_id_string from the response
      resolve(data.media_id_string);
    } catch (error) {
      reject(error.response ? error.response.data : error.message);
    }
  });
}

async function uploadVideo(videoPath, additional_owners = null) {
  return new Promise(async (resolve, reject) => {
    try {
      // INIT
      const mediablob = syncFs.readFileSync(videoPath);

      const contentType = "video/mp4";

      const size = mediablob.length;

      const url = "https://upload.twitter.com/1.1/media/upload.json";

      const initUrl = `${url}?command=INIT&total_bytes=${size}&media_type=${encodeURIComponent(
        contentType
      )}&media_category=tweet_video${
        additional_owners ? `&additional_owners=${additional_owners}` : ""
      }`;

      let request_data = { url: initUrl, method: "POST" };
      let headers = oauth.toHeader(oauth.authorize(request_data, token));

      const { data: initResponse } = await axios(initUrl, {
        method: "POST",
        headers,
      });

      const media_id_string = initResponse.media_id_string;

      // APPEND
      const segment_index = 0;

      const formData = new FormData();
      formData.append("media", mediablob);

      const appendUrl = `${url}?command=APPEND&media_id=${media_id_string}&segment_index=${segment_index}`;

      request_data = { url: appendUrl, method: "POST" };
      headers = oauth.toHeader(oauth.authorize(request_data, token));
      Object.assign(headers, formData.getHeaders()); // This will add the Content-Type with boundary

      const { data: appendResponse } = await axios(appendUrl, {
        method: "POST",
        headers,
        data: formData,
      });

      // FINALIZE
      const finalizeUrl = `${url}?command=FINALIZE&media_id=${media_id_string}`;
      request_data = { url: finalizeUrl, method: "POST" };
      headers = oauth.toHeader(oauth.authorize(request_data, token));
      Object.assign(headers, formData.getHeaders()); // This will add the Content-Type with boundary

      await axios(finalizeUrl, {
        method: "POST",
        headers,
      });

      // Polling function to check the status of finalization
      const pollFinalizeStatus = async () => {
        const finalizeCheckUrl = `${url}?command=STATUS&media_id=${media_id_string}`;
        request_data = { url: finalizeCheckUrl, method: "GET" };
        headers = oauth.toHeader(oauth.authorize(request_data, token));

        const { data: statusResponse } = await axios(finalizeCheckUrl, {
          method: "GET",
          headers,
        });

        if (
          statusResponse.processing_info &&
          statusResponse.processing_info.state === "succeeded"
        ) {
          // Finalization successful
          resolve(statusResponse.media_id_string);
        } else if (
          statusResponse.processing_info &&
          statusResponse.processing_info.state === "failed"
        ) {
          // Finalization failed
          reject({
            err: "Finalization Failed",
          });
        } else {
          // Continue polling
          setTimeout(pollFinalizeStatus, 1000); // Poll every 1 second (adjust as needed)
        }
      };

      pollFinalizeStatus();
    } catch (error) {
      // Reject with error
      reject(error);
    }
  });
}

async function tweetWithMedia(text, mediaPath, type = "image") {
  return new Promise(async (resolve, reject) => {
    try {
      // Step 1: Upload the media and get the media ID
      let mediaId;
      if (type == "image") {
        mediaId = await uploadMedia(mediaPath);
      } else if (type == "video") {
        mediaId = await uploadVideo(mediaPath);
      } else {
        console.log("Invalid media type");
        return;
      }

      // Step 2: Create a tweet with the text and media ID
      const tweetData = {
        text,
        media: {
          media_ids: [mediaId],
        },
      };

      const request_data = {
        url: "https://api.twitter.com/2/tweets",
        method: "POST",
      };
      const headers = oauth.toHeader(oauth.authorize(request_data, token));

      headers["Content-Type"] = "application/json";

      const { data } = await axios.post(
        "https://api.twitter.com/2/tweets",
        tweetData,
        {
          headers,
        }
      );

      config.count += 1;
      await fs.writeFile(
        "./utils/config.json",
        JSON.stringify(config, null, 2)
      );

      resolve(`Tweet with id: ${data.data.id} posted successfully`);
    } catch (error) {
      reject({
        from: "tweetWithMedia Error",
        data: JSON.stringify(
          error.response ? error.response.data : error.response || error,
          undefined,
          4
        ),
      });
    }
  });
}

const generateImageFromCode = async (code) => {
  const colors = [
    {
      borderColor: "#2E3440",
      theme: "slack-dark",
      windowBackgroundColor: null,
    },
    {
      borderColor: "#3e302c",
      theme: "vitesse-dark",
      windowBackgroundColor: "#141414",
    },
  ];

  const randomTheme = colors[randomNumber(0, 2)];
  return new Promise(async (resolve, reject) => {
    try {
      const imageData = await generateImage({
        code: code,
        language: "javascript",
        theme: randomTheme.theme,
        format: "png",
        upscale: 4,
        font: "hack",
        border: { thickness: 40, radius: 7, colour: randomTheme.borderColor },
        windowBackgroundColor: randomTheme.windowBackgroundColor,
        showLineNumber: false,
        imageFormat: "png",
      });

      const imageFile = path.resolve(`./assets/images/${Date.now()}.png`);

      await fs.writeFile(imageFile, imageData.image);

      resolve(imageFile);
    } catch (error) {
      reject(error);
    }
  });
};

const generateAudioFromText = async (audio_text) => {
  return new Promise(async (resolve, reject) => {
    try {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: "echo",
        input: audio_text,
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());

      const speechFile = path.resolve(`./assets/audios/${Date.now()}.mp3`);

      await fs.writeFile(speechFile, buffer);

      resolve(speechFile);
    } catch (e) {
      reject(e);
    }
  });
};

const generateVideoFromAudioAndImage = async (speechFile, imageFile) => {
  return new Promise((resolve, reject) => {
    try {
      const videoFile = path.resolve(`./assets/videos/${Date.now()}.mp4`);

      // Probe the audio file to get its duration
      ffprobe(speechFile, { path: ffprobeStatic.path }, (err, info) => {
        if (err) {
          console.error("Error probing audio file:", err);
          return;
        }

        const audioDuration = String(
          parseFloat(info["streams"][0].duration) + 2.5
        );

        // Now use the obtained duration to set the image duration
        const command = ffmpeg()
          .input(imageFile)
          .loop(audioDuration)
          .input(speechFile)
          .audioFilter(`volume=2`)
          .audioBitrate(128)
          .videoBitrate(5000)
          .inputFPS(30)
          .videoCodec("libx264")
          .size("720x1280") // Set video resolution
          .aspect("9:16") // Set aspect ratio
          .outputOptions([
            "-profile:v high", // Set video profile
            "-level 4.2", // Set video level
            "-pix_fmt yuv420p", // Set pixel format
            "-b:a 128k", // Set audio bitrate
            "-c:a aac", // Set audio codec
            "-strict -2", // Allow experimental codecs
            "-r 30", // Set frame rate
            "-y", // Overwrite output files without asking
          ])
          .audioFilters(`adelay=${1.2 * 1000}|${1.2 * 1000}`)
          .output(videoFile)
          .on("end", () => {
            resolve(videoFile);
          })
          .on("error", (err) => {
            console.error("Error:", err);
            reject(err);
          });

        command.run();
      });
    } catch (error) {
      reject(error);
    }
  });
};

const generateTweetContent = async () => {
  return new Promise(async (resolve, reject) => {
    try {
      const topic = config.topics[randomNumber(0, config.topics.length)];

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // const tipLength = randomNumber(0, 5) >= 3 ? "7-8" : "2-3";
      const tipLength = "2-3";

      const chatCompletion = await openai.chat.completions.create({
        messages: [
          {
            role: "user",
            content:
              "You are a helpful assistant who knows about a 1000000 concepts in wide variety of topics in Tech (Coding Development) including ReactJS, MongoDB, ExpressJS, NodeJS, NextJS, Javascript.",
          },
          {
            role: "user",
            // content: `Generate a ${tipLength} line random tech-related, less known yet helpful life saviour tip on ${topic} and short code snippet demonstrating the tip and a short text (will be further fed into TTS) which will explain the tip very clearly. Return the response strictly in json format: { code: '', content: '', audio_text: '' }. Make sure it is easy to grasp, and technically correct, and also add some introductory line at the beginning of the audio_text (something like: 'Welcome to Tech tips part ${config.count + 1}').`
            // content: `Generate a concise ${tipLength} line random tech tip for ${topic}, focusing on a lesser-known but highly beneficial (life saviour tip) concept for a developer. Accompany the tip with a short code snippet illustrating the tip clearly. Additionally, provide a brief message (will be further fed into TTS and coverted to audio) in the 'audio_text' field, which should explain the tip on why and how it is useful, ensure the opening statements should feel very positive and welcoming to the user (not robotic, or not human made) (This is for the tweet for a series called as Tech Tips on Twitter on my channel). Return the response strictly in JSON format: { "code": "", "content": "", "audio_text": "" }. Ensure the technical accuracy and ease of understanding of the generated content.`,
            content: `Random seed: ${Date.now()}. Generate a concise, (lesser-known yet impactful) tech tip about ${topic}. The tip should be explained in ${tipLength} lines (content: 200 chars max) with a supporting short JS code snippet (code) on how the tip can be implemented. Additionally, provide an 'audio_text' (will be further fed into TTS and converted to audio) which further elucidates this tip in an easily understandable language. Start the audio_text with opening statements like 'Welcome back', or 'Hey there', or other similar lines & end the audio_text with statements that encourages users to engage with the tweet.' Please avoid the common and known topics and focus more on the hidden features that are highly useful in daily life of developers. The response should be in strict JSON format: { "code": "", "content": "", "audio_text": "" }. Let's make sure the generated content is technically accurate and easy to grasp. (Make sure to not pick any exact phrases from this prompt and give them back in generated answer. Use your creativity to create your own phrases similar to the ones you think s=you should use from the prompt.)`,
          },
        ],
        model: "gpt-3.5-turbo-1106",
        response_format: { type: "json_object" },
        seed: Date.now(),
        temperature: 1.4,
      });

      const response = JSON.parse(chatCompletion.choices[0].message.content);

      // await fs.writeFile("./utils/config.json", JSON.stringify(config, null, 2));

      response.content = `${bold(`Tech Tip #${config.count + 1}`)}\n\n${bold(
        topic
      )}\n\n${response.content}`;

      response.code = await formatCode(response.code, topic);

      resolve({
        content: response.content,
        code: response.code,
        audio_text: response.audio_text,
      });
    } catch (error) {
      reject(error);
    }
  });
};

function randomNumber(min, max) {
  return parseInt(Math.random() * (max - min) + min);
}

function bold(inputString) {
  const boldChars = {
    A: "𝗔",
    B: "𝗕",
    C: "𝗖",
    D: "𝗗",
    E: "𝗘",
    F: "𝗙",
    G: "𝗚",
    H: "𝗛",
    I: "𝗜",
    J: "𝗝",
    K: "𝗞",
    L: "𝗟",
    M: "𝗠",
    N: "𝗡",
    O: "𝗢",
    P: "𝗣",
    Q: "𝗤",
    R: "𝗥",
    S: "𝗦",
    T: "𝗧",
    U: "𝗨",
    V: "𝗩",
    W: "𝗪",
    X: "𝗫",
    Y: "𝗬",
    Z: "𝗭",
    a: "𝗮",
    b: "𝗯",
    c: "𝗰",
    d: "𝗱",
    e: "𝗲",
    f: "𝗳",
    g: "𝗴",
    h: "𝗵",
    i: "𝗶",
    j: "𝗷",
    k: "𝗸",
    l: "𝗹",
    m: "𝗺",
    n: "𝗻",
    o: "𝗼",
    p: "𝗽",
    q: "𝗾",
    r: "𝗿",
    s: "𝘀",
    t: "𝘁",
    u: "𝘂",
    v: "𝘃",
    w: "𝘄",
    x: "𝘅",
    y: "𝘆",
    z: "𝘇",
  };

  const boldString = inputString
    .split("")
    .map((char) => boldChars[char] || char)
    .join("");
  return boldString;
}

function formatCode(code, topic) {
  try {
    let parser = "babel-ts";
    if (topic.toUpperCase().includes("SCSS")) {
      parser = "scss";
    } else if (topic.toUpperCase().includes("CSS")) {
      parser = "css";
    }
    const formattedCode = prettier.format(code, {
      // Prettier options (optional). You can customize these based on your preferences.
      // For example, you can set the tab width, use single or double quotes, etc.
      // For a full list of options, refer to the Prettier documentation: https://prettier.io/docs/en/options.html
      semi: false,
      singleQuote: true,
      trailingComma: "none",
      tabWidth: 2,
      parser: parser, // Specify the parser (e.g., 'babel', 'typescript', 'json')
    });

    return formattedCode;
  } catch (error) {
    console.error("Error formatting code:", error.message);
    return code; // Return the original code in case of an error
  }
}

async function test() {
  return new Promise((resolve, reject) => {
    try {
      const imageFile =
        "/home/sumit/_Projects/twitter_automation/assets/images/1699809789151.png";

      const silentAudioFile =
        "/home/sumit/_Projects/twitter_automation/assets/silent.mp3";
      const speechFile =
        "/home/sumit/_Projects/twitter_automation/assets/audios/1699809792803.mp3";
      const videoFile =
        "/home/sumit/_Projects/twitter_automation/assets/videos/1699809792803.mp4";

      const audioDuration = 16;

      // Now use the obtained duration to set the image duration
      const command = ffmpeg()
        // .input(silentAudioFile)
        // .input(speechFile)
        // .input(imageFile)
        // .inputFormat("mp3")
        // .inputFormat("mp3")
        // .inputFormat("image2")
        // .complexFilter(complexFilter)
        // .outputOptions("-c:v libx264")
        // .outputOptions("-c:a aac")

        .input(imageFile)
        .loop(audioDuration)
        .input(speechFile)
        .audioFilter(`adelay=${2}s`)
        .audioBitrate(128)
        .videoBitrate(5000)
        .inputFPS(30)
        .videoCodec("libx264")
        .size("1280x720") // Set video resolution
        .aspect("16:9") // Set aspect ratio
        .outputOptions([
          "-profile:v high", // Set video profile
          "-level 4.2", // Set video level
          "-pix_fmt yuv420p", // Set pixel format
          "-b:a 128k", // Set audio bitrate
          "-c:a aac", // Set audio codec
          "-strict experimental",
          "-r 30", // Set frame rate
          "-y", // Overwrite output files without asking
        ])
        .audioFilters(`adelay=${2 * 1000}|${2 * 1000}`)
        .output(videoFile)
        .on("start", (commandLine) => {
          console.log(`Spawned Ffmpeg with command: ${commandLine}`);
        })
        .on("end", () => {
          console.log("Video Creation Finished");
        })
        .on("stderr", (stderrLine) => {
          console.log("Stderr output:", stderrLine);
        })
        .on("error", (err) => {
          console.log("Error:", err);
        });

      command.run();
    } catch (e) {
      reject("Test Catch: ", e);
    }
  });
}

module.exports = {
  uploadMedia,
  tweetWithMedia,
  generateImageFromCode,
  generateAudioFromText,
  generateVideoFromAudioAndImage,
  generateTweetContent,
  uploadVideo,
  uploadToYoutube,
  getImagesFromLexica,
  test,
};
