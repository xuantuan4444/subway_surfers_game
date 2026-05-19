// src/managers/TrackManager.js
import * as THREE from 'three';

export class TrackManager {
    constructor(scene) {
        this.scene = scene;
        this.chunks = [];
        this.chunkLength = 30;
        this.numChunks = 12;
        this.laneWidth = 3;
        this.recycleThreshold = 50; 
        this.initChunks();
    }

    initChunks() {
        for (let i = 0; i < this.numChunks; i++) {
            const chunk = this.createChunk();
            chunk.position.z = -i * this.chunkLength;
            this.scene.add(chunk);
            this.chunks.push(chunk);
        }
    }

    createChunk() {
        const group = new THREE.Group();

        // 1. Mặt đường (làm dày hơn để raycast ổn định)
        const roadGeo = new THREE.BoxGeometry(12, 0.5, this.chunkLength); // 🔥 Dùng BoxGeometry thay vì Plane
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const road = new THREE.Mesh(roadGeo, roadMat);
        road.position.y = -0.25; // Đặt đáy đường ở Y=0
        road.userData = { isGround: true, type: 'road' };
        group.add(road);

        // 2. Vạch kẻ lane
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        for (let i = 0; i < 6; i++) {
            const lineGeo = new THREE.BoxGeometry(0.2, 0.02, 1.5);
            const lineL = new THREE.Mesh(lineGeo, lineMat);
            lineL.position.set(-1.5, 0.01, -i * 3.3 + 1.5);
            group.add(lineL);
            const lineR = new THREE.Mesh(lineGeo, lineMat);
            lineR.position.set(1.5, 0.01, -i * 3.3 + 1.5);
            group.add(lineR);
        }

        // 3. Tường 2 bên
        const wallGeo = new THREE.BoxGeometry(0.5, 2, this.chunkLength);
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x666666 });
        const wallL = new THREE.Mesh(wallGeo, wallMat);
        wallL.position.set(-6.25, 1, 0);
        group.add(wallL);
        const wallR = new THREE.Mesh(wallGeo, wallMat);
        wallR.position.set(6.25, 1, 0);
        group.add(wallR);

        this.spawnObjectsOnChunk(group);
        return group;
    }

    spawnObjectsOnChunk(group) {
        if (Math.random() > 0.6) return; 
        const lanes = [0, 1, 2].sort(() => 0.5 - Math.random());
        const numObjects = Math.random() > 0.5 ? 1 : 2;

        for (let i = 0; i < numObjects; i++) {
            const lane = lanes[i];
            const xPos = (lane - 1) * this.laneWidth;
            const zPos = -Math.random() * (this.chunkLength - 10) - 5; 
            const type = Math.random();

            if (type < 0.2) {
                this.spawnTrain(group, lane, zPos);
            } else if (type > 0.5) {
                const barrierGeo = new THREE.BoxGeometry(2.5, 1.5, 1);
                const barrierMat = new THREE.MeshStandardMaterial({ color: 0xff3333 });
                const barrier = new THREE.Mesh(barrierGeo, barrierMat);
                barrier.position.set(xPos, 0.75, zPos);
                barrier.userData = { type: 'obstacle', lane: lane };
                group.add(barrier);
            } else {
                const coinGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16);
                const coinMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2 });
                const coin = new THREE.Mesh(coinGeo, coinMat);
                coin.rotation.x = Math.PI / 2;
                coin.position.set(xPos, 1, zPos);
                coin.userData = { type: 'coin', lane: lane, rotateSpeed: 3 };
                group.add(coin);
            }
        }
    }

    // 🔥 HÀM SPAWN TÀU ĐÃ SỬA KHE HỞ & LÀM DÀY NÓC
    spawnTrain(group, laneIndex, zPos) {
        const laneX = (laneIndex - 1) * this.laneWidth;
        const trainGroup = new THREE.Group();
        
        const trainHeight = 4;
        const trainLength = 20;
        const rampLength = 8;
        const rampThickness = 0.5; // 🔥 Làm dày dốc để raycast ổn hơn

        // === 1. THÂN TÀU ===
        const bodyGeo = new THREE.BoxGeometry(2.6, trainHeight, trainLength);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a2b4c, roughness: 0.7 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(laneX, trainHeight / 2, zPos);
        body.userData = { type: 'obstacle', lane: laneIndex, isGround: false };
        trainGroup.add(body);

        // === 2. 🔥 MÁI TÀU: LÀM DÀY + KÉO DÀI ĐỂ CHE KHE HỞ ===
        const topMat = new THREE.MeshStandardMaterial({ color: 0x3a5b8c, roughness: 0.4 });
        const topThickness = 0.8; // 🔥 Dày hơn để không bị xuyên
        const topGeo = new THREE.BoxGeometry(2.8, topThickness, trainLength + 2); // 🔥 Dài hơn 2 units để overlap với dốc
        const top = new THREE.Mesh(topGeo, topMat);
        // Đặt nóc tàu cao hơn thân một chút để tạo overlap
        top.position.set(laneX, trainHeight + topThickness / 2 - 0.1, zPos);
        top.userData = { isGround: true, type: 'train_top' };
        trainGroup.add(top);

        const rampAngle = Math.atan2(trainHeight, rampLength);

        // === 3. 🔥 DỐC LÊN: TÍNH TOÁN LẠI VỊ TRÍ ĐỂ NỐI LIỀN ===
        const rampUpGeo = new THREE.BoxGeometry(2.6, rampThickness, rampLength);
        const rampUp = new THREE.Mesh(rampUpGeo, topMat);
        
        // Vị trí tâm dốc: nối liền từ mặt đất (zPos + trainLength/2) lên nóc tàu
        // Tâm dốc nằm ở giữa đoạn nối
        const rampUpZ = zPos + trainLength / 2 + rampLength / 2 - 0.5; // 🔥 Trừ 0.5 để overlap với nóc
        const rampUpY = trainHeight / 2;
        rampUp.position.set(laneX, rampUpY, rampUpZ);
        rampUp.rotation.x = rampAngle;
        rampUp.userData = { isGround: true, type: 'train_ramp' };
        trainGroup.add(rampUp);

        // === 4. 🔥 DỐC XUỐNG: TƯƠNG TỰ ===
        const rampDown = new THREE.Mesh(rampUpGeo, topMat);
        const rampDownZ = zPos - trainLength / 2 - rampLength / 2 + 0.5; // 🔥 Cộng 0.5 để overlap
        const rampDownY = trainHeight / 2;
        rampDown.position.set(laneX, rampDownY, rampDownZ);
        rampDown.rotation.x = -rampAngle;
        rampDown.userData = { isGround: true, type: 'train_ramp' };
        trainGroup.add(rampDown);

        // === 5. Coin trên nóc (điều chỉnh theo độ dày mới) ===
        for (let j = 0; j < 5; j++) {
            const coinGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16);
            const coinMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2 });
            const coin = new THREE.Mesh(coinGeo, coinMat);
            coin.rotation.x = Math.PI / 2;
            coin.position.set(laneX, trainHeight + topThickness + 1.5, zPos - 6 + j * 2.5);
            coin.userData = { type: 'coin', lane: laneIndex, rotateSpeed: 3 };
            trainGroup.add(coin);
        }

        // === 6. Đèn tín hiệu ===
        const lightGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const light = new THREE.Mesh(lightGeo, lightMat);
        light.position.set(laneX, trainHeight + 2, zPos + trainLength / 2 + rampLength / 2);
        trainGroup.add(light);

        group.add(trainGroup);
    }

    update(playerZ) {
        let frontZ = 0;
        for (const chunk of this.chunks) {
            if (chunk.position.z < frontZ) frontZ = chunk.position.z;
        }
        for (const chunk of this.chunks) {
            if (chunk.position.z > playerZ + this.recycleThreshold) {
                chunk.position.z = frontZ - this.chunkLength;
            }
        }
    }
    
    animateCoins() {
        this.chunks.forEach(chunk => {
            chunk.children.forEach(child => {
                if (child.userData && child.userData.type === 'coin') {
                    child.rotation.z += child.userData.rotateSpeed * 0.016;
                }
            });
        });
    }
}