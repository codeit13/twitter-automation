const {
  tweetWithMedia,
  generateImageFromCode,
  generateAudioFromText,
  generateVideoFromAudioAndImage,
  generateTweetContent,
  uploadToYoutube,
  getImagesFromLexica,
  randomNumber,
  test,
} = require("./utils/helper");

const { Cron } = require("croner");

const maxRetries = 6;

const tweetRandomTechTip = async (retryCount = 0) => {
  try {
    const tweetTypes = ["image", "video", "poll"];
    const tweetType = tweetTypes[randomNumber(0, tweetTypes.length)];

    const gptResponse = await generateTweetContent(tweetType);
    let response;

    if (tweetType == "image") {
      const imageFile = await generateImageFromCode(gptResponse.code);
      response = await tweetWithMedia(
        gptResponse.content,
        imageFile,
        tweetType
      );
    } else if (tweetType == "video") {
      const imageFile = await generateImageFromCode(gptResponse.code);
      const speechFile = await generateAudioFromText(gptResponse.audio_text);
      const videoFile = await generateVideoFromAudioAndImage(
        speechFile,
        imageFile
      );
      response = await tweetWithMedia(
        gptResponse.content,
        videoFile,
        tweetType
      );
    } else if (tweetType == "poll") {
      response = await tweetWithMedia(
        gptResponse.content,
        null,
        tweetType,
        gptResponse.options
      );
    }

    console.log(response);
    //
    //
    // *********************************************** TESTING ***********************************************
    //
    // await test();
    // const response = await tweetWithMedia(
    //   "content",
    //   "/home/sumit/_Projects/twitter_automation/assets/videos/new.mp4",
    //   "video"
    // );
    // console.log(response);
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

Cron("47 */5 * * *", tweetRandomTechTip);
