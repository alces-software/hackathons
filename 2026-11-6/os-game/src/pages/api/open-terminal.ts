import { execFile } from 'node:child_process';
import type { NextApiRequest, NextApiResponse } from 'next';

const allowedHosts = new Set(['localhost:8080', '127.0.0.1:8080', '[::1]:8080']);
const loopbackAddresses = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function isLocalRequest(req: NextApiRequest)
{
    if (process.env.NODE_ENV !== 'development' || process.platform !== 'darwin') return false;
    if (!allowedHosts.has(req.headers.host ?? '')) return false;
    if (!loopbackAddresses.has(req.socket.remoteAddress ?? '')) return false;
    if (req.headers['x-os-game-action'] !== 'open-terminal') return false;

    const origin = req.headers.origin;
    if (origin)
    {
        try
        {
            if (new URL(origin).host !== req.headers.host) return false;
        }
        catch
        {
            return false;
        }
    }

    return true;
}

export default function handler(req: NextApiRequest, res: NextApiResponse)
{
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST')
    {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Use POST to open Terminal.app.' });
    }

    if (!isLocalRequest(req))
    {
        return res.status(403).json({ error: 'Terminal.app can only be opened from this Mac at http://localhost:8080 while running the game in development.' });
    }

    execFile('/usr/bin/open', ['-a', 'Terminal'], (error) =>
    {
        if (error)
        {
            return res.status(500).json({ error: `Could not open Terminal.app: ${error.message}` });
        }
        return res.status(200).json({ opened: true });
    });
}
