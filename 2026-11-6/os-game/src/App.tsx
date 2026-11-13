import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { PhaserGame } from './PhaserGame';
import { EventBus, GameEvents } from './game/EventBus';
import { levels } from './game/lessons';
import { activeLevel, readLessonCompleted, saveLessonCompleted } from './game/progress';

function normaliseAnswer(value: string)
{
    return value.toLowerCase().trim()
        .replace(/^(a|an|the)\s+/, '')
        .replace(/[^a-z0-9]/g, '');
}

export default function App()
{
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [levelIndex] = useState(activeLevel);
    const [stage, setStage] = useState<'learn' | 'quiz'>('learn');
    const [textAnswer, setTextAnswer] = useState('');
    const [trueFalseAnswer, setTrueFalseAnswer] = useState<boolean | null>(null);
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [completed, setCompleted] = useState<Record<number, string[]>>(() => ({
        0: readLessonCompleted(0),
        1: readLessonCompleted(1),
        2: readLessonCompleted(2)
    }));
    const dialogRef = useRef<HTMLElement>(null);

    useEffect(() =>
    {
        const openLesson = (id: string) =>
        {
            setSelectedId(id);
            setStage('learn');
            setTextAnswer('');
            setTrueFalseAnswer(null);
            setFeedback(null);
        };
        const openChallenge = () =>
        {
            window.location.assign(['/practical-task', '/install-ubuntu', '/automation-practical'][levelIndex]);
        };

        EventBus.on(GameEvents.OpenLesson, openLesson);
        EventBus.on(GameEvents.OpenChallenge, openChallenge);
        return () =>
        {
            EventBus.off(GameEvents.OpenLesson, openLesson);
            EventBus.off(GameEvents.OpenChallenge, openChallenge);
        };
    }, [levelIndex]);

    useEffect(() =>
    {
        if (selectedId) dialogRef.current?.focus();
    }, [selectedId]);

    const level = levels[levelIndex];
    const completedHere = completed[levelIndex] ?? [];
    const levelComplete = completedHere.length === level.lessons.length;
    const challengeUnlocked = levelComplete;
    const selected = level.lessons.find((lesson) => lesson.id === selectedId);

    const closeLesson = () =>
    {
        setSelectedId(null);
        EventBus.emit(GameEvents.CloseLesson);
    };

    const checkAnswer = (event: FormEvent<HTMLFormElement>) =>
    {
        event.preventDefault();
        if (!selected) return;

        const quiz = selected.quiz;
        const isCorrect = quiz.type === 'true-false'
            ? trueFalseAnswer === quiz.correctAnswer
            : quiz.acceptedAnswers.some((answer) =>
                normaliseAnswer(textAnswer) === normaliseAnswer(answer)
            );

        setFeedback(isCorrect ? 'correct' : 'incorrect');
        if (isCorrect)
        {
            const alreadyCompleted = completedHere.includes(selected.id);
            const nextAnswers = alreadyCompleted ? completedHere : [...completedHere, selected.id];
            setCompleted((previous) =>
            {
                const levelAnswers = previous[levelIndex] ?? [];
                return levelAnswers.includes(selected.id)
                    ? previous
                    : { ...previous, [levelIndex]: [...levelAnswers, selected.id] };
            });
            saveLessonCompleted(levelIndex, nextAnswers);
            EventBus.emit(GameEvents.CompleteLesson, selected.id);
            if (
                completedHere.length + (alreadyCompleted ? 0 : 1) === level.lessons.length)
            {
                EventBus.emit(GameEvents.UnlockComputer);
            }
        }
    };

    return (
        <main id="app" className={`level-${levelIndex}`}>
            <header className="game-heading">
                <div className="game-heading-title">
                    <span className="heading-kicker"><span className="signal-dot" /> SYSTEM QUEST <span className="kicker-line" /> CHAPTER 0{levelIndex + 1}</span>
                    <h1>OS <span>ASCENSION</span></h1>
                    <p className="level-name">{['The Awakening', 'The Descent', 'The Blueprint'][levelIndex]} <span> / </span> {level.name}</p>
                    <p className="mission-copy">{challengeUnlocked
                        ? [
                            'The final gate is active. Reach the terminal at the far right to begin your trial.',
                            'The installation gate is active. Reach the terminal at the far right to begin your Ubuntu trial.',
                            'The automation gate is active. Reach the terminal at the far right to begin your final practical test.'
                        ][levelIndex]
                        : levelComplete
                            ? 'Every archive has been claimed. This chapter is complete.'
                            : 'Enter the arena. Claim each glowing archive and prove what you have learned.'}</p>
                </div>
                <div className="mission-status" aria-label={`${completedHere.length} of ${level.lessons.length} archives complete`}>
                    <span className="status-kicker">ARCHIVES RECOVERED</span>
                    <strong>{String(completedHere.length).padStart(2, '0')} <small>/ {String(level.lessons.length).padStart(2, '0')}</small></strong>
                    <div className="progress-track"><span style={{ width: `${completedHere.length / level.lessons.length * 100}%` }} /></div>
                    <span className="status-caption">{challengeUnlocked ? ['TRIAL GATE OPEN', 'INSTALL GATE OPEN', 'AUTOMATION GATE OPEN'][levelIndex] : 'MISSION IN PROGRESS'}</span>
                </div>
            </header>

            <section className="game-frame" aria-label={`Level ${levelIndex} game arena`}>
                <div className="frame-bar">
                    <span><i className="signal-dot" /> LIVE FIELD VIEW</span>
                    <span>SECTOR 0{levelIndex + 1} // {['RIFT APPROACH', 'ECLIPSE KEEP', 'AUTOMATION SPIRE'][levelIndex]}</span>
                </div>
                <PhaserGame />
                <div className="frame-controls" aria-label="Game controls">
                    <span><b>MOVE</b> <kbd>←</kbd> <kbd>→</kbd> <em>or</em> <kbd>A</kbd> <kbd>D</kbd></span>
                    <span><b>JUMP</b> <kbd>↑</kbd> <kbd>W</kbd> <em>or</em> <kbd>SPACE</kbd></span>
                    <span><b>INTERACT</b> <kbd>E</kbd> <em>or click</em></span>
                </div>
            </section>

            <div className="game-footnote">
                <span>◈ &nbsp; FIND THE ARCHIVES. MASTER THE SYSTEM.</span>
                <span>FIELD STATUS: {levelComplete ? 'COMPLETE' : 'ACTIVE'}</span>
            </div>

            {selected && (
                <div className="lesson-backdrop">
                    <section
                        className="lesson-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="lesson-title"
                        ref={dialogRef}
                        tabIndex={-1}
                        onKeyDown={(event) => { if (event.key === 'Escape') closeLesson(); }}
                    >
                        <div className="lesson-topline">
                            <span>ARCHIVE FRAGMENT // 0{level.lessons.indexOf(selected) + 1} <i>•</i> CHAPTER 0{levelIndex + 1}</span>
                            <button className="close-button" type="button" onClick={closeLesson} aria-label="Close lesson">×</button>
                        </div>
                        <div className="lesson-emblem" aria-hidden="true"><span>◈</span></div>
                        <h2 id="lesson-title">{selected.title}</h2>

                        {stage === 'learn' ? (
                            <>
                                <div className="lesson-material">
                                    {selected.material.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                                </div>
                                <button className="primary-button" type="button" onClick={() => setStage('quiz')}>
                                    FACE THE QUESTION <span aria-hidden="true">→</span>
                                </button>
                            </>
                        ) : (
                            <form onSubmit={checkAnswer}>
                                <p className="quiz-question">{selected.quiz.question}</p>
                                {selected.quiz.type === 'true-false' ? (
                                    <div className="answer-choices" role="group" aria-label="Choose true or false">
                                        <button className={trueFalseAnswer === true ? 'choice selected' : 'choice'} type="button" aria-pressed={trueFalseAnswer === true} onClick={() => { setTrueFalseAnswer(true); setFeedback(null); }}>True</button>
                                        <button className={trueFalseAnswer === false ? 'choice selected' : 'choice'} type="button" aria-pressed={trueFalseAnswer === false} onClick={() => { setTrueFalseAnswer(false); setFeedback(null); }}>False</button>
                                    </div>
                                ) : (
                                    <label className="text-answer">
                                        Your answer
                                        <input
                                            value={textAnswer}
                                            onChange={(event) => { setTextAnswer(event.target.value); setFeedback(null); }}
                                            autoFocus
                                            autoComplete="off"
                                            placeholder="Type a short answer"
                                        />
                                    </label>
                                )}

                                {feedback && (
                                    <div className={feedback === 'correct' ? 'answer-feedback correct' : 'answer-feedback incorrect'} role="status">
                                        <strong>{feedback === 'correct' ? 'Correct!' : 'Not quite.'}</strong>{' '}
                                        {selected.quiz.explanation}
                                        {feedback === 'incorrect' && (
                                            <span> Correct answer: {selected.quiz.type === 'true-false'
                                                ? (selected.quiz.correctAnswer ? 'True' : 'False')
                                                : selected.quiz.correctAnswer}.</span>
                                        )}
                                    </div>
                                )}

                                <div className="quiz-actions">
                                    <button className="secondary-button" type="button" onClick={() => { setStage('learn'); setFeedback(null); }}>Review lesson</button>
                                    {feedback === 'correct' ? (
                                        <button className="primary-button" type="button" onClick={closeLesson}>
                                            Back to game
                                        </button>
                                    ) : (
                                        <button className="primary-button" type="submit" disabled={selected.quiz.type === 'true-false' ? trueFalseAnswer === null : !textAnswer.trim()}>
                                            Check answer
                                        </button>
                                    )}
                                </div>
                            </form>
                        )}
                    </section>
                </div>
            )}

        </main>
    );
}
