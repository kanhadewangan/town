export class Scene extends Phaser.Scene {
    constructor() {
        super({ key: "Scene" });
    }
// X=940, Y=715
//X=1335, Y=708
      charactersWithMoments = [{
        "character": { x: 1122, y: 145 }
      },
      {
        "character2": { x: 1335, y: 708 }
      },
      {
        "character3": { x: 940, y: 715 }
      }
      ,{
        "character4": { x: 1200, y: 400 }
      }
      ,{
        "character5": { x: 400, y: 800 }
      }
    ];
    


    preload() {
        this.load.image("background", "public/lands.png");
        this.load.image("character", "public/character.png");
        this.load.audio("bg", "public/bg.mp3");
        this.load.image("character2", "public/character2.png");
        this.load.image("character3", "public/character3.png");
        this.load.image("character4", "public/character4.png");
        this.load.image("character5", "public/character5.png");
    }

    
    create() {
        const h = this.scale.height;
        const w = this.scale.width;

        // Background
        this.add.image(0, 0, "background").setOrigin(0, 0);
 
        // Character as physics sprite
        this.char = this.physics.add.sprite(1122, 145, "character");
        this.char.setScale(0.2);
        this.char.setCollideWorldBounds(true); // keeps inside screen
        this.physics.world.setBounds(0, 0, 2000, 2000);
        //other characters
        this.otherCharacters = this.physics.add.group();
        this.charactersWithMoments.slice(1).forEach(charData => { // Skip first one (main character)
            const [key, pos] = Object.entries(charData)[0];
            const char = this.physics.add.sprite(pos.x, pos.y, key);
            char.setScale(0.2);
            char.setCollideWorldBounds(true);
            this.otherCharacters.add(char);
        });

        // Movement tracking variables
        this.previousPosition = { x: this.char.x, y: this.char.y };
        this.totalDistance = 0;
        this.currentDirection = "none";

        // Music
        const music = this.sound.add("bg", { loop: true, volume: 0.2 });
        music.play();

        // Camera follows the character
        this.cameras.main.setBounds(0, 0, w, h);
        this.cameras.main.startFollow(this.char);
        this.cameras.main.setDeadzone(w * 1.5, h * 1.5);

        // WASD keys
        this.keys = this.input.keyboard.addKeys({
            w: Phaser.Input.Keyboard.KeyCodes.W,
            s: Phaser.Input.Keyboard.KeyCodes.S,
            a: Phaser.Input.Keyboard.KeyCodes.A,
            d: Phaser.Input.Keyboard.KeyCodes.D
        });
    }

    update() {
        const speed = 150;

        if (!this.char) return;

        // Store previous position for tracking
        const prevX = this.char.x;
        const prevY = this.char.y;

        // Reset velocity every frame
        this.char.setVelocity(0);

        // Track current movement direction
        let directions = [];

        // WASD movement
        if (this.keys.w.isDown) {
            this.char.setVelocityY(-speed);
            directions.push("UP");
        }
        if (this.keys.s.isDown) {
            this.char.setVelocityY(speed);
            directions.push("DOWN");
        }
        if (this.keys.a.isDown) {
            this.char.setVelocityX(-speed);
            directions.push("LEFT");
        }
        if (this.keys.d.isDown) {
            this.char.setVelocityX(speed);
            directions.push("RIGHT");
        }

        // Update current direction
        this.currentDirection = directions.length > 0 ? directions.join("+") : "STATIONARY";

        // Calculate distance moved this frame
        const deltaX = this.char.x - prevX;
        const deltaY = this.char.y - prevY;
        const frameDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        this.totalDistance += frameDistance;

        // Print movement tracking info (only when moving)
        if (directions.length > 0) {
            console.log("=== MOVEMENT TRACKING ===");
            console.log(`Position: X=${Math.round(this.char.x)}, Y=${Math.round(this.char.y)}`);
            console.log(`Velocity: X=${this.char.body.velocity.x}, Y=${this.char.body.velocity.y}`);
            console.log(`Direction: ${this.currentDirection}`);
            console.log(`Distance this frame: ${frameDistance.toFixed(2)}`);
            console.log(`Total distance traveled: ${this.totalDistance.toFixed(2)}`);
            console.log("========================");
        }
    }
}
