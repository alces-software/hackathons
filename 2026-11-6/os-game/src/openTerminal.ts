export async function requestTerminal()
{
    const response = await fetch('/api/open-terminal', {
        method: 'POST',
        headers: { 'X-OS-Game-Action': 'open-terminal' }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Could not open Terminal.app.');
}
