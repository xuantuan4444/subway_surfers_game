export const LANE = {
  LEFT: 0,
  MIDDLE: 1,
  RIGHT: 2,
  COUNT: 3,
  WIDTH: 3,
};

export const OBSTACLE = {
  LOW_BARRIER: 'low_barrier',
  HIGH_BARRIER: 'high_barrier',
  STATIC_TRAIN: 'static_train',
  MOVING_TRAIN: 'moving_train',
};

export const PATTERN_CATEGORY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
  TRAIN: 'train',
};

export const DIFFICULTY = {
  EARLY: 'early',
  MID: 'mid',
  LATE: 'late',
  ENDLESS: 'endless',
};

// Difficulty = speed, not complexity.
// Spawn dày đặc ngay từ đầu, obstacle + train liên tục.
// rowsPerChunk luôn cao, spacing luôn thấp.
// Speed tăng dần là yếu tố làm khó chính.
export const DIFFICULTY_CONFIG = {
  [DIFFICULTY.EARLY]: {
    startTime: 0,
    endTime: 20,
    patternWeights: {
      [PATTERN_CATEGORY.EASY]: 0.40,
      [PATTERN_CATEGORY.MEDIUM]: 0.35,
      [PATTERN_CATEGORY.HARD]: 0.05,
      [PATTERN_CATEGORY.TRAIN]: 0.20,
    },
    minSpacing: 5,
    maxSpacing: 10,
    trainFrequency: 0.25,
    speedMultiplier: 1.0,
    rowsPerChunk: { min: 4, max: 6 },
    minReactionZ: 12,
    coinShiftChance: 0.10,
    powerUpChance: 0.06,
  },
  [DIFFICULTY.MID]: {
    startTime: 20,
    endTime: 60,
    patternWeights: {
      [PATTERN_CATEGORY.EASY]: 0.20,
      [PATTERN_CATEGORY.MEDIUM]: 0.40,
      [PATTERN_CATEGORY.HARD]: 0.10,
      [PATTERN_CATEGORY.TRAIN]: 0.30,
    },
    minSpacing: 4,
    maxSpacing: 8,
    trainFrequency: 0.35,
    speedMultiplier: 1.4,
    rowsPerChunk: { min: 5, max: 7 },
    minReactionZ: 10,
    coinShiftChance: 0.15,
    powerUpChance: 0.10,
  },
  [DIFFICULTY.LATE]: {
    startTime: 60,
    endTime: 120,
    patternWeights: {
      [PATTERN_CATEGORY.EASY]: 0.10,
      [PATTERN_CATEGORY.MEDIUM]: 0.35,
      [PATTERN_CATEGORY.HARD]: 0.20,
      [PATTERN_CATEGORY.TRAIN]: 0.35,
    },
    minSpacing: 3,
    maxSpacing: 6,
    trainFrequency: 0.45,
    speedMultiplier: 1.8,
    rowsPerChunk: { min: 6, max: 8 },
    minReactionZ: 8,
    coinShiftChance: 0.20,
    powerUpChance: 0.14,
  },
  [DIFFICULTY.ENDLESS]: {
    startTime: 120,
    endTime: Infinity,
    patternWeights: {
      [PATTERN_CATEGORY.EASY]: 0.05,
      [PATTERN_CATEGORY.MEDIUM]: 0.30,
      [PATTERN_CATEGORY.HARD]: 0.25,
      [PATTERN_CATEGORY.TRAIN]: 0.40,
    },
    minSpacing: 2,
    maxSpacing: 5,
    trainFrequency: 0.50,
    speedMultiplier: 2.2,
    rowsPerChunk: { min: 7, max: 10 },
    minReactionZ: 6,
    coinShiftChance: 0.25,
    powerUpChance: 0.18,
  },
};

// Không còn rest/reward. Chỉ có easy → medium → hard → train.
// Rhythm = luân phiên obstacle + train liên tục, không breathing room.
export const RHYTHM_SEQUENCES = {
  [DIFFICULTY.EARLY]: [
    ['easy', 'medium', 'train', 'easy', 'medium', 'train', 'easy'],
    ['medium', 'easy', 'easy', 'train', 'medium', 'easy', 'train'],
    ['easy', 'train', 'medium', 'easy', 'train', 'medium', 'easy'],
    ['train', 'easy', 'medium', 'easy', 'train', 'medium', 'easy'],
  ],
  [DIFFICULTY.MID]: [
    ['medium', 'easy', 'train', 'medium', 'hard', 'train', 'medium'],
    ['easy', 'medium', 'train', 'medium', 'train', 'hard', 'medium'],
    ['train', 'medium', 'easy', 'train', 'medium', 'hard', 'train'],
    ['medium', 'train', 'medium', 'hard', 'train', 'medium', 'hard'],
  ],
  [DIFFICULTY.LATE]: [
    ['medium', 'hard', 'train', 'medium', 'hard', 'train', 'medium'],
    ['hard', 'medium', 'train', 'hard', 'medium', 'train', 'hard'],
    ['train', 'hard', 'medium', 'train', 'hard', 'medium', 'train'],
    ['medium', 'train', 'hard', 'medium', 'train', 'hard', 'hard'],
  ],
  [DIFFICULTY.ENDLESS]: [
    ['hard', 'train', 'medium', 'hard', 'train', 'hard', 'train'],
    ['train', 'hard', 'medium', 'train', 'hard', 'train', 'medium'],
    ['hard', 'medium', 'train', 'hard', 'train', 'hard', 'train'],
    ['medium', 'train', 'hard', 'train', 'hard', 'medium', 'train'],
  ],
};

export const CHUNK = {
  LENGTH: 60,
  NUM_CHUNKS: 12,
  RECYCLE_THRESHOLD: 170,
};

export const SPEED_CONFIG = {
  BASE_SPEED: 18,
  MAX_SPEED: 40,
  INCREASE_RATE: 0.25,
};

export const POWERUP = {
  SCORE_2X: 'score_2x',
  SCORE_4X: 'score_4x',
  MAGNET: 'magnet',
  SNEAKERS: 'sneakers',
};

export const POWERUP_CONFIG = {
  [POWERUP.SCORE_2X]: { duration: 12, color: 0xffd700, emissive: 0xff8800 },
  [POWERUP.SCORE_4X]: { duration: 12, color: 0xaa44ff, emissive: 0x7700dd },
  [POWERUP.MAGNET]:   { duration: 10, color: 0x4488ff, emissive: 0x0044ff },
  [POWERUP.SNEAKERS]: { duration: 10, color: 0x44ff44, emissive: 0x00cc00 },
};

export const ACTION_DISTANCE = {
  LOW_BARRIER: 4,
  HIGH_BARRIER: 4,
  LANE_SWITCH: 6,
  JUMP: 5,
  SLIDE: 5,
  TRAIN: 10,
};
