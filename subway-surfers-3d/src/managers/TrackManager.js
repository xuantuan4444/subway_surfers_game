import * as THREE from 'three';
import { LANE, OBSTACLE, CHUNK, POWERUP, POWERUP_CONFIG } from '../constants.js';
import { LaneUtils } from '../utils/LaneUtils.js';
import { SpawnManager } from './SpawnManager.js';
import { ModelManager } from '../utils/ModelManager.js';

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
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40);
  grad.addColorStop(0, 'rgba(255,240,200,0.12)');
  grad.addColorStop(0.3, 'rgba(255,220,170,0.06)');
  grad.addColorStop(0.6, 'rgba(255,200,140,0.02)');
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
    g2.addColorStop(0, 'rgba(255,240,200,0.08)');
    g2.addColorStop(0.5, 'rgba(255,220,170,0.03)');
    g2.addColorStop(1, 'rgba(255,200,140,0)');
    ctx.fillStyle = g2;
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  const dot = ctx.createRadialGradient(cx, cy, 0, cx, cy, 6);
  dot.addColorStop(0, 'rgba(255,245,220,0.2)');
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

    // Roadside pool — khởi tạo sau initChunks
    this._roadsidePool       = [];
    this._roadsideModelLength = 0;
    // measure sidewalk model length so we can tile without overlaps
    this._measureRoadsideModelLength();
    this.initChunks();
    // Roadside models are now spawned per-chunk so they reload with chunk recycling
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
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.9 });
    const grassLeft = new THREE.Mesh(new THREE.BoxGeometry(100, 0.5, this.chunkLength), grassMat);
    grassLeft.position.set(-59, 0.25, 0);
    grassLeft.receiveShadow = true;
    group.add(grassLeft);
    const grassRight = new THREE.Mesh(new THREE.BoxGeometry(100, 0.5, this.chunkLength), grassMat);
    grassRight.position.set(59, 0.25, 0);
    grassRight.receiveShadow = true;
    group.add(grassRight);

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
        if (child.material) child.material.dispose();
      }
    });
  }

  applyContentToChunk(chunk, content, chunkZ) {
    const baseCount = chunk.userData.baseChildCount ?? 0;

    for (const obstacleItem of content.rows) {
      for (const obs of obstacleItem.obstacles) {
        this._spawnPatternObstacle(chunk, obs, chunkZ);
      }
    }
    for (const train of (content.trains  || [])) this._spawnPatternTrain(chunk, train, chunkZ);
    for (const coin  of (content.coins   || [])) this._spawnPatternCoin(chunk, coin);
    for (const pu    of (content.powerUps || [])) this._spawnPatternPowerUp(chunk, pu);

    chunk.userData.baseChildCount = baseCount;
  }

  _spawnPatternObstacle(chunk, obs, chunkZ) {
    switch (obs.type) {
      case OBSTACLE.LOW_BARRIER:  this._spawnLowBarrier(chunk, obs);  break;
      case OBSTACLE.HIGH_BARRIER: this._spawnHighBarrier(chunk, obs); break;
    }
  }

  _spawnLowBarrier(chunk, obs) {
    const barrierWidth = 2.5, barrierHeight = 1.5, barrierLength = 1;
    const barrier = new THREE.Mesh(
      new THREE.BoxGeometry(barrierWidth, barrierHeight, barrierLength),
      new THREE.MeshStandardMaterial({ color: 0xff3333 })
    );
    barrier.position.set(obs.x, barrierHeight / 2, obs.z);
    barrier.castShadow = barrier.receiveShadow = true;
    barrier.userData = { type: 'obstacle', lane: obs.lane, isGround: true };
    chunk.add(barrier);
  }

  _spawnHighBarrier(chunk, obs) {
    const barrierGroup = new THREE.Group();
    const uMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.4 });

    const pillarGeo = new THREE.BoxGeometry(0.3, 2.4, 0.3);
    const pillarL = new THREE.Mesh(pillarGeo, uMat);
    pillarL.position.set(-1.1, 1.2, 0);
    pillarL.castShadow = pillarL.receiveShadow = true;
    barrierGroup.add(pillarL);
    const pillarR = pillarL.clone();
    pillarR.position.set(1.1, 1.2, 0);
    pillarR.castShadow = pillarR.receiveShadow = true;
    barrierGroup.add(pillarR);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 2.0, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.4 })
    );
    board.position.set(0, 3.5, 0);
    board.castShadow = board.receiveShadow = true;
    board.userData = { type: 'obstacle', lane: obs.lane, requiresSlide: true };
    barrierGroup.add(board);

    barrierGroup.position.set(obs.x, 0, obs.z);
    barrierGroup.userData = { type: 'obstacle', lane: obs.lane, requiresSlide: true };
    chunk.add(barrierGroup);
  }

  _spawnPatternTrain(chunk, train, chunkZ) {
    const xPos     = train.x;
    const zPos     = train.z;
    const isMoving = train.isMoving;
    const isDual   = train.isDual || false;
    const cars     = Math.min(train.cars || 1, 3);
    const hasRamp  = train.hasRamp !== false;

    const CAR_LENGTH  = 20;
    const trainWidth  = 2.6;
    const trainHeight = 4;

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
        carMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1a2b4c, roughness: 0.7 }));
      } else {
        const geo = new THREE.BoxGeometry(trainWidth, trainHeight, CAR_LENGTH);
        geo.translate(0, trainHeight / 2, 0);
        carMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
          color: isMoving ? 0xff5a1f : 0x1a2b4c, roughness: 0.7,
        }));
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
      };
    }

    if (train.rooftopCoins) {
      const coinsPerCar = 6;
      for (let i = 0; i < cars; i++) {
        const carOffsetZ = -i * CAR_LENGTH;
        for (let j = 0; j < coinsPerCar; j++) {
          const coin = new THREE.Mesh(
            new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16),
            new THREE.MeshStandardMaterial({
              color: 0xffd700, metalness: 0.8, roughness: 0.2,
              emissive: 0xffd700, emissiveIntensity: 0.15,
            })
          );
          coin.rotation.x = Math.PI / 2;
          coin.castShadow = true;
          coin.position.set(0, trainHeight + 1.5, carOffsetZ - 8 + j * 3.2);
          coin.userData = { type: 'coin', lane: train.lane, value: 10, rotateSpeed: 3, sparklePhase: Math.random() * Math.PI * 2 };

          const glow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this._coinGlowTex, blending: THREE.AdditiveBlending,
            transparent: true, opacity: 0.18, depthWrite: false, color: 0xffdd55,
          }));
          glow.scale.set(1.8, 1.8, 1);
          glow.userData = { coinParent: coin };
          coin.add(glow);
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
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffd700, metalness: 0.8, roughness: 0.2,
        emissive: 0xffd700, emissiveIntensity: 0.15,
      })
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.castShadow = true;
    mesh.position.set(coin.x, coin.altitude || 2, coin.z);
    mesh.userData = { type: 'coin', lane: coin.lane, value: coin.value || 10, rotateSpeed: 3, sparklePhase: Math.random() * Math.PI * 2 };

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._coinGlowTex, blending: THREE.AdditiveBlending,
      transparent: true, opacity: 0.18, depthWrite: false, color: 0xffdd55,
    }));
    glow.scale.set(3, 3, 1);
    glow.userData = { coinParent: mesh };
    mesh.add(glow);
    chunk.add(mesh);
  }

  _spawnPatternPowerUp(chunk, pu) {
    const cfg = POWERUP_CONFIG[pu.powerUpType] || POWERUP_CONFIG[POWERUP.SCORE_2X];
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 12, 12),
      new THREE.MeshStandardMaterial({
        color: cfg.color, emissive: cfg.emissive, emissiveIntensity: 0.3,
        metalness: 0.3, roughness: 0.4,
      })
    );
    mesh.castShadow = true;
    mesh.position.set(pu.x, 2.2, pu.z);
    mesh.userData = { type: 'powerup', powerUpType: pu.powerUpType };

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
    this.animatePowerUps(delta);
    this.animateTrains(delta);
    this._updateLamps(delta);

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
      if (objLane === entry.trainLane && objWorldZ >= entry.clearStartZ && objWorldZ <= entry.clearEndZ) {
        toRemove.push(child);
      } else if (entry.adjLanes.includes(objLane) && objWorldZ >= entry.bodyStartZ && objWorldZ <= entry.bodyEndZ) {
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
        if (!child.userData?.type === 'coin' || !child.userData?.rotateSpeed) return;
        child.rotation.z += child.userData.rotateSpeed * delta;
        const sparkle = 0.5 + 0.5 * Math.sin(t * 2.5 + (child.userData.sparklePhase || 0));
        if (child.material) child.material.emissiveIntensity = 0.1 + 0.08 * sparkle;
        child.traverse((c) => {
          if (c.isSprite) {
            c.material.opacity = 0.1 + 0.1 * sparkle;
            const s = 1.4 + 0.5 * sparkle;
            c.scale.set(s, s, 1);
          }
        });
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
          if (c.isSprite) {
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