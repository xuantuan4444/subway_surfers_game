# 🚇 Subway Surfers 3D
## Đồ Án Môn Đồ Họa Máy Tính – Three.js

> **Sinh viên:** [Họ tên] – [MSSV]  
> **Công nghệ:** Three.js r158 · ES Modules · Canvas 2D API  

---

## 🗺️ CẤU TRÚC THƯ MỤC ĐẦY ĐỦ

```
subway-surfers-3d/
├── index.html                    ← Điểm vào duy nhất (mở file này để chạy)
├── README.md                     ← File này
│
├── src/
│   ├── main.js                   ← Khởi động game, gắn canvas vào DOM
│   ├── Game.js                   ← Lớp Game trung tâm: state machine + game loop
│   ├── constants.js              ← Hằng số toàn cục (tốc độ, màu, kích thước làn...)
│   │
│   ├── managers/
│   │   ├── LightingManager.js    ← Ambient + Directional + Point light + Shadow map
│   │   ├── TrackManager.js       ← Sinh đường ray vô hạn (object pool)
│   │   ├── ObstacleManager.js    ← Sinh & quản lý chướng ngại vật theo pattern
│   │   ├── CoinManager.js        ← Sinh & thu thập xu vàng
│   │   ├── CollisionManager.js   ← Phát hiện va chạm AABB
│   │   ├── CameraController.js   ← Camera smooth-follow + debug orbit
│   │   └── InputManager.js       ← Keyboard + Touch swipe + Gamepad
│   │
│   ├── entities/
│   │   ├── Player.js             ← Nhân vật: Box+Sphere+Cylinder, chạy/nhảy/trượt
│   │   ├── TrackTile.js          ← Một đoạn đường (Plane + tường + đèn đường)
│   │   ├── Obstacle.js           ← 5 loại: Box, Cylinder, Cone, Torus, Train
│   │   ├── Coin.js               ← Xu vàng: Sphere + PointLight + xoay
│   │   ├── Environment.js        ← Tòa nhà, cây (Cylinder+Cone), bầu trời
│   │   └── ShapeShowcase.js      ← [YC ĐHMT] Demo tất cả hình khối cơ bản
│   │
│   ├── utils/
│   │   ├── TextureGenerator.js   ← Texture thủ tục bằng Canvas 2D API
│   │   ├── GeometryBuilder.js    ← Custom geometry: teapot, wheel, load OBJ/GLTF
│   │   └── MathUtils.js          ← lerp, clamp, easeInOut, AABB helper
│   │
│   └── ui/
│       ├── UIManager.js          ← HUD score/lives/speed, Menu, GameOver screen
│       └── DebugPanel.js         ← Panel thông số camera & ánh sáng (F1 bật/tắt)
│
├── assets/
│   ├── textures/                 ← Thêm ảnh .png/.jpg tùy chỉnh vào đây
│   └── models/                   ← Thêm file .obj/.gltf vào đây
│
├── release/
│   └── readme.txt                ← Hướng dẫn chạy (dành cho file nộp)
│
└── doc/
    └── BaoCao_DoAn.md            ← Template báo cáo đồ án
```

---

## 🎓 ĐÁP ỨNG YÊU CẦU MÔN ĐHMT

| Yêu cầu | File thực hiện | Cách đáp ứng |
|---------|---------------|-------------|
| Hình hộp (Box) | `entities/Obstacle.js`, `Player.js` | Chướng ngại vật, thân nhân vật |
| Hình cầu (Sphere) | `entities/Coin.js`, `Player.js` | Xu vàng, đầu nhân vật |
| Hình nón (Cone) | `entities/Obstacle.js` | Nón giao thông |
| Hình trụ (Cylinder) | `Player.js`, `Obstacle.js` | Tay chân nhân vật, cột chướng ngại |
| Bánh xe (Torus) | `entities/Environment.js` | TorusGeometry cho bánh xe tàu |
| Ấm trà (Teapot) | `utils/GeometryBuilder.js` | Custom Bezier hoặc load OBJ |
| Load model từ file | `utils/GeometryBuilder.js` | OBJLoader / GLTFLoader |
| Chiếu phối cảnh | `managers/CameraController.js` | PerspectiveCamera (FOV/near/far) |
| Tịnh tiến | tất cả entities | `position.x/y/z` + keyboard |
| Quay | `Coin.js`, `Player.js` | `rotation.x/y/z` animation |
| Tỉ lệ | `Player.js` (khi slide) | `scale.y` thay đổi |
| Ánh sáng môi trường | `managers/LightingManager.js` | `THREE.AmbientLight` |
| Ánh sáng định hướng | `managers/LightingManager.js` | `THREE.DirectionalLight` (mặt trời) |
| Ánh sáng điểm | `LightingManager.js`, `Coin.js` | `THREE.PointLight` |
| Bóng đổ | `managers/LightingManager.js` | `shadowMap = PCFSoftShadowMap` |
| Texture mapping | `utils/TextureGenerator.js` | Canvas2D → THREE.CanvasTexture |
| Animation | `Player.js`, tất cả managers | requestAnimationFrame game loop |

---

## 🚀 CÁCH CHẠY

> ⚠️ KHÔNG thể double-click mở index.html trực tiếp (ES Modules cần HTTP server)

**Cách 1 – VS Code Live Server (dễ nhất):**
```
Cài extension "Live Server" → Click phải index.html → Open with Live Server
```

**Cách 2 – Python:**
```bash
cd subway-surfers-3d
python -m http.server 8080
# Mở: http://localhost:8080
```

**Cách 3 – Node.js:**
```bash
npx serve subway-surfers-3d
```

---

## 🎮 ĐIỀU KHIỂN

| Phím | Hành động |
|------|-----------|
| ← / → | Đổi làn đường |
| ↑ hoặc Space | Nhảy |
| ↓ | Trượt (slide) |
| Tab | Xem demo hình khối (ShapeShowcase) |
| F1 | Bật/tắt Debug Panel |
| P | Tạm dừng |

---

## 📋 KẾ HOẠCH THỰC HIỆN TỪNG BƯỚC

| Bước | Nội dung | File cần viết | Trạng thái |
|------|---------|--------------|-----------|
| 0 | Cấu trúc & Kế hoạch | README.md | ✅ XONG |
| 1 | Nền tảng (Foundation) | index.html, constants.js, main.js, Game.js | 🔲 |
| 2 | Ánh sáng & Texture | LightingManager.js, TextureGenerator.js | 🔲 |
| 3 | Nhân vật (Player) | Player.js, InputManager.js | 🔲 |
| 4 | Đường ray (Track) | TrackTile.js, TrackManager.js | 🔲 |
| 5 | Môi trường (Environment) | Environment.js | 🔲 |
| 6 | Chướng ngại vật | Obstacle.js, ObstacleManager.js | 🔲 |
| 7 | Xu vàng (Coins) | Coin.js, CoinManager.js | 🔲 |
| 8 | Va chạm & Camera | CollisionManager.js, CameraController.js | 🔲 |
| 9 | Hình khối demo | ShapeShowcase.js, GeometryBuilder.js, MathUtils.js | 🔲 |
| 10 | UI & Debug Panel | UIManager.js, DebugPanel.js | 🔲 |
| 11 | Tích hợp & Tối ưu | Game.js (hoàn chỉnh) | 🔲 |
| 12 | Báo cáo & Nộp bài | BaoCao_DoAn.md, release/readme.txt | 🔲 |

---

*Cập nhật: Bước 0 hoàn thành*