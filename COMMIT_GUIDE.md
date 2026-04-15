# Commit Guide for Codex

## Rules

1. **Only stage files you actually changed.** Never use `git add -A` blindly — check `git status` first and add specific files.
2. **One logical change per commit.** Don't mix unrelated changes (e.g. a prompt fix and a Stripe refactor belong in separate commits).
3. **Always append the co-author trailer** (see format below).

## Commit message format

```
<Short imperative title (≤72 chars)>

- <file or area>: what changed and why
- <file or area>: what changed and why
...

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Title uses **imperative mood**: "Add", "Fix", "Refactor", "Remove" — not "Added" or "Adding".

## Example

```
Fix moderator JSON retry not preserving evidence counts

- council-prompts.ts: pass evidenceCounts into retry prompt so
  confidence calibration survives the fallback path
- council.ts: propagate evidenceCounts from DB query to retryPrompt

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

## How to commit (bash)

```bash
git add src/lib/file-a.ts src/lib/file-b.ts
git commit -m "$(cat <<'EOF'
Title here

- file-a.ts: what and why
- file-b.ts: what and why

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

## What NOT to do

- Do not `git add .` or `git add -A` without reviewing `git status` first
- Do not amend published commits
- Do not skip the co-author trailer
- Do not push unless explicitly asked
