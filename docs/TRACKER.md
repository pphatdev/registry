# Usage Tracker

`@pphatdev/registry` ships with a lightweight, privacy-respecting usage tracker that records every CLI invocation locally so you can review your own activity with `pphat stats`. Optionally, the same events can be forwarded to a remote endpoint you control.

- **Local first** — every run is appended to `~/.pphat/history.jsonl` on your machine.
- **Opt-in remote** — nothing is sent to the network unless you configure an endpoint yourself.
- **Zero performance cost** — telemetry failures never break the CLI (writes are best-effort, remote uploads use a 1.5s timeout).
- **Anonymous** — remote events are tagged with a 16-char SHA-256 hash of `hostname|username`, not raw identity.

---

## 1. What gets recorded

Every command invocation appends one JSON line to the history file with this shape:

```jsonc
{
  "ts": "2026-07-27T10:15:32.104Z", // ISO timestamp
  "alias": "pphat",                  // which bin was called (pphat | pphatdev | @pphatdev/registry)
  "command": "add-icon",             // the subcommand, or "(root)" if none
  "args": ["react", "vue"],          // arguments after the subcommand
  "version": "1.2.0",                // CLI version at time of run
  "success": true,                   // whether the command threw
  "durationMs": 842                  // wall-clock duration
}
```

No file contents, project paths, or personal identifiers are captured.

---

## 2. Viewing your stats

The `stats` command reads the local history file and prints a summary.

```bash
# All-time totals
npx pphat stats

# Only the last 7 days
npx pphat stats --days 7

# Wipe the local history file
npx pphat stats --clear
```

Example output:

```
Total runs (last 7 days): 42
  success: 40   failed: 2

By alias:
  pphat      38
  pphatdev    4

By command:
  add-icon        22
  add-component    9
  list             6
  init             3
  config           2

By day:
  2026-07-27   11
  2026-07-26    8
  2026-07-25    6
  ...
```

---

## 3. Opting out

Disable tracking either per-run or globally:

```bash
# One-off: skip telemetry for a single invocation
npx pphat add-icon react --no-telemetry

# Persistent: set an environment variable (0 or false)
$env:PPHAT_TELEMETRY = "0"       # PowerShell
export PPHAT_TELEMETRY=0          # bash / zsh
```

When disabled, nothing is written locally and nothing is sent remotely.

---

## 4. Sending events to your own endpoint (optional)

If you want to aggregate usage across a team or your own analytics stack, point the CLI at an HTTPS endpoint you control:

```bash
$env:PPHAT_TELEMETRY_ENDPOINT = "https://your-collector.example.com/pphat"
```

Each event is POSTed as JSON with these extra fields added:

```jsonc
{
  ...runEvent,
  "id":  "e3b0c44298fc1c14",  // anonymous, stable per machine+user
  "os":  "win32",
  "node": "20.12.2"
}
```

Notes:
- The request is fire-and-forget with a 1.5-second timeout; failures are swallowed.
- The `User-Agent` header is `pphat-cli/<version> (<platform>; node<version>)`.
- If `PPHAT_TELEMETRY_ENDPOINT` is unset, no network call is made.

---

## 5. History file location

| Platform | Path |
|---|---|
| Windows | `%USERPROFILE%\.pphat\history.jsonl` |
| macOS / Linux | `~/.pphat/history.jsonl` |

The file is plain JSONL — one event per line — so it's easy to inspect or pipe through `jq`:

```bash
# Last 10 events (any shell with node)
node -e "require('fs').readFileSync(require('os').homedir()+'/.pphat/history.jsonl','utf8').trim().split('\n').slice(-10).forEach(l=>console.log(JSON.parse(l)))"
```

To reset, either delete the file manually or run `pphat stats --clear`.

---

## 6. Precedence summary

| Signal | Result |
|---|---|
| `--no-telemetry` flag on the command | Skip local + remote for this run |
| `PPHAT_TELEMETRY=0` or `PPHAT_TELEMETRY=false` | Skip local + remote for all runs |
| `PPHAT_TELEMETRY_ENDPOINT` unset | Local only |
| `PPHAT_TELEMETRY_ENDPOINT` set | Local + remote POST |
