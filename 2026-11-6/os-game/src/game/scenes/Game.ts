import { Input, Scene } from 'phaser';
import { EventBus, GameEvents } from '../EventBus';
import { levels } from '../lessons';
import { activeLevel, readLessonCompleted } from '../progress';

const WORLD_WIDTH = 2400;
const RUN_SPEED = 260;
const JUMP_SPEED = -550;
const COMPUTER_X = 2350;
const PLATFORM_Y = [524, 430, 395, 420, 385, 425, 524];

export class Game extends Scene
{
    private player: Phaser.Physics.Arcade.Sprite;
    private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    private leftKey: Phaser.Input.Keyboard.Key;
    private rightKey: Phaser.Input.Keyboard.Key;
    private jumpKey: Phaser.Input.Keyboard.Key;
    private interactKey: Phaser.Input.Keyboard.Key;
    private interactHint: Phaser.GameObjects.Text;
    private playerAura: Phaser.GameObjects.Ellipse;
    private lastTrail = 0;
    private overlayOpen = false;
    private computerUnlocked = false;
    private levelIndex = 0;
    private currentLessons = levels[0].lessons;
    private markerVisuals = new Map<string, {
        body: Phaser.GameObjects.Rectangle;
        label: Phaser.GameObjects.Text;
        glow: Phaser.GameObjects.Ellipse;
        y: number;
    }>();

    constructor ()
    {
        super('Game');
    }

    init (data?: { levelIndex?: number })
    {
        this.levelIndex = data?.levelIndex ?? activeLevel();
        this.currentLessons = levels[this.levelIndex].lessons;
        this.overlayOpen = false;
        this.computerUnlocked = false;
        this.markerVisuals.clear();
        this.lastTrail = 0;
    }

    preload ()
    {
        const key = `arena-level-${this.levelIndex}`;
        if (!this.textures.exists(key))
        {
            this.load.image(key, `/assets/arena-level${this.levelIndex}.png`);
        }
    }

    create ()
    {
        const accent = [0x9d7aff, 0xff745d, 0x4de0d4][this.levelIndex];
        const accentText = ['#b9a7ff', '#ffad87', '#a0fff0'][this.levelIndex];
        const platformKey = `arena-platform-${this.levelIndex}`;
        const playerKey = `arena-player-${this.levelIndex}`;

        this.cameras.main.setBackgroundColor('#050711');
        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, 540);
        this.cameras.main.setScroll(0, 0);
        this.physics.world.setBounds(0, 0, WORLD_WIDTH, 540);
        this.add.image(0, 0, `arena-level-${this.levelIndex}`)
            .setOrigin(0)
            .setDisplaySize(960, 540)
            .setScrollFactor(0)
            .setDepth(-100);
        this.add.rectangle(0, 0, 960, 540, 0x03050e, 0.18)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(-99);

        for (let i = 0; i < 34; i++)
        {
            const ember = this.add.circle(40 + i * 72, 140 + (i * 71) % 340,
                1 + (i % 3), accent, 0.25 + (i % 4) * 0.07).setDepth(-2);
            this.tweens.add({
                targets: ember,
                y: ember.y - 28 - (i % 4) * 10,
                alpha: 0,
                duration: 1700 + (i % 5) * 350,
                delay: (i % 7) * 230,
                yoyo: true,
                repeat: -1
            });
        }

        const art = this.add.graphics();
        if (!this.textures.exists(platformKey))
        {
            art.fillStyle(0x0b0e1d);
            art.fillRect(0, 0, 64, 32);
            art.fillStyle(0x25243e);
            art.fillRect(2, 5, 60, 24);
            art.fillStyle(0x353b60);
            art.fillRect(3, 6, 58, 3);
            art.fillStyle(accent);
            art.fillRect(0, 1, 64, 3);
            art.lineStyle(1, accent, 0.35);
            art.lineBetween(12, 12, 20, 25);
            art.lineBetween(43, 10, 36, 24);
            art.generateTexture(platformKey, 64, 32);
        }
        art.clear();

        if (!this.textures.exists(playerKey))
        {
            art.fillStyle(0x060812);
            art.fillTriangle(9, 19, 2, 60, 40, 60);
            art.fillStyle(0x151a30);
            art.fillRoundedRect(15, 18, 19, 31, 5);
            art.fillStyle(0x090d1b);
            art.fillCircle(23, 13, 11);
            art.fillStyle(0x303957);
            art.fillRect(15, 45, 8, 13);
            art.fillRect(27, 45, 8, 13);
            art.lineStyle(2, accent, 0.95);
            art.lineBetween(22, 15, 30, 15);
            art.lineBetween(37, 23, 43, 52);
            art.generateTexture(playerKey, 46, 62);
        }
        art.destroy();

        const platforms = this.physics.add.staticGroup();
        const addPlatform = (startX: number, y: number, tiles: number) =>
        {
            for (let i = 0; i < tiles; i++)
            {
                platforms.create(startX + i * 64, y, platformKey);
            }
        };

        addPlatform(32, 524, WORLD_WIDTH / 64);
        this.currentLessons.forEach((lesson, index) =>
        {
            const y = PLATFORM_Y[index] ?? 524;
            if (y < 524)
            {
                addPlatform(lesson.x - 64, y, 3);
                this.add.rectangle(lesson.x, y - 18, 185, 3, accent, 0.65).setDepth(2);
            }
        });

        this.playerAura = this.add.ellipse(100, 420, 70, 82, accent, 0.18).setDepth(4);
        this.tweens.add({
            targets: this.playerAura, alpha: 0.34, scaleX: 1.2, scaleY: 1.12,
            duration: 1000, yoyo: true, repeat: -1
        });
        this.player = this.physics.add.sprite(100, 420, playerKey);
        this.player.setCollideWorldBounds(true);
        this.player.setDepth(5);
        this.physics.add.collider(this.player, platforms);
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

        this.currentLessons.forEach((lesson, index) =>
        {
            const platformY = PLATFORM_Y[index] ?? 524;
            const markerY = platformY - 46;
            this.add.rectangle(lesson.x, platformY - 20, 60, 7, 0x070a16).setDepth(3);
            const glow = this.add.ellipse(lesson.x, markerY, 84, 100, accent, 0.2).setDepth(3);
            this.tweens.add({
                targets: glow, alpha: 0.38, scaleX: 1.2, scaleY: 1.13,
                duration: 1250 + index * 90, yoyo: true, repeat: -1
            });
            const body = this.add.rectangle(lesson.x, markerY, 44, 54, 0x101327)
                .setStrokeStyle(2, accent)
                .setDepth(4)
                .setInteractive({ useHandCursor: true });
            const label = this.add.text(lesson.x, markerY, String(index + 1).padStart(2, '0'), {
                fontFamily: 'Arial', fontSize: '20px', color: '#ffffff', fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(5);
            this.add.text(lesson.x, markerY - 46, 'ARCHIVE', {
                fontFamily: 'Arial', fontSize: '10px', color: accentText, fontStyle: 'bold',
                letterSpacing: 2
            }).setOrigin(0.5).setDepth(5);

            this.tweens.add({
                targets: [body, label], y: markerY - 6,
                duration: 1400 + index * 85, yoyo: true, repeat: -1,
                ease: 'Sine.InOut'
            });

            body.on('pointerdown', () => this.openLesson(lesson.id));
            body.on('pointerover', () => body.setScale(1.1));
            body.on('pointerout', () => body.setScale(1));
            this.markerVisuals.set(lesson.id, { body, label, glow, y: markerY });
        });

        this.interactHint = this.add.text(480, 24, '', {
            fontFamily: 'Arial', fontSize: '15px', color: '#ffffff', fontStyle: 'bold',
            backgroundColor: '#0b1025', padding: { x: 15, y: 9 }
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100).setVisible(false);

        this.add.text(22, 22, `CHAPTER 0${this.levelIndex + 1}  //  ${['THE AWAKENING', 'THE DESCENT', 'THE BLUEPRINT'][this.levelIndex]}`, {
            fontFamily: 'Arial', fontSize: '13px', color: '#ffffff', fontStyle: 'bold',
            backgroundColor: '#090b1c', padding: { x: 10, y: 7 }
        }).setScrollFactor(0).setDepth(100);

        const completed = readLessonCompleted(this.levelIndex);
        completed.forEach((id) => this.completeLesson(id));
        if (completed.length === this.currentLessons.length) this.unlockComputer();

        EventBus.on(GameEvents.CloseLesson, this.closeOverlay);
        EventBus.on(GameEvents.CompleteLesson, this.completeLesson);
        EventBus.on(GameEvents.UnlockComputer, this.unlockComputer);
        this.events.once('shutdown', () =>
        {
            EventBus.off(GameEvents.CloseLesson, this.closeOverlay);
            EventBus.off(GameEvents.CompleteLesson, this.completeLesson);
            EventBus.off(GameEvents.UnlockComputer, this.unlockComputer);
        });

        const keyboard = this.input.keyboard!;
        this.cursors = keyboard.createCursorKeys();
        this.leftKey = keyboard.addKey('A');
        this.rightKey = keyboard.addKey('D');
        this.jumpKey = keyboard.addKey('W');
        this.interactKey = keyboard.addKey('E');
        keyboard.addCapture(['UP', 'LEFT', 'RIGHT', 'SPACE']);
        this.cameras.main.fadeIn(650, 0, 0, 0);
    }

    update (time: number)
    {
        if (this.overlayOpen) return;

        this.playerAura.setPosition(this.player.x, this.player.y + 2);

        const left = this.cursors.left.isDown || this.leftKey.isDown;
        const right = this.cursors.right.isDown || this.rightKey.isDown;

        if (left === right)
        {
            this.player.setVelocityX(0);
        }
        else
        {
            this.player.setVelocityX(left ? -RUN_SPEED : RUN_SPEED);
            this.player.setFlipX(left);
            if (time - this.lastTrail > 85)
            {
                const accent = [0xa98dff, 0xff8660, 0x78f5e8][this.levelIndex];
                const trail = this.add.circle(this.player.x + (left ? 14 : -14), this.player.y + 12,
                    3, accent, 0.75).setDepth(3);
                this.tweens.add({
                    targets: trail, alpha: 0, scaleX: 0.3, scaleY: 0.3,
                    duration: 500, onComplete: () => trail.destroy()
                });
                this.lastTrail = time;
            }
        }

        const jumpPressed = this.cursors.up.isDown || this.cursors.space.isDown || this.jumpKey.isDown;
        if (jumpPressed && this.player.body?.blocked.down)
        {
            this.player.setVelocityY(JUMP_SPEED);
        }

        const nearby = this.currentLessons.find((lesson) =>
            Math.abs(this.player.x - lesson.x) < 70 &&
            Math.abs(this.player.y - (this.markerVisuals.get(lesson.id)?.y ?? 0)) < 85
        );
        const nearComputer = this.computerUnlocked &&
            Math.abs(this.player.x - COMPUTER_X) < 75 &&
            Math.abs(this.player.y - 457) < 90;
        const pressedInteract = Input.Keyboard.JustDown(this.interactKey);
        this.interactHint.setVisible(Boolean(nearby || nearComputer));
        if (nearComputer)
        {
            this.interactHint.setText([
                '[ E ]  ENTER THE PRACTICAL TRIAL',
                '[ E ]  ENTER THE INSTALLATION TRIAL',
                '[ E ]  ENTER THE AUTOMATION TRIAL'
            ][this.levelIndex]);
            if (pressedInteract) this.openChallenge();
        }
        else if (nearby)
        {
            this.interactHint.setText(`[ E ]  OPEN ARCHIVE: ${nearby.title}`);
            if (pressedInteract) this.openLesson(nearby.id);
        }
    }

    private openLesson (id: string)
    {
        if (this.overlayOpen) return;

        this.pauseForOverlay();
        EventBus.emit(GameEvents.OpenLesson, id);
    }

    private openChallenge ()
    {
        if (this.overlayOpen) return;

        EventBus.emit(GameEvents.OpenChallenge);
    }

    private pauseForOverlay ()
    {
        this.overlayOpen = true;
        this.player.setVelocityX(0);
        this.physics.pause();
        this.input.keyboard?.disableGlobalCapture();
        this.interactHint.setVisible(false);
    }

    private closeOverlay = () =>
    {
        this.overlayOpen = false;
        this.physics.resume();
        this.input.keyboard?.enableGlobalCapture();
    };

    private completeLesson = (id: string) =>
    {
        const marker = this.markerVisuals.get(id);
        marker?.body.setFillStyle(0x123b35);
        marker?.body.setStrokeStyle(2, 0x72ffd5);
        marker?.label.setText('✓');
        marker?.glow.setFillStyle(0x4ef0bb, 0.27);
    };

    private unlockComputer = () =>
    {
        if (this.computerUnlocked) return;

        this.computerUnlocked = true;
        const gateColor = [0x65ebff, 0xffa477, 0x65f4df][this.levelIndex];
        const glow = this.add.ellipse(COMPUTER_X, 456, 130, 125, gateColor, 0.16).setDepth(2);
        this.tweens.add({ targets: glow, alpha: 0.34, scaleX: 1.15, scaleY: 1.15,
            duration: 1200, yoyo: true, repeat: -1 });
        this.add.rectangle(COMPUTER_X, 501, 110, 10, 0x0b0d1d).setDepth(3);
        this.add.rectangle(COMPUTER_X, 488, 16, 24, 0x333e60).setDepth(3);
        const monitor = this.add.rectangle(COMPUTER_X, 453, 94, 73, 0x0a1223)
            .setStrokeStyle(3, gateColor)
            .setDepth(4)
            .setInteractive({ useHandCursor: true });
        this.add.rectangle(COMPUTER_X, 453, 77, 56, 0x0e2638).setDepth(5);
        this.add.text(COMPUTER_X, 452, '>_', {
            fontFamily: 'monospace', fontSize: '25px', color: ['#7cf5ff', '#ffc6a4', '#9cfff0'][this.levelIndex]
        }).setOrigin(0.5).setDepth(6);
        this.add.text(COMPUTER_X, 394, ['TRIAL GATE', 'INSTALL GATE', 'AUTOMATION GATE'][this.levelIndex], {
            fontFamily: 'Arial', fontSize: '13px', color: '#d2fbff', fontStyle: 'bold',
            backgroundColor: '#0b1830', padding: { x: 8, y: 5 }
        }).setOrigin(0.5).setDepth(6);
        monitor.on('pointerdown', () => this.openChallenge());
    };
}
