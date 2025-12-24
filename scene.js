
let socket = null;
socket = io("https://synarena-api.duckdns.org");

export class Scene extends Phaser.Scene {
    constructor() {
        super({ key: "Scene" });
        
        // Multiplayer variables
        this.players = new Map();
        this.myPlayerId = null;
        this.myPlayer = null;
        this.roomName = null;
        
        // Movement optimization
        this.lastSentPosition = { x: 0, y: 0 };
        this.movementThrottle = 0;
        this.MOVEMENT_SEND_RATE = 60;

        // WebRTC state
        this.localStream = null;
        this.peerConnections = new Map(); // peerId -> RTCPeerConnection
        this.remoteVideoElements = new Map(); // peerId -> <video>
        this.videoControlsCreated = false;
        
        // Prevent duplicate listeners
        this.chatListenerSetup = false;
    }

    preload() {
        this.load.image("background", "public/lands.png");
        this.load.image("character", "public/character.png");
        this.load.image("character1", "public/character.png");
        this.load.image("character2", "public/character2.png");
        this.load.image("character3", "public/character3.png");
        // Only preload available character sprites
        this.load.audio("bg", "public/bg.mp3");
    }

    create() {
        const h = this.scale.height;
        const w = this.scale.width;

        // Background - centered and scaled to fit screen
        const background = this.add.image(w /2, h /2, "background");
        background.setDisplaySize(w, h);

        // Set up physics world
        this.physics.world.setBounds(0, 0, w, h);

        // Arrow keys for movement
        this.keys = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.UP,
            down: Phaser.Input.Keyboard.KeyCodes.DOWN,
            left: Phaser.Input.Keyboard.KeyCodes.LEFT,
            right: Phaser.Input.Keyboard.KeyCodes.RIGHT
        });

        // Music
        const music = this.sound.add("bg", { loop: true, volume: 0.1 });
        // music.play();

        // Wait for room selection before connecting
        if (window.selectedRoom) {
            // Room already selected (e.g., page was fast)
            this.initializeWithRoom(window.selectedRoom);
        } else {
            // Wait for room selection event
            window.addEventListener('roomSelected', (e) => {
                this.initializeWithRoom(e.detail.room);
            }, { once: true });
        }

        // Fallback: Create a temporary player if no room selected in 10 seconds
        setTimeout(() => {
            if (!this.myPlayer && !this.roomName) {
                console.log('No room selected, creating offline player');
                this.createFallbackPlayer(w, h);
            }
        }, 10000);
    }

    initializeWithRoom(roomName) {
        this.roomName = roomName;
        console.log(`Initializing with room: ${roomName}`);

        const socketUrl = "https://synarena-api.duckdns.org";
        
        socket = io(socketUrl, {
            query: { room: roomName },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5
        });

        // Make socket available globally for other methods
        this.socket = socket;

        this.setupSocketListeners();
        this.setupChat();

        // Add video call controls and signaling
        this.createVideoControls();
        this.setupWebRTCSignaling();

        // Fallback player if socket doesn't connect
        setTimeout(() => {
            if (!this.myPlayer) {
                this.createFallbackPlayer(this.scale.width, this.scale.height);
            }
        }, 5000);
    }

    createFallbackPlayer(w, h) {
        this.myPlayer = this.physics.add.sprite(w / 2, h / 2, "character");
        this.myPlayer.setScale(0.1); // Smaller character
        this.myPlayer.setCollideWorldBounds(true);
        
        this.cameras.main.startFollow(this.myPlayer);
        this.cameras.main.setBounds(0, 0, this.scale.width, this.scale.height);
    }

    // Simple on-screen notification
    showNotification(text, type = 'info') {
        const color = type === 'join' ? '#4caf50' : (type === 'leave' ? '#f44336' : '#2196f3');
        const notif = this.add.text(this.cameras.main.midPoint.x, 50, text, {
            fontSize: '18px',
            backgroundColor: color,
            color: '#fff',
            padding: { x: 10, y: 6 }
        }).setOrigin(0.5);
        
        this.tweens.add({
            targets: notif,
            alpha: { from: 1, to: 0 },
            duration: 2500,
            ease: 'Linear',
            onComplete: () => notif.destroy()
        });
    }

    // Setup chat system
    setupChat() {
        // Prevent duplicate setup
        if (this.chatListenerSetup) return;
        
        const chatInput = document.getElementById('chat-input');
        const chatSend = document.getElementById('chat-send');
        const chatMessages = document.getElementById('chat-messages');
        const chatToggle = document.getElementById('chat-toggle');
        const chatClose = document.getElementById('chat-close');
        const chatSidebar = document.getElementById('chat-sidebar');
        
        if (!chatInput || !chatSend || !chatMessages || !chatToggle || !chatClose || !chatSidebar) {
            return;
        }

        // Toggle chat sidebar
        chatToggle.addEventListener('click', () => {
            chatSidebar.classList.toggle('open');
            chatToggle.classList.toggle('active');
            
            if (chatSidebar.classList.contains('open')) {
                setTimeout(() => chatInput.focus(), 100);
            }
        });

        // Close chat sidebar
        chatClose.addEventListener('click', () => {
            chatSidebar.classList.remove('open');
            chatToggle.classList.remove('active');
        });

        // Send chat message
        const sendMessage = () => {
            const message = chatInput.value.trim();
            if (message && socket) {
                socket.emit('chatMessage', message);
                chatInput.value = '';
            }
        };

        chatSend.addEventListener('click', sendMessage);

        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        chatInput.addEventListener('focus', () => {
            this.input.keyboard.enabled = false;
        });

        chatInput.addEventListener('blur', () => {
            this.input.keyboard.enabled = true;
        });

        // Listen for incoming chat messages - ONLY ONCE
        if (socket) {
            this.chatListenerSetup = true;
            socket.on('chatMessage', (data) => {
                this.addChatMessage(data);
                
                if (!chatSidebar.classList.contains('open')) {
                    this.showChatNotification();
                }
            });
        }
    }

    // Add a chat message to the UI
    addChatMessage(data) {
        const chatMessages = document.getElementById('chat-messages');
        const videoChatMessages = document.getElementById('video-chat-messages');
        
        // Create message element
        const createMessageEl = (container, isVideoChat = false) => {
            if (!container) return;

            const messageDiv = document.createElement('div');
            messageDiv.className = 'chat-message';
            messageDiv.style.cssText = isVideoChat 
                ? 'margin-bottom:4px;word-wrap:break-word;' 
                : '';
            
            if (data.playerId === this.myPlayerId) {
                messageDiv.classList.add('own-message');
                if (isVideoChat) messageDiv.style.color = '#39ff8b';
            }

            const playerName = document.createElement('span');
            playerName.className = 'player-name';
            playerName.textContent = data.playerName + ': ';
            playerName.style.cssText = isVideoChat ? 'color:#ff2d2d;' : '';

            const messageText = document.createElement('span');
            messageText.className = 'message-text';
            messageText.textContent = data.message;

            messageDiv.appendChild(playerName);
            messageDiv.appendChild(messageText);
            container.appendChild(messageDiv);

            container.scrollTop = container.scrollHeight;

            // Keep only last messages
            const maxMessages = isVideoChat ? 20 : 50;
            while (container.children.length > maxMessages) {
                container.removeChild(container.firstChild);
            }
        };

        createMessageEl(chatMessages, false);
        createMessageEl(videoChatMessages, true);
    }

    // Add system message to chat
    addSystemMessage(text, type = 'info') {
        const chatMessages = document.getElementById('chat-messages');
        const videoChatMessages = document.getElementById('video-chat-messages');

        const createSystemEl = (container, isVideoChat = false) => {
            if (!container) return;

            const messageDiv = document.createElement('div');
            messageDiv.className = 'chat-message system-message';
            messageDiv.textContent = text;
            messageDiv.style.cssText = isVideoChat 
                ? 'color:#556;font-style:italic;margin-bottom:4px;' 
                : '';

            container.appendChild(messageDiv);
            container.scrollTop = container.scrollHeight;

            const maxMessages = isVideoChat ? 20 : 50;
            while (container.children.length > maxMessages) {
                container.removeChild(container.firstChild);
            }
        };

        createSystemEl(chatMessages, false);
        createSystemEl(videoChatMessages, true);
    }

    // Update player count display
    updatePlayerCount(count) {
        const playerCountElement = document.getElementById('player-count-number');
        if (playerCountElement) {
            playerCountElement.textContent = count;
        }
    }

    // Show chat notification (when chat is closed and new message arrives)
    showChatNotification() {
        const chatToggle = document.getElementById('chat-toggle');
        if (chatToggle && !chatToggle.classList.contains('active')) {
            // Add pulse animation
            chatToggle.style.animation = 'pulse 0.5s ease-in-out 3';
            setTimeout(() => {
                chatToggle.style.animation = '';
            }, 1500);
        }
    }

    setupSocketListeners() {
        if (!socket) return;

        socket.on("connect", () => {
            console.log('Connected to server, joining room:', this.roomName);
            // Send join request with room name
            socket.emit("joinRoom", { room: this.roomName });
            
            setTimeout(() => {
                socket.emit("getRoomStatus");
            }, 1000);
        });
        
        socket.on("roomStatus", (data) => {
            console.log('Room status:', data);
        });

        socket.on("disconnect", () => {
            console.log('Disconnected from server');
        });

        socket.on("roomError", (data) => {
            console.error('Room error:', data.message);
            this.showNotification(data.message, 'leave');
        });

        // When we join the game
        socket.on("playerJoined", (data) => {
            this.myPlayerId = data.playerId;
            
            this.updatePlayerCount(data.allPlayers.length);
            
            this.myPlayer = this.physics.add.sprite(data.playerData.x, data.playerData.y, data.playerData.character);
            this.myPlayer.setScale(0.1); // Smaller character
            this.myPlayer.setCollideWorldBounds(true);
            
            this.cameras.main.startFollow(this.myPlayer);
            this.cameras.main.setBounds(0, 0, this.scale.width, this.scale.height);
            
            const otherPlayers = data.allPlayers.filter(p => p.id !== this.myPlayerId);
            
            otherPlayers.forEach(playerData => {
                this.addOtherPlayer(playerData);
            });
            
            console.log(`Joined room: ${data.roomName}, Total players: ${data.allPlayers.length}`);
            this.showNotification(`Joined room: ${data.roomName}`, 'join');
        });

        // Global announce (join/leave)
        socket.on("announce", (info) => {
            this.showNotification(info.message, info.type);
            this.addSystemMessage(info.message, info.type);
        });

        // When a new player joins
        socket.on("newPlayer", (playerData) => {
            this.addOtherPlayer(playerData);
            this.updatePlayerCount(this.players.size + 1);
            console.log(`New player joined: ${playerData.id.substr(0,6)}, Total other players: ${this.players.size}`);
        });

        // When existing players are sent (this might be redundant with playerJoined)
        socket.on("existingPlayers", (playersArray) => {
            console.log(`Received existing players: ${playersArray.length}`);
            playersArray.forEach(playerData => {
                if (playerData.id !== this.myPlayerId && !this.players.has(playerData.id)) {
                    this.addOtherPlayer(playerData);
                }
            });
        });

        // When another player moves
        socket.on("playerMoved", (data) => {
            const otherPlayer = this.players.get(data.playerId);
            if (otherPlayer) {
                // Show movement indicator
                if (otherPlayer.movementIndicator) {
                    otherPlayer.movementIndicator.setVisible(true);
                    // Hide after a short delay
                    this.time.delayedCall(200, () => {
                        if (otherPlayer.movementIndicator) {
                            otherPlayer.movementIndicator.setVisible(false);
                        }
                    });
                }
                
                // Smoothly move the other player to new position
                this.tweens.add({
                    targets: otherPlayer,
                    x: data.x,
                    y: data.y,
                    duration: 50, // Faster animation for more responsive movement
                    ease: 'Linear'
                });
                
                // Update name text and movement indicator positions
                if (otherPlayer.nameText) {
                    this.tweens.add({
                        targets: otherPlayer.nameText,
                        x: data.x,
                        y: data.y - 30,
                        duration: 50,
                        ease: 'Linear'
                    });
                }
                
                if (otherPlayer.movementIndicator) {
                    this.tweens.add({
                        targets: otherPlayer.movementIndicator,
                        x: data.x + 15,
                        y: data.y - 15,
                        duration: 50,
                        ease: 'Linear'
                    });
                }
            }
        });

        // When a player leaves
        socket.on("playerLeft", (playerId) => {
            const playerSprite = this.players.get(playerId);
            if (playerSprite) {
                if (playerSprite.nameText) playerSprite.nameText.destroy();
                if (playerSprite.movementIndicator) playerSprite.movementIndicator.destroy();
                playerSprite.destroy();
                this.players.delete(playerId);
                this.updatePlayerCount(this.players.size + 1);
            }
        });
    }
    
    addOtherPlayer(playerData) {
        const otherPlayer = this.physics.add.sprite(playerData.x, playerData.y, playerData.character);
        otherPlayer.setScale(0.1); // Smaller character
        otherPlayer.setCollideWorldBounds(true);
        
        // Smaller, cleaner name text
        const nameText = this.add.text(playerData.x, playerData.y - 20, playerData.id.substr(0, 4), {
            fontSize: '9px',
            fill: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: { x: 3, y: 1 }
        });
        nameText.setOrigin(0.5);
        
        // Smaller movement indicator
        const movementIndicator = this.add.circle(playerData.x + 10, playerData.y - 10, 2, 0x00ff00);
        movementIndicator.setVisible(false);
        
        otherPlayer.nameText = nameText;
        otherPlayer.movementIndicator = movementIndicator;
        this.players.set(playerData.id, otherPlayer);
    }

    // --- Video Call UI ---
    createVideoControls() {
        if (this.videoControlsCreated) return;
        this.videoControlsCreated = true;

        // Compact control buttons
        const controls = document.createElement('div');
        controls.id = 'video-controls';
        controls.style.cssText = 'position:fixed;top:50px;left:50%;transform:translateX(-50%);z-index:10000;display:flex;gap:10px;';
        document.body.appendChild(controls);

        const startBtn = document.createElement('button');
        startBtn.id = 'start-call';
        startBtn.className = 'room-btn primary';
        startBtn.textContent = '📹 Call';
        startBtn.style.cssText = 'font-size:8px;padding:6px 10px;';
        controls.appendChild(startBtn);

        const hangupBtn = document.createElement('button');
        hangupBtn.id = 'hangup-call';
        hangupBtn.className = 'room-btn secondary';
        hangupBtn.textContent = '📵 End';
        hangupBtn.style.cssText = 'font-size:8px;padding:6px 10px;';
        hangupBtn.disabled = true;
        controls.appendChild(hangupBtn);

        // Video panel with minimize functionality
        const videoPanel = document.createElement('div');
        videoPanel.id = 'video-panel';
        videoPanel.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            z-index: 9998;
            background: rgba(8,16,28,0.95);
            border: 2px solid #1a2a3a;
            box-shadow: 4px 4px 0 rgba(0,0,0,0.5);
            border-radius: 8px;
            padding: 12px;
            display: none;
            flex-direction: column;
            gap: 10px;
            width: 320px;
            max-height: 400px;
            font-family: 'Press Start 2P', monospace;
            transition: all 0.3s ease;
        `;
        videoPanel.dataset.minimized = false;
        document.body.appendChild(videoPanel);

        // Header with minimize button
        const panelHeader = document.createElement('div');
        panelHeader.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding-bottom:8px;border-bottom:2px solid #1a2a3a;cursor:move;';
        
        const headerTitle = document.createElement('span');
        headerTitle.style.cssText = 'color:#ff2d2d;font-size:10px;';
        headerTitle.textContent = '📹 Video Call';
        
        const headerControls = document.createElement('div');
        headerControls.style.cssText = 'display:flex;gap:6px;';
        
        const minimizeBtn = document.createElement('button');
        minimizeBtn.style.cssText = 'background:transparent;border:none;color:#ff2d2d;cursor:pointer;font-size:12px;padding:0;width:20px;height:20px;';
        minimizeBtn.textContent = '−';
        minimizeBtn.title = 'Minimize';
        
        const closeBtn = document.createElement('button');
        closeBtn.style.cssText = 'background:transparent;border:none;color:#ff2d2d;cursor:pointer;font-size:12px;padding:0;width:20px;height:20px;';
        closeBtn.textContent = '✕';
        closeBtn.title = 'Close';
        
        headerControls.appendChild(minimizeBtn);
        headerControls.appendChild(closeBtn);
        panelHeader.appendChild(headerTitle);
        panelHeader.appendChild(headerControls);
        videoPanel.appendChild(panelHeader);

        // Video container with auto-grid
        const videoContainer = document.createElement('div');
        videoContainer.id = 'videos';
        videoContainer.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 8px;
            flex: 1;
            overflow-y: auto;
            min-height: 100px;
            max-height: 200px;
            background: rgba(0,0,0,0.4);
            border: 2px solid #1a2a3a;
            border-radius: 4px;
            padding: 6px;
        `;
        videoPanel.appendChild(videoContainer);

        // Chat messages area
        const videoChatMessages = document.createElement('div');
        videoChatMessages.id = 'video-chat-messages';
        videoChatMessages.style.cssText = `
            flex: 1;
            min-height: 80px;
            max-height: 120px;
            overflow-y: auto;
            background: rgba(0,0,0,0.4);
            border: 2px solid #1a2a3a;
            border-radius: 4px;
            padding: 8px;
            font-size: 8px;
            color: #8a9ab0;
        `;
        videoPanel.appendChild(videoChatMessages);

        // Chat input container
        const videoChatInputContainer = document.createElement('div');
        videoChatInputContainer.style.cssText = 'display:flex;gap:6px;';
        videoPanel.appendChild(videoChatInputContainer);

        const videoChatInput = document.createElement('input');
        videoChatInput.id = 'video-chat-input';
        videoChatInput.type = 'text';
        videoChatInput.placeholder = 'Type a message...';
        videoChatInput.maxLength = 150;
        videoChatInput.style.cssText = `
            flex: 1;
            padding: 6px 8px;
            background: #0a1018;
            border: 2px solid #1a2a3a;
            color: #ccc;
            font-family: 'Press Start 2P', monospace;
            font-size: 7px;
            border-radius: 4px;
        `;
        videoChatInputContainer.appendChild(videoChatInput);

        const videoChatSend = document.createElement('button');
        videoChatSend.id = 'video-chat-send';
        videoChatSend.textContent = '➤';
        videoChatSend.style.cssText = `
            padding: 6px 10px;
            background: linear-gradient(180deg,#e04040,#a01818);
            border: 2px solid #601010;
            color: #fff;
            cursor: pointer;
            border-radius: 4px;
            font-size: 10px;
        `;
        videoChatInputContainer.appendChild(videoChatSend);

        // Minimize functionality
        minimizeBtn.addEventListener('click', () => {
            const isMinimized = videoPanel.dataset.minimized === 'true';
            if (isMinimized) {
                videoPanel.dataset.minimized = false;
                videoPanel.style.height = 'auto';
                videoPanel.style.maxHeight = '400px';
                minimizeBtn.textContent = '−';
            } else {
                videoPanel.dataset.minimized = true;
                videoPanel.style.height = 'auto';
                videoPanel.style.maxHeight = '35px';
                minimizeBtn.textContent = '+';
            }
        });

        // Close video panel
        closeBtn.addEventListener('click', () => {
            videoPanel.style.display = 'none';
            const hangupBtn = document.getElementById('hangup-call');
            const startBtn = document.getElementById('start-call');
            if (hangupBtn) hangupBtn.disabled = true;
            if (startBtn) startBtn.disabled = false;
        });

        // Draggable functionality
        let isDragging = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;

        panelHeader.addEventListener('mousedown', (e) => {
            isDragging = true;
            dragOffsetX = e.clientX - videoPanel.offsetLeft;
            dragOffsetY = e.clientY - videoPanel.offsetTop;
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                videoPanel.style.left = (e.clientX - dragOffsetX) + 'px';
                videoPanel.style.bottom = 'auto';
                videoPanel.style.top = (e.clientY - dragOffsetY) + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // Event handlers
        const sendVideoChat = () => {
            const message = videoChatInput.value.trim();
            if (message && this.socket) {
                this.socket.emit('chatMessage', message);
                videoChatInput.value = '';
            }
        };

        videoChatSend.addEventListener('click', sendVideoChat);
        videoChatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendVideoChat();
        });

        videoChatInput.addEventListener('focus', () => { this.input.keyboard.enabled = false; });
        videoChatInput.addEventListener('blur', () => { this.input.keyboard.enabled = true; });

        startBtn.addEventListener('click', async () => {
            startBtn.disabled = true;
            hangupBtn.disabled = false;
            videoPanel.style.display = 'flex';
            videoPanel.dataset.minimized = false;
            minimizeBtn.textContent = '−';
            videoPanel.style.maxHeight = '400px';
            await this.startVideoCall();
        });

        hangupBtn.addEventListener('click', () => {
            this.endVideoCall();
            hangupBtn.disabled = true;
            startBtn.disabled = false;
            videoPanel.style.display = 'none';
        });
    }

    // --- WebRTC Methods ---
    async startVideoCall() {
        try {
            this.localStream = await this.getLocalMediaStream();
            
            const localVideo = document.getElementById('localVideo');
            if (localVideo && this.localStream) {
                localVideo.srcObject = this.localStream;
            }

            if (!this.localStream) {
                this.addSystemMessage('No camera/mic — view-only mode', 'info');
            }

            // Create offers for all existing players
            const peerIds = Array.from(this.players.keys());
            for (const peerId of peerIds) {
                await this.createAndSendOffer(peerId);
            }

            this.addSystemMessage('Video call started', 'info');
        } catch (err) {
            console.error('startVideoCall error:', err);
            this.addSystemMessage('Video call failed: ' + err.message, 'info');
        }
    }

    async getLocalMediaStream() {
        if (!navigator.mediaDevices?.getUserMedia) {
            console.warn('getUserMedia not available');
            return null;
        }

        // Check available devices
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const hasVideo = devices.some(d => d.kind === 'videoinput');
            const hasAudio = devices.some(d => d.kind === 'audioinput');

            if (hasVideo && hasAudio) {
                try { return await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); } catch (e) {}
            }
            if (hasAudio) {
                try { return await navigator.mediaDevices.getUserMedia({ video: false, audio: true }); } catch (e) {}
            }
            if (hasVideo) {
                try { return await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); } catch (e) {}
            }
        } catch (e) {
            console.warn('Device enumeration failed:', e);
        }

        return null;
    }

    async createAndSendOffer(targetPeerId) {
        const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
        const pc = new RTCPeerConnection(config);
        this.peerConnections.set(targetPeerId, pc);

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream));
        }

        pc.ontrack = (evt) => {
            this.attachRemoteStream(targetPeerId, evt.streams[0]);
        };

        pc.onicecandidate = (event) => {
            if (event.candidate && this.socket) {
                this.socket.emit('webrtc-ice-candidate', {
                    target: targetPeerId,
                    candidate: event.candidate,
                    from: this.socket.id
                });
            }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        if (this.socket) {
            this.socket.emit('webrtc-offer', {
                target: targetPeerId,
                offer: pc.localDescription,
                from: this.socket.id
            });
        }
    }

    attachRemoteStream(peerId, stream) {
        const id = `remote_${peerId}`;
        let video = this.remoteVideoElements.get(id);
        
        if (!video) {
            const container = document.getElementById('videos');
            if (!container) return;

            video = document.createElement('video');
            video.id = id;
            video.autoplay = true;
            video.playsInline = true;
            video.style.cssText = 'width:140px;height:105px;object-fit:cover;border:2px solid #1a2a3a;background:#0a0a0a;border-radius:4px;';
            container.appendChild(video);
            this.remoteVideoElements.set(id, video);
        }

        video.srcObject = stream;
    }

    endVideoCall() {
        // Close all peer connections
        this.peerConnections.forEach(pc => { try { pc.close(); } catch (e) {} });
        this.peerConnections.clear();

        // Remove remote videos
        this.remoteVideoElements.forEach(v => { try { v.remove(); } catch (e) {} });
        this.remoteVideoElements.clear();

        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            this.localStream = null;
        }

        const localVideo = document.getElementById('localVideo');
        if (localVideo) localVideo.srcObject = null;

        // Hide video panel
        const videoPanel = document.getElementById('video-panel');
        if (videoPanel) videoPanel.style.display = 'none';

        this.addSystemMessage('Video call ended', 'info');
    }

    // --- WebRTC Signaling Handlers ---
    setupWebRTCSignaling() {
        if (!this.socket) return;

        this.socket.on('webrtc-offer', async ({ offer, from }) => {
            try {
                const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
                const pc = new RTCPeerConnection(config);
                this.peerConnections.set(from, pc);

                // Get local stream if not already
                if (!this.localStream) {
                    this.localStream = await this.getLocalMediaStream();
                    const localVideo = document.getElementById('localVideo');
                    if (localVideo && this.localStream) localVideo.srcObject = this.localStream;
                }

                if (this.localStream) {
                    this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream));
                }

                pc.ontrack = (evt) => this.attachRemoteStream(from, evt.streams[0]);

                pc.onicecandidate = (event) => {
                    if (event.candidate && this.socket) {
                        this.socket.emit('webrtc-ice-candidate', {
                            target: from,
                            candidate: event.candidate,
                            from: this.socket.id
                        });
                    }
                };

                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                this.socket.emit('webrtc-answer', {
                    target: from,
                    answer: pc.localDescription,
                    from: this.socket.id
                });

                // Enable hangup button since we're now in a call
                const hangupBtn = document.getElementById('hangup-call');
                const startBtn = document.getElementById('start-call');
                if (hangupBtn) hangupBtn.disabled = false;
                if (startBtn) startBtn.disabled = true;

            } catch (err) {
                console.error('Error handling offer:', err);
            }
        });

        this.socket.on('webrtc-answer', async ({ answer, from }) => {
            const pc = this.peerConnections.get(from);
            if (pc) {
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(answer));
                } catch (err) {
                    console.error('Error setting answer:', err);
                }
            }
        });

        this.socket.on('webrtc-ice-candidate', async ({ candidate, from }) => {
            const pc = this.peerConnections.get(from);
            if (pc && candidate) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {
                    console.warn('Error adding ICE candidate:', err);
                }
            }
        });
    }

    update() {
        if (!this.myPlayer) {
            return;
        }

        const speed = 150;
        let isMoving = false;

        this.myPlayer.setVelocity(0);

        if (this.keys.up.isDown) {
            this.myPlayer.setVelocityY(-speed);
            isMoving = true;
        }
        if (this.keys.down.isDown) {
            this.myPlayer.setVelocityY(speed);
            isMoving = true;
        }
        if (this.keys.left.isDown) {
            this.myPlayer.setVelocityX(-speed);
            isMoving = true;
        }
        if (this.keys.right.isDown) {
            this.myPlayer.setVelocityX(speed);
            isMoving = true;
        }

        this.movementThrottle += this.game.loop.delta;
        
        if (isMoving && this.movementThrottle >= this.MOVEMENT_SEND_RATE && socket) {
            const distanceMoved = Math.sqrt(
                Math.pow(this.myPlayer.x - this.lastSentPosition.x, 2) + 
                Math.pow(this.myPlayer.y - this.lastSentPosition.y, 2)
            );
            
            if (distanceMoved > 3) {
                socket.emit("playerMove", {
                    x: Math.round(this.myPlayer.x),
                    y: Math.round(this.myPlayer.y)
                });
                
                this.lastSentPosition.x = this.myPlayer.x;
                this.lastSentPosition.y = this.myPlayer.y;
                this.movementThrottle = 0;
            }
        }

        if (!isMoving) {
            this.movementThrottle = 0;
        }

        // Update name text positions - adjusted for smaller character
        this.players.forEach((player) => {
            if (player.nameText) {
                player.nameText.setPosition(player.x, player.y - 20);
            }
            if (player.movementIndicator) {
                player.movementIndicator.setPosition(player.x + 10, player.y - 10);
            }
        });
    }
}