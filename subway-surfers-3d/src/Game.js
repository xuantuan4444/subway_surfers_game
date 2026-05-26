import * as THREE from 'three';
import { Player } from './entities/Player.js';
import { TrackManager } from './managers/TrackManager.js';
import { InputManager } from './managers/InputManager.js';
import { CollisionManager } from './managers/CollisionManager.js';
import { Chaser } from './entities/Chaser.js';
import { AudioManager } from './managers/AudioManager.js';
import { LightingManager } from './managers/LightingManager.js';
import { SPEED_CONFIG, POWERUP, POWERUP_CONFIG } from './constants.js';

export class Game {
  constructor() {
    this.clock = new THREE.Clock();
    this.score = 0;
    this.coinCount = 0;
    this.currentState = 'intro';
    this._stateBeforePause = null;
    this._prevChaserActive = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xa9e4ff);
    this.scene.fog = new THREE.Fog(0xa9e4ff, 18, 180);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 7, 8);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.8;
    document.body.appendChild(this.renderer.domElement);

    this.lighting = new LightingManager(this.scene);

    this.audio = new AudioManager().init();
    this.track = new TrackManager(this.scene);
    this.player = new Player(this.scene, this.audio);
    this.input = new InputManager(this.player);
    this.collision = new CollisionManager();
    this.chaser = new Chaser(this.scene);

    this.uiScore = document.getElementById('score');
    this.uiCoinCount = document.getElementById('coin-count');
    this.uiCoinValue = document.getElementById('coin-value');
    this.uiPauseBtn = document.getElementById('pause-btn');
    this.uiPauseMenu = document.getElementById('pause-menu');
    this.uiContinueBtn = document.getElementById('continue-btn');
    this.uiNewGameBtn = document.getElementById('new-game-btn');
    this.uiQuitBtn = document.getElementById('quit-btn');
    this.uiGameOver = document.getElementById('game-over');
    this.uiFinalScore = document.getElementById('final-score');
    this.uiFinalCoins = document.getElementById('final-coins');
    this.uiRestartBtn = document.getElementById('restart-btn');
    this.uiGameOverQuitBtn = document.getElementById('game-over-quit-btn');
    this.uiIntroOverlay = document.getElementById('intro-overlay');
    this.uiPowerUpHud = document.getElementById('powerup-hud');

    if (this.uiRestartBtn) this.uiRestartBtn.addEventListener('click', () => this.retryGame());
    if (this.uiGameOverQuitBtn) this.uiGameOverQuitBtn.addEventListener('click', () => this.quitGameWindow());
    if (this.uiPauseBtn) this.uiPauseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePause();
    });
    if (this.uiContinueBtn) this.uiContinueBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.resumeFromPause();
    });
    if (this.uiNewGameBtn) this.uiNewGameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.startNewGameFromPause();
    });
    if (this.uiQuitBtn) this.uiQuitBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.quitToIntro();
    });

    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        this.togglePause();
      }
    });
    this.updateUI();

    this._audioLoadPromise = this.audio.loadManifest({
      sfx: {
        coin: 'coin.mp3',
        click: 'Click.wav',
        death: 'Death.mp3',
        landing: 'Landing.wav',
        sideHit: 'SideHit.wav',
        powerup: 'Powerup.mp3',
        trainLanding: 'TrainLanding.wav',
        outro: 'outro.mp3',
        alo1: 'alo 1.mp3',
        alo2: 'alo 2.mp3',
        alo3: 'alo 3.mp3',
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
        theme: 'theme.mp3',
      },
    });

    this._handleIntroStart = this._handleIntroStart.bind(this);
    this._transitionDuration = 1.0;
    this._playElapsed = 0;
    this.scoreMultiplier = 1;
    this._magnetTimer = 0;
    this._sneakersTimer = 0;
    this._aloIndex = 0;
    this._outroTimer = 0;
    this._outroFrozen = false;
    this._shakeIntensity = 0;
    this._shakeOffset = new THREE.Vector3();
    this._magnetScaleVec = new THREE.Vector3(1, 1, 1);
    this._setupIntro();
  }

  _handleIntroStart(e) {
    if (e.type === 'keydown' && e.code !== 'Space') return;
    e.preventDefault();
    this.audio.play('click', { volume: 0.5 });
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
    this.coinCount = 0;
    this._stateBeforePause = null;
    this._playElapsed = 0;
    this.introTimer = 0;
    this.scoreMultiplier = 1;
    this._magnetTimer = 0;
    this._sneakersTimer = 0;
    this._introCamPos = new THREE.Vector3(6, 5.5, -5);
    this._introCamTarget = new THREE.Vector3(1, 3, -5);
    this.camera.position.copy(this._introCamPos);
    this.camera.lookAt(this._introCamTarget);

    if (this.uiIntroOverlay) this.uiIntroOverlay.style.display = 'flex';
    if (this.uiGameOver) this.uiGameOver.style.display = 'none';

    this.player.reset();
    this.collision.reset();
    this.player.playStandAnimation();

    this.chaser.deactivate();
    this.chaser.resumeAnimation();
    this.chaser.mesh.visible = true;
    this.chaser.mesh.position.set(0, 0, -3);;
    this.chaser.active = true;
    this._prevChaserActive = false;

    this.lighting.reset();
    this.track.reset({ includeCoins: false });

    this.input.setEnabled(false);

    window.addEventListener('keydown', this._handleIntroStart);
    window.addEventListener('click', this._handleIntroStart);
    window.addEventListener('touchstart', this._handleIntroStart);
  }

  _updateIntro(delta) {
    this.introTimer += delta;

    if (this.player.mixer) this.player.mixer.update(delta);
    if (this.chaser.mixer) this.chaser.mixer.update(delta);

    this.chaser.mesh.position.x = this.player.mesh.position.x;
    this.chaser.mesh.position.y = this.player.mesh.position.y;
    {
        const dx = this.player.mesh.position.x - this.chaser.mesh.position.x;
        const dz = this.player.mesh.position.z - this.chaser.mesh.position.z;
        this.chaser.mesh.rotation.y = Math.atan2(dx, dz);
    }

    this.lighting.update(delta, this.player.mesh.position.z);
    this.track.setLampIntensity(this.lighting.darkness);
    this.track.update(delta, SPEED_CONFIG.BASE_SPEED, this.player.mesh.position.z, this.player.currentLane);

    this.camera.position.copy(this._introCamPos);
    this.camera.lookAt(this._introCamTarget);
  }

  _startGame() {
    if (this.currentState !== 'intro') return;
    this.currentState = 'transitioning';
    this._stateBeforePause = null;
    this._transitionTimer = 0;

    this._removeIntroListeners();

    if (this.uiIntroOverlay) this.uiIntroOverlay.style.display = 'none';

    this.input.setEnabled(true);
    this.player.reset();
    this.collision.reset();
    this.track.reset();
    this.chaser.playRunAnimation();

    this._prevChaserActive = true;
    this.chaser.mesh.position.set(
      this.player.mesh.position.x,
      this.player.mesh.position.y,
      this.player.mesh.position.z + 2
    );
    this._chaserTransitionOffset = 2;

    this._audioLoadPromise.then(() => {
      if (this.currentState !== 'game_over' && this.currentState !== 'outro') {
        console.log('[Game] Audio manifest loaded, starting theme');
        this.audio.playMusic('theme');
      }
    });
    this.clock.start();
  }

  togglePause() {
    if (this.currentState === 'paused') {
      this.resumeFromPause();
      return;
    }

    if (this.currentState !== 'playing' && this.currentState !== 'transitioning') return;

    this._stateBeforePause = this.currentState;
    this.currentState = 'paused';
    this.input.setEnabled(false);
    this.updateUI();
  }

  resumeFromPause() {
    if (this.currentState !== 'paused') return;
    this.currentState = this._stateBeforePause || 'playing';
    this._stateBeforePause = null;
    this.input.setEnabled(true);
    this.clock.getDelta();
    this.updateUI();
  }

  startNewGameFromPause() {
    if (this.currentState !== 'paused') return;
    this.audio.stopMusic(0.2);
    this._setupIntro();
    this.updateUI();
  }

  quitToIntro() {
    if (this.currentState !== 'paused') return;
    this.audio.stopMusic(0.2);
    this._setupIntro();
    this.updateUI();
  }

  _startOutro() {
    this.currentState = 'outro';
    this._outroTimer = 0;
    this._outroFrozen = false;
    this.input.setEnabled(false);

    this._outroStartChaserZ = this.chaser.mesh.position.z;
    this._outroTargetChaserZ = this.player.mesh.position.z + 1.5;

    this.chaser.playWinAnimation();
    this.player.die();
    this._shakeIntensity = 0.6;
    this.audio.stopMusic(0.5);
    this.audio.play('death', { volume: 0.6 });
  }

  _updateOutro(delta) {
    this._outroTimer += delta;

    if (this._outroTimer < 1.0) {
      const t = this._outroTimer / 1.0;
      const ease = t * t * (3 - 2 * t);
      const z = THREE.MathUtils.lerp(this._outroStartChaserZ, this._outroTargetChaserZ, ease);
      this.chaser.mesh.position.z = z;
      this.chaser.mesh.position.x = this.player.mesh.position.x;
      this.chaser.mesh.position.y = this.player.mesh.position.y;
      const dx = this.player.mesh.position.x - this.chaser.mesh.position.x;
      const dz = this.player.mesh.position.z - this.chaser.mesh.position.z;
      this.chaser.mesh.rotation.y = Math.atan2(dx, dz);
      if (this.chaser.mixer) this.chaser.mixer.update(delta);
      if (this.player.mixer) this.player.mixer.update(delta);
    } else if (this._outroTimer < 4.0) {
      if (!this._outroFrozen) {
        this._outroFrozen = true;
        this.chaser.mesh.position.z = this.player.mesh.position.z + 1.5;
        this.chaser.mesh.position.x = this.player.mesh.position.x;
        this.audio.play('outro', { volume: 0.6 });
      }
      if (this.chaser.mixer) this.chaser.mixer.update(delta);
      if (this.player.mixer) this.player.mixer.update(delta);
      this.lighting.update(delta, this.player.mesh.position.z);
      this.track.setLampIntensity(this.lighting.darkness);
      this.track.update(delta, this.player.forwardSpeed, this.player.mesh.position.z, this.player.currentLane);
    } else {
      this.triggerGameOver(true);
      return;
    }

    const effectivePlayerY = Math.max(this.player.mesh.position.y + 1, this.player.currentGroundY + 1);
    const camOffset = effectivePlayerY - 1;
    const playerCamEffect = (camOffset > 0.05 ? camOffset : 0) * 0.4;

    this.camera.position.set(
      this.player.mesh.position.x * 0.3,
      7 + playerCamEffect,
      this.player.mesh.position.z + 9
    );
    this.camera.lookAt(
      this.player.mesh.position.x,
      2 + playerCamEffect,
      this.player.mesh.position.z - 6
    );
  }

  _applyShake(delta) {
    if (this._shakeIntensity > 0.01) {
      this.camera.position.x += (Math.random() - 0.5) * this._shakeIntensity * 0.8;
      this.camera.position.y += (Math.random() - 0.5) * this._shakeIntensity * 0.6;
      this.camera.position.z += (Math.random() - 0.5) * this._shakeIntensity * 0.4;
      this._shakeIntensity *= Math.max(0, 1 - 8 * delta);
    } else {
      this._shakeIntensity = 0;
    }
  }

  start() {
    this.animate();
  }

  restart() {
    this._setupIntro();
    this.updateUI();
    this.animate();
  }

  retryGame() {
    this.audio.stopMusic(0.1);
    this._setupIntro();
    this.updateUI();
    this._startGame();
    this.animate();
  }

  quitGameWindow() {
    this.audio.stopMusic(0.1);
    window.open('', '_self');
    window.close();
    setTimeout(() => {
      if (!document.hidden && this.currentState === 'game_over') {
        this._setupIntro();
        this.updateUI();
        this.animate();
      }
    }, 250);
  }

  updateUI() {
    if (this.uiScore) {
      let text = `Score: ${this.score}`;
      if (this.scoreMultiplier > 1) text += `  ×${this.scoreMultiplier}`;
      this.uiScore.textContent = text;
    }
    if (this.uiCoinValue) this.uiCoinValue.textContent = this.coinCount;
    if (this.uiFinalScore) this.uiFinalScore.textContent = this.score;
    if (this.uiFinalCoins) this.uiFinalCoins.textContent = this.coinCount;
    if (this.uiPauseBtn) {
      this.uiPauseBtn.classList.toggle('is-paused', this.currentState === 'paused');
      this.uiPauseBtn.setAttribute('aria-pressed', this.currentState === 'paused' ? 'true' : 'false');
      this.uiPauseBtn.title = this.currentState === 'paused' ? 'Continue' : 'Pause';
      this.uiPauseBtn.setAttribute('aria-label', this.currentState === 'paused' ? 'Continue game' : 'Pause game');
    }
    if (this.uiPauseMenu) {
      this.uiPauseMenu.style.display = this.currentState === 'paused' ? 'flex' : 'none';
    }

    if (this.uiPowerUpHud) {
      const parts = [];
      if (this._magnetTimer > 0) parts.push(`🧲 ${Math.ceil(this._magnetTimer)}s`);
      if (this._sneakersTimer > 0) parts.push(`👟 ${Math.ceil(this._sneakersTimer)}s`);
      this.uiPowerUpHud.textContent = parts.join('  ');
      this.uiPowerUpHud.style.display = parts.length > 0 ? 'block' : 'none';
    }
  }

  triggerGameOver(skipSound) {
    this.currentState = 'game_over';
    if (!skipSound) this.audio.play('death', { volume: 0.6 });
    if (this.uiGameOver) this.uiGameOver.style.display = 'flex';
    if (this.uiFinalScore) this.uiFinalScore.textContent = this.score;
    if (this.uiFinalCoins) this.uiFinalCoins.textContent = this.coinCount;
  }

  animate() {
    if (this.currentState === 'game_over') return;

    requestAnimationFrame(() => this.animate());
    const delta = this.clock.getDelta();

    if (this.currentState === 'paused') {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.currentState === 'intro') {
      this._updateIntro(delta);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.currentState === 'outro') {
      this._updateOutro(delta);
      this._applyShake(delta);
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

    this.lighting.update(delta, this.player.mesh.position.z);
    this.track.setLampIntensity(this.lighting.darkness);
    this.track.update(delta, currentSpeed, this.player.mesh.position.z, this.player.currentLane);
    this.player.update(delta, this.track.chunks);

    this.chaser.update(delta, this.player.mesh, currentSpeed, this.player);

    if (this._prevChaserActive !== this.chaser.active) {
      this._prevChaserActive = this.chaser.active;
      this.updateUI();
    }

    const collisionResult = this.collision.checkCollisions(this.player, this.track.chunks);

    if (collisionResult.coinsCollected > 0) {
      this.coinCount += collisionResult.coinsCollected;
      this.score += collisionResult.coinsCollected * 10 * this.scoreMultiplier;
      this.updateUI();
      this.audio.play('coin', {
        volume: 0.35,
        filter: { type: 'lowpass', frequency: 600, Q: 0.5 },
        compressor: { threshold: -20, ratio: 8 },
      });
    }

    for (const puType of (collisionResult.collectedPowerUps || [])) {
      this._activatePowerUp(puType);
      this.audio.play('powerup', { volume: 0.6 });
    }

    // Decrement power-up timers
    if (this._magnetTimer > 0) {
      this._magnetTimer -= delta;
      if (this._magnetTimer <= 0) {
        this._magnetTimer = 0;
        this._resetMagnetCoinScales();
      } else {
        this._updateMagnet(delta);
      }
    }
    if (this._sneakersTimer > 0) {
      this._sneakersTimer -= delta;
      if (this._sneakersTimer <= 0) {
        this.player.jumpForce = 15;
        this.player.gravity = -45;
        this.player.hasSneakers = false;
        this._sneakersTimer = 0;
      }
    }
    if (collisionResult.hitType) {
      this.resolveCollision(collisionResult);
    }

    const effectivePlayerY = Math.max(this.player.mesh.position.y + 1, this.player.currentGroundY + 1);
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

      if (t < 0.15) {
        this._chaserTransitionOffset = 2;
      } else {
        const phase = (t - 0.15) / 0.85;
        const ease2 = phase * phase * (3 - 2 * phase);
        this._chaserTransitionOffset = THREE.MathUtils.lerp(2, this.chaser.idleDistance, ease2);
      }
      this.chaser.mesh.position.x = this.player.mesh.position.x;
      this.chaser.mesh.position.y = this.player.mesh.position.y;
      this.chaser.mesh.position.z = this.player.mesh.position.z + this._chaserTransitionOffset;
      {
        const dx = this.player.mesh.position.x - this.chaser.mesh.position.x;
        const dz = this.player.mesh.position.z - this.chaser.mesh.position.z;
        this.chaser.mesh.rotation.y = Math.atan2(dx, dz);
      }

      if (t >= 1) {
        this.currentState = 'playing';
        this.chaser.active = false;
      }
    } else {
      this.camera.position.copy(gameCamPos);
      this.camera.lookAt(gameCamTarget);
    }

    this._applyShake(delta);
    this.renderer.render(this.scene, this.camera);
  }

  _activatePowerUp(type) {
    if (type === POWERUP.RANDOM_TEAPOT) {
      const randomPool = [POWERUP.SCORE_2X, POWERUP.MAGNET, POWERUP.SNEAKERS];
      type = randomPool[Math.floor(Math.random() * randomPool.length)];
    }

    const cfg = POWERUP_CONFIG[type];
    if (!cfg) return;
    switch (type) {
      case POWERUP.SCORE_2X:
        this.scoreMultiplier *= 2;
        break;
      case POWERUP.SCORE_4X:
        this.scoreMultiplier *= 4;
        break;
      case POWERUP.MAGNET:
        this._magnetTimer = cfg.duration;
        break;
      case POWERUP.SNEAKERS:
        this.player.jumpForce = 20;
        this.player.gravity = -40;
        this.player.hasSneakers = true;
        this._sneakersTimer = cfg.duration;
        break;
    }
    this.updateUI();
  }

  _updateMagnet(delta) {
    const radius = 10;
    const playerPos = this.player.mesh.position;
    const coinWorldPos = new THREE.Vector3();
    for (const chunk of this.track.chunks) {
      chunk.traverse((child) => {
        if (child.userData?.type !== 'coin' || child.userData.collected) return;
        child.getWorldPosition(coinWorldPos);
        const dx = playerPos.x - coinWorldPos.x;
        const dz = playerPos.z - coinWorldPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < radius && dist > 0.3) {
          const speed = Math.max(25, this.player.forwardSpeed + 10);
          child.position.x += (dx / dist) * speed * delta;
          child.position.z += (dz / dist) * speed * delta;
          const t = 1 - dist / radius;
          const scale = 1 + 0.8 * Math.sin(Math.PI * t);
          this._magnetScaleVec.set(scale, scale, scale);
          child.scale.lerp(this._magnetScaleVec, Math.min(1, 10 * delta));
          child.userData.magnetScaled = true;
        } else if (child.userData.magnetScaled) {
          this._magnetScaleVec.set(1, 1, 1);
          child.scale.lerp(this._magnetScaleVec, Math.min(1, 8 * delta));
          if (Math.abs(child.scale.x - 1) < 0.02) {
            child.scale.set(1, 1, 1);
            child.userData.magnetScaled = false;
          }
        }
      });
    }
  }

  _resetMagnetCoinScales() {
    for (const chunk of this.track.chunks) {
      chunk.traverse((child) => {
        if (child.userData?.type !== 'coin' || !child.userData.magnetScaled) return;
        child.scale.set(1, 1, 1);
        child.userData.magnetScaled = false;
      });
    }
  }

  resolveCollision(collisionResult) {
    const { hitType, hitLane } = collisionResult;

    if (hitType === 'front') {
      this._startOutro();
      return;
    }

    if (hitType === 'side') {
      if (this.player.returningToLane) return;
      if (this.chaser.active) { this._startOutro(); return; }
      this.audio.play('sideHit', { volume: 0.5 });
      this.audio.play(`alo${this._aloIndex + 1}`, { volume: 0.6 });
      this._aloIndex = (this._aloIndex + 1) % 3;
      this.chaser.activate();
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
