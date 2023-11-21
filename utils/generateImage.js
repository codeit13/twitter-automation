const flourite = require("flourite");
const sharp = require("sharp");
const path = require("path");
const shiki = require("shiki");
const { SvgRenderer } = require("./svg-renderer");
const { generateGradientImage } = require("./gradient-generator/index");

const FONT_MAPPING = {
  hack: {
    fontFamily: "Hack Nerd Font Mono",
    lineHeightToFontSizeRatio: 1.5,
    fontSize: 14,
    fontWidth: 8.35,
  },
  iosevka: {
    fontFamily: "Iosevka Nerd Font Mono",
    lineHeightToFontSizeRatio: 1.5,
    fontSize: 14,
    fontWidth: 7,
  },
  "jetbrains mono": {
    fontFamily: "JetBrainsMonoNL Nerd Font Mono",
    lineHeightToFontSizeRatio: 1.5,
    fontSize: 14,
    fontWidth: 8.4,
  },
  "sf mono": {
    fontFamily: "SFMono Nerd Font",
    lineHeightToFontSizeRatio: 1.5,
    fontSize: 14,
    fontWidth: 8.65,
  },
  "fira code": {
    fontFamily: "FiraCode Nerd Font Mono",
    lineHeightToFontSizeRatio: 1.5,
    fontSize: 14,
    fontWidth: 8.65,
  },
  "cascadia code": {
    fontFamily: "CaskaydiaCove Nerd Font Mono",
    lineHeightToFontSizeRatio: 1.5,
    fontSize: 14,
    fontWidth: 8.15,
  },
};

function guessLanguage(code, language) {
  const guess =
    language === "auto-detect"
      ? flourite(code, { shiki: true, heuristic: true }).language
      : language;
  const guessedLanguage = guess === "unknown" ? "md" : guess;
  return guessedLanguage;
}

async function generateImage({
  type,
  content,
  language,
  border,
  imageFormat,
  upscale,
  theme,
  font,
  showLineNumber,
}) {
  let codeImage;
  if (type == "code") {
    const highlighter = await shiki.getHighlighter({ theme });
    const fontConfig = FONT_MAPPING[font];

    const svgRenderer = new SvgRenderer({
      ...fontConfig,
      showLineNumber,
      lineNumberForeground: highlighter.getForegroundColor(),
      background: highlighter.getBackgroundColor(),
      radius: border.radius,
    });

    const guessedLanguage = guessLanguage(content, language);
    console.log(content, guessedLanguage);
    const tokens = highlighter.codeToThemedTokens(content, guessedLanguage);
    const { svg } = svgRenderer.renderToSVG(tokens);

    if (imageFormat === "svg") {
      const svgBuffer = Buffer.from(svg);
      return {
        image: svgBuffer,
        format: imageFormat,
        length: svgBuffer.byteLength,
      };
    }

    const codeFrame = sharp(Buffer.from(svg), {
      density: Math.floor(72 * upscale),
    });
    const codeFrameMeta = await codeFrame.metadata();

    const borderThickness = border.thickness;
    const borderColour = border.colour;

    // Convert the SVG to PNG

    codeImage = await sharp({
      create: {
        width: codeFrameMeta.width,
        height: codeFrameMeta.height,
        channels: 4,
        background:
          borderThickness !== 0 ? borderColour : { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: await codeFrame.toBuffer() }])
      .extend({
        left: borderThickness * upscale,
        right: borderThickness * upscale,
        bottom: borderThickness * upscale,
        top: borderThickness * upscale,
        background: borderColour,
      })
      [imageFormat]()
      .toBuffer();
  } else if (type == "text") {
    const width = 640;
    const height = 480;

    const { createCanvas, registerFont } = require("canvas");

    const fontSize = 40; // specify the font size

    // Function to create tspan elements for each line of text
    function createTspanElements(content, fontSize, maxWidth) {
      const words = content.split(" ");
      const lines = [];
      let currentLine = "";

      for (const word of words) {
        const testLine =
          currentLine.length === 0 ? word : `${currentLine} ${word}`;
        const testWidth = measureText(testLine, fontSize);

        if (testWidth <= maxWidth) {
          currentLine = testLine;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }

      lines.push(currentLine);
      return lines;
    }

    // Function to measure the width of text using the canvas library
    function measureText(text, fontSize) {
      const canvas = createCanvas();
      const context = canvas.getContext("2d");
      context.font = `${fontSize}px sans-serif`;
      return context.measureText(text).width;
    }

    // Create tspan elements based on the content
    const lines = createTspanElements(content, fontSize, width - 150);

    // Calculate the vertical center position
    const verticalCenter = height / 2;

    // Calculate the half of the total text height
    const halfTextHeight = (fontSize * lines.length) / 2;

    const imageNo = randomNumber(0, 21);
    const fill = [2, 11, 20].includes(imageNo) ? "#0d0d0d" : "#e3e3e3";
    const gradientImagePath = path.resolve(`./assets/gradients/${imageNo}.jpg`);

    // Generate the SVG with tspan elements
    const svgImage = `
  <svg width="${width}" height="${height}">
    <style>
    .title { fill: ${fill}; font-family: Hack Nerd Font Mono; font-size: ${fontSize}px; font-weight: bold; text-anchor: middle; alignment-baseline: middle; }
    </style>
    <text x="50%" y="${verticalCenter - halfTextHeight}" class="title">
      ${lines
        .map(
          (line, index) =>
            `<tspan x="50%" dy="${index === 0 ? "0" : "1.4em"}">${line}</tspan>`
        )
        .join("")}
    </text>
  </svg>
`;
    const svgBuffer = Buffer.from(svgImage);
    // const gradientImagePath = await generateGradientImage({
    //   imageAbsolutePath: path.resolve(`./assets/images/gradient.png`),
    //   width,
    //   height,
    // });

    // const gradientImageMetadata = await sharp(
    //   await sharp(gradientImagePath).toBuffer()
    // ).metadata();
    // const gradientImageWidth = gradientImageMetadata.width;
    // const gradientImageHeight = gradientImageMetadata.height;

    codeImage = await sharp(gradientImagePath)
      .blur(4)
      .composite([
        {
          input: svgBuffer,
          top: 25,
          left: 0,
        },
      ])
      [imageFormat]()
      .toBuffer();
  }

  return {
    image: codeImage,
    format: imageFormat,
    length: codeImage.byteLength,
  };
}

function randomNumber(min, max) {
  return parseInt(Math.random() * (max - min) + min);
}

module.exports = {
  generateImage,
};
