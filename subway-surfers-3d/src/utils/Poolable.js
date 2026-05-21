export class Poolable {
  constructor() {
    this.inUse = false;
    this.pool = null;
  }

  onActivate(config) {}

  onDeactivate() {}

  update(deltaTime) {}

  canRecycle(playerZ, margin) {
    return false;
  }

  isActive() {
    return this.inUse;
  }

  deactivate() {
    if (this.inUse) {
      this.inUse = false;
      this.onDeactivate();
    }
  }
}
