const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_FILE_PATH = path.join(__dirname, 'session.json');

let browser = null;
let page = null;
let isReady = false;

// --- Express endpoints ---
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

// --- Start server ---
app.listen(PORT, () => {
  console.log(`🌐 Server listening on port ${PORT}`);
  initializeWhatsApp();
});

// --- Initialize WhatsApp ---
async function initializeWhatsApp() {
  try {
    // Load session if exists
    let session = null;
    try {
      const data = await fs.readFile(SESSION_FILE_PATH, 'utf8');
      session = JSON.parse(data);
      console.log('📂 Session file loaded');
    } catch {
      console.error('📂 No session file found. You must provide a valid session.json');
      throw new Error('Session file missing in Docker container');
    }

    console.log('🚀 Launching Puppeteer...');
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--no-first-run',
        '--no-zygote'
      ]
    });

    page = await browser.newPage();

    // Restore session cookies
    if (session && Array.isArray(session) && session.length > 0) {
      console.log('🔐 Restoring session cookies...');
      await page.setCookie(...session);
    }

    console.log('🌐 Navigating to WhatsApp Web...');
    await page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle2', timeout: 60000 });

    // Detect chat interface
    const chatDetected = await page.waitForSelector('[data-testid="chat-list"]', { timeout: 30000 }).catch(() => null);
    if (!chatDetected) throw new Error('❌ Could not detect chat interface. Session may be invalid.');

    console.log('✅ Session restored - logged in!');

    // Save session cookies
    const cookies = await page.cookies();
    await fs.writeFile(SESSION_FILE_PATH, JSON.stringify(cookies, null, 2));
    console.log('💾 Session saved');

    isReady = true;
    console.log('✅ WhatsApp Web is ready!');

    // Keep browser alive
    keepAlive();

  } catch (err) {
    console.error('❌ Error initializing WhatsApp:', err.message);
    isReady = false;
    setTimeout(initializeWhatsApp, 30000);
  }
}

// --- Keep browser alive ---
function keepAlive() {
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
}

// --- Graceful shutdown ---
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
