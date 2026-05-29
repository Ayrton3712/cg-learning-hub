# `index.html`

## What this file is

`index.html` is the starting point of the entire app. When you open the simulator in a browser, the browser reads this file first. It defines the visual skeleton of the page: where the 3D canvas sits, where the control panel goes, what fonts and colors are used, and tells the browser which JavaScript files to load to make everything interactive.

---

## Major Sections

### 1. Head (Invisible section)

```html
<head>
  <title>CG Learning Hub - 3D Graphics Pipeline</title>
  <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono..." rel="stylesheet">
  <style> ... </style>
</head>
```

The `<head>` section contains things the user never sees directly:

- **Title** - the text shown in the browser tab.
- **Font imports** - the app uses two fonts from Google Fonts:
  - *Syne* - a clean modern font used for labels and headings.
  - *Share Tech Mono* - a monospace (typewriter-style) font used for numbers, code values, and data readouts.
- **Styles** - the entire visual design of the app lives here as CSS (see below).

---

### 2. CSS Styles

CSS (Cascading Style Sheets) is the language that controls how everything looks: colors, sizes, positions, animations.

#### Color themes

```css
:root {
  --bg: #eef1f8;
  --accent: #0070c0;
  --text: #1c2138;
  ...
}
[data-theme="dark"] {
  --bg: #0a0a0f;
  --accent: #00e5ff;
  ...
}
```

The app has two color themes: **Light** and **Dark**. Rather than changing colors in dozens of places when the theme switches, all colors are stored as named variables (like `--bg` for background, `--accent` for the highlight color). Switching theme simply swaps the values of those variables and everything updates automatically.

#### Key layout rules

| Element | What it does visually |
|---|---|
| `body` | Full-screen, no scrollbar, vertical stack layout |
| `#header` | Thin bar across the top with the app title and theme buttons |
| `#main` | The area below the header, split horizontally into viewport + panel |
| `#viewport-wrap` | The left area where the 3D scene is drawn |
| `#right-panel` | The right sidebar with stage toggles and controls |
| `#stats-grid` | The 2x2 number readout at the bottom of the panel |

#### Stage toggle pills (`.toggle-pill`)

Each pipeline stage has a pill-shaped on/off button. When the stage is active, the pill turns blue and gently pulses with a glow animation. When disabled, it turns grey and is visually faded.

#### Detail panels (`.detail-panel`)

Each stage has a collapsible detail panel that appears when you click the stage name. It has a blue left border and a subtle tinted background to visually separate it from the rest of the panel.

#### Object dropdown (`.obj-select`)

A dropdown menu styled to match the app's color scheme, used in Stage 1 to select which object (Tree, Rock, Cabin) you want to configure.

---

### 3. The Page Body - Visible Structure

```html
<body>
  <div id="header"> ... </div>
  <div id="main">
    <div id="viewport-wrap"> ... canvases ... </div>
    <div id="right-panel"> ... controls ... </div>
  </div>
  ...
</body>
```

#### Header bar

Contains three things:
- "CG Learning Hub" label on the left
- "3D Graphics Pipeline" title in the accent color
- Light/Dark theme buttons on the right

#### Viewport area

Contains four layered elements, all stacked on top of each other:

| Element | Purpose |
|---|---|
| `#god-eye-canvas` | Hidden by default; shows the top-down god-eye view in Stage 4 split mode |
| `#main-canvas` | The primary 3D scene canvas. Always visible |
| `#pixel-grid-overlay` | A 2D canvas drawn on top to show the pixel grid in Stage 5 |
| `#zoom-inset` | A draggable magnified window that appears in Stage 5 |

View labels ("GOD'S EYE VIEW", "CAMERA VIEW") are positioned text overlays that appear in Stage 4 split mode.

#### Right panel

```html
<div id="right-panel">
  <div id="panel-scroll">
    <div id="stage-list">
      <!-- Stage rows injected by JS -->
    </div>
  </div>
  <div id="stats-grid"> ... </div>
</div>
```

The stage list is empty in the HTML. The JavaScript (`pipeline_3d_main.js`) creates all five stage rows dynamically when the app starts. This keeps the HTML clean and lets the JS control everything about stage behavior.

Below the scrollable list is the stats bar: four cells showing: Objects, Vertices, Triangles, Active Stages.

#### Welcome modal

```html
<div id="welcome-overlay">
  <div id="welcome-box"> ... </div>
</div>
```

A full-screen overlay that appears on first load. It lists the five pipeline stages and basic controls. Clicking "Get Started" adds the class `hidden` to the overlay, making it disappear.

---

### 4. Script Loading

```html
<script src="https://cdnjs.cloudflare.com/.../three.min.js"></script>
<script type="module" src="./modules/pipeline_3d_main.js"></script>
<script>
  document.getElementById('btn-get-started').addEventListener('click', function() {
    document.getElementById('welcome-overlay').classList.add('hidden');
  });
</script>
```

Three scripts load at the bottom of the page (after all the HTML is built):

1. **Three.js** - the 3D graphics library, loaded from a CDN (a content delivery network, a public server that hosts common libraries). This makes the `THREE` object available globally so all modules can use it.

2. **`pipeline_3d_main.js`** - the app's own entry point, loaded as an ES module (a modern JavaScript format that supports clean imports between files). This starts the entire application.

3. **Inline welcome script** - a tiny three-line script that wires the "Get Started" button to close the overlay. It runs outside the module system so it works immediately without waiting for the 3D scene to initialize.

---

## How it all fits together

`index.html` sets the stage and hands off to JavaScript. Once the browser finishes reading the HTML:
1. It loads Three.js (making 3D rendering possible)
2. It loads `pipeline_3d_main.js` (which imports all other modules and starts the app)
3. The JS builds the stage rows, initializes the 3D scene, and starts the animation loop
4. The static HTML shell becomes a live, interactive simulator
