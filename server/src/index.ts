interface RateLimit {
    limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface Env {
    DB: D1Database;
    ADMIN_TOKEN: string;
    INGEST_LIMITER: RateLimit;
    POPULAR_LIMITER: RateLimit;
}

interface IngestPayload {
    ts: string;
    alias: string;
    command: string;
    args: string[];
    version: string;
    success: boolean;
    durationMs: number;
    id: string;
    os?: string;
    node?: string;
}

const ICON_COMMANDS = new Set(['add-icon', 'add']);
const COMPONENT_COMMANDS = new Set(['add-component', 'add-comp']);
const VALUE_FLAGS = new Set(['-f', '--format', '-d', '--dir']);

function extractNames(args: string[]): string[] {
    const names: string[] = [];
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (!a) continue;
        if (a.startsWith('-')) {
            if (VALUE_FLAGS.has(a)) i++;
            continue;
        }
        names.push(a.toLowerCase());
    }
    return names;
}

function classify(command: string): 'icons' | 'components' | null {
    if (ICON_COMMANDS.has(command)) return 'icons';
    if (COMPONENT_COMMANDS.has(command)) return 'components';
    return null;
}

function clientKey(req: Request): string {
    return req.headers.get('CF-Connecting-IP')
        ?? req.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
        ?? 'unknown';
}

async function checkLimit(limiter: RateLimit, key: string): Promise<Response | null> {
    const { success } = await limiter.limit({ key });
    if (success) return null;
    return new Response('Too many requests', {
        status: 429,
        headers: { 'Retry-After': '60' },
    });
}

export default {
    async fetch(req: Request, env: Env): Promise<Response> {
        const url = new URL(req.url);
        if (req.method === 'GET' && url.pathname === '/health') return health(env);
        if (req.method === 'POST' && url.pathname === '/') return ingest(req, env);
        if (req.method === 'GET' && url.pathname === '/popular') return popular(url, env, req);
        if (req.method === 'DELETE' && url.pathname === '/') return reset(req, env);
        return new Response('Not found', { status: 404 });
    },
};

async function health(env: Env): Promise<Response> {
    try {
        await env.DB.prepare('SELECT 1').first();
        return Response.json({ status: 'ok', db: 'ok' });
    } catch (err) {
        return Response.json(
            { status: 'degraded', db: 'error', error: err instanceof Error ? err.message : String(err) },
            { status: 503 },
        );
    }
}

async function ingest(req: Request, env: Env): Promise<Response> {
    const limited = await checkLimit(env.INGEST_LIMITER, clientKey(req));
    if (limited) return limited;

    let evt: IngestPayload;
    try {
        evt = await req.json();
    } catch {
        return new Response('Bad JSON', { status: 400 });
    }
    if (!evt.ts || !evt.command || !evt.id) {
        return new Response('Missing required fields', { status: 400 });
    }

    // A: only commands that contribute to popularity are stored. Everything else
    // (list, config, init, stats, --help) is acknowledged but dropped on the floor.
    const kind = classify(evt.command);
    if (!kind) return new Response('ok');

    const names = Array.isArray(evt.args) ? extractNames(evt.args) : [];
    if (names.length === 0) return new Response('ok');

    const inserted = await env.DB.prepare(`
        INSERT INTO events (ts, anon_id, alias, command, version, os, node, success, duration_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        evt.ts,
        evt.id,
        evt.alias ?? 'pphat',
        evt.command,
        evt.version ?? '',
        evt.os ?? null,
        evt.node ?? null,
        evt.success ? 1 : 0,
        evt.durationMs ?? 0,
    ).run();

    // B: dedupe per (anon_id, kind, name, day). Same user re-adding the same
    // icon on the same day is a no-op — INSERT OR IGNORE trips the UNIQUE index.
    const eventId = inserted.meta.last_row_id;
    const day = evt.ts.slice(0, 10);
    const stmt = env.DB.prepare(
        'INSERT OR IGNORE INTO event_names (event_id, ts, anon_id, day, kind, name) VALUES (?, ?, ?, ?, ?, ?)'
    );
    await env.DB.batch(names.map(n => stmt.bind(eventId, evt.ts, evt.id, day, kind, n)));

    return new Response('ok');
}

async function popular(url: URL, env: Env, req: Request): Promise<Response> {
    const limited = await checkLimit(env.POPULAR_LIMITER, clientKey(req));
    if (limited) return limited;

    const type = url.searchParams.get('type');
    if (type !== 'icons' && type !== 'components') {
        return Response.json({ error: 'type must be icons or components' }, { status: 400 });
    }
    const days = Math.max(0, parseInt(url.searchParams.get('days') ?? '0', 10) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '10', 10) || 10));

    let query = 'SELECT name, COUNT(*) AS count FROM event_names WHERE kind = ?';
    const bindings: (string | number)[] = [type];
    if (days > 0) {
        const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
        query += ' AND ts >= ?';
        bindings.push(cutoff);
    }
    query += ' GROUP BY name ORDER BY count DESC LIMIT ?';
    bindings.push(limit);

    const { results } = await env.DB.prepare(query).bind(...bindings).all<{ name: string; count: number }>();
    const rows = (results ?? []).map(r => [r.name, r.count]);
    return Response.json({ rows });
}

async function reset(req: Request, env: Env): Promise<Response> {
    const auth = req.headers.get('Authorization') ?? '';
    if (!env.ADMIN_TOKEN || auth !== `Bearer ${env.ADMIN_TOKEN}`) {
        return new Response('Unauthorized', { status: 401 });
    }
    await env.DB.batch([
        env.DB.prepare('DELETE FROM event_names'),
        env.DB.prepare('DELETE FROM events'),
    ]);
    return new Response('ok');
}
