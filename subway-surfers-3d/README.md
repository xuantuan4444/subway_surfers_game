
# Cấu trúc thư mục và giải thích file code

Dưới đây là mô tả chi tiết về cấu trúc thư mục và ý nghĩa của từng file trong dự án game Subway Surfers 3D.

## Cấu trúc tổng quan

```
/
├── index.html              # File HTML chính của game
├── style.css               # File CSS để tạo kiểu cho giao diện
├── docs/
│   └── baocao.txt          # File tài liệu báo cáo (hiện đang trống)
├── models/                 # Thư mục chứa các model 3D (nếu có)
├── release/                # Thư mục chứa phiên bản build của game
│   ├── index.html          # File HTML cho phiên bản build
│   └── readme.txt          # File readme cho phiên bản build (hiện đang trống)
├── shaders/                # Thư mục chứa các file shader GLSL
│   ├── glow.frag           # Fragment shader cho hiệu ứng phát sáng
│   ├── glow.vert           # Vertex shader cho hiệu ứng phát sáng
│   ├── outline.frag        # Fragment shader cho hiệu ứng viền
│   └── outline.vert        # Vertex shader cho hiệu ứng viền
├── src/                    # Thư mục chứa mã nguồn chính của game
│   ├── constants.js        # File chứa các hằng số chung (hiện đang trống)
│   ├── Game.js             # File lõi của game, quản lý vòng lặp, trạng thái
│   ├── main.js             # Điểm khởi đầu của ứng dụng, khởi tạo game
│   ├── entities/           # Thư mục chứa các đối tượng trong game
│   │   ├── Chaser.js       # Quản lý đối tượng "kẻ đuổi"
│   │   ├── Coin.js         # Quản lý đối tượng "tiền xu"
│   │   ├── Environment.js  # Quản lý môi trường game (hiện đang trống)
│   │   ├── Obstacle.js     # Quản lý các chướng ngại vật
│   │   ├── Player.js       # Quản lý nhân vật người chơi
│   │   ├── ShapeShowcase.js # (hiện đang trống)
│   │   └── TrackTile.js    # (hiện đang trống)
│   ├── managers/           # Thư mục chứa các lớp quản lý
│   │   ├── CameraController.js # Quản lý camera (hiện đang trống)
│   │   ├── CoinManager.js      # Quản lý việc tạo và thu thập coin (hiện đang trống)
│   │   ├── CollisionManager.js # Quản lý va chạm
│   │   ├── InputManager.js     # Quản lý đầu vào từ người dùng
│   │   ├── LightingManager.js  # Quản lý ánh sáng (hiện đang trống)
│   │   ├── ObstacleManager.js  # Quản lý việc tạo chướng ngại vật
│   │   └── TrackManager.js     # Quản lý đường chạy
│   ├── ui/                   # Thư mục chứa các file liên quan đến giao diện người dùng
│   │   ├── DebugPanel.js     # Panel để debug (hiện đang trống)
│   │   └── UIManager.js        # Quản lý các yếu tố UI như điểm số, game over
│   └── utils/                # Thư mục chứa các hàm tiện ích
│       ├── GeometryBuilder.js  # (hiện đang trống)
│       ├── MathUtils.js        # (hiện đang trống)
│       └── TextureGenerator.js # (hiện đang trống)
└── textures/               # Thư mục chứa các file texture
    ├── box_texture.jpg     # Texture cho hộp
    ├── coin.png            # Texture cho tiền xu
    ├── ground.jpg          # Texture cho mặt đất
    └── sky.jpg             # Texture cho bầu trời
```

## Giải thích chi tiết các file quan trọng

### Files gốc

*   `index.html`: Đây là file HTML chính, là điểm vào của trình duyệt. Nó chứa cấu trúc cơ bản của trang web, import thư viện Three.js và file `main.js` để bắt đầu game. Nó cũng định nghĩa các element HTML cho giao diện người dùng (UI) như điểm số, màn hình game over.
*   `style.css`: Chứa các quy tắc CSS để định dạng cho `index.html`. Chủ yếu là để đảm bảo canvas game chiếm toàn bộ màn hình và định vị các element UI.

### Thư mục `src` (Mã nguồn)

Đây là nơi chứa toàn bộ logic của game.

#### `main.js`
*   **Mục đích**: Là điểm khởi đầu của ứng dụng JavaScript.
*   **Chức năng**:
    *   Import lớp `Game`.
    *   Lắng nghe sự kiện `DOMContentLoaded` để đảm bảo trang web đã tải xong.
    *   Tạo một instance của lớp `Game` và gọi phương thức `start()` để bắt đầu vòng lặp game.

#### `Game.js`
*   **Mục đích**: Là file điều khiển trung tâm, quản lý toàn bộ trạng thái và luồng chính của game.
*   **Chức năng**:
    *   Khởi tạo scene, camera, renderer của Three.js.
    *   Thiết lập ánh sáng cơ bản.
    *   Tạo các instance của các lớp quản lý (`TrackManager`, `InputManager`, `CollisionManager`) và các đối tượng game (`Player`, `Chaser`).
    *   Quản lý vòng lặp game (`animate`) để cập nhật các đối tượng, xử lý va chạm và render lại scene mỗi frame.
    *   Xử lý trạng thái game (chơi, game over, khởi động lại).
    *   Cập nhật giao diện người dùng (điểm số).

#### Thư mục `entities` (Các đối tượng game)

*   `Player.js`: Định nghĩa lớp `Player`, đại diện cho nhân vật người chơi.
    *   Quản lý vị trí, di chuyển (trái, phải, nhảy, trượt).
    *   Xử lý trọng lực và trạng thái (đang nhảy, đang trượt).
    *   Sử dụng Raycaster để xác định mặt đất hiện tại và xử lý va chạm với địa hình không bằng phẳng (nóc tàu, chướng ngại vật).
    *   Xử lý hiệu ứng khi va chạm nhẹ (bị đẩy lùi, nhấp nháy).
*   `Chaser.js`: Định nghĩa "kẻ đuổi" xuất hiện khi người chơi va chạm nhẹ.
    *   Quản lý trạng thái (active/inactive), thời gian tồn tại.
    *   Cập nhật vị trí để đi theo người chơi.
*   `Obstacle.js`: Định nghĩa các chướng ngại vật.
    *   Hiện tại chủ yếu là các khối hộp và tàu hỏa.
    *   Sử dụng object pooling để tái sử dụng đối tượng, tăng hiệu năng.
*   `Coin.js`: Định nghĩa đối tượng tiền xu.
    *   Quản lý trạng thái (đã thu thập hay chưa).
    *   Xử lý animation xoay.

#### Thư mục `managers` (Các lớp quản lý)

*   `TrackManager.js`: Chịu trách nhiệm tạo và quản lý đường chạy vô tận.
    *   Tạo các "chunk" (đoạn đường) một cách ngẫu nhiên.
    *   Tái sử dụng các chunk đã đi qua để đặt ra phía trước, tạo hiệu ứng đường chạy vô tận.
    *   Sinh ngẫu nhiên các chướng ngại vật và tiền xu trên mỗi chunk.
*   `InputManager.js`: Lắng nghe và xử lý các đầu vào từ bàn phím (mũi tên, WASD, Space).
    *   Gọi các phương thức tương ứng của lớp `Player` khi có phím được nhấn.
*   `CollisionManager.js`: Kiểm tra va chạm giữa người chơi và các đối tượng khác.
    *   Sử dụng `Box3` (bounding box) để kiểm tra giao nhau.
    *   Phân biệt va chạm với coin và va chạm với chướng ngại vật.
    *   Phân biệt va chạm trực diện (`front`) và va chạm bên hông (`side`).
    *   Kiểm tra xem người chơi có đang ở trên nóc chướng ngại vật hay không để bỏ qua va chạm.
*   `UIManager.js`: Quản lý việc cập nhật các thành phần trên giao diện người dùng HTML.
    *   Cập nhật điểm số.
    *   Hiển thị/ẩn màn hình game over.

### Thư mục `shaders`
Chứa các file mã shader viết bằng GLSL (OpenGL Shading Language). Các file này hiện tại chưa được sử dụng trong code, nhưng được thiết kế để tạo các hiệu ứng đồ họa nâng cao như:
*   `glow.frag` / `glow.vert`: Tạo hiệu ứng phát sáng cho đối tượng.
*   `outline.frag` / `outline.vert`: Tạo hiệu ứng viền (outline) xung quanh đối tượng.

### Thư mục `textures`
Chứa các hình ảnh được sử dụng làm vật liệu (texture) cho các đối tượng 3D trong game, giúp chúng trông thật hơn.
