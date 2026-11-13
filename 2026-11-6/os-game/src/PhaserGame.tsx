import { useEffect } from 'react';
import StartGame from './game/main';

export function PhaserGame()
{
    useEffect(() =>
    {
        const game = StartGame('game-container');
        return () => game.destroy(true);
    }, []);

    return <div id="game-container" />;
}
