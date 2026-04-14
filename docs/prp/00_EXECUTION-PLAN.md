# Execution Plan — Player Prop Analytics

**Branch:** `feature/player-prop-analytics`  
**Total phases:** 14 PRPs across 7 waves  
**Rule:** Never start a PRP until all its listed dependencies are ✅ complete.

---

## Dependency Graph

```
PRP-01 (ESPN home/away)
  └── PRP-02 (split utility)
        └── PRP-06 (confidence engine)
                └── PRP-07 (props endpoint)
                        └── PRP-09 (api.js client)
                                └── PRP-10 (ConfidenceMeter)
                                        └── PRP-11 (PropsPage props section)
                                                ├── PRP-12 (PropsPage matchup section)
                                                └── PRP-13 (PlayerPage integration)

PRP-03 (next game) ──────────────────────────────── PRP-07

PRP-04 (odds service)
  └── PRP-05 (nbaStats matchup) ────────────────── PRP-08 (matchup endpoint)
        └────────────────────────────────────────── PRP-09 (api.js client)

PRP-14 (backtest) — unblocked after PRP-06
```

---

## Wave 1 — Parallel start (no dependencies)

> Run all three simultaneously in separate worktrees or sessions.

| PRP | Name | Est. time |
|-----|------|-----------|
| **PRP-01** | ESPN Home/Away Extension | ~30 min |
| **PRP-03** | Next Game Detection | ~30 min |
| **PRP-04** | Odds API Service | ~45 min |

**What to do:**
```
Agent A → execute PRP-01
Agent B → execute PRP-03
Agent C → execute PRP-04
```

**Wave 1 complete when:** All three PRPs pass their acceptance criteria and tests.

---

## Wave 2 — Parallel (unblocked by Wave 1)

> Start immediately after Wave 1 PRPs they depend on finish.

| PRP | Name | Unblocked by | Est. time |
|-----|------|--------------|-----------|
| **PRP-02** | Home/Away Split Utility | PRP-01 ✅ | ~20 min |
| **PRP-05** | NBA Stats Matchup Service | PRP-04 ✅ | ~60 min |

**What to do:**
```
Agent A → execute PRP-02 (as soon as PRP-01 done)
Agent B → execute PRP-05 (as soon as PRP-04 done)
```

**Wave 2 complete when:** Both PRPs pass their acceptance criteria.

---

## Wave 3 — Parallel

| PRP | Name | Unblocked by | Est. time |
|-----|------|--------------|-----------|
| **PRP-06** | Confidence Engine | PRP-01 ✅, PRP-02 ✅ | ~45 min |
| **PRP-08** | Matchup API Endpoint | PRP-05 ✅ | ~30 min |
| **PRP-14** | Backtest Framework | PRP-06 ✅ | ~60 min |

**Notes:**
- PRP-06 and PRP-08 are fully independent — run in parallel.
- PRP-14 can start as soon as PRP-06 is done. It does not block any other PRP.

```
Agent A → execute PRP-06
Agent B → execute PRP-08
Agent C → execute PRP-14 (after PRP-06 done, non-blocking)
```

---

## Wave 4 — Sequential

> PRP-07 requires all backend services to be in place.

| PRP | Name | Unblocked by | Est. time |
|-----|------|--------------|-----------|
| **PRP-07** | Props API Endpoint | PRP-01 ✅, PRP-02 ✅, PRP-03 ✅, PRP-04 ✅, PRP-06 ✅ | ~45 min |

**What to do:**
```
Single agent → execute PRP-07
```

**Wave 4 complete when:** `GET /api/player/:id/props` returns the full response shape and all 4 integration tests pass.

---

## Wave 5 — Sequential

> Frontend setup must be done before any frontend components.

| PRP | Name | Unblocked by | Est. time |
|-----|------|--------------|-----------|
| **PRP-09** | Frontend API Client | PRP-07 ✅, PRP-08 ✅ | ~20 min |

**What to do:**
```
Single agent → execute PRP-09
  - installs vitest + @testing-library/react
  - adds api.props() and api.defensiveMatchup()
  - verifies 3 tests pass
```

---

## Wave 6 — Sequential

> ConfidenceMeter must exist before PropsPage renders it.

| PRP | Name | Unblocked by | Est. time |
|-----|------|--------------|-----------|
| **PRP-10** | ConfidenceMeter Component | PRP-09 ✅ | ~45 min |

**What to do:**
```
Single agent → execute PRP-10
  - builds SVG arc component
  - verifies 6 tests pass
```

---

## Wave 7 — Parallel finish

> All three can run simultaneously once PRP-10 and PRP-09 are done.

| PRP | Name | Unblocked by | Est. time |
|-----|------|--------------|-----------|
| **PRP-11** | PropsPage — Props Section | PRP-09 ✅, PRP-10 ✅ | ~60 min |

Then after PRP-11:

| PRP | Name | Unblocked by | Est. time |
|-----|------|--------------|-----------|
| **PRP-12** | PropsPage — Matchup Section | PRP-11 ✅ | ~45 min |
| **PRP-13** | PlayerPage Integration | PRP-11 ✅ | ~15 min |

**What to do:**
```
Single agent → execute PRP-11
Then parallel:
  Agent A → execute PRP-12
  Agent B → execute PRP-13
```

---

## Full Timeline (optimal parallel execution)

```
Time →

Wave 1   PRP-01 ████
         PRP-03 ███
         PRP-04 ████

Wave 2        PRP-02 ██         (starts after PRP-01)
              PRP-05 █████      (starts after PRP-04)

Wave 3             PRP-06 ████  (starts after PRP-02)
                   PRP-08 ███   (starts after PRP-05)
                   PRP-14 █████ (starts after PRP-06, non-blocking)

Wave 4                  PRP-07 ████  (starts after PRP-03 + PRP-06 done)

Wave 5                       PRP-09 ██  (starts after PRP-07 + PRP-08)

Wave 6                            PRP-10 ████  (starts after PRP-09)

Wave 7                                 PRP-11 █████  (starts after PRP-10)
                                            PRP-12 ████  (parallel after PRP-11)
                                            PRP-13 █  (parallel after PRP-11)
```

**Estimated total time (sequential):** ~9.5 hours  
**Estimated total time (max parallel):** ~4.5 hours

---

## Completion Checklist

Before merging `feature/player-prop-analytics` to main:

- [ ] PRP-01 — all 3 unit tests pass, `is_home` field in ESPN rows
- [ ] PRP-02 — all 7 unit tests pass
- [ ] PRP-03 — all 3 unit tests pass
- [ ] PRP-04 — all 4 unit tests pass
- [ ] PRP-05 — all 4 unit tests pass
- [ ] PRP-06 — all 9 unit tests pass
- [ ] PRP-07 — all 4 integration tests pass, endpoint returns correct shape
- [ ] PRP-08 — all 3 integration tests pass, 404/503 errors correct
- [ ] PRP-09 — all 3 vitest tests pass, vitest configured
- [ ] PRP-10 — all 6 vitest tests pass
- [ ] PRP-11 — all 6 vitest tests pass
- [ ] PRP-12 — all 9 vitest tests pass (6 + 3 new)
- [ ] PRP-13 — all 2 vitest tests pass, route registered
- [ ] PRP-14 — all 12 unit tests pass, script runs without errors
- [ ] No regressions — all existing endpoints still return correct data
- [ ] `ODDS_API_KEY` documented in `.env.example`

---

## How to Execute a PRP

For each PRP, the command to give Claude is:

```
Execute PRP-XX: read docs/prp/XX_PRP_NAME.md fully,
follow the TDD cycle exactly (write test first, verify RED,
implement, verify GREEN, refactor), then confirm all
acceptance criteria are met.
```

Do not skip the RED phase. Do not write implementation before the test.
