// src/entities/Coin.js
import * as THREE from 'three';
import { Poolable } from '../utils/Poolable.js';
import { LaneUtils } from '../utils/LaneUtils.js';

export class Coin extends Poolable {
    constructor(scene) {
        super();
        this.scene = scene;
        this.mesh = null;
        this.collected = false;
    }
    
    onActivate(config) {
        const { lane, position } = config;
        
        if (!this.mesh) {
            this.mesh = this._createMesh();
        }
        
        this.mesh.position.set(
            position?.x ?? LaneUtils.laneToWorldX(lane),
            position?.y ?? 1.5,
            position?.z ?? 0
        );
        
        this.mesh.visible = true;
        this.collected = false;
        this.userData = {
            type: 'coin',
            lane,
            value: 10,
            rotateSpeed: 3,
            ...config.userData,
        };
    }
    
    _createMesh() {
        const geometry = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            metalness: 0.8,
            roughness: 0.2,
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = Math.PI / 2;
        return mesh;
    }
    
    update(deltaTime) {
        if (this.inUse && this.mesh && !this.collected) {
            this.mesh.rotation.z += this.userData.rotateSpeed * deltaTime;
        }
    }
    
    checkCollection(playerPosition) {
        if (this.collected || !this.mesh) return false;
        
        const distance = this.mesh.position.distanceTo(playerPosition);
        if (distance < 1.2) {
            this.collect();
            return true;
        }
        return false;
    }
    
    collect() {
        this.collected = true;
        this.mesh.visible = false;
    }
    
    onDeactivate() {
        if (this.mesh) {
            this.mesh.visible = false;
            this.mesh.rotation.z = 0;
        }
        this.collected = false;
    }
    
    canRecycle(playerZ, margin) {
        return this.inUse && this.mesh?.position?.z > playerZ + margin;
    }
}