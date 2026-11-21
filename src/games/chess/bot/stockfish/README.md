# Stockfish adapter

`createStockfishBot({ level, onStatus, workerFactory? })` owns one persistent classic Web Worker for a local game session and returns `{ ready, choose, stop }`.

- `ready` resolves after UCI identification, configuration and `readyok`. Startup rejection has an internal handler so loading before the first bot turn cannot create an unhandled rejection.
- `choose(game)` returns a Promise of the existing `Action`, or null when the game has ended or there are no legal moves. Use the existing `attachBot` to decide whose turn is controlled by the bot.
- `stop()` is idempotent, settles pending work with an `AbortError`, clears timers and terminates the worker.
- `onStatus` receives `{ state, message, level, engineName }`. States are loading, ready, thinking, error and stopped. Errors do not silently fall back to the old simple bot. Retrying should create a new adapter for the same Room if moves must be preserved.

The asset URL is `BASE_URL + stockfish/stockfish.js`, with the locally staged single-thread WebAssembly build beside it. Binary version, source and license belong with those assets.

## Difficulty

`BOT_LEVELS` contains six immutable presets: beginner, easy, medium, hard, expert, master. Each contains `key`, Vietnamese `label`/`description`, UCI `skill`, `depth`, and `moveTime` in milliseconds. The adapter disables UCI_LimitStrength where supported so Skill Level remains authoritative, then applies both depth and thinking-time ceilings. These are product levels, not measured Elo ratings.

## Position and lifecycle

`gameToFen` preserves piece placement, side to move, castling rights inferred from the original-square king/rook `hasMoved` flags and en-passant target. The current Game model does not contain move counters or repetition history, so FEN counters are neutral `0 1`. Local move validation and outcomes remain controlled by the app reducer.

`parseUciMove` validates returned coordinates with `getAllLegalMoves`. Castling and en passant are ordinary source/destination UCI moves; the reducer applies their special effects. All four promotion choices are preserved for the next `choose` call that completes the app's separate promotion step.

Concurrent calls cancel the prior search, drain its final bestmove and serialize the new position, preventing a late bestmove from being applied to a new game. Loading and search timeouts fail visibly instead of leaving an indefinite thinking state.

## Tests

Run `node --test src/games/chess/bot/stockfish/stockfish.test.js`. The injected FakeWorker tests protocol and lifecycle behavior without downloading an engine or opening a browser. A separate smoke test with the actual staged engine is still required for the final integration.
