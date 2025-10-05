// index.js
const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_FILE_PATH = './session.json';

let browser = null;
let page = null;
let isReady = false;

// Express endpoints
app.get('/', (req, res) => {
  res.json({
    status: isReady ? 'ready' : 'initializing',
    message: isReady
      ? '✅ WhatsApp headless bot is running successfully!'
      : '⏳ Bot is initializing...'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    whatsappReady: isReady,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🌐 Server listening on port ${PORT}`);
  initializeWhatsApp();
});

async function initializeWhatsApp() {
  try {
    // Load session if available
    let session = null;
    try {
      const data = await fs.readFile(SESSION_FILE_PATH, 'utf8');
      session = JSON.parse(data);
      console.log('📂 Session file loaded');
    } catch {
      console.log('📂 No session found. You need a pre-generated session for headless login.');
    }

    console.log('🚀 Launching browser...');
    browser = await puppeteer.launch({
      headless: true, // MUST be true on Render
      executablePath: puppeteer.executablePath(), // Use bundled Chromium
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions'
      ]
    });

    page = await browser.newPage();

    // Restore session if available
    if (session && Array.isArray(session) && session.length > 0) {
      console.log('🔐 Restoring session cookies...');
      await page.setCookie(...session);
    }

    console.log('🌐 Navigating to WhatsApp Web...');
    await page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle2', timeout: 60000 });

    // Check if session is valid
    const chatSelector = '[data-testid="chat-list"]';
    const qrSelector = 'canvas';
    let selector = null;

    try {
      selector = await Promise.race([
        page.waitForSelector(chatSelector, { timeout: 15000 }).then(() => 'chat'),
        page.waitForSelector(qrSelector, { timeout: 15000 }).then(() => 'qr')
      ]);
    } catch {}

    if (selector === 'chat') {
      console.log('✅ Session restored - logged in!');
    } else if (selector === 'qr') {
      console.log('📱 QR code detected! Headless server cannot scan QR, generate session locally first.');
      throw new Error('Cannot scan QR code in headless server.');
    } else {
      throw new Error('❌ Could not detect WhatsApp interface.');
    }

    // Save session cookies
    const cookies = await page.cookies();
    await fs.writeFile(SESSION_FILE_PATH, JSON.stringify(cookies, null, 2));
    console.log('💾 Session saved to', SESSION_FILE_PATH);

    isReady = true;
    console.log('✅ WhatsApp Web is ready!');

    // Keep browser alive
    setInterval(async () => {
      if (page && !page.isClosed()) {
        try {
          await page.evaluate(() => document.title);
          console.log('💓 Keep-alive ping');
        } catch {
          console.error('❌ Page closed, reinitializing...');
          isReady = false;
          initializeWhatsApp();
        }
      }
    }, 60000);

  } catch (err) {
    console.error('❌ Error initializing WhatsApp:', err.message);
    isReady = false;
    console.log('🔄 Retrying in 30 seconds...');
    setTimeout(initializeWhatsApp, 30000);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (browser) await browser.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  if (browser) await browser.close();
  process.exit(0);
});
