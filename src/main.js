import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DragControls } from 'three/examples/jsm/controls/DragControls.js';
import { projectConstraints, resolveOverlaps } from './pbd.js';
import { initPyodideAndAPI } from './api.js';

let scene, camera, renderer, controls, dragControls;
const spheres = []; // dynamic list of sphere meshes
let N = 11;         // current ball count
const R = 1;
const D = 2 * R;
let mode = 'balls';          // 'balls' | 'sticks'
let fixedSticks = false;     // only used in sticks mode
let tubeRadiusSticks = 0.05; // sticks thickness (reuses the “ratio” control)
let segmentCyls = [];        // cylinder meshes for sticks mode
let restLengths = [];        // neighbor rest lengths when fixed sticks
let stickVertexSpheres = []; // tiny spheres at vertices (sticks mode only)
let stickVertexMaterial = null;
let ratio = 1.0;          // virtual radius for non-neighbor constraints (0.8..1.0)
let sphereOpacity = 0.9;  // UI-controlled opacity
let tubeDark = 0.8;       // 0..1, 1=darkest
let settlingFrames = 0;
let closedChain = false; 

const TOL = 1e-4;         // constraint tolerance

// Tube params (centerline tube inside balls)
let tubeMesh = null;
let tubeMaterial = null;
const TUBE_SEGMENTS = 240;
const TUBE_RADIUS   = 0.05;
const TUBE_RADIAL   = 12;

// Shared sphere geometry
const sphereGeom = new THREE.SphereGeometry(R, 32, 16);

// Presets
const LOCKED_TREFOIL_11 = [
  [-2.624869700268529, 0.10583593512340614, 3.0685696239990623],
  [-2.681541021227203, 2.0113771784890173, 2.384005550711061],
  [-4.3182595004243876, 3.125598752772765, 2.7156935627616012],
  [-5.116011465248746, 2.599399111040094, 4.486316589560745],
  [-3.986438889459273, 1.1462324784140954, 5.297948652265001],
  [-2.0571764758822026, 1.0069193356462496, 4.758856713339242],
  [-0.977088770577106, 1.2367784687108556, 3.082989674076888],
  [-1.7441690856967325, 0.5967865292042323, 1.3380731990993546],
  [-3.751852008707902, 0.5862477068631713, 1.478777172267485],
  [-4.267208807434025, 1.2128743102696067, 3.3151472114253377],
  [-3.1300141964206545, 2.612017699403403, 4.236670474479993]
];

const LOCKED_FIGURE8_16 = [
  [-3.0740013184844064, 4.3977094138865, 3.284062510710861],
  [-3.5570131947089814, 4.47676548625323, 1.3448746227412705],
  [-2.904974233802344, 3.166829725579017, -0.018545157211574355],
  [-1.229381256944175, 2.5439983767930423, -0.9154672758333771],
  [-0.26566906780440247, 3.3666118945120216, 0.6319711936927732],
  [-0.3406579922837306, 4.168031366638994, 2.4628462552142194],
  [-0.31399083504463016, 5.98270893595293, 3.303223659809113],
  [-1.0174869043900694, 7.480189276118194, 2.1795484793258733],
  [-1.860632559491898, 6.73425525664919, 0.5264641369882769],
  [-1.719565550516834, 4.7393540736108015, 0.5481290600407955],
  [-2.021917711248147, 3.2098646804811617, 1.8008243011928617],
  [-3.882490025759295, 2.7863217053549096, 2.39989191899225],
  [-5.005244468408313, 4.409152965062662, 2.725224309060073],
  [-3.932942682417033, 6.094913308183174, 2.6336768059694537],
  [-2.001077200846353, 5.740468311878083, 2.2564971329885637],
  [-0.24369450718480085, 5.854574488135534, 1.3085594511978393]
];

const LOCKED_DOUBLE_OVERHAND_18 = [
  [10.022332844404508, -0.6354988943486187, -1.4406447454161866],
  [ 9.921664667723563, -1.8642921823864067, 0.13413554830005636],
  [ 9.683493057511434, -1.3107783560299258, 2.0412004995067976],
  [10.89502642743928,  0.1044822253346981,  2.7686785956627884],
  [12.516515405952285, 0.27080969550342393, 1.6097529443684002],
  [13.503532275146377,-1.2409797783108711,  0.7493517084379786],
  [13.677288013757199,-1.8208089130090568, -1.156850567779044],
  [11.955659022561044,-2.362344336733756,  -2.018670155351882],
  [ 9.993364628582334,-2.614824962854049,  -1.72600269082321],
  [ 8.349186841897078,-1.6724797809191116, -1.0867336051833805],
  [ 8.861322978071344,-0.159397897568845,   0.11671967280530193],
  [10.743855170775591,-0.16394807984565524, 0.7920357760291098],
  [11.686511112706137,-1.522739040937635,   1.9167965946913574],
  [13.454540471212283,-1.084451342673796,   2.7426150257105095],
  [14.515236372781182, 0.22268921756379206, 1.662657730176694],
  [13.568982231374273, 0.5861307658446917, -0.06144010372179506],
  [12.108779408761912,-0.6026485198133851, -0.7356889649185835],
  [11.877027466846014,-2.392577723469843,   0.12596321741252972]
];

const STEVEDORE_22 = [
  [ 2.051526775491922,  -7.559539456367731,  -4.479407650260486],
  [ 1.7195673695804812, -5.585198302807112,  -4.725032689935812],
  [ 1.335744059077316,  -3.622105938156657,  -4.515820555322602],
  [ 2.2010208634331105, -1.8182226359217275, -4.578633366235576],
  [ 2.423177051966843,  -0.7831505022326322, -2.869356963579922],
  [ 2.48870467597945,   -2.0773948601517427, -1.3298504891373593],
  [ 2.3062178082465974, -3.944883288091524,  -2.0490164890778124],
  [ 3.065784711648732,  -4.379998787796813,  -3.865974596240686],
  [ 2.703898454730253,  -4.24775740717042,   -5.831491554835402],
  [ 0.7509908658401141, -4.595832171341833,  -6.159165072940935],
  [-0.14696721506766652,-4.957000977838699,  -4.397031458628063],
  [ 1.0902843456518383, -5.297617537650165,  -2.8549991452118704],
  [ 2.836545609824805,  -6.243381986154819,  -3.2027627758070594],
  [ 3.5318163968919047, -6.356581504218745,  -5.083137678379871],
  [ 1.9977440622975429, -6.7638449136005985, -6.318246079616762],
  [ 0.3117439175980464, -6.912236050422085,  -5.231988254510501],
  [ 0.52009175207975,   -7.174434772222447,  -3.2525147513767054],
  [ 1.681746504332668,  -6.7930216304773285, -1.662468078552357],
  [ 3.2408790933545872, -5.566384092741671,  -1.3647779319057747],
  [ 4.282290058745082,  -4.1233604688796754, -2.2936769982246448],
  [ 3.3171912150166887, -2.5547145629199663, -3.088072116182919],
  [ 1.304442660628876,  -2.4405498783532478, -2.9054203342120486]
];

const KNOT_9_29 = [
  [-0.01705188882962603,	-0.8472070769441673,	0.5309890788547935],
  [0.041386237542474724,	0.04265321980605685,	0.07851406556265417],
  [-0.006817402438744069,	-0.9406813617024611,	0.25381241096850504],
  [-0.028582515259995032,	-0.09019744875337588,	0.7793629734063082],
  [0.06629662310464379,	-0.06256778735228902,	-0.21574232298902563],
  [0.06914020976103849,	-0.24079725362023752,	0.7682425200694282],
  [-0.3617541314019883,	-0.7692376495316422,	0.03675033643198222],
  [0.29177162736175377,	-0.5711160126667256,	0.7672651546514633],
  [0,	0,	0]
];



//const LOCKED_DOUBLE_FISHERMAN_37=[[2.873130,16.967777,19.664950],[3.587838,15.512116,18.494375],[3.347067,14.627039,16.717111],[2.495361,12.829380,16.509697],[1.787134,10.959353,16.472132],[2.765861,9.838331,17.808322],[4.141680,10.953551,18.737519],[4.938975,12.685074,19.342621],[5.293810,14.468360,18.509565],[4.941728,15.787787,17.048350],[3.124593,16.607408,16.886351],[1.764604,15.376588,17.683541],[2.675079,13.736420,18.377000],[4.325794,13.056391,17.475502],[5.635883,11.970550,16.424494],[5.828447,12.173977,14.444207],[4.213247,12.591523,13.341128],[2.460712,13.044023,14.191929],[0.892935,12.572663,15.340797],[0.717176,12.416905,17.326961],[2.394311,11.764204,18.199427],[3.735530,11.268444,16.801088],[4.759392,10.659380,15.194617],[4.903769,8.664919,15.158802],[6.421082,8.173964,16.365752],[6.910150,9.365598,17.895726],[7.008515,11.361581,17.815871],[6.992380,13.250788,17.159643],[5.551022,13.908938,15.939263],[4.106942,12.663174,15.337015],[2.869304,11.184792,14.805374],[3.249083,9.547395,15.889208],[4.821537,9.620111,17.122943],[6.462926,10.157685,16.114550],[7.795253,10.432765,14.648522],[9.003727,10.987144,13.154449],[10.877002,11.265632,12.511579]];

init();
animate();

function init() {
  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('app').appendChild(renderer.domElement);

  // Scene & Camera
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4f4f4);

  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(12, 10, 16);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // Lights
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.9));
  const dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(5, 10, 7);
  scene.add(dir);

  // Initial spheres
  for (let i = 0; i < N; i++) addBallAtIndex(i);
  rebuildTubeCenterline();
  resetDragControls();

  // Resize
  window.addEventListener('resize', onResize);

  // UI: preset dropdown
  const presetSelect = document.getElementById('presetSelect');
  presetSelect.value = 'default11';
  presetSelect.addEventListener('change', (e) => applyPreset(e.target.value));

  // UI: number input for Balls
  const ballInput = document.getElementById('ballCountInput');
  ballInput.value = String(N);
  const applyBallInput = () => setBallCount(parseInt(ballInput.value || N, 10));
  ballInput.addEventListener('change', applyBallInput);
  ballInput.addEventListener('input',  ()=>{/* live typing allowed; apply on change */});

  // UI: number input for Ratio
  //const ratioInput = document.getElementById('ratioInput');
  //ratioInput.value = ratio.toFixed(3);
  //const applyRatioInput = () => setRatio(parseFloat(ratioInput.value || ratio));
  //ratioInput.addEventListener('change', applyRatioInput);
  //ratioInput.addEventListener('input',  ()=>{/* apply on change to avoid jitter */});

  // UI: opacity slider
  const opacitySlider = document.getElementById('opacitySlider');
  opacitySlider.value = String(sphereOpacity);
  opacitySlider.addEventListener('input', (e) => {
    const v = Math.max(0.1, Math.min(1.0, Number(e.target.value)));
    setSphereOpacity(v);
  });

  // UI: tube darkness slider (0=light, 1=darkest)
  const tubeColorSlider = document.getElementById('tubeColorSlider');
  tubeColorSlider.value = String(tubeDark);
  tubeColorSlider.addEventListener('input', (e) => {
    const v = Math.max(0, Math.min(1, Number(e.target.value)));
    setTubeDarkness(v);
  });

  const closedBox = document.getElementById('closedChain');
  closedBox.checked = closedChain;
  closedBox.addEventListener('change', () => setClosedChain(closedBox.checked));


  // Mode dropdown
  const modeSelect = document.getElementById('modeSelect');
  modeSelect.value = mode;
  modeSelect.addEventListener('change', () => setMode(modeSelect.value));

  // Repurpose ratio input label + step/min/max between modes
  //const ratioInput = document.getElementById('ratioInput');
  const ratioLabel = document.querySelector('label[for="ratioInput"]'); // your existing label

  const ratioInput = document.getElementById('ratioInput');
  configureRatioForMode(); // set label/limits/value based on current mode
  ratioInput.addEventListener('change', () => {
    const v = parseFloat(ratioInput.value);
    if (Number.isNaN(v)) return;
    if (mode === 'balls') setRatio(v); else setTubeThickness(v);
  });
  // allow arrow steppers to reflect immediately:
  ratioInput.addEventListener('input', () => {
    const v = parseFloat(ratioInput.value);
    if (Number.isNaN(v)) return;
    if (mode === 'balls') setRatio(v); else setTubeThickness(v);
  });

  //ratioInput.addEventListener('change', () => {
  //  if (mode === 'balls') setRatio(parseFloat(ratioInput.value || ratio));
  //  else setTubeThickness(parseFloat(ratioInput.value || tubeRadiusSticks));
  //});

  // Fixed-length checkbox (only shown in sticks mode)
  const fixedRow = document.getElementById('fixedSticksRow');
  const fixedBox = document.getElementById('fixedSticks');
  fixedRow.style.display = (mode === 'sticks') ? '' : 'none';
  fixedBox.checked = fixedSticks;
  fixedBox.addEventListener('change', () => {
    fixedSticks = fixedBox.checked;
    if (fixedSticks) captureRestLengths();
  });


  // Pyodide API
  const chainAPI = {
    getPositions: () => spheres.map(m => [m.position.x, m.position.y, m.position.z]),
    setPositions: (arr) => {
      const M = Math.min(arr.length, spheres.length);
      for (let i = 0; i < M; i++) {
        const [x, y, z] = arr[i];
        spheres[i].position.set(x, y, z);
      }
      rebuildTubeCenterline();
    },
    setBallCount: (n) => setBallCount(n),   // will sync the input box
    getBallCount: () => spheres.length,
    setRatio: (val) => setRatio(val),       // will sync the input box
    getRatio: () => ratio,
    setPreset: (name) => applyPreset(String(name)),
    projectConstraints: (iters = 20) => {
      const P = spheres.map(m => m.position.clone());
      projectConstraints(P, D, iters);
      resolveOverlaps(P, 2 * R * ratio, Math.max(1, Math.floor(iters / 5)));
      for (let i = 0; i < spheres.length; i++) spheres[i].position.copy(P[i]);
      rebuildTubeCenterline();
    },
    computeDistances: (indices) => {
      const out = [];
      for (let a = 0; a < indices.length; a++) {
        for (let b = a + 1; b < indices.length; b++) {
          const i = indices[a], j = indices[b];
          const pi = spheres[i].position, pj = spheres[j].position;
          out.push([i, j, pi.distanceTo(pj)]);
        }
      }
      return out;
    }
  };

  initPyodideAndAPI(chainAPI).then(() => {
    const btn = document.getElementById('run-py');
    const ta = document.getElementById('py-pane');
    btn.onclick = async () => { if (window.__runPython) await window.__runPython(ta.value); };
  });
}

// ---------- Ball management ----------

function makeSphereMaterial() {
  return new THREE.MeshStandardMaterial({
    metalness: 0.1,
    roughness: 0.5,
    transparent: true,
    opacity: sphereOpacity,   // from UI
    depthWrite: false
  });
}

function addBallAtIndex(i) {
  const mesh = new THREE.Mesh(sphereGeom, makeSphereMaterial());
    // hide spheres in sticks mode
  mesh.visible = (mode === 'balls');

  if (spheres.length === 0) {
    mesh.position.set(0, 0, 0);
  } else if (spheres.length === 1) {
        // extend by one segment: balls -> ~D, sticks -> length of segment 0
    const a = spheres[0].position.clone();
    const extLen = (mode === 'sticks') ? D : D * 0.9;
    mesh.position.copy(a).add(new THREE.Vector3(extLen, 0, 0));
  } else {
    const last = spheres[spheres.length - 1].position.clone();
    const prev = spheres[spheres.length - 2].position.clone();
    const dir  = last.clone().sub(prev);
    if (dir.lengthSq() < 1e-8) dir.set(1, 0, 0);
    dir.normalize();
        // balls: use ~D; sticks: match previous segment length
    const prevLen = last.distanceTo(prev) || D;
    const extLen  = (mode === 'sticks') ? prevLen : D * 0.9;
    mesh.position.copy(last).addScaledVector(dir, extLen);
  }
  if (mode === 'balls' && spheres.length % 2 === 1) mesh.position.y += 0.8;
  scene.add(mesh);
  spheres.push(mesh);
}

function removeLastBall() {
  if (spheres.length <= 2) return; // keep at least 2
  const m = spheres.pop();
  scene.remove(m);
}

function updateBallCountInternal(targetN) {
  targetN = Math.max(2, Math.min(60, Math.floor(targetN)));
  while (spheres.length < targetN) addBallAtIndex(spheres.length);
  while (spheres.length > targetN) removeLastBall();
  N = spheres.length;
    // ensure visibility matches current mode for all spheres
  for (const s of spheres) s.visible = (mode === 'balls');
  rebuildTubeCenterline();
  resetDragControls();
}

function setBallCount(n) {
  updateBallCountInternal(n);
  const inp = document.getElementById('ballCountInput');
  if (inp) inp.value = String(N);
  if (mode === 'sticks') { captureRestLengths(); rebuildStickCylinders(); }
  if (mode === 'sticks') {
    captureRestLengths();
    rebuildStickCylinders();
    rebuildStickVertexSpheres();
  }
}

function setClosedChain(v) {
  closedChain = !!v;
  const P = spheres.map(m => m.position.clone());
  projectConstraints(P, D, 40);
  if (closedChain) enforcePairTangency(P, 0, P.length - 1, D, 40);
  resolveOverlaps(P, 2 * R * ratio, 8);
  for (let i = 0; i < spheres.length; i++) spheres[i].position.copy(P[i]);
  if (mode === 'sticks') { captureRestLengths(); rebuildStickCylinders(); }
  if (mode === 'sticks') {
    captureRestLengths();
    rebuildStickCylinders();
    rebuildStickVertexSpheres();
  }
}



function setRatio(val) {
  const clamped = Math.max(0.8, Math.min(1.2, Number(val)));
  ratio = clamped;
  const inp = document.getElementById('ratioInput');
  if (inp && mode === 'balls') inp.value = ratio.toFixed(3);
}

function setSphereOpacity(v) {
  sphereOpacity = v;
  for (const s of spheres) {
    s.material.opacity = sphereOpacity;
    s.material.needsUpdate = true;
  }
}

function setTubeDarkness(v) {
  tubeDark = v;
  const intensity = 1 - tubeDark; // 0=black, 1=white
  if (tubeMaterial) {
    tubeMaterial.color.setScalar(intensity);
    tubeMaterial.needsUpdate = true;
  } else if (tubeMesh && tubeMesh.material) {
    tubeMesh.material.color.setScalar(intensity);
    tubeMesh.material.needsUpdate = true;
  }
}

function resetDragControls() {
  if (dragControls) dragControls.dispose();
  dragControls = new DragControls(spheres, camera, renderer.domElement);
  dragControls.addEventListener('dragstart', () => { controls.enabled = false; });
  dragControls.addEventListener('drag', () => { settlingFrames = 10; rebuildTubeCenterline(); });
  dragControls.addEventListener('dragend', () => { controls.enabled = true; settlingFrames = 60; rebuildTubeCenterline(); });
}

function enforcePairTangency(P, i, j, targetDist, iters = 1) {
  for (let k = 0; k < iters; k++) {
    const a = P[i], b = P[j];
    const delta = b.clone().sub(a);
    let d = delta.length();
    if (d < 1e-9) {
      // tiny random nudge to avoid NaN
      delta.set(1e-3, 0, 0);
      d = delta.length();
    }
    const diff = (d - targetDist) * 0.5;
    const corr = delta.multiplyScalar(diff / d);
    a.add(corr);
    b.sub(corr);
  }
}

function setMode(m) {
  mode = (m === 'sticks') ? 'sticks' : 'balls';
  // show/hide spheres
  for (const s of spheres) s.visible = (mode === 'balls');
  if (mode === 'sticks') {
   if (tubeMesh) tubeMesh.visible = false;
  } else {
   if (tubeMesh) tubeMesh.visible = true;
   else rebuildTubeCenterline(); // create it if it doesn't exist yet
  }
  // configure ratio/thickness input & label
  const fixedRow = document.getElementById('fixedSticksRow');
  fixedRow.style.display = (mode === 'sticks') ? '' : 'none';
  //configureRatioForMode(); // switches label, limits, and displayed value

  // Hide/show bottom sliders in sticks mode
  const opacityRow = document.getElementById('opacityRow');
  const tubeDarkRow = document.getElementById('tubeDarkRow');
  if (opacityRow)  opacityRow.style.display  = (mode === 'sticks') ? 'none' : '';
  if (tubeDarkRow) tubeDarkRow.style.display = (mode === 'sticks') ? 'none' : '';
  configureRatioForMode();

  if (mode === 'sticks') {
    captureRestLengths();
    clearStickCylinders();
    rebuildStickCylinders();
    rebuildStickVertexSpheres();
  } else {
    clearStickCylinders();
    rebuildTubeCenterline();
    clearStickVertexSpheres();
  }
}

function setTubeThickness(v) {
  tubeRadiusSticks = Math.max(0.01, Math.min(0.6, Number(v)));
  const ratioInput = document.getElementById('ratioInput');
  if (ratioInput && mode === 'sticks') ratioInput.value = tubeRadiusSticks.toFixed(3);
  rebuildStickCylinders();
  rebuildStickVertexSpheres();
}

function configureRatioForMode() {
  const ratioInput = document.getElementById('ratioInput');
  const ratioLabel = document.querySelector('label[for="ratioInput"]');
  if (!ratioInput || !ratioLabel) return;

  if (mode === 'balls') {
    ratioLabel.textContent = 'Overlap ratio';
    ratioInput.min = '0.8';
    ratioInput.max = '1';
    ratioInput.step = '0.001';
    ratioInput.value = Number(ratio).toFixed(3);
  } else {
    ratioLabel.textContent = 'Tube thickness';
    ratioInput.min = '0.01';
    ratioInput.max = '0.60';
    ratioInput.step = '0.001';
    ratioInput.value = Number(tubeRadiusSticks).toFixed(3);
  }
}


// ---------- Presets ----------

function applyPreset(name) {
  if (name === 'trefoil11') {
    setBallCount(11);
    for (let i = 0; i < 11; i++) spheres[i].position.set(...LOCKED_TREFOIL_11[i]);
  } else if (name === 'figure8_16') {
    setBallCount(16);
    for (let i = 0; i < 16; i++) spheres[i].position.set(...LOCKED_FIGURE8_16[i]);
  } else if (name === 'double_overhand_18') {
    setBallCount(18);
    for (let i = 0; i < 18; i++) spheres[i].position.set(...LOCKED_DOUBLE_OVERHAND_18[i]);
  } else if (name === 'stevedore_22') {
    setBallCount(22);
    for (let i = 0; i < 22; i++) spheres[i].position.set(...STEVEDORE_22[i]);
  } else if (name === 'knot_9_29') {
    setBallCount(9);
    for (let i = 0; i < 9; i++) spheres[i].position.set(...KNOT_9_29[i]);
  } else {
    // default chain (11)
    setBallCount(11);
    const zig = 0.8;
    for (let i = 0; i < 11; i++) spheres[i].position.set(i * D * 0.9, (i % 2 ? zig : 0), 0);
  }

  const P = spheres.map(m => m.position.clone());
  projectConstraints(P, D, 60);
  resolveOverlaps(P, 2 * R * ratio, 12);
  for (let i = 0; i < spheres.length; i++) spheres[i].position.copy(P[i]);

  rebuildTubeCenterline();
  checkConstraints();

  const presetSelect = document.getElementById('presetSelect');
  if (presetSelect) presetSelect.value = name;
}

// ---------- UI / View helpers ----------

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}

function rebuildTubeCenterline() {
  if (mode !== 'balls') { if (tubeMesh) tubeMesh.visible = false; return; }
  if (spheres.length < 2) return;
  const centers = spheres.map(s => s.position.clone());
  const curve = new THREE.CatmullRomCurve3(centers, closedChain, 'centripetal');
  const newGeom = new THREE.TubeGeometry(curve, TUBE_SEGMENTS, TUBE_RADIUS, TUBE_RADIAL, closedChain);
  const intensity = 1 - tubeDark;

  if (!tubeMesh) {
    tubeMaterial = new THREE.MeshStandardMaterial({
      metalness: 0.0,
      roughness: 0.25,
      color: new THREE.Color(intensity, intensity, intensity) // grayscale
    });
    tubeMesh = new THREE.Mesh(newGeom, tubeMaterial);
    scene.add(tubeMesh);
  } else {
    tubeMesh.geometry.dispose();
    tubeMesh.geometry = newGeom;
  }
}
function clearStickVertexSpheres() {
  for (const m of stickVertexSpheres) {
    scene.remove(m);
    m.geometry && m.geometry.dispose();
    m.material && m.material.dispose?.();
  }
  stickVertexSpheres = [];
  stickVertexMaterial = null;
}

function rebuildStickVertexSpheres() {
  const n = spheres.length;
  const r = 2 * tubeRadiusSticks; // small visual dots

  // material: grayscale to match tube darkness
  const intensity = 1 - tubeDark;
  if (!stickVertexMaterial) {
    stickVertexMaterial = new THREE.MeshStandardMaterial({
      metalness: 0.0, roughness: 0.3,
      color: new THREE.Color(intensity, intensity, intensity)
    });
  } else {
    stickVertexMaterial.color.setScalar(intensity);
    stickVertexMaterial.needsUpdate = true;
  }

  // grow/shrink pool
  while (stickVertexSpheres.length < n) {
    const geom = new THREE.SphereGeometry(r, 16, 12);
    const mesh = new THREE.Mesh(geom, stickVertexMaterial);
    scene.add(mesh);
    stickVertexSpheres.push(mesh);
  }
  while (stickVertexSpheres.length > n) {
    const m = stickVertexSpheres.pop();
    scene.remove(m);
    m.geometry.dispose();
    // material is shared; don't dispose here
  }

  // ensure radius matches current thickness (rebuild geometry for each)
  for (let i = 0; i < stickVertexSpheres.length; i++) {
    const m = stickVertexSpheres[i];
    m.geometry.dispose();
    m.geometry = new THREE.SphereGeometry(r, 16, 12);
  }
  updateStickVertexSpheresPositions();
}

function updateStickVertexSpheresPositions() {
  for (let i = 0; i < stickVertexSpheres.length; i++) {
    stickVertexSpheres[i].position.copy(spheres[i].position);
    stickVertexSpheres[i].visible = (mode === 'sticks');
  }
}


function clearStickCylinders() {
  for (const m of segmentCyls) {
    scene.remove(m);
    m.geometry && m.geometry.dispose();
    m.material && m.material.dispose?.();
  }
  segmentCyls = [];
}

function rebuildStickCylinders() {
  // ensure one cylinder per neighbor segment (and wrap if closed)
  const centers = spheres.map(s => s.position.clone());
  const segCount = closedChain ? centers.length : Math.max(centers.length - 1, 0);

  // grow/shrink pool
  while (segmentCyls.length < segCount) {
    const mat = new THREE.MeshStandardMaterial({ metalness: 0.0, roughness: 0.25, color: 0x222222 });
    const geom = new THREE.CylinderGeometry(tubeRadiusSticks, tubeRadiusSticks, 1, 12, 1, true);
    const mesh = new THREE.Mesh(geom, mat);
    scene.add(mesh);
    segmentCyls.push(mesh);
  }
  while (segmentCyls.length > segCount) {
    const m = segmentCyls.pop();
    scene.remove(m);
    m.geometry.dispose();
    m.material.dispose?.();
  }

  // orient and scale each cylinder
  const up = new THREE.Vector3(0,1,0);
  for (let i = 0; i < segCount; i++) {
    const a = centers[i];
    const b = (i === centers.length - 1) ? centers[0] : centers[i+1];
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const dir = b.clone().sub(a);
    const len = Math.max(1e-6, dir.length());
    const m = segmentCyls[i];

    // scale height to len
    m.scale.set(1, 1, 1);
    m.geometry.dispose();
    m.geometry = new THREE.CylinderGeometry(tubeRadiusSticks, tubeRadiusSticks, len, 10, 1, true);

    // orient: cylinder Y axis to dir
    m.position.copy(mid);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
    m.setRotationFromQuaternion(quat);
  }
}

function checkConstraints() {
  const msgLines = [];
  const n = spheres.length;
  const P = spheres.map(s => s.position);

  if (mode === 'balls') {
    // neighbor tangencies
    for (let i = 0; i < n - 1; i++) {
      const d = P[i].distanceTo(P[i + 1]);
      if (Math.abs(d - 2) > TOL) msgLines.push(`Tangency error: balls ${i}-${i+1} dist=${d.toFixed(3)}`);
    }
    if (closedChain && n >= 2) {
      const d = P[0].distanceTo(P[n - 1]);
      if (Math.abs(d - 2) > TOL) msgLines.push(`Tangency error: balls 0-${n-1} dist=${d.toFixed(3)}`);
    }
    // non-neighbors (skip wrap pair when closed)
    const minSep = 2 * R * ratio - TOL;
    for (let i = 0; i < n; i++) {
      for (let j = i + 2; j < n; j++) {
        if (closedChain && i === 0 && j === n - 1) continue;
        const d = P[i].distanceTo(P[j]);
        if (d < minSep) msgLines.push(`Overlap error: balls ${i}-${j} dist=${d.toFixed(3)}`);
      }
    }
  } else {
    // STICKS: report segment-segment near collisions
    const segs = [];
    const segCount = closedChain ? n : Math.max(n - 1, 0);
    for (let i = 0; i < segCount; i++) segs.push([i, (i + 1) % n]);
    const minD = 2 * tubeRadiusSticks;
    for (let a = 0; a < segs.length; a++) {
      for (let b = a + 1; b < segs.length; b++) {
        const [i, i2] = segs[a]; const [j, j2] = segs[b];
        if (i === j || i2 === j || (closedChain && j2 === i)) continue; // share vertex
        const { d2 } = closestPointsOnSegments(P[i], P[i2], P[j], P[j2]);
        if (d2 < (minD * minD - 1e-6)) {
          msgLines.push(`Self-intersection risk: seg ${i}-${i2} vs ${j}-${j2} (d<${minD.toFixed(3)})`);
        }
      }
    }
    if (fixedSticks) {
      // Optional: report length drift
      for (let i = 0; i < Math.min(restLengths.length, segCount); i++) {
        const a = P[i], b = P[(i+1) % n], d = a.distanceTo(b);
        if (Math.abs(d - restLengths[i]) > 1e-3) {
          msgLines.push(`Length drift on seg ${i}-${(i+1)%n}: ${d.toFixed(3)} vs ${restLengths[i].toFixed(3)}`);
        }
      }
    }
  }

  const box = document.getElementById('constraintWarning');
  box.textContent = (msgLines.length > 0) ? "⚠️ Constraint issues:\n" + msgLines.join("\n") : "";
}


function closestPointsOnSegments(p1, q1, p2, q2) {
  // Returns {c1, c2, d2} where c1/c2 are closest points and d2 is squared distance
  const EPS = 1e-9;
  const d1 = q1.clone().sub(p1);
  const d2v = q2.clone().sub(p2);
  const r = p1.clone().sub(p2);
  const a = d1.dot(d1);
  const e = d2v.dot(d2v);
  const f = d2v.dot(r);

  let s, t;
  if (a <= EPS && e <= EPS) {
    s = t = 0;
  } else if (a <= EPS) {
    s = 0; t = THREE.MathUtils.clamp(f/e, 0, 1);
  } else {
    const c = d1.dot(r);
    if (e <= EPS) {
      t = 0; s = THREE.MathUtils.clamp(-c/a, 0, 1);
    } else {
      const b = d1.dot(d2v);
      const denom = a*e - b*b;
      s = (denom !== 0) ? THREE.MathUtils.clamp((b*f - c*e)/denom, 0, 1) : 0;
      t = (b*s + f)/e;
      if (t < 0) { t = 0; s = THREE.MathUtils.clamp(-c/a, 0, 1); }
      else if (t > 1) { t = 1; s = THREE.MathUtils.clamp((b - c)/a, 0, 1); }
    }
  }
  const c1 = p1.clone().add(d1.multiplyScalar(s));
  const c2 = p2.clone().add(d2v.multiplyScalar(t));
  return { c1, c2, d2: c1.distanceToSquared(c2) };
}

function resolveSelfIntersections(P, radius, iters = 1) {
  // Separate non-adjacent segments if their centerlines are closer than 2*radius
  const n = P.length;
  const pairs = [];
  for (let i = 0; i < n - 1 + (closedChain ? 1 : 0); i++) {
    const i2 = (i + 1) % n;
    for (let j = i + 2; j < n - (closedChain ? 0 : 1); j++) {
      const j2 = (j + 1) % n;
      // skip if segments share a vertex (adjacent) or are the wrap pair in open chain
      if (i === j || i2 === j || (closedChain && j2 === i)) continue;
      pairs.push([i, i2, j, j2]);
    }
  }
  const minD = 2 * radius;
  const minD2 = minD * minD;

  for (let k = 0; k < iters; k++) {
    for (const [i, i2, j, j2] of pairs) {
      const { c1, c2, d2 } = closestPointsOnSegments(P[i], P[i2], P[j], P[j2]);
      if (d2 < minD2) {
        const d = Math.sqrt(d2) || 1e-6;
        const push = (minD - d) * 0.5;
        const dir = c1.clone().sub(c2).multiplyScalar(push / d);
        // Distribute correction to the four endpoints (simple split)
        P[i].add(dir.clone().multiplyScalar(0.5));
        P[i2].add(dir.clone().multiplyScalar(0.5));
        P[j].sub(dir.clone().multiplyScalar(0.5));
        P[j2].sub(dir.clone().multiplyScalar(0.5));
      }
    }
  }
}

function captureRestLengths() {
  restLengths = [];
  const n = spheres.length;
  const segCount = closedChain ? n : Math.max(n - 1, 0);
  for (let i = 0; i < segCount; i++) {
    const a = spheres[i].position, b = spheres[(i+1) % n].position;
    restLengths.push(a.distanceTo(b));
  }
}

function enforceSegmentLengths(P, iters = 1) {
  const n = P.length;
  const segCount = closedChain ? n : Math.max(n - 1, 0);
  for (let k = 0; k < iters; k++) {
    for (let i = 0; i < segCount; i++) {
      const a = P[i], b = P[(i+1) % n];
      const target = restLengths[i] || a.distanceTo(b);
      const delta = b.clone().sub(a);
      let d = delta.length();
      if (d < 1e-9) continue;
      const diff = (d - target) * 0.5;
      const corr = delta.multiplyScalar(diff / d);
      a.add(corr);
      b.sub(corr);
    }
  }
}


// ---------- Main loop ----------

function animate() {
  requestAnimationFrame(animate);

  const baseIters = settlingFrames > 0 ? 6 : 2;
  const P = spheres.map(m => m.position.clone());

  if (mode === 'balls') {
    projectConstraints(P, D, baseIters);
    if (closedChain) enforcePairTangency(P, 0, P.length - 1, D, baseIters);
    resolveOverlaps(P, 2 * R * ratio, 1);
  } else {
    // STICKS
    // (optional) very light smoothing to keep things stable:
    if (fixedSticks) enforceSegmentLengths(P, baseIters);
    // Avoid self-intersection based on tube radius
    resolveSelfIntersections(P, tubeRadiusSticks, 1);
  }

  for (let i = 0; i < spheres.length; i++) spheres[i].position.copy(P[i]);
  if (settlingFrames > 0) settlingFrames--;

  // Geometry refresh
  if (mode === 'balls') {
    rebuildTubeCenterline();
  } else {
    rebuildStickCylinders();
    updateStickVertexSpheresPositions();
  }


  checkConstraints();
  controls.update();
  renderer.render(scene, camera);
}
