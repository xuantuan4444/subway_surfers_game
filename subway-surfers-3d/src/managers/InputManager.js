export class InputManager {
    constructor(player) {
        this.player = player;
        this.enabled = false;
        this.initControls();
    }

    setEnabled(enabled) {
        this.enabled = enabled;
    }

    initControls() {
        window.addEventListener('keydown', (event) => {
            if (!this.enabled) return;
            switch(event.code) {
                case 'ArrowLeft':
                case 'KeyA':
                    this.player.moveLeft();
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    this.player.moveRight();
                    break;
                case 'ArrowUp':
                case 'Space':
                case 'KeyW':
                    this.player.jump();
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    this.player.slide();
                    break;
            }
        });
    }
}
