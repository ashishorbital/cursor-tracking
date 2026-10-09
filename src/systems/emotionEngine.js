/**
 * EmotionEngine System
 * Analyzes cursor behavior, calculates emotion confidence scores,
 * enforces hysteresis / transition cooldowns, and updates target emotion state.
 */

import { PROXIMITY_ZONES } from './cursorTracker.js';

export const EMOTIONS = {
  NEUTRAL: 'neutral',
  CURIOUS: 'curious',
  HAPPY: 'happy',
  EXCITED: 'excited',
  SURPRISED: 'surprised',
  CONFUSED: 'confused',
  NERVOUS: 'nervous',
  SLEEPY: 'sleepy',
  SAD: 'sad',
  DIZZY: 'dizzy'
};

export class EmotionEngine {
  constructor() {
    this.currentEmotion = EMOTIONS.NEUTRAL;
    this.targetEmotion = EMOTIONS.NEUTRAL;
    this.confidence = 1.0;

    // Manual Forced Emotion (for demonstration / quick testing toolbar)
    this.forcedEmotion = null;

    // Scores dictionary
    this.scores = {
      [EMOTIONS.NEUTRAL]: 0.3,
      [EMOTIONS.CURIOUS]: 0.0,
      [EMOTIONS.HAPPY]: 0.0,
      [EMOTIONS.EXCITED]: 0.0,
      [EMOTIONS.SURPRISED]: 0.0,
      [EMOTIONS.CONFUSED]: 0.0,
      [EMOTIONS.NERVOUS]: 0.0,
      [EMOTIONS.SLEEPY]: 0.0,
      [EMOTIONS.SAD]: 0.0,
      [EMOTIONS.DIZZY]: 0.0
    };

    // Transition & Hysteresis Controls
    this.lastEmotionChangeTime = performance.now();
    this.minEmotionDuration = 900; // ms minimum duration before changing emotion
    this.transitionCooldown = 400; // ms cooldown between switching emotions
    this.historyBuffer = [];

    // Track state for transition triggers (e.g. was close before moving away)
    this.wasCloseRecently = false;
    this.closeTime = 0;
  }

  /**
   * Set forced emotion for manual testing
   * @param {string|null} emo 
   */
  setForcedEmotion(emo) {
    if (emo === 'auto' || !emo) {
      this.forcedEmotion = null;
    } else if (Object.values(EMOTIONS).includes(emo)) {
      this.forcedEmotion = emo;
      this.currentEmotion = emo;
      this.targetEmotion = emo;
    }
  }

  /**
   * Evaluates cursor metrics and calculates emotion scores
   * @param {CursorTracker} tracker 
   * @param {number} deltaTime 
   */
  update(tracker, deltaTime) {
    const now = performance.now();

    // If manual forced emotion is set, bypass automatic score evaluation
    if (this.forcedEmotion) {
      this.currentEmotion = this.forcedEmotion;
      this.targetEmotion = this.forcedEmotion;
      this.confidence = 1.0;
      for (const key in this.scores) {
        this.scores[key] = (key === this.forcedEmotion) ? 1.0 : 0.0;
      }
      return;
    }

    // 1. Decay existing scores slightly each frame for hysteresis
    for (const emo in this.scores) {
      if (emo === EMOTIONS.NEUTRAL) {
        this.scores[emo] = 0.25; // Keep neutral baseline score
      } else {
        this.scores[emo] *= 0.92; // Decay score
      }
    }

    // 2. Proximity history tracking
    if (tracker.proximityZone === PROXIMITY_ZONES.VERY_CLOSE || tracker.proximityZone === PROXIMITY_ZONES.CLOSE) {
      this.wasCloseRecently = true;
      this.closeTime = now;
    } else if (now - this.closeTime > 2000) {
      this.wasCloseRecently = false;
    }

    // 3. Analyze cursor metrics and accumulate scores

    // A. DIZZY: High circular rotations around character
    const rotations = tracker.getCumulativeSweepRotations();
    if (rotations > 1.3) {
      this.scores[EMOTIONS.DIZZY] += Math.min(1.0, rotations * 0.4);
    }

    // B. SURPRISED: Sudden rapid approach OR sudden sharp turn at high speed
    const isSuddenApproach = tracker.isApproaching && tracker.deltaDistanceRate < -0.55 && tracker.proximityZone !== PROXIMITY_ZONES.FAR;
    const isSharpTurn = tracker.directionChange > 1.8 && tracker.speed > 0.8;
    if (isSuddenApproach || isSharpTurn) {
      this.scores[EMOTIONS.SURPRISED] += 0.85;
    }

    // C. EXCITED: Fast cursor speed / rapid movement
    if (tracker.speed > 1.1) {
      this.scores[EMOTIONS.EXCITED] += Math.min(0.9, (tracker.speed - 1.0) * 0.7);
    }

    // D. CONFUSED: Erratic direction changes at moderate speed
    if (tracker.directionChange > 1.1 && tracker.speed > 0.25 && tracker.speed < 1.1) {
      this.scores[EMOTIONS.CONFUSED] += 0.65;
    }

    // E. NERVOUS: Repeated approach <-> retreat oscillation
    const flipCount = tracker.getNervousOscillationCount();
    if (flipCount >= 3) {
      this.scores[EMOTIONS.NERVOUS] += Math.min(0.9, flipCount * 0.25);
    }

    // F. SLEEPY: Inactivity for > 4 seconds
    if (tracker.idleTime > 4000) {
      const sleepinessFactor = Math.min(1.0, (tracker.idleTime - 4000) / 3000);
      this.scores[EMOTIONS.SLEEPY] += sleepinessFactor * 0.9;
    }

    // G. SAD: Rapidly moving away after being close
    if (tracker.isMovingAway && tracker.deltaDistanceRate > 0.45 && this.wasCloseRecently) {
      this.scores[EMOTIONS.SAD] += 0.75;
    }

    // H. CURIOUS: Close proximity with slow/attentive movement
    if ((tracker.proximityZone === PROXIMITY_ZONES.VERY_CLOSE || tracker.proximityZone === PROXIMITY_ZONES.CLOSE) && tracker.speed < 0.45 && tracker.idleTime < 3000) {
      this.scores[EMOTIONS.CURIOUS] += 0.7;
    }

    // I. HAPPY: Gentle, smooth movement around close/medium distance
    const isGentle = tracker.speed >= 0.08 && tracker.speed <= 0.55 && tracker.directionChange < 0.6;
    if (isGentle && (tracker.proximityZone === PROXIMITY_ZONES.CLOSE || tracker.proximityZone === PROXIMITY_ZONES.MEDIUM)) {
      this.scores[EMOTIONS.HAPPY] += 0.6;
    }

    // 4. Select Candidate Emotion with Highest Score
    let highestEmotion = EMOTIONS.NEUTRAL;
    let maxScore = -1;

    for (const emo in this.scores) {
      if (this.scores[emo] > maxScore) {
        maxScore = this.scores[emo];
        highestEmotion = emo;
      }
    }

    this.targetEmotion = highestEmotion;

    // 5. Evaluate Hysteresis & Minimum Duration Thresholds
    const timeSinceLastChange = now - this.lastEmotionChangeTime;
    
    // Immediate override for SURPRISED (high urgency reaction)
    const isUrgentSurprise = highestEmotion === EMOTIONS.SURPRISED && maxScore > 0.7;

    if (highestEmotion !== this.currentEmotion) {
      if (isUrgentSurprise || (timeSinceLastChange >= this.minEmotionDuration && maxScore >= 0.4)) {
        this.currentEmotion = highestEmotion;
        this.lastEmotionChangeTime = now;
      }
    }

    // Calculate confidence level
    this.confidence = Math.min(1.0, Math.max(0.2, maxScore));
  }
}
