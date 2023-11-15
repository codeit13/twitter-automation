const puppeteer = require("puppeteer");

async function getImagesFromLexica(query) {
  const apiUrl = "https://lexica.art/api/infinite-prompts";
  return new Promise(async (resolve, reject) => {
    try {
      // Launch Puppeteer with the new headless mode
      const browser = await puppeteer.launch({
        headless: "new",
      });
      const page = await browser.newPage();
      // Navigate to the specified URL
      await page.goto("https://lexica.art", { waitUntil: "domcontentloaded" });

      // Execute the API call in the console once the page has loaded
      const response = await page.evaluate(
        async (apiUrl, query) => {
          // Make the fetch call in the console
          try {
            const response = await fetch(apiUrl, {
              headers: {
                accept: "application/json, text/plain, */*",
                "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
                "content-type": "application/json",
                "sec-ch-ua":
                  '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Linux"',
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
              },
              referrer: `https://lexica.art/?q=${encodeURIComponent(query)}`,
              referrerPolicy: "strict-origin-when-cross-origin",
              body: JSON.stringify({
                text: query,
                searchMode: "images",
                source: "search",
                cursor: 0,
                model: "lexica-aperture-v3.5",
              }),
              method: "POST",
              mode: "cors",
              credentials: "include",
            });

            return await response.json();
          } catch (error) {
            return reject({ error: error.message });
          }
        },
        apiUrl,
        query
      );

      await browser.close();

      // Output the response in your Node.js code
      resolve(response);
    } catch (error) {
      console.log(error);
      reject("Error in lexica image search: ", error);
    }
  });
}

module.exports = { getImagesFromLexica };
