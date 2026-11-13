import { levels } from './lessons';
import { practicalQuestions } from './practicalQuestions';

const practicalProgressKey = 'os-game-practical-completed';
const installationProgressKey = 'os-game-installation-continued';

function readCompleted(key: string, validIds: string[]): string[]
{
    if (typeof window === 'undefined') return [];

    try
    {
        const stored = JSON.parse(window.sessionStorage.getItem(key) ?? '[]');
        if (!Array.isArray(stored)) return [];
        return validIds.filter((id) => stored.includes(id));
    }
    catch
    {
        return [];
    }
}

export function readLessonCompleted(levelIndex: number): string[]
{
    return readCompleted(
        `os-game-level-${levelIndex}-completed`,
        levels[levelIndex]?.lessons.map((lesson) => lesson.id) ?? []
    );
}

export function saveLessonCompleted(levelIndex: number, ids: string[])
{
    window.sessionStorage.setItem(`os-game-level-${levelIndex}-completed`, JSON.stringify(ids));
}

export function readPracticalCompleted(): string[]
{
    return readCompleted(practicalProgressKey, practicalQuestions.map((question) => question.id));
}

export function savePracticalCompleted(ids: string[])
{
    window.sessionStorage.setItem(practicalProgressKey, JSON.stringify(ids));
}

export function level0Complete()
{
    return readLessonCompleted(0).length === levels[0].lessons.length;
}

export function practicalComplete()
{
    return readPracticalCompleted().length === practicalQuestions.length;
}

export function level1Complete()
{
    return readLessonCompleted(1).length === levels[1].lessons.length;
}

export function level2Complete()
{
    return readLessonCompleted(2).length === levels[2].lessons.length;
}

export function installationContinued()
{
    if (typeof window === 'undefined') return false;
    try
    {
        return window.sessionStorage.getItem(installationProgressKey) === 'yes';
    }
    catch
    {
        return false;
    }
}

export function continueInstallationChallenge()
{
    window.sessionStorage.setItem(installationProgressKey, 'yes');
}

export function activeLevel()
{
    if (installationContinued()) return 2;
    return practicalComplete() ? 1 : 0;
}
