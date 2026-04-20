// ===================================================================
//  3D Scene — Table + Game Boy  (Three.js r163, ES modules)
//  Click Game Boy → flies up to screen
//  Press START → Pixelated Snake Game as overlay on GB screen
// ===================================================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ─── DOM refs ──────────────────────────────────────────────────────
const canvas      = document.getElementById('scene');
const hintEl      = document.getElementById('hint');
const gameCanvas   = document.getElementById('gameScreen');
const gameCtx      = gameCanvas.getContext('2d');

// Set internal resolution (Game Boy native)
const GAME_W = 160;
const GAME_H = 144;
gameCanvas.width  = GAME_W;
gameCanvas.height = GAME_H;
gameCtx.imageSmoothingEnabled = false;

// ─── Renderer ──────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled   = true;
renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
renderer.toneMapping         = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace    = THREE.SRGBColorSpace;

// ─── Scene ─────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a14);
scene.fog = new THREE.FogExp2(0x0a0a14, 0.035);

// ─── Camera ────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);

const cameraRadius = 6;
const cameraPolar  = THREE.MathUtils.degToRad(45);
const cameraAzimuth = THREE.MathUtils.degToRad(30);

camera.position.set(
  cameraRadius * Math.sin(cameraPolar) * Math.sin(cameraAzimuth),
  cameraRadius * Math.cos(cameraPolar),
  cameraRadius * Math.sin(cameraPolar) * Math.cos(cameraAzimuth)
);
camera.lookAt(0, 0.5, 0);

// ─── Controls ─────────────────────────────────────────────────────
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.5, 0);
controls.enableDamping  = true;
controls.dampingFactor  = 0.06;
controls.enablePan      = false;
controls.minDistance     = 3;
controls.maxDistance     = 12;
controls.maxPolarAngle  = THREE.MathUtils.degToRad(85);
controls.minPolarAngle  = THREE.MathUtils.degToRad(20);
controls.update();

// ─── Lighting ─────────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0xffeedd, 0.5);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xfff0dd, 1.8);
keyLight.position.set(4, 8, 3);
keyLight.castShadow           = true;
keyLight.shadow.mapSize.width  = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.camera.near    = 0.5;
keyLight.shadow.camera.far     = 20;
keyLight.shadow.camera.left    = -5;
keyLight.shadow.camera.right   = 5;
keyLight.shadow.camera.top     = 5;
keyLight.shadow.camera.bottom  = -5;
keyLight.shadow.bias           = -0.0005;
keyLight.shadow.radius         = 4;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xaac4ff, 0.4);
fillLight.position.set(-3, 4, -2);
scene.add(fillLight);

const rimLight = new THREE.PointLight(0xff6b9d, 0.6, 12);
rimLight.position.set(-2, 3, 3);
scene.add(rimLight);

const hemi = new THREE.HemisphereLight(0xffeedd, 0x333344, 0.3);
scene.add(hemi);

// ─── Floor ────────────────────────────────────────────────────────
const floorGeo = new THREE.PlaneGeometry(40, 40);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x111118, roughness: 0.85, metalness: 0.1,
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.01;
floor.receiveShadow = true;
scene.add(floor);

// ─── GLTFLoader ───────────────────────────────────────────────────
const loader = new GLTFLoader();

let tableMesh   = null;
let gameboyMesh = null;
let startButton = null;
let startBtnMesh = null;
let startBtnGlow = null;
let isButtonPressed = false;
let depthClearedThisFrame = false;

function setOverlayMode(obj, active) {
  if (!obj) return;
  obj.renderOrder = active ? 9999 : 0;
  obj.traverse(child => {
    if (child.isMesh) {
      child.renderOrder = active ? 9999 : 0;
      if (active) {
        child.onBeforeRender = (renderer) => {
          if (!depthClearedThisFrame) {
            renderer.clearDepth();
            depthClearedThisFrame = true;
          }
        };
      } else {
        child.onBeforeRender = () => {};
      }
    }
  });
}
let gameboyStartPos   = new THREE.Vector3();
let gameboyStartRot   = new THREE.Euler();
let gameboyStartScale = new THREE.Vector3();

// ─── Book refs ────────────────────────────────────────────────────
let bookObj = null;  // Book instance
let bookIsFlownUp   = false;
let bookIsAnimating = false;
let bookStartPos    = new THREE.Vector3();
let bookStartRot    = new THREE.Euler();
let bookStartScale  = new THREE.Vector3();

let photoFrameMesh   = null;  // Photo frame GLB
let isFrameFlownUp   = false;
let isFrameAnimating = false;
let frameStartPos    = new THREE.Vector3();
let frameStartRot    = new THREE.Euler();
let frameStartScale  = new THREE.Vector3();
let frameDragging    = false;
let frameDragEnded   = false;  // survives through the click event after pointerup
let frameDragPrevX   = 0;
let frameDragPrevY   = 0;
let frameDefaultQuat = new THREE.Quaternion(); // camera-facing quat saved on arrival

let chocoMesh        = null;  // Chocolate GLB
let isChocoFlownUp   = false;
let isChocoAnimating = false;
let chocoStartPos    = new THREE.Vector3();
let chocoStartRot    = new THREE.Euler();
let chocoStartScale  = new THREE.Vector3();
let chocoDragging    = false;
let chocoDragEnded   = false;
let chocoDragPrevX   = 0;
let chocoDragPrevY   = 0;
let chocoDefaultQuat = new THREE.Quaternion();

let lampMesh         = null;
let lampLight        = null;
let lampOn           = true;

let vaseMesh         = null;
let isVaseFlownUp    = false;
let isVaseAnimating  = false;
let vaseStartPos     = new THREE.Vector3();
let vaseStartRot     = new THREE.Euler();
let vaseStartScale   = new THREE.Vector3();
let vaseDragging     = false;
let vaseDragEnded    = false;
let vaseDragPrevX    = 0;
let vaseDragPrevY    = 0;
let newBookMesh        = null;
let isNewBookFlownUp   = false;
let isNewBookAnimating = false;
let newBookStartPos    = new THREE.Vector3();
let newBookStartRot    = new THREE.Euler();
let newBookStartScale  = new THREE.Vector3();

let newBookDragging    = false;
let newBookDragEnded   = false;
let newBookDragPrevX   = 0;
let newBookDragPrevY   = 0;
let newBookDefaultQuat = new THREE.Quaternion();

let vaseDefaultQuat  = new THREE.Quaternion();

// ─── Audio ────────────────────────────────────────────────────────
const audioListener = new THREE.AudioListener();
camera.add(audioListener);
const bgMusic = new THREE.Audio(audioListener);
const audioLoader = new THREE.AudioLoader();
let musicStarted = false;

audioLoader.load('beabadoobee - Glue Song (Official Music Video) - beabadoobeeVEVO.mp3', (buffer) => {
  bgMusic.setBuffer(buffer);
  bgMusic.setLoop(true);
  bgMusic.setVolume(0); 
});

function startMusic() {
  if (musicStarted || !bgMusic.buffer) return;
  musicStarted = true;
  bgMusic.play();
  
  // Fade in
  let vol = 0;
  const fadeIn = setInterval(() => {
    vol += 0.02;
    bgMusic.setVolume(vol);
    if (vol >= 0.5) clearInterval(fadeIn); // Max volume 0.5 for background comfort
  }, 50);
}

// ─── Screen corner points in GB local space ───────────────────────
// GB local bounds: min(-0.559, -0.744, -0.188) max(0.559, 1.189, 0.286)
// The screen area (the gray/green rectangle) in local coords:
const screenCorners = [
  new THREE.Vector3(-0.40,  0.30, 0.29),  // bottom-left
  new THREE.Vector3( 0.42,  0.30, 0.29),  // bottom-right
  new THREE.Vector3( 0.42,  1.05, 0.29),  // top-right
  new THREE.Vector3(-0.40,  1.05, 0.29),  // top-left
];

// ═══════════════════════════════════════════════════════════════════
//  SNAKE GAME ENGINE
// ═══════════════════════════════════════════════════════════════════
const CELL = 8;
const COLS = GAME_W / CELL;  // 20
const ROWS = GAME_H / CELL;  // 18

class SnakeGame {
  constructor(ctx) {
    this.ctx = ctx;
    this.running = false;
    this.gameOver = false;
    this.score = 0;
    this.tickRate = 150;
    this.lastTick = 0;

    this.snake = [
      { x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) },
      { x: Math.floor(COLS / 2) - 1, y: Math.floor(ROWS / 2) },
      { x: Math.floor(COLS / 2) - 2, y: Math.floor(ROWS / 2) },
    ];
    this.dir     = { x: 1, y: 0 };
    this.nextDir = { x: 1, y: 0 };
    this.food    = this.spawnFood();
  }

  spawnFood() {
    let pos;
    do {
      pos = {
        x: Math.floor(Math.random() * COLS),
        y: Math.floor(Math.random() * ROWS),
      };
    } while (this.snake.some(s => s.x === pos.x && s.y === pos.y));
    return pos;
  }

  setDirection(dx, dy) {
    if (this.dir.x === -dx && this.dir.y === -dy) return;
    this.nextDir = { x: dx, y: dy };
  }

  tick(now) {
    if (!this.running || this.gameOver) return;
    if (now - this.lastTick < this.tickRate) return;
    this.lastTick = now;

    this.dir = { ...this.nextDir };

    const head = this.snake[0];
    const newHead = { x: head.x + this.dir.x, y: head.y + this.dir.y };

    // Wrap around walls
    if (newHead.x < 0) newHead.x = COLS - 1;
    if (newHead.x >= COLS) newHead.x = 0;
    if (newHead.y < 0) newHead.y = ROWS - 1;
    if (newHead.y >= ROWS) newHead.y = 0;

    // Self collision
    if (this.snake.some(s => s.x === newHead.x && s.y === newHead.y)) {
      this.gameOver = true;
      return;
    }

    this.snake.unshift(newHead);

    if (newHead.x === this.food.x && newHead.y === this.food.y) {
      this.score++;
      this.food = this.spawnFood();
      this.tickRate = Math.max(80, this.tickRate - 3);
    } else {
      this.snake.pop();
    }
  }

  drawPixelHeart(x, y) {
    const ctx = this.ctx;
    const px = x * CELL;
    const py = y * CELL;

    const heart = [
      [0,1,0,0,0,1,0,0],
      [1,1,1,0,1,1,1,0],
      [1,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,0],
      [0,1,1,1,1,1,0,0],
      [0,0,1,1,1,0,0,0],
      [0,0,0,1,0,0,0,0],
      [0,0,0,0,0,0,0,0],
    ];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 7; c++) {
        if (heart[r][c]) {
          const isEdge =
            (r > 0 && !heart[r-1][c]) || (r < 7 && !heart[r+1][c]) ||
            (c > 0 && !heart[r][c-1]) || (c < 6 && !heart[r][c+1]);
          ctx.fillStyle = isEdge ? '#880011' : '#CC1122';
          ctx.fillRect(px + c, py + r, 1, 1);
        }
      }
    }
  }

  draw() {
    const ctx = this.ctx;

    // Background
    ctx.fillStyle = '#FFF0F5'; // LavenderBlush
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // Subtle checkerboard grid
    ctx.fillStyle = '#FFE4E1'; // MistyRose
    for (let gx = 0; gx < COLS; gx++) {
      for (let gy = 0; gy < ROWS; gy++) {
        if ((gx + gy) % 2 === 0) {
          ctx.fillRect(gx * CELL, gy * CELL, CELL, CELL);
        }
      }
    }

    // Food heart
    this.drawPixelHeart(this.food.x, this.food.y);

    // Snake body
    for (let i = 1; i < this.snake.length; i++) {
      const seg = this.snake[i];
      ctx.fillStyle = '#FF91A4';
      ctx.fillRect(seg.x * CELL, seg.y * CELL, CELL, CELL);
      ctx.fillStyle = '#FFB6C1';
      ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
    }

    // Snake head
    if (this.snake.length > 0) {
      const h = this.snake[0];
      const hx = h.x * CELL, hy = h.y * CELL;
      ctx.fillStyle = '#FF85A1';
      ctx.fillRect(hx, hy, CELL, CELL);
      ctx.fillStyle = '#FF91A4';
      ctx.fillRect(hx + 1, hy + 1, CELL - 2, CELL - 2);

      // Eyes
      ctx.fillStyle = '#333';
      if (this.dir.x === 1)       { ctx.fillRect(hx+5,hy+2,2,2); ctx.fillRect(hx+5,hy+5,2,2); }
      else if (this.dir.x === -1) { ctx.fillRect(hx+1,hy+2,2,2); ctx.fillRect(hx+1,hy+5,2,2); }
      else if (this.dir.y === -1) { ctx.fillRect(hx+2,hy+1,2,2); ctx.fillRect(hx+5,hy+1,2,2); }
      else                        { ctx.fillRect(hx+2,hy+5,2,2); ctx.fillRect(hx+5,hy+5,2,2); }
    }

    // Score
    ctx.fillStyle = '#FF69B4'; // Hot Pink
    ctx.font = '8px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('♥ ' + this.score, GAME_W - 4, 10);

    // Game Over
    if (this.gameOver) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      ctx.fillStyle = '#FF69B4'; // Hot Pink
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', GAME_W/2, GAME_H/2 - 14);
      ctx.fillStyle = '#FF85A1';
      ctx.font = '10px monospace';
      ctx.fillText('Hearts: ' + this.score, GAME_W/2, GAME_H/2 + 4);
      ctx.fillStyle = '#FF91A4';
      ctx.font = '8px monospace';
      ctx.fillText('Press START', GAME_W/2, GAME_H/2 + 22);
    }

    // Start screen
    if (!this.running && !this.gameOver) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      ctx.fillStyle = '#FF69B4';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SNAKE  ♥', GAME_W/2, GAME_H/2 - 10);
      ctx.fillStyle = '#FF91A4';
      ctx.font = '8px monospace';
      ctx.fillText('Press START', GAME_W/2, GAME_H/2 + 8);
    }
  }

  start() {
    if (this.gameOver) {
      this.snake = [
        { x: Math.floor(COLS/2), y: Math.floor(ROWS/2) },
        { x: Math.floor(COLS/2)-1, y: Math.floor(ROWS/2) },
        { x: Math.floor(COLS/2)-2, y: Math.floor(ROWS/2) },
      ];
      this.dir = { x:1, y:0 };
      this.nextDir = { x:1, y:0 };
      this.food = this.spawnFood();
      this.score = 0;
      this.tickRate = 150;
      this.gameOver = false;
    }
    this.running = true;
    this.lastTick = performance.now();
  }
}

const snakeGame = new SnakeGame(gameCtx);

// ─── Project GB screen corners to viewport & position overlay ─────
function updateGameOverlayPosition() {
  if (!gameboyMesh) {
    gameCanvas.style.display = 'none';
    return;
  }

  // Corners: 0:BL, 1:BR, 2:TR, 3:TL
  const projected = screenCorners.map(corner => {
    const worldPt = corner.clone().applyMatrix4(gameboyMesh.matrixWorld);
    const ndc = worldPt.project(camera);
    return {
      x: (ndc.x * 0.5 + 0.5) * window.innerWidth,
      y: (-ndc.y * 0.5 + 0.5) * window.innerHeight
    };
  });

  // Calculate width (TL to TR) and height (TL to BL)
  const dxW = projected[2].x - projected[3].x;
  const dyW = projected[2].y - projected[3].y;
  const sw = Math.sqrt(dxW*dxW + dyW*dyW) * 0.88;

  const dxH = projected[0].x - projected[3].x;
  const dyH = projected[0].y - projected[3].y;
  const sh = Math.sqrt(dxH*dxH + dyH*dyH) * 0.88;

  // Center the overlay on the projected 4 corners
  const cx = projected.reduce((s, p) => s + p.x, 0) / 4;
  const cy = projected.reduce((s, p) => s + p.y, 0) / 4;

  // Rotation angle from the top edge (TL to TR)
  const angle = Math.atan2(dyW, dxW);

  if (sw > 10 && sh > 10) {
    gameCanvas.style.display = 'block';
    gameCanvas.style.left      = cx + 'px';
    gameCanvas.style.top       = (cy + sh * 0.04) + 'px'; // 4% down offset
    gameCanvas.style.width     = sw + 'px';
    gameCanvas.style.height    = sh + 'px';
    gameCanvas.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
  }
}

// ─── Create the red 3D START button ───────────────────────────────
function createStartButton() {
  startButton = new THREE.Group();
  startButton.name = 'StartButton';

  const btnGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.18, 48);
  const btnMat = new THREE.MeshPhysicalMaterial({
    color: 0xcc1122, roughness: 0.25, metalness: 0.15,
    clearcoat: 0.9, clearcoatRoughness: 0.1,
    emissive: 0x440000, emissiveIntensity: 0.3,
  });
  startBtnMesh = new THREE.Mesh(btnGeo, btnMat);
  startBtnMesh.castShadow = true;
  startBtnMesh.receiveShadow = true;
  startBtnMesh.name = 'StartBtnMesh';

  const bevelGeo = new THREE.TorusGeometry(0.52, 0.04, 16, 48);
  const bevelMat = new THREE.MeshPhysicalMaterial({
    color: 0x991111, roughness: 0.35, metalness: 0.3, clearcoat: 0.6,
  });
  const bevel = new THREE.Mesh(bevelGeo, bevelMat);
  bevel.rotation.x = Math.PI / 2;
  bevel.position.y = 0.09;

  const textCanvas2 = document.createElement('canvas');
  textCanvas2.width = 256; textCanvas2.height = 128;
  const tctx = textCanvas2.getContext('2d');
  tctx.clearRect(0, 0, 256, 128);
  tctx.fillStyle = '#ffffff';
  tctx.font = 'bold 60px "Poppins", Arial, sans-serif';
  tctx.textAlign = 'center';
  tctx.textBaseline = 'middle';
  tctx.shadowColor = 'rgba(0,0,0,0.5)';
  tctx.shadowBlur = 6;
  tctx.fillText('START', 128, 64);

  const textTexture = new THREE.CanvasTexture(textCanvas2);
  const textGeo = new THREE.PlaneGeometry(0.7, 0.35);
  const textMat = new THREE.MeshBasicMaterial({ map: textTexture, transparent: true, depthWrite: false });
  const textMesh = new THREE.Mesh(textGeo, textMat);
  textMesh.rotation.x = -Math.PI / 2;
  textMesh.position.y = 0.092;

  const glowGeo = new THREE.TorusGeometry(0.62, 0.08, 16, 48);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff3344, transparent: true, opacity: 0.35 });
  startBtnGlow = new THREE.Mesh(glowGeo, glowMat);
  startBtnGlow.rotation.x = Math.PI / 2;
  startBtnGlow.position.y = -0.02;

  startButton.add(startBtnMesh);
  startButton.add(bevel);
  startButton.add(textMesh);
  startButton.add(startBtnGlow);

  return startButton;
}

// ─── Load Table ───────────────────────────────────────────────────
loader.load('table.glb', (gltf) => {
  tableMesh = gltf.scene;
  tableMesh.traverse((child) => {
    if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
  });

  const box = new THREE.Box3().setFromObject(tableMesh);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  tableMesh.scale.setScalar(4 / maxDim);

  const box2 = new THREE.Box3().setFromObject(tableMesh);
  const center2 = box2.getCenter(new THREE.Vector3());
  tableMesh.position.sub(center2);
  tableMesh.position.y -= box2.min.y;

  scene.add(tableMesh);

  // Create book and place on table
  const tableBox0 = new THREE.Box3().setFromObject(tableMesh);
  bookObj = new Book();
  bookObj.placeOnTable(tableBox0.max.y);
  scene.add(bookObj.group);

  // Save book starting transform for fly-back
  bookStartPos.copy(bookObj.group.position);
  bookStartRot.copy(bookObj.group.rotation);
  bookStartScale.copy(bookObj.group.scale);

  const tableTopY = tableBox0.max.y;
  createNewBook(tableTopY);

  // Load all other items in parallel
  loadGameboy(tableTopY);
  loadPhotoFrame(tableTopY);
  loadChocolate(tableTopY);
  loadFlowerVase(tableTopY);
  loadTableLamp(tableTopY);
}, undefined, (err) => console.error('Table load error:', err));

// ─── Load Game Boy ────────────────────────────────────────────────
function loadGameboy(tableTopY) {
  loader.load('gameboy_challenge.glb', (gltf) => {
    gameboyMesh = gltf.scene;
    gameboyMesh.traverse((child) => {
      if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
    });

    const tableBox = new THREE.Box3().setFromObject(tableMesh);
    const tableTopY = tableBox.max.y;

    const gbBox = new THREE.Box3().setFromObject(gameboyMesh);
    const gbSize = gbBox.getSize(new THREE.Vector3());
    const gbMaxDim = Math.max(gbSize.x, gbSize.y, gbSize.z);
    gameboyMesh.scale.setScalar(0.4 / gbMaxDim);

    gameboyMesh.rotation.x = -Math.PI / 2;
    gameboyMesh.rotation.z = THREE.MathUtils.degToRad(30);

    const gbBox3 = new THREE.Box3().setFromObject(gameboyMesh);
    const gbCenter2 = gbBox3.getCenter(new THREE.Vector3());
    gameboyMesh.position.set(
      -gbCenter2.x + gameboyMesh.position.x - 0.6,
      tableTopY - gbBox3.min.y,
      -gbCenter2.z + gameboyMesh.position.z
    );

    // Add START button
    const btn = createStartButton();
    btn.position.set(-0.03, 0.07, 0.30);
    btn.rotation.x = Math.PI / 2;
    btn.scale.setScalar(0.21);
    gameboyMesh.add(btn);

    gameboyStartPos.copy(gameboyMesh.position);
    gameboyStartRot.copy(gameboyMesh.rotation);
    gameboyStartScale.copy(gameboyMesh.scale);

    scene.add(gameboyMesh);
  }, undefined, (err) => console.error('Gameboy load error:', err));
}

// ─── Load Photo Frame ─────────────────────────────────────────────
function loadPhotoFrame(tableTopY) {
  loader.load('photo_frame.glb', (gltf) => {
    photoFrameMesh = gltf.scene;
    photoFrameMesh.traverse((child) => {
      if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
    });

    // Scale so the frame is ~0.55 units tall (realistic desk photo frame)
    const pfBox = new THREE.Box3().setFromObject(photoFrameMesh);
    const pfSize = pfBox.getSize(new THREE.Vector3());
    const pfMaxDim = Math.max(pfSize.x, pfSize.y, pfSize.z);
    photoFrameMesh.scale.setScalar(0.55 / pfMaxDim);

    // Rotate slightly toward camera and angle for a natural look on the table
    photoFrameMesh.rotation.y = THREE.MathUtils.degToRad(-115);

    // Sit it on the table: back-centre area (between book and edge)
    const pfBox2 = new THREE.Box3().setFromObject(photoFrameMesh);
    const pfCenter = pfBox2.getCenter(new THREE.Vector3());
    photoFrameMesh.position.set(
      -pfCenter.x + 0.3,          // slightly right of centre
      tableTopY - pfBox2.min.y,   // resting on table surface
      -pfCenter.z - 0.45          // pushed toward the back of the table
    );

    scene.add(photoFrameMesh);

    // Save start transform for fly-back
    frameStartPos.copy(photoFrameMesh.position);
    frameStartRot.copy(photoFrameMesh.rotation);
    frameStartScale.copy(photoFrameMesh.scale);
  }, undefined, (err) => console.error('Photo frame load error:', err));
}

// ─── Load Chocolate ───────────────────────────────────────────────
function loadChocolate(tableTopY) {
  loader.load('kinder_bar_chocolate.glb', (gltf) => {
    chocoMesh = gltf.scene;
    chocoMesh.traverse((child) => {
      if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
    });

    // Scale so the chocolate is ~0.4 units long
    const cBox = new THREE.Box3().setFromObject(chocoMesh);
    const cSize = cBox.getSize(new THREE.Vector3());
    const cMaxDim = Math.max(cSize.x, cSize.y, cSize.z);
    chocoMesh.scale.setScalar(0.4 / cMaxDim);

    // No X or Z rotation so it stays right-side up logically

    // Sit it on the table: front-left
    const cBox2 = new THREE.Box3().setFromObject(chocoMesh);
    const cCenter = cBox2.getCenter(new THREE.Vector3());
    chocoMesh.position.set(
      -cCenter.x + 0.458,
      1.124 - cBox2.min.y,
      -cCenter.z - 0.066 
    );
    // Add a slight angled twist for a natural look, plus 180 spin so text reads correctly
    chocoMesh.rotation.y = THREE.MathUtils.degToRad(270);

    scene.add(chocoMesh);

    // Save start transform for fly-back
    chocoStartPos.copy(chocoMesh.position);
    chocoStartRot.copy(chocoMesh.rotation);
    chocoStartScale.copy(chocoMesh.scale);
  }, undefined, (err) => console.error('Chocolate load error:', err));
}

// ─── Load Flower Vase ───────────────────────────────────────────────
function loadFlowerVase(tableTopY) {
  loader.load('flowers_in_vase.glb', (gltf) => {
    vaseMesh = gltf.scene;
    vaseMesh.traverse((child) => {
      if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
    });

    const vBox = new THREE.Box3().setFromObject(vaseMesh);
    const vSize = vBox.getSize(new THREE.Vector3());
    const vMaxDim = Math.max(vSize.x, vSize.y, vSize.z);
    vaseMesh.scale.setScalar(0.7 / vMaxDim);

    const vBox2 = new THREE.Box3().setFromObject(vaseMesh);
    const vCenter = vBox2.getCenter(new THREE.Vector3());
    vaseMesh.position.set(
      -vCenter.x - 0.956,
      tableTopY - vBox2.min.y,
      -vCenter.z - 0.437
    );
    vaseMesh.rotation.y = THREE.MathUtils.degToRad(-25);

    scene.add(vaseMesh);

    vaseStartPos.copy(vaseMesh.position);
    vaseStartRot.copy(vaseMesh.rotation);
    vaseStartScale.copy(vaseMesh.scale);
  }, undefined, (err) => console.error('Flower vase load error:', err));
}

// ─── Load Table Lamp ───────────────────────────────────────────────
function loadTableLamp(tableTopY) {
  loader.load('table_lamp__free.glb', (gltf) => {
    lampMesh = gltf.scene;
    lampMesh.traverse((child) => {
      if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
    });

    const lBox = new THREE.Box3().setFromObject(lampMesh);
    const lSize = lBox.getSize(new THREE.Vector3());
    const lMaxDim = Math.max(lSize.x, lSize.y, lSize.z);
    // Scale to a nice desk lamp size (approx 0.6 units high)
    lampMesh.scale.setScalar(0.9 / lMaxDim);

    const lBox2 = new THREE.Box3().setFromObject(lampMesh);
    const lCenter = lBox2.getCenter(new THREE.Vector3());
    
    // Requested: 0.654, 1.054, 0.221
    lampMesh.position.set(
      -lCenter.x + 0.274,
      tableTopY - lBox2.min.y,
      -lCenter.z + 0.13);
    lampMesh.rotation.y = THREE.MathUtils.degToRad(-150);

    // Warm light at requested world coordinates: 0.883, 1.852, -0.196
    lampLight = new THREE.PointLight(0xffaa44, 25, 4.0);
    lampLight.position.set(0.883, 1.852, -0.196);
    scene.add(lampLight);

    // Optional: Add a subtle helper or visual for the bulb?
    // Let's just use the light for now.
    
    scene.add(lampMesh);
  }, undefined, (err) => console.error('Lamp load error:', err));
}

// ─── New Static Book (Cover Page) ─────────────────────────────────
function createNewBook(tableTopY) {
  const W = 0.25, H = 0.35, D = 0.04; 
  const geo = new THREE.BoxGeometry(W, H, D); 
  
  const coverTex = new THREE.TextureLoader().load('book_cover.jpg');
  coverTex.colorSpace = THREE.SRGBColorSpace;
  const coverMat = new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.8 });

  const backTex = new THREE.TextureLoader().load('book_cover_back.jpg');
  backTex.colorSpace = THREE.SRGBColorSpace;

  const backMat = new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.8 });

  const spineMat = new THREE.MeshStandardMaterial({ color: 0x642717, roughness: 0.9 });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xEEEEEE, roughness: 0.9 });
  
  // BoxGeometry order: right, left, top, bottom, front, back
  const materials = [
    edgeMat,  // right
    spineMat, // left (spine)
    edgeMat,  // top
    edgeMat,  // bottom
    coverMat, // front (cover)
    backMat   // back 
  ];
  
  newBookMesh = new THREE.Mesh(geo, materials);
  newBookMesh.castShadow = true;
  newBookMesh.receiveShadow = true;

  // Position it flat on the table
  newBookMesh.position.set(-1.010, 1.054, 0.266);
  newBookMesh.rotation.x = -Math.PI / 2; // Lie flat
  newBookMesh.rotation.z = Math.PI / 18; // Slight angle

  scene.add(newBookMesh);
  
  newBookStartPos.copy(newBookMesh.position);
  newBookStartRot.copy(newBookMesh.rotation);
  newBookStartScale.copy(newBookMesh.scale);
}

// ─── Raycaster ────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();



const hoverLabel = document.createElement('div');
hoverLabel.style.position = 'fixed';
hoverLabel.style.pointerEvents = 'none';
hoverLabel.style.display = 'none';
hoverLabel.style.background = 'rgba(20, 20, 30, 0.9)';
hoverLabel.style.color = 'white';
hoverLabel.style.padding = '8px 16px';
hoverLabel.style.borderRadius = '12px';
hoverLabel.style.fontSize = '14px';
hoverLabel.style.fontWeight = '700';
hoverLabel.style.border = '2px solid rgba(255, 255, 255, 0.2)';
hoverLabel.style.boxShadow = '0 10px 30px rgba(0,0,0,0.6)';
hoverLabel.style.zIndex = '10001';
hoverLabel.style.backdropFilter = 'blur(10px)';
document.body.appendChild(hoverLabel);



function setEmissive(obj, intensity) {
  if (!obj) return;
  obj.traverse(child => {
    if (child.isMesh && child.material) {
      if (child.material.emissive) {
        if (child._origE === undefined) child._origE = child.material.emissiveIntensity;
        child.material.emissiveIntensity = intensity > 0 ? intensity : child._origE;
      }
    }
  });
}
const pointer   = new THREE.Vector2();
let isAnimating = false;
let isFlownUp   = false;
let gameActive  = false;  // is the snake game showing
  // (frame state vars declared at top)

function isStartButtonHit(hits) {
  for (const hit of hits) {
    let obj = hit.object;
    while (obj) {
      if (obj === startButton || obj.name === 'StartBtnMesh') return true;
      obj = obj.parent;
    }
  }
  return false;
}

// ─── Button press animation ──────────────────────────────────────
function pressButton(callback) {
  if (!startButton || isButtonPressed) return;
  isButtonPressed = true;

  const originalY = startBtnMesh.position.y;
  const pressDepth = -0.06;
  const startTime = performance.now();

  startBtnMesh.material.emissiveIntensity = 0.8;
  startBtnMesh.material.emissive.setHex(0x880000);
  if (startBtnGlow) startBtnGlow.material.opacity = 0.7;

  function pressDown(now) {
    let t = Math.min((now - startTime) / 120, 1);
    t = t * t;
    startBtnMesh.position.y = originalY + pressDepth * t;

    if (t < 1) {
      requestAnimationFrame(pressDown);
    } else {
      setTimeout(() => {
        const releaseStart = performance.now();
        function releaseUp(now2) {
          let t2 = Math.min((now2 - releaseStart) / 200, 1);
          t2 = 1 - Math.pow(1 - t2, 3);
          startBtnMesh.position.y = originalY + pressDepth * (1 - t2);

          if (t2 < 1) {
            requestAnimationFrame(releaseUp);
          } else {
            startBtnMesh.position.y = originalY;
            startBtnMesh.material.emissiveIntensity = 0.3;
            startBtnMesh.material.emissive.setHex(0x440000);
            if (startBtnGlow) startBtnGlow.material.opacity = 0.35;
            isButtonPressed = false;
            if (callback) callback();
          }
        }
        requestAnimationFrame(releaseUp);
      }, 80);
    }
  }
  requestAnimationFrame(pressDown);
}

// ─── Start game handler ──────────────────────────────────────────
function onStartPressed() {
  gameActive = true;
  snakeGame.start();
}

// ─── Click handler ───────────────────────────────────────────────
canvas.addEventListener('click', (e) => {
  startMusic();
  // Skip clicks that ended a drag (pointerup already cleared frameDragging, so check frameDragEnded)
  if (frameDragEnded || chocoDragEnded || vaseDragEnded || newBookDragEnded) {
    frameDragEnded = false;
    chocoDragEnded = false;
    vaseDragEnded = false;
    newBookDragEnded = false;
    return;
  }

  pointer.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  // ── Photo Frame interaction (while frame is flown up, click outside sends it back) ──
  if (isFrameFlownUp && !isFrameAnimating) {
    const frameHits = photoFrameMesh ? raycaster.intersectObject(photoFrameMesh, true) : [];
    if (frameHits.length === 0) {
      flyBackFrame();
      return;
    }
    return; // clicked the frame itself — do nothing (drag handles rotation)
  }

  // ── Chocolate interaction (while choco is flown up, click outside sends it back) ──
  if (isChocoFlownUp && !isChocoAnimating) {
    const chocoHits = chocoMesh ? raycaster.intersectObject(chocoMesh, true) : [];
    if (chocoHits.length === 0) {
      flyBackChoco();
      return;
    }
    return; // clicked choco itself
  }

  // ── New Book interaction (while new book is flown up, click outside sends it back) ──
  if (isNewBookFlownUp && !isNewBookAnimating) {
    const newBookHits = newBookMesh ? raycaster.intersectObject(newBookMesh, true) : [];
    if (newBookHits.length === 0) {
      flyBackNewBook();
      return;
    }
    return; // clicked the new book itself
  }

  // ── Book interaction (only handle page clicks or flying back if already open) ──
  if (bookObj && !bookIsAnimating && bookIsFlownUp) {
    const bookHits = raycaster.intersectObjects(bookObj.allMeshes.filter(m => m.visible), false);
    if (bookHits.length > 0) {
      // Book is open on screen — handle page clicks
      bookObj.handleClick(bookHits[0]);
      return;
    } else {
      // Clicked empty space while book is open — check if we should fly back
      const gbHits = gameboyMesh ? raycaster.intersectObject(gameboyMesh, true) : [];
      if (gbHits.length === 0) {
        flyBackBook();
        return;
      }
    }
  }

  // ── Trigger fly-ups (only if nothing is currently open or animating) ──
  const anyOpen = isFrameFlownUp || isChocoFlownUp || isNewBookFlownUp || bookIsFlownUp || isFlownUp;
  const anyAnimating = isFrameAnimating || isChocoAnimating || isNewBookAnimating || bookIsAnimating || isAnimating;

  if (!anyOpen && !anyAnimating) {
    const targets = [];
    if (photoFrameMesh) {
      const h = raycaster.intersectObject(photoFrameMesh, true);
      if (h.length > 0) targets.push({ type: 'frame', dist: h[0].distance });
    }
    if (chocoMesh) {
      const h = raycaster.intersectObject(chocoMesh, true);
      if (h.length > 0) targets.push({ type: 'choco', dist: h[0].distance });
    }
    if (newBookMesh) {
      const h = raycaster.intersectObject(newBookMesh, true);
      if (h.length > 0) targets.push({ type: 'newBook', dist: h[0].distance });
    }
    if (bookObj) {
      const h = raycaster.intersectObjects(bookObj.allMeshes.filter(m => m.visible), false);
      if (h.length > 0) targets.push({ type: 'book', dist: h[0].distance });
    }
    if (gameboyMesh) {
      const h = raycaster.intersectObject(gameboyMesh, true);
      if (h.length > 0) targets.push({ type: 'gb', dist: h[0].distance, hits: h });
    }
    if (lampMesh) {
      const h = raycaster.intersectObject(lampMesh, true);
      if (h.length > 0) targets.push({ type: 'lamp', dist: h[0].distance });
    }

    if (targets.length > 0) {
      targets.sort((a,b) => a.dist - b.dist);
      const closest = targets[0];
      if (closest.type === 'frame')   flyUpFrame();
      else if (closest.type === 'choco')   flyUpChoco();
      else if (closest.type === 'newBook') flyUpNewBook();
      else if (closest.type === 'book')    flyUpBook();
      else if (closest.type === 'lamp')    toggleLamp();
      else if (closest.type === 'gb') {
        if (isStartButtonHit(closest.hits)) pressButton(onStartPressed);
        else flyUp();
      }
      return;
    }
  }

// ─── Interaction Functions ───
function toggleLamp() {
  if (!lampLight) return;
  lampOn = !lampOn;
  lampLight.visible = lampOn;
}

  // ── Handles for already-open Gameboy ──
  if (isFlownUp && !anyAnimating) {
    const gbHits = gameboyMesh ? raycaster.intersectObject(gameboyMesh, true) : [];
    if (gbHits.length > 0 && isStartButtonHit(gbHits)) {
      pressButton(onStartPressed);
    } else if (gbHits.length === 0) {
      flyBack();
    }
  }
});

// ─── Arrow key controls ─────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === 'c') {
    // Clipboard copy removed
  }

  if (!snakeGame || !snakeGame.running) return;

  switch (e.key) {
    case 'ArrowUp':    snakeGame.setDirection(0, -1); e.preventDefault(); break;
    case 'ArrowDown':  snakeGame.setDirection(0, 1);  e.preventDefault(); break;
    case 'ArrowLeft':  snakeGame.setDirection(-1, 0); e.preventDefault(); break;
    case 'ArrowRight': snakeGame.setDirection(1, 0);  e.preventDefault(); break;
  }
});

// ─── Hover cursor ────────────────────────────────────────────────
canvas.addEventListener('mousemove', (e) => {
  pointer.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  // Hover targets
  const allHits = raycaster.intersectObjects(scene.children, true);
  if (allHits.length > 0) {
    const hit = allHits[0];
    const pt = hit.point;
    window._lastHoverPt = pt;
  } else {
    window._lastHoverPt = null;
  }

  // ── Identification of Hovered interactive object ──
  let currentHover = null;
  let labelText = "";

  // Check Gameboy
  if (gameboyMesh) {
    const hits = raycaster.intersectObject(gameboyMesh, true);
    if (hits.length > 0) {
      currentHover = gameboyMesh;
      labelText = isFlownUp ? "Leave Game Boy" : "Play Game Boy";
    }
  }

  // Check photo frame
  if (!currentHover && photoFrameMesh && !isFrameAnimating) {
    const hits = raycaster.intersectObject(photoFrameMesh, true);
    if (hits.length > 0) {
      currentHover = photoFrameMesh;
      labelText = isFrameFlownUp ? "Put Down Photo" : "View Photo";
    }
  }

  // Check chocolate
  if (!currentHover && chocoMesh && !isChocoAnimating) {
    const hits = raycaster.intersectObject(chocoMesh, true);
    if (hits.length > 0) {
      currentHover = chocoMesh;
      labelText = isChocoFlownUp ? "Put Away Chocolate" : "Take Chocolate";
    }
  }

  // Check interactive book
  if (!currentHover && bookObj && !bookIsAnimating) {
    const hits = raycaster.intersectObjects(bookObj.allMeshes.filter(m => m.visible), false);
    if (hits.length > 0) {
      currentHover = bookObj.group;
      labelText = bookIsFlownUp ? "Close Book" : "Read Book";
    }
  }

  // Check new book
  if (!currentHover && newBookMesh && !isNewBookAnimating) {
    const hits = raycaster.intersectObject(newBookMesh, true);
    if (hits.length > 0) {
      currentHover = newBookMesh;
      labelText = isNewBookFlownUp ? "Stop Viewing" : "Check Book";
    }
  }

  // Check lamp
  if (!currentHover && lampMesh) {
    const hits = raycaster.intersectObject(lampMesh, true);
    if (hits.length > 0) {
      currentHover = lampMesh;
      labelText = lampOn ? "Turn Off Lamp" : "Turn On Lamp";
    }
  }

  // Visual Update
  if (currentHover) {
    canvas.style.cursor = 'pointer';
    hoverLabel.style.display = 'block';
    hoverLabel.style.left = (e.clientX + 20) + 'px';
    hoverLabel.style.top = (e.clientY + 20) + 'px';
    hoverLabel.innerText = labelText;

    if (hoveredObj !== currentHover) {
       setEmissive(hoveredObj, 0);
       hoveredObj = currentHover;
       setEmissive(hoveredObj, 0.4);
    }
  } else {
    canvas.style.cursor = 'default';
    hoverLabel.style.display = 'none';
    if (hoveredObj) {
      setEmissive(hoveredObj, 0);
      hoveredObj = null;
    }
  }

  // Specialized cursor handling for flown-up states (grab)
  if (isFrameFlownUp && photoFrameMesh) {
    const hits = raycaster.intersectObject(photoFrameMesh, true);
    if (hits.length > 0) canvas.style.cursor = 'grab';
  }
  if (isNewBookFlownUp && newBookMesh) {
    const hits = raycaster.intersectObject(newBookMesh, true);
    if (hits.length > 0) canvas.style.cursor = 'grab';
  }

  // Start button emissive update (Gameboy special case)
  if (currentHover === gameboyMesh && gameboyMesh) {
    const hits = raycaster.intersectObject(gameboyMesh, true);
    if (isStartButtonHit(hits) && startBtnMesh && !isButtonPressed) {
      startBtnMesh.material.emissiveIntensity = 0.6;
    } else if (startBtnMesh && !isButtonPressed) {
      startBtnMesh.material.emissiveIntensity = 0.3;
    }
  } else if (startBtnMesh && !isButtonPressed) {
    startBtnMesh.material.emissiveIntensity = 0.3;
  }
});

// ─── Fly-up animation ────────────────────────────────────────────
function flyUp() {
  if (!gameboyMesh) return;
  isAnimating = true;
  hintEl?.classList.add('hidden');
  controls.enabled = false;

  const targetPos = new THREE.Vector3();
  camera.getWorldDirection(targetPos);
  targetPos.multiplyScalar(3.0);
  targetPos.add(camera.position);

  const camUp = new THREE.Vector3();
  camUp.copy(camera.up).applyQuaternion(camera.quaternion).normalize();
  targetPos.addScaledVector(camUp, -0.8);

  const targetRot = new THREE.Euler(camera.rotation.x, camera.rotation.y, camera.rotation.z);
  const targetScale = gameboyMesh.scale.clone().multiplyScalar(6.25);
  setOverlayMode(gameboyMesh, true);

  animateTransform(gameboyMesh, targetPos, targetRot, targetScale, 1200, () => {
    isAnimating = false;
    isFlownUp = true;
  });
}

// ─── Fly back ────────────────────────────────────────────────────
function flyBack() {
  if (isAnimating || !isFlownUp) return;
  isAnimating = true;

  // Stop snake movement but keep overlay visible during fly-back
  snakeGame.running = false;

  animateTransform(gameboyMesh, gameboyStartPos, gameboyStartRot, gameboyStartScale, 1000, () => {
    isAnimating = false;
    isFlownUp = false;
    gameActive = false;
    gameCanvas.style.display = 'none';
    setOverlayMode(gameboyMesh, false);
    controls.enabled = true;
    hintEl?.classList.remove('hidden');
  });
}

// ─── Photo Frame fly-up ───────────────────────────────────────────────
 function flyUpFrame() {
  if (!photoFrameMesh) return;
  isFrameAnimating = true;
  hintEl?.classList.add('hidden');
  controls.enabled = false;

  const targetPos = new THREE.Vector3();
  camera.getWorldDirection(targetPos);
  targetPos.multiplyScalar(3.0);
  targetPos.add(camera.position);

  const camUp = new THREE.Vector3();
  camUp.copy(camera.up).applyQuaternion(camera.quaternion).normalize();
  targetPos.addScaledVector(camUp, -0.9); // move it further down

  // Stand it up parallel to the screen, then rotate locally to face the picture forward
  const targetQuat = camera.quaternion.clone();
  targetQuat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2));
  const targetRot = new THREE.Euler().setFromQuaternion(targetQuat);

  const targetScale = photoFrameMesh.scale.clone().multiplyScalar(3.5);
  setOverlayMode(photoFrameMesh, true);

  animateTransform(photoFrameMesh, targetPos, targetRot, targetScale, 1200, () => {
    isFrameAnimating = false;
    isFrameFlownUp = true;
    // Save the camera-facing quaternion so we can spring back to it after drag
    frameDefaultQuat.copy(photoFrameMesh.quaternion);
  });
}

// ─── Photo Frame fly-back ───────────────────────────────────────────────
function flyBackFrame() {
  if (isFrameAnimating || !isFrameFlownUp) return;
  isFrameAnimating = true;
  frameDragging = false;

  animateTransform(photoFrameMesh, frameStartPos, frameStartRot, frameStartScale, 1000, () => {
    isFrameAnimating = false;
    isFrameFlownUp = false;
    setOverlayMode(photoFrameMesh, false);
    controls.enabled = true;
    hintEl?.classList.remove('hidden');
  });
}

// ─── Photo Frame drag-to-rotate ─────────────────────────────────────────
canvas.addEventListener('pointerdown', (e) => {
  pointer.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  if (isFrameFlownUp && !isFrameAnimating && photoFrameMesh) {
    const hits = raycaster.intersectObject(photoFrameMesh, true);
    if (hits.length > 0) {
      frameDragging = true;
      frameDragPrevX = e.clientX;
      frameDragPrevY = e.clientY;
      canvas.style.cursor = 'grabbing';
      e.stopPropagation();
      return;
    }
  }

  if (isNewBookFlownUp && !isNewBookAnimating && newBookMesh) {
    const hits = raycaster.intersectObject(newBookMesh, true);
    if (hits.length > 0) {
      newBookDragging = true;
      newBookDragPrevX = e.clientX;
      newBookDragPrevY = e.clientY;
      canvas.style.cursor = 'grabbing';
      e.stopPropagation();
      return;
    }
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (frameDragging) {
    const dx = e.clientX - frameDragPrevX;
    const dy = e.clientY - frameDragPrevY;
    frameDragPrevX = e.clientX;
    frameDragPrevY = e.clientY;

    const sensitivity = 0.008;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length >= 0.5) {
      const axis = new THREE.Vector3(dy, dx, 0).normalize();
      axis.applyQuaternion(camera.quaternion);
      const quat = new THREE.Quaternion().setFromAxisAngle(axis, length * sensitivity);
      photoFrameMesh.quaternion.premultiply(quat);
    }
    canvas.style.cursor = 'grabbing';
    return;
  }

  if (newBookDragging) {
    const dx = e.clientX - newBookDragPrevX;
    const dy = e.clientY - newBookDragPrevY;
    newBookDragPrevX = e.clientX;
    newBookDragPrevY = e.clientY;

    const sensitivity = 0.008;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length >= 0.5) {
      const axis = new THREE.Vector3(dy, dx, 0).normalize();
      axis.applyQuaternion(camera.quaternion);
      const quat = new THREE.Quaternion().setFromAxisAngle(axis, length * sensitivity);
      newBookMesh.quaternion.premultiply(quat);
    }
    canvas.style.cursor = 'grabbing';
    return;
  }
});

canvas.addEventListener('pointerup', () => {
  if (frameDragging) {
    frameDragging = false;
    frameDragEnded = true; // block the upcoming 'click' event from triggering flyBackFrame
    canvas.style.cursor = isFrameFlownUp ? 'grab' : 'default';
    // Spring back to default (camera-facing) rotation
    springBackFrameRotation();
  }
  if (newBookDragging) {
    newBookDragging = false;
    newBookDragEnded = true;
    canvas.style.cursor = isNewBookFlownUp ? 'pointer' : 'default';
    springBackNewBookRotation();
  }
});

// ─── Spring frame rotation back to camera-facing default ─────────────────────
function springBackFrameRotation() {
  const fromQuat = photoFrameMesh.quaternion.clone();
  const toQuat   = frameDefaultQuat.clone();
  const duration = 500, start = performance.now();
  const tick = (now) => {
    // Don't fight an active drag or fly-back animation
    if (frameDragging || isFrameAnimating || !isFrameFlownUp) return;
    let t = Math.min((now - start) / duration, 1);
    t = 1 - Math.pow(1 - t, 3); // ease-out cubic
    photoFrameMesh.quaternion.slerpQuaternions(fromQuat, toQuat, t);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function springBackNewBookRotation() {
  const fromQuat = newBookMesh.quaternion.clone();
  const toQuat   = newBookDefaultQuat.clone();
  const duration = 500, start = performance.now();
  const tick = (now) => {
    if (newBookDragging || isNewBookAnimating || !isNewBookFlownUp) return;
    let t = Math.min((now - start) / duration, 1);
    t = 1 - Math.pow(1 - t, 3);
    newBookMesh.quaternion.slerpQuaternions(fromQuat, toQuat, t);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ─── Spring vase rotation back to camera-facing default removed ─────────────────────

canvas.addEventListener('pointerleave', () => { frameDragging = false; newBookDragging = false; });

// ─── Chocolate fly-up ─────────────────────────────────────────────────
function flyUpChoco() {
  if (!chocoMesh) return;
  isChocoAnimating = true;
  hintEl?.classList.add('hidden');
  controls.enabled = false;

  const targetPos = new THREE.Vector3();
  camera.getWorldDirection(targetPos);
  targetPos.multiplyScalar(3.0);
  targetPos.add(camera.position);

  // Stand it parallel to screen and then rotate locally to face the wrapper forward
  const targetQuat = camera.quaternion.clone();
  // Pitch the wrapper forward so it faces the screen nicely
  targetQuat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
  // Roll it -90 degrees to lay it down horizontally with text right-side up
  targetQuat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2));

  const targetScale = chocoMesh.scale.clone().multiplyScalar(4.5);
  setOverlayMode(chocoMesh, true);

  animateTransform(chocoMesh, targetPos, targetQuat, targetScale, 1200, () => {
    isChocoAnimating = false;
    isChocoFlownUp = true;
    chocoDefaultQuat.copy(chocoMesh.quaternion);
  });
}

// ─── Chocolate fly-back ───────────────────────────────────────────────
function flyBackChoco() {
  if (isChocoAnimating || !isChocoFlownUp) return;
  isChocoAnimating = true;
  chocoDragging = false;

  animateTransform(chocoMesh, chocoStartPos, chocoStartRot, chocoStartScale, 1000, () => {
    isChocoAnimating = false;
    isChocoFlownUp = false;
    setOverlayMode(chocoMesh, false);
    controls.enabled = true;
    hintEl?.classList.remove('hidden');
  });
}

// ─── New Book fly-up ─────────────────────────────────────────────
function flyUpNewBook() {
  if (!newBookMesh) return;
  isNewBookAnimating = true;
  controls.enabled = false;

  const targetPos = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  const camRight = new THREE.Vector3().crossVectors(camDir, camera.up).normalize();

  targetPos.copy(camera.position)
           .add(camDir.clone().multiplyScalar(0.7))
           .add(camRight.clone().multiplyScalar(-0.05))
           .add(camera.up.clone().multiplyScalar(-0.05));

  const targetRot = camera.rotation.clone();
  newBookDefaultQuat.setFromEuler(targetRot);
  const targetScale = newBookMesh.scale.clone().multiplyScalar(1.2);
  setOverlayMode(newBookMesh, true);

  animateTransform(newBookMesh, targetPos, targetRot, targetScale, 1200, () => {
    isNewBookAnimating = false;
    isNewBookFlownUp = true;
  });
}

// ─── New Book fly back ────────────────────────────────────────────
function flyBackNewBook() {
  if (isNewBookAnimating || !isNewBookFlownUp) return;
  isNewBookAnimating = true;

  animateTransform(newBookMesh, newBookStartPos, newBookStartRot, newBookStartScale, 1000, () => {
    isNewBookAnimating = false;
    isNewBookFlownUp = false;
    setOverlayMode(newBookMesh, false);
    controls.enabled = true;
  });
}

// ─── Flower Vase fly-up ───────────────────────────────────────────────
function flyUpVase() {
  if (!vaseMesh) return;
  isVaseAnimating = true;
  hintEl?.classList.add('hidden');
  controls.enabled = false;

  const targetPos = new THREE.Vector3();
  camera.getWorldDirection(targetPos);
  targetPos.multiplyScalar(3.0);
  targetPos.add(camera.position);

  const camUp = new THREE.Vector3();
  camUp.copy(camera.up).applyQuaternion(camera.quaternion).normalize();
  targetPos.addScaledVector(camUp, 0); // ~25% down

  const camRight = new THREE.Vector3();
  camRight.crossVectors(camera.getWorldDirection(new THREE.Vector3()), camera.up).normalize();
  targetPos.addScaledVector(camRight, 0); // ~25% right

  const targetQuat = camera.quaternion.clone();
  const targetRot = new THREE.Euler().setFromQuaternion(targetQuat);

  const targetScale = vaseMesh.scale.clone().multiplyScalar(3.5);

  animateTransform(vaseMesh, targetPos, targetRot, targetScale, 1200, () => {
    isVaseAnimating = false;
    isVaseFlownUp = true;
    vaseDefaultQuat.copy(vaseMesh.quaternion);
  });
}

// ─── Flower Vase fly-back ───────────────────────────────────────────────
function flyBackVase() {
  if (isVaseAnimating || !isVaseFlownUp) return;
  isVaseAnimating = true;
  vaseDragging = false;

  animateTransform(vaseMesh, vaseStartPos, vaseStartRot, vaseStartScale, 1000, () => {
    isVaseAnimating = false;
    isVaseFlownUp = false;
    controls.enabled = true;
    hintEl?.classList.remove('hidden');
  });
}

// ─── Chocolate drag-to-rotate disabled ────────────────────────────────

// ─── Book fly-up ─────────────────────────────────────────────────
function flyUpBook() {
  if (!bookObj) return;
  bookIsAnimating = true;
  hintEl?.classList.add('hidden');
  controls.enabled = false;

  // Same target calc as the Game Boy fly-up, slight upward shift instead
  const targetPos = new THREE.Vector3();
  camera.getWorldDirection(targetPos);
  targetPos.multiplyScalar(3.0);
  targetPos.add(camera.position);

  const camUp = new THREE.Vector3();
  camUp.copy(camera.up).applyQuaternion(camera.quaternion).normalize();
  targetPos.addScaledVector(camUp, 0.0); // centered vertically

  // Shift 25% to the right (camera-relative)
  const camRight = new THREE.Vector3();
  camRight.crossVectors(camera.getWorldDirection(new THREE.Vector3()), camera.up).normalize();
  targetPos.addScaledVector(camRight, 0.6); // ~25% of screen width at distance 3.0

  // Face camera, upright
  const targetRot = new THREE.Euler(camera.rotation.x, camera.rotation.y, camera.rotation.z);
  const targetScale = bookObj.group.scale.clone().multiplyScalar(4.125);
  setOverlayMode(bookObj.group, true);

  // Start cover opening at the same time as fly-up
  bookObj._animateOpen();

  animateTransform(bookObj.group, targetPos, targetRot, targetScale, 1200, () => {
    bookIsAnimating = false;
    bookIsFlownUp = true;
  });
}

// ─── Book fly back ────────────────────────────────────────────────
function flyBackBook() {
  if (bookIsAnimating || !bookIsFlownUp) return;
  bookIsAnimating = true;

  // Close the book (pages + cover) during fly-back, just as it opened during fly-up
  bookObj._animateClose();

  animateTransform(bookObj.group, bookStartPos, bookStartRot, bookStartScale, 1000, () => {
    bookIsAnimating = false;
    bookIsFlownUp = false;
    setOverlayMode(bookObj.group, false);
    controls.enabled = true;
    hintEl?.classList.remove('hidden');
  });
}

// ─── Smooth transform helper ─────────────────────────────────────
function animateTransform(obj, toPos, toRot, toScale, durationMs, onComplete) {
  const fromPos   = obj.position.clone();
  const fromRot   = new THREE.Quaternion().setFromEuler(obj.rotation);
  const toQuat    = toRot.isQuaternion ? toRot.clone() : new THREE.Quaternion().setFromEuler(toRot);
  const fromScale = obj.scale.clone();
  const start     = performance.now();

  function tick(now) {
    let t = Math.min((now - start) / durationMs, 1);
    t = 1 - Math.pow(1 - t, 3);

    obj.position.lerpVectors(fromPos, toPos, t);
    const q = new THREE.Quaternion();
    q.slerpQuaternions(fromRot, toQuat, t);
    obj.quaternion.copy(q);
    obj.scale.lerpVectors(fromScale, toScale, t);

    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      if (onComplete) onComplete();
    }
  }
  requestAnimationFrame(tick);
}

// ═══════════════════════════════════════════════════════════════════
//  3D BOOK
// ═══════════════════════════════════════════════════════════════════
class Book {
  constructor() {
    this.group = new THREE.Group();
    this.isOpen = false;
    this.isAnimating = false;
    this.currentPage = 0;   // which spread is visible
    this.flippedCount = 0;  // how many leafs are on the left side
    this.totalLeafs = 3;    // 3 leafs = 6 pages (front + back each)
    this.allMeshes = [];    // for raycasting

    // Book dimensions — portrait, compact
    this.W = 0.15;   // half-width of one page (total width = 0.30)
    this.H = 0.46;   // spine length / book depth on table (doubled)
    this.D = 0.035;  // page stack thickness
    this.spineW = 0.018;

    this._buildBook();
  }

  // ── Leaf texture: 6 unique pages ────────────────────────────────
  _makeLeafTexture(leafIndex, side) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 640;
    const ctx = c.getContext('2d');

    // Each page has a unique pastel background
    const bgs = [
      ['#FFF0F5','#FFD6E7'],  // leaf 0 front: soft pink
      ['#FFF8E1','#FFECC8'],  // leaf 0 back:  warm cream
      ['#F0FFF4','#C8F0D4'],  // leaf 1 front: mint green
      ['#F3F0FF','#DDD6F8'],  // leaf 1 back:  soft lavender
      ['#FFF5F0','#FFD9C8'],  // leaf 2 front: peach
      ['#F0F8FF','#C8DFFF'],  // leaf 2 back:  sky blue
    ];
    const pageIndex = leafIndex * 2 + (side === 'front' ? 0 : 1);
    const [bg1, bg2] = bgs[pageIndex];

    const grad = ctx.createLinearGradient(0, 0, 0, 640);
    grad.addColorStop(0, bg1);
    grad.addColorStop(1, bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 640);

    // Subtle ruled lines
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    for (let ly = 60; ly < 620; ly += 36) {
      ctx.beginPath(); ctx.moveTo(32, ly); ctx.lineTo(480, ly); ctx.stroke();
    }

    // Page number
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.font = 'italic 20px serif';
    ctx.textAlign = 'center';
    ctx.fillText('' + (pageIndex + 1), 256, 616);

    // Unique content per page
    ctx.textAlign = 'center';
    const pages = [
      () => { // Page 1
        ctx.fillStyle = '#D6336C'; ctx.font = 'bold 42px serif';
        ctx.fillText('Happy', 256, 180);
        ctx.fillText('Birthday! 🎂', 256, 240);
        ctx.fillStyle = '#888'; ctx.font = 'italic 26px serif';
        ctx.fillText('You are loved ♥', 256, 360);
      },
      () => { // Page 2
        ctx.fillStyle = '#B07D2B'; ctx.font = 'bold 36px serif';
        ctx.fillText('Wishing you', 256, 200);
        ctx.fillText('joy & laughter', 256, 250);
        ctx.font = '56px serif'; ctx.fillText('🎈🎉🎈', 256, 350);
      },
      () => { // Page 3
        ctx.fillStyle = '#2E8B57'; ctx.font = 'bold 38px serif';
        ctx.fillText('You are', 256, 200);
        ctx.fillText('so special ⭐', 256, 255);
        ctx.fillStyle = '#555'; ctx.font = 'italic 24px serif';
        ctx.fillText('Never forget that.', 256, 370);
      },
      () => { // Page 4
        ctx.fillStyle = '#6A4DB8'; ctx.font = 'bold 38px serif';
        ctx.fillText('Keep smiling', 256, 210);
        ctx.font = '56px serif'; ctx.fillText('😊✨', 256, 310);
        ctx.fillStyle = '#666'; ctx.font = 'italic 22px serif';
        ctx.fillText('Every day is a gift.', 256, 400);
      },
      () => { // Page 5
        ctx.fillStyle = '#C0392B'; ctx.font = 'bold 38px serif';
        ctx.fillText('With lots of', 256, 200);
        ctx.fillText('love ❤️', 256, 255);
        ctx.font = '50px serif'; ctx.fillText('🌸🌷🌸', 256, 360);
      },
      () => { // Page 6
        ctx.fillStyle = '#1A6FA8'; ctx.font = 'bold 40px serif';
        ctx.fillText('May all your', 256, 190);
        ctx.fillText('dreams come', 256, 245);
        ctx.fillText('true 🌟', 256, 300);
        ctx.fillStyle = '#555'; ctx.font = 'italic 22px serif';
        ctx.fillText('— With love', 256, 400);
      },
    ];
    pages[pageIndex]();

    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  // ── Cover texture ───────────────────────────────────────────────
  _makeCoverTexture(side) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 320;
    const ctx = c.getContext('2d');

    // Dark brown leather
    const grad = ctx.createLinearGradient(0, 0, 256, 320);
    grad.addColorStop(0, '#7A2E1A');
    grad.addColorStop(0.5, '#642717');
    grad.addColorStop(1, '#4A1C10');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 320);

    // Debossed border
    ctx.strokeStyle = '#3A1208';
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, 232, 296);
    ctx.strokeStyle = '#8B4030';
    ctx.lineWidth = 1;
    ctx.strokeRect(16, 16, 224, 288);

    // Title on front cover only
    if (side === 'front') {
      ctx.fillStyle = '#D4AF7A';
      ctx.font = 'bold 20px serif';
      ctx.textAlign = 'center';
      ctx.fillText('My Book', 128, 140);
      ctx.font = 'italic 13px serif';
      ctx.fillText('✦ ✦ ✦', 128, 170);
    }

    return new THREE.CanvasTexture(c);
  }

  // ── Custom textures for internal pages ────────────────────────
  _getCustomPageTexture(pageIndex) {
    const pageNum = pageIndex + 1;

    // Handle static image for Page 6
    if (pageNum === 6) {
      const tex = new THREE.TextureLoader().load('page_6.png');
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }

    // Handle videos for Pages 1-5
    if (pageNum > 5) return null;

    const video = document.createElement('video');
    video.src = `page_${pageNum}.mp4`;
    video.loop = true;
    video.muted = true;
    video.setAttribute('crossorigin', 'anonymous');
    video.setAttribute('webkit-playsinline', 'webkit-playsinline');
    video.setAttribute('playsinline', 'playsinline');
    
    video.play().catch(e => console.warn("Video autoplay failed:", e));
    
    const tex = new THREE.VideoTexture(video);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _buildBook() {
    const W = this.W, H = this.H, D = this.D, sW = this.spineW;
    const CT = 0.014; this._CT = CT;
    const spineMat      = new THREE.MeshStandardMaterial({ color: 0x642717, roughness: 0.9 });
    const pageEdgeMat   = new THREE.MeshStandardMaterial({ color: 0xEEEEEE, roughness: 0.9 });
    const coverGrayMat  = new THREE.MeshStandardMaterial({ color: 0x642717, roughness: 0.8 });
    
    const frontFaceMat  = new THREE.MeshStandardMaterial({ map: this._makeCoverTexture('front'), roughness: 0.8, color: 0x642717 });
    const pageGeo = new THREE.BoxGeometry(W*2, H, D);
    this.pagesBlock = new THREE.Mesh(pageGeo, [pageEdgeMat,spineMat,pageEdgeMat,pageEdgeMat,coverGrayMat,pageEdgeMat]);
    this.pagesBlock.position.set(0,0,0); this.pagesBlock.castShadow=true; this.pagesBlock.receiveShadow=true; this.pagesBlock.name='pagesBlock';
    this.group.add(this.pagesBlock); this.allMeshes.push(this.pagesBlock);
    const spineGeo = new THREE.BoxGeometry(sW, H, D+2*CT);
    this.spineMesh = new THREE.Mesh(spineGeo, spineMat);
    this.spineMesh.position.set(-(W+sW/2),0,0); this.spineMesh.castShadow=true; this.spineMesh.name='bookSpine';
    this.group.add(this.spineMesh); this.allMeshes.push(this.spineMesh);
    const backGeo = new THREE.BoxGeometry(W*2, H, CT);
    this.backCoverMesh = new THREE.Mesh(backGeo, coverGrayMat);
    this.backCoverMesh.position.set(0,0,-(D/2+CT/2)); this.backCoverMesh.castShadow=true; this.backCoverMesh.name='backCover';
    this.group.add(this.backCoverMesh); this.allMeshes.push(this.backCoverMesh);
    this.frontPivot = new THREE.Group();
    this.frontPivot.position.set(-W, 0, D/2 + CT/2);
    this.group.add(this.frontPivot);
    const frontGeo = new THREE.BoxGeometry(W*2, H, CT);
    this.frontCoverMesh = new THREE.Mesh(frontGeo,[coverGrayMat,spineMat,coverGrayMat,coverGrayMat,frontFaceMat,coverGrayMat]);
    this.frontCoverMesh.position.set(W, 0, 0); this.frontCoverMesh.castShadow=true; this.frontCoverMesh.name='frontCover';
    this.frontPivot.add(this.frontCoverMesh); this.allMeshes.push(this.frontCoverMesh);
    // ── Leaf page system: 3 leafs × 2 sides = 6 unique pages ───────
    this.leafPivots = [];
    const leafBaseZ = D / 2 + CT + 0.003;
    for (let i = 0; i < this.totalLeafs; i++) {
      const leafPivot = new THREE.Group();
      // Leaf 0 on top (highest Z = first to flip), leaf 2 at bottom
      const stackZ = leafBaseZ + (this.totalLeafs - 1 - i) * 0.001;
      leafPivot.position.set(-W, 0, stackZ);
      leafPivot.rotation.y = 0;
      this.group.add(leafPivot);

      const leafGeo = new THREE.PlaneGeometry(W * 2 - 0.01, H - 0.01);

      // Front face: visible when rotation.y = 0 (right/closed position)
      const frontTex  = this._getCustomPageTexture(i * 2) || this._makeLeafTexture(i, 'front');
      const frontMesh = new THREE.Mesh(leafGeo, new THREE.MeshStandardMaterial({
        map: frontTex, roughness: 0.9, side: THREE.FrontSide
      }));
      frontMesh.position.set(W, 0, 0.0003);
      frontMesh.name = `leaf${i}_front`;
      leafPivot.add(frontMesh);
      this.allMeshes.push(frontMesh);

      // Back face: visible when rotation.y = -PI (left/flipped position)
      // Rotated PI so its FrontSide faces the camera after the leaf is flipped
      const backTex   = this._getCustomPageTexture(i * 2 + 1) || this._makeLeafTexture(i, 'back');
      const backMesh = new THREE.Mesh(leafGeo, new THREE.MeshStandardMaterial({
        map: backTex, roughness: 0.9, side: THREE.FrontSide
      }));
      backMesh.rotation.y = Math.PI;
      backMesh.position.set(W, 0, -0.0003);
      backMesh.name = `leaf${i}_back`;
      leafPivot.add(backMesh);
      this.allMeshes.push(backMesh);

      this.leafPivots.push(leafPivot);
    }
    this._setClosed();
  }
  _setClosed() {
    this.frontPivot.rotation.y = 0;
    this.isOpen = false;
    this.flippedCount = 0;
    for (const lp of this.leafPivots) {
      lp.rotation.y = 0;
      // Hide pages so they don't poke out from under the cover when closed
      lp.visible = false;
    }
    // Restore original Z stack (leaf 0 on top)
    const leafBaseZ = this.D / 2 + this._CT + 0.003;
    for (let i = 0; i < this.leafPivots.length; i++) {
      this.leafPivots[i].position.z = leafBaseZ + (this.totalLeafs - 1 - i) * 0.001;
    }
  }
  handleClick(hit) {
    if (this.isAnimating) return;
    if (!this.isOpen) { this._animateOpen(); return; }
    const localHit = hit.point.clone();
    this.group.worldToLocal(localHit);
    if (localHit.x > 0 && this.flippedCount < this.totalLeafs) {
      this._animateLeafForward();
    } else if (localHit.x <= 0 && this.flippedCount > 0) {
      this._animateLeafBack();
    }
  }
  _animateClose() {
    this.isAnimating = true;
    // Snapshot each leaf's current rotation (some may be at -PI, some at 0)
    const leafStartRots = this.leafPivots.map(lp => lp.rotation.y);
    const anyFlipped = leafStartRots.some(r => r !== 0);

    // ── Phase 1: sweep all flipped pages back to rotation.y = 0 (500ms)
    // Cover stays open on the LEFT side (-PI) so pages sweeping right don't conflict
    const phase1Duration = anyFlipped ? 500 : 0;
    const phase1Start = performance.now();

    const startPhase2 = () => {
      // Pages are now back at rotation.y≈0; hide them before the cover sweeps over them
      for (const lp of this.leafPivots) { lp.rotation.y = 0; lp.visible = false; }
      const leafBaseZ = this.D / 2 + this._CT + 0.003;
      for (let i = 0; i < this.leafPivots.length; i++) {
        this.leafPivots[i].position.z = leafBaseZ + (this.totalLeafs - 1 - i) * 0.001;
      }
      this.flippedCount = 0;

      // ── Phase 2: sweep the cover from -PI back to 0 (400ms)
      const phase2Duration = 400, phase2Start = performance.now();
      const coverStartRot = this.frontPivot.rotation.y;
      const coverTick = (now) => {
        let t = Math.min((now - phase2Start) / phase2Duration, 1);
        t = 1 - Math.pow(1 - t, 3);
        this.frontPivot.rotation.y = coverStartRot * (1 - t);
        if (t < 1) { requestAnimationFrame(coverTick); }
        else {
          this.frontPivot.rotation.y = 0;
          this.isOpen = false;
          this.isAnimating = false;
        }
      };
      requestAnimationFrame(coverTick);
    };

    if (!anyFlipped) {
      // No pages to flip back — go straight to cover close
      startPhase2();
      return;
    }

    const pageTick = (now) => {
      let t = Math.min((now - phase1Start) / phase1Duration, 1);
      t = 1 - Math.pow(1 - t, 3);
      for (let i = 0; i < this.leafPivots.length; i++) {
        this.leafPivots[i].rotation.y = leafStartRots[i] * (1 - t);
      }
      if (t < 1) { requestAnimationFrame(pageTick); }
      else { startPhase2(); }
    };
    requestAnimationFrame(pageTick);
  }
  _animateOpen() {
    this.isAnimating = true;
    // Reveal pages now that the cover is opening
    for (const lp of this.leafPivots) lp.visible = true;
    const duration = 700, start = performance.now();
    const startRot = this.frontPivot.rotation.y, endRot = -Math.PI;
    const tick = (now) => {
      let t = Math.min((now - start) / duration, 1);
      t = 1 - Math.pow(1 - t, 3);
      this.frontPivot.rotation.y = startRot + (endRot - startRot) * t;
      if (t < 1) { requestAnimationFrame(tick); }
      else { this.isOpen = true; this.isAnimating = false; }
    };
    requestAnimationFrame(tick);
  }
  _animateLeafForward() {
    const leaf = this.leafPivots[this.flippedCount];
    // Raise Z above all previously flipped leafs so it's on top while sweeping
    const topZ = this.D / 2 + this._CT + 0.003 + this.flippedCount * 0.003;
    leaf.position.z = topZ;
    this.isAnimating = true;
    const duration = 600, start = performance.now();
    const tick = (now) => {
      let t = Math.min((now - start) / duration, 1);
      t = 1 - Math.pow(1 - t, 3);
      leaf.rotation.y = -Math.PI * t;
      if (t < 1) { requestAnimationFrame(tick); }
      else { this.flippedCount++; this.isAnimating = false; }
    };
    requestAnimationFrame(tick);
  }
  _animateLeafBack() {
    const leaf = this.leafPivots[this.flippedCount - 1];
    this.isAnimating = true;
    const duration = 600, start = performance.now();
    const tick = (now) => {
      let t = Math.min((now - start) / duration, 1);
      t = 1 - Math.pow(1 - t, 3);
      leaf.rotation.y = -Math.PI * (1 - t);
      if (t < 1) { requestAnimationFrame(tick); }
      else {
        this.flippedCount--;
        // Restore natural stack Z
        const leafBaseZ = this.D / 2 + this._CT + 0.003;
        leaf.position.z = leafBaseZ + (this.totalLeafs - 1 - this.flippedCount) * 0.001;
        this.isAnimating = false;
      }
    };
    requestAnimationFrame(tick);
  }
  placeOnTable(tableTopY) {
    this.group.rotation.x = -Math.PI / 2;
    this.group.rotation.z = THREE.MathUtils.degToRad(15);  // slight angle
    const halfThick = this.D / 2 + (this._CT || 0.014);
    // Right side of table, away from Game Boy (which is around x=-0.6)
    this.group.position.set(0.55, tableTopY + halfThick, 0.0);
  }
}

// ─── Render loop ─────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  depthClearedThisFrame = false;
  controls.update();

  // Pulsing glow on START button
  if (startBtnGlow && !isButtonPressed) {
    const t = clock.getElapsedTime();
    startBtnGlow.material.opacity = 0.25 + 0.15 * Math.sin(t * 2.5);
  }

  // Update snake game & keep overlay attached to Game Boy every frame
  if (gameActive) {
    const now = performance.now();
    snakeGame.tick(now);
    snakeGame.draw();
    updateGameOverlayPosition();
  }

  renderer.render(scene, camera);
}
animate();

// ─── Resize ──────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
