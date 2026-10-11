# Drive Recordings

Real Navigation Sessions recorded on the Navigation Phone with the Android forwarder's **Record drive** switch. One Raw Guidance Snapshot per line (JSON Lines). Read one with `npm run timeline -- <file>` from `zepp/`.

The `.jsonl` files here are **local only** (gitignored): they hold the real streets of the user's drives and the repo is public. `../drives.test.js` replays whatever is here and skips when nothing is. Keep street names out of this README too.

What the replay checks, against each recording itself:
- the Turn Card shows Google Maps' distance, street and arrow;
- the watch is back on the Waiting Screen after the Navigation Session;
- a new arrow or street with a real distance buzzes as a new Maneuver;
- the distance dropping from beyond 100 m to 100 m or less gives the Turn-Now Alert;
- no two buzzes less than 1 s apart, outside a backlog HyperOS held back.

Recorded on 2026-10-11 (on the Mac that drove them):

| File | Covers |
| ---- | ------ |
| `drive-20261011-135820.jsonl` | Format v2. Two short sessions; the second held back 12 min by HyperOS, then delivered in one burst (ticket 02). |
| `drive-20261011-172649.jsonl` | 8 min: a restart, a reroute, multi-turn, arrival at a named place. |
| `drive-20261011-173518.jsonl` | 5 min: multi-turn, two turns in a row with the same arrow onto the same street, arrival. |
| `drive-20261011-182917.jsonl` | 2 min: a reroute straight into a turn ("0 m" placeholder, then the turn 0.6 s later). |
| `drive-20261011-183613.jsonl` | 17 min: a reroute while leaving, a 4 km stretch, arrival at a named place. |
| `drive-20261011-205222.jsonl` | 15 min: a reroute at the start, "toward" streets, two turns in a row with the same arrow and street, arrival. |
