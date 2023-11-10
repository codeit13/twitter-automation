const {
  tweetWithMedia,
  generateImageFromCode,
  generateTweetContent,
  test,
} = require("./utils/helper");

const { CronJob } = require("cron");

const tweetRandomTechTip = async () => {
  try {
    const { content, code } = await generateTweetContent();
    const image = await generateImageFromCode(code);
    await tweetWithMedia(content, image);

    // await test();
  } catch (e) {
    console.log("Error posting tweet: ", e);
  }
};

tweetRandomTechTip();

new CronJob(
  "0 */5 * * *",
  async function () {
    await tweetRandomTechTip();
  },
  null,
  true,
  "Asia/Kolkata"
);
