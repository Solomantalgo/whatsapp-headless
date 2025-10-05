const puppeteer = require('puppeteer');
const fs = require('fs').promises;

const SESSION_FILE_PATH = './session.json';

console.log('🚀 WhatsApp Session Generator');
console.log('================================\n');

(async () => {
  let browser;
  
  try {
    console.log('📱 Launching browser...');
    browser = await puppeteer.launch({
      headless: false, // Show browser window
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Set viewport for better QR visibility
    await page.setViewport({ width: 1280, height: 800 });

    console.log('🌐 Navigating to WhatsApp Web...');
    await page.goto('https://web.whatsapp.com', { 
      waitUntil: 'networkidle2' 
    });

    console.log('⏳ Waiting for QR code...\n');

    // Try to detect QR code
    try {
      await page.waitForSelector('canvas', { timeout: 10000 });
      console.log('📱 QR Code appeared! Scan it with your phone.');
      console.log('   Open WhatsApp → Settings → Linked Devices → Link a Device\n');
    } catch (err) {
      console.log('📱 QR Code should appear in the browser window');
      console.log('   Please scan it with WhatsApp on your phone\n');
    }

    // Wait for successful login (try multiple selectors)
    console.log('⏳ Waiting for you to scan the QR code...');
    
    const loginSuccess = await Promise.race([
      page.waitForSelector('[data-testid="chat-list"]', { timeout: 120000 }).then(() => 'chat-list'),
      page.waitForSelector('#side', { timeout: 120000 }).then(() => 'side'),
      page.waitForSelector('[data-testid="conversation-panel-wrapper"]', { timeout: 120000 }).then(() => 'conversation'),
      page.waitForFunction(() => {
        return document.querySelector('canvas') === null;
      }, { timeout: 120000 }).then(() => 'qr-gone')
    ]).catch(err => null);

    if (!loginSuccess) {
      throw new Error('Login timeout - QR code was not scanned in time');
    }

    console.log(`✅ Successfully logged in! (detected via: ${loginSuccess})\n`);

    // Wait a bit for session to stabilize
    console.log('⏳ Waiting for session to stabilize...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Save session cookies
    console.log('📥 Extracting cookies...');
    const cookies = await page.cookies();
    console.log(`   Found ${cookies.length} cookies`);
    
    console.log('💾 Saving to session.json...');
    const sessionData = JSON.stringify(cookies, null, 2);
    await fs.writeFile(SESSION_FILE_PATH, sessionData);
    
    // Verify file was written
    const fileStats = await fs.stat(SESSION_FILE_PATH);
    console.log('✅ Session saved successfully!');
    console.log(`   File: ${SESSION_FILE_PATH}`);
    console.log(`   Size: ${(fileStats.size / 1024).toFixed(2)} KB`);
    console.log(`   Cookies: ${cookies.length}\n`);

    console.log('✅ Setup complete! You can now:');
    console.log('   1. Commit session.json to your repository');
    console.log('   2. Deploy to Render');
    console.log('   3. Your bot will use this session automatically\n');

    console.log('⚠️  Important: Keep session.json private!');
    console.log('   Add it to .gitignore if it contains sensitive data\n');

    // Keep browser open for a few seconds
    console.log('Closing browser in 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 100000));

    await browser.close();
    console.log('👋 Done!');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    
    if (err.message.includes('timeout')) {
      console.log('\n⏰ Timeout: QR code was not scanned in time');
      console.log('   Run the script again and scan faster\n');
    }

    if (browser) {
      await browser.close();
    }
    process.exit(1);
  }
})();

// Handle interruption
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Setup interrupted by user');
  process.exit(1);
});