import * as THREE from 'three';
import { LANE, OBSTACLE, CHUNK } from '../constants.js';
import { LaneUtils } from '../utils/LaneUtils.js';
import { SpawnManager } from './SpawnManager.js';

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
    group.add(wallL);
    const wallR = new THREE.Mesh(wallGeo, wallMat);
    wallR.position.set(6.25, 1, 0);
    group.add(wallR);

    group.userData.baseChildCount = group.children.length;
    return group;
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
    barrierGroup.add(pillarL);
    const pillarR = pillarL.clone();
    pillarR.position.set(1.1, 0.7, 0);
    barrierGroup.add(pillarR);

    const boardGeo = new THREE.BoxGeometry(2.5, 2.0, 0.8);
    const boardMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.4 });
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.set(0, 2.5, 0);
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
            color: 0xffd700, metalness: 0.8, roughness: 0.2
          });
          const coin = new THREE.Mesh(coinGeo, coinMat);
          coin.rotation.x = Math.PI / 2;
          const coinZ = carOffsetZ - 8 + j * 3.2;
          coin.position.set(0, trainHeight + 1.5, coinZ);
          coin.userData = { type: 'coin', lane: train.lane, value: 10, rotateSpeed: 3 };
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
      roughness: 0.2
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(
      coin.x,
      coin.altitude || 2,
      coin.z
    );
    mesh.userData = {
      type: 'coin',
      lane: coin.lane,
      value: coin.value || 10,
      rotateSpeed: 3
    };
    chunk.add(mesh);
  }

  update(delta, playerZ, playerLane) {
    this._playerZ = playerZ;
    this.spawnManager.update(delta, 18, playerZ, playerLane);
    this.animateCoins(delta);

    this.animateTrains(delta);

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
    this.chunks.forEach(chunk => {
      chunk.traverse((child) => {
        if (child.userData && child.userData.type === 'coin' && child.userData.rotateSpeed) {
          child.rotation.z += child.userData.rotateSpeed * delta;
        }
      });
    });
  }

  reset() {
    this.spawnManager.reset();
    for (const chunk of this.chunks) {
      this.scene.remove(chunk);
    }
    this.chunks = [];
    this.initChunks();
  }
}
