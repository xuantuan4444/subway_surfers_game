// src/managers/TrackManager.js
import * as THREE from 'three';

export class TrackManager {
    constructor(scene) {
        this.scene = scene;
        this.chunks = [];
        this.chunkLength = 60;
        this.numChunks = 12;
        this.laneWidth = 3;
        this.recycleThreshold = 170;
        this.initChunks();
    }

    initChunks() {
        for (let i = 0; i < this.numChunks; i++) {
            const chunk = this.createChunk();
            chunk.position.z = -i * this.chunkLength;
            this.scene.add(chunk);
            this.chunks.push(chunk);
        }
    }

    createChunk() {
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
        this.spawnObjectsOnChunk(group);
        return group;
    }

    clearChunkDynamicContent(group) {
        const baseChildCount = group.userData?.baseChildCount ?? 0;
        for (let i = group.children.length - 1; i >= baseChildCount; i--) {
            group.remove(group.children[i]);
        }
    }

    spawnObjectsOnChunk(group) {
        if (Math.random() > 0.65) return;
        const lanes = [0, 1, 2].sort(() => 0.5 - Math.random());
        const numObjects = Math.random() > 0.5 ? 1 : 2;

        for (let i = 0; i < numObjects; i++) {
            const lane = lanes[i];
            const xPos = (lane - 1) * this.laneWidth;
            const zPos = -Math.random() * (this.chunkLength - 10) - 5;
            const type = Math.random();

            if (type < 0.15) {
                this.spawnTrain(group, lane, zPos, false);
            } else if (type < 0.60) {
                this.spawnTrain(group, lane, zPos, true);
            } else {
                const barrierType = Math.random();

                if (barrierType < 0.34) {
                    const uBarrier = new THREE.Group();
                    const uMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.4 });

                    const pillarGeo = new THREE.BoxGeometry(0.3, 1.4, 0.3);
                    const pillarL = new THREE.Mesh(pillarGeo, uMat);
                    pillarL.position.set(-1.1, 0.7, 0);
                    uBarrier.add(pillarL);
                    const pillarR = pillarL.clone();
                    pillarR.position.set(1.1, 0.7, 0);
                    uBarrier.add(pillarR);

                    const boardGeo = new THREE.BoxGeometry(2.5, 2.0, 0.8);
                    const board = new THREE.Mesh(boardGeo, uMat);
                    board.position.set(0, 2.5, 0);
                    board.userData = { type: 'obstacle', lane: lane, requiresSlide: true };
                    uBarrier.add(board);

                    uBarrier.position.set(xPos, 0, zPos);
                    uBarrier.userData = { type: 'obstacle', lane: lane, requiresSlide: true };
                    group.add(uBarrier);
                } else if (barrierType < 0.67) {
                    const dualBarrier = new THREE.Group();
                    const dualMat = new THREE.MeshStandardMaterial({ color: 0x55ccff, roughness: 0.4 });

                    const pillarGeo = new THREE.BoxGeometry(0.3, 1.4, 0.3);
                    const pillarL = new THREE.Mesh(pillarGeo, dualMat);
                    pillarL.position.set(-1.1, 0.7, 0);
                    dualBarrier.add(pillarL);
                    const pillarR = pillarL.clone();
                    pillarR.position.set(1.1, 0.7, 0);
                    dualBarrier.add(pillarR);

                    const boardHeight = 0.8;
                    const boardY = 1.75;
                    const boardGeo = new THREE.BoxGeometry(2.5, boardHeight, 0.8);
                    const board = new THREE.Mesh(boardGeo, dualMat);
                    board.position.set(0, boardY, 0);
                    board.userData = { type: 'obstacle', lane: lane, requiresSlide: true };
                    dualBarrier.add(board);

                    dualBarrier.position.set(xPos, 0, zPos);
                    dualBarrier.userData = { type: 'obstacle', lane: lane, requiresSlide: true };
                    group.add(dualBarrier);
                } else {
                    const barrierWidth = 2.5;
                    const barrierHeight = 1.5;
                    const barrierLength = 1;
                    const barrierGeo = new THREE.BoxGeometry(barrierWidth, barrierHeight, barrierLength);
                    const barrierMat = new THREE.MeshStandardMaterial({ color: 0xff3333 });

                    const barrier = new THREE.Mesh(barrierGeo, barrierMat);
                    barrier.position.set(xPos, barrierHeight / 2, zPos);
                    barrier.userData = { type: 'obstacle', lane: lane, isWalkable: true };
                    group.add(barrier);
                }
            }
        }
    }

    spawnTrain(group, laneIndex, zPos, isMovingTrain = false) {
        const laneX = (laneIndex - 1) * this.laneWidth;
        const trainGroup = new THREE.Group();

        const trainWidth = 2.6;
        const trainHeight = 4;
        const trainLength = 20;
        const rampLength = isMovingTrain ? 0 : 8;

        let trainMesh;
        if (isMovingTrain) {
            const trainGeo = new THREE.BoxGeometry(trainWidth, trainHeight, trainLength);
            trainGeo.translate(0, trainHeight / 2, 0);
            const trainMat = new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.7 });
            trainMesh = new THREE.Mesh(trainGeo, trainMat);
            trainMesh.position.set(laneX, 0, 0);
            trainMesh.userData = {
                type: 'obstacle',
                lane: laneIndex,
                movingTrain: true,
                isGround: true,
                requiresSlide: false,
                walkableProfile: {
                    kind: 'train',
                    trainWidth,
                    trainHeight,
                    trainLength,
                    rampLength: 0
                }
            };
        } else {
            const halfLen = trainLength / 2;
            const rampStartZ = halfLen + rampLength;
            const frontZ = -halfLen;

            const profile = new THREE.Shape();
            profile.moveTo(rampStartZ, 0);
            profile.lineTo(halfLen, trainHeight);
            profile.lineTo(frontZ, trainHeight);
            profile.lineTo(frontZ, 0);
            profile.lineTo(rampStartZ, 0);

            const trainGeo = new THREE.ExtrudeGeometry(profile, {
                depth: trainWidth,
                bevelEnabled: false,
                steps: 1
            });
            trainGeo.translate(0, 0, -trainWidth / 2);
            trainGeo.rotateY(-Math.PI / 2);

            const trainMat = new THREE.MeshStandardMaterial({ color: 0x1a2b4c, roughness: 0.7 });
            trainMesh = new THREE.Mesh(trainGeo, trainMat);
            trainMesh.position.set(laneX, 0, 0);
            trainMesh.userData = {
                type: 'obstacle',
                lane: laneIndex,
                isGround: true,
                walkableProfile: {
                    kind: 'train',
                    trainWidth,
                    trainHeight,
                    trainLength,
                    rampLength
                }
            };
        }
        trainGroup.add(trainMesh);
        trainGroup.position.set(0, 0, zPos);

        if (isMovingTrain) {
            trainGroup.userData = {
                type: 'train',
                movingTrain: true,
                trainMotion: {
                    speed: THREE.MathUtils.randFloat(12, 16),
                    distanceTraveled: 0,
                    initialZ: zPos
                }
            };
        } else {
            trainGroup.userData = { type: 'train' };
        }

        if (!isMovingTrain) {
            for (let j = 0; j < 5; j++) {
                const coinGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16);
                const coinMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2 });
                const coin = new THREE.Mesh(coinGeo, coinMat);
                coin.rotation.x = Math.PI / 2;
                coin.position.set(laneX, trainHeight + 1.5, -6 + j * 2.5);
                coin.userData = { type: 'coin', lane: laneIndex, rotateSpeed: 3 };
                trainGroup.add(coin);
            }
        }

        group.add(trainGroup);
    }

    update(delta, playerZ) {
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

                this.clearChunkDynamicContent(chunk);
                this.spawnObjectsOnChunk(chunk);
                chunk.position.z = frontZ - this.chunkLength;
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

    animateCoins() {
        this.chunks.forEach(chunk => {
            chunk.traverse((child) => {
                if (child.userData && child.userData.type === 'coin' && child.userData.rotateSpeed) {
                    child.rotation.z += child.userData.rotateSpeed * 0.016;
                }
            });
        });
    }
}
