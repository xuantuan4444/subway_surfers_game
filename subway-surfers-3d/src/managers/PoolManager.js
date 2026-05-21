export class PoolManager {
  constructor(factory, initialSize = 10) {
    this.factory = factory;
    this._pool = [];
    this._active = [];
    this._grow(initialSize);
  }

  _grow(count) {
    for (let i = 0; i < count; i++) {
      const obj = this.factory();
      obj.pool = this;
      obj.inUse = false;
      this._pool.push(obj);
    }
  }

  acquire(config) {
    let obj = this._pool.find(o => !o.inUse);
    if (!obj) {
      this._grow(Math.max(5, Math.floor(this._pool.length * 0.5)));
      obj = this._pool.find(o => !o.inUse);
    }
    obj.inUse = true;
    obj.onActivate(config);
    this._active.push(obj);
    return obj;
  }

  release(obj) {
    if (!obj || !obj.inUse) return;
    obj.inUse = false;
    obj.onDeactivate();
    const idx = this._active.indexOf(obj);
    if (idx !== -1) this._active.splice(idx, 1);
  }

  releaseAll() {
    for (const obj of this._active) {
      obj.inUse = false;
      obj.onDeactivate();
    }
    this._active.length = 0;
  }

  updateAll(deltaTime) {
    for (const obj of this._active) {
      obj.update(deltaTime);
    }
  }

  recycleAll(playerZ, recycleMargin) {
    const toRecycle = this._active.filter(
      obj => obj.canRecycle && obj.canRecycle(playerZ, recycleMargin)
    );
    for (const obj of toRecycle) {
      this.release(obj);
    }
  }

  getActiveCount() {
    return this._active.length;
  }

  getPoolSize() {
    return this._pool.length;
  }

  getActiveObjects() {
    return [...this._active];
  }
}
