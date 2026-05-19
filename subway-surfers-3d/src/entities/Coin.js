// src/entities/Coin.js
export class Coin {
    constructor(scene, lane, zPosition) {
        this.scene = scene;
        this.lane = lane;
        this.zPosition = zPosition;
        this.collected = false;
        this.value = 10;
        
        const geometry = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0xffd700,
            metalness: 0.8,
            roughness: 0.2
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.rotation.x = Math.PI / 2;
        this.mesh.position.set(
            (lane - 1) * 3,
            1,
            zPosition
        );
        
        scene.add(this.mesh);
    }
    
    update(delta) {
        // Rotate animation
        this.mesh.rotation.z += 3 * delta;
    }
    
    checkCollection(playerPosition) {
        if (this.collected) return false;
        
        const distance = this.mesh.position.distanceTo(playerPosition);
        if (distance < 1) {
            this.collect();
            return true;
        }
        return false;
    }
    
    collect() {
        this.collected = true;
        this.mesh.visible = false;
        // Play sound, add score, etc.
    }
}