import * as THREE from 'three';
import { SPEED_CONFIG } from '../constants.js';
import { ModelManager } from '../utils/ModelManager.js';

export class Player {
    constructor(scene, audio = null) {
        this.scene = scene;
        this.audio = audio;
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
        this.slideScale = 1;

        this.mesh = new THREE.Group();

        const model = ModelManager.get('Player');
        if (model) {
            model.rotation.y = Math.PI;

            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            this.mesh.add(model);
            this._model = model;

            this.mesh.updateMatrixWorld(true, true);
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const minY = box.min.y;
            console.log(`[Player] Actual AABB: ${size.x.toFixed(3)} x ${size.y.toFixed(3)} x ${size.z.toFixed(3)}  minY=${minY.toFixed(3)}`);

            const targetHeight = 2;
            const scale = targetHeight / Math.max(size.y, 0.01);
            model.scale.set(scale, scale, scale);
            model.position.y = -minY * scale;

            const animations = ModelManager.getAnimations('Player');
            if (animations.length > 0) {
                this.mixer = new THREE.AnimationMixer(model);
                const action = this.mixer.clipAction(animations[0]);
                action.play();
            } else {
                this.mixer = null;
            }
        } else {
            const geometry = new THREE.BoxGeometry(1, 2, 1);
            const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
            const fallback = new THREE.Mesh(geometry, material);
            fallback.position.y = 1;
            fallback.castShadow = true;
            fallback.receiveShadow = true;
            this.mesh.add(fallback);
            this._model = fallback;
            this.mixer = null;
        }

        this.mesh.position.set(0, 0, -5); 
        this.scene.add(this.mesh);

        const proxyGeo = new THREE.BoxGeometry(1, 2, 1);
        const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
        this._collisionProxy = new THREE.Mesh(proxyGeo, proxyMat);
        this._collisionProxy.position.y = 1;
        this.mesh.add(this._collisionProxy);

        this.forwardSpeed = 18;
        this.returningToLane = false;
        this.returnTimer = 0;
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 15;
        this.currentGroundY = 0;
        this.lastValidGroundY = 0;
        this.groundObjects = [];

        this.trainGraceTimer = 0;
        this.trainGraceTrainUuid = null;
        this._wasOnTrainBeforeJump = false;

        this.footstepTimer = 0;
        this.footstepInterval = 0.35;
        this.isGrounded = true;
        this.hasSneakers = false;
        this._wasInAir = false;
    }

    _setOpacity(opacity) {
        if (this._model) {
            this._model.traverse((child) => {
                if (child.isMesh) {
                    child.material.transparent = opacity < 1;
                    child.material.opacity = opacity;
                }
            });
        }
    }

    moveLeft() {    
        if (this.returningToLane) return;
        if (this.currentLane > 0) {
            this.previousLane = this.currentLane;
            this.currentLane--;
            this.targetX = (this.currentLane - 1) * this.laneWidth;
            if (this.audio) this.audio.playRandom('swipe');
        }
    }

    moveRight() {
        if (this.returningToLane) return;
        if (this.currentLane < 2) {
            this.previousLane = this.currentLane;
            this.currentLane++;
            this.targetX = (this.currentLane - 1) * this.laneWidth;
            if (this.audio) this.audio.playRandom('swipe');
        }
    }

    jump() {
        if (this.isSliding) {
            this.isSliding = false; 
            this.slideTimer = 0;
            this.slideScale = 1;
            this.mesh.position.y = this.currentGroundY; 
            this.verticalVelocity = 0;
        }
        const atGroundLevel = Math.abs(this.mesh.position.y - this.currentGroundY) < 0.3;
        if (atGroundLevel && this.isGrounded && !this.isJumping && !this.returningToLane) {
            this._wasOnTrainBeforeJump = this.trainGraceTimer > 0;
            this.verticalVelocity = this.jumpForce;
            this.isJumping = true;
            if (this.audio) this.audio.playRandom('swipe');
        }
    }

    slide() {
        if (this.isJumping) {
            this.isJumping = false;
        }
        if (!this.isSliding && !this.returningToLane) {
            this.isSliding = true;
            this.slideTimer = this.slideDuration;
            this.slideScale = 0.5;
            if (this.audio) this.audio.playRandom('swipe');
        }
    }

    setForwardSpeed(speed) {
        this.forwardSpeed = speed;
    }

    onSideHit(hitLane) {
        if (this.returningToLane) return;
        this.returningToLane = true;
        this.returnTimer = 0.4;
        this._setOpacity(0.5);
    }

    updateGroundObjects(trackChunks) {
        this.groundObjects = [];
        for (const chunk of trackChunks) {
            chunk.updateWorldMatrix(true, true);
            chunk.traverse((child) => {
                if (child.userData && (child.userData.isGround === true || child.userData.isWalkable === true)) {
                    this.groundObjects.push(child);
                }
            });
        }
    }

    update(delta, trackChunks) {
        if (this.mixer) this.mixer.update(delta);

        if (this.trainGraceTimer > 0) this.trainGraceTimer -= delta;

        if (this.returningToLane) {
            this.returnTimer -= delta;
            const oldLaneX = (this.previousLane - 1) * this.laneWidth;
            this.mesh.position.x = THREE.MathUtils.lerp(this.mesh.position.x, oldLaneX, 8 * delta);
            if (this.returnTimer <= 0) {
                this.returningToLane = false;
                this.currentLane = this.previousLane;
                this.targetX = oldLaneX;
                this._setOpacity(1);
            }
            this.mesh.position.z -= this.forwardSpeed * delta;
            return;
        }

        this.mesh.position.x += (this.targetX - this.mesh.position.x) * 12 * delta;
        this.mesh.position.z -= this.forwardSpeed * delta;

        this.updateGroundObjects(trackChunks);

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
                if (this.isJumping && !this._wasOnTrainBeforeJump && !this.hasSneakers) {
                    const profile = hit.object?.userData?.walkableProfile;
                    if (profile?.kind === 'train') {
                        const onFlatRoof = profile.rampLength <= 0 ||
                            hit.point.y >= (profile.trainHeight ?? 4) - 0.1;
                        if (onFlatRoof) continue;
                    }
                }
                closestDist = hit.distance;
                detectedY = hit.point.y;
                foundGround = true;
                closestObject = hit.object;
            }
        }

        this.isGrounded = foundGround;

        if (foundGround) {
            this.currentGroundY = detectedY;
            this.lastValidGroundY = detectedY;

            if (closestObject?.userData?.walkableProfile?.kind === 'train') {
                this.trainGraceTimer = 0.45;
                this.trainGraceTrainUuid = closestObject.uuid;
            }
        }
        const targetY = this.currentGroundY;

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

        const isOnGround = Math.abs(this.mesh.position.y - targetY) < 0.1 && !this.isJumping;
        if (this._wasInAir && isOnGround) {
            const onTrain = closestObject?.userData?.walkableProfile?.kind === 'train';
            if (this.audio) this.audio.play(onTrain ? 'trainLanding' : 'landing', { volume: onTrain ? 0.4 : 0.25 });
        }
        this._wasInAir = !isOnGround;

        if (this.isSliding) {
            this.slideTimer -= delta;
            this.mesh.position.y = THREE.MathUtils.lerp(
                this.mesh.position.y,
                this.currentGroundY,
                15 * delta
            );
            if (this.slideTimer <= 0) {
                this.isSliding = false;
                this.slideScale = 1;
                this.mesh.position.y = this.currentGroundY;
                this.verticalVelocity = 0;
            }
        }

        if (this.audio && !this.isJumping && !this.isSliding && foundGround) {
            this.footstepTimer -= delta;
            if (this.footstepTimer <= 0) {
                this.audio.playRandom('step', { volume: 0.2 });
                this.footstepTimer = this.footstepInterval;
            }
        } else {
            this.footstepTimer = 0;
        }
    }

    getBoundingBox() {
        return new THREE.Box3().setFromCenterAndSize(
            this.mesh.position,
            new THREE.Vector3(1, 2, 1)
        );
    }
    
    reset() {
        this.currentLane = 1; 
        this.previousLane = 1; 
        this.targetX = 0;
        this.mesh.position.set(0, 0, -5);
        this.verticalVelocity = 0;
        this.isJumping = false; 
        this.isSliding = false; 
        this.returningToLane = false; 
        this.mesh.scale.y = 1;
        this.slideScale = 1;
        this.currentGroundY = 0;
        this.lastValidGroundY = 0;
        this._setOpacity(1);
        this.groundObjects = [];
        this.trainGraceTimer = 0;
        this.trainGraceTrainUuid = null;
        this._wasOnTrainBeforeJump = false;
        this.footstepTimer = 0;
        this.isGrounded = true;
        this.hasSneakers = false;
        this._wasInAir = false;
        this.forwardSpeed = SPEED_CONFIG.BASE_SPEED;
        this.jumpForce = 15;
        this.gravity = -45;
    }
}
