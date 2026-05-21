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
    this.scene.fog = new THREE.Fog(0x87CEEB, 15, 150);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 7, 8);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    document.body.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
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
