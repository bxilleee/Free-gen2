const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const fs = require('fs'); // To save data to a file
const app = express();
const path = require('path');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

const PORT = process.env.PORT || 3000;
const DATA_FILE = './data.json';

// --- DATA PERSISTENCE LOGIC ---
let db = { stock: [], blacklist: [], claimHistory: [] };

// Load data from file if it exists
if (fs.existsSync(DATA_FILE)) {
    db = JSON.parse(fs.readFileSync(DATA_FILE));
}

// Function to save data whenever it changes
const saveData = () => fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));

// --- WEBSITE LOGIC ---
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
    if (message.author.bot || !message.content.startsWith('?gen')) return;

    if (db.blacklist.includes(message.author.id)) {
        return message.reply("❌ You are blacklisted.");
    }

    if (db.stock.length === 0) {
        return message.reply("⚠️ Out of stock!");
    }

    const account = db.stock.shift(); 
    try {
        await message.author.send(`🎁 **Your Account:** \`${account}\``);
        message.reply("✅ Sent to your DMs!");
        
        db.claimHistory.unshift({ 
            user: message.author.username, 
            time: new Date().toLocaleTimeString() 
        });
        saveData();
    } catch (err) {
        message.reply("❌ DMs closed!");
        db.stock.push(account); 
        saveData();
    }
});

app.listen(PORT, () => console.log(`Dashboard live on port ${PORT}`));

// This line pulls the token from Railway's "Variables" tab
client.login(process.env.TOKEN);
