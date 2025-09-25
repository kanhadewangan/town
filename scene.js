export class Scene extends Phaser.Scene {
    constructor() {
        super({ key: "Scene" });
    }
    // X=940, Y=715
    //X=1335, Y=708
    //Position: X=868, Y=675
    //Position: X=1323, Y=673

    charactersWithMoments = [{
        "character": { x: 1122, y: 145 }
    },
    {
        "character2": { x: 1232, y: 673 }
    },
    {
        "character3": { x: 868, y: 675 }
    }
        , {
        "character4": { x: 1323, y: 673 }
    }
        , {
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

        // Background - centered and scaled to fit screen
        const background = this.add.image(w / 2, h / 2, "background");
        background.setDisplaySize(w, h); // Scale to match screen size
        // Character as physics sprite
        this.char = this.physics.add.sprite(1113, 115, "character"); // Start at center
        this.char.setScale(0.2);
        this.char.setCollideWorldBounds(true); // keeps inside screen
        this.physics.world.setBounds(0, 0, w, h); // Match screen bounds
        //other characters
        this.otherCharacters = this.physics.add.group();
        this.charactersWithMoments.slice(1).forEach(charData => { // Skip first one (main character)
            const [key, pos] = Object.entries(charData)[0];
            // Scale positions to fit within screen bounds
            const scaledX = (pos.x / 2000) * w; // Convert from old 2000px world to current screen width
            const scaledY = (pos.y / 2000) * h; // Convert from old 2000px world to current screen height
            const char = this.physics.add.sprite(scaledX, scaledY, key);
            char.setScale(0.2);
            char.setCollideWorldBounds(true);
            this.otherCharacters.add(char);
        });

        // Movement tracking variables
        this.previousPosition = { x: this.char.x, y: this.char.y };
        this.totalDistance = 0;
        this.currentDirection = "none";

        // Music
        const music = this.sound.add("bg", { loop: true, volume: 0.1 });
        music.play();

        // Camera follows the character
        this.cameras.main.setBounds(0, 0, w, h); // Match screen bounds
        this.cameras.main.startFollow(this.char);
        this.cameras.main.setDeadzone(100, 100); // Smaller deadzone for screen-sized world

        // WASD keys
        this.keys = this.input.keyboard.addKeys({
            w: Phaser.Input.Keyboard.KeyCodes.W,
            s: Phaser.Input.Keyboard.KeyCodes.S,
            a: Phaser.Input.Keyboard.KeyCodes.A,
            d: Phaser.Input.Keyboard.KeyCodes.D
        });
        // Collisions
        this.physics.add.collider(this.char, this.otherCharacters, this.handleCollision, null, this);

        // Make character3 jump in place


    }


        update() {
            if (!this.char) return;
            const speed = 150;
            this.char.setVelocity(0);

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
    handleCollision(player, other) {
        console.log("Collision detected between player and " + other.texture.key);

        this.char.setVelocity(0);
    }
}
