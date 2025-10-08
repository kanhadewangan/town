// Socket.IO connection using global io object from CDN
const socket = io("http://localhost:3000");

export class Scene extends Phaser.Scene {
    constructor() {
        super({ key: "Scene" });
        
        // Multiplayer variables
        this.players = new Map(); // Store all other players
        this.myPlayerId = null;
        this.myPlayer = null;
        
        // Movement optimization
        this.lastSentPosition = { x: 0, y: 0 };
        this.movementThrottle = 0;
        this.MOVEMENT_SEND_RATE = 60; // Send position every 60ms (16.67fps)
    }

    preload() {
        this.load.image("background", "public/lands.png");
        this.load.image("character", "public/character.png");
        this.load.image("character1", "public/character.png");
        this.load.image("character2", "public/character2.png");
        this.load.image("character3", "public/character3.png");
        this.load.image("character4", "public/character4.png");
        this.load.image("character5", "public/character5.png");
        this.load.audio("bg", "public/bg.mp3");
    }

    create() {
        const h = this.scale.height;
        const w = this.scale.width;

        // Background - centered and scaled to fit screen
        const background = this.add.image(w / 2, h / 2, "background");
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

        this.setupSocketListeners();
        this.setupChat();

        // Fallback: Create a temporary player if socket doesn't connect in 3 seconds
        setTimeout(() => {
            if (!this.myPlayer) {
                this.createFallbackPlayer(w, h);
            }
        }, 3000);
    }

    createFallbackPlayer(w, h) {
        this.myPlayer = this.physics.add.sprite(w / 2, h / 2, "character");
        this.myPlayer.setScale(0.2);
        this.myPlayer.setCollideWorldBounds(true);
        
        // Make camera follow the fallback player
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
            
            // Auto-focus input when opening
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
            if (message) {
                socket.emit('chatMessage', message);
                chatInput.value = '';
            }
        };

        // Send on button click
        chatSend.addEventListener('click', sendMessage);

        // Send on Enter key
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        // Prevent arrow keys from triggering when typing in chat
        chatInput.addEventListener('focus', () => {
            this.input.keyboard.enabled = false;
        });

        chatInput.addEventListener('blur', () => {
            this.input.keyboard.enabled = true;
        });

        // Listen for incoming chat messages
        socket.on('chatMessage', (data) => {
            this.addChatMessage(data);
            
            // Show notification badge if chat is closed
            if (!chatSidebar.classList.contains('open')) {
                this.showChatNotification();
            }
        });
    }

    // Add a chat message to the UI
    addChatMessage(data) {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        
        // Mark own messages
        if (data.playerId === this.myPlayerId) {
            messageDiv.classList.add('own-message');
        }

        const playerName = document.createElement('span');
        playerName.className = 'player-name';
        playerName.textContent = data.playerName + ':';

        const messageText = document.createElement('span');
        messageText.className = 'message-text';
        messageText.textContent = data.message;

        messageDiv.appendChild(playerName);
        messageDiv.appendChild(messageText);
        chatMessages.appendChild(messageDiv);

        // Auto-scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Keep only last 50 messages
        while (chatMessages.children.length > 50) {
            chatMessages.removeChild(chatMessages.firstChild);
        }
    }

    // Add system message to chat
    addSystemMessage(text, type = 'info') {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message system-message';
        messageDiv.textContent = text;

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Keep only last 50 messages
        while (chatMessages.children.length > 50) {
            chatMessages.removeChild(chatMessages.firstChild);
        }
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
        socket.on("connect", () => {
            // Request room status for debugging
            setTimeout(() => {
                socket.emit("getRoomStatus");
            }, 1000);
        });
        
        socket.on("roomStatus", (data) => {
            // Room status received
        });

        socket.on("disconnect", () => {
            // Socket disconnected
        });

        // When we join the game
        socket.on("playerJoined", (data) => {
            this.myPlayerId = data.playerId;
            
            // Update player count
            this.updatePlayerCount(data.allPlayers.length);
            
            // Create my character
            this.myPlayer = this.physics.add.sprite(data.playerData.x, data.playerData.y, data.playerData.character);
            this.myPlayer.setScale(0.2);
            this.myPlayer.setCollideWorldBounds(true);
            
            // Make camera follow my character
            this.cameras.main.startFollow(this.myPlayer);
            this.cameras.main.setBounds(0, 0, this.scale.width, this.scale.height);
            
            // Add all existing players (excluding myself)
            const otherPlayers = data.allPlayers.filter(p => p.id !== this.myPlayerId);
            
            otherPlayers.forEach(playerData => {
                this.addOtherPlayer(playerData);
            });
        });

        // Global announce (join/leave)
        socket.on("announce", (info) => {
            this.showNotification(info.message, info.type);
            
            // Also show in chat as system message
            this.addSystemMessage(info.message, info.type);
        });

        // When a new player joins
        socket.on("newPlayer", (playerData) => {
            this.addOtherPlayer(playerData);
            
            // Update player count (add 1 for the new player)
            this.updatePlayerCount(this.players.size + 1); // +1 for myself
        });

        // When existing players are sent
        socket.on("existingPlayers", (playersArray) => {
            playersArray.forEach(playerData => {
                if (playerData.id !== this.myPlayerId) {
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
                playerSprite.destroy();
                this.players.delete(playerId);
                
                // Update player count (subtract 1 for the player who left)
                this.updatePlayerCount(this.players.size + 1); // +1 for myself
            }
        });
        
    }
    
    addOtherPlayer(playerData) {
        // Create sprite for other player
        const otherPlayer = this.physics.add.sprite(playerData.x, playerData.y, playerData.character);
        otherPlayer.setScale(0.2);
        otherPlayer.setCollideWorldBounds(true);
        
        // Add player name text above sprite
        const nameText = this.add.text(playerData.x, playerData.y - 30, `Player ${playerData.id.substr(0, 6)}`, {
            fontSize: '12px',
            fill: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 4, y: 2 }
        });
        nameText.setOrigin(0.5);
        
        // Add movement indicator (small dot that appears when moving)
        const movementIndicator = this.add.circle(playerData.x + 15, playerData.y - 15, 3, 0x00ff00);
        movementIndicator.setVisible(false);
        
        // Store references
        otherPlayer.nameText = nameText;
        otherPlayer.movementIndicator = movementIndicator;
        this.players.set(playerData.id, otherPlayer);
    }

    update() {
        if (!this.myPlayer) {
            return;
        }

        const speed = 150;
        let isMoving = false;

        // Reset velocity
        this.myPlayer.setVelocity(0);

        // Handle movement with arrow keys
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

        // Throttle movement updates for better performance
        this.movementThrottle += this.game.loop.delta;
        
        // Send position to server with throttling and significant movement check
        if (isMoving && this.movementThrottle >= this.MOVEMENT_SEND_RATE) {
            const distanceMoved = Math.sqrt(
                Math.pow(this.myPlayer.x - this.lastSentPosition.x, 2) + 
                Math.pow(this.myPlayer.y - this.lastSentPosition.y, 2)
            );
            
            if (distanceMoved > 3) { // Only send if moved more than 3 pixels
                socket.emit("playerMove", {
                    x: Math.round(this.myPlayer.x),
                    y: Math.round(this.myPlayer.y)
                });
                
                this.lastSentPosition.x = this.myPlayer.x;
                this.lastSentPosition.y = this.myPlayer.y;
                this.movementThrottle = 0;
            }
        }

        // Reset throttle if not moving
        if (!isMoving) {
            this.movementThrottle = 0;
        }

        // Update name text positions for other players
        this.players.forEach((player) => {
            if (player.nameText) {
                player.nameText.setPosition(player.x, player.y - 30);
            }
        });
    }
}
