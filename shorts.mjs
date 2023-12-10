import ffmpeg from "fluent-ffmpeg";
import { convert } from "srt-to-ass";
import { createCanvas, loadImage } from "canvas";

import editly from "editly";

import { formatTitle } from "./utils/format-canvas-text.js";

// import { getSrtFileFromDrive } from "./utils/drive";

// srtToAss(srtFile, "./assFile.ass");

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

const main = async () => {
  const videoUrl = "";

  const youtubeUrl = process.argv[2];

  const videoId = youtubeUrl.match(
    /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  )[1];
  // const fileName = `${videoId}.srt`;

  const res = await getSrtFileFromDrive({
    folderName: "Transcriptions",
    videoId,
  });

  console.log(res);

  if (!res.status) {
    console.log(res.err);
    return;
  }

  console.log(
    `Subtitles downloaded successfully at ${res.filePath}. Now moving to Step 2`
  );

  const subtitlesPath = res.filePath;
};

// main();

const subPath =
  "/home/sumit/_Projects/twitter_automation/assets/files/aDOOQnWYAZM.srt";
const videoPath =
  "/home/sumit/_Projects/twitter_automation/assets/files/aDOOQnWYAZM.mp4";
const outputPath =
  "/home/sumit/_Projects/twitter_automation/assets/files/output.mp4";

const timestampsJsonFile =
  "/home/sumit/_Projects/twitter_automation/assets/files/timestamps.json";

// const timestamps = require(timestampsJsonFile);

// timestamps.forEach(async (timestamp, index) => {
//   let { start, end, description } = timestamp;

//   start = start.split(",")[0];
//   end = end.split(",")[0];

//   const outputFileName = `output_${index + 1}.mp4`; // Change the naming convention if needed
//   const outputPath = `/home/sumit/_Projects/twitter_automation/assets/videos/shorts/${outputFileName}`;

//   await ffmpeg()
//     .input(videoPath)
//     .inputOptions([`-ss ${start}`, `-to ${end}`])
//     .complexFilter(
//       "[0:v]scale=iw:2*trunc(iw*16/18),boxblur=luma_radius=min(h\\,w)/20:luma_power=1:chroma_radius=min(cw\\,ch)/20:chroma_power=1[bg];[bg][0:v]overlay=(W-w)/2:(H-h)/2,setsar=1"
//     )
//     .videoCodec("libx264")
//     .audioCodec("copy")
//     .output(outputPath)
//     .on("start", (commandLine) => {
//       console.log(`Processing video ${index + 1}: ${description}`);
//       console.log(`Spawned Ffmpeg with command: ${commandLine}`);
//     })
//     .on("end", () => console.log(`Video ${index + 1} conversion finished`))
//     .on("error", (err) =>
//       console.error(`Error processing video ${index + 1}:`, err)
//     )
//     .run();
// });

// const start = "00:00:38";
// const end = "00:00:41";
// ffmpeg()
//   .input(videoPath)
//   .inputOptions([`-ss ${start}`, `-to ${end}`])
//   .complexFilter(
//     "[0:v]scale=iw:2*trunc(iw*16/18),boxblur=luma_radius=min(h\\,w)/20:luma_power=1:chroma_radius=min(cw\\,ch)/20:chroma_power=1[bg];[bg][0:v]overlay=(W-w)/2:(H-h)/2,setsar=1"
//   )
//   .videoCodec("libx264")
//   .audioCodec("copy")
//   .output(outputPath)
//   .on("start", (commandLine) => {
//     console.log(`Spawned Ffmpeg with command: ${commandLine}`);
//   })
//   .on("end", () => console.log("Conversion finished"))
//   .on("error", (err) => console.error("Error:", err))
//   .run();

// ffmpeg -i aDOOQnWYAZM.mp4 -ss 60 -to 100 -lavfi "[0:v]scale=iw:2*trunc(iw*16/18),boxblur=luma_radius=min(h\,w)/20:luma_power=1:chroma_radius=min(cw\,ch)/20:chroma_power=1[bg];[bg][0:v]overlay=(W-w)/2:(H-h)/2,setsar=1" -c:v libx264 -crf 18 -preset veryfast -c:a copy output.mp4

(async () => {
  // const editly = await import("editly");

  // console.log(editly);

  // await editly({
  //   // width: 2166, height: 1650, fps: 30,
  //   width: 720,
  //   height: 1280,
  //   fps: 30,
  //   outPath: "./video.mp4",
  //   // outPath: './commonFeatures.gif',
  //   // audioFilePath: "/home/sumit/_Projects/twitter_automation/assets/audios/1701069965357.mp3",
  //   defaults: {
  //     transition: { name: "random" },
  //     // layer: { fontPath: "./assets/Patua_One/PatuaOne-Regular.ttf" },
  //   },
  //   clips: [
  //     {
  //       duration: 3,
  //       transition: { name: "directional-left" },
  //       layers: [
  //         {
  //           type: "title-background",
  //           text: "EDITLY\nVideo editing framework",
  //           background: {
  //             type: "linear-gradient",
  //             colors: ["#02aab0", "#00cdac"],
  //           },
  //         },
  //       ],
  //     },
  //     {
  //       duration: 4,
  //       transition: { name: "dreamyzoom" },
  //       layers: [
  //         {
  //           type: "title-background",
  //           text: "Multi-line text with animated linear or radial gradients",
  //           background: { type: "radial-gradient" },
  //         },
  //       ],
  //     },
  //     {
  //       duration: 3,
  //       transition: { name: "directional-right" },
  //       layers: [
  //         { type: "rainbow-colors" },
  //         { type: "title", text: "Colorful backgrounds" },
  //       ],
  //     },

  //     { duration: 3, layers: [{ type: "editly-banner" }] },
  //   ],
  // });

  // async function func({ canvas }) {
  //   async function onRender(progress) {
  //     const context = canvas.getContext("2d");
  //     const centerX = canvas.width / 2;
  //     const centerY = canvas.height / 2;
  //     const radius = 40 * (1 + progress * 0.5);

  //     context.beginPath();

  //     // Write "Awesome!"
  //     context.rotate(0.1);
  //     context.fillText("Awesome!", 50, 100);
  //     context.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
  //     context.fillStyle = "hsl(350, 100%, 37%)";
  //     context.fill();
  //     context.lineWidth = 5;
  //     context.strokeStyle = "#ffffff";
  //     context.stroke();
  //   }

  //   function onClose() {
  //     // Cleanup if you initialized anything
  //   }

  //   return { onRender, onClose };
  // }

  const riddleQuestion =
    "I speak without a mouth and hear without ears. I have no body, but I come alive with the wind. What am I?";
  const riddleOptions = ["Wind", "Echo", "Shadow"];

  function getLines(ctx, text, maxWidth) {
    var words = text.split(" ");
    var lines = [];
    var currentLine = words[0];

    for (var i = 1; i < words.length; i++) {
      var word = words[i];
      var width = ctx.measureText(currentLine + " " + word).width;
      if (width < maxWidth) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  }

  async function createRiddleCanvas(args) {
    console.log(args);
    const { canvas, width, height } = args;
    async function onRender(progress) {
      console.log(progress);
      const context = canvas.getContext("2d");

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = 40 * (1 + progress * 0.5);

      // Set canvas dimensions to 9:16 aspect ratio (1080x1920)
      canvas.width = width;
      canvas.height = height;

      // Add a heading title
      context.font = "bold 14px Inter";
      context.fillStyle = "#ffffff";
      context.textAlign = "center";
      context.fillText(
        "Can you solve this riddle?",
        canvas.width / 2,
        canvas.height / 6
      );

      const lineHeight = 30;

      if (progress > 0.05) {
        const texts = getLines(context, riddleQuestion, 150);
        context.font = "bold 16px Inter";

        texts.forEach((text, i) => {
          context.fillText(
            text,
            centerX,
            i == 0 ? centerY - 100 : centerY - 100 + lineHeight * i
          );
        });
        // context.fillText(text[0], centerX, centerY);
        // if (text[1]) context.fillText(text[1], centerX, centerY + lineHeight);
        // if (text[2]) context.fillText(text[2], centerX, centerY + lineHeight);

        // context.fillText(riddleQuestion, canvas.width / 2, canvas.height / 2);
      }

      // if (progress > 0.05) {
      //   // Calculate the opacity based on the progress
      //   // const opacity = Math.max(0, progress - 0.5) * 2;

      //   // Set the text properties
      //   const fontSize = 14;
      //   const lineHeight = fontSize + 5; // Adjust this value as needed
      //   const wordSpacing = 5; // Adjust this value as needed
      //   context.font = `bold ${fontSize}px DK Mandarin Whispers`;
      //   context.fillStyle = `rgba(255, 255, 255, 1)`;
      //   context.textAlign = "left"; // Align the text to the left

      //   // Split the riddle question into words
      //   const words = riddleQuestion.split(" ");

      //   // Calculate the total width of the text
      //   const totalWidth = words.reduce(
      //     (acc, word) => acc + context.measureText(word + " ").width,
      //     0
      //   );

      //   // Calculate the starting X position
      //   let x = (canvas.width - totalWidth) / 2;

      //   // Calculate the starting Y position (centered)
      //   let y = canvas.height / 2;

      //   // Render each word with increasing opacity
      //   for (const word of words.slice(0, Math.ceil(progress * words.length))) {
      //     const wordWidth = context.measureText(word + " ").width;

      //     // If the word goes beyond the right edge, reset x position and move down a line
      //     if (x + wordWidth > canvas.width) {
      //       x = (canvas.width - totalWidth) / 2;
      //       y += lineHeight;
      //     }

      //     // Render the word
      //     context.fillText(word, x, y);

      //     // Move x position for the next word
      //     x += wordWidth + wordSpacing;
      //   }
      // }
    }

    function onClose() {
      // Cleanup if needed
    }

    return { onRender, onClose };
  }

  await editly({
    width: 1080,
    height: 1920,
    fast: process.argv[2] == "fast" ? true : false,
    fps: 30,
    outPath: "./output.mp4",
    defaults: {
      //   layer: {
      //     fontPath:
      //       "/home/sumit/_Projects/twitter_automation/assets/fonts/mandala-font/Mandala-2O0rd.ttf",
      //     type: "image",
      //     path: "./temp_cropped.png",
      //     resize: { width: 1920, height: 1080 },
      //   },
      //   layerType: {
      //     type: "image",
      //     path: "./temp_cropped.png",
      //   },
    },
    clips: [
      {
        duration: 20,
        transition: { name: "directional-left" },
        layers: [
          {
            type: "image",
            path: "./temp_cropped.png",
          },
          // {
          //   type: "fill-color",
          //   text: "Can You Solve This Riddle?",
          //   fontSize: 72,
          //   color: "red",

          //   // marginTop: 100,
          // },
          // { type: "rainbow-colors" },
          { type: "canvas", func: createRiddleCanvas },
        ],
      },
      // {
      //   duration: 6,
      //   layers: [
      //     {
      //       type: "video",
      //       path: "./giphy.gif",
      //       position: "top",
      //     },
      //     {
      //       type: "title",
      //       text: "Correct Answer is...",
      //       fontSize: 72,
      //       color: "white",
      //       position: "bottom",
      //     },
      //   ],
      // },
    ],
  });
})();
