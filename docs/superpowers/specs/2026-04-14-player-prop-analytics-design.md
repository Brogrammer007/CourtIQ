# Player Prop Analytics — Design Spec
**Date:** 2026-04-14  
**Branch:** `feature/player-prop-analytics`  
**Status:** Approved for planning

---

## Overview

Extend CourtIQ with a dedicated player prop analytics layer focused on:
- Real betting lines (The Odds API) for PTS and REB props
- Per-player confidence scoring with factor breakdown
- Home/Away performance splits
- Defensive matchup analysis (NBA.com possession-level data)
- H2H defensive matchup: how does player X perform when guarded by player Y

This feature does **not** replace existing analytics — it adds a new surface (`PropsPage`) that links from `PlayerPage`.

---

## Architecture

```
CourtIQ/
├── backend/
│   ├── services/
│   │   ├── odds.js          ← NEW: The Odds API integration (TTL 1800s)
│   │   └── nbaStats.js      ← NEW: nba.com matchup scraper (TTL 86400s)
│   ├── utils/
│   │   ├── analytics.js     ← existing — additive only: is_home field in normalizeStat
│   │   └── confidence.js    ← NEW: multi-algorithm confidence engine
│   └── routes/
│       └── players.js       ← existing — add 2 new endpoints
│
└── frontend/src/
    ├── lib/
    │   └── api.js           ← existing — add props() and defensiveMatchup()
    ├── components/
    │   └── ConfidenceMeter.jsx  ← NEW: composite score + factor breakdown UI
    └── pages/
        └── PropsPage.jsx    ← NEW: prop analytics page (/player/:id/props)
```

**Cache TTLs per service:**
| Service | TTL | Reason |
|---------|-----|--------|
| odds.js | 1800s | Odds refresh every ~2 hours |
| nbaStats.js | 86400s | Matchup data updates once daily |
| confidence.js | derived | Pure function — cached via parent endpoint |
| props endpoint | 1800s | Tied to odds TTL |
| matchup endpoint | 86400s | Tied to nbaStats TTL |

---

## Data Sources

### 1. The Odds API (`odds.js`)

**Env var required:** `ODDS_API_KEY`

```
GET /v4/sports/basketball_nba/events
GET /v4/sports/basketball_nba/events/{eventId}/odds
    ?regions=us
    &markets=player_points,player_rebounds,player_points_alternate
    &apiKey={ODDS_API_KEY}
```

**Player name matching:**
- Normalize both Odds API names and ESPN names: strip diacritics, lowercase, remove suffixes (Jr., Sr., III, II)
- Match on `normalized_first + normalized_last`
- If no match found: that player's prop returns `{ line: null, over_odds: null, under_odds: null, odds_available: false }`
- **No synthetic fallback** — `null` means no live odds; UI shows "Odds unavailable" state

**Failure behavior when `ODDS_API_KEY` is not set:** `/api/player/:id/props` still returns stats-based fields (season_avg, home_avg, away_avg, hit_rate_over, confidence) but all odds fields (`line`, `over_odds`, `under_odds`) are `null`. This is not mock data — it is real computed stats, just without a live line.

### 2. NBA.com Matchup Scraper (`nbaStats.js`)

```
GET https://stats.nba.com/stats/matchupsrollup
    ?LeagueID=00
    &PerMode=PerGame
    &Season=2024-25
    &SeasonType=Regular+Season
```

**Required headers:**
```
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36
Referer: https://www.nba.com/
Origin: https://www.nba.com
x-nba-stats-origin: stats
x-nba-stats-token: true
Accept: application/json, text/plain, */*
Accept-Language: en-US,en;q=0.9
```

**Dependency note:** Node's native `fetch` is insufficient for `stats.nba.com` — the endpoint performs TLS fingerprint checks and blocks default Node fetch user agents regardless of headers. Implementation **must use `undici`** (a new npm dependency) with a custom dispatcher, or route requests through a proxy. `undici` is already a transitive dependency of Node 18+ and should be importable directly without adding it to `package.json` in most environments; confirm during implementation and add explicitly if required.

**NBA.com field names (verified against live endpoint schema):**
- `OFF_PLAYER_ID`, `OFF_PLAYER_NAME`
- `DEF_PLAYER_ID`, `DEF_PLAYER_NAME`
- `GP` (games played together)
- `PARTIAL_POSS` (partial possessions defended)
- `PLAYER_PTS` (offensive player points in matchup)
- `DEF_REB` (defensive rebounds — **not** TEAM_REB)
- `FG_PCT` (offensive player FG% in matchup)

**Note:** Field names must be verified against the live `matchupsrollup` response during implementation. NBA.com changes column schemas without notice. The above reflects the current known schema as of 2026-04.

- Dataset cached in-memory (TTL 86400s), single fetch on first request
- `getMatchup(offPlayerId, defPlayerId)` → row or `null`
- `:defenderId` in API endpoints is an **ESPN athlete ID**. Resolution: when loading the nba.com dataset, build a cross-reference index from `DEF_PLAYER_NAME` to `DEF_PLAYER_ID` using the same name normalization as Odds API matching. ESPN ID → name → nba.com ID lookup performed once on dataset load.

### 3. ESPN Gamelog — Home/Away Extension

`espnGetPlayerStats()` currently returns `opponent_id` but not home/away flag.  
The ESPN gamelog event metadata contains `homeAway` per event (`"home"` or `"away"` string).

**Change to `normalizeStat()`:** Add `is_home: Boolean` as a new optional field.

- This is **non-breaking** — `is_home` is an additive field. All existing callers receive it transparently (they do not reference it, so behavior is unchanged).
- If `homeAway` is absent from ESPN metadata, `is_home` defaults to `null` (not assumed).
- `espnGetPlayerStats()` extracts `is_home` from event meta and passes it through the row before `normalizeStat()` is called.

---

## Confidence Engine (`confidence.js`)

### Baseline Algorithm (implemented immediately)

To unblock frontend and endpoint development, a **baseline algorithm** is implemented first using Z-score / Normal CDF — mathematically sound, interpretable, and a strong calibration reference.

`trend()` in `analytics.js` already returns `{ direction: string, delta: number, form: number }` where `form` is a 0–100 numeric score (`clampForm(r.pts * 1.5 + r.ast * 2 + r.reb * 1 + r.fg_pct * 30)`).

```
For each stat (pts or reb):

Factor 1 — Hit Rate (weight: 35%)
  n = min(games available, 15)
  hitRate = count(games where stat > line) / n
  score = round(hitRate * 100)                    // 0–100

Factor 2 — Form Trend (weight: 25%)
  // trend() returns form: number (0–100) + direction: 'up'|'down'|'flat'
  adjustment = direction === 'up' ? +5 : direction === 'down' ? -5 : 0
  score = clamp(form + adjustment, 0, 100)        // 0–100

Factor 3 — Home/Away Split (weight: 20%)
  relevant_avg = next_game.is_home ? home_avg : away_avg
  // stddev over all available games for this stat (up to 15 games)
  // floor at 4.0 to prevent division-by-zero on small samples (4 pts ≈ NBA scoring noise)
  stddev = max(sampleStddev(last 15 game values for stat), 4.0)
  z = (relevant_avg - line) / stddev
  score = round(normalCDF(z) * 100)               // normalCDF = (1 + erf(z/√2)) / 2

Factor 4 — Defensive Matchup (weight: 20%)
  // league avg FG% ≈ 0.470 for NBA 2024-25
  If nba.com matchup data exists for (offPlayerId, defPlayerId):
    z = (fg_pct_allowed - 0.470) / 0.05
    score = clamp(round(50 - z * 15), 0, 100)     // lower FG% allowed = harder = lower score
  Else (teamDefensiveProfile fallback):
    mult = teamDefensiveProfile(opponentId)[archetype_key]
    score = clamp(round((mult - 0.85) / 0.30 * 100), 0, 100)

composite = round(0.35*F1 + 0.25*F2 + 0.20*F3 + 0.20*F4)
```

### Research & Backtest Phase — activation criteria

Runs after baseline is live and ≥100 prop outcomes have been collected in the ESPN gamelog for the current season. Activation gate: **Brier score improvement of >0.02** over baseline on held-out prop outcomes (20% of dataset reserved). If improvement < 0.02, baseline remains.

Steps:
1. For each player/prop in ESPN gamelog, compute predicted probability using all candidate algorithms
2. Bin predictions (0–10%, 10–20%, ... 90–100%) and compare bin hit rate to predicted rate (calibration plot)
3. Compute Brier score per algorithm: `mean((predicted_prob - actual_outcome)²)`
4. If best candidate beats baseline by >0.02 Brier: replace corresponding factor formula(s)
5. Algorithms evaluated: KDE, Bayesian Updating, EWMA (λ tuned by grid search), Poisson Regression, Ensemble

### Factor Structure

| Factor | Weight | Description |
|--------|--------|-------------|
| Hit Rate | 35% | How often player historically exceeded this line (last 15 games) |
| Form Trend | 25% | Recent trajectory via `trend()`, Z-score adjusted |
| Home/Away Split | 20% | Player's home vs away avg vs line (Normal CDF) |
| Defensive Matchup | 20% | nba.com FG% allowed in matchup, or `teamDefensiveProfile()` fallback |

### Output Format

```json
{
  "score": 74,
  "tier": "medium",
  "factors": {
    "hit_rate":  { "score": 80, "label": "Hit 12/15 games over line" },
    "form":      { "score": 85, "label": "Trending up +3.2 PTS" },
    "home_away": { "score": 65, "label": "Away game, avg 27.8 vs line 28.5" },
    "matchup":   { "score": 58, "label": "Avg matchup difficulty (no possession data)" }
  }
}
```

**Confidence tiers:**
| Score | Tier | Interpretation |
|-------|------|----------------|
| 80–100 | 🟢 High | Strong edge |
| 60–79 | 🟡 Medium | Lean — moderate confidence |
| 40–59 | 🟠 Low | Neutral / slight signal |
| 0–39 | 🔴 Against | Fade signal |

---

## New API Endpoints

### `GET /api/player/:id/props`

Returns live odds + stats splits + confidence for PTS and REB props.

**Full response shape:**
```json
{
  "player": {
    "id": 3112335,
    "name": "Nikola Jokic",
    "archetype": "big"
  },
  "next_game": {
    "opponent_id": 21,
    "opponent_name": "San Antonio Spurs",
    "is_home": false
  },
  "props": {
    "points": {
      "line": 28.5,
      "over_odds": -115,
      "under_odds": -105,
      "odds_available": true,
      "season_avg": 29.1,
      "home_avg": 30.4,
      "away_avg": 27.8,
      "home_games": 18,
      "away_games": 17,
      "hit_rate_over": 67,
      "hit_rate_sample": 15,
      "confidence": {
        "score": 74,
        "tier": "medium",
        "factors": {
          "hit_rate":  { "score": 80, "label": "Hit 12/15 games over line" },
          "form":      { "score": 85, "label": "Trending up +3.2 PTS" },
          "home_away": { "score": 65, "label": "Away game, avg 27.8 vs line 28.5" },
          "matchup":   { "score": 58, "label": "Avg matchup difficulty" }
        }
      }
    },
    "rebounds": {
      "line": 12.5,
      "over_odds": -110,
      "under_odds": -110,
      "odds_available": true,
      "season_avg": 13.1,
      "home_avg": 13.8,
      "away_avg": 12.4,
      "home_games": 18,
      "away_games": 17,
      "hit_rate_over": 60,
      "hit_rate_sample": 15,
      "confidence": {
        "score": 58,
        "tier": "low",
        "factors": {
          "hit_rate":  { "score": 60, "label": "Hit 9/15 games over line" },
          "form":      { "score": 70, "label": "Trending flat, form 65/100" },
          "home_away": { "score": 50, "label": "Away game, avg 12.4 vs line 12.5" },
          "matchup":   { "score": 48, "label": "Avg matchup difficulty" }
        }
      }
    }
  }
}
```

**When `ODDS_API_KEY` is missing or player not found in odds feed:**
```json
"points": {
  "line": null,
  "over_odds": null,
  "under_odds": null,
  "odds_available": false,
  ...rest of stats fields still present...
}
```

**Cache TTL:** 1800s

---

### `GET /api/player/:id/matchup/:defenderId`

Both `:id` and `:defenderId` are **ESPN athlete IDs**.

Returns NBA.com possession-level matchup data.

**Full response shape:**
```json
{
  "offender": { "id": 3112335, "name": "Nikola Jokic" },
  "defender":  { "id": 1631104, "name": "Victor Wembanyama" },
  "matchup_data": {
    "games_played": 3,
    "partial_possessions": 42,
    "pts_per_possession": 0.87,
    "fg_pct_allowed": 0.461,
    "def_reb_in_matchup": 8,
    "sample_note": "42 possessions across 3 games"
  },
  "vs_season_avg": {
    "pts_diff_pct": -12.4,
    "fg_pct_diff_pct": -8.7
  },
  "verdict": {
    "label": "Tough matchup",
    "tone": "down",
    "emoji": "🧊"
  }
}
```

**Error responses:**

| Condition | Status | Body |
|-----------|--------|------|
| `defenderId` is not a known ESPN athlete ID | 404 | `{ "error": "Defender not found." }` |
| Both players valid, but no shared matchup rows in nba.com dataset | 404 | `{ "error": "No matchup data found between these players this season." }` |
| nba.com dataset fetch failed (network/TLS error) | 503 | `{ "error": "Matchup data temporarily unavailable." }` |

**No fallback on this endpoint.** Unlike the props endpoint (which uses `teamDefensiveProfile()` for Factor 4), the `/matchup` endpoint is explicitly for possession-level data. If that data is unavailable, it returns an error — it does not substitute approximate data. The props endpoint's Factor 4 fallback is internal only and is not exposed here.

**Cache TTL:** 86400s

---

## Frontend

### `PropsPage.jsx` — route: `/player/:id/props`

```
[← Back to Player]  Nikola Jokic — Props & Confidence

┌──────────────────────────┐  ┌──────────────────────────┐
│  POINTS                  │  │  REBOUNDS                 │
│  Line: 28.5              │  │  Line: 12.5               │
│  Over: -115  Under: -105 │  │  Over: -110  Under: -110  │
│  Season: 29.1            │  │  Season: 13.1             │
│  Home: 30.4  Away: 27.8  │  │  Home: 13.8  Away: 12.4   │
│  Hit: ████░ 12/15 (67%)  │  │  Hit: ███░░ 9/15 (60%)    │
│  ┌─── ConfidenceMeter ─┐ │  │  ┌─── ConfidenceMeter ─┐  │
│  │      74%  🟡        │ │  │  │      58%  🟠        │  │
│  │ Hit Rate  ████ 80   │ │  │  │ ...                 │  │
│  │ Form      ████ 85   │ │  │  └─────────────────────┘  │
│  │ Home/Away ███░ 65   │ │  └──────────────────────────┘
│  │ Matchup   ███░ 58   │ │
│  └─────────────────────┘ │
└──────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  DEFENSIVE MATCHUP                                    │
│  Search defender: [________________] [Analyze]        │
│                                                       │
│  Jokic vs Wembanyama — 42 possessions, 3 games        │
│  PTS/poss: 0.87  (-12.4% vs season)                   │
│  FG%: 46.1%      (-8.7% vs season)                    │
│  DEF REB: 8                     🧊 Tough matchup      │
└──────────────────────────────────────────────────────┘
```

**Odds unavailable state:** When `odds_available: false`, the line/odds cells render as `"—"` with a small "No live odds" badge. Confidence still renders (it uses stats, not odds).

### `ConfidenceMeter.jsx`

Props: `{ score: number, tier: string, factors: object }`

- SVG circle with arc drawn from 0 to `score` via Framer Motion on mount
- Circle stroke color: green (High) / yellow (Medium) / orange (Low) / red (Against)
- 4 factor rows below circle: label + mini progress bar + score number
- Uses `.glass` class

### `api.js` additions

```js
props: (id) => j(`/player/${id}/props`),
defensiveMatchup: (offId, defId) => j(`/player/${offId}/matchup/${defId}`),
```

### `PlayerPage.jsx` addition

Single button added to existing player header:
```
[View Props & Confidence →]   links to /player/:id/props
```

---

## Dependency Decision

| Package | Required for | Added to package.json? |
|---------|-------------|------------------------|
| `undici` | nba.com TLS fetch | Only if not available as Node built-in transitive dep — verified during implementation |

All other new functionality uses native `fetch`.

---

## Environment Variables

| Variable | Required | Behavior when absent |
|----------|----------|----------------------|
| `ODDS_API_KEY` | For live odds | Props endpoint returns `odds_available: false`; stats and confidence still work |

---

## What is NOT changing

- `analytics.js` — additive only: `is_home` field in `normalizeStat()`, non-breaking
- `espn.js` — additive only: extract `homeAway` from event meta
- All existing endpoints — unchanged, no behavior regression
- No breaking changes to any existing response shape

---

## Open Questions (resolved during implementation)

1. **Algorithm selection** — Z-score baseline ships first; replaced by backtested best after research phase
2. **Next game detection** — ESPN schedule endpoint `site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/{teamId}/schedule` used to find upcoming opponent
3. **nba.com field names** — verify `DEF_REB` vs `TEAM_REB` and full column list against live endpoint on implementation start
4. **undici availability** — confirm if importable without explicit package.json entry in Node 18+; add if needed
