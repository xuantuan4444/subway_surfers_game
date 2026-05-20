import * as THREE from 'three';
import { Player } from './entities/Player.js';
import { TrackManager } from './managers/TrackManager.js';
import { InputManager } from './managers/InputManager.js';
import { CollisionManager } from './managers/CollisionManager.js';
import { Chaser } from './entities/Chaser.js';

export class Game {
    constructor() {
        this.clock = new THREE.Clock();
        this.score = 0;
        this.isGameOver = false;

        this._prevChaserActive = false;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.Fog(0x87CEEB, 15, 60);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
        this.camera.position.set(0, 9, 8);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10); dirLight.castShadow = true;
        this.scene.add(dirLight);

        this.track = new TrackManager(this.scene);
        this.player = new Player(this.scene);
        this.input = new InputManager(this.player);
        this.collision = new CollisionManager();
        this.chaser = new Chaser(this.scene);

        this._prevChaserActive = this.chaser.active;

        this.uiScore = document.getElementById('score');
        this.uiLives = document.getElementById('lives');
        this.uiGameOver = document.getElementById('game-over');
        this.uiFinalScore = document.getElementById('final-score');
        this.uiRestartBtn = document.getElementById('restart-btn');

        if (this.uiRestartBtn) this.uiRestartBtn.addEventListener('click', () => this.restart());

        window.addEventListener('resize', () => this.onResize());
        this.updateUI();
    }

    start() { this.animate(); }

    restart() {
        this.score = 0; this.isGameOver = false;
        this.player.reset(); 
        this.chaser.deactivate();
        this._prevChaserActive = this.chaser.active;
        this.updateUI();
        if (this.uiGameOver) this.uiGameOver.style.display = 'none';
        this.track.chunks.forEach(c => this.scene.remove(c));
        this.track.chunks = []; this.track.initChunks();
        this.animate();
    }

    updateUI() {
        if (this.uiScore) this.uiScore.textContent = `Score: ${this.score}`;
        if (this.uiFinalScore) this.uiFinalScore.textContent = this.score;
        // Cơ chế: chưa bị chaser đuổi => "2 cơ hội"; đang bị đuổi => còn 1 cơ hội
        if (this.uiLives) this.uiLives.textContent = this.chaser.active ? '❤️' : '❤️❤️';
    }

    triggerGameOver() {
        this.isGameOver = true;
        // this.chaser.deactivate(); // Chaser không còn trong file này
        if (this.uiGameOver) this.uiGameOver.style.display = 'flex';
        if (this.uiFinalScore) this.uiFinalScore.textContent = this.score;
    }

    animate() {
        if (this.isGameOver) return;

        requestAnimationFrame(() => this.animate());
        const delta = this.clock.getDelta();
        
        this.player.update(delta, this.track.chunks);
        this.track.update(this.player.mesh.position.z);
        // this.track.animateCoins(); // CoinManager sẽ quản lý coin

        // Cập nhật Chaser mỗi frame
        this.chaser.update(delta, this.player.mesh);

        // UI tim thay đổi theo trạng thái chaser
        if (this._prevChaserActive !== this.chaser.active) {
            this._prevChaserActive = this.chaser.active;
            this.updateUI();
        }


        // --- LOGIC VA CHẠM ---
        // 1) Kiểm tra va chạm (coin + vật cản, bao gồm cả tàu trong Group)
        const collisionResult = this.collision.checkCollisions(this.player, this.track.chunks);

        // 2) Cộng điểm coin
        if (collisionResult.coinsCollected > 0) {
            this.score += collisionResult.coinsCollected * 10;
            this.updateUI();
        }

        // 3) Xử lý va chạm vật cản
        if (collisionResult.hitType) {
            this.resolveCollision(collisionResult);
        }
        // --- KẾT THÚC LOGIC VA CHẠM ---


        this.camera.position.z = this.player.mesh.position.z + 10;
        this.camera.position.y = 10;
        this.camera.position.x = this.player.mesh.position.x * 0.3;
        this.camera.lookAt(this.player.mesh.position.x, 4, this.player.mesh.position.z - 5);

        this.renderer.render(this.scene, this.camera);
    }

    resolveCollision(collisionResult) {
        const { hitType, hitLane } = collisionResult;

        if (hitType === 'front') {
            this.triggerGameOver();
            return;
        }

        if (hitType === 'side') {
            // Đúng yêu cầu: hit hông lần 1 -> kích hoạt chaser; hit hông lần 2 khi đang bị đuổi -> thua
            if (this.chaser.active) {
                this.triggerGameOver();
                return;
            }

            this.chaser.activate(this.player.mesh);
            this.updateUI();
            this.player.onSideHit(hitLane);
        }
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}