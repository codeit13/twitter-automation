const flourite = require("flourite");
const sharp = require("sharp");
const path = require("path");
const temp = require("temp").track();
const fs = require("fs");
const axios = require("axios");
const shiki = require("shiki");
const Vibrant = require("node-vibrant");
const { SvgRenderer } = require("./svg-renderer");
const { generateGradientImage } = require("./gradient-generator/index");
const { getImagesFromLexica } = require("./lexica");

const FONT_MAPPING = {
  hack: {
    fontFamily: "Hack Nerd Font Mono",
    lineHeightToFontSizeRatio: 1.7,
    fontSize: 18,
    fontWidth: 10.5,
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
    const { count, images } = await getImagesFromLexica(
      "coding developer aesthetics"
    );

    let gradientImagePath = await downloadImage(
      images[randomNumber(0, count - 1)].url
    );

    let image = sharp(gradientImagePath);
    let metadata = await image.metadata();

    // Determine the size for the square crop
    const size = Math.min(metadata.width, metadata.height);

    // Calculate the center coordinates for the crop
    const left = Math.max(0, Math.floor((metadata.width - size) / 2));
    const top = Math.max(0, Math.floor((metadata.height - size) / 2));

    // Perform the crop
    const croppedImageFilePath = path.resolve(
      `./assets/images/temp_cropped.png`
    );
    await image
      .extract({ left, top, width: size, height: size })
      .toFile(croppedImageFilePath);

    image = sharp(croppedImageFilePath);
    metadata = await image.metadata();

    const width = metadata.width;
    const height = metadata.height;

    const { createCanvas, registerFont } = require("canvas");

    const fontSize = 50; // specify the font size

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
    const lines = createTspanElements(
      content,
      fontSize,
      width - (width > 750 ? 300 + (width - 750) : 300)
    );

    // Calculate the vertical center position
    const verticalCenter = height / 2;

    // Calculate the half of the total text height
    const halfTextHeight = (fontSize * lines.length * 1.5) / 2;

    const extractedColors = await identifyTextColors(
      croppedImageFilePath,
      width,
      height,
      halfTextHeight
    );

    // const imageNo = randomNumber(0, 18);
    // const fill = [2, 11, 18].includes(imageNo) ? "#0d0d0d" : "#e3e3e3";
    const fill = extractedColors.text.map(Math.round).join(", ");
    const strokeColor = fill == "0, 0, 0" ? "#ffffff" : "#000000";
    // const gradientImagePath = path.resolve(`./assets/gradients/${imageNo}.jpg`);

    // console.log("width: ", width, " height: ", height);

    // Generate the SVG with tspan elements
    const svgImage = `
  <svg width="${width}" height="${height}">
    <style>
      .title {
        fill: rgb(${fill});
        font-family: DK Mandarin Whispers;
        letter-spacing: 14px;
        font-size: ${fontSize}px;
        font-weight: bolder;
        text-anchor: middle;
        alignment-baseline: middle;

        paint-order: stroke;
        stroke: ${strokeColor};
        stroke-width: 5px;
        stroke-linecap: butt;
        stroke-linejoin: miter;
      }
    </style>
    <text x="50%" y="${verticalCenter - halfTextHeight}" class="title" >
      ${lines
        .map(
          (line, index) =>
            `<tspan x="50%" dy="${index == 0 ? 0 : 2}em">${line}</tspan>`
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
    codeImage = await sharp(croppedImageFilePath)
      .blur(6)
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

const downloadImage = async (url) => {
  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });

    // Determine file extension based on content type
    const contentType = response.headers["content-type"];
    // const extension = contentType.includes("jpeg") ? "jpg" : "png";

    // const tempFilePath = temp.path({ suffix: `.${extension}` });

    const tempPath = path.resolve(`./assets/images/temp.png`);

    fs.writeFileSync(tempPath, response.data);

    return tempPath;
  } catch (error) {
    throw new Error(`Error downloading image: ${error.message}`);
  }
};

async function identifyTextColors(imagePath, width, height, halfTextHeight) {
  try {
    // Use Sharp to resize the image for faster processing (optional)
    const resizedImagePath = path.resolve("./assets/images/resized_image.png");
    await sharp(imagePath)
      .extract({
        left: parseInt(width / 4),
        top: parseInt(height / 4),
        width: parseInt(width / 1.5),
        height: parseInt(height / 1.5),
      })
      .toFile(resizedImagePath);

    // Create a Vibrant object from the image
    const vibrant = await Vibrant.from(resizedImagePath).getPalette();

    // Extract the color values
    const colors = Object.keys(vibrant).map((key) => {
      const swatch = vibrant[key];
      return {
        name: key,
        rgb: swatch.getRgb(),
        population: swatch.getPopulation(),
      };
    });

    // Identify suitable text colors based on the background colors
    const textColors = colors.map((color) => {
      // console.log("color.rgb: ", color.rgb);
      const textColor = getContrastColor(color.rgb);
      return {
        background: color.rgb,
        text: textColor,
      };
    });

    // Cleanup: Delete the resized image file
    // fs.unlinkSync(resizedImagePath);

    const color = textColors.reduce((prev, current) => {
      const prevContrast = getContrast(prev.background, prev.text);
      const currentContrast = getContrast(current.background, current.text);
      return currentContrast < prevContrast ? current : prev;
    }, textColors[0]);

    return color;
  } catch (error) {
    console.error("Error identifying text colors:", error.message);
    throw error;
  }
}

// Helper function to determine the contrasting text color
function getContrastColor(rgb) {
  const luminance = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  const threshold = luminance / 255; // Normalize luminance to [0, 1]

  // Interpolate between black and white based on luminance
  const interpolatedColor = threshold > 0.5 ? 0 : 255;

  return [interpolatedColor, interpolatedColor, interpolatedColor];
}

// Helper function to calculate contrast between two colors
function getContrast(color1, color2) {
  const luminance1 = calculateRelativeLuminance(color1);
  const luminance2 = calculateRelativeLuminance(color2);

  const brighter = Math.max(luminance1, luminance2);
  const darker = Math.min(luminance1, luminance2);

  return (brighter + 0.05) / (darker + 0.05);
}

function calculateRelativeLuminance(color) {
  const gammaCorrected = color.map((value) => {
    value /= 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });

  return (
    0.2126 * gammaCorrected[0] +
    0.7152 * gammaCorrected[1] +
    0.0722 * gammaCorrected[2]
  );
}

module.exports = {
  generateImage,
};
