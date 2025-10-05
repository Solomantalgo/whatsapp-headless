const puppeteer = require('puppeteer-core');
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

async function initializeWhatsApp() {
  try {
    // Load session if available
    let session = null;
    try {
      const data = await fs.readFile(SESSION_FILE_PATH, 'utf8');
      session = JSON.parse(data);
      console.log('📂 Session file loaded');
    } catch {
      console.log('📂 No session file found. Deploy with pre-generated session.json!');
    }

    console.log('🚀 Launching Puppeteer with system Chrome...');
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/usr/bin/google-chrome',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
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

    // Detect QR or chat interface
    const selector = await Promise.race([
      page.waitForSelector('canvas', { timeout: 10000 }).then(() => 'qr'),
      page.waitForSelector('[data-testid="chat-list"]', { timeout: 10000 }).then(() => 'chat')
    ]).catch(() => null);

    if (selector === 'qr') {
      throw new Error('📱 QR code detected! Cannot scan on Render. Use pre-generated session.json.');
    } else if (selector === 'chat') {
      console.log('✅ Session restored - logged in!');
    } else {
      throw new Error('❌ Could not detect QR or chat interface.');
    }

    // Save session cookies (optional)
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
