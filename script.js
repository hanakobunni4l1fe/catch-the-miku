const HIGH_SCORE_KEY = "catch-the-miku-high-score";

const sprites = {
  run: "./public/miku-run.png",
  happy: "./public/miku-happy.png",
  bonus: "./public/miku-leek.png",
};

const modeConfig = {
  turbo: {
    label: "Twin-Tail Tempo",
    duration: 30,
    escapeBaseMs: 1380,
    escapeMinMs: 560,
    bonusEvery: 5,
    bonusPoints: 3,
    intro:
      "Balanced mode with classic Hatsune Miku pacing, bright tempo, and quick twin-tail dashes.",
  },
  leek: {
    label: "Leek Fever",
    duration: 32,
    escapeBaseMs: 1300,
    escapeMinMs: 540,
    bonusEvery: 3,
    bonusPoints: 4,
    intro:
      "Bonus-heavy mode. Leek Miku appears more often and every leek catch hits harder.",
  },
  idol: {
    label: "39 Rush",
    duration: 26,
    escapeBaseMs: 1060,
    escapeMinMs: 420,
    bonusEvery: 5,
    bonusPoints: 3,
    intro:
      "Hard mode. Shorter timer, quicker exits, and full concert-energy Miku chaos.",
  },
};

const infoPanels = {
  how: {
    title: "Catch the Diva",
    text:
      "Catch chibi Hatsune Miku before she slips away. Every clean catch builds your rhythm, but misses break your streak.",
  },
  bonus: {
    title: "Leek Bonus",
    text:
      "Leek Miku is the bonus target. In bonus moments, every leek catch is worth extra points based on your selected mode.",
  },
  stage: {
    title: "Miku Stage",
    text:
      "The stage is interactive too now. Switch Miku modes, pause the show, or calm the concert glow if you want a cleaner view.",
  },
};

const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("high-score");
const timeEl = document.getElementById("time");
const streakEl = document.getElementById("streak");
const statusTextEl = document.getElementById("status-text");
const overlayEl = document.getElementById("overlay");
const overlayTitleEl = document.getElementById("overlay-title");
const overlayTextEl = document.getElementById("overlay-text");
const startButtonEl = document.getElementById("start-button");
const restartButtonEl = document.getElementById("restart-button");
const pauseButtonEl = document.getElementById("pause-button");
const helpButtonEl = document.getElementById("help-button");
const fxButtonEl = document.getElementById("fx-button");
const arenaEl = document.getElementById("arena");
const mikuEl = document.getElementById("miku");
const mikuImageEl = document.getElementById("miku-image");
const modeButtons = Array.from(document.querySelectorAll(".mode-button"));
const infoButtons = Array.from(document.querySelectorAll(".info-button"));

const state = {
  score: 0,
  streak: 0,
  timeLeft: modeConfig.turbo.duration,
  highScore: Number(localStorage.getItem(HIGH_SCORE_KEY) || 0),
  active: false,
  paused: false,
  moveTimeout: null,
  timerInterval: null,
  catchLock: false,
  bonusRound: false,
  mode: "turbo",
  effectsOn: true,
};

function getCurrentMode() {
  return modeConfig[state.mode];
}

function updateHud() {
  scoreEl.textContent = String(state.score);
  streakEl.textContent = String(state.streak);
  timeEl.textContent = String(state.timeLeft);
  highScoreEl.textContent = String(state.highScore);
}

function setStatus(message) {
  statusTextEl.textContent = message;
}

function setOverlayAction(action) {
  startButtonEl.dataset.action = action;
}

function showOverlay(title, text, buttonLabel, action = "start") {
  overlayTitleEl.textContent = title;
  overlayTextEl.textContent = text;
  startButtonEl.textContent = buttonLabel;
  setOverlayAction(action);
  overlayEl.classList.remove("hidden");
}

function hideOverlay() {
  overlayEl.classList.add("hidden");
}

function clearTimers() {
  if (state.moveTimeout) {
    clearTimeout(state.moveTimeout);
    state.moveTimeout = null;
  }

  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function randomPosition() {
  const arenaRect = arenaEl.getBoundingClientRect();
  const size = mikuEl.getBoundingClientRect().width || 130;
  const margin = 14;
  const maxX = Math.max(margin, arenaRect.width - size - margin);
  const maxY = Math.max(margin, arenaRect.height - size - margin - 28);

  return {
    x: Math.floor(Math.random() * maxX) + margin,
    y: Math.floor(Math.random() * maxY) + margin,
  };
}

function escapeDelay() {
  const mode = getCurrentMode();
  const speedUp = state.score * 22;
  return Math.max(mode.escapeMinMs, mode.escapeBaseMs - speedUp);
}

function syncModeButtons() {
  modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === state.mode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function syncControls() {
  pauseButtonEl.textContent = state.paused ? "Resume Show" : "Pause Show";
  pauseButtonEl.disabled = !state.active && !state.paused;
  fxButtonEl.textContent = state.effectsOn
    ? "Concert Glow: On"
    : "Concert Glow: Off";
  fxButtonEl.setAttribute("aria-pressed", String(state.effectsOn));
}

function setEffects(enabled) {
  state.effectsOn = enabled;
  document.body.classList.toggle("effects-muted", !enabled);
  syncControls();
  setStatus(
    enabled
      ? "Concert glow is back on."
      : "Concert glow reduced for a cleaner view."
  );
}

function startRoundTimer() {
  state.timerInterval = window.setInterval(() => {
    state.timeLeft -= 1;
    updateHud();

    if (state.timeLeft <= 0) {
      finishGame();
    } else if (state.timeLeft <= 5) {
      setStatus("Final seconds. Keep clicking!");
    }
  }, 1000);
}

function moveMiku() {
  if (!state.active || state.paused) {
    return;
  }

  const mode = getCurrentMode();
  const position = randomPosition();
  state.bonusRound = (state.score + 1) % mode.bonusEvery === 0;
  mikuImageEl.src = state.bonusRound ? sprites.bonus : sprites.run;
  mikuEl.classList.toggle("bonus", state.bonusRound);
  mikuEl.classList.remove("caught", "hidden");
  mikuEl.style.left = `${position.x}px`;
  mikuEl.style.top = `${position.y}px`;

  state.moveTimeout = window.setTimeout(() => {
    if (!state.active || state.paused || state.catchLock) {
      return;
    }

    state.streak = 0;
    updateHud();
    setStatus("Miku zipped offstage. Catch the next entrance faster!");
    moveMiku();
  }, escapeDelay());
}

function finishGame() {
  state.active = false;
  state.paused = false;
  state.catchLock = false;
  clearTimers();
  mikuEl.classList.add("hidden");

  if (state.score > state.highScore) {
    state.highScore = state.score;
    localStorage.setItem(HIGH_SCORE_KEY, String(state.highScore));
  }

  updateHud();
  syncControls();
  showOverlay(
    "Encore complete!",
    `Your score: ${state.score}. ${state.score === state.highScore ? "That is your new high score!" : `High score to beat: ${state.highScore}.`}`,
    "Play Again",
    "start"
  );
  setStatus("Encore finished. Press play again for another Miku chase.");
}

function startGame() {
  const mode = getCurrentMode();

  clearTimers();
  state.score = 0;
  state.streak = 0;
  state.timeLeft = mode.duration;
  state.active = true;
  state.paused = false;
  state.catchLock = false;
  state.bonusRound = false;

  updateHud();
  hideOverlay();
  syncControls();
  setStatus(`${mode.label} started. Catch Hatsune Miku!`);
  moveMiku();
  startRoundTimer();
}

function pauseGame(showPanel = true) {
  if (!state.active || state.paused) {
    return;
  }

  state.paused = true;
  clearTimers();
  mikuEl.classList.add("hidden");
  syncControls();
  setStatus("Concert paused. Catch your breath.");

  if (showPanel) {
    showOverlay(
      "Concert paused",
      "Take a quick break, then jump back into the Miku chase when you are ready.",
      "Resume Show",
      "resume"
    );
  }
}

function resumeGame() {
  if (!state.active || !state.paused) {
    return;
  }

  state.paused = false;
  hideOverlay();
  syncControls();
  setStatus("Back on stage. Catch Miku!");
  moveMiku();
  startRoundTimer();
}

function showInfoPanel(title, text) {
  const action = state.active ? "resume" : "start";
  const buttonLabel = state.active ? "Resume Game" : "Start Game";

  if (state.active && !state.paused) {
    pauseGame(false);
  }

  showOverlay(title, text, buttonLabel, action);
}

function setMode(mode) {
  if (!modeConfig[mode] || state.mode === mode) {
    return;
  }

  state.mode = mode;
  syncModeButtons();

  if (!state.active) {
    state.timeLeft = getCurrentMode().duration;
    updateHud();
  }

  setStatus(`${getCurrentMode().label} selected. ${getCurrentMode().intro}`);
}

function catchMiku() {
  if (!state.active || state.paused || state.catchLock) {
    return;
  }

  const mode = getCurrentMode();

  state.catchLock = true;
  clearTimeout(state.moveTimeout);
  state.moveTimeout = null;

  const points = state.bonusRound ? mode.bonusPoints : 1;
  state.score += points;
  state.streak += 1;
  mikuImageEl.src = sprites.happy;
  mikuEl.classList.add("caught");

  if (state.score > state.highScore) {
    state.highScore = state.score;
    localStorage.setItem(HIGH_SCORE_KEY, String(state.highScore));
  }

  updateHud();
  setStatus(
    state.bonusRound
      ? `${mode.label} leek bonus! +${points} points.`
      : `Nice catch! Streak: ${state.streak}.`
  );

  window.setTimeout(() => {
    if (!state.active || state.paused) {
      return;
    }

    state.catchLock = false;
    moveMiku();
  }, 220);
}

function handleOverlayAction() {
  const action = startButtonEl.dataset.action || "start";

  if (action === "resume") {
    resumeGame();
    return;
  }

  startGame();
}

startButtonEl.addEventListener("click", handleOverlayAction);
restartButtonEl.addEventListener("click", startGame);
pauseButtonEl.addEventListener("click", () => {
  if (state.paused) {
    resumeGame();
  } else {
    pauseGame(true);
  }
});
helpButtonEl.addEventListener("click", () => {
  showInfoPanel(
    "Miku Guide",
    `${getCurrentMode().label}: ${getCurrentMode().intro} Tap the mode stickers to switch styles before a run, use Pause Show to freeze the concert, and click Concert Glow if you want a cleaner screen.`
  );
});
fxButtonEl.addEventListener("click", () => {
  setEffects(!state.effectsOn);
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setMode(button.dataset.mode);
  });
});

infoButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const panel = infoPanels[button.dataset.info];

    if (!panel) {
      return;
    }

    showInfoPanel(panel.title, panel.text);
  });
});

mikuEl.addEventListener("click", catchMiku);

arenaEl.addEventListener("click", (event) => {
  if (!state.active || state.paused) {
    return;
  }

  if (event.target === mikuEl || event.target === mikuImageEl) {
    return;
  }

  state.streak = 0;
  updateHud();
  setStatus("Missed click. Stay focused on Miku!");
});

updateHud();
syncModeButtons();
syncControls();
showOverlay(
  "Ready to catch Miku?",
  "Tap or click chibi Hatsune Miku every time she appears. Pick a Miku mode, open the guide, or lower the concert glow if you want a clearer screen.",
  "Start Game",
  "start"
);
