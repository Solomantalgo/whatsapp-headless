const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_FILE_PATH = './session.json';

(async () => {
  try {
    // Load saved session if available
    let session = null;
    if (fs.existsSync(SESSION_FILE_PATH)) {
      session = JSON.parse(fs.readFileSync(SESSION_FILE_PATH));
    }

    const browser = await puppeteer.launch({
      headless: true, // must be true on Render
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-zygote',
        '--single-process'
      ]
    });

    const page = await browser.newPage();

    if (session) {
      await page.setCookie(...session);
    }

    await page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle2' });

    // Wait for QR code or chat interface to appear
    await page.waitForSelector('canvas, [data-testid="chat-list-search"]', { timeout: 0 });

    // Save session cookies
    const cookies = await page.cookies();
    fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(cookies));

    console.log('✅ WhatsApp Web is ready and session saved!');
  } catch (err) {
    console.error('❌ Error launching Puppeteer:', err);
  }
})();

// Simple Express server to keep Render alive
app.get('/', (req, res) => {
  res.send('✅ WhatsApp headless bot is running successfully!');
});

app.listen(PORT, () => {
  console.log(`🌐 Server listening on port ${PORT}`);
});
