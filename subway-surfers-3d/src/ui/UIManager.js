// src/ui/UIManager.js
export class UIManager {
    constructor() {
        this.scoreElement = document.getElementById('score');
        this.gameOverElement = document.getElementById('gameOver');
        this.startScreen = document.getElementById('startScreen');
    }
    
    updateScore(score) {
        this.scoreElement.textContent = `Score: ${score}`;
    }
    
    showGameOver(finalScore) {
        this.gameOverElement.style.display = 'block';
        document.getElementById('finalScore').textContent = finalScore;
    }
    
    hideStartScreen() {
        this.startScreen.style.display = 'none';
    }
}