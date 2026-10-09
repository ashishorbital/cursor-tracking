/**
 * CursorTracker System
 * Tracks mouse/touch coordinates, velocity, acceleration, direction changes,
 * distance to character, proximity zones, approach/retreat trends, and circular sweeps.
 */

export const PROXIMITY_ZONES = {
  VERY_CLOSE: 'VERY_CLOSE', // < 140px
  CLOSE: 'CLOSE',           // 140px - 280px
  MEDIUM: 'MEDIUM',         // 280px - 520px
  FAR: 'FAR'                // > 520px
};

export class CursorTracker {
  constructor(targetElement) {
    this.targetElement = targetElement;

    // Position & Prev State
    this.x = window.innerWidth / 2;
    this.y = window.innerHeight / 2;
    this.prevX = this.x;
    this.prevY = this.y;

    // Derivatives
    this.vx = 0;
    this.vy = 0;
    this.speed = 0; // px/ms
    this.prevSpeed = 0;
    this.acceleration = 0;

    // Direction & Turning
    this.directionAngle = 0;
    this.prevDirectionAngle = 0;
    this.directionChange = 0; // angular speed (rad/frame)

    // Distance & Proximity
    this.centerX = window.innerWidth / 2;
    this.centerY = window.innerHeight / 2;
    this.distance = 0;
    this.prevDistance = 0;
    this.deltaDistanceRate = 0; // px/ms (+ moving away, - approaching)
    this.proximityZone = PROXIMITY_ZONES.MEDIUM;

    // Movement History & Trends
    this.lastMoveTime = performance.now();
    this.idleTime = 0; // ms
    this.isApproaching = false;
    this.isMovingAway = false;

    // Circular Motion / Dizzy Detection
    this.angleAroundCenter = 0;
    this.prevAngleAroundCenter = 0;
    this.cumulativeSweepAngle = 0; // Accumulated radians swept around character center
    this.sweepHistory = []; // Timed angle entries

    // Rapid approach/retreat flip count (for nervous emotion)
    this.distanceFlipHistory = []; // timestamps of distance sign flips

    // Event Bindings
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onWindowResize = this.onWindowResize.bind(this);

    this.init();
  }

  init() {
    window.addEventListener('mousemove', this.onPointerMove, { passive: true });
    window.addEventListener('touchmove', this.onPointerMove, { passive: true });
    window.addEventListener('touchstart', this.onPointerMove, { passive: true });
    window.addEventListener('resize', this.onWindowResize);

    this.updateCenterCoordinates();
  }

  updateCenterCoordinates() {
    if (this.targetElement) {
      const rect = this.targetElement.getBoundingClientRect();
      this.centerX = rect.left + rect.width / 2;
      this.centerY = rect.top + rect.height / 2;
    } else {
      this.centerX = window.innerWidth / 2;
      this.centerY = window.innerHeight / 2;
    }
  }

  onPointerMove(e) {
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    this.x = clientX;
    this.y = clientY;
    this.lastMoveTime = performance.now();
  }

  onWindowResize() {
    this.updateCenterCoordinates();
  }

  /**
   * Called every animation frame in the main loop to compute smooth metrics.
   * @param {number} deltaTime - Time elapsed since last frame in ms
   */
  update(deltaTime) {
    if (deltaTime <= 0) return;

    this.updateCenterCoordinates();
    const now = performance.now();

    // 1. Idle time
    this.idleTime = now - this.lastMoveTime;

    // 2. Velocity & Speed (px/ms)
    const dx = this.x - this.prevX;
    const dy = this.y - this.prevY;
    this.vx = dx / deltaTime;
    this.vy = dy / deltaTime;
    
    // Smooth speed with exponential moving average
    const rawSpeed = Math.hypot(this.vx, this.vy);
    this.speed = this.speed * 0.7 + rawSpeed * 0.3;

    // 3. Acceleration
    const dSpeed = this.speed - this.prevSpeed;
    this.acceleration = dSpeed / deltaTime;
    this.prevSpeed = this.speed;

    // 4. Direction & Turn Rate
    if (this.speed > 0.05) {
      const currentAngle = Math.atan2(dy, dx);
      let dAngle = currentAngle - this.prevDirectionAngle;
      // Normalize angle difference to [-PI, PI]
      while (dAngle > Math.PI) dAngle -= Math.PI * 2;
      while (dAngle < -Math.PI) dAngle += Math.PI * 2;

      this.directionChange = this.directionChange * 0.7 + Math.abs(dAngle) * 0.3;
      this.directionAngle = currentAngle;
      this.prevDirectionAngle = currentAngle;
    } else {
      this.directionChange *= 0.8;
    }

    // 5. Distance & Proximity to Character Center
    const cdx = this.x - this.centerX;
    const cdy = this.y - this.centerY;
    this.distance = Math.hypot(cdx, cdy);

    const deltaDistance = this.distance - this.prevDistance;
    this.deltaDistanceRate = deltaDistance / deltaTime;

    // Determine approach / retreat status
    if (this.speed > 0.1) {
      if (this.deltaDistanceRate < -0.1) {
        this.isApproaching = true;
        this.isMovingAway = false;
      } else if (this.deltaDistanceRate > 0.1) {
        this.isApproaching = false;
        this.isMovingAway = true;
      }
    } else {
      this.isApproaching = false;
      this.isMovingAway = false;
    }

    // Distance Sign Flip tracking (approaching <-> retreating flips within 1.5 seconds)
    const currentSign = Math.sign(this.deltaDistanceRate);
    if (this.prevDeltaSign !== undefined && currentSign !== 0 && currentSign !== this.prevDeltaSign && Math.abs(this.deltaDistanceRate) > 0.15) {
      this.distanceFlipHistory.push(now);
    }
    this.prevDeltaSign = currentSign;
    this.distanceFlipHistory = this.distanceFlipHistory.filter(t => now - t < 1500);

    // Proximity Zone
    if (this.distance < 140) {
      this.proximityZone = PROXIMITY_ZONES.VERY_CLOSE;
    } else if (this.distance < 280) {
      this.proximityZone = PROXIMITY_ZONES.CLOSE;
    } else if (this.distance < 520) {
      this.proximityZone = PROXIMITY_ZONES.MEDIUM;
    } else {
      this.proximityZone = PROXIMITY_ZONES.FAR;
    }

    // 6. Circular Motion Detection around Character Center
    const currentAngleAroundCenter = Math.atan2(cdy, cdx);
    if (this.prevAngleAroundCenter !== undefined && this.speed > 0.1) {
      let sweep = currentAngleAroundCenter - this.prevAngleAroundCenter;
      while (sweep > Math.PI) sweep -= Math.PI * 2;
      while (sweep < -Math.PI) sweep += Math.PI * 2;

      this.sweepHistory.push({ time: now, sweep: sweep });
    }
    this.prevAngleAroundCenter = currentAngleAroundCenter;

    // Keep sweep history from last 2 seconds
    this.sweepHistory = this.sweepHistory.filter(item => now - item.time < 2000);
    this.cumulativeSweepAngle = this.sweepHistory.reduce((sum, item) => sum + item.sweep, 0);

    // Update prev positions
    this.prevX = this.x;
    this.prevY = this.y;
    this.prevDistance = this.distance;
  }

  getNervousOscillationCount() {
    return this.distanceFlipHistory.length;
  }

  getCumulativeSweepRotations() {
    return Math.abs(this.cumulativeSweepAngle) / (Math.PI * 2);
  }

  destroy() {
    window.removeEventListener('mousemove', this.onPointerMove);
    window.removeEventListener('touchmove', this.onPointerMove);
    window.removeEventListener('touchstart', this.onPointerMove);
    window.removeEventListener('resize', this.onWindowResize);
  }
}
