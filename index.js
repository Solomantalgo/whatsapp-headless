// index.js
const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_FILE_PATH = './session.json';

let browser;
let page;
let isReady = false;

// --- Express Endpoints ---
app.get('/', (req, res) => {
  res.json({
    status: isReady ? 'ready' : 'initializing',
    message: isReady
      ? '✅ WhatsApp headless bot is running!'
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

app.listen(PORT, () => {
  console.log(`🌐 Server listening on port ${PORT}`);
  initializeWhatsApp();
});

// --- WhatsApp Initialization ---
async function initializeWhatsApp() {
  try {
    // Load session
    let session = null;
    try {
      const data = await fs.readFile(SESSION_FILE_PATH, 'utf8');
      session = JSON.parse(data);
      console.log('📂 Session file loaded');
    } catch {
      console.log('📂 No session.json found! Generate locally first.');
      return;
    }

    console.log('🚀 Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
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

    // Set realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Restore session cookies
    if (session && Array.isArray(session) && session.length > 0) {
      await page.setCookie(...session);
      console.log('🔐 Session cookies restored');
    }

    console.log('🌐 Navigating to WhatsApp Web...');
    await page.goto('https://web.whatsapp.com', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait for chat interface
    await page.waitForSelector('[data-testid="chat-list"]', { timeout: 30000 });
    console.log('✅ WhatsApp Web ready!');

    isReady = true;

    // Keep browser alive
    setInterval(async () => {
      if (page && !page.isClosed()) {
        try {
          await page.evaluate(() => document.title);
        } catch {
          console.log('❌ Page closed, reinitializing...');
          isReady = false;
          initializeWhatsApp();
        }
      }
    }, 60000);

  } catch (err) {
    console.error('❌ Error initializing WhatsApp:', err.message);
    isReady = false;
  }
}

// --- Graceful Shutdown ---
process.on('SIGTERM', async () => {
  console.log('📴 Shutting down...');
  if (browser) await browser.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📴 Shutting down...');
  if (browser) await browser.close();
  process.exit(0);
});
