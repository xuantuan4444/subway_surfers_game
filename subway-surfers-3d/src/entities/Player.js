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
        this.gravity = -30;
        this.jumpForce = 12;
        this.isJumping = false;
        this.isSliding = false;
        this.slideDuration = 0.8;
        this.slideTimer = 0;

        this.geometry = new THREE.BoxGeometry(1, 2, 1);
        this.material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.position.set(0, 1, 0);
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
            this.verticalVelocity = -25;
        }
        if (!this.isSliding && !this.returningToLane) {
            this.isSliding = true;
            this.slideTimer = this.slideDuration;
            this.mesh.scale.y = 0.5;
        }
    }

    onSideHit() {
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
            chunk.traverse((child) => {
                if (child.userData && child.userData.isGround === true) {
                    this.groundObjects.push(child);
                }
            });
        }
    }

    update(delta, trackChunks) {
        if (this.hitCooldown > 0) this.hitCooldown -= delta;

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

        this.updateGroundObjects(trackChunks);

        // 🔥 RAYCAST: Nguồn tia cao hơn, hướng xuống
        this.raycaster.set(
            new THREE.Vector3(this.mesh.position.x, this.mesh.position.y + 3, this.mesh.position.z),
            new THREE.Vector3(0, -1, 0)
        );
        
        const intersects = this.raycaster.intersectObjects(this.groundObjects, false);
        
        let foundGround = false;
        let detectedY = 0;

        // Lọc kết quả hợp lệ
        for (const hit of intersects) {
            if (hit.object.userData.isGround === true) {
                // Chỉ chấp nhận ground nằm dưới player (có buffer 1 unit)
                if (hit.point.y <= this.mesh.position.y + 1) {
                    detectedY = hit.point.y;
                    foundGround = true;
                    break;
                }
            }
        }

        // 🔥 CẬP NHẬT GROUND Y VỚI CƠ CHẾ CHỐNG RƠI
        if (foundGround) {
            this.currentGroundY = detectedY;
            this.lastValidGroundY = detectedY;
        }
        // Nếu miss ray: giữ nguyên currentGroundY (KHÔNG set về 0)

        const targetY = this.currentGroundY + 1;

        if (this.isJumping) {
            this.mesh.position.y += this.verticalVelocity * delta;
            this.verticalVelocity += this.gravity * delta;
            if (this.mesh.position.y <= targetY) {
                this.mesh.position.y = targetY;
                this.isJumping = false;
                this.verticalVelocity = 0;
            }
        } else {
            // 🔥 SNAP CỨNG khi gần mặt đất (< 0.4 units)
            const diff = targetY - this.mesh.position.y;
            if (Math.abs(diff) < 0.4) {
                this.mesh.position.y = targetY;
            } else {
                this.mesh.position.y += diff * Math.min(1, 20 * delta);
            }
        }

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
        this.mesh.position.set(0, 1, 0); 
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
    }
}