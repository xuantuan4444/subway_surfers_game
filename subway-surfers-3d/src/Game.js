import * as THREE from 'three';
import { Player } from './entities/Player.js';
import { TrackManager } from './managers/TrackManager.js';
import { InputManager } from './managers/InputManager.js';
import { CollisionManager } from './managers/CollisionManager.js';
import { Chaser } from './entities/Chaser.js';
import { AudioManager } from './managers/AudioManager.js';
import { LightingManager } from './managers/LightingManager.js';

export class Game {
  constructor() {
    this.clock = new THREE.Clock();
    this.score = 0;
    this.isGameOver = false;
    this._prevChaserActive = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.Fog(0x87CEEB, 15, 150);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 7, 8);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.6;
    document.body.appendChild(this.renderer.domElement);

    this.lighting = new LightingManager(this.scene);

    this.audio = new AudioManager().init();
    this.track = new TrackManager(this.scene);
    this.player = new Player(this.scene, this.audio);
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

    this.audio.loadManifest({
      sfx: {
        coin: 'coin.mp3',
        step1: 'Footsteps 1.mp3',
        step2: 'Footsteps 2.mp3',
        step3: 'Footsteps 3.mp3',
        step4: 'Footsteps 4.mp3',
        step5: 'Footsteps 5.mp3',
        swipe1: 'Swipes 1.mp3',
        swipe2: 'Swipes 2.mp3',
        swipe3: 'Swipes 3.mp3',
        swipe4: 'Swipes 4.mp3',
        swipe5: 'Swipes 5.mp3',
        swipe6: 'Swipes 6.mp3',
        swipe7: 'Swipes 7.mp3',
        swipe8: 'Swipes 8.mp3',
        swipe9: 'Swipes 9.mp3',
      },
    });
  }

  start() {
    this.animate();
  }

  restart() {
    this.score = 0;
    this.isGameOver = false;
    this.player.reset();
    this.chaser.deactivate();
    this._prevChaserActive = this.chaser.active;
    this.updateUI();
    if (this.uiGameOver) this.uiGameOver.style.display = 'none';
    this.lighting.reset();
    this.track.reset();
    this.animate();
  }

  updateUI() {
    if (this.uiScore) this.uiScore.textContent = `Score: ${this.score}`;
    if (this.uiFinalScore) this.uiFinalScore.textContent = this.score;
    if (this.uiLives) this.uiLives.textContent = this.chaser.active ? '❤️' : '❤️❤️';
  }

  triggerGameOver() {
    this.isGameOver = true;
    if (this.uiGameOver) this.uiGameOver.style.display = 'flex';
    if (this.uiFinalScore) this.uiFinalScore.textContent = this.score;
  }

  animate() {
    if (this.isGameOver) return;

    requestAnimationFrame(() => this.animate());
    const delta = this.clock.getDelta();

    this.lighting.update(delta, this.player.mesh.position.z);
    this.track.setLampIntensity(this.lighting.darkness);
    this.track.update(delta, this.player.mesh.position.z, this.player.currentLane);
    this.player.update(delta, this.track.chunks);

    this.chaser.update(delta, this.player.mesh);

    if (this._prevChaserActive !== this.chaser.active) {
      this._prevChaserActive = this.chaser.active;
      this.updateUI();
    }

    const collisionResult = this.collision.checkCollisions(this.player, this.track.chunks);

    if (collisionResult.coinsCollected > 0) {
      this.score += collisionResult.coinsCollected * 10;
      this.updateUI();
      this.audio.play('coin', {
        volume: 0.35,
        filter: { type: 'lowpass', frequency: 600, Q: 0.5 },
        compressor: { threshold: -20, ratio: 8 },
      });
    }

    if (collisionResult.hitType) {
      this.resolveCollision(collisionResult);
    }

    const effectivePlayerY = Math.max(this.player.mesh.position.y, this.player.currentGroundY + 1);
    const camOffset = effectivePlayerY - 1;
    const playerCamEffect = (camOffset > 0.05 ? camOffset : 0) * 0.4;

    this.camera.position.z = this.player.mesh.position.z + 9;
    this.camera.position.y = 7 + playerCamEffect;
    this.camera.position.x = this.player.mesh.position.x * 0.3;
    this.camera.lookAt(
      this.player.mesh.position.x,
      2 + playerCamEffect,
      this.player.mesh.position.z - 6
    );

    this.renderer.render(this.scene, this.camera);
  }

  resolveCollision(collisionResult) {
    const { hitType, hitLane } = collisionResult;

    if (hitType === 'front') {
      this.triggerGameOver();
      return;
    }

    if (hitType === 'side') {
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
