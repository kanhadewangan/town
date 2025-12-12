# 🎮 Multiplayer Town

> Real-time multiplayer game with WebRTC video chat

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-18+-brightgreen.svg)

## 🚀 Quick Links

| Link | Status |
|------|--------|
| **[Live Demo](https://syncarena.onrender.com/)** | 🟢 Online |
| **[GitHub Repo](https://github.com/kanhadewangan/town.git)** | View Code |
| **[Report Issue](#)** | Bug Reports |

---

## ✨ Features

- 🎮 **Real-time Multiplayer** - Join rooms, play with others instantly
- 💬 **Live Chat** - Text messaging in-game
- 📹 **WebRTC Video Chat** - Peer-to-peer video calls
- 🎨 **Retro UI** - Pixel art themed interface
- 📱 **Responsive** - Works on desktop and mobile
- ⚡ **Fast** - <2s load time

---

## 🛠 Tech Stack

**Frontend**: Phaser 3 | Socket.IO | WebRTC | Vanilla JS  
**Backend**: Node.js | Express | Socket.IO

---

## 📦 Installation

```bash
# Clone repo
git clone https://github.com/kanhadewangan/town.git
cd town

# Install
npm install

# Run backend
npm start

# Run frontend (new terminal)
npx http-server -p 3000
```

**Open**: http://localhost:3000

---

## 🎮 How to Play

1. **Enter room name** (or leave blank for random)
2. **Click Create/Join** to start
3. **Use arrow keys** to move
4. **Click 💬** for chat
5. **Click 📹** for video call

| Key | Action |
|-----|--------|
| ↑↓←→ | Move |
| 💬 | Chat |
| 📹 | Video |
| Enter | Send msg |

---

## 🚀 Deploy

### Frontend (Vercel)
```bash
git push origin main
# Connect to Vercel → Auto deploy
```
**Live at**: `https://syncarena.onrender.com`

### Backend (Render)
```
New Web Service → Connect GitHub
Build: npm install
Start: node backend/index.js
Env: PORT=8080
```

---

## 🔌 Socket.IO Events

**Client → Server**
- `joinRoom` - Enter room
- `playerMove` - Send position
- `chatMessage` - Send message
- `webrtc-offer` - Video offer
- `webrtc-answer` - Video answer
- `webrtc-ice-candidate` - NAT traversal

**Server → Client**
- `playerJoined` - You joined
- `newPlayer` - Player joined
- `playerMoved` - Player moved
- `playerLeft` - Player left
- `chatMessage` - New message
- `announce` - Join/leave notify

---

## 🌍 Browser Support

✅ Chrome 80+  
✅ Firefox 75+  
✅ Safari 14+  
✅ Edge 80+  
✅ Mobile (iOS/Android)

---

## 📊 Stats

- **Code**: ~2000 lines
- **Size**: 60 KB (frontend)
- **Assets**: 500 KB
- **Max Players**: 999/room
- **Latency**: <100ms typical

---

## 🔧 Troubleshooting

**Socket Won't Connect**
- Check backend URL in `scene.js`
- Verify CORS in `backend/index.js`

**Video Not Working**
- Allow camera/mic permissions
- Check browser support (Chrome/Firefox/Safari)

**Lag Issues**
- Close other apps
- Check bandwidth
- Reduce video quality

---

## 📁 Structure

```
town/
├── index.html           # Room selection & UI
├── styles.css           # Styling & animations
├── main.js              # Phaser config
├── scene.js             # Game logic (1500 lines)
├── backend/index.js     # Server
├── public/              # Assets
└── readme.md            # This file
```

---

## 🤝 Contributing

```bash
git checkout -b feature/your-feature
git commit -m "Add feature"
git push origin feature/your-feature
# Create Pull Request
```

---

## 📄 License

MIT - Free to use

---

## 💬 Support

- **Issues**: [GitHub Issues]()
- **Email**: workkanhadewangan@gmail.com


---

<div align="center">

**Made with ❤️ by Kanha Dewangan**


**V1.0.0** • December 2025

</div>
