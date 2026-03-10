const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');

// --- DISCORD SETUP ---
const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

const PORT = process.env.PORT || 3000;
const DATA_FILE = './data.json';
const ALLOWED_CHANNEL_ID = '1480531258516963519'; // Your locked channel

// --- DATABASE LOGIC ---
let db = { stock: [], blacklist: [], claimHistory: [] };

// Load data if it exists
if (fs.existsSync(DATA_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DATA_FILE));
    } catch (e) {
        console.error("Error reading data.json, using empty database.");
    }
}

// Function to save changes
const saveData = () => fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));

// --- WEBSITE SERVER (EXPRESS) ---
const app = express();
app.use(express.static('public')); // Tells it to load files from the 'public' folder
app.use(express.json());

// Send data to the dashboard
app.get('/api/data', (req, res) => {
    res.json({ 
        stockCount: db.stock.length, 
        blacklist: db.blacklist, 
        claimHistory: db.claimHistory 
    });
});

// Receive new stock from the dashboard
app.post('/api/add-stock', (req, res) => {
    const newItems = req.body.items.split('\n').filter(i => i.trim() !== "");
    db.stock.push(...newItems);
    saveData();
    res.sendStatus(200);
});

// Receive blacklist requests from the dashboard
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
    if (message.author.bot) return;
    if (message.channel.id !== ALLOWED_CHANNEL_ID) return;

    if (message.content.toLowerCase().startsWith('?gen')) {
        
        // 1. Check if user is blacklisted
        if (db.blacklist.includes(message.author.id)) {
            return message.reply("❌ You are blacklisted from using this generator.");
        }

        // 2. Check if out of stock
        if (db.stock.length === 0) {
            return message.reply("⚠️ We are currently out of stock! Please check back later.");
        }

        // 3. Give account
        const account = db.stock.shift(); 
        try {
            await message.author.send(`🎁 **Here is your generated account:**\n\`${account}\``);
            message.reply(`✅ Successfully sent to your DMs, ${message.author.username}!`);
            
            // Log to website history
            db.claimHistory.unshift({ 
                user: message.author.username, 
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
            });
            
            // Keep history short (max 20 items)
            if (db.claimHistory.length > 20) db.claimHistory.pop();
            
            saveData();
        } catch (err) {
            // If DMs are closed, put the account back in stock
            message.reply("❌ I couldn't DM you! Please open your privacy settings.");
            db.stock.unshift(account); 
            saveData();
        }
    }
});

// Start the server and bot
app.listen(PORT, () => console.log(`Website running on port ${PORT}`));
client.login(process.env.TOKEN);
