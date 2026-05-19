import * as THREE from 'three';

export class CollisionManager {
    constructor() {
        this.playerBox = new THREE.Box3();
        this.objectBox = new THREE.Box3();
    }

    checkCollisions(player, trackChunks) {
        // Chỉ chặn nếu đang trong thời gian bất tử (cooldown)
        // BỎ kiểm tra returningToLane để Chaser có thể bắt người
        if (player.hitCooldown > 0) {
            return { coinsCollected: 0, hitType: null };
        }

        this.playerBox.setFromObject(player.mesh);
        this.playerBox.expandByScalar(-0.15); // Thu nhỏ hitbox một chút

        let coinsCollected = 0;
        let hitType = null;

        for (const chunk of trackChunks) {
            if (Math.abs(chunk.position.z - player.mesh.position.z) > 40) continue;

            for (const child of chunk.children) {
                if (!child.visible || !child.userData || child.userData.collected) continue;

                const type = child.userData.type;
                if (!type) continue;

                this.objectBox.setFromObject(child);

                if (this.playerBox.intersectsBox(this.objectBox)) {
                    if (type === 'coin') {
                        child.visible = false;
                        child.userData.collected = true;
                        coinsCollected++;
                    } else if (type === 'obstacle') {
                        // 🔥 LOGIC HÌNH HỌC CHUẨN:
                        // Tính độ chồng lấn (overlap) trên trục X
                        const xOverlap = Math.min(this.playerBox.max.x, this.objectBox.max.x) - 
                                         Math.max(this.playerBox.min.x, this.objectBox.min.x);
                        
                        // Nếu độ chồng lấn > 0.6 (hơn 60% bề ngang) => Coi là va trực diện (Front)
                        // Nếu độ chồng lấn nhỏ => Coi là va lướt hông (Side)
                        if (xOverlap > 0.6) {
                            hitType = 'front';
                        } else {
                            hitType = 'side';
                        }
                        
                        break;
                    }
                }
            }
            if (hitType) break;
        }

        return { coinsCollected, hitType };
    }
}