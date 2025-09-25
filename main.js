import { Scene } from "./scene.js"

const config = {
    type: Phaser.AUTO,
    scene: Scene,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0}, // No gravity for top-down movement
            debug: true
        }
    },
    scale: {
        height: 1080,
        width: 1920,
        mode: Phaser.Scale.CENTER_BOTH
    }
}
const game = new Phaser.Game(config)

