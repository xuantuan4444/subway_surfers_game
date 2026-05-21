# Cấu trúc Assets — Subway Surfers 3D

## Cấu trúc hiện tại

```
subway-surfers-3d/
├── index.html
├── style.css
├── README.md
├── release/
│   └── index.html
├── textures/                          # Ảnh texture hiện tại
│   ├── box_texture.jpg
│   ├── coin.png
│   ├── ground.jpg
│   └── sky.jpg
├── shaders/
├── docs/
├── models/
└── src/
    ├── main.js                        # Entry point
    ├── Game.js                        # Game loop, camera, render
    ├── constants.js                   # Hằng số game
    ├── entities/                      # Entity cũ (đang dùng primitives)
    │   ├── Player.js
    │   ├── Coin.js
    │   ├── Chaser.js
    │   ├── Obstacle.js
    │   ├── Environment.js
    │   ├── ShapeShowcase.js
    │   └── TrackTile.js
    ├── managers/                      # Logic game
    │   ├── TrackManager.js            # Spawn obstacle/train/coin (đang dùng BoxGeometry)
    │   ├── SpawnManager.js            # Pattern generation
    │   ├── CollisionManager.js
    │   ├── DifficultyManager.js
    │   ├── CoinManager.js
    │   ├── ObstacleManager.js
    │   ├── CameraController.js
    │   ├── InputManager.js
    │   ├── LightingManager.js
    │   ├── PoolManager.js
    │   └── patterns/PatternLibrary.js
    ├── patterns/PatternLibrary.js
    ├── ui/
    │   ├── UIManager.js
    │   └── DebugPanel.js
    └── utils/
        ├── LaneUtils.js
        ├── MathUtils.js
        ├── GeometryBuilder.js
        ├── Poolable.js
        └── TextureGenerator.js        # (rỗng, chờ code)
```

## Cấu trúc mới (thêm `assets/`)

```
src/
└── assets/                            ← THÊM MỚI — không động vào code cũ
    ├── index.js                       # Re-export toàn bộ public API
    ├── AssetRegistry.js               # #1: Bản đồ type → factory, 1 API create()
    ├── textures.js                    # #2: JS Canvas texture (stripe, gold, metal, ...)
    ├── models/
    │   ├── barriers.js                # #3: LOW_BARRIER + HIGH_BARRIER có texture
    │   ├── trains.js                  # #4: Toa tàu + ramp, multi-car, moving/static
    │   ├── coins.js                   # #5: Đồng xu 3D với gold texture
    │   └── road.js                    # #6: Mặt đường, vạch kẻ, tường biên
    └── images/                        ← THÊM MỚI — ảnh do bạn user vẽ
        ├── barrier.png
        ├── train_body.png
        ├── train_window.png
        └── coin.png
```

## Chú thích chi tiết từng file

### `assets/index.js`
Re-export tất cả để import gọn: `import { createModel } from '../assets/index.js'`

### `assets/AssetRegistry.js` — API trung tâm
```js
AssetRegistry.create(type, config) → THREE.Object3D
```
Bảng type hiện tại:

| `type`            | Nhận vào (`config`)                                        | Trả về           |
|-------------------|------------------------------------------------------------|------------------|
| `'low_barrier'`   | `{ lane, x, z }`                                           | `THREE.Mesh`     |
| `'high_barrier'`  | `{ lane, x, z }`                                           | `THREE.Group`    |
| `'train_car'`     | `{ hasRamp, isMoving, carOffsetZ, lane, rooftopCoins }`    | `THREE.Group`    |
| `'coin'`          | `{ lane, x, z }`                                           | `THREE.Mesh`     |
| `'road'`          | `{ chunkLength }`                                           | `THREE.Mesh`     |
| `'lane_line'`     | `{ position }`                                              | `THREE.Mesh`     |
| `'wall'`          | `{ side, chunkLength }`                                     | `THREE.Mesh`     |

Sau này muốn thêm model mới (cây, building, power-up, ...) chỉ cần thêm 1 dòng trong registry.

### `assets/textures.js` — Texture sinh bằng Canvas JS
Các hàm export:
- `createGoldTexture()` → CanvasRenderingContext2D → `THREE.CanvasTexture` (coin)
- `createMetalTexture(color)` → texture kim loại cho tàu
- `createStripeTexture(color1, color2)` → barrier warning stripes
- `createConcreteTexture()` → road
- `createWindowTexture()` → cửa sổ tàu (phát sáng)
- `createGradientTexture(colorTop, colorBottom)` → sky/wall gradient

Mỗi hàm vẽ pixel trên `Canvas 2D` rồi wrap thành `THREE.CanvasTexture`. Không cần file ảnh.

### `assets/models/barriers.js`
- `createLowBarrier(config)` → `THREE.Mesh` có texture stripe + shadow
- `createHighBarrier(config)` → `THREE.Group` gồm 2 cột + thanh ngang, texture cảnh báo

Hiện tại TrackManager đang dùng:
```js
new THREE.BoxGeometry(2.5, 1.5, 1)
new THREE.MeshStandardMaterial({ color: 0xff3333 })
```
→ Sẽ thay bằng model có texture stripe, đổ bóng.

### `assets/models/trains.js`
- `createTrainCar(config)` → `THREE.Group` gồm:
  - Thân tàu: BoxGeometry với `createMetalTexture()`
  - Cửa sổ: BoxGeometry phát sáng với `createWindowTexture()`
  - Ramp (nếu `hasRamp`): ExtrudeGeometry với texture kim loai
  - Coin trên nóc (nếu `rooftopCoins`): gọi `createCoin()` từ coins.js
  - Gắn `walkableProfile` vào userData (giữ tương thích collision)

Xử lý:
- `isMoving === true`: không ramp, màu cam (`0xff5a1f`)
- `isMoving === false + hasRamp === true`: ramp + thân xanh (`0x1a2b4c`)
- Multi-car: gọi `createTrainCar()` nhiều lần với `carOffsetZ` khác nhau

### `assets/models/coins.js`
- `createCoin(config)` → `THREE.Mesh`:
  - CylinderGeometry với texture gold từ `textures.js`
  - Hoặc dùng `THREE.Sprite` với hình tròn (luôn hướng về camera)
  - userData: `{ type: 'coin', lane, value, rotateSpeed }`

### `assets/models/road.js`
- `createRoadSegment(chunkLength)` → mặt đường asphalt
- `createLaneLine(position)` → vạch trắng đứt đoạn
- `createWall(side, chunkLength)` → tường biên với texture gradient

### `assets/images/` — file ảnh do bạn vẽ
Bạn user vẽ UV map trong Photoshop/GIMP, load bằng:
```js
const loader = new THREE.TextureLoader();
const tex = loader.load('./assets/images/train_body.png');
```

Nếu chưa có ảnh, model vẫn chạy được nhờ JS Canvas texture từ `textures.js`.

## Quy tắc code

1. **KHÔNG import bất kỳ file nào từ `src/managers/`, `src/entities/`, `src/Game.js`** — assets là module độc lập.
2. Chỉ dùng `THREE` + `src/constants.js` (nếu cần hằng số như LANE.WIDTH).
3. Mỗi model factory nhận `config` object, trả về `THREE.Object3D` (Mesh hoặc Group).
4. Texture ưu tiên JS Canvas (không cần file), fallback sang image file.
5. Giữ `userData` tương thích với CollisionManager hiện tại (`type`, `lane`, `walkableProfile`, ...).

## Sau này tích hợp
Chỉ sửa 1 file: `src/managers/TrackManager.js`
```js
// Before:
const barrier = new THREE.Mesh(barrierGeo, barrierMat);
// After:
const barrier = AssetRegistry.create('low_barrier', obs);
```
