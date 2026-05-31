const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Frontend (client) fayllarini statik render qilish uchun ulaymiz
app.use(express.static(path.join(__dirname, '../client')));

// Foydalanuvchilar bazasi simulyatsiyasi
const users = [];

// 1. RO'YXATDAN O'TISH (Register)
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Username va parolni kiriting!" });
    }
    
    const isExist = users.some(u => u.username.toLowerCase() === username.toLowerCase());
    if (isExist) {
        return res.status(400).json({ error: "Bu username band!" });
    }

    const newUser = { username, password };
    users.push(newUser);
    res.json({ success: true, message: "Muvaffaqiyatli ro'yxatdan o'tdingiz! 🎉" });
});

// 2. TIZIMGA KIRISH (Login)
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    
    if (!user) {
        return res.status(400).json({ error: "Username yoki parol noto'g'ri!" });
    }
    res.json({ success: true, message: "Xush kelibsiz! 👋", username: user.username });
});

// 3. IMAGEDAGI AI BUYRUQLARI INTEGRATSIYASI
app.post('/api/ai/command', (req, res) => {
    const { command, text } = req.body;
    if (!text) {
        return res.json({ reply: "Tahlil uchun biror gap yozing yoki chapdan xabarni tanlang." });
    }

    let aiReply = "";
    switch (command) {
        case 'xulosa':
            aiReply = `📝 [DigNets AI Xulosa]: "${text}" xabarining asosiy negizi tizim imkoniyatlarini sinash va integratsiyaga qaratilgan.`;
            break;
        case 'javob':
            aiReply = `💡 [Taklif etilgan Javob]: "Salom! DigNets premium tizimiga xush kelibsiz. API muvaffaqiyatli bog'landi!"`;
            break;
        case 'tahlil':
            aiReply = `🔮 [Hissiyot Tahlili]: Matn ohangi ijobiy va kiber-marketing trendlariga mos (Aktivlik darajasi: Yuqori).`;
            break;
        case 'tarjima':
            aiReply = `🌐 [English]: "Hello, everything is working perfectly on DigNets platform."`;
            break;
        default:
            aiReply = "DigNets AI: Buyruq aniqlanmadi.";
    }
    res.json({ reply: aiReply });
});

// Barcha noto'g'ri yo'llarni frontendga yo'naltirish
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`DigNets Server port ${PORT} da yonishga tayyor!`));