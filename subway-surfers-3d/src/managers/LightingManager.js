import * as THREE from 'three';

const CYCLE_DURATION = 90;

const DAY_COLOR = new THREE.Color(0x99ddff);
const SUNSET_COLOR = new THREE.Color(0xff8844);
const NIGHT_COLOR = new THREE.Color(0x1a1a3e);

const DAY_SUN_COLOR = new THREE.Color(0xfffff0);
const SUNSET_SUN_COLOR = new THREE.Color(0xffaa33);
const NIGHT_SUN_COLOR = new THREE.Color(0x4444aa);

const DAY_AMBIENT_COLOR = new THREE.Color(0xffffff);
const NIGHT_AMBIENT_COLOR = new THREE.Color(0x445577);

const DAY_HEMI_SKY = new THREE.Color(0x6699ff);
const NIGHT_HEMI_SKY = new THREE.Color(0x223355);
const DAY_HEMI_GROUND = new THREE.Color(0x996644);
const NIGHT_HEMI_GROUND = new THREE.Color(0x333344);

function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(255,255,220,1)');
  gradient.addColorStop(0.1, 'rgba(255,220,160,0.9)');
  gradient.addColorStop(0.3, 'rgba(255,180,80,0.5)');
  gradient.addColorStop(0.6, 'rgba(255,120,40,0.15)');
  gradient.addColorStop(1, 'rgba(255,80,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

export class LightingManager {
  constructor(scene) {
    this.scene = scene;
    this.elapsed = 0;

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1);
    this.dirLight.position.set(-40, 30, 0);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 4096;
    this.dirLight.shadow.mapSize.height = 4096;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 90;
    this.dirLight.shadow.camera.left = -14;
    this.dirLight.shadow.camera.right = 14;
    this.dirLight.shadow.camera.top = 16;
    this.dirLight.shadow.camera.bottom = -6;
    this.dirLight.shadow.bias = -0.0002;
    this.dirLight.shadow.normalBias = 0.05;
    this.dirLight.shadow.radius = 4;
    this.dirLight.target.position.set(0, 0, 0);
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x6699ff, 0x996644, 0.5);
    this.scene.add(this.hemiLight);

    const sunGeo = new THREE.SphereGeometry(4, 24, 24);
    const sunMat = new THREE.MeshBasicMaterial({
      color: 0xfff0dd,
      transparent: true,
      depthWrite: false,
    });
    this.sunSphere = new THREE.Mesh(sunGeo, sunMat);
    this.sunSphere.renderOrder = 9999;
    this.scene.add(this.sunSphere);

    this.sunGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createGlowTexture(),
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        depthTest: false,
        sizeAttenuation: true,
        toneMapped: false,
      })
    );
    this.sunGlow.renderOrder = 9998;
    this.sunGlow.scale.set(70, 70, 1);
    this.scene.add(this.sunGlow);

    this._dayFogNear = 15;
    this._dayFogFar = 150;
    this._nightFogNear = 8;
    this._nightFogFar = 70;
  }

  update(delta, playerZ = 0) {
    this.elapsed += delta;

    // Oscillating cycle: bắt đầu từ noon (sin=1), xuống night (sin=-1), rồi về noon
    const angle = this.elapsed * Math.PI / CYCLE_DURATION + Math.PI / 2;
    const brightness = Math.sin(angle); // -1 (night) to 1 (day)
    const norm = brightness * 0.5 + 0.5; // 0 (night) to 1 (day)

    // Sun position: oscillates center→right→center→left→center, up→down
    const sunRel = new THREE.Vector3(
      -Math.cos(angle) * 45,
      8 + Math.sin(angle) * 20,
      -55
    );
    const sunWorld = new THREE.Vector3(sunRel.x, sunRel.y, playerZ + sunRel.z);

    this.dirLight.position.copy(sunWorld);
    this.dirLight.target.position.set(0, 0, playerZ);
    this.sunSphere.position.copy(sunWorld);
    this.sunGlow.position.copy(sunWorld);

    // Tạo sunset/dawn glow khi norm ~0.5 (hoàng hôn/bình minh)
    const glowFactor = Math.max(0, 1 - Math.abs(norm - 0.5) * 4); // 0→1→0, peaks at 0.5

    let sunIntensity = THREE.MathUtils.smoothstep(norm, 0.2, 0.9) * 1.2;
    let skyColor = DAY_COLOR.clone().lerp(NIGHT_COLOR, 1 - norm);
    let sunColor = DAY_SUN_COLOR.clone().lerp(NIGHT_SUN_COLOR, 1 - norm);
    let ambientColor = DAY_AMBIENT_COLOR.clone().lerp(NIGHT_AMBIENT_COLOR, 1 - norm);
    let ambientIntensity = THREE.MathUtils.lerp(0.35, 0.7, norm);
    let hemiSky = DAY_HEMI_SKY.clone().lerp(NIGHT_HEMI_SKY, 1 - norm);
    let hemiGround = DAY_HEMI_GROUND.clone().lerp(NIGHT_HEMI_GROUND, 1 - norm);
    let hemiIntensity = THREE.MathUtils.lerp(0.25, 0.5, norm);

    // Sunset/dawn tint
    if (glowFactor > 0) {
      skyColor.lerp(SUNSET_COLOR, glowFactor * 0.6);
      sunColor.lerp(SUNSET_SUN_COLOR, glowFactor * 0.5);
      ambientColor.lerp(new THREE.Color(0xff8844), glowFactor * 0.15);
    }

    this.dirLight.color.copy(sunColor);
    this.dirLight.intensity = sunIntensity;
    this.darkness = 1 - sunIntensity;

    this.dirLight.shadow.camera.left = -14;
    this.dirLight.shadow.camera.right = 14;
    this.dirLight.shadow.camera.top = 16;
    this.dirLight.shadow.camera.bottom = -6;

    this.ambientLight.color.copy(ambientColor);
    this.ambientLight.intensity = ambientIntensity;
    this.hemiLight.color.copy(hemiSky);
    this.hemiLight.groundColor.copy(hemiGround);
    this.hemiLight.intensity = hemiIntensity;

    this.scene.background.copy(skyColor);

    const fogNear = THREE.MathUtils.lerp(this._dayFogNear, this._nightFogNear, 1 - sunIntensity);
    const fogFar = THREE.MathUtils.lerp(this._dayFogFar, this._nightFogFar, 1 - sunIntensity);
    if (this.scene.fog) {
      this.scene.fog.color.copy(skyColor);
      this.scene.fog.near = fogNear;
      this.scene.fog.far = fogFar;
    }

    this.sunSphere.material.color.copy(sunColor);
    this.sunSphere.material.opacity = Math.min(1, sunIntensity * 2);
    this.sunSphere.visible = sunIntensity > 0.03;

    this.sunGlow.material.opacity = 0.4 + 0.6 * sunIntensity;
    this.sunGlow.material.color.copy(sunColor);
    this.sunGlow.visible = sunIntensity > 0.03;

    this.dirLight.shadow.camera.updateProjectionMatrix();
  }

  reset() {
    this.elapsed = 0;
  }

  dispose() {
    this.scene.remove(this.dirLight);
    this.scene.remove(this.ambientLight);
    this.scene.remove(this.hemiLight);
    this.scene.remove(this.sunSphere);
    this.scene.remove(this.sunGlow);
    this.sunSphere.geometry.dispose();
    this.sunSphere.material.dispose();
    this.sunGlow.material.map.dispose();
    this.sunGlow.material.dispose();
  }
}
