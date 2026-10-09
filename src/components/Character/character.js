/**
 * Character Component & Visual Renderer
 * Manages the SVG DOM structure, facial component properties, pupil physics clamping,
 * path morphing, and emotion visual state configurations.
 */

import { EMOTIONS } from '../../systems/emotionEngine.js';

export class Character {
  constructor(containerElement) {
    this.container = containerElement;

    // SVG Eye Parameters (SVG viewport coordinates 0 0 300 300)
    this.eyeLeftCenter = { x: 105, y: 125 };
    this.eyeRightCenter = { x: 195, y: 125 };
    this.maxPupilDistance = 18; // Maximum radius pupil can move within socket

    // Current Lerped Visual State (What's rendered)
    this.state = {
      pupilLeft: { x: 0, y: 0, scale: 1.0 },
      pupilRight: { x: 0, y: 0, scale: 1.0 },
      eyeScale: 1.0,
      eyelidLeft: 0.0, // 0 = open, 1 = closed
      eyelidRight: 0.0,
      eyebrowLeft: { y: 0, rot: 0 },
      eyebrowRight: { y: 0, rot: 0 },
      head: { rot: 0, tx: 0, ty: 0, scale: 1.0 },
      blush: { opacity: 0.35, scale: 1.0 },
      mouthControl: { p1y: 190, p2y: 190, isOpen: false, isO: false } // controls mouth curvature
    };

    // Target Visual State (Where lerp is heading)
    this.targetState = JSON.parse(JSON.stringify(this.state));

    this.renderSVG();
    this.cacheDOM();
  }

  renderSVG() {
    this.container.innerHTML = `
      <svg class="character-svg" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <!-- Soft Skin Tone Gradient -->
          <radialGradient id="head-gradient" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#fff0e0" />
            <stop offset="60%" stop-color="#ffd5ba" />
            <stop offset="100%" stop-color="#f5ba95" />
          </radialGradient>

          <!-- Hair Gradient -->
          <radialGradient id="hair-gradient" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#3b2416" />
            <stop offset="100%" stop-color="#1c0f08" />
          </radialGradient>

          <!-- Vibrant Pupil Gradient (Hazel) -->
          <radialGradient id="pupil-gradient" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#92623b" />
            <stop offset="60%" stop-color="#4a2810" />
            <stop offset="100%" stop-color="#110702" />
          </radialGradient>

          <!-- Left Eye Clip Path -->
          <clipPath id="eye-left-clip">
            <ellipse cx="105" cy="125" rx="30" ry="34" />
          </clipPath>

          <!-- Right Eye Clip Path -->
          <clipPath id="eye-right-clip">
            <ellipse cx="195" cy="125" rx="30" ry="34" />
          </clipPath>
        </defs>

        <!-- Root Head/Body Group -->
        <g id="head-group">
          <!-- Back Hair -->
          <path d="M 60 140 C 30 70 80 20 150 20 C 220 20 270 70 240 140 C 240 180 260 220 260 250 C 190 220 110 220 40 250 C 40 220 60 180 60 140 Z" fill="url(#hair-gradient)" />

          <!-- Ears -->
          <ellipse cx="50" cy="145" rx="14" ry="20" fill="url(#head-gradient)" />
          <ellipse cx="250" cy="145" rx="14" ry="20" fill="url(#head-gradient)" />

          <!-- Character Main Head Shape -->
          <path id="head-shape" d="M 150 50 C 220 50 245 95 240 160 C 235 230 195 260 150 260 C 105 260 65 230 60 160 C 55 95 80 50 150 50 Z" fill="url(#head-gradient)" />

          <!-- Front Bangs -->
          <path d="M 55 125 C 55 60 90 30 150 30 C 210 30 245 60 245 125 C 210 80 185 75 150 85 C 115 75 90 80 55 125 Z" fill="url(#hair-gradient)" />
          <path d="M 150 30 C 130 50 135 95 150 95 C 165 95 170 50 150 30 Z" fill="url(#hair-gradient)" />

          <!-- Soft Blush Highlights -->
          <ellipse id="blush-left" class="blush-left" cx="80" cy="165" rx="16" ry="10" />
          <ellipse id="blush-right" class="blush-right" cx="220" cy="165" rx="16" ry="10" />

          <!-- LEFT EYE -->
          <g id="eye-left-group">
            <ellipse class="eye-sclera" cx="105" cy="125" rx="30" ry="34" />
            <!-- Pupil masked within eye socket -->
            <g clip-path="url(#eye-left-clip)">
              <g id="pupil-left-group" class="pupil-group">
                <circle class="pupil-iris" cx="105" cy="125" r="16" />
                <circle class="pupil-highlight-1" cx="100" cy="118" r="5" />
                <circle class="pupil-highlight-2" cx="111" cy="131" r="2.5" />
              </g>
              <!-- Eyelid Overlay for Blinking/Sleepy -->
              <path id="eyelid-left" class="eyelid-path" d="M 70 85 Q 105 85 140 85 L 140 85 Q 105 85 70 85 Z" />
            </g>
          </g>

          <!-- RIGHT EYE -->
          <g id="eye-right-group">
            <ellipse class="eye-sclera" cx="195" cy="125" rx="30" ry="34" />
            <!-- Pupil masked within eye socket -->
            <g clip-path="url(#eye-right-clip)">
              <g id="pupil-right-group" class="pupil-group">
                <circle class="pupil-iris" cx="195" cy="125" r="16" />
                <circle class="pupil-highlight-1" cx="190" cy="118" r="5" />
                <circle class="pupil-highlight-2" cx="201" cy="131" r="2.5" />
              </g>
              <!-- Eyelid Overlay for Blinking/Sleepy -->
              <path id="eyelid-right" class="eyelid-path" d="M 160 85 Q 195 85 230 85 L 230 85 Q 195 85 160 85 Z" />
            </g>
          </g>

          <!-- EYEBROWS -->
          <path id="eyebrow-left" class="eyebrow" d="M 80 78 Q 105 70 130 78" />
          <path id="eyebrow-right" class="eyebrow" d="M 170 78 Q 195 70 220 78" />

          <!-- MOUTH -->
          <path id="mouth" class="mouth-path" d="M 115 178 Q 150 190 185 178" />
        </g>
      </svg>
    `;
  }

  cacheDOM() {
    this.headGroup = this.container.querySelector('#head-group');
    this.pupilLeft = this.container.querySelector('#pupil-left-group');
    this.pupilRight = this.container.querySelector('#pupil-right-group');
    this.eyeLeftGroup = this.container.querySelector('#eye-left-group');
    this.eyeRightGroup = this.container.querySelector('#eye-right-group');
    this.eyelidLeft = this.container.querySelector('#eyelid-left');
    this.eyelidRight = this.container.querySelector('#eyelid-right');
    this.eyebrowLeft = this.container.querySelector('#eyebrow-left');
    this.eyebrowRight = this.container.querySelector('#eyebrow-right');
    this.mouth = this.container.querySelector('#mouth');
    this.blushLeft = this.container.querySelector('#blush-left');
    this.blushRight = this.container.querySelector('#blush-right');
  }

  /**
   * Calculates independent target pupil positions clamped to max radius
   * @param {number} cursorX 
   * @param {number} cursorY 
   */
  updatePupilTargets(cursorX, cursorY) {
    if (!this.container) return;

    // Convert cursor screen coordinates to SVG scale relative positions
    const rect = this.container.getBoundingClientRect();
    const svgScaleX = 300 / (rect.width || 300);
    const svgScaleY = 300 / (rect.height || 300);

    const localCursorX = (cursorX - rect.left) * svgScaleX;
    const localCursorY = (cursorY - rect.top) * svgScaleY;

    // 1. Left Eye Pupil Target
    const dxL = localCursorX - this.eyeLeftCenter.x;
    const dyL = localCursorY - this.eyeLeftCenter.y;
    const angleL = Math.atan2(dyL, dxL);
    const distL = Math.min(Math.hypot(dxL, dyL) * 0.12, this.maxPupilDistance);
    
    this.targetState.pupilLeft.x = Math.cos(angleL) * distL;
    this.targetState.pupilLeft.y = Math.sin(angleL) * distL;

    // 2. Right Eye Pupil Target
    const dxR = localCursorX - this.eyeRightCenter.x;
    const dyR = localCursorY - this.eyeRightCenter.y;
    const angleR = Math.atan2(dyR, dxR);
    const distR = Math.min(Math.hypot(dxR, dyR) * 0.12, this.maxPupilDistance);

    this.targetState.pupilRight.x = Math.cos(angleR) * distR;
    this.targetState.pupilRight.y = Math.sin(angleR) * distR;
  }

  /**
   * Maps Emotion state to target visual attributes for facial components
   * @param {string} emotion 
   * @param {number} blinkProgress - 0.0 (open) to 1.0 (closed)
   * @param {CursorTracker} tracker 
   */
  applyEmotionTargets(emotion, blinkProgress, tracker) {
    // Combine blink progress with emotion eyelid base
    let baseEyelid = 0.0;
    
    // Default resets
    this.targetState.eyeScale = 1.0;
    this.targetState.pupilLeft.scale = 1.0;
    this.targetState.pupilRight.scale = 1.0;
    this.targetState.eyebrowLeft = { y: 0, rot: 0 };
    this.targetState.eyebrowRight = { y: 0, rot: 0 };
    this.targetState.head = { rot: 0, tx: 0, ty: 0, scale: 1.0 };
    this.targetState.blush = { opacity: 0.35, scale: 1.0 };

    // Gentle lean towards cursor
    if (tracker) {
      const leanX = (tracker.x - tracker.centerX) * 0.02;
      const leanY = (tracker.y - tracker.centerY) * 0.02;
      this.targetState.head.tx = Math.max(-12, Math.min(12, leanX));
      this.targetState.head.ty = Math.max(-12, Math.min(12, leanY));
    }

    switch (emotion) {
      case EMOTIONS.CURIOUS:
        this.targetState.eyebrowLeft = { y: -8, rot: -5 };
        this.targetState.eyebrowRight = { y: -8, rot: 5 };
        this.targetState.eyeScale = 1.06;
        this.targetState.mouthControl = { p1y: 195, p2y: 195, type: 'smile' };
        this.targetState.head.rot = (tracker && tracker.x > tracker.centerX) ? 4 : -4;
        break;

      case EMOTIONS.HAPPY:
        baseEyelid = 0.15;
        this.targetState.eyebrowLeft = { y: -4, rot: 0 };
        this.targetState.eyebrowRight = { y: -4, rot: 0 };
        this.targetState.blush = { opacity: 0.8, scale: 1.3 };
        this.targetState.mouthControl = { p1y: 205, p2y: 205, type: 'big_smile' };
        break;

      case EMOTIONS.EXCITED:
        this.targetState.eyeScale = 1.18;
        this.targetState.pupilLeft.scale = 1.15;
        this.targetState.pupilRight.scale = 1.15;
        this.targetState.eyebrowLeft = { y: -14, rot: -8 };
        this.targetState.eyebrowRight = { y: -14, rot: 8 };
        this.targetState.blush = { opacity: 0.9, scale: 1.4 };
        this.targetState.mouthControl = { p1y: 215, p2y: 215, type: 'open_happy' };
        this.targetState.head.scale = 1.05;
        break;

      case EMOTIONS.SURPRISED:
        this.targetState.eyeScale = 1.25;
        this.targetState.pupilLeft.scale = 0.7; // pupils shrink on surprise!
        this.targetState.pupilRight.scale = 0.7;
        this.targetState.eyebrowLeft = { y: -18, rot: 0 };
        this.targetState.eyebrowRight = { y: -18, rot: 0 };
        this.targetState.mouthControl = { type: 'o_mouth' };
        this.targetState.head.ty -= 10;
        break;

      case EMOTIONS.CONFUSED:
        this.targetState.eyebrowLeft = { y: -16, rot: -18 }; // one eyebrow high
        this.targetState.eyebrowRight = { y: 2, rot: 15 };   // one eyebrow low
        this.targetState.head.rot = 12; // head tilt
        this.targetState.mouthControl = { p1y: 175, p2y: 195, type: 'smirk' };
        break;

      case EMOTIONS.NERVOUS:
        this.targetState.pupilLeft.scale = 0.82;
        this.targetState.pupilRight.scale = 0.82;
        this.targetState.eyebrowLeft = { y: -6, rot: 15 };  // angled inwards / \
        this.targetState.eyebrowRight = { y: -6, rot: -15 };
        this.targetState.mouthControl = { type: 'wavy' };
        this.targetState.blush = { opacity: 0.6, scale: 1.1 };
        // Subtle trembling offsets
        this.targetState.head.tx += (Math.random() - 0.5) * 3;
        this.targetState.head.ty += (Math.random() - 0.5) * 3;
        break;

      case EMOTIONS.SLEEPY:
        baseEyelid = 0.70; // 70% closed eyelids
        this.targetState.eyebrowLeft = { y: 4, rot: 5 };
        this.targetState.eyebrowRight = { y: 4, rot: -5 };
        this.targetState.mouthControl = { p1y: 182, p2y: 182, type: 'line' };
        this.targetState.head.ty += 8;
        this.targetState.head.rot = 5;
        break;

      case EMOTIONS.SAD:
        this.targetState.eyebrowLeft = { y: -10, rot: 20 }; // angled upwards \ /
        this.targetState.eyebrowRight = { y: -10, rot: -20 };
        this.targetState.mouthControl = { p1y: 165, p2y: 165, type: 'frown' };
        this.targetState.eyeScale = 0.95;
        break;

      case EMOTIONS.DIZZY:
        const t = performance.now() * 0.006;
        this.targetState.head.rot = Math.sin(t) * 15;
        this.targetState.pupilLeft.x += Math.cos(t * 2) * 6;
        this.targetState.pupilLeft.y += Math.sin(t * 2) * 6;
        this.targetState.pupilRight.x += Math.cos(t * 2 + 1) * 6;
        this.targetState.pupilRight.y += Math.sin(t * 2 + 1) * 6;
        this.targetState.eyebrowLeft = { y: -8, rot: Math.sin(t) * 10 };
        this.targetState.eyebrowRight = { y: -8, rot: -Math.sin(t) * 10 };
        this.targetState.mouthControl = { type: 'wavy' };
        break;

      case EMOTIONS.NEUTRAL:
      default:
        this.targetState.mouthControl = { p1y: 190, p2y: 190, type: 'smile' };
        break;
    }

    // Combine blink controller output with emotion base eyelid
    const finalEyelid = Math.min(1.0, baseEyelid + blinkProgress);
    this.targetState.eyelidLeft = finalEyelid;
    this.targetState.eyelidRight = finalEyelid;
  }

  /**
   * Linear Interpolation (Lerp) helper
   */
  lerp(start, end, factor) {
    return start + (end - start) * factor;
  }

  /**
   * Applies smooth frame interpolation and renders to SVG DOM
   * @param {number} lerpFactor - Smoothing factor (e.g. 0.15)
   */
  updateAnimation(lerpFactor) {
    const s = this.state;
    const t = this.targetState;

    // 1. Lerp Pupils
    s.pupilLeft.x = this.lerp(s.pupilLeft.x, t.pupilLeft.x, lerpFactor);
    s.pupilLeft.y = this.lerp(s.pupilLeft.y, t.pupilLeft.y, lerpFactor);
    s.pupilLeft.scale = this.lerp(s.pupilLeft.scale, t.pupilLeft.scale, lerpFactor);

    s.pupilRight.x = this.lerp(s.pupilRight.x, t.pupilRight.x, lerpFactor);
    s.pupilRight.y = this.lerp(s.pupilRight.y, t.pupilRight.y, lerpFactor);
    s.pupilRight.scale = this.lerp(s.pupilRight.scale, t.pupilRight.scale, lerpFactor);

    // Render Pupil Transforms
    if (this.pupilLeft) {
      this.pupilLeft.setAttribute('transform', `translate(${s.pupilLeft.x}, ${s.pupilLeft.y}) scale(${s.pupilLeft.scale})`);
      this.pupilLeft.style.transformOrigin = '105px 125px';
    }
    if (this.pupilRight) {
      this.pupilRight.setAttribute('transform', `translate(${s.pupilRight.x}, ${s.pupilRight.y}) scale(${s.pupilRight.scale})`);
      this.pupilRight.style.transformOrigin = '195px 125px';
    }

    // 2. Lerp Eye Scale
    s.eyeScale = this.lerp(s.eyeScale, t.eyeScale, lerpFactor);
    if (this.eyeLeftGroup && this.eyeRightGroup) {
      this.eyeLeftGroup.setAttribute('transform', `scale(${s.eyeScale})`);
      this.eyeLeftGroup.style.transformOrigin = '105px 125px';
      this.eyeRightGroup.setAttribute('transform', `scale(${s.eyeScale})`);
      this.eyeRightGroup.style.transformOrigin = '195px 125px';
    }

    // 3. Lerp Eyelids
    s.eyelidLeft = this.lerp(s.eyelidLeft, t.eyelidLeft, lerpFactor * 1.5); // faster blink response
    s.eyelidRight = this.lerp(s.eyelidRight, t.eyelidRight, lerpFactor * 1.5);

    this.renderEyelids(s.eyelidLeft, s.eyelidRight);

    // 4. Lerp Eyebrows
    s.eyebrowLeft.y = this.lerp(s.eyebrowLeft.y, t.eyebrowLeft.y, lerpFactor);
    s.eyebrowLeft.rot = this.lerp(s.eyebrowLeft.rot, t.eyebrowLeft.rot, lerpFactor);
    s.eyebrowRight.y = this.lerp(s.eyebrowRight.y, t.eyebrowRight.y, lerpFactor);
    s.eyebrowRight.rot = this.lerp(s.eyebrowRight.rot, t.eyebrowRight.rot, lerpFactor);

    if (this.eyebrowLeft) {
      this.eyebrowLeft.setAttribute('transform', `translate(0, ${s.eyebrowLeft.y}) rotate(${s.eyebrowLeft.rot})`);
      this.eyebrowLeft.style.transformOrigin = '105px 78px';
    }
    if (this.eyebrowRight) {
      this.eyebrowRight.setAttribute('transform', `translate(0, ${s.eyebrowRight.y}) rotate(${s.eyebrowRight.rot})`);
      this.eyebrowRight.style.transformOrigin = '195px 78px';
    }

    // 5. Lerp Head Transform (tilt, lean, scale)
    s.head.rot = this.lerp(s.head.rot, t.head.rot, lerpFactor);
    s.head.tx = this.lerp(s.head.tx, t.head.tx, lerpFactor);
    s.head.ty = this.lerp(s.head.ty, t.head.ty, lerpFactor);
    s.head.scale = this.lerp(s.head.scale, t.head.scale, lerpFactor);

    if (this.headGroup) {
      this.headGroup.setAttribute('transform', `translate(${s.head.tx}, ${s.head.ty}) rotate(${s.head.rot}) scale(${s.head.scale})`);
    }

    // 6. Lerp Blush
    s.blush.opacity = this.lerp(s.blush.opacity, t.blush.opacity, lerpFactor);
    s.blush.scale = this.lerp(s.blush.scale, t.blush.scale, lerpFactor);
    if (this.blushLeft && this.blushRight) {
      this.blushLeft.style.opacity = s.blush.opacity;
      this.blushLeft.setAttribute('transform', `scale(${s.blush.scale})`);
      this.blushLeft.style.transformOrigin = '75px 175px';
      this.blushRight.style.opacity = s.blush.opacity;
      this.blushRight.setAttribute('transform', `scale(${s.blush.scale})`);
      this.blushRight.style.transformOrigin = '225px 175px';
    }

    // 7. Lerp Mouth Morphing
    this.renderMouth(t.mouthControl, lerpFactor);
  }

  renderEyelids(leftProgress, rightProgress) {
    // 0 = open (top y=85), 1 = fully closed (covers eye down to y=155)
    const topY = 85;
    const maxClosedY = 158;

    const leftClosedY = topY + (maxClosedY - topY) * leftProgress;
    const rightClosedY = topY + (maxClosedY - topY) * rightProgress;

    // SVG quadratic curve d path for smooth eyelid sheet
    const pathL = `M 68 ${topY} Q 105 ${topY} 142 ${topY} L 142 ${topY} Q 105 ${leftClosedY * 1.05} 68 ${leftClosedY} Z`;
    const pathR = `M 158 ${topY} Q 195 ${topY} 232 ${topY} L 232 ${topY} Q 195 ${rightClosedY * 1.05} 158 ${rightClosedY} Z`;

    if (this.eyelidLeft) this.eyelidLeft.setAttribute('d', pathL);
    if (this.eyelidRight) this.eyelidRight.setAttribute('d', pathR);
  }

  renderMouth(ctrl, lerpFactor) {
    if (!this.mouth) return;

    let targetPath = "M 115 178 Q 150 190 185 178";
    let isFilled = false;

    if (ctrl.type === 'o_mouth') {
      targetPath = "M 138 178 A 12 16 0 1 0 162 178 A 12 16 0 1 0 138 178 Z";
      isFilled = true;
    } else if (ctrl.type === 'open_happy') {
      targetPath = "M 110 172 Q 150 220 190 172 Z";
      isFilled = true;
    } else if (ctrl.type === 'big_smile') {
      targetPath = "M 110 175 Q 150 206 190 175";
    } else if (ctrl.type === 'smirk') {
      targetPath = "M 118 180 Q 150 170 182 188";
    } else if (ctrl.type === 'wavy') {
      targetPath = "M 120 178 Q 135 170 150 178 Q 165 186 180 178";
    } else if (ctrl.type === 'frown') {
      targetPath = "M 115 188 Q 150 166 185 188";
    } else if (ctrl.type === 'line') {
      targetPath = "M 125 180 Q 150 180 175 180";
    } else {
      // Default smile with target control point
      const p1y = ctrl.p1y || 190;
      targetPath = `M 115 178 Q 150 ${p1y} 185 178`;
    }

    this.mouth.setAttribute('d', targetPath);
    if (isFilled) {
      this.mouth.classList.add('filled');
    } else {
      this.mouth.classList.remove('filled');
    }
  }
}
