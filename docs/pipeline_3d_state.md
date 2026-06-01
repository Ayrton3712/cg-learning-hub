# `pipeline_3d_state.js`

This file is the app's shared notebook. Every other module in the app reads from and writes to it. Instead of every part of the app keeping its own private copy of data, which would quickly get out of sync and would be inefficient, everything agrees to store important information in one central place.

The file exports three things:
- `THEMES`. A table of colors for light and dark mode
- `S`. The big shared data object
- `getEmissiveColor()` and `getWireColor()`. Two small helper functions that read color values from the active theme

---

## `THEMES`

```
THEMES = {
  light: { background color, grid color, wireframe color, selection glow color },
  dark:  { background color, grid color, wireframe color, selection glow color },
}
```

This is a lookup table. When the user clicks "Light" or "Dark", the app reads the matching row from this table and applies those colors everywhere. Having the colors in one place means changing the theme is a single operation instead of hunting down every colored element individually.

---

## `S` - The Shared State Object

`S` is a plain JavaScript object with many named fields. Each field stores one piece of the app's live data. Here is what each group of fields does:

---

### Three.js engine objects

| Field | What it holds |
|---|---|
| `scene` | The 3D world. All objects exist inside this |
| `camera` | The viewer's perspective (position, angle, field of view) |
| `renderer` | The engine that draws the 3D scene onto the main canvas |
| `godCamera` | A second camera used for the top-down "god's eye" view in Stage 4 |
| `godRenderer` | The engine that draws the god's eye view onto its canvas |
| `cameraHelper` | A wireframe box that shows the camera's visible area in the god's eye view |
| `ambientLight` | A soft fill light that prevents completely black shadows |

All of these start as `null` (empty) when the app first loads, and are filled in by `pipeline_3d_main.js` during startup.

---

### Sun and lighting

| Field | What it holds |
|---|---|
| `dirLight` | The directional sun light that casts shadows |
| `sunSphere` | The visible yellow ball in the sky representing the sun |
| `sunAzimuth` | The sun's horizontal angle (like compass direction), in degrees |
| `sunElevation` | The sun's vertical angle (how high in the sky), in degrees |

The sun light and the visible sun ball always point in the same direction. When a slider in Stage 3 changes `sunAzimuth` or `sunElevation`, the landscape module reads these values and repositions both.

---

### Environment meshes

| Field | What it holds |
|---|---|
| `terrain` | The 3D ground mesh (hills and valleys) |
| `skybox` | The large sphere around everything that shows the sky gradient |

These are separate from the selectable scene objects. The user can't click or move them.

---

### Pipeline stage state

| Field | What it holds |
|---|---|
| `stages[0..4]` | Five true/false flags, one per pipeline stage (Stage 1 = index 0, and so on) |
| `openDetail` | Which detail panel is currently expanded (-1 means none) |
| `selectedObj` | The object the user has currently clicked on (or `null` if nothing selected) |
| `splitActive` | Whether the Stage 4 split-view (two viewports) is active |
| `currentTheme` | Either `'light'` or `'dark'` |

`stages` is the most-read piece of data in the entire app. Almost every function checks which stages are active before deciding how to draw or behave.

---

### Orbit (camera rotation) state

The app has a custom camera control system. When the user drags the mouse, the camera orbits around the scene like a ball on a string. This state is stored in two objects: one for the main camera, one for the god's eye camera:

| Field | What it stores |
|---|---|
| `theta` | Horizontal rotation angle (left/right) |
| `phi` | Vertical rotation angle (up/down), clamped so camera can't flip |
| `radius` | How far the camera is from the center point (zoom level) |
| `target` | The point in space the camera is looking at |
| `dragging` | Whether the mouse button is currently held down |
| `lastX/Y` | Where the mouse was last frame (used to compute how far it moved) |

`target` cannot be set at the moment this file loads because Three.js hasn't been loaded yet. It needs Three.js to create a 3D point. So it starts as `null` and is set by `pipeline_3d_main.js` right after Three.js loads.

---

### Scene objects

| Field | What it holds |
|---|---|
| `objectDefs` | A list of the three scene props: Tree, Rock, Cabin |

Each entry in the list is itself an object holding everything about that prop: its position in the world, its color, which representation mode it's currently using, its geometry in the scene, and all its UI control values.

---

### Stage 3 sub-controls

Individual on/off flags for each lighting component:

| Field | Default | Effect when on |
|---|---|---|
| `s3AmbientOn` | true | Soft fill light is active |
| `s3DiffuseOn` | true | Direct sunlight is active |
| `s3ShadowOn` | true | Objects cast shadows on the terrain |

---

### Stage 4 sub-controls

| Field | Default | Effect |
|---|---|---|
| `s4ViewingOn` | false | Show the god's eye camera frustum box |
| `s4ClipOn` | false | Visualize the near/far clipping planes |
| `s4HSROn` | true | Hide surfaces that face away from the camera |
| `s4ProjOn` | false | Switch to orthographic (no perspective) projection |
| `s4NearVal/FarVal` | 0.1 / 200 | Near and far clipping distances |

---

### Stage 5 sub-controls

| Field | Default | Effect |
|---|---|---|
| `pixelSize` | 4 | How large each rendered pixel appears on screen |
| `s5AAOn` | false | Anti-aliasing |
| `s5ScanlineOn` | false | Animated horizontal raster sweep line |
| `s5GridOn` | false | Pixel grid overlay |
| `scanlineY` | 0 | Current vertical position of the animated sweep line |

---

### Cross-module callback functions

| Field | What it holds |
|---|---|
| `updateDetailPanels` | A function for refreshing the open detail panel |
| `updateStats` | A function for refreshing the vertex/triangle counters |
| `resizeAll` | A function for recalculating all canvas sizes |

These are stored here to solve a circular dependency problem. The stage modules (like Stage 1) sometimes need to trigger a panel refresh, but the panel refresh function lives in `pipeline_3d_main.js`. If Stage 1 imported directly from main, and main imports from Stage 1, we would have a loop that JavaScript can't resolve.

The solution: main stores its own functions on `S` during startup, and stage modules call them via `S.updateDetailPanels?.()`. The `?.` means "only call this if it exists," which handles the brief startup window before main has assigned anything.

---

## `getEmissiveColor()` and `getWireColor()`

```js
export function getEmissiveColor() { return THEMES[S.currentTheme].emissive; }
export function getWireColor()     { return THEMES[S.currentTheme].wireColor; }
```

Two tiny helper functions. Rather than every module looking up `THEMES[S.currentTheme].wireColor` directly, they call `getWireColor()`. This is called each time a wireframe or selection highlight is built, never cached, so switching the theme and rebuilding objects automatically uses the new correct color.