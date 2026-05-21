import * as THREE from 'three';
import { LANE, OBSTACLE, CHUNK } from '../constants.js';
import { LaneUtils } from '../utils/LaneUtils.js';
import { SpawnManager } from './SpawnManager.js';

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
    this.lampLights = [];
    this._lampTargetIntensity = 0;
    this._lampCurrentIntensity = 0;
    this._coinGlowTex = createCoinGlowTexture();
    this._coinSparkleTimer = 0;
    this.initChunks();
  }

  initChunks() {
    for (let i = 0; i < this.numChunks; i++) {
      const chunk = this.createBaseChunk();
      chunk.position.z = -i * this.chunkLength;
      this.scene.add(chunk);

      const chunkZ = chunk.position.z;
      const content = this.spawnManager.generateChunkContent(chunk, chunkZ);
      this.applyContentToChunk(chunk, content, chunkZ);

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

    const wallGeo = new THREE.BoxGeometry(0.5, 2, this.chunkLength);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x666666 });
    const wallL = new THREE.Mesh(wallGeo, wallMat);
    wallL.position.set(-6.25, 1, 0);
    wallL.castShadow = true;
    wallL.receiveShadow = true;
    group.add(wallL);
    const wallR = new THREE.Mesh(wallGeo, wallMat);
    wallR.position.set(6.25, 1, 0);
    wallR.castShadow = true;
    wallR.receiveShadow = true;
    group.add(wallR);

    this._spawnLamps(group);

    group.userData.baseChildCount = group.children.length;
    return group;
  }

  _spawnLamps(group) {
    const LAMP_INTERVAL = 24;
    const halfLen = this.chunkLength / 2;

    const glowTex = createGlowDiscTexture();
    const beamTex = createBeamTexture();
    const bulbGlowTex = createBulbGlowTexture();

    for (let offset = -halfLen + 6; offset < halfLen - 6; offset += LAMP_INTERVAL) {
      const side = (Math.floor(offset / LAMP_INTERVAL) % 2 === 0) ? -1 : 1;
      const wallX = side * 6.5;
      const armDir = -side;
      const bulbX = wallX + armDir * 1.7;
      const bulbY = 6.8;
      const lightZ = offset;

      const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8, metalness: 0.3 });
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.2, 7, 0.2), poleMat);
      pole.position.set(wallX, 3.5, lightZ);
      pole.castShadow = true;
      pole.receiveShadow = true;
      group.add(pole);

      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(2, 0.08, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.7, metalness: 0.3 })
      );
      arm.position.set(wallX + armDir * 1, 6.8, lightZ);
      arm.castShadow = true;
      group.add(arm);

      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xffcc66, emissive: 0xffcc66, emissiveIntensity: 0 })
      );
      bulb.position.set(bulbX, bulbY, lightZ);
      group.add(bulb);

      const bulbGlow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: bulbGlowTex,
          blending: THREE.AdditiveBlending,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          depthTest: false,
          toneMapped: false,
        })
      );
      bulbGlow.scale.set(8, 8, 1);
      bulbGlow.position.set(bulbX, bulbY, lightZ);
      group.add(bulbGlow);

      const spotTarget = new THREE.Vector3(0, 0, lightZ);
      const light = new THREE.SpotLight(0xffdd88, 0, 55, 1.3, 0.85, 1);
      light.position.set(bulbX, bulbY, lightZ);
      light.target.position.copy(spotTarget);
      group.add(light);
      group.add(light.target);

      const glowDisc = new THREE.Mesh(
        new THREE.CircleGeometry(9, 32),
        new THREE.MeshBasicMaterial({
          map: glowTex,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      glowDisc.rotation.x = -Math.PI / 2;
      glowDisc.position.set(spotTarget.x, 0.02, spotTarget.z);
      group.add(glowDisc);

      const beamSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: beamTex,
          blending: THREE.AdditiveBlending,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          depthTest: false,
          toneMapped: false,
        })
      );
      const mid = new THREE.Vector3().addVectors(
        new THREE.Vector3(bulbX, bulbY, lightZ), spotTarget
      ).multiplyScalar(0.5);
      beamSprite.position.copy(mid);
      beamSprite.scale.set(14, 9, 1);
      group.add(beamSprite);

      this.lampLights.push({ light, bulb, bulbGlow, glowDisc, beamSprite, emissiveBase: 0.6 });
    }
  }

  clearChunkDynamicContent(group) {
    const baseChildCount = group.userData?.baseChildCount ?? 0;
    for (let i = group.children.length - 1; i >= baseChildCount; i--) {
      const child = group.children[i];
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

    for (const train of (content.trains || [])) {
      this._spawnPatternTrain(chunk, train, chunkZ);
    }

    for (const coin of (content.coins || [])) {
      this._spawnPatternCoin(chunk, coin);
    }

    chunk.userData.baseChildCount = baseCount;
  }

  _spawnPatternObstacle(chunk, obs, chunkZ) {
    switch (obs.type) {
      case OBSTACLE.LOW_BARRIER:
        this._spawnLowBarrier(chunk, obs);
        break;
      case OBSTACLE.HIGH_BARRIER:
        this._spawnHighBarrier(chunk, obs);
        break;
    }
  }

  _spawnLowBarrier(chunk, obs) {
    const xPos = obs.x;
    const zPos = obs.z;

    const barrierWidth = 2.5;
    const barrierHeight = 1.5;
    const barrierLength = 1;
    const barrierGeo = new THREE.BoxGeometry(barrierWidth, barrierHeight, barrierLength);
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0xff3333 });

    const barrier = new THREE.Mesh(barrierGeo, barrierMat);
    barrier.position.set(xPos, barrierHeight / 2, zPos);
    barrier.castShadow = true;
    barrier.receiveShadow = true;
    barrier.userData = { type: 'obstacle', lane: obs.lane, isGround: true };
    chunk.add(barrier);
  }

  _spawnHighBarrier(chunk, obs) {
    const xPos = obs.x;
    const zPos = obs.z;

    const barrierGroup = new THREE.Group();
    const uMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.4 });

    const pillarGeo = new THREE.BoxGeometry(0.3, 1.4, 0.3);
    const pillarL = new THREE.Mesh(pillarGeo, uMat);
    pillarL.position.set(-1.1, 0.7, 0);
    pillarL.castShadow = true;
    pillarL.receiveShadow = true;
    barrierGroup.add(pillarL);
    const pillarR = pillarL.clone();
    pillarR.position.set(1.1, 0.7, 0);
    pillarR.castShadow = true;
    pillarR.receiveShadow = true;
    barrierGroup.add(pillarR);

    const boardGeo = new THREE.BoxGeometry(2.5, 2.0, 0.8);
    const boardMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.4 });
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.set(0, 2.5, 0);
    board.castShadow = true;
    board.receiveShadow = true;
    board.userData = { type: 'obstacle', lane: obs.lane, requiresSlide: true };
    barrierGroup.add(board);

    barrierGroup.position.set(xPos, 0, zPos);
    barrierGroup.userData = { type: 'obstacle', lane: obs.lane, requiresSlide: true };
    chunk.add(barrierGroup);
  }

  _spawnPatternTrain(chunk, train, chunkZ) {
    const xPos = train.x;
    const zPos = train.z;
    const isMoving = train.isMoving;
    const isDual = train.isDual || false;
    const cars = Math.min(train.cars || 1, 3);
    const hasRamp = train.hasRamp !== false;

    const CAR_LENGTH = 20;
    const trainWidth = 2.6;
    const trainHeight = 4;
    const rampLength = (!isMoving && hasRamp) ? 8 : 0;

    const trainGroup = new THREE.Group();

    for (let i = 0; i < cars; i++) {
      const carOffsetZ = -i * CAR_LENGTH;
      const isFirstCar = (i === 0);
      const thisRampLength = (isFirstCar && !isMoving && hasRamp) ? 8 : 0;

      let carMesh;
      if (isMoving || (!isFirstCar && !hasRamp) || (!isFirstCar && isMoving)) {
        const geo = new THREE.BoxGeometry(trainWidth, trainHeight, CAR_LENGTH);
        geo.translate(0, trainHeight / 2, 0);
        const mat = new THREE.MeshStandardMaterial({ color: isMoving ? 0xff5a1f : 0x1a2b4c, roughness: 0.7 });
        carMesh = new THREE.Mesh(geo, mat);
      } else if (!isMoving && hasRamp && isFirstCar) {
        const halfLen = CAR_LENGTH / 2;
        const rampStartZ = halfLen + thisRampLength;
        const frontZ = -halfLen;
        const profile = new THREE.Shape();
        profile.moveTo(rampStartZ, 0);
        profile.lineTo(halfLen, trainHeight);
        profile.lineTo(frontZ, trainHeight);
        profile.lineTo(frontZ, 0);
        profile.lineTo(rampStartZ, 0);
        const geo = new THREE.ExtrudeGeometry(profile, {
          depth: trainWidth, bevelEnabled: false, steps: 1
        });
        geo.translate(0, 0, -trainWidth / 2);
        geo.rotateY(-Math.PI / 2);
        const mat = new THREE.MeshStandardMaterial({ color: 0x1a2b4c, roughness: 0.7 });
        carMesh = new THREE.Mesh(geo, mat);
      } else {
        const geo = new THREE.BoxGeometry(trainWidth, trainHeight, CAR_LENGTH);
        geo.translate(0, trainHeight / 2, 0);
        const mat = new THREE.MeshStandardMaterial({ color: 0x1a2b4c, roughness: 0.7 });
        carMesh = new THREE.Mesh(geo, mat);
      }

      const isWalkable = true;
      carMesh.position.set(0, 0, carOffsetZ);
      carMesh.castShadow = true;
      carMesh.receiveShadow = true;
      carMesh.userData = {
        type: 'obstacle',
        lane: train.lane,
        isGround: isWalkable,
        movingTrain: isMoving || undefined,
        walkableProfile: isWalkable ? {
          kind: 'train',
          trainWidth,
          trainHeight,
          trainLength: CAR_LENGTH,
          rampLength: thisRampLength,
        } : undefined,
      };
      trainGroup.add(carMesh);
    }

    trainGroup.position.set(xPos, 0, zPos);

    if (isMoving) {
      trainGroup.userData = {
        type: 'train',
        movingTrain: true,
        trainMotion: {
          speed: THREE.MathUtils.randFloat(12, 16),
          distanceTraveled: 0,
          initialZ: zPos,
        }
      };
    } else {
      trainGroup.userData = { type: 'train' };
    }

    if (train.rooftopCoins) {
      const coinsPerCar = 6;
      for (let i = 0; i < cars; i++) {
        const carOffsetZ = -i * CAR_LENGTH;
        for (let j = 0; j < coinsPerCar; j++) {
          const coinGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16);
          const coinMat = new THREE.MeshStandardMaterial({
            color: 0xffd700, metalness: 0.8, roughness: 0.2,
            emissive: 0xffd700, emissiveIntensity: 0.15,
          });
          const coin = new THREE.Mesh(coinGeo, coinMat);
          coin.rotation.x = Math.PI / 2;
          coin.castShadow = true;
          const coinZ = carOffsetZ - 8 + j * 3.2;
          coin.position.set(0, trainHeight + 1.5, coinZ);
          coin.userData = { type: 'coin', lane: train.lane, value: 10, rotateSpeed: 3, sparklePhase: Math.random() * Math.PI * 2 };

    const glowMat = new THREE.SpriteMaterial({
      map: this._coinGlowTex,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      color: 0xffdd55,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(1.8, 1.8, 1);
          glow.position.y = 0;
          glow.userData = { coinParent: coin };
          coin.add(glow);

          trainGroup.add(coin);
        }
      }
    }

    chunk.add(trainGroup);

    if (isDual) {
      const oppositeLane = train.lane === LANE.LEFT ? LANE.RIGHT : LANE.LEFT;
      const oppX = LaneUtils.laneToWorldX(oppositeLane);
      const oppTrain = { ...train, lane: oppositeLane, x: oppX };
      this._spawnPatternTrain(chunk, oppTrain, chunkZ);
    }
  }

  _spawnPatternCoin(chunk, coin) {
    const geo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0xffd700,
      emissiveIntensity: 0.15,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.castShadow = true;
    mesh.position.set(
      coin.x,
      coin.altitude || 2,
      coin.z
    );
    mesh.userData = {
      type: 'coin',
      lane: coin.lane,
      value: coin.value || 10,
      rotateSpeed: 3,
      sparklePhase: Math.random() * Math.PI * 2,
    };

    const glowMat = new THREE.SpriteMaterial({
      map: this._coinGlowTex,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      color: 0xffdd55,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(3, 3, 1);
    glow.position.y = 0;
    glow.userData = { coinParent: mesh };

    mesh.add(glow);
    chunk.add(mesh);
  }

  update(delta, playerZ, playerLane) {
    this._playerZ = playerZ;
    this.spawnManager.update(delta, 18, playerZ, playerLane);
    this.animateCoins(delta);

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

        this.spawnManager.clearChunkData(chunk);
        this.clearChunkDynamicContent(chunk);

        const newZ = frontZ - this.chunkLength;
        chunk.position.z = newZ;

        const content = this.spawnManager.generateChunkContent(chunk, newZ);
        this.applyContentToChunk(chunk, content, newZ);
      }
    }
  }

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
        if (child.userData && child.userData.type === 'coin' && child.userData.rotateSpeed) {
          child.rotation.z += child.userData.rotateSpeed * delta;
          const phase = child.userData.sparklePhase || 0;
          const sparkle = 0.5 + 0.5 * Math.sin(t * 2.5 + phase);
          if (child.material) {
            child.material.emissiveIntensity = 0.1 + 0.08 * sparkle;
          }
          child.traverse((c) => {
            if (c.isSprite) {
              c.material.opacity = 0.1 + 0.1 * sparkle;
              const s = 1.4 + 0.5 * sparkle;
              c.scale.set(s, s, 1);
            }
          });
        }
      });
    });
  }

  setLampIntensity(v) {
    this._lampTargetIntensity = Math.max(0, Math.min(1, v));
  }

  _updateLamps(delta) {
    const speed = 2;
    if (this._lampCurrentIntensity < this._lampTargetIntensity) {
      this._lampCurrentIntensity = Math.min(this._lampTargetIntensity, this._lampCurrentIntensity + speed * delta);
    } else {
      this._lampCurrentIntensity = Math.max(this._lampTargetIntensity, this._lampCurrentIntensity - speed * delta);
    }

    const intensity = this._lampCurrentIntensity;
    for (const entry of this.lampLights) {
      entry.light.intensity = intensity * 250;
      entry.bulb.material.emissiveIntensity = intensity * entry.emissiveBase;
      entry.bulbGlow.material.opacity = intensity * 0.5;
      entry.glowDisc.material.opacity = intensity * 0.5;
      entry.beamSprite.material.opacity = intensity * 0.25;
    }
  }

  reset() {
    this.spawnManager.reset();
    for (const chunk of this.chunks) {
      this.scene.remove(chunk);
    }
    this.chunks = [];
    this.lampLights = [];
    this._lampTargetIntensity = 0;
    this._lampCurrentIntensity = 0;
    this.initChunks();
  }
}
