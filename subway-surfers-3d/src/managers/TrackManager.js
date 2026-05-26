import * as THREE from 'three';
import { LANE, OBSTACLE, CHUNK, POWERUP, POWERUP_CONFIG } from '../constants.js';
import { LaneUtils } from '../utils/LaneUtils.js';
import { SpawnManager } from './SpawnManager.js';
import { ModelManager } from '../utils/ModelManager.js';
import { createPowerUpVisual } from '../entities/PowerUpVisuals.js';

function createGlowDiscTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,200,100,1)');
  g.addColorStop(0.25, 'rgba(255,180,80,0.7)');
  g.addColorStop(0.5, 'rgba(255,160,60,0.3)');
  g.addColorStop(0.8, 'rgba(255,140,40,0.08)');
  g.addColorStop(1, 'rgba(255,120,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function createBeamTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 200, 0, 64, 200, 64);
  g.addColorStop(0, 'rgba(255,210,160,0.35)');
  g.addColorStop(0.3, 'rgba(255,190,130,0.2)');
  g.addColorStop(0.6, 'rgba(255,170,110,0.08)');
  g.addColorStop(1, 'rgba(255,150,100,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 256);
  const fade = ctx.createLinearGradient(0, 0, 0, 256);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(0.3, 'rgba(0,0,0,0.85)');
  fade.addColorStop(0.5, 'rgba(0,0,0,0.5)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 128, 256);
  return new THREE.CanvasTexture(c);
}

function createCoinGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  const cx = 64, cy = 64;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 56);
  grad.addColorStop(0, 'rgba(255,246,196,0.42)');
  grad.addColorStop(0.24, 'rgba(255,217,79,0.26)');
  grad.addColorStop(0.58, 'rgba(255,176,31,0.11)');
  grad.addColorStop(1, 'rgba(255,180,120,0)');
  ctx.fillStyle = grad;
  ctx.save();
  ctx.shadowColor = 'rgba(255,230,180,0)';
  ctx.shadowBlur = 0;
  for (let i = 0; i < 12; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(i * Math.PI / 6);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(8, -32);
    ctx.lineTo(-8, -32);
    ctx.closePath();
    const g2 = ctx.createRadialGradient(0, -8, 2, 0, -16, 28);
    g2.addColorStop(0, 'rgba(255,244,190,0.18)');
    g2.addColorStop(0.5, 'rgba(255,215,90,0.08)');
    g2.addColorStop(1, 'rgba(255,200,140,0)');
    ctx.fillStyle = g2;
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  const dot = ctx.createRadialGradient(cx, cy, 0, cx, cy, 6);
  dot.addColorStop(0, 'rgba(255,250,220,0.36)');
  dot.addColorStop(1, 'rgba(255,230,190,0)');
  ctx.fillStyle = dot;
  ctx.fill();
  return new THREE.CanvasTexture(c);
}

function createBulbGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,230,180,1)');
  g.addColorStop(0.2, 'rgba(255,210,150,0.6)');
  g.addColorStop(0.5, 'rgba(255,180,100,0.15)');
  g.addColorStop(1, 'rgba(255,150,50,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function createWoodTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const base = ctx.createLinearGradient(0, 0, 256, 0);
  base.addColorStop(0, '#7b421f');
  base.addColorStop(0.35, '#b06a32');
  base.addColorStop(0.7, '#8a4d25');
  base.addColorStop(1, '#c47a3a');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);

  ctx.globalAlpha = 0.28;
  for (let y = 18; y < 256; y += 34) {
    ctx.fillStyle = '#3c1d0c';
    ctx.fillRect(0, y, 256, 2);
    ctx.fillStyle = '#e0a15e';
    ctx.fillRect(0, y + 3, 256, 1);
  }

  ctx.globalAlpha = 0.22;
  for (let i = 0; i < 42; i++) {
    const y = Math.random() * 256;
    const amp = 4 + Math.random() * 8;
    ctx.beginPath();
    for (let x = 0; x <= 256; x += 8) {
      const yy = y + Math.sin((x + i * 23) * 0.035) * amp;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.strokeStyle = i % 2 ? '#f0b96c' : '#2c1609';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.8, 1.2);
  return texture;
}

function createBarrierTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  const base = ctx.createLinearGradient(0, 0, 0, c.height);
  base.addColorStop(0, '#f04438');
  base.addColorStop(0.52, '#c81e1e');
  base.addColorStop(1, '#8f1111');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 24;
  for (let x = -170; x < 360; x += 74) {
    ctx.beginPath();
    ctx.moveTo(x, c.height + 18);
    ctx.lineTo(x + 132, -18);
    ctx.stroke();
  }
  ctx.strokeStyle = '#7a0f0f';
  ctx.lineWidth = 3;
  for (let x = -170; x < 360; x += 74) {
    ctx.beginPath();
    ctx.moveTo(x - 12, c.height + 18);
    ctx.lineTo(x + 120, -18);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, c.width - 16, c.height - 16);

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  return texture;
}

export class TrackManager {
  constructor(scene) {
    this.scene = scene;
    this.chunks = [];
    this.chunkLength = CHUNK.LENGTH;
    this.numChunks = CHUNK.NUM_CHUNKS;
    this.laneWidth = LANE.WIDTH;
    this.recycleThreshold = CHUNK.RECYCLE_THRESHOLD;
    this.spawnManager = new SpawnManager();
    this._playerZ = 0;
    this._playerSpeed = 18;
    this.lampLights = [];
    this._lampTargetIntensity = 0;
    this._lampCurrentIntensity = 0;
    this._coinGlowTex = createCoinGlowTexture();
    this._coinSparkleTimer = 0;
    const loader = new THREE.TextureLoader();
    this._coinLogoTex = loader.load('image/logo_mixi.jpg');
    this._coinLogoTex.colorSpace = THREE.SRGBColorSpace;
    this._coinLogoTex.center.set(0.5, 0.5);
    this._coinLogoTex.rotation = Math.PI / 2;
    this._coinFaceMat = new THREE.MeshStandardMaterial({
      map: this._coinLogoTex,
      color: 0xffffff,
      metalness: 0.2,
      roughness: 0.36,
      emissive: 0x2a2108,
      emissiveIntensity: 0.08,
    });
    this._coinSideMat = new THREE.MeshStandardMaterial({
      color: 0x050505,
      metalness: 0.65,
      roughness: 0.24,
      emissive: 0x000000,
      emissiveIntensity: 0.02,
    });
    this._coinRimMat = new THREE.MeshStandardMaterial({
      color: 0xffd43b,
      metalness: 0.78,
      roughness: 0.18,
      emissive: 0xffb000,
      emissiveIntensity: 0.28,
    });
    this._woodTex = createWoodTexture();
    this._barrierTex = createBarrierTexture();
    this._woodMat = new THREE.MeshStandardMaterial({
      map: this._woodTex,
      roughness: 0.72,
      metalness: 0.02,
    });
    this._barrierMat = new THREE.MeshStandardMaterial({
      map: this._barrierTex,
      roughness: 0.45,
      metalness: 0.08,
    });
    this._barrierFrameMat = new THREE.MeshStandardMaterial({
      color: 0x050505,
      roughness: 0.42,
      metalness: 0.18,
    });

    const texDir = 'textures/brick_pavement_03_1k.gltf/textures/';
    this._brickDiff = loader.load(texDir + 'brick_pavement_03_diff_1k.jpg');
    this._brickDiff.wrapS = this._brickDiff.wrapT = THREE.RepeatWrapping;
    this._brickDiff.repeat.set(0.5, 2);
    this._brickArm = loader.load(texDir + 'brick_pavement_03_arm_1k.jpg');
    this._brickArm.wrapS = this._brickArm.wrapT = THREE.RepeatWrapping;
    this._brickArm.repeat.set(0.5, 2);
    this._brickNorGl = loader.load(texDir + 'brick_pavement_03_nor_gl_1k.jpg');
    this._brickNorGl.wrapS = this._brickNorGl.wrapT = THREE.RepeatWrapping;
    this._brickNorGl.repeat.set(0.5, 2);

    const texDir2 = 'textures/sidewalktexture/';
    this._graniteDiff = loader.load(texDir2 + 'granite_tile_diff_1k.png');
    this._graniteDiff.wrapS = this._graniteDiff.wrapT = THREE.RepeatWrapping;
    this._graniteDiff.repeat.set(20, 12);
    this._graniteArm = loader.load(texDir2 + 'granite_tile_arm_1k.png');
    this._graniteArm.wrapS = this._graniteArm.wrapT = THREE.RepeatWrapping;
    this._graniteArm.repeat.set(20, 12);
    this._graniteNorGl = loader.load(texDir2 + 'granite_tile_nor_gl_1k.png');
    this._graniteNorGl.wrapS = this._graniteNorGl.wrapT = THREE.RepeatWrapping;
    this._graniteNorGl.repeat.set(20, 12);

    this._initFogEdges();

    // Roadside pool — khởi tạo sau initChunks
    this._roadsidePool       = [];
    this._roadsideModelLength = 0;
    // measure sidewalk model length so we can tile without overlaps
    this._measureRoadsideModelLength();
    this.initChunks();
    // Roadside models are now spawned per-chunk so they reload with chunk recycling
  }

  /* =========================================================
     FOG EDGES
  ========================================================= */

  _initFogEdges() {
    const fogEdgeWidth = 10;
    this._fogEdgeGeo = new THREE.PlaneGeometry(fogEdgeWidth, this.chunkLength);
    this._fogEdgeGeo.rotateX(-Math.PI / 2);

    const lCanvas = document.createElement('canvas');
    lCanvas.width = 64;
    lCanvas.height = 1;
    const lCtx = lCanvas.getContext('2d');
    const lG = lCtx.createLinearGradient(0, 0, 64, 0);
    lG.addColorStop(0.0, 'rgba(255,255,255,1)');
    lG.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    lG.addColorStop(1.0, 'rgba(255,255,255,0)');
    lCtx.fillStyle = lG;
    lCtx.fillRect(0, 0, 64, 1);

    const rCanvas = document.createElement('canvas');
    rCanvas.width = 64;
    rCanvas.height = 1;
    const rCtx = rCanvas.getContext('2d');
    const rG = rCtx.createLinearGradient(0, 0, 64, 0);
    rG.addColorStop(0.0, 'rgba(255,255,255,0)');
    rG.addColorStop(0.6, 'rgba(255,255,255,0.5)');
    rG.addColorStop(1.0, 'rgba(255,255,255,1)');
    rCtx.fillStyle = rG;
    rCtx.fillRect(0, 0, 64, 1);

    this._fogEdgeLeftMat = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(lCanvas),
      color: this.scene.fog ? this.scene.fog.color : 0xa9e4ff,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this._fogEdgeRightMat = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(rCanvas),
      color: this.scene.fog ? this.scene.fog.color : 0xa9e4ff,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
  }

  _createFogEdges(group) {
    const left = new THREE.Mesh(this._fogEdgeGeo, this._fogEdgeLeftMat);
    left.position.set(-104, 0.26, 0);
    group.add(left);

    const right = new THREE.Mesh(this._fogEdgeGeo, this._fogEdgeRightMat);
    right.position.set(104, 0.26, 0);
    group.add(right);
  }

  /* =========================================================
     CHUNKS
  ========================================================= */

  initChunks() {
    for (let i = 0; i < this.numChunks; i++) {
      const chunk = this.createBaseChunk();
      chunk.position.z = -i * this.chunkLength;
      this.scene.add(chunk);

      const chunkZ = chunk.position.z;
      const content = this.spawnManager.generateChunkContent(chunk, chunkZ);
      this.applyContentToChunk(chunk, content, chunkZ);
        // spawn roadside GLB only if its model tile belongs to this chunk's span
        this._maybeSpawnRoadsideForChunk(chunk);

        // mark baseChildCount after roadside spawn so roadside becomes part of base
        chunk.userData.baseChildCount = chunk.children.length;

        this.chunks.push(chunk);
    }
  }

  createBaseChunk() {
    const group = new THREE.Group();

    const roadGeo = new THREE.BoxGeometry(12, 0.5, this.chunkLength);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.position.y = -0.25;
    road.receiveShadow = true;
    road.userData = { isGround: true, type: 'road' };
    group.add(road);

    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 6; i++) {
      const lineGeo = new THREE.BoxGeometry(0.2, 0.02, 1.5);
      const lineL = new THREE.Mesh(lineGeo, lineMat);
      lineL.position.set(-1.5, 0.01, -i * 3.3 + 1.5);
      group.add(lineL);
      const lineR = new THREE.Mesh(lineGeo, lineMat);
      lineR.position.set(1.5, 0.01, -i * 3.3 + 1.5);
      group.add(lineR);
    }

    // Vỉa hè 2 bên (texture gạch)
    const sideGeo = new THREE.BoxGeometry(3, 0.5, this.chunkLength);
    const uvAttr = sideGeo.getAttribute('uv');
    if (uvAttr) sideGeo.setAttribute('uv2', uvAttr.clone());
    const sideMat = new THREE.MeshStandardMaterial({
      map: this._brickDiff,
      aoMap: this._brickArm,
      roughnessMap: this._brickArm,
      metalnessMap: this._brickArm,
      normalMap: this._brickNorGl,
      roughness: 0.85,
      metalness: 0.05,
    });
    const sidewalkLeft = new THREE.Mesh(sideGeo, sideMat);
    sidewalkLeft.position.set(-7.5, 0.25, 0);
    sidewalkLeft.receiveShadow = true;
    sidewalkLeft.userData = { isGround: true, type: 'sidewalk' };
    group.add(sidewalkLeft);
    const sidewalkRight = new THREE.Mesh(sideGeo, sideMat);
    sidewalkRight.position.set(7.5, 0.25, 0);
    sidewalkRight.receiveShadow = true;
    sidewalkRight.userData = { isGround: true, type: 'sidewalk' };
    group.add(sidewalkRight);

    // Mặt đất 2 bên
    const grassMat = new THREE.MeshStandardMaterial({
      map: this._graniteDiff,
      aoMap: this._graniteArm,
      roughnessMap: this._graniteArm,
      metalnessMap: this._graniteArm,
      normalMap: this._graniteNorGl,
      roughness: 0.9,
      metalness: 0.05,
    });
    const grassGeo = new THREE.BoxGeometry(100, 0.5, this.chunkLength);
    const grassUvAttr = grassGeo.getAttribute('uv');
    if (grassUvAttr) grassGeo.setAttribute('uv2', grassUvAttr.clone());
    const grassLeft = new THREE.Mesh(grassGeo, grassMat);
    grassLeft.position.set(-59, 0.25, 0);
    grassLeft.receiveShadow = true;
    group.add(grassLeft);
    const grassRight = new THREE.Mesh(grassGeo.clone(), grassMat);
    grassRight.position.set(59, 0.25, 0);
    grassRight.receiveShadow = true;
    group.add(grassRight);

    this._createFogEdges(group);
    this._spawnLamps(group);
    this._spawnChunkDecor(group);

    // baseChildCount will be set by the caller after optional roadside spawn
    return group;
  }

  /* =========================================================
     ROADSIDE POOL (leapfrog — không spawn per-chunk)
  ========================================================= */

  /**
   * Chỉnh 1 số duy nhất này để to / nhỏ.
   * Tỉ lệ model giữ nguyên hoàn toàn (uniform scale).
   */
  get _roadsideScale() { return 10; } // ← CHỈNH TẠI ĐÂY (giảm kích thước mô hình vỉa hè)

  _initRoadsidePool() {
    // Dọn pool cũ (khi reset)
    for (const entry of this._roadsidePool) {
      if (entry.left)  this.scene.remove(entry.left);
      if (entry.right) this.scene.remove(entry.right);
    }
    this._roadsidePool = [];

    const SCALE     = this._roadsideScale;
    const ANCHOR_X  = 10;
    const POOL_SIZE = 3; // 3 instance/side đảm bảo liên tục khi model dài

    // Đo chiều dài model sau scale để tính khoảng nhảy cóc
    const sampleSrc = ModelManager.get('SidewalkLeft');
    let modelLength = this.chunkLength * 2; // fallback
    if (sampleSrc) {
      const sample = sampleSrc.clone(true);
      sample.scale.setScalar(SCALE);
      sample.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(sample);
      if (!b.isEmpty()) modelLength = b.max.z - b.min.z;
    }
    this._roadsideModelLength = modelLength;

    for (let i = 0; i < POOL_SIZE; i++) {
      const startZ = -i * modelLength;

      const left  = this._makeRoadsideMesh('SidewalkLeft',  -ANCHOR_X, SCALE);
      const right = this._makeRoadsideMesh('SidewalkRight',  ANCHOR_X, SCALE);

      if (left)  { left.position.z  = startZ; this.scene.add(left);  }
      if (right) { right.position.z = startZ; this.scene.add(right); }

      this._roadsidePool.push({ left, right, z: startZ });
    }
  }

  _makeRoadsideMesh(modelName, anchorX, scale) {
    const src = ModelManager.get(modelName);
    if (!src) return null;

    const clone = src.clone(true);
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow    = true;
        child.receiveShadow = true;
      }
    });

    clone.scale.setScalar(scale);

    // Căn X và Y — Z sẽ được pool manager điều khiển
    clone.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(clone);
    if (bounds.isEmpty()) {
      clone.position.x = anchorX;
      return clone;
    }

    const center = new THREE.Vector3();
    bounds.getCenter(center);

    // Push roadside models slightly OUTSIDE the sidewalk so they don't overlap.
    // Offset scales with model scale so larger models are pushed farther out.
    const isLeftSide = anchorX < 0;
    // smaller multiplier moves the models closer to the sidewalk
    const OUTER_OFFSET = Math.max(1, Math.round(scale * 1)); // tunable: decreases with `scale` multiplier
    clone.position.x = anchorX - center.x + (isLeftSide ? -OUTER_OFFSET : OUTER_OFFSET);
    clone.position.y = -bounds.min.y; // đáy model chạm đất

    return clone;
  }

  _updateRoadsidePool(playerZ) {
    if (!this._roadsidePool.length) return;

    const modelLength = this._roadsideModelLength;
    const POOL_SIZE   = this._roadsidePool.length;
    const totalLength = modelLength * POOL_SIZE;

    // Z nhỏ nhất hiện tại trong pool (xa nhất phía trước)
    let frontZ = Infinity;
    for (const entry of this._roadsidePool) {
      if (entry.z < frontZ) frontZ = entry.z;
    }

    for (const entry of this._roadsidePool) {
      // Model đã lùi qua player → nhảy ra phía trước
      if (entry.z > playerZ + modelLength) {
        const newZ = frontZ - totalLength;
        entry.z = newZ;
        if (entry.left)  entry.left.position.z  = newZ;
        if (entry.right) entry.right.position.z = newZ;
        frontZ = newZ;
      }
    }

    // Ensure there's always an instance placed near the fog far plane
    // so the roadside repeats into the fog. Use scene.fog.far if available.
    const fogFar = (this.scene && this.scene.fog && this.scene.fog.far) ? this.scene.fog.far : 150;
    const desiredFrontZ = playerZ - fogFar + modelLength * 0.5; // target position at fog edge

    // If the current front (smallest z) is still in front of desiredFrontZ, move the nearest entry forward.
    if (frontZ > desiredFrontZ) {
      // pick the entry with the largest z (closest to player) to move forward
      let candidate = this._roadsidePool[0];
      for (const e of this._roadsidePool) if (e.z > candidate.z) candidate = e;
      candidate.z = desiredFrontZ;
      if (candidate.left)  candidate.left.position.z  = desiredFrontZ;
      if (candidate.right) candidate.right.position.z = desiredFrontZ;
    }
  }

  /* =========================================================
     LAMPS
  ========================================================= */

  _spawnLamps(group) {
    const LAMP_INTERVAL = 24;
    const halfLen = this.chunkLength / 2;

    const glowTex    = createGlowDiscTexture();
    const beamTex    = createBeamTexture();
    const bulbGlowTex = createBulbGlowTexture();

    for (let offset = -halfLen + 6; offset < halfLen - 6; offset += LAMP_INTERVAL) {
      const side  = (Math.floor(offset / LAMP_INTERVAL) % 2 === 0) ? -1 : 1;
      const wallX = side * 6.75;
      const lightZ = offset;
      const bulbY  = 6.8;

      let modelGroup = new THREE.Group();
      const src = ModelManager.get('Streetlight');
      if (src) {
        modelGroup = src;
        const scale = 7;
        modelGroup.scale.set(scale, scale, scale);
        modelGroup.rotation.y = side < 0 ? Math.PI : 0;
        modelGroup.traverse((child) => {
          if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
        });
      }
      modelGroup.position.set(wallX, 0, lightZ);
      group.add(modelGroup);

      const bulbX = wallX - side * 1.673;
      const bulbGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: bulbGlowTex, blending: THREE.AdditiveBlending,
        transparent: true, opacity: 0, depthWrite: false, depthTest: false, toneMapped: false,
      }));
      bulbGlow.scale.set(8, 8, 1);
      bulbGlow.position.set(bulbX, bulbY, lightZ);
      group.add(bulbGlow);

      const spotTarget = new THREE.Vector3(-side * 1.5, 0, lightZ);
      const light = new THREE.SpotLight(0xffdd88, 0, 55, 1.3, 0.85, 1);
      light.position.set(bulbX, bulbY, lightZ);
      light.target.position.copy(spotTarget);
      group.add(light);
      group.add(light.target);

      const glowDisc = new THREE.Mesh(
        new THREE.CircleGeometry(9, 32),
        new THREE.MeshBasicMaterial({
          map: glowTex, transparent: true, opacity: 0,
          depthWrite: false, blending: THREE.AdditiveBlending,
        })
      );
      glowDisc.rotation.x = -Math.PI / 2;
      glowDisc.position.set(spotTarget.x, 0.02, spotTarget.z);
      group.add(glowDisc);

      const beamSprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: beamTex, blending: THREE.AdditiveBlending,
        transparent: true, opacity: 0, depthWrite: false, depthTest: false, toneMapped: false,
      }));
      const mid = new THREE.Vector3()
        .addVectors(new THREE.Vector3(bulbX, bulbY, lightZ), spotTarget)
        .multiplyScalar(0.5);
      beamSprite.position.copy(mid);
      beamSprite.scale.set(14, 9, 1);
      group.add(beamSprite);

      this.lampLights.push({ light, bulbGlow, glowDisc, beamSprite, emissiveBase: 0.6 });
    }
  }

  /* =========================================================
     DECOR
  ========================================================= */

  _spawnChunkDecor(group) {
    const halfLen  = this.chunkLength / 2;
    const leftX    = -7.5;
    const rightX   =  7.5;

    const leftItems = [
      { name: 'Tree_1',           z: -halfLen + 30, y: 0.5, scale: 8,   rotationY: -Math.PI / 2 },
      { name: 'Chest',            z: -10,           scale: 5,            rotationY: Math.PI / 2  },
      { name: 'Container_small',  z:  10,           scale: 1.0,          rotationY: Math.PI / 4  },
      { name: 'Trashcan',         z:  halfLen - 5,  scale: 1.7,          rotationY: Math.PI      },
    ];
    const rightItems = [
      { name: 'Tree_2',              z: -halfLen + 30, y: 0.5, scale: 7,   rotationY: Math.PI / 2  },
      { name: 'ScifiContainer',      z:  12,           scale: 2.5,          rotationY: -Math.PI / 4 },
      { name: 'TrashContainerOpen',  z:  26,           scale: 1.2,          rotationY: -Math.PI / 2 },
    ];

    this._spawnDecorRow(group, leftX,  leftItems);
    this._spawnDecorRow(group, rightX, rightItems);
  }

  _spawnRoadsideForChunk(group) {
    // legacy: kept for compatibility but prefer using _spawnRoadsideAt
    this._spawnRoadsideAt(group, 0);
  }

  _spawnRoadsideAt(group, localZ) {
    const SCALE    = this._roadsideScale;
    const ANCHOR_X = 9;

    const left  = this._makeRoadsideMesh('SidewalkLeft',  -ANCHOR_X, SCALE);
    const right = this._makeRoadsideMesh('SidewalkRight',  ANCHOR_X, SCALE);

    if (left)  { left.position.z = localZ; left.userData = left.userData || {}; left.userData.isRoadside = true; group.add(left); }
    if (right) { right.position.z = localZ; right.userData = right.userData || {}; right.userData.isRoadside = true; group.add(right); }
  }

  _maybeSpawnRoadsideForChunk(chunk) {
    // ensure we measured model length
    if (!this._roadsideModelLength || this._roadsideModelLength <= 0) this._measureRoadsideModelLength();
    const modelLen = this._roadsideModelLength;
    const half = this.chunkLength / 2;

    // find the nearest tile center (multiples of modelLen)
    const k = Math.round(chunk.position.z / modelLen);
    const modelWorldZ = k * modelLen;

    // spawn into this chunk only if modelWorldZ lies within this chunk's z-span
    if (modelWorldZ >= chunk.position.z - half && modelWorldZ < chunk.position.z + half) {
      const localZ = modelWorldZ - chunk.position.z;
      this._spawnRoadsideAt(chunk, localZ);
    }
  }

  _measureRoadsideModelLength() {
    const SCALE = this._roadsideScale;
    const sampleSrc = ModelManager.get('SidewalkLeft');
    let modelLength = this.chunkLength * 2;
    if (sampleSrc) {
      const sample = sampleSrc.clone(true);
      sample.scale.setScalar(SCALE);
      sample.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(sample);
      if (!b.isEmpty()) modelLength = b.max.z - b.min.z;
    }
    this._roadsideModelLength = modelLength;
  }

  _spawnDecorRow(group, sideX, items) {
    for (const item of items) {
      const model = ModelManager.get(item.name);
      if (!model) continue;
      model.position.set(sideX, item.y ?? 0, item.z);
      model.scale.setScalar(item.scale);
      model.rotation.y = item.rotationY ?? 0;
      model.traverse((child) => {
        if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
      });
      group.add(model);
    }
  }

  /* =========================================================
     CHUNK CONTENT
  ========================================================= */

  clearChunkDynamicContent(group, playerZ) {
    const baseChildCount = group.userData?.baseChildCount ?? 0;
    const REMOVE_BUFFER = 5; // keep roadside until player passes this far past the model
    for (let i = group.children.length - 1; i >= baseChildCount; i--) {
      const child = group.children[i];
      // If this is a roadside model, only remove it when player has passed its world Z + buffer
      if (child.userData?.isRoadside && typeof playerZ === 'number') {
        const childWorldZ = group.position.z + child.position.z;
        if (playerZ <= childWorldZ + REMOVE_BUFFER) {
          continue; // skip removal for now
        }
      }
      this._disposeChild(child);
      group.remove(child);
    }
  }

  _disposeChild(obj) {
    obj.traverse(child => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        if (Array.isArray(child.material)) {
          for (const mat of child.material) mat.dispose();
        } else if (child.material) {
          child.material.dispose();
        }
      } else if (child.isSprite && child.material) {
        child.material.dispose();
      }
    });
  }

  _createCoinMesh({ x = 0, y = 2, z = 0, lane, value = 10, glowScale = 3 }) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.1, 24),
      [this._coinSideMat.clone(), this._coinFaceMat.clone(), this._coinFaceMat.clone()]
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.castShadow = true;
    mesh.position.set(x, y, z);
    mesh.userData = {
      type: 'coin',
      lane,
      value,
      rotateSpeed: 3,
      sparklePhase: Math.random() * Math.PI * 2,
    };

    const rimGeo = new THREE.TorusGeometry(0.405, 0.045, 12, 36);
    const frontRim = new THREE.Mesh(rimGeo, this._coinRimMat.clone());
    frontRim.rotation.x = Math.PI / 2;
    frontRim.position.y = 0.056;
    frontRim.userData = { isCoinRim: true };
    frontRim.castShadow = frontRim.receiveShadow = true;
    mesh.add(frontRim);

    const backRim = new THREE.Mesh(rimGeo.clone(), this._coinRimMat.clone());
    backRim.rotation.x = Math.PI / 2;
    backRim.position.y = -0.056;
    backRim.userData = { isCoinRim: true };
    backRim.castShadow = backRim.receiveShadow = true;
    mesh.add(backRim);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._coinGlowTex,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      color: 0xffd43b,
    }));
    glow.scale.set(glowScale, glowScale, 1);
    glow.userData = { coinParent: mesh, baseScale: glowScale };
    mesh.add(glow);

    return mesh;
  }

  _isWorldZInActiveView(worldZ) {
    const aheadVisible = 85;
    const behindVisible = 18;
    return worldZ >= this._playerZ - aheadVisible && worldZ <= this._playerZ + behindVisible;
  }

  _isTrainSpawnSafe(chunkZ, train) {
    const worldZ = chunkZ + train.z;
    const fogFar = this.scene?.fog?.far ?? 180;
    const minAhead = train.isMoving ? fogFar + 35 : 45;
    const maxBehind = 16;
    return !(worldZ >= this._playerZ - minAhead && worldZ <= this._playerZ + maxBehind);
  }

  _trainGroupHasVisual(trainGroup) {
    return trainGroup.children.some(child => child.userData?.isTrainVisual === true);
  }

  _getObstacleFootprint(obs) {
    switch (obs.type) {
      case OBSTACLE.HIGH_BARRIER:
      case OBSTACLE.LOW_HOLLOW_BARRIER:
        return { halfX: 1.35, halfZ: 0.65 };
      case OBSTACLE.LOW_SPHERE:
        return { halfX: 0.8, halfZ: 0.8 };
      case OBSTACLE.LOW_BARRIER:
      case OBSTACLE.WOOD_BOX:
      default:
        return { halfX: 1.25, halfZ: 0.75 };
    }
  }

  _doesObstacleOverlapTrain(chunk, obs) {
    const footprint = this._getObstacleFootprint(obs);
    const marginZ = 2.5;
    const marginX = 0.18;

    for (const child of chunk.children) {
      if (child.userData?.type !== 'train') continue;

      const data = child.userData;
      const cars = data.cars ?? 1;
      const trainLength = data.trainLength ?? 20;
      const trainWidth = data.trainWidth ?? 2.6;
      const rampLength = data.rampLength ?? 0;
      const halfCarLen = trainLength / (cars * 2);
      const minZ = child.position.z - trainLength + halfCarLen - marginZ;
      let maxZ = child.position.z + halfCarLen + rampLength + marginZ;
      if (data.movingTrain) maxZ += this.chunkLength + 24;

      const overlapsX = Math.abs(obs.x - child.position.x) <= (trainWidth / 2 + footprint.halfX + marginX);
      const overlapsZ = obs.z + footprint.halfZ >= minZ && obs.z - footprint.halfZ <= maxZ;

      if (overlapsX && overlapsZ) return true;
    }

    return false;
  }

  applyContentToChunk(chunk, content, chunkZ) {
    const baseCount = chunk.userData.baseChildCount ?? 0;

    for (const train of (content.trains  || [])) {
      if (this._isTrainSpawnSafe(chunkZ, train)) this._spawnPatternTrain(chunk, train, chunkZ);
    }
    for (const obstacleItem of content.rows) {
      for (const obs of obstacleItem.obstacles) {
        if (!this._doesObstacleOverlapTrain(chunk, obs)) {
          this._spawnPatternObstacle(chunk, obs, chunkZ);
        }
      }
    }
    for (const coin  of (content.coins   || [])) this._spawnPatternCoin(chunk, coin);
    for (const pu    of (content.powerUps || [])) this._spawnPatternPowerUp(chunk, pu);

    chunk.userData.baseChildCount = baseCount;
  }

  _spawnPatternObstacle(chunk, obs, chunkZ) {
    switch (obs.type) {
      case OBSTACLE.LOW_BARRIER:
      case OBSTACLE.WOOD_BOX:
        this._spawnWoodBox(chunk, obs);
        break;
      case OBSTACLE.LOW_HOLLOW_BARRIER:
        this._spawnLowHollowBarrier(chunk, obs);
        break;
      case OBSTACLE.LOW_SPHERE:
        this._spawnLowSphere(chunk, obs);
        break;
      case OBSTACLE.HIGH_BARRIER:
        this._spawnHighBarrier(chunk, obs);
        break;
    }
  }

  _spawnWoodBox(chunk, obs) {
    const width = 2.35;
    const height = 1.35;
    const length = 1.25;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, length),
      this._woodMat.clone()
    );
    box.position.set(obs.x, height / 2, obs.z);
    box.castShadow = box.receiveShadow = true;
    box.userData = {
      type: 'obstacle',
      lane: obs.lane,
      heightClass: 1,
      isGround: true,
    };
    chunk.add(box);
  }

  _spawnLowHollowBarrier(chunk, obs) {
    const barrierGroup = new THREE.Group();
    const panelMat = this._barrierMat.clone();
    const frameMat = this._barrierFrameMat.clone();

    const postGeo = new THREE.BoxGeometry(0.22, 1.45, 0.32);
    const footGeo = new THREE.BoxGeometry(0.62, 0.18, 0.72);
    const leftPost = new THREE.Mesh(postGeo, frameMat);
    leftPost.position.set(-1.12, 0.78, 0);
    leftPost.castShadow = leftPost.receiveShadow = true;
    barrierGroup.add(leftPost);

    const rightPost = leftPost.clone();
    rightPost.position.x = 1.12;
    rightPost.castShadow = rightPost.receiveShadow = true;
    barrierGroup.add(rightPost);

    for (const x of [-1.12, 1.12]) {
      const foot = new THREE.Mesh(footGeo, frameMat.clone());
      foot.position.set(x, 0.09, 0);
      foot.castShadow = foot.receiveShadow = true;
      barrierGroup.add(foot);
    }

    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.38, 0.42),
      panelMat
    );
    panel.position.set(0, 1.08, 0);
    panel.castShadow = panel.receiveShadow = true;
    barrierGroup.add(panel);

    const topRail = new THREE.Mesh(
      new THREE.BoxGeometry(2.55, 0.16, 0.5),
      frameMat.clone()
    );
    topRail.position.set(0, 1.34, 0);
    topRail.castShadow = topRail.receiveShadow = true;
    barrierGroup.add(topRail);

    const bottomRail = new THREE.Mesh(
      new THREE.BoxGeometry(2.55, 0.16, 0.42),
      frameMat.clone()
    );
    bottomRail.position.set(0, 0.12, 0);
    bottomRail.castShadow = bottomRail.receiveShadow = true;
    barrierGroup.add(bottomRail);

    barrierGroup.position.set(obs.x, 0, obs.z);
    barrierGroup.userData = {
      type: 'obstacle',
      lane: obs.lane,
      heightClass: 1,
      canSlideUnder: true,
    };
    chunk.add(barrierGroup);
  }

  _spawnLowSphere(chunk, obs) {
    const radius = 1.08;
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 24, 16),
      new THREE.MeshStandardMaterial({
        color: 0x7f54c9,
        roughness: 0.55,
        metalness: 0.08,
      })
    );
    sphere.position.set(obs.x, radius, obs.z);
    sphere.castShadow = sphere.receiveShadow = true;
    sphere.userData = {
      type: 'obstacle',
      lane: obs.lane,
      heightClass: 1,
    };
    chunk.add(sphere);
  }

  _spawnHighBarrier(chunk, obs) {
    const barrierGroup = new THREE.Group();
    const panelMat = this._barrierMat.clone();
    const frameMat = this._barrierFrameMat.clone();

    const pillarGeo = new THREE.BoxGeometry(0.26, 3.55, 0.34);
    const footGeo = new THREE.BoxGeometry(0.72, 0.2, 0.8);
    const pillarL = new THREE.Mesh(pillarGeo, frameMat);
    pillarL.position.set(-1.18, 1.78, 0);
    pillarL.castShadow = pillarL.receiveShadow = true;
    barrierGroup.add(pillarL);
    const pillarR = pillarL.clone();
    pillarR.position.set(1.18, 1.78, 0);
    pillarR.castShadow = pillarR.receiveShadow = true;
    barrierGroup.add(pillarR);

    for (const x of [-1.18, 1.18]) {
      const foot = new THREE.Mesh(footGeo, frameMat.clone());
      foot.position.set(x, 0.1, 0);
      foot.castShadow = foot.receiveShadow = true;
      barrierGroup.add(foot);
    }

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.3, 0.58),
      panelMat
    );
    board.position.set(0, 2.86, 0);
    board.castShadow = board.receiveShadow = true;
    barrierGroup.add(board);

    const topRail = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.18, 0.76), frameMat.clone());
    topRail.position.set(0, 3.62, 0);
    topRail.castShadow = topRail.receiveShadow = true;
    barrierGroup.add(topRail);

    barrierGroup.position.set(obs.x, 0, obs.z);
    barrierGroup.userData = {
      type: 'obstacle',
      lane: obs.lane,
      heightClass: 2,
      requiresSlide: true,
    };
    chunk.add(barrierGroup);
  }

  _createTrainHitboxMaterial() {
    return new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
    });
  }

  _trainPalette(isMoving) {
    return isMoving
      ? {
          body: 0xff7a1a,
          lower: 0x9d3309,
          stripe: 0xffd166,
          roof: 0x2c2c34,
          window: 0x101b27,
          glass: 0x7fdcff,
          light: 0xfff1a8,
        }
      : {
          body: 0x1d5f8f,
          lower: 0x123a5f,
          stripe: 0x8ee8ff,
          roof: 0x263544,
          window: 0x0c1824,
          glass: 0xaeefff,
          light: 0xdff8ff,
        };
  }

  _markVisualMesh(mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  _createSubwayCarVisual({ isMoving, isHead, trainWidth, trainHeight, carLength, rampLength }) {
    const group = new THREE.Group();
    group.userData = { isTrainVisual: true };
    const p = this._trainPalette(isMoving);
    const bodyMat = new THREE.MeshStandardMaterial({ color: p.body, roughness: 0.48, metalness: 0.18 });
    const lowerMat = new THREE.MeshStandardMaterial({ color: p.lower, roughness: 0.58, metalness: 0.12 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: p.stripe, roughness: 0.35, metalness: 0.08 });
    const roofMat = new THREE.MeshStandardMaterial({ color: p.roof, roughness: 0.62, metalness: 0.1 });
    const windowMat = new THREE.MeshStandardMaterial({
      color: p.window,
      emissive: p.glass,
      emissiveIntensity: 0.16,
      roughness: 0.22,
      metalness: 0.04,
    });
    const lightMat = new THREE.MeshStandardMaterial({
      color: p.light,
      emissive: p.light,
      emissiveIntensity: isMoving ? 0.55 : 0.28,
      roughness: 0.25,
    });

    const width = trainWidth * 0.96;
    const height = trainHeight * 0.96;
    const halfLen = carLength / 2;

    if (isHead && rampLength > 0) {
      const profile = new THREE.Shape()
        .moveTo(halfLen + rampLength, 0.04)
        .lineTo(halfLen, height)
        .lineTo(-halfLen + 0.15, height)
        .lineTo(-halfLen + 0.15, 0.12)
        .lineTo(halfLen + rampLength, 0.04);
      const rampBodyGeo = new THREE.ExtrudeGeometry(profile, {
        depth: width,
        bevelEnabled: false,
        steps: 1,
      });
      rampBodyGeo.translate(0, 0, -width / 2);
      rampBodyGeo.rotateY(-Math.PI / 2);
      const rampBody = this._markVisualMesh(new THREE.Mesh(rampBodyGeo, bodyMat));
      group.add(rampBody);

      const guideLineGeo = new THREE.BoxGeometry(0.06, 0.06, rampLength * 0.9);
      for (const x of [-0.38, 0.38]) {
        const guide = this._markVisualMesh(new THREE.Mesh(guideLineGeo, stripeMat));
        guide.position.set(x, 1.15, halfLen + rampLength * 0.43);
        guide.rotation.x = Math.atan2(height, rampLength);
        group.add(guide);
      }
    } else {
      const body = this._markVisualMesh(new THREE.Mesh(
        new THREE.BoxGeometry(width, height * 0.86, carLength * 0.96),
        bodyMat
      ));
      body.position.y = height * 0.49;
      group.add(body);
    }

    const roof = this._markVisualMesh(new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.88, 0.22, carLength * 0.88),
      roofMat
    ));
    roof.position.y = height + 0.08;
    roof.position.z = isHead && rampLength > 0 ? -0.9 : 0;
    group.add(roof);

    const lower = this._markVisualMesh(new THREE.Mesh(
      new THREE.BoxGeometry(width * 1.01, 0.36, carLength * 0.98),
      lowerMat
    ));
    lower.position.y = 0.28;
    group.add(lower);

    const stripe = this._markVisualMesh(new THREE.Mesh(
      new THREE.BoxGeometry(width * 1.02, 0.12, carLength * 0.92),
      stripeMat
    ));
    stripe.position.y = height * 0.58;
    group.add(stripe);

    const sideWindowGeo = new THREE.BoxGeometry(0.035, 0.58, 1.45);
    const doorGeo = new THREE.BoxGeometry(0.04, 1.4, 0.62);
    const windowZs = [-6.2, -3.6, -1.0, 1.6, 4.2, 6.8].filter(z => z > -halfLen + 1.1 && z < halfLen - 1.0);
    for (const side of [-1, 1]) {
      for (const z of windowZs) {
        const win = this._markVisualMesh(new THREE.Mesh(sideWindowGeo, windowMat));
        win.position.set(side * (width / 2 + 0.025), height * 0.68, z);
        group.add(win);
      }
      for (const z of [-4.8, 3.4].filter(v => v > -halfLen + 1.4 && v < halfLen - 1.4)) {
        const door = this._markVisualMesh(new THREE.Mesh(doorGeo, windowMat));
        door.position.set(side * (width / 2 + 0.03), height * 0.43, z);
        group.add(door);
      }
    }

    const frontPanel = this._markVisualMesh(new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.72, 0.9, 0.04),
      windowMat
    ));
    frontPanel.position.set(0, height * 0.68, halfLen + 0.025);
    group.add(frontPanel);

    for (const x of [-width * 0.3, width * 0.3]) {
      const light = this._markVisualMesh(new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), lightMat));
      light.position.set(x, 0.75, halfLen + 0.08);
      group.add(light);
    }

    const wheelGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.08, 14);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.65, metalness: 0.18 });
    for (const side of [-1, 1]) {
      for (const z of [-halfLen + 2.4, -halfLen + 5.0, halfLen - 5.0, halfLen - 2.4]) {
        const wheel = this._markVisualMesh(new THREE.Mesh(wheelGeo, wheelMat));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(side * (width / 2 + 0.06), 0.28, z);
        group.add(wheel);
      }
    }

    return group;
  }

  _spawnPatternTrain(chunk, train, chunkZ) {
    const xPos     = train.x;
    const zPos     = train.z;
    const isMoving = train.isMoving;
    const isDual   = train.isDual || false;
    const cars     = Math.min(train.cars || 1, 3);
    const hasRamp  = train.hasRamp !== false;

    const CAR_LENGTH  = 20;
    const trainWidth  = 2.85;
    const trainHeight = 4.25;

    const trainGroup = new THREE.Group();

    for (let i = 0; i < cars; i++) {
      const carOffsetZ    = -i * CAR_LENGTH;
      const isHead        = (!isMoving && hasRamp && i === 0);
      const thisRampLength = isHead ? 8 : 0;

      let carMesh;
      if (isHead) {
        const halfLen    = CAR_LENGTH / 2;
        const rampStartZ = halfLen + thisRampLength;
        const frontZ     = -halfLen;
        const profile = new THREE.Shape()
          .moveTo(rampStartZ, 0)
          .lineTo(halfLen,  trainHeight)
          .lineTo(frontZ,   trainHeight)
          .lineTo(frontZ,   0)
          .lineTo(rampStartZ, 0);
        const geo = new THREE.ExtrudeGeometry(profile, {
          depth: trainWidth, bevelEnabled: false, steps: 1,
        });
        geo.translate(0, 0, -trainWidth / 2);
        geo.rotateY(-Math.PI / 2);
        carMesh = new THREE.Mesh(geo, this._createTrainHitboxMaterial());
      } else {
        const geo = new THREE.BoxGeometry(trainWidth, trainHeight, CAR_LENGTH);
        geo.translate(0, trainHeight / 2, 0);
        carMesh = new THREE.Mesh(geo, this._createTrainHitboxMaterial());
      }

      carMesh.position.set(0, 0, carOffsetZ);
      carMesh.castShadow = carMesh.receiveShadow = true;
      carMesh.userData = {
        type: 'obstacle',
        lane: train.lane,
        isGround: true,
        movingTrain: isMoving || undefined,
        isTrainPart: true,
        walkableProfile: {
          kind: 'train', trainWidth, trainHeight,
          trainLength: CAR_LENGTH, rampLength: thisRampLength,
        },
      };
      trainGroup.add(carMesh);

      const carVisual = this._createSubwayCarVisual({
        isMoving,
        isHead,
        trainWidth,
        trainHeight,
        carLength: CAR_LENGTH,
        rampLength: thisRampLength,
      });
      carVisual.position.set(0, 0, carOffsetZ);
      trainGroup.add(carVisual);
    }

    const totalTrainLength = CAR_LENGTH * cars;
    trainGroup.position.set(xPos, 0, zPos);

    if (isMoving) {
      const ratio    = this._playerSpeed / 18;
      const minSpeed = Math.round(12 * ratio * 10) / 10;
      const maxSpeed = Math.round(16 * ratio * 10) / 10;
      trainGroup.userData = {
        type: 'train', lane: train.lane, cars,
        trainWidth, trainHeight, trainLength: totalTrainLength, rampLength: 0,
        movingTrain: true,
        visualReady: this._trainGroupHasVisual(trainGroup),
        trainMotion: {
          speed: THREE.MathUtils.randFloat(minSpeed, maxSpeed),
          distanceTraveled: 0, initialZ: zPos,
        },
      };
    } else {
      trainGroup.userData = {
        type: 'train', lane: train.lane, cars,
        trainWidth, trainHeight, trainLength: totalTrainLength,
        rampLength: hasRamp ? 8 : 0,
        visualReady: this._trainGroupHasVisual(trainGroup),
      };
    }

    if (train.rooftopCoins) {
      const coinsPerCar = 6;
      for (let i = 0; i < cars; i++) {
        const carOffsetZ = -i * CAR_LENGTH;
        for (let j = 0; j < coinsPerCar; j++) {
          const coin = this._createCoinMesh({
            x: 0,
            y: trainHeight + 1.5,
            z: carOffsetZ - 8 + j * 3.2,
            lane: train.lane,
            value: 10,
            glowScale: 2.1,
          });
          trainGroup.add(coin);
        }
      }
    }

    chunk.add(trainGroup);

    if (isDual) {
      const oppLane = train.lane === LANE.LEFT ? LANE.RIGHT : LANE.LEFT;
      this._spawnPatternTrain(chunk, { ...train, lane: oppLane, x: LaneUtils.laneToWorldX(oppLane) }, chunkZ);
    }
  }

  _spawnPatternCoin(chunk, coin) {
    const mesh = this._createCoinMesh({
      x: coin.x,
      y: coin.altitude || 2,
      z: coin.z,
      lane: coin.lane,
      value: coin.value || 10,
      glowScale: 3,
    });
    chunk.add(mesh);
  }

  _spawnPatternPowerUp(chunk, pu) {
    const cfg = POWERUP_CONFIG[pu.powerUpType] || POWERUP_CONFIG[POWERUP.SCORE_2X];
    const mesh = createPowerUpVisual(pu.powerUpType);
    mesh.castShadow = true;
    mesh.position.set(pu.x, 2.15, pu.z);
    mesh.userData = { type: 'powerup', powerUpType: pu.powerUpType };
    mesh.traverse((child) => {
      if (child.isMesh) child.castShadow = child.receiveShadow = true;
    });

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._coinGlowTex, blending: THREE.AdditiveBlending,
      transparent: true, opacity: 0.3, depthWrite: false, color: cfg.color,
    }));
    glow.scale.set(4, 4, 1);
    mesh.add(glow);
    chunk.add(mesh);
  }

  /* =========================================================
     UPDATE
  ========================================================= */

  update(delta, speed, playerZ, playerLane) {
    this._playerZ     = playerZ;
    this._playerSpeed = speed;
    this.spawnManager.update(delta, speed, playerZ, playerLane);
    this.animateCoins(delta);
    this.animateObstacles(delta);
    this.animatePowerUps(delta);
    this.animateTrains(delta);
    this._updateLamps(delta);

    if (this.scene.fog) {
      this._fogEdgeLeftMat.color.copy(this.scene.fog.color);
      this._fogEdgeRightMat.color.copy(this.scene.fog.color);
    }

    let frontZ = 0;
    for (const chunk of this.chunks) {
      if (chunk.position.z < frontZ) frontZ = chunk.position.z;
    }

    for (const chunk of this.chunks) {
      if (chunk.position.z > playerZ + this.recycleThreshold) {
        let playerNearTrain = false;
        for (const child of chunk.children) {
          if (child.userData?.type === 'train') {
            const trainWorldZ = chunk.position.z + child.position.z;
            if (Math.abs(trainWorldZ - playerZ) < this.chunkLength) {
              playerNearTrain = true;
              break;
            }
          }
        }
        if (playerNearTrain) continue;

        // If this chunk contains roadside models that the player hasn't passed yet,
        // don't recycle it — keep it until player moves past them.
        const REMOVE_BUFFER = 5;
        const hasUnpassedRoadside = chunk.children.some((c) => {
          if (!c.userData?.isRoadside) return false;
          const worldZ = chunk.position.z + c.position.z;
          return playerZ <= worldZ + REMOVE_BUFFER;
        });
        if (hasUnpassedRoadside) continue;

        this.spawnManager.clearChunkData(chunk);
        this.clearChunkDynamicContent(chunk, playerZ);

        const newZ = frontZ - this.chunkLength;
        chunk.position.z = newZ;

        const content = this.spawnManager.generateChunkContent(chunk, newZ);
        this.applyContentToChunk(chunk, content, newZ);
        // after recycling chunk, possibly spawn roadside model for its new position
        this._maybeSpawnRoadsideForChunk(chunk);
        // update baseChildCount so roadside (if spawned) becomes base for this recycled chunk
        chunk.userData.baseChildCount = chunk.children.length;

        const clearList = this.spawnManager.getRetroactiveClearList();
        for (const entry of clearList) {
          const targetChunk = this.chunks.find(c => c.uuid === entry.chunkUuid);
          if (targetChunk) this._removeObstaclesInRange(targetChunk, entry);
        }
      }
    }
  }

  _removeObstaclesInRange(chunk, entry) {
    const toRemove = [];
    for (const child of chunk.children) {
      if (child.userData?.type !== 'obstacle') continue;
      if (child.userData?.walkableProfile) continue;
      const objWorldZ = chunk.position.z + child.position.z;
      const objLane   = child.userData.lane;
      if (objLane === undefined) continue;
      if (this._isWorldZInActiveView(objWorldZ)) continue;
      if (objLane === entry.trainLane && objWorldZ >= entry.clearStartZ && objWorldZ <= entry.clearEndZ) {
        toRemove.push(child);
      } else if ((entry.adjLanes || []).includes(objLane) && objWorldZ >= entry.bodyStartZ && objWorldZ <= entry.bodyEndZ) {
        toRemove.push(child);
      }
    }
    for (const obj of toRemove) { this._disposeChild(obj); chunk.remove(obj); }
  }

  /* =========================================================
     ANIMATE
  ========================================================= */

  animateTrains(delta) {
    this.chunks.forEach(chunk => {
      chunk.traverse((child) => {
        const motion = child.userData?.trainMotion;
        if (!motion) return;
        if (!child.userData.visualReady || !this._trainGroupHasVisual(child)) {
          child.visible = false;
          return;
        }
        child.visible = true;
        motion.distanceTraveled += motion.speed * delta;
        child.position.z += motion.speed * delta;
      });
    });
  }

  animateCoins(delta) {
    this._coinSparkleTimer += delta;
    const t = this._coinSparkleTimer;
    this.chunks.forEach(chunk => {
      chunk.traverse((child) => {
        if (child.userData?.type !== 'coin' || !child.userData?.rotateSpeed) return;
        child.rotation.z += child.userData.rotateSpeed * delta;
        const sparkle = 0.5 + 0.5 * Math.sin(t * 2.5 + (child.userData.sparklePhase || 0));
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of materials) {
          if (mat && 'emissiveIntensity' in mat) mat.emissiveIntensity = 0.1 + 0.12 * sparkle;
        }
        child.traverse((c) => {
          if (c.userData?.isCoinRim && c.material && 'emissiveIntensity' in c.material) {
            c.material.emissiveIntensity = 0.22 + 0.22 * sparkle;
          } else if (c.isSprite) {
            c.material.opacity = 0.16 + 0.18 * sparkle;
            const baseScale = c.userData?.baseScale || 2.4;
            const s = baseScale * (0.82 + 0.22 * sparkle);
            c.scale.set(s, s, 1);
          }
        });
      });
    });
  }

  animateObstacles(delta) {
    this.chunks.forEach(chunk => {
      chunk.traverse((child) => {
        if (!child.userData?.bobbingObstacle) return;
        const t = this._coinSparkleTimer * child.userData.bobSpeed + child.userData.bobPhase;
        const baseY = child.userData.bobBaseY ?? child.position.y;
        const amp = child.userData.bobAmplitude ?? 0.3;
        child.position.y = baseY + Math.sin(t) * amp;
        child.rotation.y += 1.4 * delta;
      });
    });
  }

  animatePowerUps(delta) {
    this._coinSparkleTimer += delta;
    const t = this._coinSparkleTimer;
    this.chunks.forEach(chunk => {
      chunk.traverse((child) => {
        if (child.userData?.type !== 'powerup') return;
        child.rotation.y += 3 * delta;
        const pulse = 0.5 + 0.5 * Math.sin(t * 3 + child.id);
        if (child.material) child.material.emissiveIntensity = 0.2 + 0.25 * pulse;
        child.traverse((c) => {
          if (c.isSprite && !c.userData?.skipPowerUpPulse) {
            c.material.opacity = 0.2 + 0.2 * pulse;
            const s = 3 + 1 * pulse;
            c.scale.set(s, s, 1);
          }
        });
      });
    });
  }

  /* =========================================================
     LAMPS
  ========================================================= */

  setLampIntensity(v) {
    this._lampTargetIntensity = Math.max(0, Math.min(1, v));
  }

  _updateLamps(delta) {
    const speed = 2;
    this._lampCurrentIntensity = this._lampCurrentIntensity < this._lampTargetIntensity
      ? Math.min(this._lampTargetIntensity, this._lampCurrentIntensity + speed * delta)
      : Math.max(this._lampTargetIntensity, this._lampCurrentIntensity - speed * delta);

    const intensity = this._lampCurrentIntensity;
    for (const entry of this.lampLights) {
      entry.light.intensity         = intensity * 250;
      entry.bulbGlow.material.opacity = intensity * 0.5;
      entry.glowDisc.material.opacity = intensity * 0.5;
      entry.beamSprite.material.opacity = intensity * 0.25;
    }
  }

  /* =========================================================
     RESET
  ========================================================= */

  reset(options = {}) {
    const { includeCoins = true } = options;
    this.spawnManager.reset();
    this._playerSpeed = 18;
    for (const chunk of this.chunks) this.scene.remove(chunk);
    this.chunks    = [];
    this.lampLights = [];
    this._lampTargetIntensity  = 0;
    this._lampCurrentIntensity = 0;
    this.initChunks();
    // Roadside pool disabled — roadside meshes spawn per-chunk in createBaseChunk

    if (!includeCoins) this.clearAllCoins();
  }

  clearAllCoins() {
    for (const chunk of this.chunks) {
      for (let i = chunk.children.length - 1; i >= 0; i--) {
        const child = chunk.children[i];
        if (child.userData?.type === 'coin') { this._disposeChild(child); chunk.remove(child); }
      }
    }
  }
}
