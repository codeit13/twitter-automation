const Jimp = require("jimp");
const path = require("path");

// const { fileURLToPath } = require("url");

const { getRandomInt, clamp } = require("./utils.js");
const { filters } = require("./filters.js");

// Constant saturation in 0-1 range (false to disable)
const saturationPredefined = false;

// Generation mode
// 'normal' uses filters set to true in filtersToUse
// 'random' uses randomly selected filters for each image (50% chance for each filter)
// 'test' only uses the test filter
const genMode = "normal";

const filtersToUse = {
  test: false,
  circles: true,
  swirl: false,
  sinlines: true,
  coslines: true,
  gradient: false,
  tangrad: true,
  fuzzy: true,
  powremain: false,
  powsubtract: false,
};

async function generateGradientImage({
  imageAbsolutePath,
  width: x,
  height: y,
  iterationsCount = 10,
}) {
  return new Promise((resolve, reject) => {
    try {
      const usableFilters = [];

      switch (genMode) {
        case "normal":
          for (const [filterName, isEnabled] of Object.entries(filtersToUse)) {
            if (isEnabled) {
              usableFilters.push(filterName);
            }
          }

          break;
        case "random":
          for (const filterName of Object.keys(filtersToUse)) {
            // 50% chance to select any given filter
            if (getRandomInt(0, 1)) {
              usableFilters.push(filterName);
            }
          }

          break;
        case "test":
          usableFilters.push("test");

          break;
      }

      const image = new Jimp(x, y);

      let again = 0;
      let randPtX = 0;
      let randPtY = 0;

      for (let iter = 1; iter <= iterationsCount; iter++) {
        // 50% chance for the next iteration base point to be close to the current one
        // Creates interesting overlapping patterns
        if (!again) {
          randPtX = getRandomInt(-x, x * 2);
          randPtY = getRandomInt(-y, y * 2);
        } else if (getRandomInt(0, 1)) {
          randPtX += getRandomInt(-x / 10, x / 10);
          randPtY += getRandomInt(-y / 10, y / 10);
        }

        again = getRandomInt(0, 1);

        const radius = getRandomInt(0, Math.max(x, y) / 2);

        // Randomly select a filter among all currently used
        const selectedFilter =
          usableFilters[Math.floor(Math.random() * usableFilters.length)];

        // Apply the filter
        if (selectedFilter in filters) {
          filters[selectedFilter](image, randPtX, randPtY, radius, x, y);
        } else {
          throw new Error(`Filter ${selectedFilter} not defined`);
        }

        // Make sure the image is fully opaque before the next iteration
        image.scan(
          0,
          0,
          image.bitmap.width,
          image.bitmap.height,
          function (x, y, idx) {
            image.bitmap.data[idx + 3] = 255;
          }
        );

        // Save intermediate iterations if needed
        // if (saveAllIterations && iter !== iterationsCount) {
        //   image.write(`${outputPathRel}/${imageName}_iter${iter}.png`);
        // }
      }

      const saturation =
        typeof saturationPredefined === "number"
          ? saturationPredefined
          : Math.random();

      // Apply saturation
      image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
        const max = Math.max(
          image.bitmap.data[idx + 0],
          image.bitmap.data[idx + 1],
          image.bitmap.data[idx + 2]
        );

        for (let i = 0; i < 3; i++) {
          image.bitmap.data[idx + i] +=
            Math.abs(max - image.bitmap.data[idx + i]) *
            Math.abs(1 - saturation);
          image.bitmap.data[idx + i] = clamp(
            image.bitmap.data[idx + i],
            0,
            255
          );
        }
      });

      image.writeAsync(imageAbsolutePath).then(() => {
        resolve(imageAbsolutePath);
      });
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateGradientImage,
};
