import { Game } from './Game.js';

// Cấu hình game
const config = {
    canvas: document.getElementById('gameCanvas'),
    ui: {
        score: document.getElementById('score'),
        gameOver: document.getElementById('game-over'),
        restartBtn: document.getElementById('restart-btn')
    }
};

// Khởi tạo game khi trang web tải xong
window.addEventListener('DOMContentLoaded', () => {
    try {
        const game = new Game(config);
        game.start();
    } catch (error) {
        console.error("Lỗi khởi tạo game:", error);
    }
});