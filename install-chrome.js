// install-chrome.js
const puppeteer = require('puppeteer');

(async () => {
  try {
    console.log('Installing Chrome...');
    await puppeteer.createBrowserFetcher().download('chrome');
    console.log('✅ Chrome installed successfully.');
  } catch (err) {
    console.error('❌ Failed to install Chrome:', err);
  }
})();
