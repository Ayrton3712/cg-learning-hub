# `pipeline_3d_stage1.js`

This module implements the Object Representation stage, the first and most fundamental stage of the 3D graphics pipeline. Before an object can be placed in the world, illuminated, or rendered, it needs to exist as some kind of geometric description. Stage 1 is where that description is chosen and built.

The module also handles:
- Clicking on objects to select them (selection highlight)
- The Stage 1 detail panel in the right sidebar (all its buttons, sliders, and readouts)

---

## The Four Representation Modes

A key educational concept in this stage is that the same physical object can be described geometrically in multiple ways. The simulator lets you switch between four:

| Mode | What it looks like | What it represents |
|---|---|---|
| **B-Rep** (Boundary Representation) | Solid or shaded mesh | The actual surface of the object, described by triangles |
| **Points** (Point-Sample) | A cloud of dots | A sampling of points from the surface |
| **Voxels** (Space Partitioning) | A grid of small cubes | The volume approximated by a 3D grid |
| **Sweep** | A smooth solid of revolution | The surface created by rotating a 2D primitive around an axis |

---

## How an Object is Stored

Each object (Tree, Rock, Cabin) is described by a data record containing:

- `name` - display name
- `worldPos/Rot/Scale` - its position, rotation, and size in the world
- `color` / `grayColor` - full color (Stage 3+) vs. grey (Stages 1–2)
- `geoType` - which builder to use: `'tree'`, `'rock'`, or `'cabin'`
- `repr` - the currently active representation mode
- `reprGroup` - the live 3D group containing this object's current geometry in the scene
- `mesh` - the primary mesh piece (used to list its vertex coordinates in the panel)
- `pointSize`, `pointDensity` - point sample display settings
- `voxelRes` - voxel grid resolution
- `sweepAngle` - how many degrees to rotate the profile (0–360)

---

## Exports

| Name | What it does |
|---|---|
| `makeBaseGeo(def)` | Returns a simplified single-piece geometry for a given object type |
| `disposeGroup(g)` | Releases GPU memory used by a group of 3D objects |
| `buildRepr(def)` | Rebuilds the object's geometry in the scene from scratch |
| `selectObject(def)` | Highlights the given object and updates the detail panel |
| `clearSelection()` | Removes all highlights and clears the selection |
| `buildDetail0()` | Creates the Stage 1 HTML control panel once at startup |
| `updateDetail0()` | Syncs the panel controls to the current selected object |

---

## Private Geometry Builders

These three functions create the actual 3D meshes. They are used both to build the visible BRep representation and to generate temporary geometry for point and voxel sampling. Each takes the same inputs: a group to add meshes into, the object's data record, and flags for whether lighting and color are active.

### `buildTreeMeshes`

Creates two pieces:
- A **trunk** - a tapered cylinder (wider at the base, narrower at the top), dark brown, positioned so its base is at y = 0
- **Foliage** - a cone shape, forest green, sitting on top of the trunk

`def.mesh` is set to the trunk (used for vertex listing in the panel).

### `buildRockMesh`

Creates one piece: a roughly spherical icosahedron (a 20-sided geometric shape) with each vertex slightly pushed in or out by a noise formula to create an irregular, natural-looking surface. The noise is deterministic. The same formula always produces the same bumps, so the rock looks the same every time.

### `buildCabinMeshes`

Creates two pieces:
- A **body** - a box shape (rectangular building), brown, positioned with its base at y = 0
- A **roof** - a four-sided pyramid cone, darker brown, sitting on top of the box; rotated 45° so its corners align with the box corners

---

## `makeBaseGeo(def)`

Returns a single simplified geometry for each object type:
- Tree -> a cone
- Rock -> an icosahedron
- Cabin -> a box

---

## `disposeGroup(g)`

When an object's representation needs to be rebuilt (because the mode changed, or a stage was toggled), the old geometry must be cleaned up. This function walks through every object in a group and releases the GPU memory used by its geometry and materials. Without this, the GPU would slowly fill up with discarded data.

---

## `buildRepr(def)` - The Core Function

This is the main function of the module. Every time anything affects how an object should look (mode change, stage toggle, theme change, slider adjustment), this function is called to tear down the old representation and build a fresh one.

**Step by step:**

1. **Remove and dispose**. If the object already has a `reprGroup` in the scene, remove it and free its GPU memory.

2. **Create a new group**. A container that will hold all the meshes for this object.

3. **Apply world transform**. If Stage 2 is active, position/rotate/scale the group to the object's authored location. If Stage 2 is off, everything sits at the origin at default orientation.

4. **Determine material mode**. If Stage 3 is active, use physically-based lit materials and full color. Otherwise, use flat unlit materials and grey color.

5. **Build the representation**. Switch on `def.repr` and build one of four representations.

6. **Register the group**. Store the group back on `def.reprGroup` and add it to the 3D scene.

### Building B-Rep

Calls the composite builder for this object type (tree, rock, or cabin) to create the actual multi-part mesh.

### Building Points

1. Builds the composite geometry (trunk+foliage, or body+roof, etc.) into a temporary group that is never added to the scene.
2. Collects the position of every vertex from every mesh in that group. Each vertex is transformed into the group's local space (applying the mesh's own position offset) so that, for example, foliage vertices appear high up and trunk vertices appear low.
3. Randomly samples `def.pointDensity` vertices from the collected pool (with replacement, the same vertex may be picked more than once).
4. Renders the result as a `Points` object, a collection of dots with configurable size and color.

Using the composite builders here (instead of the simplified `makeBaseGeo`) is essential: without it, a Tree's point cloud would only show the foliage cone and completely miss the trunk.

### Building Voxels

Voxelization approximates a surface with a grid of small cubes.

1. Builds composite geometry into a temporary group.
2. Collects sample points from the geometry: every vertex of every triangle, plus the center point of every triangle. Triangle centers help catch large flat polygons that might have no vertices near a grid cell.
3. Computes the bounding box (the smallest box that contains all sample points).
4. Divides that bounding box into a `def.voxelRes * def.voxelRes * def.voxelRes` grid of cells.
5. For each cell, checks whether any sample point falls within it (with a 10% expanded acceptance zone to prevent gaps from floating-point rounding).
6. Places a small box (cube mesh) at each occupied cell, sized at 90% of the cell to leave visible gaps between voxels.

### Building Sweep (Surface of Revolution)

Creates a solid of revolution: a 3D shape formed by rotating a 2D profile curve around the vertical axis.

Three.js provides `LatheGeometry` for this: we supply a list of 2D points forming the profile, a number of angular segments, and a sweep angle, and it produces the 3D surface.

**Tree:** uses two separate sweep calls, one for the trunk (a tapered cylinder profile with caps) and one for the foliage (a triangle/cone profile). Both are separate meshes in the same group.

**Rock:** uses a single semicircle profile rotated 180° to produce a sphere-like shape. The semicircle starts and ends at x = 0, so both the bottom and top are capped.

**Cabin:** blocked. A cabin (box + pyramid) is not rotationally symmetric, so no profile rotation can approximate it. The UI shows a warning instead.

The sweep angle slider (0-360°) lets the user rotate the profile only partway, revealing the cross-section of the surface.

---

## Selection System

### `selectObject(def)`

1. Calls `clearSelection()` to remove any existing highlight.
2. Sets `S.selectedObj` to this object.
3. Looks at every mesh in the object's reprGroup and applies a highlight:
   - **Stage 3+ (lit materials):** sets the material's emissive color (a glow that adds on top of the lit surface). Color comes from the active theme.
   - **Stages 1-2 (flat materials):** flat materials have no emissive property, so instead a set of blue edge lines (`EdgesGeometry`) is added on top of each mesh part. Tagged `userData.isSelectionHighlight = true` for cleanup.
4. Calls `S.updateDetailPanels?.()` to refresh the panel.

### `clearSelection()`

Removes the highlight from the currently selected object:
- Resets emissive to black (off) on any lit material meshes.
- Removes all `isSelectionHighlight`-tagged overlay objects.

Uses a two-pass approach: first collect everything to remove, then remove them. This avoids modifying the group while traversing it, which can cause objects to be skipped.

---

## Detail Panel

### `buildDetail0()`

Creates the Stage 1 HTML control panel once at startup. It contains:

- **Info notice**. Reminds the user that Stage 1 shows flat grey geometry with no lighting
- **Object dropdown**. Selects which scene object to inspect/modify
- **Representation buttons**. B-Rep / Points / Voxels / Sweep
- **B-Rep controls**. Vertex coordinate list
- **Points controls**. Point size slider, point count slider
- **Voxel controls**. Resolution slider (3-10), voxel count display
- **Sweep controls**. Sweep angle slider (0-360°)

All controls check `if (!S.selectedObj) return`. They silently do nothing if no object is selected.

The Sweep button additionally checks if the selected object is a cabin and shows a warning if so.

### `updateDetail0()`

Called whenever the panel needs to reflect current state:
- Syncs the dropdown to the selected object
- Highlights the active representation button
- Shows/hides the correct control section
- Syncs all slider values and toggle states
- For B-Rep mode: lists the first 24 vertex coordinates of the primary mesh (e.g. trunk for Tree, body for Cabin) from its geometry buffer