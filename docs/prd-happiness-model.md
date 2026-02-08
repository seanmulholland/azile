# PRD: The Happiness Model™

## ERNEST Emotional Content Ranking System

> ERNEST is from an era prior to ubiquitous data collection, so it needs you to help train the Happiness Model™ so it can learn what content makes people happiest.

---

## 1. Problem Statement

ERNEST can detect facial emotions in real time, but the experience dead-ends after the typewriter intro. The emotion scores (`max`, plus per-emotion sigmoid values from the classifier) are computed every frame but never stored or acted upon. There is no content for ERNEST to show the user, no mechanism to record how that content made them feel, and no way to surface what ERNEST has "learned."

This phase turns ERNEST from a detection demo into a training loop: show content → measure reaction → store scores → rank what makes people happiest.

## 2. Goals

1. **Score content by emotional reaction.** When ERNEST shows a piece of content, continuously sample the viewer's emotion scores and produce a per-content emotional profile.
2. **Persist scores across sessions.** Store accumulated reaction data in the browser so ERNEST's model survives page reloads.
3. **Surface rankings via a keyboard-controlled dashboard.** Let users flip into a terminal-style rankings view — filtered by emotion — without leaving the experience.
4. **Maintain the aesthetic.** Everything stays green-on-black, Courier New, analog static. The dashboard is part of ERNEST's world, not a dev panel bolted on top.

## 3. Non-Goals

- Server-side storage or multi-user aggregation (all data is local to the browser via `localStorage`)
- Real ML retraining (the SVM emotion classifier is fixed; "learning" means accumulating human reaction data, not updating model weights)
- Mobile/touch support (keyboard-driven)
- GIPHY API integration in this phase (use a static, curated content set — see Section 5)

## 4. Current State

| What exists | What's missing |
|---|---|
| CLM face tracker detects face, computes `faceDistance` | No content delivery after intro |
| Emotion classifier produces 6 sigmoid scores (0–1) every frame, smoothed over 10 frames | Scores are never stored or accumulated |
| `max` global holds dominant emotion index (0–5) | `max` is only consumed by disabled `takeSnapshot()` code |
| Typewriter intro displays, prompts "Type y/n" | No keyboard event listener exists anywhere |
| dat.gui is loaded | Never initialized — unused |
| jQuery, Three.js, D3 all loaded | D3 is unused |

### Current execution dead-end

```
face detected → shader distortion decreases → experienceBegin = true
  → intro() typewriter plays → "Type y/n to continue" displayed
  → NOTHING HAPPENS (no keydown listener)
```

## 5. Content Strategy

### Why a static content set?

Reliable scoring requires controlled variables. If content is randomly pulled from an API, the pool is unbounded, each item is seen at most once, and scores can never be compared or refined. A fixed content set means:

- The same items are shown to the same user (or across users on the same machine) multiple times
- Scores accumulate and stabilize over repeated viewings
- Rankings become meaningful — they reflect genuine preference, not one-shot noise
- ERNEST can "learn" over time (scores converge)

### Content format

Each content item is a simple object:

```javascript
{
  id: "content_001",
  type: "image",            // "image" | "text" | "video" (future)
  src: "content/001.gif",   // local path, no external API dependency
  label: "Cat on a Roomba", // human-readable label for dashboard
  tags: []                  // optional, for future filtering
}
```

### Initial content set

Ship 15–25 curated items (GIFs, images, short text prompts) in a `content/` directory. These are the training set for the Happiness Model™. Variety matters — include items likely to provoke different emotions (funny, surprising, unsettling, sad, neutral) so the ranking system has signal to differentiate.

A manifest file (`content/manifest.js`) declares the full set as a global array, loaded via `<script>` tag like everything else in this project.

## 6. Feature Design

### 6.1 Content Playback Loop

After the intro completes and the user confirms (presses `y`), ERNEST enters the **training loop**:

```
Training Loop:
  1. Select next content item (round-robin through manifest, or weighted random)
  2. Display content in the viewport (replaces the shader/static view)
  3. Sample emotion scores for SAMPLING_DURATION (5–8 seconds)
  4. Compute and store content score (see 6.2)
  5. Brief transition (static flicker, 0.5s)
  6. Repeat from 1
```

Content is displayed in the center of the viewport, styled to match the aesthetic (scanline overlay, slight static, green-tinted or raw depending on type). The face tracker continues running in the background — the overlay canvas remains hidden but `trackingLoop()` keeps updating emotion scores.

ERNEST narrates with short typewriter lines between items:
- `"> Interesting... let me show you something else."`
- `"> I detected [emotion]. Noted."`
- `"> Training sample #14 complete."`

### 6.2 Emotion Scoring Model

#### Per-frame data (already exists)

The emotion classifier already produces this every frame via `meanPredict()`:

```javascript
[
  { emotion: "angry",    value: 0.12 },
  { emotion: "disgusted", value: 0.05 },
  { emotion: "fear",     value: 0.08 },
  { emotion: "sad",      value: 0.15 },
  { emotion: "surprised", value: 0.31 },
  { emotion: "happy",    value: 0.72 }
]
```

#### Per-content scoring

While content is displayed, sample frames at a fixed interval (e.g., every 200ms over a 6-second window = ~30 samples). For each content item viewing:

```javascript
{
  contentId: "content_001",
  timestamp: 1708000000000,
  samples: 30,
  emotions: {
    angry:     { mean: 0.08, peak: 0.14 },
    disgusted: { mean: 0.04, peak: 0.09 },
    fear:      { mean: 0.06, peak: 0.11 },
    sad:       { mean: 0.10, peak: 0.18 },
    surprised: { mean: 0.25, peak: 0.55 },
    happy:     { mean: 0.65, peak: 0.89 }
  },
  dominant: "happy",
  happinessScore: 0.65   // mean happiness value — the Happiness Model™ signal
}
```

#### Aggregate scoring (across multiple viewings)

Each time content is viewed, the new scores are averaged with prior viewings using a running mean:

```javascript
aggregateScore = (previousAggregate * viewCount + newScore) / (viewCount + 1)
```

This means scores stabilize over time. Early noise is smoothed out. ERNEST "learns."

### 6.3 Persistence Layer

All data stored in `localStorage` under a single key: `ernest_happiness_model`.

```javascript
{
  version: 1,
  totalSessions: 4,
  totalViewings: 87,
  content: {
    "content_001": {
      viewCount: 6,
      lastViewed: 1708000000000,
      emotions: {
        angry:     { mean: 0.07 },
        disgusted: { mean: 0.03 },
        fear:      { mean: 0.05 },
        sad:       { mean: 0.09 },
        surprised: { mean: 0.22 },
        happy:     { mean: 0.71 }
      },
      happinessScore: 0.71
    },
    "content_002": { ... }
  }
}
```

**Why `localStorage`?**
- No server, no build system, no dependencies — `localStorage` is the only persistence primitive that fits this project's constraints
- ~5MB limit is more than enough for scoring metadata on 25 content items
- ERNEST is a single-machine experience; local storage matches the concept

### 6.4 Dashboard — The Rankings Terminal

A keyboard-toggled overlay that renders content rankings in ERNEST's terminal style. This is not a separate page — it's a DOM layer that appears over the experience.

#### Activation

- Press `Tab` to toggle the dashboard on/off at any time after the experience begins
- ERNEST acknowledges the toggle with a brief typewriter line:
  - Opening: `"> Accessing Happiness Model™ data..."`
  - Closing: `"> Resuming training..."`

#### Layout

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  > HAPPINESS MODEL™ — TRAINING DATA                  │
│  > Filter: [ALL] HAPPY  ANGRY  SAD  SURPRISED  ...   │
│  > Sessions: 4 | Total viewings: 87                  │
│                                                      │
│  ─────────────────────────────────────────────────    │
│                                                      │
│  RANK  CONTENT              SCORE   VIEWS  DOMINANT  │
│  ─────────────────────────────────────────────────    │
│   01.  Cat on a Roomba      0.89    6×     HAPPY     │
│   02.  Surprise birthday    0.81    5×     SURPRISE  │
│   03.  Kid laughing          0.74    4×     HAPPY     │
│   ...                                                │
│   22.  Abandoned building   0.12    3×     SAD       │
│                                                      │
│  > Arrow keys: navigate | Enter: detail | Tab: close │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### Controls

| Key | Action |
|---|---|
| `Tab` | Toggle dashboard open/close |
| `←` `→` | Cycle emotion filter (All → Happy → Angry → Sad → Surprised → Disgusted → Fear) |
| `↑` `↓` | Navigate rows (highlight moves, scrolls if list exceeds viewport) |
| `Enter` | Expand detail view for selected item (shows per-emotion breakdown as a bar chart rendered in monospace block characters) |
| `Esc` | Close detail view (back to list), or close dashboard if no detail open |

#### Detail View

When `Enter` is pressed on a row:

```
  > CONTENT: Cat on a Roomba
  > Views: 6 | Last seen: 2m ago
  >
  > HAPPY     ████████████████████░░░░  0.89
  > SURPRISED ██████████░░░░░░░░░░░░░░  0.42
  > SAD       ██░░░░░░░░░░░░░░░░░░░░░░  0.09
  > ANGRY     █░░░░░░░░░░░░░░░░░░░░░░░  0.07
  > FEAR      █░░░░░░░░░░░░░░░░░░░░░░░  0.05
  > DISGUSTED ░░░░░░░░░░░░░░░░░░░░░░░░  0.03
```

Bar charts use `█` (filled) and `░` (empty) characters — fits the terminal aesthetic and requires no graphics library.

#### Styling

- Same `green` on `#000` as existing terminal text
- `Courier New`, monospace
- Slight CSS text-shadow glow (`0 0 8px rgba(0, 255, 0, 0.6)`) for CRT effect
- The Three.js static shader continues rendering behind the dashboard (visible as subtle noise through a semi-transparent background)

## 7. New File Structure

```
azile/
├── content/                    # NEW — static content repository
│   ├── manifest.js             # Global array of content metadata
│   └── items/                  # Content files (GIFs, images)
│       ├── 001.gif
│       ├── 002.gif
│       └── ...
├── js/
│   ├── scoring.js              # NEW — emotion sampling, score computation, localStorage
│   ├── content_player.js       # NEW — content display loop, transitions
│   ├── dashboard.js            # NEW — rankings terminal UI, keyboard navigation
│   ├── keyboard.js             # NEW — global keyboard event handler + dispatch
│   ├── variables.js            # MODIFIED — new globals for playback/dashboard state
│   ├── static_intro.js         # UNCHANGED
│   ├── emotional_analysis.js   # MODIFIED — expose per-emotion scores (not just max)
│   ├── typing.js               # MODIFIED — new ERNEST narration lines
│   └── composer.js             # MODIFIED — integrate content loop + dashboard into draw()
├── style/
│   └── style.css               # MODIFIED — dashboard styles, content display area
└── index.html                  # MODIFIED — new script tags, content container div
```

### Script load order (updated)

```html
<!-- ... existing vendor + lib scripts unchanged ... -->

<!-- Content manifest (before application code) -->
<script src="content/manifest.js"></script>

<!-- Application code (order matters) -->
<script src="js/variables.js"></script>
<script src="js/static_intro.js"></script>
<script src="js/emotional_analysis.js"></script>
<script src="js/typing.js"></script>
<script src="js/scoring.js"></script>          <!-- after emotional_analysis -->
<script src="js/content_player.js"></script>   <!-- after scoring -->
<script src="js/dashboard.js"></script>        <!-- after scoring -->
<script src="js/keyboard.js"></script>         <!-- after dashboard + content_player -->
<script src="js/composer.js"></script>         <!-- last — orchestrates everything -->
```

## 8. Changes to Existing Files

### `emotional_analysis.js`

Expose the full emotion score array, not just `max`:

```javascript
// NEW: store full emotion results for scoring system
var currentEmotions = null;  // array of { emotion, value } objects

function trackingLoop() {
  // ... existing code ...
  var er = ec.meanPredict(cp);
  if (er) {
    currentEmotions = er;  // NEW: expose to scoring.js
    // ... existing max computation unchanged ...
  }
}
```

### `composer.js`

Integrate the content loop and dashboard into the draw cycle:

```javascript
function draw() {
  requestAnimFrame(draw);
  trackingLoop();  // always runs — emotion detection never stops

  if (experienceBegin) {
    if (!introComplete) {
      intro();
      introComplete = true;
    } else if (dashboardOpen) {
      // dashboard renders itself via DOM, no draw() work needed
      // but shaders keep running behind it
      animateStatic();
    } else if (contentPlaying) {
      sampleEmotions();      // NEW: record scores during content playback
      animateStatic();       // shaders still run (subdued) behind content
    }
  } else {
    animateStatic();
  }
}
```

### `typing.js`

Add ERNEST narration lines for the training loop:

```javascript
var ernestLines = {
  transition: [
    ">  Interesting... let me show you something else.",
    ">  I detected %emotion%. Noted.",
    ">  Training sample #%n% complete.",
    ">  Your face told me everything. Processing.",
    ">  The Happiness Model™ is updating."
  ],
  dashboardOpen:  ">  Accessing Happiness Model™ data...",
  dashboardClose: ">  Resuming training...",
  firstContent:   ">  Let's begin. Watch the screen. I'll be watching you."
};
```

### `variables.js`

New globals:

```javascript
var contentPlaying = false;
var dashboardOpen = false;
var currentContentIndex = 0;
var currentEmotions = null;
```

## 9. Implementation Plan

### Phase A: Foundation (keyboard + persistence)

1. **`keyboard.js`** — Global `keydown` listener with a dispatch map. Handle `y/n` for intro prompt (currently broken). Wire `Tab` for dashboard toggle.
2. **`scoring.js`** — `localStorage` read/write. `startSampling()`, `stopSampling()`, `getScores()`, `getRankings(emotionFilter)` functions.
3. **Modify `emotional_analysis.js`** — Expose `currentEmotions` globally.
4. **Modify `composer.js`** — Handle `y` keypress to transition from intro to content loop.

### Phase B: Content playback

5. **`content/manifest.js`** — Static content array (start with 15–20 items).
6. **`content/items/`** — Curated GIFs and images.
7. **`content_player.js`** — Display loop: load item → show for duration → trigger scoring → transition → next.
8. **Modify `index.html`** — Add content container div, new script tags.
9. **Modify `style.css`** — Content display area styling.
10. **Modify `typing.js`** — ERNEST narration between content items.

### Phase C: Dashboard

11. **`dashboard.js`** — DOM construction, keyboard navigation, emotion filter cycling, detail view with bar charts.
12. **Modify `style.css`** — Dashboard overlay styles, CRT glow effect, scrolling.
13. **Wire into `composer.js`** — `Tab` toggles dashboard, pauses/resumes content playback.

### Phase D: Polish

14. Shader transitions when content appears/disappears (ramp static up briefly, then clear).
15. ERNEST narration variety — pick random lines, interpolate emotion names and counts.
16. Edge cases: what if user has no face detected during content? (discard that sample, show a message like `"> I can't see you. Move closer."`)
17. Content seen count weighting — after all items viewed once, bias toward least-viewed items.

## 10. Open Questions

| # | Question | Default assumption |
|---|---|---|
| 1 | How many content items to ship initially? | 20 curated items |
| 2 | Content viewing duration per item? | 6 seconds |
| 3 | Should users be able to skip content? (e.g., spacebar) | Yes — but score is discarded for that item |
| 4 | Should the dashboard show a "global happiness ranking" (single sorted list) or only per-emotion views? | Both — "All" filter shows by `happinessScore`, emotion filters sort by that emotion's mean |
| 5 | Should scores ever decay? (older viewings weighted less) | Not in this phase — simple running mean is sufficient |
| 6 | Content types beyond static images/GIFs? (video, text prompts, audio) | Images and GIFs only for this phase |
| 7 | Is there a "training complete" state? (e.g., after N viewings per item) | No — training is perpetual, scores refine forever |
| 8 | Should the content manifest be easily extensible by non-developers? | Yes — `manifest.js` is a simple array, add an entry + drop a file in `items/` |

## 11. Success Criteria

- User completes full loop: face detected → intro → confirms → sees content → emotions scored → views dashboard with rankings
- Scores persist across browser sessions via `localStorage`
- Dashboard is navigable entirely by keyboard, renders in the terminal aesthetic
- At least 15 content items ship with the initial set
- Emotion scores differentiate meaningfully between content (not all items score the same)
- ERNEST narration creates the feeling that he is "learning" from the user
