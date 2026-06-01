# Pipeline Stage 4: Viewing Transform & Projection

## Overview
Stage 4 handles the **viewing pipeline** - the final stage that determines what the camera sees and how it's rendered on screen. It manages camera controls, view frustum clipping, and hidden surface removal.

## Sub-Stages

### 1. Viewing Transform
Toggles between two view modes:
- **On (Split-View)**: Displays two simultaneous views - the main camera view on the right and a "god's eye" (overhead) view on the left. Useful for debugging and understanding camera positioning.
- **Off (Single View)**: Shows only the camera's perspective view in full viewport.

### 2. Clipping (Near/Far Planes)
Defines the camera's clipping window using near and far planes:
- **Near Plane**: Minimum distance from camera where objects are rendered (default: 0.1)
- **Far Plane**: Maximum distance from camera where objects are rendered (default: 200)

The clipping window is visualized as a wireframe box in the god's eye view when clipping is enabled. Objects beyond these planes are culled and not rendered.

### 3. Hidden Surface Removal (HSR)
Removes objects that fall outside the camera's clipping planes:
- **On**: Frustum culling is active - objects outside the near/far boundaries are removed from rendering
- **Off**: All objects are rendered regardless of clipping planes (useful for viewing the full scene)

When HSR is on, only front-facing surfaces are rendered (FrontSide mode) for proper depth ordering.

## Camera Controls

- **FOV (Field of View)**: Adjusts the camera's viewing angle (20° - 120°). Lower values = more zoomed in, higher values = wider view.
- **CamX, CamY, CamZ**: Precise control over the camera's position in 3D space.

## How It Works

1. The camera's viewing frustum is defined by its projection matrix (aspect ratio, FOV, near/far planes)
2. Frustum culling efficiently removes invisible objects before rendering
3. The clipping planes prevent objects from appearing distorted at extreme distances
4. The split-view mode provides debugging insight into what the camera "sees" vs. the full scene perspective
