const {
  tweetWithMedia,
  generateImageFromCode,
  generateAudioFromText,
  generateVideoFromAudioAndImage,
  generateTweetContent,
  uploadToYoutube,
  getImagesFromLexica,
  test,
} = require("./utils/helper");

const { CronJob } = require("cron");

const maxRetries = 6;

const tweetRandomTechTip = async (retryCount = 0) => {
  try {
    const { content, code, audio_text } = await generateTweetContent();
    const imageFile = await generateImageFromCode(code);
    const speechFile = await generateAudioFromText(audio_text);
    const videoFile = await generateVideoFromAudioAndImage(
      speechFile,
      imageFile
    );
    // const response = await tweetWithMedia(content, videoFile, "video");
    // console.log(response);

    //
    //
    // *********************************************** TESTING ***********************************************
    //
    // await test();
    // const response = await uploadToYoutube({
    //   title: "This is from NodeJS",
    //   description:
    //     "Hola, Arigato Osimasss How are you all doing today. This is a test description from NodeJS.",
    //   tags: "#test #nodejs #tags",
    //   videoFilePath:
    //     "/home/sumit/_Projects/twitter_automation/assets/videos/1699853657961.mp4",
    //   thumbFilePath:
    //     "home/sumit/_Projects/twitter_automation/assets/images/1699852136866.png",
    // });
    // console.log(response);
    // const response = await getImagesFromLexica(
    //   "Embrace Karmayoga: Dedicate, Act, Thrive – Bhagavad Gita's Wisdom Unleashed"
    // );
    // console.log(`https://image.lexica.art/md2_webp/${response.images[0].id}`);
    //
    // *********************************************** TESTING ***********************************************
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
