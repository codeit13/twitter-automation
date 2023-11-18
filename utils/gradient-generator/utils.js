function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max + 1 - min)) + min;
}

function getRandomColor(maxAlpha) {
  // // Set a fixed saturation and lightness for aesthetic colors
  // const saturation = getRandomInt(40, 60); // Adjust as needed
  // const lightness = getRandomInt(40, 60); // Adjust as needed

  // // Generate a random hue
  // const hue = getRandomInt(200, 270);

  // return [
  //   hslToRgb(hue / 360, saturation / 100, lightness / 100),
  //   getRandomInt(0, maxAlpha),
  // ];
  return [
    getRandomInt(0, 255),
    getRandomInt(0, 255),
    getRandomInt(0, 255),
    getRandomInt(0, maxAlpha),
  ];
}

function dist(ptA, ptB) {
  return Math.hypot(ptA[0] - ptB[0], ptA[1] - ptB[1]);
}

function clamp(x, min, max) {
  return Math.max(Math.min(x, max), min);
}

// Convert HSL to RGB
function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

module.exports = {
  getRandomInt,
  getRandomColor,
  dist,
  clamp,
};
