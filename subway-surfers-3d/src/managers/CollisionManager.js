// src/managers/CollisionManager.js
import * as THREE from 'three';

export class CollisionManager {
    constructor() {
        this.playerBox = new THREE.Box3();
        this.objectBox = new THREE.Box3();

        this._tmpVec1 = new THREE.Vector3();
        this._tmpVec2 = new THREE.Vector3();
    }

    checkCollisions(player, trackChunks) {
        if (player.hitCooldown > 0) {
            return { coinsCollected: 0, hitType: null, hitLane: null };
        }

        this.playerBox.setFromObject(player.mesh);
        this.playerBox.expandByScalar(-0.15);

        const TOP_CONTACT_EPSILON = 0.35;
        const TOP_LANDING_EPSILON = 0.75;

        let coinsCollected = 0;
        let hitType = null;
        let hitLane = null;

        outer: for (const chunk of trackChunks) {
            if (Math.abs(chunk.position.z - player.mesh.position.z) > 40) continue;

            // Đảm bảo matrixWorld của chunk & con được cập nhật trước khi tính Box3/worldToLocal
            chunk.updateWorldMatrix(true, true);

            // Duyệt sâu để bắt cả các object nằm trong Group (vd: trainGroup)
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
                // Chỉ check collider & coin. Các mặt đất (train_ramp/train_top/obstacle_ramp...) được raycast xử lý.
                if (type !== 'coin' && type !== 'obstacle') continue;

                this.objectBox.setFromObject(obj);
                if (!this.playerBox.intersectsBox(this.objectBox)) continue;

                if (type === 'coin') {
                    obj.visible = false;
                    data.collected = true;
                    coinsCollected++;
                    continue;
                }

                // type === 'obstacle'
                const playerBottomY = this.playerBox.min.y;
                const objectTopY = this.objectBox.max.y;

                const isFalling = (player.verticalVelocity ?? 0) <= 0;
                const isJumping = player.isJumping === true;

                // --- Walkable surface check (train ramp + roof) ---
                const profile = data.walkableProfile;
                if (profile && profile.kind === 'train') {
                    // Convert player position to obstacle local space (supports future scaling/models)
                    const localPos = this._tmpVec1.copy(player.mesh.position);
                    obj.worldToLocal(localPos);

                    const isChangingLane =
                        typeof player.targetX === 'number' &&
                        Math.abs(player.targetX - player.mesh.position.x) > 0.05;

                    const isGraceTrain =
                        (player.trainGraceTimer ?? 0) > 0 &&
                        player.trainGraceTrainUuid === obj.uuid;

                    // Only treat as "standing on" when player is reasonably inside the train width
                    const halfWidth = (profile.trainWidth ?? 0) / 2;
                    const lateralMargin = 0.25;
                    const withinWidth = Math.abs(localPos.x) <= (halfWidth - lateralMargin);

                    const halfLen = (profile.trainLength ?? 0) / 2;
                    const rampLen = profile.rampLength ?? 0;
                    const height = profile.trainHeight ?? 0;

                    // 1) Đổi lane trên nóc tàu: bỏ qua va chạm để player rớt xuống tự nhiên
                    // 2) Đi hết tàu (qua mép trước -Z): vẫn còn AABB overlap trong 1-2 frame => bỏ qua để không chết oan
                    if (isGraceTrain) {
                        if (isChangingLane && localPos.z >= -halfLen && localPos.z <= halfLen) {
                            continue;
                        }
                        if (localPos.z < -halfLen) {
                            continue;
                        }
                    }

                    if (withinWidth) {
                        let surfaceYLocal = null;
                        // Clamp z vào phạm vi có geometry để tránh case AABB chạm ramp trước khi tâm player vào ramp
                        const minZ = -halfLen;
                        const maxZ = halfLen + rampLen;
                        const z = Math.min(Math.max(localPos.z, minZ), maxZ);

                        if (z >= -halfLen && z <= halfLen) {
                            surfaceYLocal = height;
                        } else if (z > halfLen && z <= halfLen + rampLen && rampLen > 0) {
                            // Ramp is on the +Z side: y goes 0 -> height when z goes (halfLen + rampLen) -> halfLen
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

                // Nếu player đang ở trên nóc -> an toàn
                if (playerBottomY >= objectTopY - TOP_CONTACT_EPSILON) {
                    continue;
                }

                // Cho phép tiếp đất lên nóc khi đang rơi xuống (tránh bị tính là đâm khi nhảy lên barrier)
                if ((isFalling || isJumping) && playerBottomY >= objectTopY - TOP_LANDING_EPSILON) {
                    continue;
                }

                // Va chạm thật (đâm vào thân)
                const xOverlap = Math.min(this.playerBox.max.x, this.objectBox.max.x) -
                                 Math.max(this.playerBox.min.x, this.objectBox.min.x);
                const zOverlap = Math.min(this.playerBox.max.z, this.objectBox.max.z) -
                                 Math.max(this.playerBox.min.z, this.objectBox.min.z);
                // Phân loại chuẩn hơn: overlap theo hướng tiến (Z) nhỏ -> đâm trực diện; ngược lại -> quệt hông
                hitType = (zOverlap < xOverlap) ? 'front' : 'side';
                hitLane = data.lane ?? null;
                break outer;
            }
        }

        return { coinsCollected, hitType, hitLane };
    }
}