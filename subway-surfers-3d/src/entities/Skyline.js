import * as THREE from 'three';

export class ParallaxSkyline {
  constructor(THREE) {
    this.THREE = THREE;

    this.scene  = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.layers = [
      {
        name: 'sky',
        canvasW: 1024, canvasH: 512, speed: 0,
        yOffset: 0, yScale: 1,
        draw: this._drawSky.bind(this),
      },
      {
        name: 'stars',
        canvasW: 2048, canvasH: 512, speed: 0.03,
        yOffset: 0, yScale: 1,
        draw: this._drawStars.bind(this),
      },
      {
        name: 'moon',
        canvasW: 1024, canvasH: 512, speed: 0.05,
        yOffset: 0, yScale: 1,
        draw: this._drawMoon.bind(this),
      },
      {
        name: 'far_city',
        canvasW: 4096, canvasH: 512, speed: 0.15,
        yOffset: 0, yScale: 0.55,
        draw: (ctx, W, H) => this._drawBuildings(ctx, W, H, {
          minH: 0.15, maxH: 0.38, minW: 30, maxW: 70, count: 80,
          colorBase: [40, 45, 70], colorVar: 15,
          windowColor: 'rgba(255,240,180,0.55)', windowProb: 0.55,
          glowColor: 'rgba(60,80,160,0.18)',
        }),
      },
      {
        name: 'mid_city',
        canvasW: 4096, canvasH: 512, speed: 0.40,
        yOffset: 0, yScale: 0.65,
        draw: (ctx, W, H) => this._drawBuildings(ctx, W, H, {
          minH: 0.25, maxH: 0.55, minW: 45, maxW: 100, count: 55,
          colorBase: [22, 26, 42], colorVar: 12,
          windowColor: 'rgba(255,220,130,0.65)', windowProb: 0.45,
          glowColor: 'rgba(30,50,120,0.22)', antenna: true,
        }),
      },
      {
        name: 'near_city',
        canvasW: 4096, canvasH: 512, speed: 0.80,
        yOffset: 0, yScale: 0.72,
        draw: (ctx, W, H) => this._drawBuildings(ctx, W, H, {
          minH: 0.35, maxH: 0.70, minW: 60, maxW: 140, count: 35,
          colorBase: [10, 12, 20], colorVar: 8,
          windowColor: 'rgba(255,200,80,0.70)', windowProb: 0.35,
          glowColor: 'rgba(20,35,90,0.28)', antenna: true, neon: true,
        }),
      },
    ];

    this._textures = [];
    this._meshes = [];
    this._offsets = [];
    this._nightFactor = 0;
    this._skyCanvas = null;

    this._build();
  }

  setNightFactor(factor) {
    this._nightFactor = Math.max(0, Math.min(1, factor));
    if (this._skyCanvas) {
      const ctx = this._skyCanvas.getContext('2d');
      this._drawSkyGradient(ctx, this._skyCanvas.width, this._skyCanvas.height, this._nightFactor);
      this._textures[0].needsUpdate = true;
    }
  }

  update(speed = 0.5) {
    this.layers.forEach((layer, i) => {
      this._offsets[i] = (this._offsets[i] + speed * layer.speed * 0.001) % 1;
      this._textures[i].offset.x = this._offsets[i];
      this._textures[i].needsUpdate = false;
    });
    if (this._meshes[1]) this._meshes[1].material.opacity = this._nightFactor;
    if (this._meshes[2]) this._meshes[2].material.opacity = this._nightFactor * 0.9;
  }

  render(renderer) {
    renderer.render(this.scene, this.camera);
  }

  _build() {
    const T = this.THREE;

    this.layers.forEach((layer, i) => {
      const canvas = document.createElement('canvas');
      canvas.width = layer.canvasW;
      canvas.height = layer.canvasH;
      const ctx = canvas.getContext('2d');
      if (i === 0) {
        this._skyCanvas = canvas;
        this._drawSkyGradient(ctx, canvas.width, canvas.height, this._nightFactor);
      } else {
        layer.draw(ctx, layer.canvasW, layer.canvasH);
      }

      const tex = new T.CanvasTexture(canvas);
      tex.wrapS = T.RepeatWrapping;
      tex.repeat.x = 2;
      this._textures[i] = tex;
      this._offsets[i] = 0;

      const geo = new T.PlaneGeometry(2, layer.yScale * 2);
      const mat = new T.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: T.DoubleSide,
      });

      const mesh = new T.Mesh(geo, mat);
      mesh.position.y = layer.yOffset;
      mesh.position.z = -0.5 + i * 0.001;
      mesh.renderOrder = i;
      this._meshes[i] = mesh;
      this.scene.add(mesh);
    });
  }

  _drawSkyGradient(ctx, W, H, norm) {
    const t = 1 - norm;
    const r1 = Math.floor(4 + 50 * t);
    const g1 = Math.floor(5 + 100 * t);
    const b1 = Math.floor(15 + 180 * t);
    const r2 = Math.floor(10 + 80 * t);
    const g2 = Math.floor(13 + 130 * t);
    const b2 = Math.floor(30 + 180 * t);
    const r3 = Math.floor(17 + 130 * t);
    const g3 = Math.floor(20 + 140 * t);
    const b3 = Math.floor(40 + 160 * t);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0.00, `rgb(${r1},${g1},${b1})`);
    grad.addColorStop(0.40, `rgb(${r2},${g2},${b2})`);
    grad.addColorStop(0.75, `rgb(${r3},${g3},${b3})`);
    grad.addColorStop(1.00, '#111122');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  _drawSky(ctx, W, H) {
    this._drawSkyGradient(ctx, W, H, this._nightFactor);
  }

  _drawStars(ctx, W, H) {
    ctx.clearRect(0, 0, W, H);
    const rng = this._rng(42);
    for (let i = 0; i < 320; i++) {
      const x = rng() * W;
      const y = rng() * H * 0.75;
      const r = rng() * 1.2 + 0.3;
      const a = rng() * 0.5 + 0.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fill();
    }
  }

  _drawMoon(ctx, W, H) {
    ctx.clearRect(0, 0, W, H);

    const mx = W * 0.72, my = H * 0.22, mr = 38;

    const glow = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 3);
    glow.addColorStop(0, 'rgba(200,220,255,0.18)');
    glow.addColorStop(1, 'rgba(200,220,255,0)');
    ctx.beginPath();
    ctx.arc(mx, my, mr * 3, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    const moonG = ctx.createRadialGradient(mx - 8, my - 8, 4, mx, my, mr);
    moonG.addColorStop(0, '#e8eeff');
    moonG.addColorStop(1, '#9aa8c8');
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fillStyle = moonG;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(mx + 10, my - 5, mr * 0.82, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,12,25,0.42)';
    ctx.fill();

    const craters = [[mx - 12, my + 8, 5], [mx + 14, my + 14, 7], [mx + 4, my - 12, 4]];
    craters.forEach(([cx, cy, cr]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(100,115,150,0.35)';
      ctx.fill();
    });
  }

  _drawBuildings(ctx, W, H, opts) {
    const {
      minH, maxH, minW, maxW, count, colorBase, colorVar,
      windowColor, windowProb, glowColor, antenna = false, neon = false,
    } = opts;

    ctx.clearRect(0, 0, W, H);
    const rng = this._rng(count * 7 + W);

    for (let i = 0; i < count; i++) {
      const bx = (i / count) * W + rng() * (W / count);
      const bw = minW + rng() * (maxW - minW);
      const bh = (minH + rng() * (maxH - minH)) * H;
      const by = H - bh;

      const v = Math.floor(rng() * colorVar - colorVar / 2);
      const r = Math.max(0, colorBase[0] + v);
      const g = Math.max(0, colorBase[1] + v);
      const b = Math.max(0, colorBase[2] + v);

      if (glowColor) {
        const gr = ctx.createLinearGradient(bx, by, bx, H);
        gr.addColorStop(0, glowColor);
        gr.addColorStop(1, 'transparent');
        ctx.fillStyle = gr;
        ctx.fillRect(bx - bw * 0.1, by, bw * 1.2, bh);
      }

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(bx, by, bw, bh);

      ctx.fillStyle = `rgba(255,255,255,0.04)`;
      ctx.fillRect(bx, by, 2, bh);

      this._drawWindows(ctx, bx, by, bw, bh, windowColor, windowProb, rng);

      if (antenna && rng() > 0.5) {
        const ax = bx + bw / 2 + rng() * bw * 0.3 - bw * 0.15;
        ctx.strokeStyle = `rgba(${r + 20},${g + 20},${b + 30},0.7)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ax, by);
        ctx.lineTo(ax, by - 15 - rng() * 25);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(ax, by - 15 - rng() * 25, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,50,50,0.85)';
        ctx.fill();
      }

      if (neon && rng() > 0.65) {
        const neonColors = [
          'rgba(0,255,220,0.7)', 'rgba(255,0,180,0.7)',
          'rgba(60,120,255,0.7)', 'rgba(255,200,0,0.7)',
        ];
        const nc = neonColors[Math.floor(rng() * neonColors.length)];
        const nw = 10 + rng() * 30;
        const nh = 4;
        const nx = bx + rng() * (bw - nw);
        const ny = by + bh * 0.2 + rng() * bh * 0.5;

        ctx.shadowColor = nc;
        ctx.shadowBlur = 8;
        ctx.fillStyle = nc;
        ctx.fillRect(nx, ny, nw, nh);
        ctx.shadowBlur = 0;
      }
    }
  }

  _drawWindows(ctx, bx, by, bw, bh, color, prob, rng) {
    const ww = 4, wh = 5, gx = 8, gy = 8;
    const cols = Math.floor((bw - 8) / (ww + gx));
    const rows = Math.floor((bh - 10) / (wh + gy));
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (rng() > prob) continue;
        const wx = bx + 6 + col * (ww + gx);
        const wy = by + 8 + row * (wh + gy);
        ctx.fillStyle = color;
        ctx.fillRect(wx, wy, ww, wh);
        if (rng() > 0.8) {
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(wx, wy, ww, wh);
        }
      }
    }
  }

  _rng(seed = 1) {
    let s = seed >>> 0;
    return () => {
      s += 0x6d2b79f5;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 0xffffffff;
    };
  }
}
