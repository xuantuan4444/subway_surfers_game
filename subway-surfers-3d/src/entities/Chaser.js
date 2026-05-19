import * as THREE from 'three';

export class Chaser {
    constructor(scene) {
        this.scene = scene;
        this.active = false;
        this.maxDuration = 5.0; //  Thời gian dí tối đa
        this.remainingTime = 0;
        
        this.mesh = this.createMesh();
        this.scene.add(this.mesh);
        this.mesh.visible = false;
        this.followDistance = 5;
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
        this.remainingTime = this.maxDuration; // 🔥 Reset đồng hồ 5s
        this.updatePosition(playerMesh);
    }

    update(delta, playerMesh) {
        if (!this.active) return;
        
        this.remainingTime -= delta;
        this.updatePosition(playerMesh);

        // 🔥 Hết thời gian dí -> Tự động biến mất
        if (this.remainingTime <= 0) {
            this.deactivate();
        }
    }

    updatePosition(playerMesh) {
        this.mesh.position.x = playerMesh.position.x;
        this.mesh.position.y = 0;
        this.mesh.position.z = playerMesh.position.z + this.followDistance;
        this.mesh.lookAt(playerMesh.position.x, 1.5, playerMesh.position.z);
    }

    deactivate() {
        this.active = false;
        this.mesh.visible = false;
    }
}