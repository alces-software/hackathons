import { useState } from 'react';
import { continueInstallationChallenge, level1Complete } from './game/progress';
import TerminalLauncher from './TerminalLauncher';

const vncAddress = 'vnc://localhost:5916';

export default function InstallUbuntuTask()
{
    const [unlocked] = useState(level1Complete);

    const enterChapter3 = () =>
    {
        continueInstallationChallenge();
        window.location.assign('/');
    };

    if (!unlocked)
    {
        return (
            <main className="practical-page installation-page">
                <a className="back-link" href="/">← Back to game</a>
                <section className="practical-instructions">
                    <h1>Installation trial locked</h1>
                    <p>Complete the six Chapter 2 lessons to open this challenge.</p>
                </section>
            </main>
        );
    }

    return (
        <main className="practical-page installation-page">
            <a className="back-link" href="/">← Back to game</a>
            <header className="practical-header">
                <span>Chapter 02 · Installation trial</span>
                <h1>Install Ubuntu on a VM</h1>
                <p>Open a secure tunnel to the VM console, connect with Screen Sharing, and complete the Ubuntu installer.</p>
            </header>
            <div className="practical-layout">
                <section className="practical-instructions">
                    <h2>Your mission</h2>
                    <ol className="challenge-steps">
                        <li>
                            Run this in Terminal.app: <code>ssh -N -L 5916:127.0.0.1:5916 rnd@ravage</code>
                        </li>
                        <li>Keep that Terminal window open. The tunnel stays running without showing a normal shell prompt.</li>
                        <li>
                            Open <a href={vncAddress}>{vncAddress}</a> in Screen Sharing to view the VM console. If the link does not launch it, use Finder → Go → Connect to Server and enter the same address.
                        </li>
                        <li>In the VM console, launch the Ubuntu installer. Choose the language and keyboard, then follow the prompts to select the target disk and create an account.</li>
                        <li>When installation finishes, reboot the VM and sign in to Ubuntu.</li>
                    </ol>
                </section>
                <TerminalLauncher
                    title="Open the console"
                    description="Terminal.app opens automatically. Run the tunnel command there, then open the VNC address."
                    successMessage="Terminal.app opened. Keep the SSH tunnel running while you use VNC."
                >
                    <a className="secondary-button" href={vncAddress}>Open VNC</a>
                </TerminalLauncher>
            </div>
            <section className="practical-quiz installation-next" aria-labelledby="installation-next-title">
                <span className="quiz-counter">CHAPTER 02 // INSTALLATION TRIAL</span>
                <h2 id="installation-next-title">Ready for the next chapter?</h2>
                <p>Once you have installed Ubuntu, continue to infrastructure automation.</p>
                <button className="primary-button" type="button" onClick={enterChapter3}>
                    Continue to Chapter 3 →
                </button>
            </section>
        </main>
    );
}
