import * as THREE from 'three';

export class Chaser {
    constructor(scene) {
        this.scene = scene;
        this.active = false;
        this.maxDuration = 5;
        this.remainingTime = 0;

        this.mesh = this.createMesh();
        this.scene.add(this.mesh);
        this.mesh.visible = false;

        this.followDistance = 5;
        this.approachSpeed = 80;
        this.retreatSpeed = 15;

        this.STATE = {
            INACTIVE: 'inactive',
            APPROACHING: 'approaching',
            CHASING: 'chasing',
            RETREATING: 'retreating'
        };
        this.state = this.STATE.INACTIVE;
    }

    createMesh() {
        const group = new THREE.Group();
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 2.8, 1.2),
            new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff0000, emissiveIntensity: 1.0 })
        );
        body.position.y = 1.4;
        group.add(body);

        const eyeGeo = new THREE.SphereGeometry(0.2, 8, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        group.add(new THREE.Mesh(eyeGeo, eyeMat).translateX(-0.35).translateY(2.1).translateZ(-0.5));
        group.add(new THREE.Mesh(eyeGeo, eyeMat).translateX(0.35).translateY(2.1).translateZ(-0.5));

        const light = new THREE.PointLight(0xff0000, 2, 10);
        light.position.set(0, 2, 0);
        group.add(light);

        return group;
    }

    activate(playerMesh) {
        this.active = true;
        this.mesh.visible = true;
        this.remainingTime = this.maxDuration;
        this.state = this.STATE.APPROACHING;
        this.offset = 25;

        this.mesh.position.x = playerMesh.position.x;
        this.mesh.position.y = 1.4;
        this.mesh.position.z = playerMesh.position.z + this.followDistance + this.offset;
    }

    update(delta, playerMesh) {
        if (this.state === this.STATE.INACTIVE) return;

        this.mesh.lookAt(playerMesh.position.x, 1.5, playerMesh.position.z);

        switch (this.state) {
            case this.STATE.APPROACHING:
                this.updateApproaching(delta, playerMesh);
                break;
            case this.STATE.CHASING:
                this.updateChasing(delta, playerMesh);
                break;
            case this.STATE.RETREATING:
                this.updateRetreating(delta, playerMesh);
                break;
        }
    }

    updateApproaching(delta, playerMesh) {
        this.offset -= this.approachSpeed * delta;
        if (this.offset < 0) this.offset = 0;

        this.mesh.position.z = playerMesh.position.z + this.followDistance + this.offset;
        this.mesh.position.x = playerMesh.position.x;

        if (this.offset <= 0) {
            this.state = this.STATE.CHASING;
        }
    }

    updateChasing(delta, playerMesh) {
        this.remainingTime -= delta;

        const targetZ = playerMesh.position.z + this.followDistance;
        const diff = targetZ - this.mesh.position.z;
        this.mesh.position.z += diff * Math.min(1, 15 * delta);
        this.mesh.position.x = playerMesh.position.x;

        if (this.remainingTime <= 0) {
            this.active = false;
            this.offset = this.mesh.position.z - playerMesh.position.z;
            this.state = this.STATE.RETREATING;
        }
    }

    updateRetreating(delta, playerMesh) {
        this.offset += this.retreatSpeed * delta;
        if (this.offset > 30) this.offset = 30;

        this.mesh.position.z = playerMesh.position.z + this.offset;
        this.mesh.position.x = playerMesh.position.x;

        if (this.offset >= 30) {
            this.deactivate();
        }
    }

    deactivate() {
        this.active = false;
        this.state = this.STATE.INACTIVE;
        this.mesh.visible = false;
    }
}
