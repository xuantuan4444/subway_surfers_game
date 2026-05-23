import * as THREE from 'three';
import { ModelManager } from '../utils/ModelManager.js';

export class Chaser {
    constructor(scene) {
        this.scene = scene;
        this.active = false;

        this.mesh = new THREE.Group();

        const model = ModelManager.get('Player');
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

            const animations = ModelManager.getAnimations('Player');
            if (animations.length > 0) {
                this.mixer = new THREE.AnimationMixer(model);
                const runClip = animations.find(c => c.name === 'player_run') || animations[0];
                this._animAction = this.mixer.clipAction(runClip);
                this._animAction.play();
            } else {
                this.mixer = null;
                this._animAction = null;
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

        this.STATE = { IDLE: 'idle', APPROACHING: 'approaching', CHASING: 'chasing', RETREATING: 'retreating' };
        this.state = this.STATE.IDLE;

        this._history = [];
        this._accumTime = 0;
    }

    activate() {
        this.state = this.STATE.APPROACHING;
        this._timer = this.sprintDuration;
        this._lerpStart = this._currentOffset;
    }

    update(delta, playerMesh, currentSpeed, player) {
        if (this.mixer) this.mixer.update(delta);

        this._accumTime += delta;
        this._history.push({
            time: this._accumTime,
            y: playerMesh.position.y,
            scaleY: player.slideScale
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

        const dx = playerMesh.position.x - this.mesh.position.x;
        const dz = playerMesh.position.z - this.mesh.position.z;
        this.mesh.rotation.y = Math.atan2(dx, dz);
    }

    deactivate() {
        this.active = false;
        this.state = this.STATE.IDLE;
    }

    freezeAnimation() {
        if (this._animAction) this._animAction.stop();
    }

    resumeAnimation() {
        if (this._animAction) this._animAction.play();
    }
}
