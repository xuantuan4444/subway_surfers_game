import * as THREE from 'three';
import { POWERUP } from '../constants.js';
import { ModelManager } from '../utils/ModelManager.js';

function createRoundedStarShape() {
  const starShape = new THREE.Shape();
  const points = 5;
  const outerRadius = 1.0;
  const innerRadius = 0.45;
  const cornerRadius = 0.25;
  const sharpPoints = [];

  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    sharpPoints.push(new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
  }

  for (let i = 0; i < sharpPoints.length; i++) {
    const p0 = sharpPoints[(i - 1 + sharpPoints.length) % sharpPoints.length];
    const p1 = sharpPoints[i];
    const p2 = sharpPoints[(i + 1) % sharpPoints.length];

    const dir1 = new THREE.Vector2().subVectors(p0, p1).normalize();
    const startCurve = new THREE.Vector2().copy(p1).add(dir1.multiplyScalar(cornerRadius));

    const dir2 = new THREE.Vector2().subVectors(p2, p1).normalize();
    const endCurve = new THREE.Vector2().copy(p1).add(dir2.multiplyScalar(cornerRadius));

    if (i === 0) starShape.moveTo(startCurve.x, startCurve.y);
    else starShape.lineTo(startCurve.x, startCurve.y);
    starShape.quadraticCurveTo(p1.x, p1.y, endCurve.x, endCurve.y);
  }

  starShape.closePath();
  return starShape;
}

function createTextSprite(text, color = '#4a2202') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '900 72px Montserrat, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.85, 0.42, 1);
  sprite.userData.skipPowerUpPulse = true;
  return sprite;
}

function createScoreStar(text = '2x') {
  const group = new THREE.Group();
  const starExtrudeSettings = {
    depth: 0.25,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.01,
    bevelSegments: 2,
  };
  const totalDepth = starExtrudeSettings.depth + starExtrudeSettings.bevelThickness * 2;
  const geometry = new THREE.ExtrudeGeometry(createRoundedStarShape(), starExtrudeSettings);
  geometry.center();

  const borderMesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0x4a2202, roughness: 0.4, metalness: 0.2 })
  );
  borderMesh.castShadow = borderMesh.receiveShadow = true;
  group.add(borderMesh);

  const coreMesh = new THREE.Mesh(
    geometry.clone(),
    new THREE.MeshStandardMaterial({
      color: 0xf2b705,
      roughness: 0.2,
      metalness: 0.2,
      emissive: 0xffaa00,
      emissiveIntensity: 0.12,
    })
  );
  coreMesh.scale.set(0.85, 0.85, 1.08);
  coreMesh.position.z = 0.01;
  coreMesh.castShadow = coreMesh.receiveShadow = true;
  group.add(coreMesh);

  const label = createTextSprite(text);
  label.position.set(0, -0.02, totalDepth / 2 + 0.08);
  group.add(label);

  group.scale.setScalar(0.75);
  return group;
}

function createMagnet() {
  const group = new THREE.Group();
  const extrudeSettings = {
    depth: 0.35,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.02,
    bevelSegments: 3,
  };

  const redMaterial = new THREE.MeshStandardMaterial({ color: 0xd9383a, roughness: 0.3, metalness: 0.1 });
  const blueMaterial = new THREE.MeshStandardMaterial({ color: 0x2d72d9, roughness: 0.3, metalness: 0.1 });

  const leftMagShape = new THREE.Shape();
  leftMagShape.moveTo(-0.9, 1.2);
  leftMagShape.lineTo(-0.9, 0);
  for (let th = Math.PI; th <= Math.PI * 1.5; th += 0.1) {
    leftMagShape.lineTo(Math.cos(th) * 0.9, Math.sin(th) * 0.9);
  }
  leftMagShape.lineTo(0, -0.9);
  leftMagShape.lineTo(0, -0.5);
  for (let th = Math.PI * 1.5; th >= Math.PI; th -= 0.1) {
    leftMagShape.lineTo(Math.cos(th) * 0.5, Math.sin(th) * 0.5);
  }
  leftMagShape.lineTo(-0.5, 0);
  leftMagShape.lineTo(-0.5, 1.2);
  leftMagShape.closePath();

  const leftMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(leftMagShape, extrudeSettings), redMaterial);
  leftMesh.position.z = -0.175;
  leftMesh.castShadow = leftMesh.receiveShadow = true;
  group.add(leftMesh);

  const rightMagShape = new THREE.Shape();
  rightMagShape.moveTo(0.9, 1.2);
  rightMagShape.lineTo(0.5, 1.2);
  rightMagShape.lineTo(0.5, 0);
  for (let th = 0; th >= -Math.PI * 0.5; th -= 0.1) {
    rightMagShape.lineTo(Math.cos(th) * 0.5, Math.sin(th) * 0.5);
  }
  rightMagShape.lineTo(0, -0.5);
  rightMagShape.lineTo(0, -0.9);
  for (let th = -Math.PI * 0.5; th <= 0; th += 0.1) {
    rightMagShape.lineTo(Math.cos(th) * 0.9, Math.sin(th) * 0.9);
  }
  rightMagShape.lineTo(0.9, 0);
  rightMagShape.closePath();

  const rightMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(rightMagShape, extrudeSettings), blueMaterial);
  rightMesh.position.z = -0.175;
  rightMesh.castShadow = rightMesh.receiveShadow = true;
  group.add(rightMesh);

  const nLabel = createTextSprite('N', '#ffffff');
  nLabel.position.set(-0.68, 1.02, 0.24);
  nLabel.scale.set(0.28, 0.2, 1);
  group.add(nLabel);

  const sLabel = createTextSprite('S', '#ffffff');
  sLabel.position.set(0.68, 1.02, 0.24);
  sLabel.scale.set(0.28, 0.2, 1);
  group.add(sLabel);

  group.position.y = -0.1;
  group.scale.setScalar(0.58);
  return group;
}

function normalizeModel(model, targetSize = 1.45) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) return model;

  const size = box.getSize(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z);
  const scale = targetSize / Math.max(maxSize, 0.001);
  model.scale.multiplyScalar(scale);

  model.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(model);
  const center = scaledBox.getCenter(new THREE.Vector3());
  const minY = scaledBox.min.y;
  model.position.sub(center);
  model.position.y += (center.y - minY) - targetSize * 0.45;
  return model;
}

function createSneakers() {
  const group = new THREE.Group();
  const shoe = ModelManager.get('TwinkleToesShoe');
  if (shoe) {
    shoe.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    shoe.rotation.y = Math.PI / 2;
    group.add(normalizeModel(shoe));
  } else {
    const fallback = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.45, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x44ff44, emissive: 0x00aa00, emissiveIntensity: 0.2 })
    );
    fallback.castShadow = fallback.receiveShadow = true;
    group.add(fallback);
  }
  return group;
}

function createRandomTeapot() {
  const group = new THREE.Group();
  const blueMat = new THREE.MeshStandardMaterial({
    color: 0x9ee9ff,
    emissive: 0x45bde8,
    emissiveIntensity: 0.18,
    roughness: 0.28,
    metalness: 0.22,
  });
  const darkBlueMat = new THREE.MeshStandardMaterial({
    color: 0x2d7ea3,
    emissive: 0x174d68,
    emissiveIntensity: 0.08,
    roughness: 0.32,
    metalness: 0.18,
  });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.72, 28, 18), blueMat);
  body.scale.set(1.1, 0.78, 0.85);
  body.castShadow = body.receiveShadow = true;
  group.add(body);

  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.18, 24), darkBlueMat);
  lid.position.y = 0.58;
  lid.castShadow = lid.receiveShadow = true;
  group.add(lid);

  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10), blueMat);
  knob.position.y = 0.75;
  knob.castShadow = knob.receiveShadow = true;
  group.add(knob);

  const spout = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.85, 18), blueMat);
  spout.position.set(0.8, 0.14, 0);
  spout.rotation.z = -Math.PI / 2.7;
  spout.castShadow = spout.receiveShadow = true;
  group.add(spout);

  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.08, 12, 32), blueMat);
  handle.position.set(-0.72, 0.08, 0);
  handle.rotation.y = Math.PI / 2;
  handle.scale.set(0.78, 1.05, 1);
  handle.castShadow = handle.receiveShadow = true;
  group.add(handle);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.58, 0.14, 24), darkBlueMat);
  base.position.y = -0.55;
  base.castShadow = base.receiveShadow = true;
  group.add(base);

  group.scale.setScalar(0.75);
  return group;
}

export function createPowerUpVisual(type) {
  switch (type) {
    case POWERUP.SCORE_2X:
      return createScoreStar('2x');
    case POWERUP.SCORE_4X:
      return createScoreStar('4x');
    case POWERUP.MAGNET:
      return createMagnet();
    case POWERUP.SNEAKERS:
      return createSneakers();
    case POWERUP.RANDOM_TEAPOT:
      return createRandomTeapot();
    default:
      return createScoreStar('2x');
  }
}
