const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

let client;
let qrCodeData = null;
let isReady = false;
let clientInfo = null;

// Initialize WhatsApp Client with persistent session
client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './whatsapp-session'
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable'
    }
});

// QR Code event - generate QR for scanning
client.on('qr', async (qr) => {
    console.log('📱 QR Code received! Scan with your phone.');
    qrCodeData = qr;
    
    // Generate QR code image
    try {
        qrCodeData = await qrcode.toDataURL(qr);
        console.log('✅ QR Code ready! Visit /qr to see it');
    } catch (err) {
        console.error('❌ Error generating QR code:', err);
    }
});

// Ready event - client is authenticated and ready
client.on('ready', () => {
    console.log('✅ WhatsApp Client is ready!');
    isReady = true;
    qrCodeData = null;
    
    clientInfo = {
        number: client.info.wid.user,
        name: client.info.pushname,
        platform: client.info.platform
    };
    
    console.log('📱 Logged in as:', clientInfo.name);
});

// Authentication success
client.on('authenticated', () => {
    console.log('🔐 Authentication successful!');
    qrCodeData = null;
});

// Authentication failure
client.on('auth_failure', (msg) => {
    console.error('❌ Authentication failed:', msg);
    qrCodeData = null;
});

// Disconnected event
client.on('disconnected', (reason) => {
    console.log('📴 Client disconnected:', reason);
    isReady = false;
    clientInfo = null;
});

// Message event - respond to incoming messages
client.on('message', async (message) => {
    console.log('📨 Message from', message.from, ':', message.body);
    
    // Example: Auto-reply to specific commands
    if (message.body.toLowerCase() === '!ping') {
        await message.reply('🏓 Pong!');
    }
    
    if (message.body.toLowerCase() === '!info') {
        const chat = await message.getChat();
        await message.reply(`Chat name: ${chat.name}\nIs group: ${chat.isGroup}`);
    }
    
    if (message.body.toLowerCase() === '!help') {
        await message.reply(
            '🤖 *Available Commands:*\n\n' +
            '!ping - Check if bot is alive\n' +
            '!info - Get chat information\n' +
            '!help - Show this help message'
        );
    }
});

// Initialize client
console.log('🚀 Starting WhatsApp Client...');
client.initialize();

// Express Routes
app.get('/', (req, res) => {
    if (!isReady && qrCodeData) {
        res.send(`
            <html>
                <head><title>WhatsApp Bot - Scan QR</title></head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>📱 Scan QR Code with WhatsApp</h1>
                    <p>Open WhatsApp → Settings → Linked Devices → Link a Device</p>
                    <img src="${qrCodeData}" alt="QR Code" style="max-width: 400px; margin: 20px;"/>
                    <p><a href="/">Refresh</a> to check status</p>
                </body>
            </html>
        `);
    } else if (isReady) {
        res.json({
            status: 'ready',
            message: '✅ WhatsApp bot is running!',
            client: clientInfo
        });
    } else {
        res.json({
            status: 'initializing',
            message: '⏳ Bot is initializing... Refresh in a few seconds.'
        });
    }
});

app.get('/qr', (req, res) => {
    if (qrCodeData) {
        res.send(`
            <html>
                <head>
                    <title>Scan QR Code</title>
                    <meta http-equiv="refresh" content="10">
                </head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>📱 Scan this QR Code</h1>
                    <img src="${qrCodeData}" alt="QR Code" style="max-width: 400px;"/>
                    <p>Page auto-refreshes every 10 seconds</p>
                </body>
            </html>
        `);
    } else if (isReady) {
        res.send('<h1>✅ Already connected!</h1><a href="/">Go to status page</a>');
    } else {
        res.send('<h1>⏳ Loading QR code...</h1><p>Refresh in a few seconds</p>');
    }
});

app.get('/status', (req, res) => {
    res.json({
        ready: isReady,
        hasQR: !!qrCodeData,
        client: clientInfo
    });
});

// Send message endpoint (example)
app.get('/send', async (req, res) => {
    if (!isReady) {
        return res.json({ error: 'Client not ready' });
    }
    
    const { number, message } = req.query;
    if (!number || !message) {
        return res.json({ error: 'Missing number or message parameter' });
    }
    
    try {
        const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
        await client.sendMessage(chatId, message);
        res.json({ success: true, message: 'Message sent!' });
    } catch (err) {
        res.json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`🌐 Server listening on port ${PORT}`);
});