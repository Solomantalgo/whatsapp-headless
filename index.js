const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_FILE_PATH = './session.json';

(async () => {
    // Load saved session if available
    let session = null;
    if (fs.existsSync(SESSION_FILE_PATH)) {
        session = JSON.parse(fs.readFileSync(SESSION_FILE_PATH));
    }

    const browser = await puppeteer.launch({
        headless: false, // Must be false for WhatsApp Web login
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    if (session) {
        await page.setCookie(...session);
    }

    await page.goto('https://web.whatsapp.com');

    // Wait for QR scan or logged in
    await page.waitForSelector('canvas, [data-testid="chat-list-search"]', {timeout: 0});

    // Save session cookies
    const cookies = await page.cookies();
    fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(cookies));

    console.log('WhatsApp Web is ready and session saved!');
})();

// Minimal Express server to bind port
app.get('/', (req, res) => {
    res.send('WhatsApp headless bot running!');
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
