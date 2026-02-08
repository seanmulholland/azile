# CLAUDE.md — Azile

## Project Overview

Azile is a browser-based interactive art experience that uses real-time facial emotion detection via webcam. Built with vanilla JavaScript, Three.js, and CLM Tracker, it recognizes six emotions (anger, disgust, fear, sadness, surprise, happiness) and responds with dynamic visual shader effects and a typewriter-style conversational UI.

Created by Sean Mulholland and Matt Visco (2018). The character is named "Ernest Alize."

## Architecture

### Execution Flow

```
index.html loads → scripts execute sequentially via <script> tags
  → jQuery ready() triggers setup()
    ├── initVariables()    [variables.js]    → canvas + webcam stream init
    ├── initStatic()       [static_intro.js] → Three.js scene, shaders, post-processing
    └── startTracking()    [emotional_analysis.js] → CLM face tracker starts
  → draw() loop via requestAnimationFrame
    ├── trackingLoop()     → face detection + emotion classification
    ├── animateStatic()    → shader parameter updates + render
    └── intro()            → typewriter text when face confirmed
```

### State Transitions

1. **Waiting**: No face detected. Static/distortion shaders at full intensity.
2. **Approaching**: Face detected (`foundFace = true`). Shader distortion decreases as `faceDistance` increases from `faceLow` (1.2) to `faceHigh` (1.7).
3. **Experience**: `faceDistance >= 1.7` sustained for 2 seconds → `experienceBegin = true`. Canvas fades out, typewriter intro plays.

### Global State Variables

Key globals defined in `variables.js` and `emotional_analysis.js`:
- `video` — webcam HTMLVideoElement
- `foundFace` — boolean, whether a face is currently detected
- `faceDistance` — float, distance metric between face landmarks (points 0 and 14)
- `experienceBegin` — boolean, triggers conversational UI
- `introComplete` — boolean, prevents re-triggering intro
- `max` — integer index of dominant emotion (0=anger, 1=disgust, 2=fear, 3=sad, 4=surprise, 5=happy)

## Directory Structure

```
azile/
├── index.html                 # Entry point — loads all scripts in order
├── style/
│   └── style.css              # Minimal styling (black bg, green terminal text, overlay)
├── js/                        # Application code (~500 lines)
│   ├── variables.js           # Global state, webcam init, utility functions
│   ├── static_intro.js        # Three.js scene setup, shader pipeline, params
│   ├── emotional_analysis.js  # CLM tracker, emotion classifier, face tracking loop
│   ├── typing.js              # Typewriter effect and intro text
│   ├── composer.js            # Main setup() and draw() loop
│   └── vendors/               # Third-party JS (CLM tracker, shaders, classifiers)
│       ├── clmtrackr.js       # Constrained Local Model face tracker
│       ├── emotion_classifier.js
│       ├── emotionmodel.js    # Pre-trained emotion SVM coefficients
│       ├── BadTVShader.js     # VHS distortion shader
│       ├── StaticShader.js    # TV static shader
│       └── libs/              # jQuery, D3, dat.gui, Stats, utilities
├── lib/                       # Three.js core + extensions
│   ├── three.min.js
│   ├── postprocessing/        # EffectComposer, RenderPass, ShaderPass, MaskPass
│   └── shaders/               # CopyShader, FilmShader, RGBShiftShader
└── models/                    # Pre-trained PCA face models (~4.2 MB)
    └── model_pca_20_svm.js    # Active model (loaded in index.html)
```

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Language | JavaScript (ES5), HTML, CSS |
| 3D Rendering | Three.js (WebGL) |
| Face Detection | CLM Tracker (clmtrackr.js) |
| Emotion Classification | SVM classifier with PCA-reduced features |
| DOM Manipulation | jQuery |
| Dependency Management | None (global `<script>` tags, load order matters) |

## Development Setup

No build system, package manager, or tooling exists. To run locally:

1. Serve the project directory with any static HTTP server (e.g., `python3 -m http.server 8000`)
2. Open in a WebGL-capable browser
3. Grant webcam permission when prompted

There is no `package.json`, no bundler, no transpiler, no linter, and no test framework.

## Post-Processing Shader Pipeline

Order matters — defined in `onToggleShaders()` (`static_intro.js:91`):

```
Scene → RenderPass → FilmPass → BadTVPass → RGBPass → StaticPass → CopyPass → Screen
```

Shader parameters are dynamically mapped from `faceDistance` using `map_range()` in `updateParams()` (`static_intro.js:78`). As the user's face gets closer/larger, distortion decreases.

## Script Load Order

The `index.html` script load order is critical since there are no modules — everything is globally scoped:

1. jQuery (DOM utilities)
2. Three.js core + postprocessing + shaders (graphics foundation)
3. Custom shaders (BadTV, Static)
4. CLM Tracker + face model + emotion classifier (ML pipeline)
5. Application code: `variables.js` → `static_intro.js` → `emotional_analysis.js` → `typing.js` → `composer.js`

Changing this order will break the application.

## Key Conventions

- **No modules**: All code uses global scope. No `import`/`require`/`export`.
- **Naming**: camelCase for variables and functions. No constants convention.
- **State**: Mutable global variables for all shared state.
- **DOM**: jQuery for animations (`fadeIn`/`fadeOut`), vanilla JS for canvas and video.
- **No error handling**: Minimal — only a prompt message on webcam failure.
- **Vendor code**: Committed directly into `js/vendors/` and `lib/`. Not managed by any package manager.

## Emotion Detection Details

- CLM Tracker extracts facial landmark positions and parameters
- `emotionClassifier.meanPredict()` runs SVM classifiers on those parameters
- Returns scores for 6 emotions; the highest-scoring emotion index is stored in `max`
- `faceDistance` is computed as the great-circle distance between landmarks 0 and 14 (face width metric)
- The active face model is `model_pca_20_svm.js` (PCA with 20 components, SVM classifier)

## Common Pitfalls

- The canvas overlay dimensions (320x240) must match the video element dimensions or the face mesh drawing will misalign (`index.html:14`, `variables.js:24-25`)
- CSS-scaling the overlay to 800x600 is intentional — altering source video resolution breaks `faceDistance` calculations (`style.css:22-23`)
- Pre-setting overlay `opacity: 0` in CSS kills the overlay draw; `fadeOut(1)` in JS is used instead (`composer.js:5`)
- The `experienceBegin` transition uses a 2-second `setTimeout` recheck to prevent false positives (`static_intro.js:126-132`)
