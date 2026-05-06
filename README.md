# 3D Graphics Pipeline Simulator

An interactive, stage-by-stage visualization of the computer graphics pipeline built with Three.js. Designed to bridge the gap between theoretical concepts and visual understanding for students learning computer graphics.

---

## Table of Contents

- [Overview](#overview)
- [Motivation](#motivation)
- [Pipeline Stages](#pipeline-stages)
- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Controls](#controls)
- [Technologies](#technologies)

---

## Overview

Computer graphics relies on a series of well-defined steps — collectively called the **graphics pipeline** — to transform a 3D scene into a 2D image on screen. While these steps are fundamental to fields like video games, simulations, and visualization, their abstract nature makes them notoriously difficult to grasp.

This project provides an interactive 3D landscape scene where each stage of the pipeline can be toggled, inspected, and manipulated independently. By making each transformation visible and controllable, the simulator serves as a hands-on learning tool for anyone studying the fundamentals of computer graphics.

---

## Motivation

The graphics pipeline presents several learning challenges:

- **Abstract concepts** — Understanding how vertices and mathematical functions translate to pixels on screen requires mental models that are hard to build without visual feedback.
- **Cognitive load** — Tracking multiple simultaneous transformations (modeling, viewing, projection, rasterization) makes it difficult to understand each step individually.
- **Disconnected theory and practice** — Textbooks and lectures rarely allow experimentation with live parameters.

This simulator addresses all three by:

- Presenting each pipeline stage in a clear, sequential, and toggleable interface.
- Allowing step-by-step analysis so learners can focus on one transformation at a time.
- Supporting interactive manipulation of object position, scale, and camera perspective so users can immediately observe the effect of each change.

A solid understanding of the graphics pipeline is also a foundation for more advanced topics — real-time rendering, shader programming, computer vision — making this a valuable starting point for further study.

---

## Pipeline Stages

The simulator exposes five sequential stages. Each stage depends on the previous one being active.

| # | Stage | Description |
|---|-------|-------------|
| 1 | **Object Representation** | Scene objects (tree, rock, cabin) rendered using different geometry representations (B-Rep, point cloud, voxel, wireframe). |
| 2 | **Modeling Transform** | Applies per-object position, rotation, and scale transforms to place objects in world space. |
| 3 | **Lighting** | Enables directional sunlight, ambient light, atmospheric fog, and shadow casting. |
| 4 | **Viewing Pipeline** | Activates the camera/view transform. Includes a split-view god's-eye orthographic camera for comparison. |
| 5 | **Scan Conversion** | Simulates rasterization effects including pixelation and scanline rendering. |

---

## Features

- **Interactive stage toggling** — Enable or disable each pipeline stage independently; disabling a stage also cascades off all dependent stages.
- **Object selection** — Click any scene object to inspect and modify its representation type, wireframe overlay, surface normals, point density, and voxel resolution.
- **Split-view god's-eye camera** — Stage 4 opens a side-by-side orthographic overhead view showing the camera frustum in the scene.
- **Orbit controls** — Drag to rotate, scroll to zoom on both the main and god's-eye viewports.
- **WASD camera movement** — Move the perspective camera through the scene.
- **Pixelation & scanline effects** — Stage 5 simulates low-resolution scan conversion with adjustable pixel size.
- **Light and dark themes** — Toggle between light and dark UI themes.
- **Live stats** — Displays active object count, vertex count, triangle count, and active stage count.

---

## Project Structure

```
├── pipeline_3d_main.js         # Entry point: Three.js setup, render loop, stage UI, events
├── pipeline_3d_state.js        # Shared state (S) and theme definitions
├── pipeline_3d_landscape.js    # Terrain, skybox, sun sphere, directional light
├── pipeline_3d_stage1.js       # Stage 1 — Object representation (B-Rep, points, voxels)
├── pipeline_3d_stage2.js       # Stage 2 — Modeling transforms
├── pipeline_3d_stage3.js       # Stage 3 — Lighting and material setup
├── pipeline_3d_stage4.js       # Stage 4 — Viewing pipeline, split view, ortho camera
└── pipeline_3d_stage5.js       # Stage 5 — Scan conversion, pixelation, zoom inset
```

---

## Getting Started

### Prerequisites

- A modern browser with WebGL support (Chrome, Firefox, Edge, Safari).
- A local HTTP server to serve ES module files (required for `import` statements).

### Running Locally

```bash
# Using Python
python -m http.server 8080

# Using Node.js (npx)
npx serve .
```

Then open `http://localhost:8080` in your browser.

> **Note:** Opening `index.html` directly via `file://` will not work due to ES module CORS restrictions.

---

## Usage

1. **Enable stages sequentially** using the toggle switches in the left panel. Stage 1 must be active before Stage 2, and so on.
2. **Click a stage header** to expand its detail panel with controls specific to that stage.
3. **Click a scene object** (tree, rock, or cabin) to select it and modify its representation type and visual options.
4. **Drag** on the main viewport to orbit the camera. **Scroll** to zoom.
5. **Use WASD** to pan the camera through the landscape.

---

## Controls

| Action | Control |
|--------|---------|
| Orbit camera | Left-click drag on main viewport |
| Zoom | Mouse wheel on main viewport |
| Pan camera | W / A / S / D keys |
| Select object | Left-click on an object |
| Deselect | Left-click on empty space |
| Orbit god's-eye view | Left-click drag on god-eye viewport |
| Zoom god's-eye view | Mouse wheel on god-eye viewport |

---

## Technologies

- **[Three.js](https://threejs.org/)** — 3D scene graph, geometry, materials, and WebGL rendering.
- **Vanilla JavaScript (ES Modules)** — No build step required.
- **HTML5 Canvas / WebGL** — Dual-canvas rendering (main perspective + god's-eye orthographic).

---

## Context

This project was developed as part of a study of the computer graphics pipeline. Its goal is to reduce the abstraction barrier that students commonly encounter when learning how 3D scenes are converted into 2D images, making the foundational concepts of computer graphics more accessible and intuitive.
