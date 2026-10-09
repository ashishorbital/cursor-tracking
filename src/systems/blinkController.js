/**
 * BlinkController System
 * Coordinates automatic random blinking and double-blinking.
 * Returns eyelid closure progress from 0.0 (open) to 1.0 (closed).
 */

export class BlinkController {
  constructor() {
    this.isBlinking = false;
    this.blinkProgress = 0.0; // 0 (open) -> 1 (closed)

    this.blinkDuration = 160; // ms for single blink cycle (close + open)
    this.holdDuration = 30; // ms closed hold duration
    this.blinkStartTime = 0;

    this.isDoubleBlinkPending = false;
    this.doubleBlinkDelay = 120; // ms gap between double blinks
    this.nextBlinkTime = performance.now() + this.getRandomInterval();
  }

  getRandomInterval() {
    // Random interval between 2.5s and 6.0s
    return 2500 + Math.random() * 3500;
  }

  triggerBlink() {
    if (!this.isBlinking) {
      this.isBlinking = true;
      this.blinkStartTime = performance.now();
      
      // 18% chance of double blink
      if (Math.random() < 0.18 && !this.isDoubleBlinkPending) {
        this.isDoubleBlinkPending = true;
      }
    }
  }

  update(now) {
    // Check if it's time for next scheduled blink
    if (!this.isBlinking && now >= this.nextBlinkTime) {
      this.triggerBlink();
    }

    if (this.isBlinking) {
      const elapsed = now - this.blinkStartTime;
      const totalDuration = this.blinkDuration + this.holdDuration;

      if (elapsed < this.blinkDuration * 0.4) {
        // Closing phase
        this.blinkProgress = elapsed / (this.blinkDuration * 0.4);
      } else if (elapsed < this.blinkDuration * 0.4 + this.holdDuration) {
        // Hold closed phase
        this.blinkProgress = 1.0;
      } else if (elapsed < totalDuration) {
        // Opening phase
        const openElapsed = elapsed - (this.blinkDuration * 0.4 + this.holdDuration);
        const openDuration = this.blinkDuration * 0.6;
        this.blinkProgress = 1.0 - (openElapsed / openDuration);
      } else {
        // Blink finished
        this.blinkProgress = 0.0;
        this.isBlinking = false;

        if (this.isDoubleBlinkPending) {
          this.isDoubleBlinkPending = false;
          // Schedule second blink shortly
          this.nextBlinkTime = now + this.doubleBlinkDelay;
        } else {
          this.nextBlinkTime = now + this.getRandomInterval();
        }
      }
    } else {
      this.blinkProgress = 0.0;
    }

    return this.blinkProgress;
  }
}
