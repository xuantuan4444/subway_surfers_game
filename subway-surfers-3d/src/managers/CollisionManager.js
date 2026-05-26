import * as THREE from 'three';

export class CollisionManager {
    constructor() {
        this.playerBox = new THREE.Box3();
        this._prevPlayerBox = new THREE.Box3();
        this._sweptPlayerBox = new THREE.Box3();
        this.objectBox = new THREE.Box3();
        this._expandedObjectBox = new THREE.Box3();
        this._compositeBox = new THREE.Box3();

        this._tmpVec1 = new THREE.Vector3();
        this._tmpVec2 = new THREE.Vector3();
        this._playerCenter = new THREE.Vector3();
        this._processedTrainGroups = new Set();
        this._hasPrevPlayerBox = false;
    }

    _buildTrainCompositeBox(trainGroup, targetBox) {
        const data = trainGroup.userData;
        const tw = data.trainWidth ?? 2.6;
        const th = data.trainHeight ?? 4;
        const tl = data.trainLength ?? 20;
        const rampLen = data.rampLength ?? 0;
        const cars = data.cars ?? 1;
        const halfCarLen = tl / (cars * 2);

        const groupPos = new THREE.Vector3();
        trainGroup.getWorldPosition(groupPos);

        const minZ = groupPos.z - tl + halfCarLen;
        const maxZ = groupPos.z + halfCarLen + rampLen;

        targetBox.min.set(groupPos.x - tw / 2, groupPos.y, minZ);
        targetBox.max.set(groupPos.x + tw / 2, groupPos.y + th, maxZ);
    }

    reset() {
        this._hasPrevPlayerBox = false;
        this._processedTrainGroups.clear();
    }

    checkCollisions(player, trackChunks) {
        this.playerBox.setFromObject(player.mesh);
        this.playerBox.expandByScalar(-0.1);
        this.playerBox.getCenter(this._playerCenter);

        this._sweptPlayerBox.copy(this.playerBox);
        if (this._hasPrevPlayerBox) {
            this._sweptPlayerBox.union(this._prevPlayerBox);
        }

        const TOP_CONTACT_EPSILON = 0.35;
        const TOP_LANDING_EPSILON = 0.75;
        const FAST_OBSTACLE_Z_BUFFER = 1.4;

        let coinsCollected = 0;
        const collectedPowerUps = [];
        let hitType = null;
        let hitLane = null;

        this._processedTrainGroups.clear();

        outer: for (const chunk of trackChunks) {
            chunk.updateWorldMatrix(true, true);

            const stack = [...chunk.children];
            while (stack.length > 0) {
                const obj = stack.pop();
                if (!obj || !obj.visible) continue;

                if (obj.children && obj.children.length > 0) {
                    for (const child of obj.children) stack.push(child);
                }

                const data = obj.userData;
                if (!data || data.collected) continue;

                const type = data.type;
                if (type !== 'coin' && type !== 'obstacle' && type !== 'powerup') continue;

                this.objectBox.setFromObject(obj);

                // Coin/powerup mở rộng Y range
                if (type === 'coin') {
                    this.objectBox.min.y = -1;
                    this.objectBox.max.y = 6;
                }

                const isTrainPart = data.isTrainPart && obj.parent;
                const testPlayerBox = type === 'obstacle' ? this._sweptPlayerBox : this.playerBox;

                // --- Intersection gate ---
                // Train part: bỏ qua per-car test (gap giữa các toa),
                // dùng composite box thay thế.
                // Non-train: intersection test chuẩn trên per-object AABB.
                if (!isTrainPart) {
                    if (!testPlayerBox.intersectsBox(this.objectBox)) continue;

                    // Coin / powerup
                    if (type === 'coin') {
                        obj.visible = false;
                        data.collected = true;
                        coinsCollected++;
                        continue;
                    }
                    if (type === 'powerup') {
                        obj.visible = false;
                        data.collected = true;
                        collectedPowerUps.push(data.powerUpType);
                        continue;
                    }
                } else {
                    // Train part: use composite box for intersection + classification,
                    // but still evaluate walkable surface on each car individually.
                    const trainGroup = obj.parent;
                    const uuid = trainGroup.uuid;
                    this._expandedObjectBox.copy(this.objectBox);
                    this._expandedObjectBox.expandByVector(this._tmpVec1.set(0.05, 0, FAST_OBSTACLE_Z_BUFFER));
                    if (!this._processedTrainGroups.has(uuid)) {
                        this._processedTrainGroups.add(uuid);
                        this._buildTrainCompositeBox(trainGroup, this._compositeBox);
                        this._compositeBox.expandByVector(this._tmpVec1.set(0.05, 0, FAST_OBSTACLE_Z_BUFFER));
                        if (!testPlayerBox.intersectsBox(this._compositeBox)) continue;
                    }
                    // Per-car skip: player not near this specific car
                    if (!testPlayerBox.intersectsBox(this._expandedObjectBox)) continue;
                }

                // --- type === 'obstacle' (barrier hoặc train part) ---
                if ((data.requiresSlide || data.canSlideUnder) && player.isSliding) {
                    continue;
                }

                const playerBottomY = this.playerBox.min.y;
                const objectTopY = this.objectBox.max.y;
                const isTallObstacle = data.heightClass === 2 || isTrainPart;
                const canClearTallObstacle = player.hasSneakers === true;

                const isSliding = player.isSliding === true;
                const isFalling = isSliding || (player.verticalVelocity ?? 0) <= 0;
                const isJumping = player.isJumping === true;

                // --- Walkable surface check (train roof + ramp) ---
                const profile = data.walkableProfile;
                if (profile && profile.kind === 'train') {
                    const localPos = this._tmpVec1.copy(player.mesh.position);
                    obj.worldToLocal(localPos);

                    const isChangingLane =
                        typeof player.targetX === 'number' &&
                        Math.abs(player.targetX - player.mesh.position.x) > 0.05;

                    const isOnTrain = (player.trainGraceTimer ?? 0) > 0;

                    if (isChangingLane && isOnTrain) {
                        continue;
                    }

                    const isGraceTrain =
                        isOnTrain &&
                        player.trainGraceTrainUuid === obj.uuid;

                    const halfWidth = (profile.trainWidth ?? 0) / 2;
                    const withinWidth = Math.abs(localPos.x) <= (halfWidth + 0.55);

                    const halfLen = (profile.trainLength ?? 0) / 2;
                    const rampLen = profile.rampLength ?? 0;
                    const height = profile.trainHeight ?? 0;
                    const hasRamp = rampLen > 0;

                    if (isGraceTrain) {
                        if (isChangingLane && localPos.z >= -halfLen && localPos.z <= halfLen + rampLen) {
                            continue;
                        }
                        if (localPos.z < -halfLen) {
                            continue;
                        }
                    }

                    if (withinWidth) {
                        let surfaceYLocal = null;
                        const z = localPos.z;
                        const rampEntryPadding = Math.max(1.8, (player.forwardSpeed ?? 18) * 0.06);
                        const inRampCorridor = hasRamp &&
                            z >= halfLen - 1.25 &&
                            z <= halfLen + rampLen + rampEntryPadding;
                        const canStandOnTrain = canClearTallObstacle || hasRamp;

                        if (z >= -halfLen && z <= halfLen) {
                            surfaceYLocal = height;
                        } else if (hasRamp && z > halfLen && z <= halfLen + rampLen + rampEntryPadding) {
                            const rampZ = Math.min(z, halfLen + rampLen);
                            surfaceYLocal = ((halfLen + rampLen - rampZ) / rampLen) * height;
                        }

                        if (surfaceYLocal !== null) {
                            const bottomWorldPoint = this._tmpVec2.set(
                                player.mesh.position.x,
                                playerBottomY,
                                player.mesh.position.z
                            );
                            obj.worldToLocal(bottomWorldPoint);
                            const playerBottomLocalY = bottomWorldPoint.y;

                            if (canStandOnTrain && playerBottomLocalY >= surfaceYLocal - TOP_CONTACT_EPSILON) {
                                continue;
                            }
                            if (canStandOnTrain && (isFalling || isJumping) && playerBottomLocalY >= surfaceYLocal - TOP_LANDING_EPSILON) {
                                continue;
                            }
                            if (inRampCorridor && playerBottomLocalY >= surfaceYLocal - 1.75) {
                                continue;
                            }
                        }
                    }
                }

                // Player đang ở trên nóc → an toàn
                if ((!isTallObstacle || canClearTallObstacle) && playerBottomY >= objectTopY - TOP_CONTACT_EPSILON) {
                    continue;
                }

                if ((!isTallObstacle || canClearTallObstacle) && (isFalling || isJumping) && playerBottomY >= objectTopY - TOP_LANDING_EPSILON) {
                    continue;
                }

                // Composite box chỉ dùng để bắt va chạm không lọt giữa các toa.
                // Phân loại front/side của train/truck phải dùng hitbox toa thật,
                // nếu không va hông dọc thân xe dễ bị tính nhầm là va trực diện.
                const hitBox = this.objectBox;
                const overlapPlayerBox = type === 'obstacle' ? testPlayerBox : this.playerBox;
                const lateralPlayerBox = isTrainPart ? this.playerBox : overlapPlayerBox;

                // --- Overlap ---
                const xOverlap = Math.min(lateralPlayerBox.max.x, hitBox.max.x) -
                                 Math.max(lateralPlayerBox.min.x, hitBox.min.x);
                const zOverlap = Math.min(overlapPlayerBox.max.z, hitBox.max.z) -
                                 Math.max(overlapPlayerBox.min.z, hitBox.min.z);
                const playerWidth = this.playerBox.max.x - this.playerBox.min.x;
                const playerLength = this.playerBox.max.z - this.playerBox.min.z;
                if (xOverlap <= 0 || zOverlap <= 0) continue;

                // --- Classification ---
                let isFrontal;
                if (isTrainPart) {
                    const lateralCoverage = xOverlap / Math.max(playerWidth, 0.001);
                    const hitCenterX = (hitBox.min.x + hitBox.max.x) * 0.5;
                    const trainHalfWidth = (hitBox.max.x - hitBox.min.x) * 0.5;
                    const playerInTrainCore = Math.abs(this._playerCenter.x - hitCenterX) <= trainHalfWidth - 0.35;
                    const actualZOverlap = Math.min(this.playerBox.max.z, hitBox.max.z) -
                                           Math.max(this.playerBox.min.z, hitBox.min.z);
                    const zIsShallow = actualZOverlap > 0 && actualZOverlap <= Math.max(0.45, xOverlap * 0.9);
                    const nearFrontOrBackFace = Math.min(
                        Math.abs(this._playerCenter.z - hitBox.min.z),
                        Math.abs(this._playerCenter.z - hitBox.max.z)
                    ) <= playerLength * 1.1;
                    const crossedFrontOrBackFace = this._hasPrevPlayerBox && (
                        (this._prevPlayerBox.min.z >= hitBox.max.z && this.playerBox.min.z <= hitBox.max.z) ||
                        (this._prevPlayerBox.max.z <= hitBox.min.z && this.playerBox.max.z >= hitBox.min.z) ||
                        (this._prevPlayerBox.max.z <= hitBox.max.z && this.playerBox.max.z >= hitBox.max.z) ||
                        (this._prevPlayerBox.min.z >= hitBox.min.z && this.playerBox.min.z <= hitBox.min.z)
                    );

                    // Train/truck chỉ chết ngay khi đâm vào mặt trước/sau.
                    // Va hông có độ xuyên X nông hơn và/hoặc trượt dọc thân xe, nên trả về side-hit.
                    isFrontal = playerInTrainCore &&
                        lateralCoverage >= 0.6 &&
                        (crossedFrontOrBackFace || zIsShallow || nearFrontOrBackFace);
                } else {
                    // Barrier / obstacle thường: dùng logic gốc
                    isFrontal = xOverlap > playerWidth * 0.5 ||
                               (zOverlap < playerLength * 0.5 && zOverlap < xOverlap);
                }

                hitType = isFrontal ? 'front' : 'side';
                hitLane = data.lane ?? null;
                break outer;
            }
        }

        this._prevPlayerBox.copy(this.playerBox);
        this._hasPrevPlayerBox = true;
        return { coinsCollected, collectedPowerUps, hitType, hitLane };
    }
}
