export class Scene extends Phaser.Scene {
    constructor() {
        super({
            key: "Scene"
        })

    }
    init() {

    }
    preload() {
        const bg = this.load.image("background", "public/lands.png")
        const char = this.load.image("character", "public/character.png")
        const music = this.load.audio("bg", "public/bg.mp3")

    }
    create() {
        let h = this.scale.height;
        let w = this.scale.width
        console.log(h, w)
        const bgs = this.add.image(0, 0, "background")
        this.char = this.add.image(0, 0, "character")
        this.char.setPosition(w / 2, h / 2)
        this.char.setScale(0.2)
        bgs.setPosition(900, 700)
        const music = this.sound.add("bg", { loop: true, volume: 0.2 })

        this.keys = this.input.keyboard.addKeys({
            w: Phaser.Input.Keyboard.KeyCodes.W,
            s: Phaser.Input.Keyboard.KeyCodes.S,
            a: Phaser.Input.Keyboard.KeyCodes.A,
            d: Phaser.Input.Keyboard.KeyCodes.D
        });
        music.play()

    }
    update() {
        const speed = 150;

        // WASD movement controls
        if (this.keys.w.isDown) {
            this.char.y -= speed * this.game.loop.delta / 1000;
        }
        if (this.keys.s.isDown) {
            this.char.y += speed * this.game.loop.delta / 1000;
        }
        if (this.keys.a.isDown) {
            this.char.x -= speed * this.game.loop.delta / 1000;
        }
        if (this.keys.d.isDown) {
            this.char.x += speed * this.game.loop.delta / 1000;
        }

        this.char.x = Phaser.Math.Clamp(this.char.x, 0, this.scale.width);
        this.char.y = Phaser.Math.Clamp(this.char.y, 0, this.scale.height);
    }

}