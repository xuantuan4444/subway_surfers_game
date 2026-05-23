import { LANE, OBSTACLE, PATTERN_CATEGORY, CHUNK, POWERUP } from '../constants.js';
import { LaneUtils } from '../utils/LaneUtils.js';
import { PatternLibrary, PatternValidator } from '../patterns/PatternLibrary.js';
import { DifficultyManager } from './DifficultyManager.js';

const CAR_LENGTH = 20;
const RAMP_LENGTH = 8;

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
    this._rampZones = [];
    this._trainExtents = [];
    this._lastActionTags = [];
    this._movingTrainLaneCount = { 0: 0, 1: 0, 2: 0 };
    this._lastPowerUpZ = -999;
    this._retroactiveClearList = [];
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
      return { rows: [], coins, trains: [], patternCount: 0, powerUps: [] };
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
      while (pattern && attempts < 20) {
        let rejected = false;
        if (prevPattern) {
          const spacing = Math.abs(rowWorldZ - (prevWorldZ || rowWorldZ));
          if (!PatternValidator.canTransition(prevPattern, pattern, spacing)) {
            rejected = true;
          }
        }
        if (!rejected && this._lastActionTags.length > 0) {
          const minGap = this._calcMinActionGap(rowWorldZ);
          if (this._conflictsWithRecentActions(pattern, minGap)) {
            rejected = true;
          }
        }
        // Cân bằng tỉ lệ moving train giữa 3 lane
        if (!rejected) {
          for (const lane of [0, 1, 2]) {
            const obs = pattern.obstacles && pattern.obstacles[lane];
            if (obs && obs.type === OBSTACLE.MOVING_TRAIN) {
              const minCount = Math.min(...Object.values(this._movingTrainLaneCount));
              if (this._movingTrainLaneCount[lane] > minCount) {
                rejected = true;
              }
              break;
            }
          }
        }
        if (!rejected) break;
        pattern = this.library.getRandomByCategory(category);
        attempts++;
      }

      if (!pattern) {
        pattern = this.library.getRandomByCategory(PATTERN_CATEGORY.EASY);
      }

      if (pattern) {
        const prevTrainCount = trains.length;
        const rowData = this._buildRowData(pattern, rowOffset, trains);
        rows.push(rowData);
        // Cập nhật ngay count moving train để row sau trong cùng chunk biết lane nào đã dùng
        for (let t = prevTrainCount; t < trains.length; t++) {
          if (trains[t].isMoving) {
            this._movingTrainLaneCount[trains[t].lane] = (this._movingTrainLaneCount[trains[t].lane] || 0) + 1;
          }
        }
        prevPattern = pattern;
        prevWorldZ = rowWorldZ;
      }
    }

    // Kiểm tra không có tình huống bí (cả 3 lane đều blocked ở cùng Z)
    if (!this._validateNoEscape(rows, trains, chunkZ)) {
      return this._generateRows(numRows, chunk, chunkZ, mode);
    }

    // Clear obstacles trong lane của static train + ramp
    // Multi-car train: cars * 20 units long. Ramp chỉ ở car đầu tiên.
    // Clearance: toàn bộ train + ramp + margin
    // Đồng thời xóa obstacle ở lane kế bên trong vùng train body (vì train lấn sang lane kế)
    const CLEAR_BEFORE = 12;
    const CLEAR_AFTER = 16;
    for (const train of trains) {
      if (train.isMoving) continue;
      const carCount = train.cars || 1;
      const halfLen = CAR_LENGTH / 2;
      const trainBaseZ = chunkZ + train.z;
      const trainStartZ = trainBaseZ - halfLen - (carCount - 1) * CAR_LENGTH - CLEAR_BEFORE;
      const trainEndZ = trainBaseZ + halfLen + RAMP_LENGTH + CLEAR_AFTER;
      for (const row of rows) {
        const rowWorldZ = chunkZ + row.z;
        if (rowWorldZ >= trainStartZ && rowWorldZ <= trainEndZ) {
          row.obstacles = row.obstacles.filter(o => o.lane !== train.lane);
        }
      }
      // Clear obstacle ở lane kế bên trong phạm vi thân train lấn sang
      const adjLanes = LaneUtils.getAdjacentLanes(train.lane);
      if (adjLanes.length > 0) {
        const bodyStartZ = trainBaseZ - halfLen - (carCount - 1) * CAR_LENGTH;
        const bodyEndZ = trainBaseZ + halfLen + RAMP_LENGTH;
        for (const row of rows) {
          const rowWorldZ = chunkZ + row.z;
          if (rowWorldZ >= bodyStartZ && rowWorldZ <= bodyEndZ) {
            row.obstacles = row.obstacles.filter(o => !adjLanes.includes(o.lane));
          }
        }
      }

      // Store train extent for cross-chunk clearance
      this._trainExtents.push({
        lane: train.lane,
        clearStartZ: trainStartZ,
        clearEndZ: trainEndZ,
        bodyStartZ: trainBaseZ - halfLen - (carCount - 1) * CAR_LENGTH,
        bodyEndZ: trainBaseZ + halfLen + RAMP_LENGTH,
        chunkUuid: chunk.uuid,
      });
    }

    // Moving train: xóa obstacle cùng lane + lane kế trong toàn bộ chunk
    for (const train of trains) {
      if (!train.isMoving) continue;
      const carCount = train.cars || 1;
      const halfLen = CAR_LENGTH / 2;
      const trainBaseZ = chunkZ + train.z;
      const trainStartZ = trainBaseZ - halfLen - (carCount - 1) * CAR_LENGTH;
      const trainEndZ = trainBaseZ + halfLen;
      for (const row of rows) {
        row.obstacles = row.obstacles.filter(o => o.lane !== train.lane);
      }
      // Clear obstacle ở lane kế bên trong phạm vi thân train (vì train rộng 2.6)
      const adjLanes = LaneUtils.getAdjacentLanes(train.lane);
      if (adjLanes.length > 0) {
        for (const row of rows) {
          const rowWorldZ = chunkZ + row.z;
          if (rowWorldZ >= trainStartZ && rowWorldZ <= trainEndZ) {
            row.obstacles = row.obstacles.filter(o => !adjLanes.includes(o.lane));
          }
        }
      }
      // Store moving train extent for cross-chunk clearance
      this._trainExtents.push({
        lane: train.lane,
        clearStartZ: trainStartZ - CLEAR_BEFORE,
        clearEndZ: trainEndZ + CLEAR_AFTER,
        bodyStartZ: trainStartZ,
        bodyEndZ: trainEndZ,
        chunkUuid: chunk.uuid,
      });
    }

    // Retroactive clearance: clear obstacles in EXISTING chunks that overlap with this chunk's trains
    for (const train of trains) {
      const carCount = train.cars || 1;
      const halfLen = CAR_LENGTH / 2;
      const trainBaseZ = chunkZ + train.z;
      const bodyStartZ = trainBaseZ - halfLen - (carCount - 1) * CAR_LENGTH;
      const bodyEndZ = trainBaseZ + halfLen + (train.isMoving ? 0 : RAMP_LENGTH);
      const clearStartZ = bodyStartZ - 12;
      const clearEndZ = bodyEndZ + 16;
      const adjLanes = LaneUtils.getAdjacentLanes(train.lane);
      for (const [otherUuid, otherData] of Object.entries(this._currentChunkPatterns)) {
        if (otherUuid === chunk.uuid) continue;
        if (otherData.chunkZ === undefined) continue;
        let modified = false;
        for (const row of otherData.rows) {
          const rowWorldZ = otherData.chunkZ + row.z;
          if (rowWorldZ >= clearStartZ && rowWorldZ <= clearEndZ) {
            const before = row.obstacles.length;
            row.obstacles = row.obstacles.filter(o => o.lane !== train.lane);
            if (row.obstacles.length !== before) modified = true;
          }
          if (adjLanes.length > 0 && rowWorldZ >= bodyStartZ && rowWorldZ <= bodyEndZ) {
            const before = row.obstacles.length;
            row.obstacles = row.obstacles.filter(o => !adjLanes.includes(o.lane));
            if (row.obstacles.length !== before) modified = true;
          }
        }
        if (modified) {
          this._retroactiveClearList.push({
            chunkUuid: otherUuid,
            trainLane: train.lane,
            adjLanes,
            clearStartZ,
            clearEndZ,
            bodyStartZ,
            bodyEndZ,
          });
        }
      }
    }

    // Cross-chunk clearance: clear obstacles in this chunk that overlap with train extents from OTHER chunks
    for (const ext of this._trainExtents) {
      if (ext.chunkUuid === chunk.uuid) continue;
      for (const row of rows) {
        const rowWorldZ = chunkZ + row.z;
        if (rowWorldZ >= ext.clearStartZ && rowWorldZ <= ext.clearEndZ) {
          row.obstacles = row.obstacles.filter(o => o.lane !== ext.lane);
        }
        // Clear adjacent lanes within body extent
        const adjLanes = LaneUtils.getAdjacentLanes(ext.lane);
        if (adjLanes.length > 0 && rowWorldZ >= ext.bodyStartZ && rowWorldZ <= ext.bodyEndZ) {
          row.obstacles = row.obstacles.filter(o => !adjLanes.includes(o.lane));
        }
      }
    }

    // Track action tags for consecutive-pattern conflict prevention
    for (const row of rows) {
      for (const obs of row.obstacles) {
        if (obs.type === OBSTACLE.LOW_BARRIER) this._lastActionTags.push({ tag: 'jump', z: chunkZ + row.z });
        if (obs.type === OBSTACLE.HIGH_BARRIER) this._lastActionTags.push({ tag: 'slide', z: chunkZ + row.z });
      }
    }
    // Keep only recent tags (within 30 units)
    const cutoffZ = chunkZ + 10;
    this._lastActionTags = this._lastActionTags.filter(t => t.z >= cutoffZ);

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
    const coinTrail = this._buildCoinTrail(chunkZ, numRows, rows, trains, chunk.uuid);
    coins.push(...coinTrail);

    // Power-ups: replace some coin positions
    const powerUps = this._placePowerUps(chunkZ, coins);

    this.lastPattern = prevPattern;
    this.lastRowZ = prevWorldZ;

    const result = { rows, coins, trains, patternCount: numRows, powerUps, chunkZ };
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

  _validateNoEscape(rows, trains, chunkZ) {
    // Xây dựng lane mask cho mỗi Z position (mỗi row + train extent)
    const blocked = { 0: [], 1: [], 2: [] };
    for (const row of rows) {
      const rz = chunkZ + row.z;
      for (const obs of row.obstacles) {
        let rearLen = 3;
        let frontLen = 3;
        if (obs.type === OBSTACLE.STATIC_TRAIN || obs.type === OBSTACLE.MOVING_TRAIN) {
          const train = trains.find(
            t => t.lane === obs.lane && Math.abs(t.z - row.z) < 5
          );
          const cars = train ? (train.cars || 1) : 1;
          rearLen = 10 + (cars - 1) * CAR_LENGTH;
          frontLen = obs.type === OBSTACLE.MOVING_TRAIN ? 10 : 10 + RAMP_LENGTH;
        }
        blocked[obs.lane].push({ start: rz - rearLen, end: rz + frontLen });
      }
    }
    // Merge per lane
    for (const lane of [0, 1, 2]) {
      blocked[lane].sort((a, b) => a.start - b.start);
      const merged = [];
      for (const r of blocked[lane]) {
        if (merged.length > 0 && r.start <= merged[merged.length - 1].end) {
          merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, r.end);
        } else {
          merged.push({ start: r.start, end: r.end });
        }
      }
      blocked[lane] = merged;
    }
    // Check each row's Z + train midpoints for inescapable situations
    const checkZ = (z) => {
      const blockedLanes = [0, 1, 2].filter(l =>
        blocked[l].some(r => z >= r.start && z <= r.end)
      );
      return blockedLanes.length < 3;
    };
    for (const row of rows) {
      if (!checkZ(chunkZ + row.z)) return false;
    }
    for (const train of trains) {
      const tz = chunkZ + train.z;
      const cars = train.cars || 1;
      const rearLen = 10 + (cars - 1) * CAR_LENGTH;
      const frontLen = train.isMoving ? 10 : 10 + RAMP_LENGTH;
      if (!checkZ(tz)) return false;
      if (!checkZ(tz - rearLen)) return false;
      if (!checkZ(tz + frontLen)) return false;
    }
    return true;
  }

  _buildCoinTrail(chunkZ, numRows, rows, trains, currentChunkUuid) {
    const coins = [];
    const chunkLen = CHUNK.LENGTH;
    const SPACING = 6;
    const TURN_STEPS = 4;
    const STRAIGHT_MIN = 3;
    const STRAIGHT_MAX = 5;

    // Build per-lane blocked Z ranges (world-space)
    const blockedRanges = { 0: [], 1: [], 2: [] };
    const ALL_LANES = [0, 1, 2];
    for (const row of rows) {
      for (const obs of row.obstacles) {
        const worldZ = chunkZ + row.z;
        let rearExtent = 5;
        let frontExtent = 5;
        if (obs.type === OBSTACLE.STATIC_TRAIN || obs.type === OBSTACLE.MOVING_TRAIN) {
          const train = trains.find(
            t => t.lane === obs.lane && Math.abs((chunkZ + t.z) - worldZ) < 10
          );
          const carCount = train ? (train.cars || 1) : 1;
          // Block full train extent from rear past last car to front past ramp
          const frontExtent = 10 + RAMP_LENGTH;
          const rearExtent = 10 + (carCount - 1) * CAR_LENGTH;
          // Also block adjacent lanes near the train front (car front to past ramp)
          for (const adjLane of ALL_LANES) {
            if (adjLane === obs.lane) continue;
            blockedRanges[adjLane].push({
              start: worldZ + 10,
              end: worldZ + frontExtent,
            });
          }
        }
        blockedRanges[obs.lane].push({ start: worldZ - rearExtent, end: worldZ + frontExtent });
      }
    }

    // Bổ sung blocked range từ trains array (vì obstacle của train đã bị xóa ở clearance)
    for (const train of trains) {
      const worldZ = chunkZ + train.z;
      const carCount = train.cars || 1;
      const frontExtent = 10 + (train.isMoving ? 0 : RAMP_LENGTH);
      const rearExtent = 10 + (carCount - 1) * CAR_LENGTH;
      blockedRanges[train.lane].push({ start: worldZ - rearExtent, end: worldZ + frontExtent });
      // Block adjacent lanes cho toàn bộ chiều dài train (body + ramp)
      // Vì train rộng 2.6 units, lấn 0.2 unit sang lane kế bên
      const trainStart = worldZ - 10 - (carCount - 1) * CAR_LENGTH;
      const trainEnd = worldZ + (train.isMoving ? 10 : 10 + RAMP_LENGTH);
      for (const adjLane of ALL_LANES) {
        if (adjLane === train.lane) continue;
        blockedRanges[adjLane].push({ start: trainStart, end: trainEnd });
      }
    }

    // Cross-chunk train extents (trains from previous chunks)
    for (const ext of this._trainExtents) {
      if (ext.chunkUuid === currentChunkUuid) continue;
      blockedRanges[ext.lane].push({ start: ext.bodyStartZ, end: ext.bodyEndZ });
      for (const adjLane of ALL_LANES) {
        if (adjLane === ext.lane) continue;
        blockedRanges[adjLane].push({ start: ext.bodyStartZ, end: ext.bodyEndZ });
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
      let approxLane = xToLane(coinX);
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

      // Extra safety: if after lane correction the coin still lands
      // inside an obstacle's physical bounds, skip this coin.
      const lane = xToLane(coinX);
      if (isBlocked(lane, worldZ)) {
        continue;
      }

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

  _pickPowerUpType() {
    const roll = Math.random();
    if (roll < 0.55) return POWERUP.SCORE_2X;
    if (roll < 0.75) return POWERUP.MAGNET;
    if (roll < 0.95) return POWERUP.SNEAKERS;
    return POWERUP.SCORE_4X;
  }

  _placePowerUps(chunkZ, coins) {
    const config = this.difficulty.getConfig();
    const chance = config.powerUpChance || 0.08;
    const minGap = 20;
    const powerUps = [];
    for (let i = 0; i < coins.length; i++) {
      const coin = coins[i];
      if (coin.type !== 'trail') continue;
      const worldZ = chunkZ + coin.z;
      if (Math.abs(worldZ - this._lastPowerUpZ) < minGap) continue;
      if (Math.random() < chance) {
        const type = this._pickPowerUpType();
        powerUps.push({
          lane: coin.lane,
          x: coin.x,
          z: coin.z,
          type: 'powerup',
          powerUpType: type,
        });
        coins.splice(i, 1);
        i--;
        this._lastPowerUpZ = worldZ;
      }
    }
    return powerUps;
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
    // Clean up persistent train extents and ramp zones for this chunk
    this._trainExtents = this._trainExtents.filter(e => e.chunkUuid !== chunk.uuid);
    this._rampZones = this._rampZones.filter(z => z.chunkUuid !== chunk.uuid);
    this._lastPowerUpZ = -999;
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

  getRetroactiveClearList() {
    const list = this._retroactiveClearList;
    this._retroactiveClearList = [];
    return list;
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
    this._rampZones = [];
    this._trainExtents = [];
    this._coinLane = LANE.MIDDLE;
    this._coinShiftsSinceChange = 0;
    this._movingTrainLaneCount = { 0: 0, 1: 0, 2: 0 };
    this._lastPowerUpZ = -999;
    this._retroactiveClearList = [];
  }
}
