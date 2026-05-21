import { DIFFICULTY, DIFFICULTY_CONFIG, RHYTHM_SEQUENCES, PATTERN_CATEGORY } from '../constants.js';

export class DifficultyManager {
  constructor() {
    this.survivalTime = 0;
    this.distanceTraveled = 0;
    this.currentStage = DIFFICULTY.EARLY;
    this.rhythmPosition = 0;
    this.rhythmSequence = null;
  }

  update(delta, speed) {
    this.survivalTime += delta;
    this.distanceTraveled += speed * delta;
    this.currentStage = this._determineStage();
  }

  _determineStage() {
    for (const [stage, config] of Object.entries(DIFFICULTY_CONFIG)) {
      if (this.survivalTime >= config.startTime && this.survivalTime < config.endTime) {
        return stage;
      }
    }
    return DIFFICULTY.ENDLESS;
  }

  getStage() {
    return this.currentStage;
  }

  getConfig() {
    return DIFFICULTY_CONFIG[this.currentStage] || DIFFICULTY_CONFIG[DIFFICULTY.ENDLESS];
  }

  getPatternWeights() {
    return { ...this.getConfig().patternWeights };
  }

  getSpacingRange() {
    const config = this.getConfig();
    return { min: config.minSpacing, max: config.maxSpacing };
  }

  getTrainFrequency() {
    return this.getConfig().trainFrequency;
  }

  getSpeedMultiplier() {
    return this.getConfig().speedMultiplier;
  }

  getRowsPerChunk() {
    return this.getConfig().rowsPerChunk;
  }

  getMinReactionZ() {
    return this.getConfig().minReactionZ;
  }

  getNextRhythmCategory() {
    const stage = this.currentStage;
    if (!this.rhythmSequence) {
      const sequences = RHYTHM_SEQUENCES[stage] || RHYTHM_SEQUENCES[DIFFICULTY.ENDLESS];
      this.rhythmSequence = [...sequences[Math.floor(Math.random() * sequences.length)]];
      this.rhythmPosition = 0;
    }

    if (this.rhythmPosition >= this.rhythmSequence.length) {
      const sequences = RHYTHM_SEQUENCES[stage] || RHYTHM_SEQUENCES[DIFFICULTY.ENDLESS];
      const newSeq = sequences[Math.floor(Math.random() * sequences.length)];
      if (this.rhythmSequence[this.rhythmSequence.length - 1] === newSeq[0]) {
        this.rhythmSequence = [...newSeq.slice(1)];
      } else {
        this.rhythmSequence = [...newSeq];
      }
      this.rhythmPosition = 0;
    }

    const category = this.rhythmSequence[this.rhythmPosition];
    this.rhythmPosition++;

    const weights = this.getPatternWeights();
    const categoryWeight = weights[category] || 0;

    // 70% follow rhythm, 30% weighted random (for variety)
    if (Math.random() < 0.70 && categoryWeight > 0) {
      return category;
    }

    const selected = this._weightedRandomCategory(weights);
    return selected;
  }

  _weightedRandomCategory(weights) {
    const total = Object.values(weights).reduce((s, w) => s + w, 0);
    if (total <= 0) return PATTERN_CATEGORY.EASY;
    let roll = Math.random() * total;
    for (const [category, weight] of Object.entries(weights)) {
      roll -= weight;
      if (roll <= 0) return category;
    }
    const entries = Object.entries(weights).filter(([, w]) => w > 0);
    return entries.length > 0 ? entries[entries.length - 1][0] : PATTERN_CATEGORY.EASY;
  }

  reset() {
    this.survivalTime = 0;
    this.distanceTraveled = 0;
    this.currentStage = DIFFICULTY.EARLY;
    this.rhythmSequence = null;
    this.rhythmPosition = 0;
  }
}
