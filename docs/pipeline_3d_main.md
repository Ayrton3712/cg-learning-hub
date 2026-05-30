# `pipeline_3d_main.js`

This is the conductor of the entire application. It runs first (after Three.js loads), imports every other module, sets everything up, and keeps things running. No other module imports from this file. It sits at the top of the chain and reaches downward.

Its responsibilities:
- Create the 3D engine (renderers, cameras, scene)
- Define the three scene objects (Tree, Rock, Cabin)
- Handle all user input (mouse, keyboard, window resize)
- Manage the five pipeline stage toggles
- Run the render loop
- Track and display scene statistics

---

## Startup Sequence

Code in this file runs from top to bottom when the page loads. The order is intentional:

1. Create the 3D renderers and cameras
2. Set up orbit targets (where cameras look)
3. Call `initLandscape()`, build terrain, sky, sun
4. Define the three scene objects and build their initial geometry
5. Point the cameras at the scene
6. Attach all mouse and keyboard event listeners
7. Build all five detail panels (the expandable control sections)
8. Sync stage UI to the initial state (all stages off)
9. Start the render loop

---

## Three.js Setup

### Main renderer and scene

Three.js (the 3D library) requires two things to draw anything: a **scene** (the 3D world containing all objects) and a **renderer** (the engine that draws it onto a canvas element).

```
S.renderer -> draws onto #main-canvas
S.scene    -> contains all 3D objects (terrain, skybox, props, lights)
S.camera   -> the perspective through which the scene is rendered
```

The camera uses perspective projection. Objects farther away appear smaller, just like in real life. Its field of view is 60° vertically (roughly normal human vision).

Shadow mapping is disabled at startup and only enabled when Stage 3 turns on.

### God's eye renderer and camera

A second, independent rendering setup for the top-down view used in Stage 4 split view:

```
S.godRenderer -> draws onto #god-eye-canvas
S.godCamera   -> orthographic top-down camera (no perspective)
```

An **orthographic** camera shows everything at the same scale regardless of distance. It starts positioned 20 units directly above the scene center.

### Camera frustum helper

`S.cameraHelper` is a wireframe box that visualizes the main camera's visible area (its "frustum", which is the pyramid-shaped region of space it can see). It lives in the scene but is only shown briefly during each god's eye render pass, then hidden again so it doesn't appear in the main view.

### Ambient light

A soft, directionless fill light (`S.ambientLight`) that prevents completely black shadows. It is off at startup and enabled when Stage 3 turns on.

---

## Scene Objects (`S.objectDefs`)

The three objects (Tree, Rock, Cabin) are defined as plain data records:

```
Tree  - positioned at world coordinates (2, terrainHeight(2,1), 1)
Rock  - positioned at (-5, terrainHeight(-5,-3), -3)
Cabin - positioned at (4, terrainHeight(4,-3), -3)
```

Each object's height (Y coordinate) is calculated by calling `terrainHeight()` so it sits exactly on the ground. Each record stores:
- Name, world position/rotation/scale
- Color (full color for Stage 3 onward, grey for Stages 1 and 2)
- Geometry type (`'tree'`, `'rock'`, `'cabin'`)
- Current representation mode (starts as `'brep'`, short for Boundary Representation)
- All slider values (point size, voxel resolution, sweep angle, etc.)

After defining the list, `buildRepr(def)` is called for each object to create their initial 3D geometry in the scene.

---

## Orbit Controls

The user rotates the camera by dragging the mouse. This uses a custom spherical coordinate system. Instead of storing the camera's absolute XYZ position, the system stores:

- `theta` - horizontal rotation angle
- `phi` - vertical angle
- `radius` - how far the camera is from the center point
- `target` - the 3D point the camera is always looking at

### `updateCameraFromOrbit(orb, cam)`

Converts these angles and radius into an actual XYZ camera position using standard trigonometry, then points the camera at the target. Called every time the user drags (to update the view) and every frame if WASD is held.

### Mouse event handling

| Event | What happens |
|---|---|
| `mousedown` on main canvas | Start orbiting; record where the mouse button was pressed |
| `mousemove` anywhere | If dragging: update theta/phi based on how far the mouse moved; recompute camera position |
| `mouseup` anywhere | Stop orbiting |
| `mousewheel` on main canvas | Zoom in/out by changing `radius` (clamped between 3 and 50 units) |
| `click` on main canvas | Try to select an object (see below) |

The god's eye canvas has its own separate orbit state and mouse handlers.

### Drag vs. click disambiguation

A browser "click" event fires after every mouse button press and release, even after a long drag. Without special handling, orbiting the camera would accidentally deselect whatever object was selected.

The fix: when `mousedown` fires, the exact pixel position is recorded. When `click` fires, the current position is compared against it. If the mouse moved more than 5 pixels in any direction, it was a drag, the click is ignored. Only a true stationary press-and-release selects an object.

---

## Object Selection (Raycasting)

When the user clicks on the canvas (confirmed not a drag), the app performs **raycasting**. It shoots an invisible ray from the camera through the clicked pixel into the 3D scene and checks what it hits.

```
1. Convert mouse pixel position into normalized coordinates (-1 to +1)
2. Create a ray from camera through that screen position
3. Collect all selectable objects from all visible reprGroups
4. Find what the ray hits first
5. Determine which objectDef owns the hit object
6. Call selectObject() or clearSelection()
```

A special threshold is set for point cloud objects (`raycaster.params.Points = { threshold: 0.15 }`) because individual points have zero physical size. Without a threshold, clicking them would be nearly impossible.

In Stage 4 split view, the main scene only occupies the right half of the canvas, so the X coordinate is remapped accordingly.

---

## Stage System

### Stage data

The five stages are labeled 1–5 in the UI but stored at indices 0–4 in the `stages` array. Each has a label:

| Index | Label |
|---|---|
| 0 | Object Representation |
| 1 | Modeling Transform |
| 2 | Lighting |
| 3 | Viewing Pipeline |
| 4 | Scan Conversion |

The stage rows (header + toggle pill + detail panel) are created in JavaScript and added to `#stage-list` dynamically. The HTML only has an empty container.

### `toggleStage(idx)`

Two rules govern stage toggling:
- **Dependency**: a stage can only be turned on if the previous stage is already on.
- **Cascade off**: turning off a stage also turns off all later stages.

For example, you can't enable Stage 3 (Lighting) without Stage 2 (Modeling Transform) already being active. And if you turn off Stage 2, Stage 3, 4, and 5 also turn off automatically.

### `applyStageVisibility()`

Called after any stage change or theme switch. It looks at the current state of all stages and makes everything match:

- Rebuilds all objects' geometry (handles material type changes)
- Shows/hides props (Stage 1 gates visibility)
- Shows/hides terrain and skybox (Stage 1)
- Swaps terrain material (Stage 3)
- Shows/hides sun, ambient light, shadows, fog (Stage 3)
- Activates split view (Stage 4)
- Activates pixelation (Stage 5)
- Updates stats, UI, and detail panels

### `updateStageUI()`

Syncs the visual state of every stage row:
- Active stages get a blue badge and glowing toggle
- Disabled stages (dependency not met) get faded text and a "Requires Stage N" note
- The stat counter at the bottom shows how many stages are currently active

### Detail panels

Clicking a stage's name area toggles its detail panel open or closed. Only one panel can be open at a time. When a panel opens, its `updateDetail` function is called to sync its controls to the current object/scene state.

The `updateDetailPanels` function is stored on `S` (the shared state) so stage modules can trigger a panel refresh from outside main without creating a circular import dependency.

---

## WASD Camera Movement

Holding W/A/S/D moves the camera in the direction it is facing:

- **W/S** - forward and backward (along the camera's look direction)
- **A/D** - left and right (perpendicular to the look direction)

The camera movement is calculated each frame in the render loop. Crucially, both the camera position AND the orbit target move together by the same amount. If only the camera moved, the very next mouse drag would snap the camera back to orbiting around the old target point. Moving the target along maintains the orbit pivot in front of the player at all times.

---

## Statistics (`updateStats()`)

Called every frame. Counts up vertices and triangles from all visible object groups:
- **Vertices** - individual 3D points in all geometry
- **Triangles** - faces (each triangle adds 3 vertices)
- **Objects** - number of visible reprGroups
- **Active stages** - how many stages are currently on

Large numbers are formatted as "1.2k" for readability. These counters update live as you change representation modes, resolution, or toggle stages.

---

## Theme System (`setTheme(name)`)

Switches between light and dark themes:
1. Updates `S.currentTheme`
2. Sets a `data-theme` attribute on the `<html>` element. CSS picks this up and swaps all color variables automatically
3. Changes the 3D scene's background color
4. Calls `applyStageVisibility()`, rebuilding all objects and wireframes picks up the new wire/highlight colors

---

## Render Loop (`render()`)

This function runs approximately 60 times per second (once per screen refresh). Each call:

1. **WASD movement** - if any movement key is held, shift camera and orbit target
2. **Camera helper update** - if Stage 4 is active, update the frustum box visualization
3. **Scanline animation** - if Stage 5 scanline is on, advance `S.scanlineY` by 0.75 pixels
4. **Pixelation** - if Stage 5 is active, resize the renderer to low resolution; the canvas CSS size stays full-size, so the browser scales the small image up, creating large visible pixels
5. **God's eye render** - if Stage 4 split is active, render the scene from the god camera into the left canvas
6. **Main render** - render the scene from the main camera (or orthographic camera if Stage 4 projection is on)
7. **2D overlays** - draw the pixel zoom inset and pixel grid (Stage 5)
8. **Update stats** - refresh the vertex/triangle counters

The pixelation effect works by setting `imageRendering: 'pixelated'` on the canvas, which tells the browser to use nearest-neighbor scaling (no blending) when enlarging the low-res render, producing crisp, blocky pixels.
