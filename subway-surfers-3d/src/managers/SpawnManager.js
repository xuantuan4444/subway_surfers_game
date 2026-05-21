import { LANE, OBSTACLE, PATTERN_CATEGORY, CHUNK } from '../constants.js';
import { LaneUtils } from '../utils/LaneUtils.js';
import { PatternLibrary, PatternValidator } from '../patterns/PatternLibrary.js';
import { DifficultyManager } from './DifficultyManager.js';

export class SpawnManager {
  constructor() {
    this.library = PatternLibrary.createDefault();
    this.difficulty = new DifficultyManager();
    this.lastPattern = null;
    this.lastRowZ = null;
    this.playerLane = LANE.MIDDLE;
    this.playerZ = 0;
    this._chunksGenerated = 0;
    this._currentChunkPatterns = {};
    this._activeStaticTrainLanes = new Set();
    this._coinLane = LANE.MIDDLE;
    this._coinShiftsSinceChange = 0;
  }

  update(delta, speed, playerZ, playerLane) {
    this.difficulty.update(delta, speed);
    this.playerLane = playerLane;
    this.playerZ = playerZ;
  }

  getDifficulty() {
    return this.difficulty;
  }

  generateChunkContent(chunk, chunkZ) {
    this._chunksGenerated++;

    // Chunks 0-1: safe zone (không obstacle), chỉ có coin trail
    if (this._chunksGenerated <= 2) {
      const coins = [];
      if (this._chunksGenerated === 1) {
        coins.push(
          { lane: LANE.LEFT, x: LaneUtils.laneToWorldX(LANE.LEFT), z: -3, type: 'trail', value: 10 },
          { lane: LANE.MIDDLE, x: LaneUtils.laneToWorldX(LANE.MIDDLE), z: -6, type: 'trail', value: 10 },
          { lane: LANE.RIGHT, x: LaneUtils.laneToWorldX(LANE.RIGHT), z: -9, type: 'trail', value: 10 },
        );
      }
      const startZ = this._chunksGenerated === 1 ? -12 : -2;
      for (let z = startZ; z > -CHUNK.LENGTH; z -= 6) {
        coins.push({
          lane: this._coinLane,
          x: LaneUtils.laneToWorldX(this._coinLane),
          z: z,
          type: 'trail',
          value: 10,
        });
      }
      return { rows: [], coins, trains: [], patternCount: 0 };
    }

    // Chunks 2-3: warm up (chỉ easy, ít row)
    if (this._chunksGenerated <= 4) {
      const numRows = 2;
      return this._generateRows(numRows, chunk, chunkZ, 'warmup');
    }

    const config = this.difficulty.getConfig();
    const rowRange = config.rowsPerChunk;
    const numRows = rowRange.min + Math.floor(Math.random() * (rowRange.max - rowRange.min + 1));
    return this._generateRows(numRows, chunk, chunkZ, 'normal');
  }

  _generateRows(numRows, chunk, chunkZ, mode) {

    const rows = [];
    const coins = [];
    const trains = [];
    let prevPattern = this.lastPattern;
    let prevWorldZ = this.lastRowZ;

    for (let i = 0; i < numRows; i++) {
      const rowOffset = this._calculateRowZ(i, numRows, chunkZ);
      const rowWorldZ = chunkZ + rowOffset;
      const category = mode === 'warmup' ? PATTERN_CATEGORY.EASY : this.difficulty.getNextRhythmCategory();

      let pattern = this.library.getRandomByCategory(category);
      let attempts = 0;
      while (
        pattern &&
        prevPattern &&
        !PatternValidator.canTransition(prevPattern, pattern, Math.abs(rowWorldZ - (prevWorldZ || rowWorldZ))) &&
        attempts < 10
      ) {
        pattern = this.library.getRandomByCategory(category);
        attempts++;
      }

      if (!pattern) {
        pattern = this.library.getRandomByCategory(PATTERN_CATEGORY.EASY);
      }

      if (pattern) {
        const rowData = this._buildRowData(pattern, rowOffset, trains);
        rows.push(rowData);
        prevPattern = pattern;
        prevWorldZ = rowWorldZ;
      }
    }

    // Fix 3: Clear obstacles trong lane của static train
    // Multi-car train: cars * 20 units long. Ramp chỉ ở car đầu tiên.
    // Clearance: toàn bộ train + ramp + 12 units trước + 8 units sau
    const CLEAR_BEFORE = 12;
    const CLEAR_AFTER = 8;
    for (const train of trains) {
      if (train.isMoving) continue;
      const carCount = train.cars || 1;
      const trainBaseZ = chunkZ + train.z;
      const trainStartZ = trainBaseZ - 10 - CLEAR_BEFORE;
      const trainEndZ = trainBaseZ + 10 + (carCount - 1) * 20 + 18 + CLEAR_AFTER;
      for (const row of rows) {
        const rowWorldZ = chunkZ + row.z;
        if (rowWorldZ >= trainStartZ && rowWorldZ <= trainEndZ) {
          row.obstacles = row.obstacles.filter(o => o.lane !== train.lane);
        }
      }
    }

    // Fix 4: Remove moving trains that conflict with static train lanes
    const staticLanesFromPrev = this._activeStaticTrainLanes;
    const staticLanesInChunk = new Set(trains.filter(t => !t.isMoving).map(t => t.lane));
    for (let i = trains.length - 1; i >= 0; i--) {
      const t = trains[i];
      if (t.isMoving && (staticLanesFromPrev.has(t.lane) || staticLanesInChunk.has(t.lane))) {
        trains.splice(i, 1);
        for (const row of rows) {
          row.obstacles = row.obstacles.filter(o => !(o.lane === t.lane && o.type === OBSTACLE.MOVING_TRAIN));
        }
      }
    }

    // Track static train lanes for future chunks
    for (const train of trains) {
      if (!train.isMoving) {
        this._activeStaticTrainLanes.add(train.lane);
      }
    }

    // Coin trail: dense single-lane trail with obstacle detours
    const coinTrail = this._buildCoinTrail(chunkZ, numRows, rows, trains);
    coins.push(...coinTrail);

    this.lastPattern = prevPattern;
    this.lastRowZ = prevWorldZ;

    const result = { rows, coins, trains, patternCount: numRows };
    this._currentChunkPatterns[chunk.uuid] = result;
    return result;
  }

  _calculateRowZ(index, total, chunkZ) {
    const chunkLen = CHUNK.LENGTH;
    const margin = 2;
    if (total <= 1) return Math.floor(-chunkLen * 0.5);
    const available = chunkLen - margin * 2;
    const step = available / (total - 1);
    const z = -(margin + step * index);
    return Math.floor(z);
  }

  _buildRowData(pattern, rowZ, trains) {
    const obstacles = [];
    for (const lane of pattern.getBlockedLanes()) {
      const obsConfig = pattern.getObstacleConfig(lane);
      if (!obsConfig) continue;

      const xPos = LaneUtils.laneToWorldX(lane);
      const obstacle = { lane, x: xPos, z: rowZ, type: obsConfig.type, config: obsConfig };
      obstacles.push(obstacle);

      if (obsConfig.type === OBSTACLE.STATIC_TRAIN || obsConfig.type === OBSTACLE.MOVING_TRAIN) {
        const cars = obsConfig.cars || (1 + Math.floor(Math.random() * 3));
        const hasRamp = obsConfig.hasRamp !== undefined ? obsConfig.hasRamp : (Math.random() > 0.4);
        trains.push({
          lane,
          x: xPos,
          z: rowZ,
          isMoving: obsConfig.type === OBSTACLE.MOVING_TRAIN,
          cars: Math.min(cars, 3),
          hasRamp: obsConfig.type === OBSTACLE.MOVING_TRAIN ? false : hasRamp,
          rooftopCoins: obsConfig.rooftopCoins || false,
        });
      }
    }
    return { pattern, z: rowZ, obstacles };
  }

  _buildCoinTrail(chunkZ, numRows, rows, trains) {
    const coins = [];
    const chunkLen = CHUNK.LENGTH;
    const SPACING = 6;
    const TURN_STEPS = 4;
    const STRAIGHT_MIN = 3;
    const STRAIGHT_MAX = 5;

    // Build per-lane blocked Z ranges (world-space)
    const blockedRanges = { 0: [], 1: [], 2: [] };
    for (const row of rows) {
      for (const obs of row.obstacles) {
        const worldZ = chunkZ + row.z;
        let halfWidth = 3;
        if (obs.type === OBSTACLE.STATIC_TRAIN || obs.type === OBSTACLE.MOVING_TRAIN) {
          const train = trains.find(
            t => t.lane === obs.lane && Math.abs((chunkZ + t.z) - worldZ) < 10
          );
          const carCount = train ? (train.cars || 1) : 1;
          halfWidth = 10 + (carCount - 1) * 10 + 9;
        }
        blockedRanges[obs.lane].push({ start: worldZ - halfWidth, end: worldZ + halfWidth });
      }
    }

    // Merge overlapping ranges per lane
    for (const lane of [0, 1, 2]) {
      blockedRanges[lane].sort((a, b) => a.start - b.start);
      const merged = [];
      for (const r of blockedRanges[lane]) {
        if (merged.length > 0 && r.start <= merged[merged.length - 1].end + 2) {
          merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, r.end);
        } else {
          merged.push({ start: r.start, end: r.end });
        }
      }
      blockedRanges[lane] = merged;
    }

    const isBlocked = (lane, worldZ) => {
      for (const r of blockedRanges[lane]) {
        if (worldZ >= r.start && worldZ <= r.end) return true;
      }
      return false;
    };

    const getSafeLane = (worldZ) => {
      for (const lane of [1, 0, 2]) {
        if (!isBlocked(lane, worldZ)) return lane;
      }
      return null;
    };

    const xToLane = (x) => Math.max(0, Math.min(2, Math.round((x + 3) / 3)));

    let curLane = this._coinLane;
    let coinX = LaneUtils.laneToWorldX(curLane);
    let moveTarget = null; // { targetLane, stepsRemaining }
    let straightCoins = STRAIGHT_MIN + Math.floor(Math.random() * (STRAIGHT_MAX - STRAIGHT_MIN + 1));

    for (let offset = -SPACING; offset > -chunkLen; offset -= SPACING) {
      const worldZ = chunkZ + offset;

      // Decide whether to start a lane transition
      if (straightCoins <= 0 && !moveTarget) {
        const adj = LaneUtils.getAdjacentLanes(curLane);
        const candidates = adj.filter(l => !isBlocked(l, worldZ));
        if (candidates.length > 0 && Math.random() < 0.5) {
          const nextLane = candidates[Math.floor(Math.random() * candidates.length)];
          moveTarget = { targetLane: nextLane, stepsRemaining: TURN_STEPS };
        }
        straightCoins = STRAIGHT_MIN + Math.floor(Math.random() * (STRAIGHT_MAX - STRAIGHT_MIN + 1));
      }

      // Execute gradual lane transition
      if (moveTarget) {
        const targetX = LaneUtils.laneToWorldX(moveTarget.targetLane);
        const step = (targetX - coinX) / moveTarget.stepsRemaining;
        coinX += step;
        straightCoins--;
        moveTarget.stepsRemaining--;
        if (moveTarget.stepsRemaining <= 0) {
          curLane = moveTarget.targetLane;
          coinX = targetX;
          moveTarget = null;
        }
      }

      // Obstacle avoidance: if current position is blocked, snap to safe lane
      const approxLane = xToLane(coinX);
      if (isBlocked(approxLane, worldZ)) {
        const safe = getSafeLane(worldZ);
        if (safe !== null) {
          coinX = LaneUtils.laneToWorldX(safe);
          curLane = safe;
          moveTarget = null;
          straightCoins = 2;
        } else {
          continue;
        }
      }

      const lane = xToLane(coinX);
      coins.push({
        lane,
        x: coinX,
        z: offset,
        type: 'trail',
        value: 10,
      });
    }

    // Decide coin position for next chunk start
    this._coinShiftsSinceChange++;
    const config = this.difficulty.getConfig();
    const shiftChance = (config.coinShiftChance || 0.15) + (this._coinShiftsSinceChange > 4 ? 0.4 : 0);
    const nextBoundaryZ = chunkZ - chunkLen;
    if (Math.random() < shiftChance) {
      const adj = LaneUtils.getAdjacentLanes(curLane);
      const safeAdj = adj.filter(l => !isBlocked(l, nextBoundaryZ));
      const pickFrom = safeAdj.length > 0 ? safeAdj : adj;
      if (pickFrom.length > 0) {
        curLane = pickFrom[Math.floor(Math.random() * pickFrom.length)];
        coinX = LaneUtils.laneToWorldX(curLane);
        this._coinShiftsSinceChange = 0;
      }
    }
    // If current lane is blocked at boundary, force shift
    if (isBlocked(curLane, nextBoundaryZ)) {
      const safe = getSafeLane(nextBoundaryZ);
      if (safe !== null) {
        curLane = safe;
        coinX = LaneUtils.laneToWorldX(curLane);
      }
    }

    this._coinLane = curLane;
    return coins;
  }

  clearChunkData(chunk) {
    const data = this._currentChunkPatterns[chunk.uuid];
    if (data) {
      for (const train of data.trains || []) {
        if (!train.isMoving && !this._hasActiveStaticTrainInLane(chunk, train.lane)) {
          this._activeStaticTrainLanes.delete(train.lane);
        }
      }
    }
    delete this._currentChunkPatterns[chunk.uuid];
  }

  _hasActiveStaticTrainInLane(excludeChunk, lane) {
    for (const [uuid, data] of Object.entries(this._currentChunkPatterns)) {
      if (uuid === excludeChunk.uuid) continue;
      if (data.trains && data.trains.some(t => !t.isMoving && t.lane === lane)) return true;
    }
    return false;
  }

  getChunkTrainData(chunkUuid) {
    const data = this._currentChunkPatterns[chunkUuid];
    return data ? data.trains || [] : [];
  }

  getChunkCoinData(chunkUuid) {
    const data = this._currentChunkPatterns[chunkUuid];
    return data ? data.coins || [] : [];
  }

  reset() {
    this.difficulty.reset();
    this.lastPattern = null;
    this.lastRowZ = null;
    this.playerLane = LANE.MIDDLE;
    this.playerZ = 0;
    this._chunksGenerated = 0;
    this._currentChunkPatterns = {};
    this._activeStaticTrainLanes.clear();
    this._coinLane = LANE.MIDDLE;
    this._coinShiftsSinceChange = 0;
  }
}
