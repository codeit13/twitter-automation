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

const fs = require("fs");

// const { Cron } = require("croner");

const maxRetries = 6;

const tweetRandomTechTip = async (retryCount = 0) => {
  try {
    const randomSecs = randomNumber(400, 600);
    console.log(`Waiting for ${(randomSecs / 60).toFixed(2)} minutes...`);
    await new Promise((r) => setTimeout(r, randomSecs * 1000));
    const tweetTypes = [
      { type: "thread", priority: 6 },
      { type: "video", priority: 5 },
      { type: "question", priority: 3 },
      { type: "image", priority: 2 },
      { type: "poll", priority: 1 },
    ];
    const randomTweetTypesArr = tweetTypes.flatMap((type) =>
      Array.from({ length: type.priority }, () => type.type)
    );
    const tweetType =
      randomTweetTypesArr[randomNumber(0, randomTweetTypesArr.length - 1)];
    // const tweetType = "thread";
    const { content, code, audio_text, image_text, prompt, threads, options } =
      await generateTweetContent(tweetType);
    let imageFile, speechFile, videoFile, response;
    switch (tweetType) {
      case "image":
        imageFile = await generateImageFromCode(code);
        response = await tweetWithMedia(content, imageFile, tweetType);
        break;
      case "video":
        imageFile = await generateImageFromCode(code);
        speechFile = await generateAudioFromText(audio_text);
        videoFile = await generateVideoFromAudioAndImage(speechFile, imageFile);
        response = await tweetWithMedia(content, videoFile, tweetType);
        break;
      case "poll":
        response = await tweetWithMedia(content, null, tweetType, options);
        break;
      case "thread":
        console.log(threads);
        await Promise.all(
          threads.map(async (thread, i) => {
            thread.imageFile = thread.code
              ? await generateImageFromCode(thread.code)
              : null;
          })
        );
        threads[0].imageFile = await generateImageFromText(image_text, prompt);
        response = await tweetWithMedia(null, null, tweetType, null, threads);
        break;
      case "question":
        imageFile = await generateImageFromCode(code);
        response = await tweetWithMedia(content, imageFile, tweetType);
        break;
      default:
        console.log("Invalid tweet type");
        break;
    }
    console.log(response);
    const now = new Date();
    const time = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
    const date = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
    response = `${date} ${time} ${response}`;
    // Append the text to the file
    fs.appendFile("./logs/cron.txt", `${response}\n\n\n`, (err) => {
      if (err) {
        console.error("Error appending text:", err);
      }
    });
    // *******************************************************************************************************
    //
    //
    // *********************************************** TESTING ***********************************************
    //
    // const code = `import { useMemo } from 'react';\n\n// Define your function here\nconst expensiveOperation = () => {\n  // Expensive calculations here\n};\n\nconst Component = () => {\n  const memoizedValue = useMemo(expensiveOperation, []);\n\n  return (\n    // Your JSX here\n  );\n};`;
    // await generateImageFromCode(code);
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
    //     "/home/sumit/_Projects/twitter_automation/assets/reels/reel_2023-12-08 00:27:23.129305.mp4",
    //   thumbFilePath:
    //     "/home/sumit/_Projects/twitter_automation/assets/images/1700768898949.png",
    // });
    // console.log(response);
    // const { count, images } = await getImagesFromLexica(
    //   "Embrace Karmayoga: Dedicate, Act, Thrive – Bhagavad Gita's Wisdom Unleashed"
    // );
    // console.log(count);
    // console.log(`https://image.lexica.art/md2_webp/${response.images[0].id}`);
    //
    // await generateImageFromText(
    //   "Understanding the key concepts of routing and data fetching on NextJS",
    //   "coding developer girl"
    // );
    // await generateImageFromText(
    //   "Concise JavaScript Promises thread explanation"
    // );
    // *********************************************** TESTING ***********************************************
  } catch (e) {
    console.log("Error posting tweet: ", e);

    // append error log to logs/error.txt
    const now = new Date();
    const time = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
    const date = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
    const error = `${date} ${time} Error posting tweet (retryCount: ${retryCount}) with error: ${
      typeof e == "object"
        ? JSON.stringify(e.data ? e.data.errors : e, null, 2)
        : e
    }`;

    fs.appendFile("./logs/error.txt", `${error}\n\n\n`, (err) => {
      if (err) {
        console.error("Error appending text:", err);
      }
    });

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
