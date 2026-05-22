import * as THREE from 'three';
import { POWERUP } from '../constants.js';

function createStarShape() {
  const shape = new THREE.Shape();
  const points = 5;
  const outer = 1.0;
  const inner = 0.45;
  const cornerRadius = 0.25;
  const sharpPoints = [];

  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (i * Math.PI) / points + Math.PI / 2;
    sharpPoints.push(new THREE.Vector2(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius
    ));
  }

  for (let i = 0; i < sharpPoints.length; i++) {
    const p0 = sharpPoints[(i - 1 + sharpPoints.length) % sharpPoints.length];
    const p1 = sharpPoints[i];
    const p2 = sharpPoints[(i + 1) % sharpPoints.length];
    const startCurve = new THREE.Vector2()
      .copy(p1)
      .add(new THREE.Vector2().subVectors(p0, p1).normalize().multiplyScalar(cornerRadius));
    const endCurve = new THREE.Vector2()
      .copy(p1)
      .add(new THREE.Vector2().subVectors(p2, p1).normalize().multiplyScalar(cornerRadius));

    if (i === 0) shape.moveTo(startCurve.x, startCurve.y);
    else shape.lineTo(startCurve.x, startCurve.y);
    shape.quadraticCurveTo(p1.x, p1.y, endCurve.x, endCurve.y);
  }

  shape.closePath();
  return shape;
}

function createTextTexture(text, color, width = 256, height = 128, fontSize = 76) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.font = `900 ${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, width / 2, height / 2 + fontSize * 0.06);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createTextSprite(text, color, width = 256, height = 128, fontSize = 76) {
  const texture = createTextTexture(text, color, width, height, fontSize);
  return new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  }));
}

function createTextPlane(text, color, width = 256, height = 128, fontSize = 76) {
  const texture = createTextTexture(text, color, width, height, fontSize);
  return new THREE.Mesh(
    new THREE.PlaneGeometry(0.78, 0.39),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
    })
  );
}

function createStarPowerUp(cfg) {
  const group = new THREE.Group();

  const extrudeSettings = {
    depth: 0.25,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.01,
    bevelSegments: 2,
  };
  const starGeo = new THREE.ExtrudeGeometry(createStarShape(), extrudeSettings);
  starGeo.center();

  const borderMat = new THREE.MeshStandardMaterial({
    color: 0x4a2202,
    roughness: 0.4,
    metalness: 0.2,
  });
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xf2b705,
    emissive: cfg.emissive,
    emissiveIntensity: 0.18,
    roughness: 0.2,
    metalness: 0.2,
  });

  const border = new THREE.Mesh(starGeo, borderMat);
  border.castShadow = true;
  border.receiveShadow = true;
  group.add(border);

  const core = new THREE.Mesh(starGeo.clone(), coreMat);
  core.scale.set(0.85, 0.85, 1.1);
  core.position.z = 0.01;
  core.castShadow = true;
  core.receiveShadow = true;
  group.add(core);

  const frontText = createTextPlane('2x', '#4a2202');
  frontText.position.set(0, -0.04, 0.205);
  group.add(frontText);

  const backText = createTextPlane('2x', '#4a2202');
  backText.position.set(0, -0.04, -0.205);
  backText.rotation.y = Math.PI;
  backText.scale.x = -1;
  group.add(backText);

  group.userData.powerUpVisual = {
    kind: 'star',
    baseScale: 1,
    spinSpeed: 0.62,
    mesh: core,
  };

  return group;
}

function createLeftMagnetShape() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.9, 1.2);
  shape.lineTo(-0.9, 0);
  for (let th = Math.PI; th <= Math.PI * 1.5; th += 0.1) {
    shape.lineTo(Math.cos(th) * 0.9, Math.sin(th) * 0.9);
  }
  shape.lineTo(0, -0.9);
  shape.lineTo(0, -0.5);
  for (let th = Math.PI * 1.5; th >= Math.PI; th -= 0.1) {
    shape.lineTo(Math.cos(th) * 0.5, Math.sin(th) * 0.5);
  }
  shape.lineTo(-0.5, 0);
  shape.lineTo(-0.5, 1.2);
  shape.closePath();
  return shape;
}

function createRightMagnetShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0.9, 1.2);
  shape.lineTo(0.5, 1.2);
  shape.lineTo(0.5, 0);
  for (let th = 0; th >= -Math.PI * 0.5; th -= 0.1) {
    shape.lineTo(Math.cos(th) * 0.5, Math.sin(th) * 0.5);
  }
  shape.lineTo(0, -0.5);
  shape.lineTo(0, -0.9);
  for (let th = -Math.PI * 0.5; th <= 0; th += 0.1) {
    shape.lineTo(Math.cos(th) * 0.9, Math.sin(th) * 0.9);
  }
  shape.lineTo(0.9, 0);
  shape.closePath();
  return shape;
}

function createNShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.06, 0);
  shape.lineTo(0.16, 0.16);
  shape.lineTo(0.16, 0);
  shape.lineTo(0.22, 0);
  shape.lineTo(0.22, 0.25);
  shape.lineTo(0.16, 0.25);
  shape.lineTo(0.06, 0.09);
  shape.lineTo(0.06, 0.25);
  shape.lineTo(0, 0.25);
  shape.closePath();
  return shape;
}

function createMagnetPowerUp(cfg) {
  const group = new THREE.Group();
  const magnetBody = new THREE.Group();

  const redMat = new THREE.MeshStandardMaterial({
    color: 0xd9383a,
    emissive: cfg.emissive,
    emissiveIntensity: 0.08,
    roughness: 0.3,
    metalness: 0.1,
  });
  const blueMat = new THREE.MeshStandardMaterial({
    color: 0x2d72d9,
    emissive: 0x145aa0,
    emissiveIntensity: 0.07,
    roughness: 0.3,
    metalness: 0.1,
  });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const extrudeSettings = {
    depth: 0.35,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.02,
    bevelSegments: 3,
  };

  const leftMagnet = new THREE.Mesh(new THREE.ExtrudeGeometry(createLeftMagnetShape(), extrudeSettings), redMat);
  leftMagnet.position.z = -0.175;
  leftMagnet.castShadow = true;
  leftMagnet.receiveShadow = true;
  magnetBody.add(leftMagnet);

  const rightMagnet = new THREE.Mesh(new THREE.ExtrudeGeometry(createRightMagnetShape(), extrudeSettings), blueMat);
  rightMagnet.position.z = -0.175;
  rightMagnet.castShadow = true;
  rightMagnet.receiveShadow = true;
  magnetBody.add(rightMagnet);

  const textExtrudeSettings = { depth: 0.05, bevelEnabled: false };
  const meshN = new THREE.Mesh(new THREE.ExtrudeGeometry(createNShape(), textExtrudeSettings), whiteMat);
  meshN.position.set(-0.8, 0.9, 0.2);
  magnetBody.add(meshN);

  const meshNBack = new THREE.Mesh(new THREE.ExtrudeGeometry(createNShape(), textExtrudeSettings), whiteMat);
  meshNBack.position.set(-0.58, 0.9, -0.2);
  meshNBack.rotation.y = Math.PI;
  magnetBody.add(meshNBack);

  const sSprite = createTextSprite('S', '#ffffff', 128, 128, 74);
  sSprite.position.set(0.72, 1.03, 0.26);
  sSprite.scale.set(0.34, 0.34, 1);
  magnetBody.add(sSprite);

  const sBackSprite = createTextSprite('S', '#ffffff', 128, 128, 74);
  sBackSprite.position.set(0.72, 1.03, -0.26);
  sBackSprite.rotation.y = Math.PI;
  sBackSprite.scale.set(-0.34, 0.34, 1);
  magnetBody.add(sBackSprite);

  const box = new THREE.Box3().setFromObject(magnetBody);
  const center = new THREE.Vector3();
  box.getCenter(center);
  magnetBody.children.forEach((child) => {
    child.position.sub(center);
  });
  group.add(magnetBody);

  group.userData.powerUpVisual = {
    kind: 'magnet',
    baseScale: 1,
    spinSpeed: -0.32,
    redArc: leftMagnet,
    blueArc: rightMagnet,
    body: magnetBody,
  };

  return group;
}

export function createPowerUpVisual(type, cfg) {
  switch (type) {
    case POWERUP.SCORE_2X:
    case POWERUP.SCORE_4X:
      return createStarPowerUp(cfg);
    case POWERUP.MAGNET:
      return createMagnetPowerUp(cfg);
    default:
      return null;
  }
}

export function updatePowerUpVisual(object, delta, time) {
  const visual = object.userData?.powerUpVisual;
  if (!visual) return false;

  object.rotation.y += visual.spinSpeed * delta;

  const pulse = 0.5 + 0.5 * Math.sin(time * 2.4 + object.id);
  const scale = visual.baseScale * (1 + 0.025 * pulse);
  object.scale.set(scale, scale, scale);

  if (visual.mesh?.material) {
    visual.mesh.material.emissiveIntensity = 0.12 + 0.12 * pulse;
  }
  if (visual.redArc?.material) {
    visual.redArc.material.emissiveIntensity = 0.06 + 0.08 * pulse;
  }
  if (visual.blueArc?.material) {
    visual.blueArc.material.emissiveIntensity = 0.05 + 0.07 * pulse;
  }

  return true;
}
