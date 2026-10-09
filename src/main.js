/**
 * Application Main Entry Point
 * Initializes character components, systems controllers, interactive toolbar handlers,
 * debug toggle keybindings, and starts the main animation loop.
 */

import { Character } from './components/Character/character.js';
import { CursorTracker } from './systems/cursorTracker.js';
import { EmotionEngine, EMOTIONS } from './systems/emotionEngine.js';
import { BlinkController } from './systems/blinkController.js';
import { AnimationController } from './systems/animationController.js';

// Development Debug Flag
const DEBUG = true;

const EMOTION_BADGE_MAP = {
  [EMOTIONS.NEUTRAL]: { label: 'Neutral' },
  [EMOTIONS.CURIOUS]: { label: 'Curious' },
  [EMOTIONS.HAPPY]: { label: 'Happy' },
  [EMOTIONS.EXCITED]: { label: 'Excited' },
  [EMOTIONS.SURPRISED]: { label: 'Surprised' },
  [EMOTIONS.CONFUSED]: { label: 'Confused' },
  [EMOTIONS.NERVOUS]: { label: 'Nervous' },
  [EMOTIONS.SLEEPY]: { label: 'Sleepy' },
  [EMOTIONS.SAD]: { label: 'Sad' },
  [EMOTIONS.DIZZY]: { label: 'Dizzy' }
};

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('character-container');
  if (!container) return;

  // 1. Initialize Components & Systems
  const character = new Character(container);
  const tracker = new CursorTracker(container);
  const emotionEngine = new EmotionEngine();
  const blinkController = new BlinkController();
  const animationController = new AnimationController(character, tracker, emotionEngine, blinkController);

  // Set default debug mode state
  if (DEBUG) {
    animationController.setDebugMode(false); // Can be opened via button or 'D' key
  }

  // 2. Start Animation Loop
  animationController.start();

  // 3. Setup Floating Emotion Badge Sync
  const badgeLabel = document.getElementById('badge-label');
  const emotionBadge = document.getElementById('emotion-badge');

  let currentBadgeEmotion = null;
  const updateBadge = () => {
    const activeEmo = emotionEngine.currentEmotion;
    if (activeEmo !== currentBadgeEmotion) {
      currentBadgeEmotion = activeEmo;
      const info = EMOTION_BADGE_MAP[activeEmo] || { label: activeEmo };
      
      if (badgeLabel) badgeLabel.textContent = info.label;

      if (emotionBadge) {
        emotionBadge.style.transform = 'scale(1.15)';
        setTimeout(() => {
          emotionBadge.style.transform = 'scale(1.0)';
        }, 150);
      }
    }
    requestAnimationFrame(updateBadge);
  };
  requestAnimationFrame(updateBadge);

  // 4. Interactive Toolbar Button Handlers
  const emotionButtonsContainer = document.getElementById('emotion-buttons');
  if (emotionButtonsContainer) {
    const buttons = emotionButtonsContainer.querySelectorAll('.emo-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const selectedEmotion = btn.getAttribute('data-emotion');
        emotionEngine.setForcedEmotion(selectedEmotion);
      });
    });

    // Set 'Auto' button active initially
    const autoBtn = emotionButtonsContainer.querySelector('[data-emotion="auto"]');
    if (autoBtn) autoBtn.classList.add('active');
  }

  // 5. Debug Panel Toggle Button & Hotkey ('D')
  const toggleDebugBtn = document.getElementById('toggle-debug-btn');
  const closeDebugBtn = document.getElementById('close-debug-btn');

  if (toggleDebugBtn) {
    toggleDebugBtn.addEventListener('click', () => {
      animationController.toggleDebugMode();
    });
  }

  if (closeDebugBtn) {
    closeDebugBtn.addEventListener('click', () => {
      animationController.setDebugMode(false);
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'd' || e.key === 'D') {
      animationController.toggleDebugMode();
    }
  });

  // 6. Interactive Character Click Reaction (Startle / Poke!)
  container.addEventListener('click', () => {
    blinkController.triggerBlink();
    // Temporarily trigger surprise or excitement on click
    emotionEngine.scores[EMOTIONS.SURPRISED] = 1.0;
  });
});
