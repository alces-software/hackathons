import { useState } from 'react';
import type { FormEvent } from 'react';
import { isPracticalAnswerCorrect, practicalQuestions } from './game/practicalQuestions';
import { level0Complete, readPracticalCompleted, savePracticalCompleted } from './game/progress';
import TerminalLauncher from './TerminalLauncher';

export default function PracticalTask()
{
    const [unlocked] = useState(level0Complete);
    const [completedQuestions, setCompletedQuestions] = useState(readPracticalCompleted);
    const [activeQuestionId, setActiveQuestionId] = useState<string | null>(() =>
        practicalQuestions.find((question) => !completedQuestions.includes(question.id))?.id ?? null
    );
    const [answer, setAnswer] = useState('');
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const activeQuestion = practicalQuestions.find((question) => question.id === activeQuestionId);

    const checkPracticalAnswer = (event: FormEvent<HTMLFormElement>) =>
    {
        event.preventDefault();
        if (!activeQuestion || feedback === 'correct') return;

        if (!isPracticalAnswerCorrect(activeQuestion, answer))
        {
            setFeedback('incorrect');
            return;
        }

        const nextCompleted = completedQuestions.includes(activeQuestion.id)
            ? completedQuestions
            : [...completedQuestions, activeQuestion.id];
        savePracticalCompleted(nextCompleted);
        setCompletedQuestions(nextCompleted);
        setFeedback('correct');
    };

    const nextPracticalQuestion = () =>
    {
        setActiveQuestionId(practicalQuestions.find((question) =>
            !completedQuestions.includes(question.id)
        )?.id ?? null);
        setAnswer('');
        setFeedback(null);
    };

    if (!unlocked)
    {
        return (
            <main className="practical-page">
                <a className="back-link" href="/">← Back to game</a>
                <section className="practical-instructions">
                    <h1>Practical task locked</h1>
                    <p>Answer all seven Level 0 questions correctly, then use the computer at the end of the level.</p>
                </section>
            </main>
        );
    }

    return (
        <main className="practical-page">
            <a className="back-link" href="/">← Back to game</a>
            <header className="practical-header">
                <span>Level 0 · Practical task</span>
                <h1>Inspect your Linux VM</h1>
                <p>Use Terminal.app on your Mac to connect to the Linux VM, then inspect its system details.</p>
            </header>
            <div className="practical-layout">
                <section className="practical-instructions">
                    <h2>Your tasks</h2>
                    <ol className="challenge-steps">
                        <li>
                            Connect to the VM: <code>ssh very_beginner@10.151.0.67</code>.
                            When prompted, use username <code>very_beginner</code> and password <code>YouLevel0</code>.
                        </li>
                        <li>Find its operating system: <code>cat /etc/os-release</code></li>
                        <li>Identify its CPU: <code>lscpu</code></li>
                        <li>Find total RAM: <code>free -h</code></li>
                        <li>List storage devices: <code>lsblk</code></li>
                        <li>Find its name with <code>hostname</code> and IP addresses with <code>hostname -I</code></li>
                        <li>Check how long it has been running: <code>uptime</code></li>
                    </ol>
                    <p>Work through the commands and use what you find to answer the questions below.</p>
                </section>
                <TerminalLauncher
                    title="Use your Mac terminal"
                    description="Terminal.app should open automatically. You can open it again here if needed."
                    successMessage="Terminal.app opened. Connect to your VM with SSH to begin."
                />
            </div>
            <section className="practical-quiz" aria-labelledby="practical-quiz-title">
                <h2 id="practical-quiz-title">Check what you found</h2>
                {activeQuestion ? (
                    <>
                        <p className="quiz-counter">{completedQuestions.length} of {practicalQuestions.length} correct</p>
                        <h3>{activeQuestion.question}</h3>
                        <p className="quiz-hint">Find it with <code>{activeQuestion.command}</code>.</p>
                        <form onSubmit={checkPracticalAnswer}>
                            <label className="text-answer" htmlFor="practical-answer">
                                Your answer
                                <input
                                    id="practical-answer"
                                    value={answer}
                                    onChange={(event) => { setAnswer(event.target.value); setFeedback(null); }}
                                    disabled={feedback === 'correct'}
                                    autoComplete="off"
                                    spellCheck={false}
                                    placeholder="Type what you found on the VM"
                                />
                            </label>
                            {feedback === 'incorrect' && (
                                <div className="answer-feedback incorrect" role="status">
                                    Not quite. Check the output of <code>{activeQuestion.command}</code> and try again.
                                </div>
                            )}
                            {feedback === 'correct' && (
                                <div className="answer-feedback correct" role="status">
                                    Correct: {activeQuestion.correctAnswer}.
                                </div>
                            )}
                            {feedback === 'correct' ? (
                                completedQuestions.length === practicalQuestions.length ? (
                                    <button className="primary-button" type="button" onClick={() => window.location.assign('/')}>
                                        Enter Level 1
                                    </button>
                                ) : (
                                    <button className="primary-button" type="button" onClick={nextPracticalQuestion}>
                                        Next question
                                    </button>
                                )
                            ) : (
                                <button className="primary-button" type="submit" disabled={!answer.trim()}>
                                    Check answer
                                </button>
                            )}
                        </form>
                    </>
                ) : (
                    <>
                        <p>You answered all {practicalQuestions.length} questions correctly. Level 1 is ready.</p>
                        <button className="primary-button" type="button" onClick={() => window.location.assign('/')}>
                            Enter Level 1
                        </button>
                    </>
                )}
            </section>
        </main>
    );
}
