const {
  tweetWithMedia,
  generateImageFromCode,
  generateAudioFromText,
  generateVideoFromAudioAndImage,
  generateTweetContent,
  test,
} = require("./utils/helper");

const { CronJob } = require("cron");

const maxRetries = 4;

const tweetRandomTechTip = async (retryCount = 0) => {
  try {
    const { content, code, audio_text } = await generateTweetContent();
    const imageFile = await generateImageFromCode(code);

    const speechFile = await generateAudioFromText(audio_text);

    const videoFile = await generateVideoFromAudioAndImage(
      speechFile,
      imageFile
    );

    const response = await tweetWithMedia(content, videoFile, "video");

    console.log(response);

    // await test();
  } catch (e) {
    console.log("Error posting tweet: ", e);

    if (retryCount < maxRetries) {
      console.log(`Retrying (attempt ${retryCount + 1}/${maxRetries})...`);
      // Retry with an incremented retry count
      await tweetRandomTechTip(retryCount + 1);
    } else {
      console.log("Max retries reached. Unable to post tweet.");
    }
  }
};

tweetRandomTechTip();

new CronJob(
  "0 */5 * * *",
  async function () {
    try {
      await tweetRandomTechTip();
    } catch (e) {}
  },
  null,
  true,
  "Asia/Kolkata"
);
