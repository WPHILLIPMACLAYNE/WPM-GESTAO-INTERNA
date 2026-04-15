# MODES

## Advisory Mode
Default mode.

Allowed:
- read repository state
- create or update `.cortex/` files
- audit structure
- propose plans
- document risks
- define next safe steps

Not allowed by default:
- modify functional code
- change production configuration
- run migrations
- alter infrastructure
- merge branches

Use this mode when:
- the repo state is unclear;
- the project lacks stable structure;
- a first audit is still missing;
- operator authorization is narrow or absent.

## Execution Support Mode
Allowed:
- all Advisory Mode actions
- create support docs
- create tests or harness scaffolding
- create non-functional protective files
- create helper scripts

Still restricted:
- no merge to main
- no destructive operations
- no major functional rewrites without operator instruction

Use this mode when:
- the project needs protection before feature work;
- the operator wants scaffolding, verification aids, or support material;
- core business behavior should remain untouched.

## Controlled Build Mode
Explicit operator authorization required.

Allowed:
- implement scoped code changes
- refactor targeted modules
- add endpoints, services, prompts, tests, or utilities

Always required:
- isolated branch
- clear task definition
- acceptance criteria
- update handoff and status before finishing

Use this mode only when:
- the operator explicitly authorizes build work;
- the target scope is defined enough to verify;
- there is a safe branch baseline to work from.
