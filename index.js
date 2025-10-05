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
      console.log('📂 No session file found, login required');
    }

    console.log('🚀 Launching Puppeteer...');
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
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

    // Detect QR code or chat
    const selector = await Promise.race([
      page.waitForSelector('canvas', { timeout: 15000 }).then(() => 'qr'),
      page.waitForSelector('[data-testid="chat-list"]', { timeout: 15000 }).then(() => 'chat')
    ]).catch(() => null);

    if (selector === 'qr') {
      throw new Error('📱 QR code detected! Cannot scan in headless Docker.');
    } else if (selector === 'chat') {
      console.log('✅ Session restored - logged in!');
    } else {
      throw new Error('❌ Could not detect QR or chat interface.');
    }

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
