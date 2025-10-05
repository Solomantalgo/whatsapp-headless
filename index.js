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
      ? '✅ WhatsApp bot running!'
      : '⏳ Bot initializing...'
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
    // Load saved session
    let session = null;
    try {
      const data = await fs.readFile(SESSION_FILE_PATH, 'utf8');
      session = JSON.parse(data);
      console.log('📂 Session file loaded');
    } catch {
      console.log('📂 No session found, deploy with pre-generated session.json');
    }

    console.log('🚀 Launching Puppeteer...');
    browser = await puppeteer.launch({
      headless: true,
      executablePath: puppeteer.executablePath(), // Auto-detect Chromium
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    page = await browser.newPage();

    if (session && Array.isArray(session) && session.length > 0) {
      console.log('🔐 Restoring session cookies...');
      await page.setCookie(...session);
    }

    console.log('🌐 Navigating to WhatsApp Web...');
    await page.goto('https://web.whatsapp.com', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Check if QR code or chat interface
    const selector = await Promise.race([
      page.waitForSelector('canvas', { timeout: 10000 }).then(() => 'qr'),
      page.waitForSelector('[data-testid="chat-list"]', { timeout: 10000 }).then(() => 'chat')
    ]).catch(() => null);

    if (selector === 'qr') {
      throw new Error('📱 QR code detected! Cannot scan in headless server.');
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

  } catch (err) {
    console.error('❌ Error initializing WhatsApp:', err.message);
    isReady = false;
    console.log('🔄 Retrying in 30 seconds...');
    setTimeout(initializeWhatsApp, 30000);
  }
}

