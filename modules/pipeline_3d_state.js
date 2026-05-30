// Shared mutable state and theme definitions, imported by all pipeline modules.
// THREE is a CDN global, available to all modules since the CDN script loads before modules execute

export const THEMES = {
  light: { sceneBg:0xc8d8f0, gridMain:0x9aa4c8, gridSub:0xc4cce0, wireColor:0x227733, emissive:0x001a44 },
  dark:  { sceneBg:0x000000, gridMain:0x1e1e3a, gridSub:0x1e1e3a, wireColor:0xaaffaa, emissive:0x003a44 },
};

export const S = {
  // Three.js objects. Populated by pipeline_3d_main.js on startup
  scene: null, camera: null, renderer: null,
  godCamera: null, godRenderer: null,
  gridHelper: null, cameraHelper: null,
  ambientLight: null,

  // Sun / directional light (replaces old point light)
  dirLight: null,
  sunSphere: null,
  sunAzimuth: 45,
  sunElevation: 60,

  // Environment meshes (not part of objectDefs)
  terrain: null,
  skybox: null,

  // Pipeline stage on/off flags [stage1...stage5]
  stages: [false, false, false, false, false],
  openDetail: -1,        // which detail panel is expanded (-1 = none)
  selectedObj: null,     // currently selected objectDef
  splitActive: false,    // true when Stage 4 split view is active
  currentTheme: 'light',

  // Orbit state. Target Vectors set by main after THREE is available
  orbit: {
    dragging: false, button: -1, lastX: 0, lastY: 0,
    theta: 35, phi: 28, radius: 15,
    target: null,
  },
  godOrbit: {
    dragging: false, lastX: 0, lastY: 0,
    theta: 0, phi: 80, radius: 22,
    target: null,
  },

  // Scene objects (populated by main)
  objectDefs: [],

  // Stage 3 sub-toggles
  s3AmbientOn: true, s3DiffuseOn: true, s3SpecularOn: false, s3ShadowOn: true,

  // Stage 4 sub-toggles
  s4ViewingOn: false, s4ClipOn: false, s4HSROn: true, s4ProjOn: false,
  s4NearVal: 0.1, s4FarVal: 200,
  viewAxesHelper: null, orthoCamera: null,

  // Stage 5 state
  pixelSize: 4, s5AAOn: false, s5ScanlineOn: false, s5GridOn: false, scanlineY: 0,

  // Cross-module callbacks. Set by main before any stage interaction occurs
  updateDetailPanels: null,
  updateStats: null,
  resizeAll: null,
};

export function getEmissiveColor() { return THEMES[S.currentTheme].emissive; }
export function getWireColor()     { return THEMES[S.currentTheme].wireColor; }
