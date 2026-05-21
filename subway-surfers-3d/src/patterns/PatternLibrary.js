import { LANE, OBSTACLE, PATTERN_CATEGORY, ACTION_DISTANCE } from '../constants.js';
import { LaneUtils } from '../utils/LaneUtils.js';

export class Pattern {
  constructor(config) {
    this.name = config.name;
    this.laneMask = config.laneMask;
    this.obstacles = config.obstacles || {};
    this.category = config.category;
    this.minSpacing = config.minSpacing || 6;
    this.tags = config.tags || [];
    this.actionCount = config.actionCount || 1;
    this.coinLanes = config.coinLanes || [];
  }

  getSafeLanes() {
    return LaneUtils.getSafeLanes(this.laneMask);
  }

  getBlockedLanes() {
    return LaneUtils.getBlockedLanes(this.laneMask);
  }

  isValid() {
    return LaneUtils.validateMask(this.laneMask);
  }

  getObstacleType(lane) {
    return this.obstacles[lane] ? this.obstacles[lane].type : null;
  }

  getObstacleConfig(lane) {
    return this.obstacles[lane] || null;
  }

  hasActionType(type) {
    for (const lane of this.getBlockedLanes()) {
      if (this.obstacles[lane] && this.obstacles[lane].type === type) return true;
    }
    return false;
  }

  requiresLaneChange() {
    const safe = this.getSafeLanes();
    return safe.length < 3;
  }

  requiresJump() {
    return this.hasActionType(OBSTACLE.LOW_BARRIER);
  }

  requiresSlide() {
    return this.hasActionType(OBSTACLE.HIGH_BARRIER);
  }

  hasTrain() {
    return this.hasActionType(OBSTACLE.STATIC_TRAIN) || this.hasActionType(OBSTACLE.MOVING_TRAIN);
  }
}

class PatternBuilder {
  constructor() {
    this.patterns = {};
    this.byCategory = {};
    this.byTag = {};
  }

  _index(pattern) {
    this.patterns[pattern.name] = pattern;
    if (!this.byCategory[pattern.category]) this.byCategory[pattern.category] = [];
    this.byCategory[pattern.category].push(pattern);
    for (const tag of pattern.tags) {
      if (!this.byTag[tag]) this.byTag[tag] = [];
      this.byTag[tag].push(pattern);
    }
  }

  _mask(a, b, c) {
    return [a, b, c];
  }

  _obs(type, extra = {}) {
    return { type, ...extra };
  }

  _maskName(mask) {
    const labels = ['L', 'C', 'R'];
    return mask.map((v, i) => v === 1 ? labels[i] : '_').join('');
  }

  defineEasy() {
    const configs = [
      { mask: [1, 0, 0], obstacle: OBSTACLE.LOW_BARRIER, action: 1, coin: [1, 2] },
      { mask: [0, 1, 0], obstacle: OBSTACLE.LOW_BARRIER, action: 1, coin: [0, 2] },
      { mask: [0, 0, 1], obstacle: OBSTACLE.LOW_BARRIER, action: 1, coin: [0, 1] },
    ];
    for (const c of configs) {
      const name = `EASY_${this._maskName(c.mask)}`;
      this._index(new Pattern({
        name,
        laneMask: this._mask(...c.mask),
        obstacles: {
          [c.mask.indexOf(1)]: this._obs(c.obstacle),
        },
        category: PATTERN_CATEGORY.EASY,
        minSpacing: 3,
        actionCount: c.action,
        coinLanes: c.coin,
        tags: ['single_action', 'jump'],
      }));
    }
    return this;
  }

  defineMedium() {
    const configs = [
      { mask: [0, 1, 0], obstacle: OBSTACLE.HIGH_BARRIER, action: 1, tag: 'slide', coin: [0, 2] },
      { mask: [1, 0, 0], obstacle: OBSTACLE.HIGH_BARRIER, action: 1, tag: 'slide', coin: [1, 2] },
      { mask: [0, 0, 1], obstacle: OBSTACLE.HIGH_BARRIER, action: 1, tag: 'slide', coin: [0, 1] },
      { mask: [1, 0, 1], obstacle: OBSTACLE.LOW_BARRIER, action: 2, tag: 'dual_jump', coin: [1] },
    ];
    for (const c of configs) {
      const name = `MED_${this._maskName(c.mask)}_${c.tag.toUpperCase()}`;
      const obstacles = {};
      for (const lane of LaneUtils.getBlockedLanes(c.mask)) {
        obstacles[lane] = this._obs(c.obstacle);
      }
      this._index(new Pattern({
        name,
        laneMask: this._mask(...c.mask),
        obstacles,
        category: PATTERN_CATEGORY.MEDIUM,
        minSpacing: 3,
        actionCount: c.action,
        coinLanes: c.coin,
        tags: ['dual_action', c.tag],
      }));
    }
    return this;
  }

  defineHard() {
    const configs = [
      { mask: [1, 1, 0], leftObs: OBSTACLE.LOW_BARRIER, rightObs: OBSTACLE.LOW_BARRIER, action: 2, tag: 'forced_right' },
      { mask: [0, 1, 1], leftObs: OBSTACLE.LOW_BARRIER, rightObs: OBSTACLE.LOW_BARRIER, action: 2, tag: 'forced_left' },
      { mask: [1, 1, 0], leftObs: OBSTACLE.HIGH_BARRIER, rightObs: OBSTACLE.LOW_BARRIER, action: 2, tag: 'combo_slide_jump' },
      { mask: [0, 1, 1], leftObs: OBSTACLE.LOW_BARRIER, rightObs: OBSTACLE.HIGH_BARRIER, action: 2, tag: 'combo_jump_slide' },
      { mask: [1, 0, 1], leftObs: OBSTACLE.HIGH_BARRIER, rightObs: OBSTACLE.HIGH_BARRIER, action: 2, tag: 'dual_slide' },
    ];
    for (const c of configs) {
      const name = `HARD_${this._maskName(c.mask)}_${c.tag.toUpperCase()}`;
      const obstacles = {
        [LaneUtils.getBlockedLanes(c.mask)[0]]: this._obs(c.leftObs),
        [LaneUtils.getBlockedLanes(c.mask)[1]]: this._obs(c.rightObs),
      };
      this._index(new Pattern({
        name,
        laneMask: this._mask(...c.mask),
        obstacles,
        category: PATTERN_CATEGORY.HARD,
        minSpacing: 2,
        actionCount: c.action,
        coinLanes: LaneUtils.getSafeLanes(c.mask),
        tags: ['combo', c.tag],
      }));
    }
    return this;
  }

  defineTrains() {
    this._index(new Pattern({
      name: 'TRAIN_STATIC_LEFT',
      laneMask: [1, 0, 0],
      obstacles: { 0: { type: OBSTACLE.STATIC_TRAIN, rooftopCoins: true } },
      category: PATTERN_CATEGORY.TRAIN,
      minSpacing: 6,
      actionCount: 1,
      coinLanes: [1],
      tags: ['train', 'static'],
    }));
    this._index(new Pattern({
      name: 'TRAIN_STATIC_RIGHT',
      laneMask: [0, 0, 1],
      obstacles: { 2: { type: OBSTACLE.STATIC_TRAIN, rooftopCoins: true } },
      category: PATTERN_CATEGORY.TRAIN,
      minSpacing: 6,
      actionCount: 1,
      coinLanes: [1],
      tags: ['train', 'static'],
    }));
    this._index(new Pattern({
      name: 'TRAIN_MOVING_LEFT',
      laneMask: [1, 0, 0],
      obstacles: { 0: { type: OBSTACLE.MOVING_TRAIN } },
      category: PATTERN_CATEGORY.TRAIN,
      minSpacing: 8,
      actionCount: 1,
      coinLanes: [1, 2],
      tags: ['train', 'moving'],
    }));
    this._index(new Pattern({
      name: 'TRAIN_MOVING_RIGHT',
      laneMask: [0, 0, 1],
      obstacles: { 2: { type: OBSTACLE.MOVING_TRAIN } },
      category: PATTERN_CATEGORY.TRAIN,
      minSpacing: 8,
      actionCount: 1,
      coinLanes: [0, 1],
      tags: ['train', 'moving'],
    }));
    this._index(new Pattern({
      name: 'TRAIN_MOVING_CENTER',
      laneMask: [0, 1, 0],
      obstacles: { 1: { type: OBSTACLE.MOVING_TRAIN } },
      category: PATTERN_CATEGORY.TRAIN,
      minSpacing: 8,
      actionCount: 1,
      coinLanes: [0, 2],
      tags: ['train', 'moving'],
    }));
    this._index(new Pattern({
      name: 'TRAIN_DUAL_SIDES',
      laneMask: [1, 0, 1],
      obstacles: {
        0: { type: OBSTACLE.STATIC_TRAIN, rooftopCoins: true },
        2: { type: OBSTACLE.STATIC_TRAIN, rooftopCoins: true },
      },
      category: PATTERN_CATEGORY.TRAIN,
      minSpacing: 10,
      actionCount: 1,
      coinLanes: [1],
      tags: ['train', 'static', 'dual'],
    }));
    this._index(new Pattern({
      name: 'TRAIN_NORAMP_LEFT',
      laneMask: [1, 0, 0],
      obstacles: { 0: { type: OBSTACLE.STATIC_TRAIN, cars: 1, hasRamp: false } },
      category: PATTERN_CATEGORY.TRAIN,
      minSpacing: 6,
      actionCount: 1,
      coinLanes: [1, 2],
      tags: ['train', 'noramp'],
    }));
    this._index(new Pattern({
      name: 'TRAIN_NORAMP_RIGHT',
      laneMask: [0, 0, 1],
      obstacles: { 2: { type: OBSTACLE.STATIC_TRAIN, cars: 1, hasRamp: false } },
      category: PATTERN_CATEGORY.TRAIN,
      minSpacing: 6,
      actionCount: 1,
      coinLanes: [0, 1],
      tags: ['train', 'noramp'],
    }));
    this._index(new Pattern({
      name: 'TRAIN_LONGTRAIN_LEFT',
      laneMask: [1, 0, 0],
      obstacles: { 0: { type: OBSTACLE.STATIC_TRAIN, cars: 3, rooftopCoins: true } },
      category: PATTERN_CATEGORY.TRAIN,
      minSpacing: 12,
      actionCount: 1,
      coinLanes: [1],
      tags: ['train', 'static', 'long'],
    }));
    this._index(new Pattern({
      name: 'TRAIN_LONGTRAIN_RIGHT',
      laneMask: [0, 0, 1],
      obstacles: { 2: { type: OBSTACLE.STATIC_TRAIN, cars: 3, rooftopCoins: true } },
      category: PATTERN_CATEGORY.TRAIN,
      minSpacing: 12,
      actionCount: 1,
      coinLanes: [1],
      tags: ['train', 'static', 'long'],
    }));
    return this;
  }

  build() {
    return new PatternLibrary(
      this.patterns,
      this.byCategory,
      this.byTag
    );
  }
}

export class PatternLibrary {
  constructor(patterns, byCategory, byTag) {
    this.patterns = patterns;
    this.byCategory = byCategory;
    this.byTag = byTag;
  }

  getByName(name) {
    return this.patterns[name] || null;
  }

  getByCategory(category) {
    return this.byCategory[category] || [];
  }

  getByTag(tag) {
    return this.byTag[tag] || [];
  }

  getRandomByCategory(category, exclude) {
    const pool = this.getByCategory(category).filter(p => !exclude || !exclude.includes(p.name));
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  getRandomByTag(tag, exclude) {
    const pool = this.getByTag(tag).filter(p => !exclude || !exclude.includes(p.name));
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  getWeightedRandom(weights, exclude) {
    const total = Object.values(weights).reduce((s, w) => s + w, 0);
    let roll = Math.random() * total;
    for (const [category, weight] of Object.entries(weights)) {
      roll -= weight;
      if (roll <= 0) {
        const pattern = this.getRandomByCategory(category, exclude);
        if (pattern) return pattern;
      }
    }
    for (const [category] of Object.entries(weights)) {
      const pattern = this.getRandomByCategory(category, exclude);
      if (pattern) return pattern;
    }
    return this.getRandomByCategory(PATTERN_CATEGORY.EASY);
  }

  static createDefault() {
    return new PatternBuilder()
      .defineEasy()
      .defineMedium()
      .defineHard()
      .defineTrains()
      .build();
  }
}

export class PatternValidator {
  static canTransition(prevPattern, nextPattern, spacing) {
    if (!prevPattern || !nextPattern) return true;
    if (!prevPattern.isValid() || !nextPattern.isValid()) return false;
    if (spacing < nextPattern.minSpacing) return false;

    const prevSafe = prevPattern.getSafeLanes();
    for (const lane of prevSafe) {
      if (LaneUtils.hasSafePathFrom(lane, nextPattern.laneMask, spacing)) {
        return true;
      }
    }
    return false;
  }

  static willBlockPlayer(currentLane, prevPattern, nextPattern, spacing) {
    if (!nextPattern.isValid()) return true;
    return !LaneUtils.hasSafePathFrom(currentLane, nextPattern.laneMask, spacing);
  }

  static findSafeLaneTransition(currentLane, nextPattern) {
    const safe = nextPattern.getSafeLanes();
    if (safe.includes(currentLane)) return currentLane;
    const adj = LaneUtils.getAdjacentLanes(currentLane);
    const reachable = adj.filter(l => safe.includes(l));
    if (reachable.length > 0) {
      return reachable.reduce((a, b) =>
        Math.abs(a - currentLane) < Math.abs(b - currentLane) ? a : b
      );
    }
    return -1;
  }

  static validateRhythmSequence(patterns, spacing) {
    for (let i = 1; i < patterns.length; i++) {
      if (!this.canTransition(patterns[i - 1], patterns[i], spacing)) {
        return false;
      }
    }
    return true;
  }

  static getRequiredActions(prevLane, pattern) {
    const actions = [];
    const safe = pattern.getSafeLanes();
    if (!safe.includes(prevLane)) {
      const adj = LaneUtils.getAdjacentLanes(prevLane);
      const target = adj.filter(l => safe.includes(l));
      if (target.length > 0) {
        actions.push({
          type: 'lane_switch',
          from: prevLane,
          to: target[0],
        });
      }
    }
    for (const lane of pattern.getBlockedLanes()) {
      const obs = pattern.getObstacleType(lane);
      if (obs) {
        actions.push({ type: this._actionFromObstacle(obs), lane });
      }
    }
    return actions;
  }

  static _actionFromObstacle(type) {
    switch (type) {
      case OBSTACLE.LOW_BARRIER: return 'jump';
      case OBSTACLE.HIGH_BARRIER: return 'slide';
      case OBSTACLE.STATIC_TRAIN: return 'rooftop';
      case OBSTACLE.MOVING_TRAIN: return 'rooftop_moving';
      default: return 'dodge';
    }
  }
}
