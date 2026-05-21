// src/entities/Player.js
import * as THREE from 'three';

export class Player {
    constructor(scene) {
        this.scene = scene;
        this.laneWidth = 3;
        this.currentLane = 1;
        this.previousLane = 1;
        this.targetX = 0;
        
        this.verticalVelocity = 0;
        this.gravity = -45;
        this.jumpForce = 15;
        this.isJumping = false;
        this.isSliding = false;
        this.slideDuration = 0.4;
        this.slideTimer = 0;

        this.geometry = new THREE.BoxGeometry(1, 2, 1);
        this.material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.position.set(0, 1, -5);
        this.scene.add(this.mesh);

        this.forwardSpeed = 18;
        this.returningToLane = false;
        this.returnTimer = 0;
        this.hitCooldown = 0;

        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 15;
        this.currentGroundY = 0;
        this.lastValidGroundY = 0;
        this.groundObjects = [];

        // Dùng để "ân hạn" collision khi vừa rời nóc tàu trong lúc đổi lane (tránh chết oan)
        this.trainGraceTimer = 0;
        this.trainGraceTrainUuid = null;
    }

    moveLeft() {    
        if (this.returningToLane) return;
        if (this.currentLane > 0) {
            this.previousLane = this.currentLane;
            this.currentLane--;
            this.targetX = (this.currentLane - 1) * this.laneWidth;
        }
    }

    moveRight() {
        if (this.returningToLane) return;
        if (this.currentLane < 2) {
            this.previousLane = this.currentLane;
            this.currentLane++;
            this.targetX = (this.currentLane - 1) * this.laneWidth;
        }
    }

    jump() {
        if (this.isSliding) {
            this.isSliding = false; 
            this.slideTimer = 0;
            this.mesh.scale.y = 1; 
            this.mesh.position.y = this.currentGroundY + 1; 
            this.verticalVelocity = 0;
        }
        if (!this.isJumping && !this.returningToLane) {
            this.verticalVelocity = this.jumpForce;
            this.isJumping = true;
        }
    }

    slide() {
        if (this.isJumping) {
            this.isJumping = false;
        }
        if (!this.isSliding && !this.returningToLane) {
            this.isSliding = true;
            this.slideTimer = this.slideDuration;
            this.mesh.scale.y = 0.5;
        }
    }

    onSideHit(hitLane) {
        if (this.returningToLane) return;
        this.returningToLane = true;
        this.returnTimer = 0.4;
        this.hitCooldown = 0.6;
        this.material.transparent = true;
        this.material.opacity = 0.5;
    }

    updateGroundObjects(trackChunks) {
        this.groundObjects = [];
        for (const chunk of trackChunks) {
            // 🔥 Cập nhật world matrix để raycast detect đúng vị trí, đặc biệt cho train động
            chunk.updateWorldMatrix(true, true);
            chunk.traverse((child) => {
                // Bao gồm: mặt đường (isGround), nóc/dốc tàu (isGround), và block đỏ (isWalkable)
                if (child.userData && (child.userData.isGround === true || child.userData.isWalkable === true)) {
                    this.groundObjects.push(child);
                }
            });
        }
    }

    update(delta, trackChunks) {
        if (this.hitCooldown > 0) this.hitCooldown -= delta;
        if (this.trainGraceTimer > 0) this.trainGraceTimer -= delta;

        if (this.returningToLane) {
            this.returnTimer -= delta;
            const oldLaneX = (this.previousLane - 1) * this.laneWidth;
            this.mesh.position.x = THREE.MathUtils.lerp(this.mesh.position.x, oldLaneX, 8 * delta);
            if (this.returnTimer <= 0) {
                this.returningToLane = false;
                this.currentLane = this.previousLane;
                this.targetX = oldLaneX;
                this.material.opacity = 1;
                this.material.transparent = false;
            }
            this.mesh.position.z -= this.forwardSpeed * delta;
            return;
        }

        this.mesh.position.x += (this.targetX - this.mesh.position.x) * 12 * delta;
        this.mesh.position.z -= this.forwardSpeed * delta;

        // Cập nhật danh sách bề mặt có thể đứng (cả ground và walkable)
        this.updateGroundObjects(trackChunks);

        // Raycast từ trên xuống (cao hơn đầu 3 đơn vị)
        this.raycaster.set(
            new THREE.Vector3(this.mesh.position.x, this.mesh.position.y + 3, this.mesh.position.z),
            new THREE.Vector3(0, -1, 0)
        );
        const intersects = this.raycaster.intersectObjects(this.groundObjects, false);
        let foundGround = false;
        let detectedY = 0;
        let closestDist = Infinity;
        let closestObject = null;
        for (const hit of intersects) {
            if (hit.point.y <= this.mesh.position.y + 1 && hit.distance < closestDist) {
                closestDist = hit.distance;
                detectedY = hit.point.y;
                foundGround = true;
                closestObject = hit.object;
            }
        }

        if (foundGround) {
            this.currentGroundY = detectedY;
            this.lastValidGroundY = detectedY;

            // Nếu đang đứng trên tàu, giữ grace timer trong một thời gian ngắn
            if (closestObject?.userData?.walkableProfile?.kind === 'train') {
                this.trainGraceTimer = 0.45;
                this.trainGraceTrainUuid = closestObject.uuid;
            }
        }
        const targetY = this.currentGroundY + 1;

        // Nhảy / rơi
        if (this.isJumping) {
            this.mesh.position.y += this.verticalVelocity * delta;
            this.verticalVelocity += this.gravity * delta;
            if (this.mesh.position.y <= targetY) {
                this.mesh.position.y = targetY;
                this.isJumping = false;
                this.verticalVelocity = 0;
            }
        } else if (!this.isSliding) {
            const diff = targetY - this.mesh.position.y;
            if (Math.abs(diff) < 0.1) {
                this.mesh.position.y = targetY;
            } else {
                const speed = diff > 0 ? 40 : 6;
                this.mesh.position.y += diff * Math.min(1, speed * delta);
            }
        }

        // Trượt
        if (this.isSliding) {
            this.slideTimer -= delta;
            this.mesh.position.y = THREE.MathUtils.lerp(
                this.mesh.position.y,
                this.currentGroundY + 0.5,
                15 * delta
            );
            if (this.slideTimer <= 0) {
                this.isSliding = false;
                this.mesh.scale.y = 1;
                this.mesh.position.y = this.currentGroundY + 1;
                this.verticalVelocity = 0;
            }
        }
    }

    getBoundingBox() {
        return new THREE.Box3().setFromObject(this.mesh);
    }
    
    reset() {
        this.currentLane = 1; 
        this.previousLane = 1; 
        this.targetX = 0;
        this.mesh.position.set(0, 1, -5); 
        this.verticalVelocity = 0;
        this.isJumping = false; 
        this.isSliding = false; 
        this.returningToLane = false; 
        this.hitCooldown = 0;
        this.mesh.scale.y = 1; 
        this.currentGroundY = 0;
        this.lastValidGroundY = 0;
        this.material.opacity = 1; 
        this.material.transparent = false;
        this.groundObjects = [];
        this.trainGraceTimer = 0;
        this.trainGraceTrainUuid = null;
    }
}