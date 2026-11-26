// config.js — every tuning constant for Skyharbor Run in one place.
// The world is measured in metres, speeds in metres per second, angles in
// radians unless a name says Deg. Nothing here touches the DOM.

// Canvas the page renders at; screenshots are taken at this size too.
export const VIEW_WIDTH = 1280;
export const VIEW_HEIGHT = 720;

// The playable world: a square of coast centred on Skyharbor Field.
export const WORLD_HALF = 4200; // metres from centre to edge
export const SEA_LEVEL = 0;
export const GROUND_Y = 0; // the coastal plain sits at 0 m

// The home runway: heading north, threshold at the south end.
export const RUNWAY = {
  centerX: 0,
  centerZ: -1500,
  length: 620,
  width: 34,
  heading: 0, // pointing toward -Z (north on the compass rose)
};

// Kestrel K-7 flight model.
export const PLANE = {
  minSpeed: 0,
  cruiseSpeed: 52,
  maxSpeed: 88,
  stallSpeed: 24,
  throttleRate: 0.45, // throttle units per second at full key press
  accel: 14, // m/s gained per second at full throttle, level
  drag: 0.0035,
  climbAtCruise: 9, // m/s of climb at full pitch-up near cruise
  sinkAtIdle: 5.5, // m/s of sink at idle throttle, wings level
  maxBankDeg: 58,
  bankRateDeg: 130, // roll-in speed
  turnRateAtBank: 0.55, // rad/s of heading change at full bank, cruise
  pitchRateDeg: 46,
  fuelCapacity: 100,
  fuelBurnAtFull: 0.3, // fuel units per second at full throttle (~4.5 min aloft)
  fuelBurnAtIdle: 0.05,
};

// A sortie: fly the ring course, then come home and land.
export const MISSION = {
  ringCount: 7,
  ringRadius: 26,
  ringPoints: 150,
  ringTimeBonus: 2.0, // seconds of grace each ring adds back is shown as score
  startFuel: 78,
  perfectTouchdown: { maxSink: 1.6, maxSpeed: 34 },
  smoothTouchdown: { maxSink: 3.2, maxSpeed: 44 },
};

// Palette: one coastal morning, used by every renderer so the game reads
// as a single place.
export const PALETTE = {
  skyTop: '#2e6db4',
  skyMid: '#7db3e0',
  skyHorizon: '#dceef7',
  sea: '#2b6f8e',
  sand: '#d9c184',
  grassA: '#69a24b',
  grassB: '#7fb35a',
  fieldWheat: '#d8b34e',
  fieldPlough: '#9a6b44',
  fieldMeadow: '#8fbf67',
  fieldOrchard: '#5d9242',
  road: '#8d8d84',
  townWall: '#e8ddc8',
  townRoof: '#b5542f',
  hillFar: '#5b7d9e',
  hillNear: '#4c7355',
  runway: '#4a4a4f',
  runwayMark: '#f2f2ea',
  ringNext: '#ffb52e',
  ringDone: '#39d353',
  ringLater: '#e8f4ff',
  planeBody: '#e4572e',
  planeTrim: '#f7f3e8',
  panel: '#20262e',
  panelEdge: '#3d4754',
  gaugeFace: '#10151b',
  gaugeMark: '#e8f1f8',
  gaugeNeedle: '#ffb52e',
  warn: '#ff5252',
  good: '#39d353',
};
