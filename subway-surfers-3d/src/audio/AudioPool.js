export class AudioPool {
  constructor(context, maxInstances = 8) {
    this.context = context;
    this.maxInstances = maxInstances;
    this._pool = [];
    this._active = [];
    this._grow(maxInstances);
  }

  _grow(count) {
    for (let i = 0; i < count; i++) {
      this._pool.push(null);
    }
  }

  acquire(buffer, gainNode, loop = false) {
    let source = this._pool.find(s => s === null || (s && s.buffer === null));

    if (!source || source === null) {
      if (this._pool.length >= this.maxInstances) {
        const oldest = this._active.shift();
        if (oldest) {
          try { oldest.stop(); } catch (_) {}
          try { oldest.disconnect(); } catch (_) {}
        }
      }
      source = null;
    } else {
      source = null;
    }

    const node = this.context.createBufferSource();
    node.buffer = buffer;
    node.loop = loop;
    node.connect(gainNode);
    node.start(0);

    const entry = { node, buffer };
    const idx = this._pool.indexOf(source);
    if (idx !== -1) this._pool[idx] = entry;
    else this._pool.push(entry);

    this._active.push(entry);

    node.onended = () => {
      this._release(entry);
    };

    return entry;
  }

  _release(entry) {
    const idx = this._active.indexOf(entry);
    if (idx !== -1) this._active.splice(idx, 1);
    try { entry.node.disconnect(); } catch (_) {}
  }

  stopAll() {
    for (const entry of this._active) {
      try { entry.node.stop(); } catch (_) {}
      try { entry.node.disconnect(); } catch (_) {}
    }
    this._active.length = 0;
  }

  getActiveCount() {
    return this._active.length;
  }
}
