import { Scene } from "./scene.js"

const config = {
    type: Phaser.AUTO,
    scene: Scene,
    scale: {
        height: 1200,
        width: 1920,
        mode: Phaser.Scale.CENTER_BOTH

    }
}
const game = new Phaser.Game(config)