import { LANE } from '../constants.js';

export class LaneUtils {
  static laneToWorldX(lane) {
    return (lane - 1) * LANE.WIDTH;
  }

  static worldXToLane(x) {
    const lane = Math.round(x / LANE.WIDTH) + 1;
    return Math.max(0, Math.min(LANE.COUNT - 1, lane));
  }

  static clampLane(lane) {
    return Math.max(0, Math.min(LANE.COUNT - 1, lane));
  }

  static getAdjacentLanes(lane) {
    const adj = [];
    if (lane > 0) adj.push(lane - 1);
    if (lane < LANE.COUNT - 1) adj.push(lane + 1);
    return adj;
  }

  static validateMask(mask) {
    if (!mask || mask.length !== LANE.COUNT) return false;
    const blocked = mask.filter(v => v === 1).length;
    return blocked > 0 && blocked < LANE.COUNT;
  }

  static getSafeLanes(mask) {
    return mask.reduce((safe, v, i) => v === 0 ? [...safe, i] : safe, []);
  }

  static getBlockedLanes(mask) {
    return mask.reduce((blocked, v, i) => v === 1 ? [...blocked, i] : blocked, []);
  }

  static isSafe(mask, lane) {
    return lane >= 0 && lane < LANE.COUNT && mask[lane] === 0;
  }

  static masksEqual(a, b) {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  }

  static hasSafePathFrom(currentLane, nextMask, spacing) {
    if (this.isSafe(nextMask, currentLane)) return true;
    const adj = this.getAdjacentLanes(currentLane);
    const canReach = adj.filter(l => this.isSafe(nextMask, l));
    if (canReach.length === 0) return false;
    if (spacing < 6 && currentLane !== LANE.MIDDLE) {
      return false;
    }
    if (spacing < 4) {
      return canReach.some(l => Math.abs(l - currentLane) === 1);
    }
    return true;
  }
}
