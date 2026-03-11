const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const fs = require('fs');

// --- ANTI-CRASH SYSTEM ---
process.on('unhandledRejection', (reason, promise) => {
    console.log('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.log('⚠️ Uncaught Exception:', err);
});

// Check for token before even trying to start
if (!process.env.TOKEN) {
    console.error("❌ ERROR: No TOKEN found in Railway Variables!");
    process.exit(1); 
}

// --- DISCORD SETUP ---
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent 
    ] 
});

const PORT = process.env.PORT || 3000;
const DATA_FILE = './data.json';
const ALLOWED_CHANNEL_ID = '1480531258516963519';

// --- DATABASE LOGIC ---
let db = { stock: [], blacklist: [], claimHistory: [] };

if (fs.existsSync(DATA_FILE)) {
    try {
        const fileData = fs.readFileSync(DATA_FILE, 'utf8');
        if (fileData) db = JSON.parse(fileData);
    } catch (e) {
        console.error("⚠️ Could not read data.json, starting fresh.");
    }
}

const saveData = () => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error("⚠️ Failed to save to data.json");
    }
};

// --- WEBSITE SERVER (EXPRESS) ---
const app = express();
app.use(express.static('public'));
app.use(express.json());

app.get('/api/data', (req, res) => {
    res.json({ 
        stockCount: db.stock.length, 
        blacklist: db.blacklist, 
        claimHistory: db.claimHistory 
    });
});

app.post('/api/add-stock', (req, res) => {
    if (!req.body.items) return res.status(400).send("No items sent");
    
    const newItems = req.body.items.split('\n').filter(i => i.trim() !== "");
    db.stock.push(...newItems);
    saveData();
    res.sendStatus(200);
});

app.post('/api/blacklist', (req, res) => {
    const { userId } = req.body;
    if (userId && !db.blacklist.includes(userId)) {
        db.blacklist.push(userId);
        saveData();
    }
    res.sendStatus(200);
});

// --- DISCORD BOT LOGIC ---
client.on('ready', () => {
    console.log(`✅ Bot is online as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.channel.id !== ALLOWED_CHANNEL_ID) return;

    if (message.content.toLowerCase().startsWith('?gen')) {
        if (db.blacklist.includes(message.author.id)) {
            return message.reply("❌ You are blacklisted.");
        }

        if (db.stock.length === 0) {
            return message.reply("⚠️ We are out of stock!");
        }

        const account = db.stock.shift(); 
        try {
            await message.author.send(`🎁 **Your Account:**\n\`${account}\``);
            message.reply(`✅ Sent to your DMs, ${message.author.username}!`);
            
            db.claimHistory.unshift({ 
                user: message.author.username, 
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
            });
            if (db.claimHistory.length > 20) db.claimHistory.pop();
            
            saveData();
        } catch (err) {
            message.reply("❌ I couldn't DM you! Please open your privacy settings.");
            db.stock.unshift(account); 
            saveData();
        }
    }
});

// Railway requires binding to 0.0.0.0
app.listen(PORT, '0.0.0.0', () => console.log(`✅ Dashboard running on port ${PORT}`));

client.login(process.env.TOKEN).catch(err => {
    console.error("❌ BOT LOGIN FAILED. Is your Token correct? Did you enable Intents?");
    console.error(err);
});
