# OpenCode Adapter

Read `START.md`, `PROTOCOL.md`, and `MODES.md` first.

Before any work:
- inspect git remote and current branch;
- inspect recent branches and recent commits;
- inspect `.cortex/CURRENT_STATUS.md` if `.cortex/` already exists;
- identify the last stable branch;
- create a new isolated branch from it.

Default posture:
- Advisory Mode unless the operator explicitly authorizes build work;
- repository files are the source of truth;
- unknown state means audit first, implementation later;
- never merge to main.
