# 📊 Anonymous Usage Telemetry

This CLI collects anonymous usage stats so we can see which icons and components are most useful to the community and prioritize what to add next. **Telemetry is on by default** — here's exactly what's collected and how to turn it off.

## What is collected

Every command you run appends a line to your local log at `~/.pphat/history.jsonl`, and — for `add-icon` and `add-component` runs only — a small payload is sent to the popularity backend:

| Field | Example | Why |
|---|---|---|
| `command` | `add-icon` | To count popular commands |
| `args` (item names only) | `["react", "vue"]` | To rank which icons/components are most requested |
| `version` | `1.4.0` | To see which CLI versions are in use |
| `os`, `node` | `win32`, `22.23.1` | Platform coverage |
| `success`, `durationMs` | `true`, `1614` | To catch performance regressions |
| `id` | 16-char hash | Anonymous, per-machine (see below) |

**What is NOT collected:** file paths, project names, code, config contents, environment variables, IP addresses stored long-term, or anything that could identify you.

The anonymous `id` is a SHA-256 of `hostname|username` truncated to 16 chars — derived locally, never reversible to your actual identity. Its only purpose is to dedupe: one machine adding the same icon 10 times counts as 1 vote per day, so heavy users don't skew the rankings.

## How to opt out

Any of these works:

```bash
# Disable for a single command
pphat add-icon react --no-telemetry

# Disable for your whole shell session
export PPHAT_TELEMETRY=0        # macOS / Linux
$env:PPHAT_TELEMETRY = "0"      # PowerShell
set PPHAT_TELEMETRY=0           # cmd.exe

# Disable permanently — add the export to your shell rc file
```

Setting `PPHAT_TELEMETRY=0` (or `false`) disables both the local log and the remote send.

## Point it somewhere else (self-hosting)

If you want to run your own telemetry backend (the worker source lives in `server/`), point the CLI at it:

```bash
export PPHAT_TELEMETRY_ENDPOINT=https://your-worker.example.workers.dev
```

## See the popular items

Anyone can query the aggregate rankings from the shared backend:

```bash
pphat stats --top-icons --remote
pphat stats --top-components --remote
pphat stats --top-icons --remote --days 30      # rolling window
```

Without `--remote`, `pphat stats` reads only your own `~/.pphat/history.jsonl` — nothing is sent when you run it.

The full worker source (ingest handler, rate limits, D1 schema) is in [`server/`](../server) for anyone who wants to audit exactly what happens on the receiving end.
