const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_FILE_PATH = './session.json';

let browser = null;
let page = null;
let isReady = false;

// Start Express server first
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

app.listen(PORT, () => {
  console.log(`🌐 Server listening on port ${PORT}`);
  initializeWhatsApp();
});

async function initializeWhatsApp() {
  try {
    // Load saved session if available
    let session = null;
    try {
      const sessionData = await fs.readFile(SESSION_FILE_PATH, 'utf8');
      session = JSON.parse(sessionData);
      console.log('📂 Session file loaded');
    } catch (err) {
      console.log('📂 No existing session found, will need to scan QR code');
    }

    console.log('🚀 Launching browser...');
    
    // Try to find Chrome executable
    let executablePath;
    try {
      executablePath = puppeteer.executablePath();
      console.log('📍 Chrome path:', executablePath);
    } catch (err) {
      console.log('⚠️  Could not auto-detect Chrome, using default path');
      executablePath = '/opt/render/.cache/puppeteer/chrome/linux-141.0.7390.54/chrome-linux64/chrome';
    }
    
    browser = await puppeteer.launch({
      headless: true,
      executablePath: executablePath,
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
    
    // Set a realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Restore session if available
    if (session && Array.isArray(session) && session.length > 0) {
      console.log('🔐 Restoring session cookies...');
      await page.setCookie(...session);
    }

    console.log('🌐 Navigating to WhatsApp Web...');
    await page.goto('https://web.whatsapp.com', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });

    // Wait for either QR code or chat interface
    console.log('⏳ Waiting for WhatsApp to load...');
    const selector = await Promise.race([
      page.waitForSelector('canvas', { timeout: 30000 }).then(() => 'qr'),
      page.waitForSelector('[data-testid="chat-list"]', { timeout: 30000 }).then(() => 'chat')
    ]).catch(() => null);

    if (selector === 'qr') {
      console.log('📱 QR Code detected - manual scan required');
      console.log('⚠️  Note: You need to scan the QR code, but this is difficult in a headless server environment');
      console.log('💡 Consider using a local setup first to generate session, then deploy');
      
      // Wait for successful login
      await page.waitForSelector('[data-testid="chat-list"]', { timeout: 120000 });
      console.log('✅ QR Code scanned successfully!');
    } else if (selector === 'chat') {
      console.log('✅ Session restored - already logged in!');
    } else {
      throw new Error('Could not detect QR code or chat interface');
    }

    // Save session cookies
    const cookies = await page.cookies();
    await fs.writeFile(SESSION_FILE_PATH, JSON.stringify(cookies, null, 2));
    console.log('💾 Session saved to', SESSION_FILE_PATH);

    isReady = true;
    console.log('✅ WhatsApp Web is ready!');

    // Keep the page alive
    keepAlive();

  } catch (err) {
    console.error('❌ Error initializing WhatsApp:', err.message);
    isReady = false;
    
    // Retry after delay
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
      } catch (err) {
        console.error('❌ Page closed, reinitializing...');
        isReady = false;
        initializeWhatsApp();
      }
    }
  }, 60000); // Every minute
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📴 Shutting down gracefully...');
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📴 Shutting down gracefully...');
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});