const flourite = require("flourite");
const sharp = require("sharp");
const shiki = require("shiki");
const { SvgRenderer } = require("./svg-renderer");
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
  code,
  language,
  border,
  imageFormat,
  upscale,
  theme,
  font,
  showLineNumber,
  windowBackgroundColor,
}) {
  const highlighter = await shiki.getHighlighter({ theme });
  const fontConfig = FONT_MAPPING[font];

  const svgRenderer = new SvgRenderer({
    ...fontConfig,
    showLineNumber,
    lineNumberForeground: highlighter.getForegroundColor(),
    background: windowBackgroundColor || highlighter.getBackgroundColor(),
    radius: border.radius,
  });

  const guessedLanguage = guessLanguage(code, language);
  const tokens = highlighter.codeToThemedTokens(code, guessedLanguage);
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

  const codeImage = await sharp({
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

  return {
    image: codeImage,
    format: imageFormat,
    length: codeImage.byteLength,
  };
}

module.exports = {
  generateImage,
};
