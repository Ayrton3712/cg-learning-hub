# `pipeline_3d_landscape.js`

This module creates and manages the world environment: everything that forms the backdrop the three scene objects (Tree, Rock, Cabin) sit in front of. This includes:

- The hilly terrain
- The sky gradient in the background
- The visible sun sphere in the sky
- The invisible directional sun light that casts shadows

None of these are selectable or interactable by the user. They are scenery, not pipeline objects.

---

## Exports

| Name | Type | What it does |
|---|---|---|
| `terrainHeight(x, z)` | Function | Returns the ground's elevation at any horizontal position |
| `applyTerrainMaterial(useLit)` | Function | Switches the terrain between lit and unlit appearance |
| `updateSunPosition()` | Function | Moves the sun light and sun sphere to match azimuth/elevation settings |
| `initLandscape()` | Function | Creates everything at startup. Called once |

---

## `terrainHeight(x, z)`

```
Input:  x, z - a horizontal position in the world
Output: y    - the height (elevation) of the ground at that point
```

This behaves like a pure math function. It takes in a position and returns a number. It has no side effects and does not know about the 3D scene at all. The height is calculated using overlapping sine and cosine waves, which naturally produce smooth hills.

Three waves are summed together:
- A wide, tall wave. Creates the broad hills
- A medium-frequency wave. adds mid-scale variation
- A smaller wave. adds fine detail

The result is always somewhere between roughly –2.5 and +2.5 world units.

**Why is it exported?** `pipeline_3d_main.js` uses it when placing the Tree, Rock, and Cabin in the scene. it calls `terrainHeight` for each object's X/Z position and uses the result as the object's Y (height), so the objects sit exactly on the ground surface rather than floating or clipping through it.

---

## `buildTerrainGeometry()` - private (not exported)

This function is used internally to create the ground mesh. It is called once inside `initLandscape()` and its result is stored on the scene. External modules don't call this directly.

**What it does:**

1. **Create a flat rectangle**. A 30x30 world-unit plane divided into a 60x60 grid of small squares (3,721 points total). This gives the terrain enough geometric detail to look smooth.

2. **Raise and lower each point**. For every point in the grid, it calls `terrainHeight(x, z)` and moves the point up or down to match. This turns the flat plane into a hilly landscape.

3. **Color each point**. A three-stop color gradient is applied based on height:
   - Low elevation -> dark green
   - Middle elevation -> bright grass green
   - High elevation -> sandy tan/rocky brown

   The gradient is computed by normalizing the height to a 0–1 range and then blending between color stops.

4. **Recalculate normals**. After deforming the surface, the app recomputes which direction each triangle "faces." This is essential for lighting to look correct in Stage 3. Without it, shadows would fall in the wrong direction.

---

## `applyTerrainMaterial(useLit)`

```
Input:  useLit - true if Stage 3 (Lighting) is on, false otherwise
Effect: swaps the terrain's surface material
```

The terrain's geometry (its shape) never changes, but its material (how it is drawn) needs to change depending on whether lighting is active.

- **Stage 3 off** -> Uses a flat, unlit material. Colors are displayed exactly as specified. No shading, no shadows. Matches the grayscale appearance of Stage 1/2 objects.
- **Stage 3 on** -> Uses a physically-based lit material. The terrain responds to the directional sun light, shows shading on slopes, and can receive shadows cast by objects.

The old material is disposed (its GPU memory released) before the new one is applied, to prevent memory leaks.

---

## `updateSunPosition()`

```
Input:  reads S.sunAzimuth and S.sunElevation from shared state
Effect: moves S.dirLight and S.sunSphere to the correct position
```

This function converts two angles (azimuth (compass direction, 0-360°) and elevation (how high above the horizon, 5-90°)) into a 3D direction in space.

The conversion uses standard spherical-to-Cartesian math:
- Horizontal spread = cos(elevation) * sin(azimuth)
- Vertical component = sin(elevation)
- Depth spread = cos(elevation) * cos(azimuth)

The directional light is placed 30 units out along this direction, pointed back at the origin (the center of the scene). Directional lights in 3D engines do not actually emit from a point, they simulate sunlight by illuminating everything from the same infinite direction. The 30-unit distance is just for display purposes.

The sun sphere (the visible yellow ball) is placed 62 units out along the same direction — farther away so it sits convincingly behind the horizon.

This function is called once at startup (to set the initial sun position) and again whenever the user moves the sun sliders in Stage 3.

---

## `initLandscape()`

This is the constructor for the entire environment. It is called once by `pipeline_3d_main.js` after the 3D scene is set up. It creates four things and stores each on the shared state `S`:

### Terrain -> `S.terrain`

Creates the ground mesh using `buildTerrainGeometry()` and adds it to the scene with an unlit material (since Stage 3 starts off). Marks it with `userData.isTerrain = true`, a flag that prevents the click-to-select system from accidentally picking up the ground when the user clicks on it.

### Sky -> `S.skybox`

Creates a very large sphere (radius 80 units) that surrounds the entire scene. It is rendered inside-out. The camera is inside the sphere and sees its inner surface. A shader is written directly in the code to draw the sky gradient:

- The shader receives two colors: `skyTop` (deep blue) and `skyBot` (warm peach/orange).
- For every point on the sphere's inner surface, it calculates how high that point is.
- It blends between the bottom and top colors based on height, creating a smooth sunrise-like gradient.

`depthWrite: false` is set on the sky material, which tells the 3D engine to treat the sky as "infinitely far" and never let it block anything in front of it.

### Sun sphere -> `S.sunSphere`

A simple small sphere (radius 2.5) with a pale yellow color. Starts invisible, made visible by `applyStageVisibility()` in main when Stage 3 is turned on. Its position is controlled by `updateSunPosition()`.

### Directional sun light -> `S.dirLight`

An invisible directional light that simulates sunlight. Properties:
- Color: warm white-yellow (`0xfff4e0`)
- Shadow map: 1024x1024 pixels, the resolution of the shadow texture it generates
- Shadow camera area: ±20 units, covers the whole scene
- Starts invisible, activated by Stage 3

Both the light and its target (the point it aims at, which is the scene origin) must be added to the scene. Three.js requires the target to be in the scene graph for the light direction to update correctly.

`updateSunPosition()` is called at the end of `initLandscape()` to set the initial light position based on the default azimuth (45°) and elevation (60°) stored in `S`.
