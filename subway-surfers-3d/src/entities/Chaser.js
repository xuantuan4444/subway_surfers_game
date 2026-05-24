import * as THREE from 'three';
import { ModelManager } from '../utils/ModelManager.js';

const ANIMS = {
    STAND: 'chaser_stand',
    RUN: 'chaser_run',
    JUMP: 'chaser_jump',
    LAND: 'chaser_land',
    SLIDE: 'chaser_slide',
    WIN: 'chaser_win',
    FALL: 'chaser_fall',
};

export class Chaser {
    constructor(scene) {
        this.scene = scene;
        this.active = false;

        this.mesh = new THREE.Group();
        this._animations = {};
        this._currentAnimAction = null;
        this._animState = null;
        this._wasAirborne = false;
        this._forceRunAnimation = false;

        const model = ModelManager.get('Chaser');
        if (model) {
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
            console.log(`[Chaser] Model AABB: ${size.x.toFixed(3)} x ${size.y.toFixed(3)} x ${size.z.toFixed(3)}  minY=${minY.toFixed(3)}`);

            const targetHeight = 2;
            const scale = (targetHeight / Math.max(size.y, 0.01)) * 1.75;
            model.scale.set(scale, scale, scale);
            model.position.y = -minY * scale;

            const animations = ModelManager.getAnimations('Chaser');
            if (animations.length > 0) {
                this.mixer = new THREE.AnimationMixer(model);
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

                const winAction = this._animations[ANIMS.WIN];
                if (winAction) {
                    winAction.loop = THREE.LoopOnce;
                    winAction.clampWhenFinished = true;
                }

                this.mixer.addEventListener('finished', (e) => {
                    if (e.action === this._animations[ANIMS.LAND] && this._animState === ANIMS.LAND) {
                        this._playAnim(this.state === this.STATE.IDLE ? ANIMS.STAND : ANIMS.RUN, 0.15);
                    }
                });

                this._playAnim(ANIMS.STAND, 0);
            } else {
                this.mixer = null;
                this._currentAnimAction = null;
            }
        } else {
            const geometry = new THREE.BoxGeometry(1, 2, 1);
            const material = new THREE.MeshStandardMaterial({
                color: 0xcc0000,
                emissive: 0xff0000,
                emissiveIntensity: 0.5
            });
            const body = new THREE.Mesh(geometry, material);
            body.position.y = 1;
            body.castShadow = true;
            body.receiveShadow = true;
            this.mesh.add(body);
            this._model = body;
            this.mixer = null;
            this._currentAnimAction = null;
        }

        const proxyGeo = new THREE.BoxGeometry(1, 2, 1);
        const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
        this._collisionProxy = new THREE.Mesh(proxyGeo, proxyMat);
        this._collisionProxy.position.y = 1;
        this.mesh.add(this._collisionProxy);

        this.scene.add(this.mesh);
        this.mesh.visible = true;

        this.idleDistance = 15;
        this.chaseDistance = 3;
        this.sprintDuration = 0.5;
        this.retreatDuration = 1.5;
        this.escapeDuration = 3.5;
        this._timer = 0;
        this.escapeTimer = 0;
        this._currentOffset = this.idleDistance;
        this._lerpStart = this.idleDistance;

        this.STATE = { IDLE: 'idle', APPROACHING: 'approaching', CHASING: 'chasing', RETREATING: 'retreating', WIN: 'win' };
        this.state = this.STATE.IDLE;

        this._history = [];
        this._accumTime = 0;
    }

    _playAnim(name, fadeDuration = 0.15) {
        const newAction = this._animations[name];
        if (!newAction) return;
        if (newAction === this._currentAnimAction && newAction.isRunning()) return;

        if (this._currentAnimAction) {
            this._currentAnimAction.fadeOut(fadeDuration);
        }

        newAction.reset().fadeIn(fadeDuration).play();
        this._currentAnimAction = newAction;
        this._animState = name;
    }

    _updateAnimation(snapshot) {
        if (!this.mixer || this.state === this.STATE.WIN) return;

        if (this._forceRunAnimation) {
            if (this._animState !== ANIMS.RUN) {
                this._playAnim(ANIMS.RUN, 0.12);
            }
            return;
        }

        if (this.state === this.STATE.IDLE || this.state === this.STATE.RETREATING) {
            if (this._animState !== ANIMS.STAND) {
                this._playAnim(ANIMS.STAND, 0.15);
            }
            return;
        }

        if (snapshot.isSliding) {
            if (this._animState !== ANIMS.SLIDE) {
                this._playAnim(ANIMS.SLIDE, 0.1);
            }
            this._wasAirborne = false;
            return;
        }

        if (snapshot.isJumping) {
            const desiredAnim = snapshot.verticalVelocity > 0 ? ANIMS.JUMP : ANIMS.FALL;
            if (this._animState !== desiredAnim) {
                this._playAnim(desiredAnim, 0.1);
            }
            this._wasAirborne = true;
            return;
        }

        if (!snapshot.isGrounded) {
            if (this._animState !== ANIMS.FALL) {
                this._playAnim(ANIMS.FALL, 0.1);
            }
            this._wasAirborne = true;
            return;
        }

        if (this._wasAirborne) {
            this._wasAirborne = false;
            if (this._animState !== ANIMS.LAND) {
                this._playAnim(ANIMS.LAND, 0.08);
            }
            return;
        }

        if (this._animState !== ANIMS.RUN) {
            this._playAnim(ANIMS.RUN, 0.12);
        }
    }

    activate() {
        if (this.state !== this.STATE.IDLE) return;
        this.state = this.STATE.APPROACHING;
        this._timer = this.sprintDuration;
        this._lerpStart = this._currentOffset;
        this._forceRunAnimation = false;
        this._playAnim(ANIMS.RUN, 0.12);
    }

    playRunAnimation() {
        this._forceRunAnimation = true;
        this._playAnim(ANIMS.RUN, 0.12);
    }

    clearRunLock() {
        this._forceRunAnimation = false;
    }

    playWinAnimation() {
        this.state = this.STATE.WIN;
        this.active = true;
        this._forceRunAnimation = false;
        this._playAnim(ANIMS.WIN, 0.12);
    }

    update(delta, playerMesh, currentSpeed, player) {
        if (this.mixer) this.mixer.update(delta);

        this._accumTime += delta;
        this._history.push({
            time: this._accumTime,
            y: playerMesh.position.y,
            scaleY: player.slideScale,
            isJumping: player.isJumping,
            isSliding: player.isSliding,
            verticalVelocity: player.verticalVelocity,
            isGrounded: player.isGrounded,
        });
        const cutoff = this._accumTime - 2;
        while (this._history.length > 1 && this._history[1].time < cutoff) {
            this._history.shift();
        }

        this.mesh.position.x = playerMesh.position.x;

        let offset;
        switch (this.state) {
            case this.STATE.IDLE:
                offset = this.idleDistance;
                this.active = false;
                break;

            case this.STATE.APPROACHING:
                this._timer -= delta;
                const t = 1 - Math.max(0, this._timer / this.sprintDuration);
                const ease = t * t * (3 - 2 * t);
                offset = THREE.MathUtils.lerp(this._lerpStart, this.chaseDistance, ease);
                this.active = false;
                if (this._timer <= 0) {
                    this.state = this.STATE.CHASING;
                    this.escapeTimer = this.escapeDuration;
                }
                break;

            case this.STATE.CHASING:
                offset = this.chaseDistance;
                this.active = true;
                this.escapeTimer -= delta;
                if (this.escapeTimer <= 0) {
                    this.state = this.STATE.RETREATING;
                    this._timer = this.retreatDuration;
                }
                break;

            case this.STATE.RETREATING:
                this._timer -= delta;
                const t2 = 1 - Math.max(0, this._timer / this.retreatDuration);
                const ease2 = t2 * t2 * (3 - 2 * t2);
                offset = THREE.MathUtils.lerp(this.chaseDistance, this.idleDistance, ease2);
                this.active = false;
                if (this._timer <= 0) {
                    this.state = this.STATE.IDLE;
                }
                break;
        }

        this._currentOffset = offset;
        this.mesh.position.z = playerMesh.position.z + offset;

        const delay = offset / Math.max(1, currentSpeed);
        const targetTime = this._accumTime - delay;
        let delayedState = this._history[0];
        for (let i = this._history.length - 1; i >= 0; i--) {
            if (this._history[i].time <= targetTime) {
                delayedState = this._history[i];
                break;
            }
        }

        this.mesh.position.y = delayedState.y;
        this._updateAnimation(delayedState);

        const dx = playerMesh.position.x - this.mesh.position.x;
        const dz = playerMesh.position.z - this.mesh.position.z;
        this.mesh.rotation.y = Math.atan2(dx, dz);
    }

    deactivate() {
        this.active = false;
        this.state = this.STATE.IDLE;
        this._wasAirborne = false;
        this._forceRunAnimation = false;
        this._playAnim(ANIMS.STAND, 0.15);
    }

    freezeAnimation() {
        if (this._currentAnimAction) this._currentAnimAction.stop();
    }

    resumeAnimation() {
        this._playAnim(ANIMS.STAND, 0.15);
    }
}
