import * as THREE from 'three';

export class CollisionManager {
    constructor() {
        this.playerBox = new THREE.Box3();
        this.objectBox = new THREE.Box3();
        this._compositeBox = new THREE.Box3();

        this._tmpVec1 = new THREE.Vector3();
        this._tmpVec2 = new THREE.Vector3();
        this._processedTrainGroups = new Set();
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

    checkCollisions(player, trackChunks) {
        this.playerBox.setFromObject(player.mesh);
        this.playerBox.expandByScalar(-0.15);

        const TOP_CONTACT_EPSILON = 0.35;
        const TOP_LANDING_EPSILON = 0.75;

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

                // --- Intersection gate ---
                // Train part: bỏ qua per-car test (gap giữa các toa),
                // dùng composite box thay thế.
                // Non-train: intersection test chuẩn trên per-object AABB.
                if (!isTrainPart) {
                    if (!this.playerBox.intersectsBox(this.objectBox)) continue;

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
                    if (!this._processedTrainGroups.has(uuid)) {
                        this._processedTrainGroups.add(uuid);
                        this._buildTrainCompositeBox(trainGroup, this._compositeBox);
                        if (!this.playerBox.intersectsBox(this._compositeBox)) continue;
                    }
                    // Per-car skip: player not near this specific car
                    if (!this.playerBox.intersectsBox(this.objectBox)) continue;
                }

                // --- type === 'obstacle' (barrier hoặc train part) ---
                if (data.requiresSlide && player.isSliding) {
                    continue;
                }

                const playerBottomY = this.playerBox.min.y;
                const objectTopY = this.objectBox.max.y;

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
                    const lateralMargin = 0.25;
                    const withinWidth = Math.abs(localPos.x) <= (halfWidth - lateralMargin);

                    const halfLen = (profile.trainLength ?? 0) / 2;
                    const rampLen = profile.rampLength ?? 0;
                    const height = profile.trainHeight ?? 0;

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
                        const minZ = -halfLen;
                        const maxZ = halfLen + rampLen;
                        const z = Math.min(Math.max(localPos.z, minZ), maxZ);

                        if (z >= -halfLen && z <= halfLen) {
                            surfaceYLocal = height;
                        } else if (z > halfLen && z <= halfLen + rampLen && rampLen > 0) {
                            surfaceYLocal = ((halfLen + rampLen - z) / rampLen) * height;
                        }

                        if (surfaceYLocal !== null) {
                            const bottomWorldPoint = this._tmpVec2.set(
                                player.mesh.position.x,
                                playerBottomY,
                                player.mesh.position.z
                            );
                            obj.worldToLocal(bottomWorldPoint);
                            const playerBottomLocalY = bottomWorldPoint.y;

                            if (playerBottomLocalY >= surfaceYLocal - TOP_CONTACT_EPSILON) {
                                continue;
                            }
                            if ((isFalling || isJumping) && playerBottomLocalY >= surfaceYLocal - TOP_LANDING_EPSILON) {
                                continue;
                            }
                        }
                    }
                }

                // Player đang ở trên nóc → an toàn
                if (playerBottomY >= objectTopY - TOP_CONTACT_EPSILON) {
                    continue;
                }

                if ((isFalling || isJumping) && playerBottomY >= objectTopY - TOP_LANDING_EPSILON) {
                    continue;
                }

                // --- Chọn hitbox cho overlap computation ---
                const hitBox = isTrainPart ? this._compositeBox : this.objectBox;

                // --- Overlap ---
                const xOverlap = Math.min(this.playerBox.max.x, hitBox.max.x) -
                                 Math.max(this.playerBox.min.x, hitBox.min.x);
                const zOverlap = Math.min(this.playerBox.max.z, hitBox.max.z) -
                                 Math.max(this.playerBox.min.z, hitBox.min.z);
                const playerWidth = this.playerBox.max.x - this.playerBox.min.x;
                const playerLength = this.playerBox.max.z - this.playerBox.min.z;
                if (xOverlap <= 0 || zOverlap <= 0) continue;

                // --- Classification ---
                let isFrontal;
                if (isTrainPart) {
                    // Composite box: zOverlap phản ánh đúng độ xuyên Z (≈ playerLength).
                    // FRONT chỉ khi Z xuyên < X xuyên (player ở rìa trước tàu).
                    // SIDE khi Z xuyên >= X xuyên (player chạy dọc hông tàu).
                    isFrontal = zOverlap < xOverlap;
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

        return { coinsCollected, collectedPowerUps, hitType, hitLane };
    }
}
