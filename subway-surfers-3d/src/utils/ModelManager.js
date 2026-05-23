import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const MODEL_MAP = {
  Player: 'models/Player.glb',
  Streetlight: 'models/Streetlight.glb',
  BusStopSign: 'models/Bus stop sign.glb',
  StopSign: 'models/Stop sign.glb',
  TrafficLight: 'models/Traffic Light.glb',
  TrafficLight2: 'models/Traffic light 2.glb',
  TrafficLight3: 'models/Traffic light 3.glb',
  TrafficLightB: 'models/Trafficlight B.glb',
};

class ModelManagerClass {
  constructor() {
    this._cache = new Map();
    this._animCache = new Map();
    this._loaded = false;
  }

  async init() {
    if (this._loaded) return;
    const loader = new GLTFLoader();
    const entries = Object.entries(MODEL_MAP);
    const promises = entries.map(([name, path]) =>
      new Promise((resolve) => {
        loader.load(path, (gltf) => {
          this._cache.set(name, gltf.scene);
          this._animCache.set(name, gltf.animations || []);
          resolve();
        }, undefined, (err) => {
          console.warn(`Failed to load model "${name}" from ${path}`, err?.message || '');
          resolve();
        });
      })
    );
    await Promise.all(promises);
    this._loaded = true;
  }

  get(name) {
    const original = this._cache.get(name);
    if (!original) {
      console.warn(`Model "${name}" not found in cache`);
      return null;
    }
    return SkeletonUtils.clone(original);
  }

  getAnimations(name) {
    return this._animCache.get(name) || [];
  }

  getRandom(excludeList = []) {
    const keys = [...this._cache.keys()].filter(k => !excludeList.includes(k));
    if (keys.length === 0) return null;
    const name = keys[Math.floor(Math.random() * keys.length)];
    return this.get(name);
  }

  isLoaded() {
    return this._loaded;
  }
}

export const ModelManager = new ModelManagerClass();
