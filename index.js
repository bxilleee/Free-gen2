const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const fs = require('fs');
const app = express();
const path = require('path');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ] 
});

const PORT = process.env.PORT || 3000;
const DATA_FILE = './data.json';
const ALLOWED_CHANNEL_ID = '1480531258516963519'; // Your specific channel ID

// --- DATA PERSISTENCE ---
let db = { stock: [], blacklist: [], claimHistory: [] };

if (fs.existsSync(DATA_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DATA_FILE));
    } catch (e) {
        console.log("Error reading data file, starting fresh.");
    }
}

const saveData = () => fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));

// --- WEBSITE API ---
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
client.on('messageCreate', async (message) => {
    // 1. Ignore bots
    if (message.author.bot) return;

    // 2. ONLY respond in your specific channel
    if (message.channel.id !== ALLOWED_CHANNEL_ID) return;

    // 3. Command check
    if (message.content.toLowerCase().startsWith('?gen')) {
        
        // Check Blacklist
        if (db.blacklist.includes(message.author.id)) {
            return message.reply("❌ You are blacklisted from using this bot.");
        }

        // Check Stock
        if (db.stock.length === 0) {
            return message.reply("⚠️ We are currently out of stock!");
        }

        // Process Claim
        const account = db.stock.shift(); 
        try {
            await message.author.send(`🎁 **Your Account Details:**\n\`${account}\``);
            message.reply(`✅ Sent! Check your DMs, ${message.author.username}.`);
            
            // Log to dashboard
            db.claimHistory.unshift({ 
                user: message.author.username, 
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
            });
            // Keep history list short (last 20 claims)
            if (db.claimHistory.length > 20) db.claimHistory.pop();
            
            saveData();
        } catch (err) {
            message.reply("❌ I couldn't DM you! Please open your privacy settings.");
            db.stock.unshift(account); // Put it back at the front of the list
            saveData();
        }
    }
});

app.listen(PORT, () => console.log(`Dashboard running on port ${PORT}`));

// Ensure you set 'TOKEN' in Railway Variables!
client.login(process.env.TOKEN);
