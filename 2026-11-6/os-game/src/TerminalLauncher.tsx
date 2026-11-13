import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { requestTerminal } from './openTerminal';

type TerminalLauncherProps = {
    title: string;
    description: string;
    successMessage: string;
    children?: ReactNode;
};

export default function TerminalLauncher({ title, description, successMessage, children }: TerminalLauncherProps)
{
    const [opening, setOpening] = useState(false);
    const [opened, setOpened] = useState(false);
    const [terminalError, setTerminalError] = useState<string | null>(null);
    const openedAutomatically = useRef(false);

    const openTerminal = useCallback(async () =>
    {
        setOpening(true);
        setTerminalError(null);
        try
        {
            await requestTerminal();
            setOpened(true);
        }
        catch (reason)
        {
            setTerminalError(reason instanceof Error ? reason.message : 'Could not open Terminal.app.');
        }
        finally
        {
            setOpening(false);
        }
    }, []);

    useEffect(() =>
    {
        if (openedAutomatically.current) return;
        openedAutomatically.current = true;
        void openTerminal();
    }, [openTerminal]);

    return (
        <section className="terminal-launch" aria-label="Open Terminal.app">
            <div className="terminal-launch-icon" aria-hidden="true">&gt;_</div>
            <h2>{title}</h2>
            <p>{description}</p>
            <div className="installation-actions">
                <button className="primary-button" type="button" onClick={() => void openTerminal()} disabled={opening}>
                    {opening ? 'Opening Terminal.app…' : 'Open Terminal.app'}
                </button>
                {children}
            </div>
            {opened && !terminalError && <p className="terminal-success" role="status">{successMessage}</p>}
            {terminalError && <p className="terminal-error" role="alert">{terminalError}</p>}
        </section>
    );
}
