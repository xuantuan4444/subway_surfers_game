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

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.Fog(0x87CEEB, 15, 60);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
        this.camera.position.set(0, 5, 8);

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

        this.uiScore = document.getElementById('score');
        // 🔥 XÓA this.uiLives
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
        this.updateUI();
        if (this.uiGameOver) this.uiGameOver.style.display = 'none';
        this.track.chunks.forEach(c => this.scene.remove(c));
        this.track.chunks = []; this.track.initChunks();
        this.animate();
    }

    updateUI() {
        if (this.uiScore) this.uiScore.textContent = `Score: ${this.score}`;
        if (this.uiFinalScore) this.uiFinalScore.textContent = this.score;
    }

    triggerGameOver() {
        this.isGameOver = true;
        this.chaser.deactivate();
        if (this.uiGameOver) this.uiGameOver.style.display = 'flex';
    }

    animate() {
        if (this.isGameOver) return;

        requestAnimationFrame(() => this.animate());
        const delta = this.clock.getDelta();
        
        this.player.update(delta, this.track.chunks);
        this.track.update(this.player.mesh.position.z);
        this.track.animateCoins();

        // 🔥 Cập nhật Chaser mỗi frame
        if (this.chaser.active) {
            this.chaser.update(delta, this.player.mesh);
        }

        const result = this.collision.checkCollisions(this.player, this.track.chunks);
        
        if (result.coinsCollected > 0) {
            this.score += result.coinsCollected * 10;
            this.updateUI();
        }

        if (result.hitType) {
            if (result.hitType === 'front') {
                this.triggerGameOver(); // Va chính diện -> Thua ngay
            } else if (result.hitType === 'side') {
                if (this.chaser.active) {
                    this.triggerGameOver(); // 🔥 Va lần 2 khi đang bị dí -> Thua ngay
                } else {
                    this.player.onSideHit();
                    this.chaser.activate(this.player.mesh); //  Kích hoạt dí 5s
                }
            }
        }

        this.camera.position.z = this.player.mesh.position.z + 8;
        this.camera.position.x = this.player.mesh.position.x * 0.3;
        this.camera.lookAt(this.player.mesh.position.x, 2, this.player.mesh.position.z - 10);

        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}