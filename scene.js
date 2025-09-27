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

        console.log("🎮 Scene created with dimensions:", w, "x", h);

        // Background - centered and scaled to fit screen
        const background = this.add.image(w / 2, h / 2, "background");
        background.setDisplaySize(w, h);

        // Set up physics world
        this.physics.world.setBounds(0, 0, w, h);

        // WASD keys
        this.keys = this.input.keyboard.addKeys({
            w: Phaser.Input.Keyboard.KeyCodes.W,
            s: Phaser.Input.Keyboard.KeyCodes.S,
            a: Phaser.Input.Keyboard.KeyCodes.A,
            d: Phaser.Input.Keyboard.KeyCodes.D
        });

        console.log("🎹 Keys configured:", this.keys);

        // Music
        const music = this.sound.add("bg", { loop: true, volume: 0.1 });
        // music.play();

        this.setupSocketListeners();

        // Fallback: Create a temporary player if socket doesn't connect in 3 seconds
        setTimeout(() => {
            if (!this.myPlayer) {
                console.log("⚠️ Socket not connected - creating fallback player");
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

    setupSocketListeners() {
        // Debug socket connection
        socket.on("connect", () => {
            console.log("✅ Socket connected", "with ID:", socket.id);
        });

        socket.on("disconnect", () => {
            console.log("❌ Socket disconnected");
        });

        // When we join the game
        socket.on("playerJoined", (data) => {
            console.log("🎮 I joined the game!", data);
            this.myPlayerId = data.playerId;
            
            // Create my character
            this.myPlayer = this.physics.add.sprite(data.playerData.x, data.playerData.y, data.playerData.character);
            this.myPlayer.setScale(0.2);
            this.myPlayer.setCollideWorldBounds(true);
            
            
            // Make camera follow my character
            this.cameras.main.startFollow(this.myPlayer);
            this.cameras.main.setBounds(0, 0, this.scale.width, this.scale.height);
            
            // Add all existing players
            data.allPlayers.forEach(playerData => {
                if (playerData.id !== this.myPlayerId) {
                    this.addOtherPlayer(playerData);
                }
            });
        });

        // When a new player joins
        socket.on("newPlayer", (playerData) => {
            console.log("New player joined:", playerData);
            this.addOtherPlayer(playerData);
        });

        // When existing players are sent
        socket.on("existingPlayers", (playersArray) => {
            console.log("Existing players:", playersArray);
            playersArray.forEach(playerData => {
                if (playerData.id !== this.myPlayerId) {
                    this.addOtherPlayer(playerData);
                }
            });
        });

        // When another player moves
        socket.on("playerMoved", (data) => {
            console.log("👥 Player moved:", data.playerId.substr(0, 6), "to", Math.round(data.x), Math.round(data.y));
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
            } else {
                console.log("⚠️ Player not found:", data.playerId);
            }
        });

        // When a player leaves
        socket.on("playerLeft", (playerId) => {
            console.log("Player left:", playerId);
            const playerSprite = this.players.get(playerId);
            if (playerSprite) {
                playerSprite.destroy();
                this.players.delete(playerId);
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
        
        console.log(`✅ Added player ${playerData.id} (${playerData.character}) at (${Math.round(playerData.x)}, ${Math.round(playerData.y)})`);
    }

    update() {
        // Debug: Check if myPlayer exists
        if (!this.myPlayer) {
            console.log("⚠️ No player found in update - waiting for socket connection");
            return;
        }

        const speed = 150;
        let isMoving = false;
        const previousX = this.myPlayer.x;
        const previousY = this.myPlayer.y;

        // Reset velocity
        this.myPlayer.setVelocity(0);

        // Handle movement with less console spam
        let directions = [];
        if (this.keys.w.isDown) {
            this.myPlayer.setVelocityY(-speed);
            isMoving = true;
            directions.push("UP");
        }
        if (this.keys.s.isDown) {
            this.myPlayer.setVelocityY(speed);
            isMoving = true;
            directions.push("DOWN");
        }
        if (this.keys.a.isDown) {
            this.myPlayer.setVelocityX(-speed);
            isMoving = true;
            directions.push("LEFT");
        }
        if (this.keys.d.isDown) {
            this.myPlayer.setVelocityX(speed);
            isMoving = true;
            directions.push("RIGHT");
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
                
                console.log(`📡 Sent position: (${Math.round(this.myPlayer.x)}, ${Math.round(this.myPlayer.y)}) - Direction: ${directions.join("+")}`);
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
