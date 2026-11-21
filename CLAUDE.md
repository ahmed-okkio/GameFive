# GameFive

## Project state file

Every session keeps the shared Claudeck state file as the project overview and keeps it current.

- **Find it:** call `mcp__deck__get_project_state` (a deferred tool; load it with ToolSearch). If the tool isn't available, use `C:\Users\Okkio\AppData\Roaming\Claudeck\projects\8489de35-115a-46d7-b326-5c00f80b4d7f\state.md`.
- **Read it** before starting work, and trust it over your own assumptions.
- **Update it** whenever your work changes what's true:
  - Wayfinder tickets: claim and resolve on the Claudeck board (`claudeck board`, project GameFive), not in the state file; promote any item a resolution unblocks from backlog to to-do. Conventions are in the map's header comment.
  - "Now" lines: what's in progress, waiting, or at risk.
  - Facts another session would otherwise re-derive.
- **Prune as you write:** remove whatever your edit overtakes. Store pointers, not copies. The canonical detail stays in `.wayfinder/mayhem-week/map.md` and its tickets.
