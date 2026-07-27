import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

export interface RunEvent {
    ts: string;
    alias: string;
    command: string;
    args: string[];
    version: string;
    success: boolean;
    durationMs: number;
}

const HOME = os.homedir();
export const HISTORY_DIR = path.join(HOME, '.pphat');
export const HISTORY_FILE = path.join(HISTORY_DIR, 'history.jsonl');

// Set at build/publish time to enable global "track all users" aggregation.
// Users can override at runtime with PPHAT_TELEMETRY_ENDPOINT.
// Backend contract:
//   POST   <endpoint>            → ingest a RunEvent + { id, os, node } payload
//   GET    <endpoint>/popular    → { rows: [[name, count], ...] }
//          ?type=icons|components&days=N&limit=M
//   DELETE <endpoint>            → wipe aggregate store (admin only)
//          Authorization: Bearer <PPHAT_ADMIN_TOKEN>
const DEFAULT_REMOTE_ENDPOINT = 'https://pphat-telemetry.pphatdev.workers.dev';

export function getEndpoint(): string {
    return process.env.PPHAT_TELEMETRY_ENDPOINT || DEFAULT_REMOTE_ENDPOINT;
}

function isDisabled(argv: string[]): boolean {
    if (process.env.PPHAT_TELEMETRY === '0' || process.env.PPHAT_TELEMETRY === 'false') return true;
    if (argv.includes('--no-telemetry')) return true;
    return false;
}

export function anonymousId(): string {
    const seed = `${os.hostname()}|${os.userInfo().username}`;
    return crypto.createHash('sha256').update(seed).digest('hex').slice(0, 16);
}

async function appendLocal(event: RunEvent): Promise<void> {
    if (!existsSync(HISTORY_DIR)) {
        await fs.mkdir(HISTORY_DIR, { recursive: true });
    }
    await fs.appendFile(HISTORY_FILE, JSON.stringify(event) + '\n', 'utf-8');
}

async function sendRemote(event: RunEvent): Promise<void> {
    const endpoint = getEndpoint();
    if (!endpoint) return;
    try {
        await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': `pphat-cli/${event.version} (${process.platform}; node${process.versions.node})`,
            },
            body: JSON.stringify({
                ...event,
                id: anonymousId(),
                os: process.platform,
                node: process.versions.node,
            }),
            signal: AbortSignal.timeout(1500),
        });
    } catch {
        // silently ignore telemetry errors — never break the CLI
    }
}

export async function record(event: Omit<RunEvent, 'ts'>): Promise<void> {
    if (isDisabled(process.argv)) return;
    const full: RunEvent = { ts: new Date().toISOString(), ...event };
    try {
        await appendLocal(full);
    } catch {
        // if local write fails, still try remote
    }
    await sendRemote(full);
}

export interface PopularQuery {
    days?: number;
    limit?: number;
}

/**
 * Fetch aggregate popularity from the remote registry.
 * Returns null when no endpoint is configured, [] when the endpoint has no data.
 */
export async function fetchPopular(
    type: 'icons' | 'components',
    query: PopularQuery = {},
): Promise<[string, number][] | null> {
    const endpoint = getEndpoint();
    if (!endpoint) return null;

    const url = new URL(endpoint.replace(/\/$/, '') + '/popular');
    url.searchParams.set('type', type);
    if (query.days) url.searchParams.set('days', String(query.days));
    if (query.limit) url.searchParams.set('limit', String(query.limit));

    const res = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
        throw new Error(`Remote stats request failed: ${res.status} ${res.statusText}`);
    }
    const data = await res.json() as { rows?: [string, number][] };
    return data.rows ?? [];
}

/**
 * Wipe the remote aggregate store. Admin-only — requires PPHAT_ADMIN_TOKEN.
 * Returns 'no-endpoint' | 'no-token' | 'ok'. Throws on HTTP failure.
 */
export async function resetRemote(): Promise<'no-endpoint' | 'no-token' | 'ok'> {
    const endpoint = getEndpoint();
    if (!endpoint) return 'no-endpoint';
    const token = process.env.PPHAT_ADMIN_TOKEN;
    if (!token) return 'no-token';

    const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
            Authorization: `Bearer ${token}`,
            'User-Agent': 'pphat-cli-admin',
        },
        signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
        throw new Error(`Remote reset failed: ${res.status} ${res.statusText}`);
    }
    return 'ok';
}
