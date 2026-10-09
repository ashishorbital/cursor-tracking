/**
 * AnimationController System
 * Drives the main requestAnimationFrame loop, coordinates CursorTracker,
 * EmotionEngine, BlinkController, and Character renderer.
 * Enforces prefers-reduced-motion media query.
 */

export class AnimationController {
  constructor(character, tracker, emotionEngine, blinkController) {
    this.character = character;
    this.tracker = tracker;
    this.emotionEngine = emotionEngine;
    this.blinkController = blinkController;

    this.isRunning = false;
    this.lastFrameTime = performance.now();
    this.rafId = null;

    // Accessibility check: prefers-reduced-motion
    this.prefersReducedMotion = false;
    this.initAccessibilityListener();

    // Debug Mode settings
    this.isDebugEnabled = false;
    this.debugElements = {};
    this.cacheDebugDOM();

    this.loop = this.loop.bind(this);
  }

  initAccessibilityListener() {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.prefersReducedMotion = mediaQuery.matches;

    const updateIndicator = () => {
      const el = document.getElementById('reduced-motion-indicator');
      if (el) {
        el.textContent = `Reduced Motion: ${this.prefersReducedMotion ? 'On' : 'Off'}`;
      }
    };
    updateIndicator();

    mediaQuery.addEventListener('change', (e) => {
      this.prefersReducedMotion = e.matches;
      updateIndicator();
    });
  }

  setDebugMode(enabled) {
    this.isDebugEnabled = enabled;
    const panel = document.getElementById('debug-panel');
    if (panel) {
      if (enabled) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    }
  }

  toggleDebugMode() {
    this.setDebugMode(!this.isDebugEnabled);
  }

  cacheDebugDOM() {
    this.debugElements = {
      pos: document.getElementById('dbg-pos'),
      speed: document.getElementById('dbg-speed'),
      vel: document.getElementById('dbg-vel'),
      dist: document.getElementById('dbg-dist'),
      zone: document.getElementById('dbg-zone'),
      idle: document.getElementById('dbg-idle'),
      dirchange: document.getElementById('dbg-dirchange'),
      approaching: document.getElementById('dbg-approaching'),
      sweep: document.getElementById('dbg-sweep'),
      currentEmo: document.getElementById('dbg-current-emo'),
      targetEmo: document.getElementById('dbg-target-emo'),
      confidence: document.getElementById('dbg-confidence'),
      scoresList: document.getElementById('dbg-scores-list')
    };
  }

  start() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.lastFrameTime = performance.now();
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  stop() {
    if (this.isRunning) {
      this.isRunning = false;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
      }
    }
  }

  loop(now) {
    if (!this.isRunning) return;

    const deltaTime = Math.min(100, now - this.lastFrameTime); // Cap delta to prevent huge jumps on tab switch
    this.lastFrameTime = now;

    // 1. Update Cursor Tracker metrics
    this.tracker.update(deltaTime);

    // 2. Update Emotion Engine state
    this.emotionEngine.update(this.tracker, deltaTime);

    // 3. Update Blink Controller
    const blinkProgress = this.blinkController.update(now);

    // 4. Update Character Target State
    this.character.updatePupilTargets(this.tracker.x, this.tracker.y);
    this.character.applyEmotionTargets(this.emotionEngine.currentEmotion, blinkProgress, this.tracker);

    // 5. Determine lerp smoothing factor (reduced motion uses gentler/slower transitions)
    let lerpFactor = 0.16; // default smooth lag
    if (this.prefersReducedMotion) {
      lerpFactor = 0.06; // reduced motion smoothing
    }

    // 6. Apply Animation Frame
    this.character.updateAnimation(lerpFactor);

    // 7. Render Debug Panel if active
    if (this.isDebugEnabled) {
      this.updateDebugPanel();
    }

    // 8. Schedule next frame
    this.rafId = requestAnimationFrame(this.loop);
  }

  updateDebugPanel() {
    const d = this.debugElements;
    const tr = this.tracker;
    const ee = this.emotionEngine;

    if (d.pos) d.pos.textContent = `${Math.round(tr.x)}, ${Math.round(tr.y)}`;
    if (d.speed) d.speed.textContent = `${tr.speed.toFixed(2)} px/ms`;
    if (d.vel) d.vel.textContent = `${tr.vx.toFixed(1)}, ${tr.vy.toFixed(1)}`;
    if (d.dist) d.dist.textContent = `${Math.round(tr.distance)} px`;
    if (d.zone) d.zone.textContent = tr.proximityZone;
    if (d.idle) d.idle.textContent = `${(tr.idleTime / 1000).toFixed(1)}s`;
    if (d.dirchange) d.dirchange.textContent = tr.directionChange.toFixed(2);
    if (d.approaching) d.approaching.textContent = tr.isApproaching ? 'Yes ⬇' : (tr.isMovingAway ? 'Away ⬆' : 'No');
    if (d.sweep) d.sweep.textContent = `${tr.getCumulativeSweepRotations().toFixed(1)} revs`;

    if (d.currentEmo) d.currentEmo.textContent = ee.currentEmotion;
    if (d.targetEmo) d.targetEmo.textContent = ee.targetEmotion;
    if (d.confidence) d.confidence.textContent = `${Math.round(ee.confidence * 100)}%`;

    // Render emotion score progress bars
    if (d.scoresList) {
      let html = '';
      for (const emo in ee.scores) {
        const score = Math.max(0, Math.min(1, ee.scores[emo]));
        const percent = Math.round(score * 100);
        const isActive = emo === ee.currentEmotion;
        html += `
          <div class="score-bar-row">
            <span class="score-label">${emo}</span>
            <div class="score-track">
              <div class="score-fill ${isActive ? 'active' : ''}" style="width: ${percent}%;"></div>
            </div>
            <span class="score-val">${percent}%</span>
          </div>
        `;
      }
      d.scoresList.innerHTML = html;
    }
  }
}
