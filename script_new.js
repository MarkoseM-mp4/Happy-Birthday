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

  // Project the 4 screen corners from GB local space → screen pixel space
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const corner of screenCorners) {
    // Transform local point to world
    const worldPt = corner.clone();
    gameboyMesh.localToWorld(worldPt);

    // Project to NDC
    const ndc = worldPt.project(camera);

    // NDC to screen pixels
    const sx = (ndc.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-ndc.y * 0.5 + 0.5) * window.innerHeight;

    minX = Math.min(minX, sx);
    minY = Math.min(minY, sy);
    maxX = Math.max(maxX, sx);
    maxY = Math.max(maxY, sy);
  }

  const w = maxX - minX;
  const h = maxY - minY;

  // Shrink 8% and keep centered
  const shrink = .87;
  const sw = w * shrink;
  const sh = h * shrink;
  const ox = minX + (w - sw) / 2+ h * -0.01;
  const oy = minY + (h - sh) / 2 + h * 0.04;  // 4% down

  if (sw > 10 && sh > 10) {
    gameCanvas.style.display = 'block';
    gameCanvas.style.left   = ox + 'px';
    gameCanvas.style.top    = oy + 'px';
    gameCanvas.style.width  = sw + 'px';
    gameCanvas.style.height = sh + 'px';
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

  loadGameboy();
}, undefined, (err) => console.error('Table load error:', err));

// ─── Load Game Boy ────────────────────────────────────────────────
function loadGameboy() {
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

// ─── Raycaster ────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const pointer   = new THREE.Vector2();
let isAnimating = false;
let isFlownUp   = false;
let gameActive  = false;  // is the snake game showing

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
  pointer.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  // ── Book interaction ──
  if (bookObj && !bookIsAnimating) {
    const bookHits = raycaster.intersectObjects(bookObj.allMeshes, false);
    if (bookHits.length > 0 && !bookIsFlownUp) {
      flyUpBook();
      return;
    } else if (bookIsFlownUp && bookHits.length === 0) {
      // Only fly back when clicking empty space (not the book itself)
      const gbHits = gameboyMesh ? raycaster.intersectObject(gameboyMesh, true) : [];
      if (gbHits.length === 0) {
        flyBackBook();
        return;
      }
    }
  }

  // ── Gameboy interaction ──
  if (isAnimating || !gameboyMesh || bookIsFlownUp) return;
  const hits = raycaster.intersectObject(gameboyMesh, true);

  if (hits.length > 0 && !isFlownUp) {
    if (isStartButtonHit(hits)) {
      pressButton(onStartPressed);
    } else {
      flyUp();
    }
  } else if (isFlownUp) {
    if (hits.length > 0 && isStartButtonHit(hits)) {
      pressButton(onStartPressed);
    } else if (hits.length === 0) {
      flyBack();
    }
  }
});

// ─── Arrow key controls ─────────────────────────────────────────
window.addEventListener('keydown', (e) => {
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

  // Check book hover
  if (bookObj) {
    const bookHits = raycaster.intersectObjects(bookObj.allMeshes, false);
    if (bookHits.length > 0) {
      canvas.style.cursor = 'pointer';
      return;
    }
  }

  if (!gameboyMesh || isAnimating) { canvas.style.cursor = 'default'; return; }
  const hits = raycaster.intersectObject(gameboyMesh, true);

  if (hits.length > 0) {
    canvas.style.cursor = 'pointer';
    if (isStartButtonHit(hits) && startBtnMesh && !isButtonPressed) {
      startBtnMesh.material.emissiveIntensity = 0.5;
    } else if (startBtnMesh && !isButtonPressed) {
      startBtnMesh.material.emissiveIntensity = 0.3;
    }
  } else {
    canvas.style.cursor = 'default';
    if (startBtnMesh && !isButtonPressed) startBtnMesh.material.emissiveIntensity = 0.3;
  }
});

// ─── Fly-up animation ────────────────────────────────────────────
function flyUp() {
  if (!gameboyMesh) return;
  isAnimating = true;
  hintEl.classList.add('hidden');
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
    controls.enabled = true;
    hintEl.classList.remove('hidden');
  });
}

// ─── Book fly-up ─────────────────────────────────────────────────
function flyUpBook() {
  if (!bookObj) return;
  bookIsAnimating = true;
  hintEl.classList.add('hidden');
  controls.enabled = false;

  // Same target calc as the Game Boy fly-up, slight upward shift instead
  const targetPos = new THREE.Vector3();
  camera.getWorldDirection(targetPos);
  targetPos.multiplyScalar(3.0);
  targetPos.add(camera.position);

  const camUp = new THREE.Vector3();
  camUp.copy(camera.up).applyQuaternion(camera.quaternion).normalize();
  targetPos.addScaledVector(camUp, 0.2); // slightly upward

  // Face camera, upright
  const targetRot = new THREE.Euler(camera.rotation.x, camera.rotation.y, camera.rotation.z);
  const targetScale = bookObj.group.scale.clone().multiplyScalar(2.75);

  animateTransform(bookObj.group, targetPos, targetRot, targetScale, 1200, () => {
    bookIsAnimating = false;
    bookIsFlownUp = true;
  });
}

// ─── Book fly back ────────────────────────────────────────────────
function flyBackBook() {
  if (bookIsAnimating || !bookIsFlownUp) return;
  bookIsAnimating = true;

  animateTransform(bookObj.group, bookStartPos, bookStartRot, bookStartScale, 1000, () => {
    bookIsAnimating = false;
    bookIsFlownUp = false;
    controls.enabled = true;
    hintEl.classList.remove('hidden');
  });
}

// ─── Smooth transform helper ─────────────────────────────────────
function animateTransform(obj, toPos, toRot, toScale, durationMs, onComplete) {
  const fromPos   = obj.position.clone();
  const fromRot   = new THREE.Quaternion().setFromEuler(obj.rotation);
  const toQuat    = new THREE.Quaternion().setFromEuler(toRot);
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
    this.totalSpreads = 5;  // 5 page spreads (10 pages)
    this.flipProgress = 0;
    this.flipDir = 0;       // -1 left, +1 right
    this.allMeshes = [];    // for raycasting

    // Book dimensions
    this.W = 0.55;   // half-width of one page
    this.H = 0.70;   // height
    this.D = 0.06;   // page stack depth
    this.spineW = 0.045;

    this._buildBook();
  }

  // ── Canvas texture helper ───────────────────────────────────────
  _makePageTexture(spreadIndex, side) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 320;
    const ctx = c.getContext('2d');

    // Cream paper background
    ctx.fillStyle = '#FFF8F0';
    ctx.fillRect(0, 0, 256, 320);

    // Subtle line ruling
    ctx.strokeStyle = '#E8D8CC';
    ctx.lineWidth = 1;
    for (let ly = 30; ly < 310; ly += 18) {
      ctx.beginPath(); ctx.moveTo(16, ly); ctx.lineTo(240, ly); ctx.stroke();
    }

    // Page number
    ctx.fillStyle = '#A0896A';
    ctx.font = 'italic 11px serif';
    ctx.textAlign = 'center';
    const pageNum = spreadIndex * 2 + (side === 'right' ? 1 : 0) + 1;
    ctx.fillText('' + pageNum, 128, 308);

    // Cute doodle on first spread
    if (spreadIndex === 0 && side === 'right') {
      ctx.fillStyle = '#FF9BB5';
      ctx.font = 'bold 22px serif';
      ctx.textAlign = 'center';
      ctx.fillText('Happy Birthday!', 128, 80);
      ctx.font = '36px serif';
      ctx.fillText('🎂', 128, 160);
      ctx.fillStyle = '#C4907A';
      ctx.font = 'italic 13px serif';
      ctx.fillText('You are loved ♥', 128, 220);
    }

    return new THREE.CanvasTexture(c);
  }

  // ── Cover texture ───────────────────────────────────────────────
  _makeCoverTexture(side) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 320;
    const ctx = c.getContext('2d');

    // Dark brown leather
    const grad = ctx.createLinearGradient(0, 0, 256, 320);
    grad.addColorStop(0, '#5C3A1E');
    grad.addColorStop(0.5, '#7A4E2D');
    grad.addColorStop(1, '#4A2C10');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 320);

    // Debossed border
    ctx.strokeStyle = '#3A2010';
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, 232, 296);
    ctx.strokeStyle = '#8B6040';
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

  _buildBook() {
    const W = this.W, H = this.H, D = this.D, sW = this.spineW;
    const CT = 0.014; this._CT = CT;
    const spineMat = new THREE.MeshStandardMaterial({ color: 0x4A2810, roughness: 0.9 });
    const pageEdgeMat = new THREE.MeshStandardMaterial({ color: 0xF5ECD7, roughness: 0.9 });
    const coverBrownMat = new THREE.MeshStandardMaterial({ color: 0x7A4E2D, roughness: 0.85 });
    const frontFaceMat = new THREE.MeshStandardMaterial({ map: this._makeCoverTexture('front'), roughness: 0.85 });
    const pageGeo = new THREE.BoxGeometry(W*2, H, D);
    this.pagesBlock = new THREE.Mesh(pageGeo, [pageEdgeMat,spineMat,pageEdgeMat,pageEdgeMat,pageEdgeMat,pageEdgeMat]);
    this.pagesBlock.position.set(0,0,0); this.pagesBlock.castShadow=true; this.pagesBlock.receiveShadow=true; this.pagesBlock.name='pagesBlock';
    this.group.add(this.pagesBlock); this.allMeshes.push(this.pagesBlock);
    const spineGeo = new THREE.BoxGeometry(sW, H, D+2*CT);
    this.spineMesh = new THREE.Mesh(spineGeo, spineMat);
    this.spineMesh.position.set(-(W+sW/2),0,0); this.spineMesh.castShadow=true; this.spineMesh.name='bookSpine';
    this.group.add(this.spineMesh); this.allMeshes.push(this.spineMesh);
    const backGeo = new THREE.BoxGeometry(W*2, H, CT);
    this.backCoverMesh = new THREE.Mesh(backGeo, coverBrownMat);
    this.backCoverMesh.position.set(0,0,-(D/2+CT/2)); this.backCoverMesh.castShadow=true; this.backCoverMesh.name='backCover';
    this.group.add(this.backCoverMesh); this.allMeshes.push(this.backCoverMesh);
    this.frontPivot = new THREE.Group();
    this.frontPivot.position.set(-(W+sW),0,D/2+CT/2);
    this.group.add(this.frontPivot);
    const frontGeo = new THREE.BoxGeometry(W*2, H, CT);
    this.frontCoverMesh = new THREE.Mesh(frontGeo,[coverBrownMat,spineMat,coverBrownMat,coverBrownMat,frontFaceMat,coverBrownMat]);
    this.frontCoverMesh.position.set(W,0,0); this.frontCoverMesh.castShadow=true; this.frontCoverMesh.name='frontCover';
    this.frontPivot.add(this.frontCoverMesh); this.allMeshes.push(this.frontCoverMesh);
    const pgGeo = new THREE.PlaneGeometry(W*2-0.01, H-0.01);
    this.rightPageMesh = new THREE.Mesh(pgGeo, new THREE.MeshStandardMaterial({map:this._makePageTexture(0,'right'),roughness:0.9,side:THREE.FrontSide}));
    this.rightPageMesh.position.set(0,0,D/2+0.001); this.rightPageMesh.name='rightPage'; this.rightPageMesh.visible=false;
    this.group.add(this.rightPageMesh); this.allMeshes.push(this.rightPageMesh);
    this.leftPageMesh = new THREE.Mesh(pgGeo, new THREE.MeshStandardMaterial({map:this._makePageTexture(0,'left'),roughness:0.9,side:THREE.FrontSide}));
    this.leftPageMesh.position.set(-(W*2+sW),0,-(D/2+CT/2)+0.001); this.leftPageMesh.name='leftPage'; this.leftPageMesh.visible=false;
    this.group.add(this.leftPageMesh); this.allMeshes.push(this.leftPageMesh);
    this.flipPivot = new THREE.Group();
    this.flipPivot.position.set(0,0,D/2+0.005);
    this.group.add(this.flipPivot);
    this.flipPage = new THREE.Mesh(new THREE.PlaneGeometry(W*2-0.01,H-0.01), new THREE.MeshStandardMaterial({map:this._makePageTexture(0,'right'),roughness:0.9,side:THREE.DoubleSide}));
    this.flipPage.position.set(0,0,0); this.flipPage.name='flipPage'; this.flipPage.visible=false;
    this.flipPivot.add(this.flipPage); this.allMeshes.push(this.flipPage);
    this._setClosed();
  }
  _setClosed() { this.frontPivot.rotation.y=0; this.leftPageMesh.visible=false; this.rightPageMesh.visible=false; this.flipPage.visible=false; }
  _refreshPageTextures() {
    this.rightPageMesh.material.map=this._makePageTexture(this.currentPage,'right'); this.rightPageMesh.material.needsUpdate=true;
    this.leftPageMesh.material.map=this._makePageTexture(this.currentPage,'left'); this.leftPageMesh.material.needsUpdate=true;
  }
  handleClick(hit) {
    if(this.isAnimating)return;
    if(!this.isOpen){this._animateOpen();return;}
    const localHit=hit.point.clone(); this.group.worldToLocal(localHit);
    if(localHit.x>-(this.W+this.spineW)&&this.currentPage<this.totalSpreads-1){this._animateFlip(1);}
    else if(localHit.x<=-(this.W+this.spineW)&&this.currentPage>0){this._animateFlip(-1);}
  }
  _animateOpen() {
    this.isAnimating=true; this.rightPageMesh.visible=true; this._refreshPageTextures();
    const duration=700,start=performance.now(),startRot=this.frontPivot.rotation.y,endRot=Math.PI;
    const tick=(now)=>{let t=Math.min((now-start)/duration,1);t=1-Math.pow(1-t,3);this.frontPivot.rotation.y=startRot+(endRot-startRot)*t;if(t<1){requestAnimationFrame(tick);}else{this.isOpen=true;this.isAnimating=false;this.leftPageMesh.visible=true;}};
    requestAnimationFrame(tick);
  }
  _animateFlip(dir) {
    this.isAnimating=true;
    const duration=500,start=performance.now(),startRot=dir===1?0:-Math.PI,endRot=dir===1?-Math.PI:0;
    this.flipPivot.position.set(0,0,this.D/2+0.005); this.flipPivot.rotation.y=startRot;
    this.flipPage.material.map=dir===1?this._makePageTexture(this.currentPage,'right'):this._makePageTexture(this.currentPage-1,'left');
    this.flipPage.material.needsUpdate=true; this.flipPage.visible=true;
    const tick=(now)=>{let t=Math.min((now-start)/duration,1);t=t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;this.flipPivot.rotation.y=startRot+(endRot-startRot)*t;this.flipPivot.position.z=this.D/2+0.005+Math.sin(t*Math.PI)*0.06;if(t<1){requestAnimationFrame(tick);}else{this.flipPage.visible=false;this.flipPivot.position.z=this.D/2+0.005;this.currentPage=dir===1?Math.min(this.currentPage+1,this.totalSpreads-1):Math.max(this.currentPage-1,0);this._refreshPageTextures();this.isAnimating=false;}};
    requestAnimationFrame(tick);
  }
  placeOnTable(tableTopY) {
    this.group.rotation.x=-Math.PI/2; this.group.rotation.z=THREE.MathUtils.degToRad(-20);
    const halfThick=this.D/2+(this._CT||0.014);
    this.group.position.set(-0.3,tableTopY+halfThick,0.2);
  }
}

// ─── Render loop ─────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
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
