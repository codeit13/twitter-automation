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
const flourite = require("flourite");
const ffmpeg = require("fluent-ffmpeg");
const ffprobe = require("ffprobe");
const ffprobeStatic = require("ffprobe-static");

const { convert: srtToAss } = require("srt-to-ass");

ffmpeg.setFfmpegPath(require("@ffmpeg-installer/ffmpeg").path);
ffmpeg.setFfprobePath(require("@ffprobe-installer/ffprobe").path);

const config = require("./config.json");
const logs = require("../logs/log.json");

const { generateImage } = require("./generateImage");

const { uploadToYoutube } = require("./youtube-upload");
const { getImagesFromLexica } = require("./lexica");

const { createClient } = require("pexels");

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
          deleteFile(videoPath).then(() => {
            resolve(statusResponse.media_id_string);
          });
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

async function tweetWithMedia(
  text,
  mediaPath = null,
  type = "image",
  options = null,
  threads = null
) {
  return new Promise(async (resolve, reject) => {
    try {
      // Step 1: Upload the media and get the media ID
      let mediaId = null;

      if (type == "image" || type == "question") {
        mediaId = await uploadMedia(mediaPath);
      } else if (type == "video") {
        mediaId = await uploadVideo(mediaPath);
      } else if (type == "poll") {
      } else if (type == "thread") {
        await Promise.all(
          threads.map(async (thread, i) => {
            thread.mediaId =
              thread.imageFile !== null
                ? await uploadMedia(thread.imageFile)
                : null;

            thread.isLastTweet = i === threads.length - 1;
          })
        );
      } else {
        console.log("Invalid media type");
        return;
      }

      if (type == "thread") {
        let replyTweetId = null,
          firstTweetId = null;
        for (let thread of threads) {
          const tweetData = {
            text: thread.content,
            ...(thread.mediaId
              ? { media: { media_ids: [thread.mediaId] } }
              : {}),
            ...(replyTweetId
              ? { reply: { in_reply_to_tweet_id: replyTweetId } }
              : {}),
            ...(thread.isLastTweet ? { quote_tweet_id: firstTweetId } : null),
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
          if (replyTweetId == null) {
            firstTweetId = data.data.id;
          }
          replyTweetId = data.data.id;

          await new Promise((r) =>
            setTimeout(r, randomNumber(400, 600) * 1000)
          );
        }
      } else {
        const tweetData = {
          text: `${text}\n\n`,
          ...(mediaId ? { media: { media_ids: [mediaId] } } : {}),
          ...(options
            ? {
                poll: {
                  options,
                  duration_minutes: 2000,
                },
              }
            : {}),
          ...(threads ? { reply: { media_ids: [mediaId] } } : {}),
        };

        const request_data = {
          url: "https://api.twitter.com/2/tweets",
          method: "POST",
        };
        const headers = oauth.toHeader(oauth.authorize(request_data, token));

        headers["Content-Type"] = "application/json";

        await axios.post("https://api.twitter.com/2/tweets", tweetData, {
          headers,
        });

        if (type == "video") {
          config.count += 1;
          await fs.writeFile(
            "./utils/config.json",
            JSON.stringify(config, null, 2)
          );
        }
      }

      resolve(
        `${
          type[0].toUpperCase() + type.slice(1)
        } tweet has been posted successfully`
      );
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

const generateImageFromText = async (text, prompt = null) => {
  return new Promise(async (resolve, reject) => {
    try {
      const imageData = await generateImage({
        type: "text",
        content: text,
        imageFormat: "png",
        prompt,
      });

      const imageFile = path.resolve(`./assets/images/${Date.now()}.png`);

      await fs.writeFile(imageFile, imageData.image);

      resolve(imageFile);
    } catch (error) {
      reject(error);
    }
  });
};

const generateImageFromCode = async (code) => {
  const colors = [
    {
      borderColor: "#2E3440",
      theme: "slack-dark",
    },
    {
      borderColor: "#292828",
      theme: "vitesse-dark",
    },
    {
      borderColor: "#7eb8c4",
      theme: "github-dark",
    },
    {
      borderColor: "#3e302c",
      theme: "vitesse-dark",
    },
  ];

  const randomTheme = colors[randomNumber(0, colors.length - 1)];
  return new Promise(async (resolve, reject) => {
    try {
      const imageData = await generateImage({
        type: "code",
        content: code,
        language: "javascript",
        theme: randomTheme.theme,
        format: "png",
        upscale: 4,
        font: "hack",
        border: { thickness: 25, radius: 7, colour: randomTheme.borderColor },
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
          .inputFPS(30)
          .videoBitrate(32)
          .audioCodec("aac")
          .videoCodec("libx264")
          .aspectRatio("1:1")
          .outputOptions([
            "-profile:v main", // Set video profile
            "-level 3.1", // Set video level
            "-strict -2", // Allow experimental codecs
            "-g 30", // Set GOP size to 30 frames (adjust as needed)
            "-y", // Overwrite output files without asking,
            "-b:v 2048K", // Adjust based on Twitter's recommendations
            "-b:a 32K", // Adjust based on Twitter's recommendations,
            "-pix_fmt yuv420p",
          ])
          .keepDAR()
          .videoFilters("pad=ceil(iw/2)*2:ceil(ih/2)*2")
          .audioFilters("volume=2", `adelay=${1.2 * 1000}|${1.2 * 1000}`)
          .output(videoFile)
          .on("end", () => {
            deleteFile(imageFile).then(() => {
              deleteFile(speechFile).then(() => {
                resolve(videoFile);
              });
            });
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

const generateTweetContent = async (type) => {
  return new Promise(async (resolve, reject) => {
    try {
      const topic = config.topics[randomNumber(0, config.topics.length - 1)];

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      let PROMPT = null;
      if (type == "image") {
        PROMPT = `Random seed: ${Date.now()}. Generate a concise, (lesser-known yet impactful) tech tip about a random sub-concept in ${topic}. The tip should be explained in 200 chars max with a supporting short JS code snippet (code: prettify the code with new line and spaces) on how the tip can be implemented. Please avoid the common and known topics and focus more on the hidden features that are highly useful in daily life of developers. The response should be in strict JSON format: { "code": "", "content": "" }. Let's make sure the generated content is technically accurate and easy to grasp. (Make sure to not pick any exact phrases from this prompt and give them back in generated answer. Use your creativity to create your own phrases similar to the ones you think you should use from the prompt.)`;
      } else if (type == "video") {
        PROMPT = `Random seed: ${Date.now()}. Generate a concise, (lesser-known yet impactful) tech tip about a random sub-concept in ${topic}. The tip should be explained in 200 chars max with a supporting short JS code snippet (code: prettify the code with new line and spaces) on how the tip can be implemented. Additionally, provide an 'audio_text' (will be further fed into TTS and converted to audio) which further elucidates this tip in an easily understandable language. Start the audio_text with opening statements like 'Welcome back', or 'Hey there', or other similar lines & end the audio_text with statements that encourages users to engage with the tweet.' Please avoid the common and known topics and focus more on the hidden features that are highly useful in daily life of developers. The response should be in strict JSON format: { "code": "", "content": "", "audio_text": "" }. Let's make sure the generated content is technically accurate and easy to grasp. (Make sure to not pick any exact phrases from this prompt and give them back in generated answer. Use your creativity to create your own phrases similar to the ones you think you should use from the prompt.)`;
      } else if (type == "poll") {
        PROMPT = `Random seed: ${Date.now()}. Create a Twitter poll with a short JS code snippet (prettify the code with new line and spaces) in ${topic}. The question should be a bit tricky to answer but easy to understand. Use casual language, no over-excitement & use an attention grabbing hook in question. Make sure the question isn't such that it's ambigous to answer, without a lot of context. Also provide 3 possible answers (options) (out of which strictly only one option should be correct). Provide the question (content), code & three possible answers in strict JSON format: { "content": "", code: "", "options": ["", "", ""] }. Ensure each option is no more than 20 characters.`;
      } else if (type == "thread") {
        PROMPT = `Random seed: ${Date.now()}. Write a Twitter thread (6-8 tweets) on a random sub-concept in ${topic}. Complete thread as a whole, should be able to cover all the important details of the sub-concept discussed. First tweet should be an intro on what's inside this thread (min: 220 chars, max: 230 chars) (use casual language with no over-excitement keep straight to the point, no deep dive, or similar lines) (Make sure you use an attention grabbing hook that goes like x no. of developers use these tricks to improve their code, or here are x no of ways you can use this, or do you know why you code does this every time you try to do this, and other simialr hooks, they should not look too witty, keep it straight to the point, no welcome, hey devs or such opening statements). Subsequent tweets should discuss about different aspects of the concept discussed in the initial tweet (use new lines and extra spaces wherever necessary, to make the tweets look more presentable), with a working/ useful short JS code snippet (prettify the code with new line and spaces) of that aspect (content language should be such that it's also easy for beginner readers to understand the concept (content char limit: (min=220, max=230))). Give two viral hashtags per tweet for javascript coding topics. Make sure the reader of the whole thread is able to easily grasp/ understand the concept discussed in it. Use appropriate new lines, wherever necessary for the good presentation of the tweets. Provide the threads in strict JSON format (array of objects): { "image_text":  "", image_prompt: "", "threads": [ { "content": "", code: ", hashtags: ["", ""] }] }. Use less emojies. Provide a short attention grabbing headline (5-6 words) for the thread and return it in image_text. Provide a short image prompt for the kind of aesthetic image that should catch users attention (image should have a cool aesthetic developer girl/boy working, and the image_prompt on whole should create a sense of interesting and calm/ amazing content in viewer's mind), and should relate to the tweet.`;
      } else if (type == "question") {
        PROMPT = `Random seed: ${Date.now()}. Write a short question on a random short JS code snippet (prettify the code with new line and spaces) in ${topic}. The question should be a bit tricky to answer but easy to understand. Use casual language, no over-excitement & use an attention grabbing hook in question. Make sure the question isn't such that it's ambigous to answer, without a lot of context. Also provide 3 possible answers (options) (out of which strictly only one option should be correct). Provide the question in strict JSON format: { "content": "", code: "", options: " }. Strictly follow these character limit rules in response:
        1) Question + Options array character count should be min = 190 chars, max = 210 chars.
        2) Each Option should have minimum 5 words and a maximum of 6, not more than that.`;
      }

      const chatCompletion = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are a helpful developer assistant who has in depth knowledge about various concepts in a wide variety of topics in Tech (Coding) including but not limited to topics like ${config.topics.join(
              ","
            )}. Your main coding language is JavaScript.`,
          },
          {
            role: "user",
            content: PROMPT,
          },
        ],
        model: "gpt-4-1106-preview",
        // model: "gpt-3.5-turbo-1106",
        response_format: { type: "json_object" },
        seed: Date.now(),
        temperature: 0.9,
      });

      const response = JSON.parse(chatCompletion.choices[0].message.content);

      if (type == "image") {
        response.content = `${bold(topic)}\n\n${response.content}`;

        // response.code = await formatCode(response.code, topic);
      } else if (type == "video") {
        response.content = `${bold(`Tech Tip #${config.count + 1}`)}\n\n${bold(
          topic
        )}\n\n${response.content}`;

        response.code = await formatCode(response.code, topic);
      } else if (type == "poll") {
        response.content +=
          "\n\n" + (await formatCode(response.code, topic)) + "\n\n";
      } else if (type == "thread") {
        response.threads.map((thread, i) => {
          thread.content =
            thread.content.replace(/#[a-zA-Z0-9_]+/g, "") +
            (i == 0 ? "\n\nThread Below 🧵\n\n" : "\n\n");

          thread.content = thread.content.replace(".", ".\n\n");
        });

        await Promise.all(
          response.threads.map(async (thread, i) => {
            if (thread.code == "" || thread.code == undefined) {
              thread.code = null;
            } else thread.code = await formatCode(thread.code, topic);

            if (thread.hashtags && i != 0) {
              thread.content = `${
                thread.content.includes("/")
                  ? ""
                  : i + "/" + (response.threads.length - 1)
              } ${thread.content}\n\n\n${thread.hashtags
                .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
                .splice(0, 2)
                .join(" ")}`;
            }
          })
        );

        response.threads.push({
          content: `And that's a wrap for this thread! 🎁\n\nIf these coding tips sparked your interest:\n\n1.  Like and Retweet if you've gained valuable insights.\n2.  Share your thoughts in the comments.\n\nFollow @thesleebit for more such daily tips & tricks 💻`,
          code: null,
        });
      } else if (type == "question") {
        let optionsStr = response.options
          .map((option, i) => {
            return !option.includes(")")
              ? `${
                  i == 0
                    ? "A"
                    : i == 1
                    ? "B"
                    : i == 2
                    ? "C"
                    : i == 3
                    ? "D"
                    : "E"
                }) ${option}`
              : option;
          })
          .join("\n");
        response.content = `${response.content}\n\n${optionsStr}\n\n\nWhat do you think? 💭`;

        if (response.code.split("\n")[0].includes("```")) {
          response.code = `${response.code
            .split("\n")
            .map((line) => {
              return line.includes("```") ? "" : line;
            })
            .join("\n")}`;
        }
        response.code = await formatCode(response.code, topic);
      }

      resolve(response);
    } catch (error) {
      reject(error);
    }
  });
};

function randomNumber(min, max) {
  // return parseInt(Math.random() * (max - min) + min);
  const floatRandom = Math.random();

  const difference = max - min;

  // random between 0 and the difference
  const random = Math.round(difference * floatRandom);

  const randomWithinRange = random + min;

  return randomWithinRange;
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

async function deleteFile(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (err) {
    console.log("Error deleting file:", err);
  }
}

async function downloadVideo(url) {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await axios({
        method: "get",
        url: url,
        responseType: "stream",
      });
      const videoPath = path.resolve(`./assets/videos/${Date.now()}.mp4`);
      const videoFile = syncFs.createWriteStream(videoPath);
      response.data.pipe(videoFile);

      videoFile.on("finish", () => {
        videoFile.close();
        resolve(videoPath);
      });

      videoFile.on("error", (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function formatCode(code, topic) {
  const language = flourite(code, {
    shiki: true,
    heuristic: true,
  }).language;

  topic = topic.toLowerCase();

  let parser = "babel";
  if (topic.includes("scss")) {
    parser = "scss";
  } else if (topic.includes("typescript")) {
    parser = "babel-ts";
  } else if (topic.includes("vue")) {
    parser = "vue";
  }

  if (language == "html" && topic.includes("nextjs")) {
    parser = "vue";
  } else if (language == "javascript" && topic.includes("css")) {
    parser = "vue";
  } else if (language == "dart" && topic.includes("css")) {
    parser = "vue";
  } else if (language == "lua" && topic.includes("css")) {
    parser = "babel";
  } else if (topic.includes("nextjs") && language == "javascript") {
    parser = "flow";
  } else if (language == "html") {
    parser = "html";
  } else if (language == "css") {
    parser = "css";
  } else if (language == "json") {
    parser = "json";
  } else if (language == "typescript") {
    parser = "babel-ts";
  }
  console.log("parser is: ", parser, "topic: ", topic, "language: ", language);
  return new Promise(async (resolve, reject) => {
    try {
      const formattedCode = await prettier.format(code, {
        // Prettier options (optional). You can customize these based on your preferences.
        // For example, you can set the tab width, use single or double quotes, etc.
        // For a full list of options, refer to the Prettier documentation: https://prettier.io/docs/en/options.html
        semi: false,
        singleQuote: true,
        trailingComma: "none",
        tabWidth: 2,
        parser: parser, // Specify the parser (e.g., 'babel', 'typescript', 'json')
      });

      resolve(formattedCode);
    } catch (error) {
      console.log(error);
      const errorLog = {
        timestamp: new Date().toISOString(),
        parser,
        topic,
        language,
        code,
      };

      if (!logs) logs = {};
      if (logs["formatCode"] == undefined) logs["formatCode"] = [];

      logs["formatCode"].push(errorLog);

      await fs.writeFile(
        path.resolve("./logs/log.json"),
        JSON.stringify(logs, null, 2)
      );

      resolve(code);
    }
  });
}

async function test() {
  return new Promise(async (resolve, reject) => {
    try {
      const srtFile = "/home/sumit/_Projects/twitter_automation/assFile.ass";
      // "/home/sumit/_Projects/twitter_automation/assets/videos/9tNhq63VYo8.srt";
      const videoFile =
        "/home/sumit/_Projects/twitter_automation/assets/videos/shorts/output_2.mp4";

      // extract contents of srtFile into a string and pass to srtToAss function
      // const srtContent = syncFs.readFileSync(srtFile, "utf8");
      // const assContent = srtToAss(srtFile, "./assFile.ass");

      // console.log(assContent);

      // Now use the obtained duration to set the image duration
      // const command = ffmpeg(videoFile)
      //   // .input(videoFile)
      //   // .videoFilters(
      //   //   "subtitles",
      //   //   srtFile,
      //   //   (force_style = "OutlineColour=&H40000000,BorderStyle=3")
      //   // )
      //   .outputOptions(
      //     `-vf subtitles=${srtFile}:force_style='OutlineColour=&H40000000,BorderStyle=3'`
      //   )
      //   .output("./video.mp4")
      //   .on("start", (commandLine) => {
      //     console.log(`Spawned Ffmpeg with command: ${commandLine}`);
      //   })
      //   .on("end", () => {
      //     console.log("Video Creation Finished");
      //     resolve();
      //   })
      //   // .on("stderr", (s
      //   .on("error", (err) => {
      //     console.log("Error:", err);
      //   });

      // command.run();

      const client = createClient(process.env.PEXELS_API_KEY);
      const query = "Vlogging";

      const videos = await client.videos.search({ query, per_page: 80 });
      console.log(videos["videos"].length);
      const videoUrl =
        videos["videos"][randomNumber(0, videos["videos"].length - 1)]
          .video_files[0].link;

      console.log(videoUrl);

      const videoPath = await downloadVideo(videoUrl);
      const textOverlay = "Your Text";

      ffmpeg()
        .input(videoPath)
        .input(
          "/home/sumit/_Projects/twitter_automation/assets/audios/1701069965357.wav"
        ) // Replace with the actual TTS audio file
        .complexFilter([
          `[0:v]drawtext=text='${textOverlay}':fontsize=50:box=1:boxcolor=white@0.5:boxborderw=5:x=(w-text_w)/2:y=(h-text_h)/2[video]`,
          `[0:a][1:a]amix=inputs=2:duration=first[audio]`,
        ])
        .outputOptions("-c:v libx264 -c:a aac")
        .output("./final_output.mp4")
        .on("start", (commandLine) => {
          console.log(`Spawned Ffmpeg with command: ${commandLine}`);
        })
        .on("stderr", function (stderrLine) {
          console.log("Stderr output: " + stderrLine);
        })
        .on("progress", function (progress) {
          console.log("Processing: " + progress.percent + "% done");
        })
        .on("end", () => {
          console.log("Video with subtitles created successfully!");
        })
        .run();
    } catch (e) {
      console.log(e);
      reject("Test Catch: ", e);
    }
  });
}

module.exports = {
  uploadMedia,
  tweetWithMedia,
  generateImageFromCode,
  generateImageFromText,
  generateAudioFromText,
  generateVideoFromAudioAndImage,
  generateTweetContent,
  uploadVideo,
  uploadToYoutube,
  getImagesFromLexica,
  randomNumber,
  test,
  formatCode,
};
