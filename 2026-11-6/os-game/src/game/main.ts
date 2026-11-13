import { AUTO, Game } from 'phaser';
import { Game as MainGame } from './scenes/Game';

const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: 960,
    height: 540,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 950 },
            debug: false
        }
    },
    scene: [MainGame]
};

const StartGame = (parent: string) => new Game({ ...config, parent });

export default StartGame;
