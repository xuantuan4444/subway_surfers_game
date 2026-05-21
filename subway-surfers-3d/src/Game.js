import * as THREE from 'three';
import { Player } from './entities/Player.js';
import { TrackManager } from './managers/TrackManager.js';
import { InputManager } from './managers/InputManager.js';
import { CollisionManager } from './managers/CollisionManager.js';
import { Chaser } from './entities/Chaser.js';
import { AudioManager } from './managers/AudioManager.js';
import { LightingManager } from './managers/LightingManager.js';
import { SPEED_CONFIG } from './constants.js';

export class Game {
  constructor() {
    this.clock = new THREE.Clock();
    this.score = 0;
    this.currentState = 'intro';
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
    this.uiIntroOverlay = document.getElementById('intro-overlay');

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

    this._handleIntroStart = this._handleIntroStart.bind(this);
    this._transitionDuration = 1.0;
    this._playElapsed = 0;
    this._setupIntro();
  }

  _handleIntroStart(e) {
    if (e.type === 'keydown' && e.code !== 'Space') return;
    e.preventDefault();
    this._startGame();
  }

  _removeIntroListeners() {
    window.removeEventListener('keydown', this._handleIntroStart);
    window.removeEventListener('click', this._handleIntroStart);
    window.removeEventListener('touchstart', this._handleIntroStart);
  }

  _setupIntro() {
    this._removeIntroListeners();
    this.currentState = 'intro';
    this.score = 0;
    this._playElapsed = 0;
    this.introTimer = 0;

    this._introCamPos = new THREE.Vector3(10, 8, -5);
    this._introCamTarget = new THREE.Vector3(0, 1, -5);
    this.camera.position.copy(this._introCamPos);
    this.camera.lookAt(this._introCamTarget);

    if (this.uiIntroOverlay) this.uiIntroOverlay.style.display = 'flex';
    if (this.uiGameOver) this.uiGameOver.style.display = 'none';

    this.player.reset();

    this.chaser.deactivate();
    this.chaser.mesh.visible = true;
    this.chaser.mesh.position.set(0, 1.4, 2);
    this.chaser.active = true;
    this._prevChaserActive = false;

    this.lighting.reset();
    this.track.reset();

    this.input.setEnabled(false);

    window.addEventListener('keydown', this._handleIntroStart);
    window.addEventListener('click', this._handleIntroStart);
    window.addEventListener('touchstart', this._handleIntroStart);
  }

  _updateIntro(delta) {
    this.introTimer += delta;

    const jumpInterval = 2.2;
    if (this.introTimer > 0.4) {
      const jumpPhase = (this.introTimer - 0.4) % jumpInterval;
      if (jumpPhase < 0.35 && !this.player.isJumping) {
        this.player.verticalVelocity = this.player.jumpForce * 0.65;
        this.player.isJumping = true;
      }
    }

    if (this.player.isJumping) {
      this.player.mesh.position.y += this.player.verticalVelocity * delta;
      this.player.verticalVelocity += this.player.gravity * delta;
      if (this.player.mesh.position.y <= 1) {
        this.player.mesh.position.y = 1;
        this.player.isJumping = false;
        this.player.verticalVelocity = 0;
      }
    }

    this.chaser.mesh.position.z += (-1 - this.chaser.mesh.position.z) * 0.25 * delta;
    this.chaser.mesh.position.x = this.player.mesh.position.x;
    this.chaser.mesh.lookAt(this.player.mesh.position.x, 1.5, this.player.mesh.position.z);

    this.lighting.update(delta, this.player.mesh.position.z);
    this.track.setLampIntensity(this.lighting.darkness);
    this.track.update(delta, SPEED_CONFIG.BASE_SPEED, this.player.mesh.position.z, this.player.currentLane);

    this.camera.position.copy(this._introCamPos);
    this.camera.lookAt(this._introCamTarget);
  }

  _startGame() {
    if (this.currentState !== 'intro') return;
    this.currentState = 'transitioning';
    this._transitionTimer = 0;

    this._removeIntroListeners();

    if (this.uiIntroOverlay) this.uiIntroOverlay.style.display = 'none';

    this.input.setEnabled(true);
    this.player.reset();

    // Chaser chạy forward (theo player) nhưng chậm dần + fade dần
    this.chaser.deactivate();
    this.chaser.mesh.visible = true;
    this._chaserZ = this.player.mesh.position.z + 8;
    this.chaser.mesh.position.set(
      this.player.mesh.position.x,
      1.4,
      this._chaserZ
    );
    this.chaser.active = true;
    this.chaser.state = this.chaser.STATE.INACTIVE;
    this._prevChaserActive = true;
    this.chaser.mesh.traverse((child) => {
      if (child.isMesh) child.material.transparent = true;
    });

    this.clock.start();
  }

  start() {
    this.animate();
  }

  restart() {
    this._setupIntro();
    this.updateUI();
    this.animate();
  }

  updateUI() {
    if (this.uiScore) this.uiScore.textContent = `Score: ${this.score}`;
    if (this.uiFinalScore) this.uiFinalScore.textContent = this.score;
    if (this.uiLives) this.uiLives.textContent = this.chaser.active ? '❤️' : '❤️❤️';
  }

  triggerGameOver() {
    this.currentState = 'game_over';
    if (this.uiGameOver) this.uiGameOver.style.display = 'flex';
    if (this.uiFinalScore) this.uiFinalScore.textContent = this.score;
  }

  animate() {
    if (this.currentState === 'game_over') return;

    requestAnimationFrame(() => this.animate());
    const delta = this.clock.getDelta();

    if (this.currentState === 'intro') {
      this._updateIntro(delta);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.currentState === 'playing') {
      this._playElapsed += delta;
    }

    const currentSpeed = Math.min(
      SPEED_CONFIG.BASE_SPEED + this._playElapsed * SPEED_CONFIG.INCREASE_RATE,
      SPEED_CONFIG.MAX_SPEED
    );
    this.player.setForwardSpeed(currentSpeed);
    this.chaser.setSpeedMultiplier(0.3 + 0.7 * (currentSpeed / SPEED_CONFIG.BASE_SPEED));

    this.lighting.update(delta, this.player.mesh.position.z);
    this.track.setLampIntensity(this.lighting.darkness);
    this.track.update(delta, currentSpeed, this.player.mesh.position.z, this.player.currentLane);
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

    const gameCamPos = new THREE.Vector3(
      this.player.mesh.position.x * 0.3,
      7 + playerCamEffect,
      this.player.mesh.position.z + 9
    );
    const gameCamTarget = new THREE.Vector3(
      this.player.mesh.position.x,
      2 + playerCamEffect,
      this.player.mesh.position.z - 6
    );

    if (this.currentState === 'transitioning') {
      this._transitionTimer += delta;
      const t = Math.min(1, this._transitionTimer / this._transitionDuration);
      const ease = t * t * (3 - 2 * t);
      this.camera.position.lerpVectors(this._introCamPos, gameCamPos, ease);
      this.camera.lookAt(
        new THREE.Vector3().lerpVectors(this._introCamTarget, gameCamTarget, ease)
      );

      // Chaser chạy forward chậm dần + mờ dần
      const chaserT = Math.min(1, t * 1.3);
      const chaserSpeed = 18 * Math.max(0, 1 - chaserT * 1.1);
      this._chaserZ -= chaserSpeed * delta;
      this.chaser.mesh.position.x = this.player.mesh.position.x;
      this.chaser.mesh.position.z = this._chaserZ;
      const chaserOpacity = 1 - chaserT;
      this.chaser.mesh.traverse((child) => {
        if (child.isMesh) child.material.opacity = chaserOpacity;
      });

      if (t >= 1) {
        this.currentState = 'playing';
        this.chaser.mesh.traverse((child) => {
          if (child.isMesh) {
            child.material.transparent = false;
            child.material.opacity = 1;
          }
        });
        this.chaser.deactivate();
        this._prevChaserActive = false;
      }
    } else {
      this.camera.position.copy(gameCamPos);
      this.camera.lookAt(gameCamTarget);
    }

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
