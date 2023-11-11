require("dotenv").config();

const OAuth = require("oauth-1.0a");
const crypto = require("crypto");
const FormData = require("form-data");
const syncFs = require("fs");
const fs = require("fs").promises;
const axios = require("axios");
const OpenAI = require("openai");
// const js_beautify = require("js-beautify");
const prettier = require("prettier");

const config = require("./config.json");

const { generateImage } = require("./generateImage");

// Your keys and tokens
const CONSUMER_KEY = process.env.CONSUMER_KEY;
const CONSUMER_SECRET = process.env.CONSUMER_SECRET;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const ACCESS_SECRET = process.env.ACCESS_SECRET;
const BEARER_TOKEN = process.env.BEARER_TOKEN;
const OAUTH_2_CLIENT_ID = process.env.OAUTH_2_CLIENT_ID;
const OAUTH_2_CLIENT_SECRET = process.env.OAUTH_2_CLIENT_SECRET;

// Initialize OAuth1.0a with your app's keys and hashing method
const oauth = OAuth({
  consumer: { key: CONSUMER_KEY, secret: CONSUMER_SECRET },
  signature_method: "HMAC-SHA1",
  hash_function(base_string, key) {
    return crypto.createHmac("sha1", key).update(base_string).digest("base64");
  },
});

// The user token
const token = { key: ACCESS_TOKEN, secret: ACCESS_SECRET };

function uploadMedia(mediaPath) {
  return new Promise((resolve, reject) => {
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
    axios
      .post(request_data.url, formData, { headers })
      .then((response) => {
        // Resolve with media_id_string from the response
        resolve(response.data.media_id_string);
      })
      .catch((error) => {
        // Reject with error
        reject(error.response ? error.response.data : error.message);
      });
  });
}

async function tweetWithMedia(text, mediaPath) {
  try {
    // Step 1: Upload the media and get the media ID
    const mediaId = await uploadMedia(mediaPath);

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

    console.log(`Tweet with id: ${data.data.id} posted successfully`);
  } catch (error) {
    console.log("Error:", error);
  }
}

const generateImageFromCode = async (code) => {
  const imageData = await generateImage({
    code: code,
    language: "javascript",
    theme: "slack-dark",
    format: "png",
    upscale: 4,
    font: "hack",
    border: { thickness: 40, radius: 7, colour: "#2E3440" },
    showLineNumber: false,
    imageFormat: "png",
  });

  const imagePath = `./assets/${Date.now()}.png`;

  await fs.writeFile(imagePath, imageData.image);

  return imagePath;
};

const generateTweetContent = async () => {
  const topic = config.topics[randomNumber(0, config.topics.length)];
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const tipLength = randomNumber(0, 5) >= 3 ? "6-7" : "2-3";

  const chatCompletion = await openai.chat.completions.create({
    messages: [
      {
        role: "user",
        content: `Generate a ${tipLength} line random tech-related, less known yet helpful life saviour tip on ${topic} and short code snippet demonstrating the tip. Return the response strictly in json format: { code: '', content: '' }. Make sure to beautify the code correctly, as prettier in vscode with proper indentations and include new lines wherever necessary. Also in code make sure every string after newline should not exceed max 35 chars limit.`,
      },
    ],
    model: "gpt-3.5-turbo-1106",
    response_format: { type: "json_object" },
  });

  const response = JSON.parse(chatCompletion.choices[0].message.content);

  // config.count += 1;

  await fs.writeFile("./utils/config.json", JSON.stringify(config, null, 2));

  response.content = `${bold(`Tech Tip #${config.count}`)}\n\n${bold(
    topic
  )}\n\n${response.content}`;

  response.code = await formatCode(response.code);

  return { content: response.content, code: response.code };
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

function formatCode(code) {
  try {
    const formattedCode = prettier.format(code, {
      // Prettier options (optional). You can customize these based on your preferences.
      // For example, you can set the tab width, use single or double quotes, etc.
      // For a full list of options, refer to the Prettier documentation: https://prettier.io/docs/en/options.html
      semi: false,
      singleQuote: true,
      tabWidth: 2,
      parser: "babel", // Specify the parser (e.g., 'babel', 'typescript', 'json')
    });

    return formattedCode;
  } catch (error) {
    console.error("Error formatting code:", error.message);
    return code; // Return the original code in case of an error
  }
}

async function test() {
  try {
    let code = "console.log( 'Hello World!'     )     ;";

    const options = { indent_size: 2, space_in_empty_paren: true };

    const dataObj = {
      completed: false,
      id: 1,
      title: "delectus aut autem",
      userId: 1,
    };

    const dataJson = JSON.stringify(dataObj);

    const res = js_beautify(code, {
      indent_size: 2,
      space_in_empty_paren: true,
    });

    console.log("beautified code: ", res);
  } catch (e) {
    console.log("Error: ", e);
  }
}

module.exports = {
  uploadMedia,
  tweetWithMedia,
  generateImageFromCode,
  generateTweetContent,
  test,
};
