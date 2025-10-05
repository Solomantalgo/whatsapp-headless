const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_FILE_PATH = path.resolve(__dirname, 'session.json');

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

// Start server and initialize WhatsApp
app.listen(PORT, () => {
  console.log(`🌐 Server listening on port ${PORT}`);
  initializeWhatsApp();
});

async function initializeWhatsApp() {
  try {
    let session = null;

    // Load session if exists
    try {
      const data = await fs.readFile(SESSION_FILE_PATH, 'utf8');
      session = JSON.parse(data);
      console.log('📂 Session file loaded');
    } catch {
      console.log('📂 No session found. Use a pre-generated session.json');
    }

    console.log('🚀 Launching Puppeteer browser...');
    browser = await puppeteer.launch({
      headless: true, // Must be true for Render
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
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Restore session cookies
    if (session && Array.isArray(session) && session.length > 0) {
      console.log('🔐 Restoring session cookies...');
      await page.setCookie(...session);
    }

    console.log('🌐 Navigating to WhatsApp Web...');
    await page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle2', timeout: 60000 });

    // Check if logged in
    const selector = await Promise.race([
      page.waitForSelector('canvas', { timeout: 10000 }).then(() => 'qr'),
      page.waitForSelector('[data-testid="chat-list"]', { timeout: 10000 }).then(() => 'chat')
    ]).catch(() => null);

    if (selector === 'qr') {
      throw new Error('📱 QR code detected! Cannot scan on headless server. Generate session locally.');
    } else if (selector === 'chat') {
      console.log('✅ Session restored - logged in!');
    } else {
      throw new Error('❌ Could not detect QR or chat interface.');
    }

    // Save session cookies (optional)
    const cookies = await page.cookies();
    await fs.writeFile(SESSION_FILE_PATH, JSON.stringify(cookies, null, 2));
    console.log('💾 Session saved to', SESSION_FILE_PATH);

    isReady = true;
    console.log('✅ WhatsApp Web is ready!');

    // Keep browser alive
    keepAlive();

  } catch (err) {
    console.error('❌ Error initializing WhatsApp:', err.message);
    isReady = false;
    console.log('🔄 Retrying in 30 seconds...');
    setTimeout(initializeWhatsApp, 30000);
  }
}

// Keep connection alive
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

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📴 Shutting down gracefully...');
  if (browser) await browser.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📴 Shutting down gracefully...');
  if (browser) await browser.close();
  process.exit(0);
});
