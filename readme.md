# 🚇 Subway Surfers 3D
## Đồ Án Môn Đồ Họa Máy Tính – Three.js

> **Sinh viên:** [Họ tên] – [MSSV]  
> **Công nghệ:** Three.js r158 · ES Modules · Canvas 2D API  

---

## 🗺️ CẤU TRÚC THƯ MỤC ĐẦY ĐỦ

```
subway-surfers-3d/
├── index.html
├── style.css                 
├── README.md                     
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
├── textures/
│   ├── box_texture.jpg                
│   └── ground.jpg
|   └── road.jpg
|   └── coin.png               
├── models/
|   ├── mixi.glb
|   └── mixi_jump.glb
|   └── road.glb
|   └── teapot.glb
├── shaders/
|   ├── glow.vert / .frag
|   └── outline.vert / .frag
├── release/
│   └── readme.txt
│   └── index.html
│
└── doc/
    └── BaoCao.md            
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
