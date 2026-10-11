# Wristpilot

Mirrors Google Maps turn-by-turn guidance from an Android phone onto a Zepp OS watch (Amazfit Active Max). Three parts: an Android forwarder (Kotlin) that reads Google Maps' navigation notification, a Guidance core in the Zepp side service (JavaScript) that holds all navigation logic, and a Zepp OS watch app that renders the Turn Card.

Read before any work:
- `CONTEXT.md`: the glossary. Use its terms in code, tests, commits and replies; avoid the words it lists under _Avoid_.
- `docs/adr/`: decisions already made. Don't reverse one without asking.
- `.scratch/turn-card/spec.md`: the v1 spec.
- `docs/research/`: research behind the decisions.

The user's devices: Xiaomi Redmi 13C, HyperOS 2, Android 15 (the Navigation Phone; Google Maps in English) and Amazfit Active Max, Zepp OS API level 4.2, round 480×480. Personal use, sideloaded; no store publishing.

## "next ticket"

When the user says **"next ticket"** (or "continue", "do the next one"), do this without asking first:

1. Read the files listed above.
2. List `.scratch/turn-card/issues/` and pick the **lowest-numbered ticket whose `**Status:**` is not `done` and whose "Blocked by" tickets are all `done`**. Say which ticket you're starting and why in one line. If a ticket is `in-progress`, resume it instead.
3. Set its status to `in-progress`.
4. Build it. Use `/mattpocock-skills:tdd` for anything touching the Guidance core: test only through its seam (Raw Guidance Snapshots + time in → Turn Card Views + Buzz commands out), never its internals. Keep the Android forwarder free of navigation logic.
5. In every ticket except 09, never stop or wait for the user: they finish every ticket first and test everything at once in ticket 09, which comes last. Any criterion that needs the user (a "Manual check (by the user)", or anything you can't verify yourself: looking at the watch or simulator, the phone, a drive) stays unticked with "_(checked in ticket 09)_", and is listed under "Checks moved here" in ticket 09. Split a criterion if part of it you can verify. Tell the user in the report what ticket 09 will cover. Only in ticket 09, when a criterion says **"Needs the user"**, stop and tell the user exactly what to do (on the phone, the watch, or in the car). Never mark a user's check done yourself and never fake it.
6. Commit the ticket's work on `main` with a message starting with the ticket number, e.g. `03: Turn Card from the Guidance core`.
7. Run **`/mattpocock-skills:code-review`** on that commit (review since the commit before it, against this ticket as the spec). Fix every real finding, re-run the tests, and commit the fixes as `NN: address code review`.
8. Tick the acceptance criteria that are met. Set the status to `done` when all are met apart from checks deferred to ticket 09; a check waiting on the user never keeps a ticket `in-progress`.
9. Finish with a short report: what was built, review findings and fixes, what the user must check by hand, and which ticket is next.

One ticket per session. Don't start the next ticket in the same session; tell the user to `/clear` and say "next ticket".

Exception: ticket 08 (Mini Map prototype) is built on a `prototype/mini-map` branch; only its findings write-up goes to `main`.

## Status values

`ready-for-agent` → `in-progress` → `done`. The status line in each ticket file is the source of truth.
