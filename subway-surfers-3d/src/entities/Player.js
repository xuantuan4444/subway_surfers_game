import * as THREE from 'three';
import { SPEED_CONFIG } from '../constants.js';
import { ModelManager } from '../utils/ModelManager.js';

const ANIMS = {
    STAND: 'player_stand',
    RUN: 'player_run',
    JUMP: 'player_jump',
    FALL: 'player_fall',
    LAND: 'player_land',
    SLIDE: 'player_slide',
    DIE: 'player_die',
};

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
        this._visual = new THREE.Group();
        this.scene.add(this._visual);

        const model = ModelManager.get('Player');
        if (model) {
            model.rotation.y = Math.PI;

            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            this._visual.add(model);
            this._model = model;

            this.mesh.updateMatrixWorld(true, true);
            model.updateMatrixWorld(true, true);
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const minY = box.min.y;
            console.log(`[Player] Actual AABB: ${size.x.toFixed(3)} x ${size.y.toFixed(3)} x ${size.z.toFixed(3)}  minY=${minY.toFixed(3)}`);

            const targetHeight = 2;
            const scale = (targetHeight / Math.max(size.y, 0.01)) * 1.75;
            model.scale.set(scale, scale, scale);
            model.position.y = -minY * scale;

            this._initAnimations();
        } else {
            const geometry = new THREE.BoxGeometry(1, 2, 1);
            const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
            const fallback = new THREE.Mesh(geometry, material);
            fallback.position.y = 1;
            fallback.castShadow = true;
            fallback.receiveShadow = true;
            this._visual.add(fallback);
            this._model = fallback;
            this.mixer = null;
            this._animations = {};
            this._currentAnimAction = null;
            this._animState = null;
        }

        this.mesh.position.set(0, 0, -5);
        this._visual.position.set(0, 0, -5);
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
        this._groundRayOrigin = new THREE.Vector3();
        this.currentGroundY = 0;
        this.lastValidGroundY = 0;
        this.groundObjects = [];

        this.trainGraceTimer = 0;
        this.trainGraceTrainUuid = null;
        this._wasOnTrainBeforeJump = false;
        this._currentPlatform = null;

        this.footstepTimer = 0;
        this.footstepInterval = 0.35;
        this.isGrounded = true;
        this.hasSneakers = false;
        this._wasInAir = false;

        this._playingLandAnim = false;
        this._isDying = false;
    }

    _getPlatformMotion(object) {
        if (!object?.userData?.walkableProfile) return null;
        const motion = object.parent?.userData?.trainMotion;
        if (!motion) return null;
        return motion;
    }

    _initAnimations() {
        const animations = ModelManager.getAnimations('Player');
        if (animations.length === 0) {
            this.mixer = null;
            this._animations = {};
            this._currentAnimAction = null;
            this._animState = null;
            return;
        }

        this.mixer = new THREE.AnimationMixer(this._model);
        this._animations = {};

        for (const clip of animations) {
            if (Object.values(ANIMS).includes(clip.name)) {
                this._animations[clip.name] = this.mixer.clipAction(clip);
            }
        }

        const landAction = this._animations[ANIMS.LAND];
        if (landAction) {
            landAction.loop = THREE.LoopOnce;
            landAction.clampWhenFinished = true;
        }

        const dieAction = this._animations[ANIMS.DIE];
        if (dieAction) {
            dieAction.loop = THREE.LoopOnce;
            dieAction.clampWhenFinished = true;
        }

        this.mixer.addEventListener('finished', (e) => {
            if (e.action === this._animations[ANIMS.LAND] && this._animState === ANIMS.LAND) {
                this._playingLandAnim = false;
                this._animState = null;
                this._playAnim(ANIMS.RUN, 0.15);
            }
        });

        this._currentAnimAction = null;
        this._animState = null;

        const runAction = this._animations[ANIMS.RUN];
        if (runAction) {
            this._currentAnimAction = runAction;
            runAction.play();
            this._animState = ANIMS.RUN;
        }
    }

    _playAnim(name, fadeDuration = 0.15) {
        const newAction = this._animations[name];
        if (!newAction) return;
        if (newAction === this._currentAnimAction && newAction.isRunning()) return;

        this._playingLandAnim = false;
        this._isDying = false;

        if (this._currentAnimAction) {
            this._currentAnimAction.fadeOut(fadeDuration);
        }
        newAction.reset().fadeIn(fadeDuration).play();
        this._currentAnimAction = newAction;
        this._animState = name;
    }

    _updateAnimState(isOnGround) {
        if (this._isDying) {
            if (this._animState !== ANIMS.DIE) {
                this._playAnim(ANIMS.DIE, 0.2);
            }
            return;
        }

        if (this._playingLandAnim && this._animState === ANIMS.LAND) {
            return;
        }

        let desiredAnim = ANIMS.RUN;

        if (this.isSliding) {
            desiredAnim = ANIMS.SLIDE;
        } else if (this.isJumping) {
            desiredAnim = this.verticalVelocity > 0 ? ANIMS.JUMP : ANIMS.FALL;
        } else if (!isOnGround && !this.isJumping) {
            desiredAnim = ANIMS.FALL;
        } else if (this._wasInAir && isOnGround) {
            this._playingLandAnim = true;
            desiredAnim = ANIMS.LAND;
        }

        if (desiredAnim !== this._animState) {
            this._playAnim(desiredAnim);
        }
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

    freezeAnimation() {
        if (this._currentAnimAction) this._currentAnimAction.stop();
    }

    resumeAnimation() {
        this._playingLandAnim = false;
        this._isDying = false;
        this._playAnim(ANIMS.RUN, 0.15);
    }

    playStandAnimation() {
        this._playingLandAnim = false;
        this._isDying = false;
        this._playAnim(ANIMS.STAND, 0.15);
    }

    die() {
        this._isDying = true;
        this._playAnim(ANIMS.DIE, 0.2);
    }

    get isChangingLane() {
        return Math.abs(this.targetX - this.mesh.position.x) > 0.05;
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
        const t = (speed - SPEED_CONFIG.BASE_SPEED) / (SPEED_CONFIG.MAX_SPEED - SPEED_CONFIG.BASE_SPEED);
        const scale = 0.85 + t * 0.3;
        for (const key in this._animations) {
            this._animations[key].timeScale = scale;
        }
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

    _findBestGroundHit() {
        let bestHit = null;
        let bestScore = -Infinity;
        const lead = Math.min(1.8, Math.max(0.6, this.forwardSpeed * 0.04));
        const zOffsets = [0, -lead * 0.35, -lead * 0.7, -lead, 0.35];

        for (const zOffset of zOffsets) {
            this.raycaster.set(
                this._groundRayOrigin.set(
                    this.mesh.position.x,
                    this.mesh.position.y + 4,
                    this.mesh.position.z + zOffset
                ),
                new THREE.Vector3(0, -1, 0)
            );
            const hits = this.raycaster.intersectObjects(this.groundObjects, false);
            for (const hit of hits) {
                const isTrainSurface = hit.object?.userData?.walkableProfile?.kind === 'train';
                const maxStepUp = isTrainSurface ? 1.35 : 0.95;
                if (hit.point.y > this.mesh.position.y + maxStepUp) continue;
                if (hit.point.y < this.mesh.position.y - 8) continue;

                const score = hit.point.y * 10 - Math.abs(zOffset) * 0.2 - hit.distance * 0.01;
                if (score > bestScore) {
                    bestScore = score;
                    bestHit = hit;
                }
            }
        }

        return bestHit;
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
            this._visual.position.copy(this.mesh.position);
            return;
        }

        this.mesh.position.x += (this.targetX - this.mesh.position.x) * 12 * delta;
        this.mesh.position.z -= this.forwardSpeed * delta;

        this.updateGroundObjects(trackChunks);

        const groundHit = this._findBestGroundHit();
        let foundGround = false;
        let detectedY = 0;
        let closestObject = null;
        if (groundHit) {
            detectedY = groundHit.point.y;
            foundGround = true;
            closestObject = groundHit.object;
        }

        this.isGrounded = foundGround;

        if (foundGround) {
            this.currentGroundY = detectedY;
            this.lastValidGroundY = detectedY;
            this._currentPlatform = closestObject;

            if (closestObject?.userData?.walkableProfile?.kind === 'train') {
                this.trainGraceTimer = 0.45;
                this.trainGraceTrainUuid = closestObject.uuid;
            }
        } else {
            this._currentPlatform = null;
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
            if (diff >= 0 || Math.abs(diff) < 0.1) {
                this.mesh.position.y = targetY;
            } else {
                this.mesh.position.y += diff * Math.min(1, 6 * delta);
            }
        }

        const isOnGround = Math.abs(this.mesh.position.y - targetY) < 0.1 && !this.isJumping;
        if (this._wasInAir && isOnGround) {
            const onTrain = closestObject?.userData?.walkableProfile?.kind === 'train';
            if (this.audio) this.audio.play(onTrain ? 'trainLanding' : 'landing', { volume: onTrain ? 0.4 : 0.25 });
        }

        this._updateAnimState(isOnGround);
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

        this._visual.position.copy(this.mesh.position);
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
        this._visual.position.set(0, 0, -5);
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
        this._currentPlatform = null;
        this.footstepTimer = 0;
        this.isGrounded = true;
        this.hasSneakers = false;
        this._wasInAir = false;
        this.forwardSpeed = SPEED_CONFIG.BASE_SPEED;
        this.jumpForce = 15;
        this.gravity = -45;
        this._playingLandAnim = false;
        this._isDying = false;
        this.resumeAnimation();
    }
}
