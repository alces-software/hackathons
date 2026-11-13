import { Events } from 'phaser';

// Used to emit events between components, HTML and Phaser scenes
export const EventBus = new Events.EventEmitter();

export const GameEvents = {
    OpenLesson: 'lesson:open',
    CloseLesson: 'lesson:close',
    CompleteLesson: 'lesson:complete',
    UnlockComputer: 'computer:unlock',
    OpenChallenge: 'challenge:open'
} as const;
