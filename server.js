const {
  tweetWithMedia,
  generateImageFromCode,
  generateImageFromText,
  generateAudioFromText,
  generateVideoFromAudioAndImage,
  generateTweetContent,
  uploadToYoutube,
  getImagesFromLexica,
  randomNumber,
  test,
  formatCode,
} = require("./utils/helper");

// const { Cron } = require("croner");

const maxRetries = 6;

const tweetRandomTechTip = async (retryCount = 0) => {
  try {
    const tweetTypes = [
      { type: "thread", priority: 8 },
      { type: "video", priority: 5 },
      { type: "image", priority: 2 },
    ];
    const randomTweetTypesArr = tweetTypes.flatMap((type) =>
      Array.from({ length: type.priority }, () => type.type)
    );
    // const tweetType =
    //   randomTweetTypesArr[randomNumber(0, randomTweetTypesArr.length)];

    const tweetType = "image";

    const { content, code, audio_text, image_text, threads, options } =
      await generateTweetContent(tweetType);
    let imageFile, speechFile, videoFile, response;
    switch (tweetType) {
      case "image":
        imageFile = await generateImageFromCode(code);
        // response = await tweetWithMedia(content, imageFile, tweetType);
        break;
      case "video":
        imageFile = await generateImageFromCode(code);
        speechFile = await generateAudioFromText(audio_text);
        videoFile = await generateVideoFromAudioAndImage(speechFile, imageFile);
        // response = await tweetWithMedia(content, videoFile, tweetType);
        break;
      case "poll":
        // response = await tweetWithMedia(content, null, tweetType, options);
        break;
      case "thread":
        await Promise.all(
          threads.map(async (thread, i) => {
            thread.imageFile = thread.code
              ? await generateImageFromCode(thread.code)
              : null;
          })
        );
        threads[0].imageFile = await generateImageFromText(image_text);
        // response = await tweetWithMedia(null, null, tweetType, null, threads);
        break;
      default:
        console.log("Invalid tweet type");
        break;
    }
    console.log(response);
    //
    //
    // *********************************************** TESTING ***********************************************
    //
    // const code = `import { useMemo } from 'react';\n\n// Define your function here\nconst expensiveOperation = () => {\n  // Expensive calculations here\n};\n\nconst Component = () => {\n  const memoizedValue = useMemo(expensiveOperation, []);\n\n  return (\n    // Your JSX here\n  );\n};`;
    // console.log(await formatCode(code, "nextjs"));
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
    // await generateImageFromText(
    //   "Understanding the key concepts of routing and data fetching on NextJS"
    // );
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
