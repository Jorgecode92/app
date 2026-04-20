import { APP_CONFIG } from "./config.js";
import { createPlatform } from "./platform/index.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const BOARD_RATIO = WIDTH / HEIGHT;
const TOUCH_LAYOUT_CLASS = "touch-layout";
const touchQuery = window.matchMedia("(hover: none) and (pointer: coarse)");

const THEME = {
  text: "#f8fbff",
  muted: "#9aa8a3",
  accent: "#5df2a5",
  accentCool: "#58c7ff",
  accentStrong: "#ff7145",
  accentSoft: "#ffd45a",
  danger: "#ff4f6d",
  bgTop: "#10120b",
  bgMid: "#141918",
  bgBottom: "#050706",
};

const ITEM_CATALOG = [
  {
    id: "skin-classic",
    type: "ship",
    name: "Classic Hull",
    cost: 0,
    description: "The original defense craft.",
    color: "#5df2a5",
    trim: "#f8fbff",
  },
  {
    id: "laser-amber",
    type: "laser",
    name: "Amber Lasers",
    cost: 0,
    description: "Warm standard plasma bolts.",
    color: "#ffd45a",
  },
  {
    id: "shield-cyan",
    type: "shield",
    name: "Cyan Shields",
    cost: 0,
    description: "Classic shield plating.",
    color: "#5df2a5",
  },
  {
    id: "skin-ember",
    type: "ship",
    name: "Ember Hull",
    cost: 120,
    description: "A coral-orange hull with brighter hit flashes.",
    color: "#ff7145",
    trim: "#ffd45a",
  },
  {
    id: "laser-mint",
    type: "laser",
    name: "Mint Lasers",
    cost: 95,
    description: "A fresh laser color for cleaner target reads.",
    color: "#7cffd4",
  },
  {
    id: "shield-gold",
    type: "shield",
    name: "Gold Shields",
    cost: 135,
    description: "A cosmetic shield glow for defended lanes.",
    color: "#ffd45a",
  },
  {
    id: "upgrade-trigger",
    type: "upgrade",
    name: "Overclock Trigger",
    cost: 220,
    description: "A small fire-rate bump that keeps the arcade balance intact.",
    cooldownMultiplier: 0.9,
  },
  {
    id: "upgrade-guard",
    type: "upgrade",
    name: "Starter Guard",
    cost: 180,
    description: "Begin each run with one shield charge before lives are touched.",
    shieldCharges: 1,
  },
];

const DEFAULT_PROFILE = {
  coins: 0,
  bestScore: 0,
  owned: ["skin-classic", "laser-amber", "shield-cyan"],
  equipped: {
    ship: "skin-classic",
    laser: "laser-amber",
    shield: "shield-cyan",
  },
  dailyClaimedOn: "",
  shortcutRewardClaimed: false,
  settings: {
    sound: true,
    mockRewardedAds: true,
  },
};

const nodes = {
  appShell: document.querySelector(".game-shell"),
  gameStage: document.querySelector(".game-stage"),
  score: document.getElementById("score"),
  lives: document.getElementById("lives"),
  wave: document.getElementById("wave"),
  coins: document.getElementById("coins"),
  best: document.getElementById("best"),
  shield: document.getElementById("shield"),
  platformStatus: document.getElementById("platform-status"),
  runStatus: document.getElementById("run-status"),
  loadingOverlay: document.getElementById("loading-overlay"),
  startOverlay: document.getElementById("start-overlay"),
  pauseOverlay: document.getElementById("pause-overlay"),
  reviveOverlay: document.getElementById("revive-overlay"),
  gameOverOverlay: document.getElementById("game-over-overlay"),
  shopOverlay: document.getElementById("shop-overlay"),
  settingsOverlay: document.getElementById("settings-overlay"),
  toast: document.getElementById("toast"),
  startBest: document.getElementById("start-best"),
  startCoins: document.getElementById("start-coins"),
  dailyButton: document.getElementById("daily-button"),
  shortcutButton: document.getElementById("shortcut-button"),
  reviveCopy: document.getElementById("revive-copy"),
  finalScore: document.getElementById("final-score"),
  finalWave: document.getElementById("final-wave"),
  finalCoins: document.getElementById("final-coins"),
  finalReason: document.getElementById("final-reason"),
  doubleCoinsButton: document.getElementById("double-coins-button"),
  shopGrid: document.getElementById("shop-grid"),
  shopCoins: document.getElementById("shop-coins"),
  soundToggle: document.getElementById("sound-toggle"),
  mockAdsToggle: document.getElementById("mock-ads-toggle"),
};

const input = {
  left: false,
  right: false,
  fire: false,
};

const stars = Array.from({ length: 90 }, () => ({
  x: Math.random() * WIDTH,
  y: Math.random() * HEIGHT,
  size: Math.random() * 2 + 0.5,
  speed: Math.random() * 18 + 10,
  alpha: Math.random() * 0.6 + 0.2,
}));

const player = {
  width: 68,
  height: 24,
  speed: 460,
  cooldown: 0,
  hitTimer: 0,
  x: WIDTH / 2 - 34,
  y: HEIGHT - 70,
};

const canvasPointer = {
  active: false,
  id: null,
};

const state = {
  score: 0,
  lives: 3,
  wave: 1,
  shieldCharges: 0,
  status: "loading",
  previousStatus: "ready",
  overlayTimer: 0,
  intermissionBonusOffered: false,
  runSeconds: 0,
  runCoins: 0,
  runKills: 0,
  runWavesCleared: 0,
  reviveUsed: false,
  pendingSummary: null,
  screenShake: 0,
  saveTimer: 0,
};

let platform = createPlatform(APP_CONFIG);
let profile = cloneProfile(DEFAULT_PROFILE);
let invaders = [];
let bullets = [];
let particles = [];
let floaters = [];
let shields = [];
let fitCanvasFrame = 0;
let previousTime = performance.now();
let audioContext = null;
let toastTimer = 0;
let formation = {
  direction: 1,
  speed: 52,
  descent: 28,
  shootTimer: 0.8,
};

function cloneProfile(profileValue) {
  return JSON.parse(JSON.stringify(profileValue));
}

function normalizeProfile(value) {
  const stored = value && typeof value === "object" ? value : {};
  const owned = new Set([
    ...DEFAULT_PROFILE.owned,
    ...(Array.isArray(stored.owned) ? stored.owned : []),
  ]);

  return {
    ...cloneProfile(DEFAULT_PROFILE),
    ...stored,
    coins: Number.isFinite(stored.coins) ? Math.max(0, Math.floor(stored.coins)) : 0,
    bestScore: Number.isFinite(stored.bestScore) ? Math.max(0, Math.floor(stored.bestScore)) : 0,
    owned: [...owned].filter((itemId) => ITEM_CATALOG.some((item) => item.id === itemId)),
    equipped: {
      ...DEFAULT_PROFILE.equipped,
      ...(stored.equipped || {}),
    },
    settings: {
      ...DEFAULT_PROFILE.settings,
      ...(stored.settings || {}),
    },
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function usesTouchLayout() {
  return touchQuery.matches || window.innerWidth <= 760;
}

function todayKey() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function getItem(itemId) {
  return ITEM_CATALOG.find((item) => item.id === itemId) || ITEM_CATALOG[0];
}

function getEquipped(type) {
  return getItem(profile.equipped[type] || DEFAULT_PROFILE.equipped[type]);
}

function hasItem(itemId) {
  return profile.owned.includes(itemId);
}

function hasUpgrade(itemId) {
  return hasItem(itemId);
}

function fireCooldown() {
  const baseCooldown = 0.25;
  return hasUpgrade("upgrade-trigger") ? baseCooldown * 0.9 : baseCooldown;
}

function startingShieldCharges() {
  return hasUpgrade("upgrade-guard") ? 1 : 0;
}

function setOverlay(overlayNode, visible) {
  if (!overlayNode) {
    return;
  }

  overlayNode.hidden = !visible;
}

function hideAllMajorOverlays() {
  [
    nodes.loadingOverlay,
    nodes.startOverlay,
    nodes.pauseOverlay,
    nodes.reviveOverlay,
    nodes.gameOverOverlay,
    nodes.shopOverlay,
    nodes.settingsOverlay,
  ].forEach((node) => setOverlay(node, false));
}

function showToast(message, tone = "info") {
  if (!nodes.toast) {
    return;
  }

  window.clearTimeout(toastTimer);
  nodes.toast.textContent = message;
  nodes.toast.dataset.tone = tone;
  nodes.toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    nodes.toast.hidden = true;
  }, 3200);
}

function updatePlatformStatus(message, tone = "ready") {
  if (!nodes.platformStatus) {
    return;
  }

  nodes.platformStatus.textContent = message;
  nodes.platformStatus.dataset.tone = tone;
}

function updateRunStatus(message) {
  if (nodes.runStatus) {
    nodes.runStatus.textContent = message;
  }
}

function scheduleCanvasFit() {
  if (fitCanvasFrame) {
    cancelAnimationFrame(fitCanvasFrame);
  }

  fitCanvasFrame = requestAnimationFrame(() => {
    fitCanvasFrame = 0;
    fitCanvasToViewport();
  });
}

function fitCanvasToViewport() {
  if (!canvas || !nodes.gameStage) {
    return;
  }

  document.body.classList.toggle(TOUCH_LAYOUT_CLASS, usesTouchLayout());

  if (!usesTouchLayout()) {
    canvas.style.removeProperty("width");
    canvas.style.removeProperty("height");
    return;
  }

  const { width: availableWidth, height: availableHeight } = nodes.gameStage.getBoundingClientRect();
  if (!availableWidth || !availableHeight) {
    return;
  }

  let fittedWidth = availableWidth;
  let fittedHeight = fittedWidth / BOARD_RATIO;

  if (fittedHeight > availableHeight) {
    fittedHeight = availableHeight;
    fittedWidth = fittedHeight * BOARD_RATIO;
  }

  canvas.style.width = `${Math.floor(fittedWidth)}px`;
  canvas.style.height = `${Math.floor(fittedHeight)}px`;
}

async function loadProfile() {
  const stored = await platform.getStorage(APP_CONFIG.storage.profileKey);
  profile = normalizeProfile(stored);

  if (typeof platform.getMockRewardedAds === "function") {
    profile.settings.mockRewardedAds = platform.getMockRewardedAds();
  }
}

async function saveProfileNow() {
  if (state.saveTimer) {
    window.clearTimeout(state.saveTimer);
    state.saveTimer = 0;
  }

  const ok = await platform.setStorage(APP_CONFIG.storage.profileKey, profile);
  if (!ok) {
    showToast("Storage is unavailable. Progress may not persist.", "danger");
  }
  return ok;
}

function scheduleSaveProfile() {
  if (state.saveTimer) {
    window.clearTimeout(state.saveTimer);
  }

  state.saveTimer = window.setTimeout(() => {
    saveProfileNow();
  }, 450);
}

function syncHud() {
  nodes.score.textContent = String(state.score);
  nodes.lives.textContent = String(state.lives);
  nodes.wave.textContent = String(state.wave);
  nodes.coins.textContent = String(profile.coins);
  nodes.best.textContent = String(profile.bestScore);
  nodes.shield.textContent = String(state.shieldCharges);

  if (nodes.startBest) {
    nodes.startBest.textContent = String(profile.bestScore);
  }
  if (nodes.startCoins) {
    nodes.startCoins.textContent = String(profile.coins);
  }
  if (nodes.shopCoins) {
    nodes.shopCoins.textContent = String(profile.coins);
  }
}

function updateBestScore() {
  if (state.score <= profile.bestScore) {
    return;
  }

  profile.bestScore = state.score;
  scheduleSaveProfile();
}

function awardCoins(amount, source, trackRun = true) {
  const safeAmount = Math.max(0, Math.floor(amount));
  if (!safeAmount) {
    return 0;
  }

  profile.coins += safeAmount;
  if (trackRun) {
    state.runCoins += safeAmount;
  }

  platform.logPlatformEvent("coins_awarded", {
    amount: safeAmount,
    source,
    runWave: state.wave,
  });
  scheduleSaveProfile();
  syncHud();
  return safeAmount;
}

function createParticles(x, y, color, amount = 12, speed = 220) {
  for (let index = 0; index < amount; index += 1) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * speed,
      vy: (Math.random() - 0.5) * speed,
      size: Math.random() * 4 + 2,
      life: Math.random() * 0.35 + 0.22,
      color,
    });
  }
}

function createFloater(x, y, text, color = THEME.accentSoft) {
  floaters.push({
    x,
    y,
    text,
    color,
    life: 0.8,
  });
}

function createShield(originX, originY) {
  const pattern = [
    "  ######  ",
    " ######## ",
    "##########",
    "### ## ###",
    "##      ##",
  ];
  const blocks = [];
  const size = 8;

  pattern.forEach((row, rowIndex) => {
    [...row].forEach((cell, columnIndex) => {
      if (cell !== "#") {
        return;
      }

      blocks.push({
        x: originX + columnIndex * size,
        y: originY + rowIndex * size,
        width: size,
        height: size,
      });
    });
  });

  return blocks;
}

function rebuildShields() {
  const shieldY = HEIGHT - 250;
  const shieldWidth = 80;
  const gap = (WIDTH - shieldWidth * 4) / 5;

  shields = [
    ...createShield(gap, shieldY),
    ...createShield(gap * 2 + shieldWidth, shieldY),
    ...createShield(gap * 3 + shieldWidth * 2, shieldY),
    ...createShield(gap * 4 + shieldWidth * 3, shieldY),
  ];
}

function createWave(wave) {
  const rows = Math.min(4 + Math.floor((wave - 1) / 2), 6);
  const columns = 8;
  const horizontalGap = 72;
  const verticalGap = 58;
  const formationWidth = (columns - 1) * horizontalGap + 42;
  const baseX = (WIDTH - formationWidth) / 2;
  const baseY = 118;

  invaders = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      invaders.push({
        x: baseX + column * horizontalGap,
        y: baseY + row * verticalGap,
        width: 42,
        height: 30,
        row,
        column,
        alive: true,
      });
    }
  }

  formation = {
    direction: 1,
    speed: 58 + wave * 12,
    descent: 25 + wave * 1.4,
    shootTimer: 0.58,
  };

  bullets = [];
  rebuildShields();
  state.status = "playing";
  state.overlayTimer = 1.1;
  state.intermissionBonusOffered = false;
  updateRunStatus(`Wave ${wave}`);
}

function resetPlayer() {
  player.x = WIDTH / 2 - player.width / 2;
  player.cooldown = 0;
}

function fullyResetPlayer() {
  resetPlayer();
  player.hitTimer = 0;
}

function resetInputs() {
  input.left = false;
  input.right = false;
  input.fire = false;
}

function ensureAudioContext() {
  if (!profile.settings.sound) {
    return null;
  }

  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  return audioContext;
}

function playTone(type) {
  const audio = ensureAudioContext();
  if (!audio) {
    return;
  }

  const settings = {
    fire: [520, 0.035, 0.035],
    kill: [220, 0.05, 0.05],
    hit: [90, 0.12, 0.08],
    clear: [660, 0.16, 0.07],
    coin: [760, 0.08, 0.045],
  }[type] || [360, 0.06, 0.04];

  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type === "hit" ? "sawtooth" : "square";
  oscillator.frequency.value = settings[0];
  gain.gain.setValueAtTime(settings[2], audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + settings[1]);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + settings[1]);
}

function startRun() {
  hideAllMajorOverlays();
  ensureAudioContext();
  resetInputs();

  state.score = 0;
  state.lives = 3;
  state.wave = 1;
  state.shieldCharges = startingShieldCharges();
  state.runSeconds = 0;
  state.runCoins = 0;
  state.runKills = 0;
  state.runWavesCleared = 0;
  state.reviveUsed = false;
  state.pendingSummary = null;
  state.screenShake = 0;
  particles = [];
  floaters = [];

  fullyResetPlayer();
  createWave(1);
  updateBestScore();
  syncHud();
  platform.logPlatformEvent("run_started", platform.getLaunchContext());
}

function pauseGame(source = "button") {
  if (state.status !== "playing" && state.status !== "intermission") {
    return;
  }

  state.previousStatus = state.status;
  state.status = "paused";
  resetInputs();
  setOverlay(nodes.pauseOverlay, true);
  updateRunStatus(source === "platform" ? "Paused by TikTok" : "Paused");
}

function resumeGame() {
  if (state.status !== "paused") {
    return;
  }

  state.status = state.previousStatus === "intermission" ? "intermission" : "playing";
  setOverlay(nodes.pauseOverlay, false);
  updateRunStatus(`Wave ${state.wave}`);
}

function finalizeRun(reason) {
  resetInputs();
  updateBestScore();

  const completionBonus = Math.max(6, Math.floor(state.score / 180) + state.runWavesCleared * 8);
  awardCoins(completionBonus, "run_completion");

  state.status = "gameover";
  state.pendingSummary = {
    reason,
    score: state.score,
    wave: state.wave,
    kills: state.runKills,
    coins: state.runCoins,
    bonusClaimed: false,
  };

  nodes.finalScore.textContent = String(state.pendingSummary.score);
  nodes.finalWave.textContent = String(state.pendingSummary.wave);
  nodes.finalCoins.textContent = String(state.pendingSummary.coins);
  nodes.finalReason.textContent = reason;
  nodes.doubleCoinsButton.disabled = !platform.canUse("rewardedAd");
  nodes.doubleCoinsButton.textContent = platform.canUse("rewardedAd")
    ? "Double Coins"
    : "Ad Bonus Unavailable";
  hideAllMajorOverlays();
  setOverlay(nodes.gameOverOverlay, true);
  syncHud();
  saveProfileNow();
  platform.logPlatformEvent("run_finished", state.pendingSummary);
}

function offerRevive(reason) {
  if (state.reviveUsed) {
    finalizeRun(reason);
    return;
  }

  state.status = "revive";
  resetInputs();
  nodes.reviveCopy.textContent = `Score ${state.score}. One revive is available for this run.`;
  hideAllMajorOverlays();
  setOverlay(nodes.reviveOverlay, true);
  updateRunStatus("Revive available");
}

async function handleReviveAd() {
  nodes.reviveCopy.textContent = "Opening rewarded ad...";
  const result = await platform.showRewardedAd("revive");

  if (!result.completed) {
    showToast("Rewarded ad was not completed. Ending run.", "danger");
    finalizeRun("Defense grid collapsed");
    return;
  }

  state.reviveUsed = true;
  state.lives = 1;
  state.shieldCharges = Math.max(state.shieldCharges, 1);
  player.hitTimer = 2;
  bullets = bullets.filter((bullet) => bullet.owner === "player");
  createParticles(player.x + player.width / 2, player.y, THEME.accent, 24, 340);
  hideAllMajorOverlays();
  state.status = "playing";
  updateRunStatus(`Wave ${state.wave}`);
  syncHud();
  playTone("clear");
  platform.logPlatformEvent("revive_completed", { score: state.score, wave: state.wave });
}

async function handleDoubleCoins() {
  if (!state.pendingSummary || state.pendingSummary.bonusClaimed) {
    return;
  }

  nodes.doubleCoinsButton.disabled = true;
  nodes.doubleCoinsButton.textContent = "Opening Ad...";
  const result = await platform.showRewardedAd("post_run_double_coins");

  if (!result.completed) {
    nodes.doubleCoinsButton.textContent = "Bonus Skipped";
    showToast("Bonus ad unavailable or incomplete.", "danger");
    return;
  }

  const bonus = state.pendingSummary.coins;
  awardCoins(bonus, "post_run_rewarded_bonus", false);
  state.pendingSummary.bonusClaimed = true;
  nodes.finalCoins.textContent = String(state.pendingSummary.coins + bonus);
  nodes.doubleCoinsButton.textContent = "Bonus Claimed";
  nodes.doubleCoinsButton.disabled = true;
  showToast(`Bonus paid: +${bonus} coins`, "success");
  playTone("coin");
  await saveProfileNow();
}

function firePlayerShot() {
  if (player.cooldown > 0 || state.status !== "playing") {
    return;
  }

  const laser = getEquipped("laser");
  bullets.push({
    x: player.x + player.width / 2 - 2,
    y: player.y - 16,
    width: 4,
    height: 16,
    vy: -820,
    owner: "player",
    color: laser.color,
  });

  player.cooldown = fireCooldown();
  playTone("fire");
}

function fireEnemyShot() {
  const byColumn = new Map();

  invaders.forEach((invader) => {
    if (!invader.alive) {
      return;
    }

    const existing = byColumn.get(invader.column);
    if (!existing || invader.y > existing.y) {
      byColumn.set(invader.column, invader);
    }
  });

  const shooters = [...byColumn.values()];
  if (shooters.length === 0) {
    return;
  }

  const shooter = shooters[Math.floor(Math.random() * shooters.length)];
  bullets.push({
    x: shooter.x + shooter.width / 2 - 2,
    y: shooter.y + shooter.height + 4,
    width: 4,
    height: 16,
    vy: 380 + state.wave * 26,
    owner: "enemy",
    color: THEME.danger,
  });
}

function intersects(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function getInvaderBounds() {
  const alive = invaders.filter((invader) => invader.alive);
  if (alive.length === 0) {
    return null;
  }

  const left = Math.min(...alive.map((invader) => invader.x));
  const right = Math.max(...alive.map((invader) => invader.x + invader.width));
  const bottom = Math.max(...alive.map((invader) => invader.y + invader.height));

  return { left, right, bottom };
}

function updatePlayer(dt) {
  const direction = Number(input.right) - Number(input.left);
  player.x = clamp(player.x + direction * player.speed * dt, 22, WIDTH - 22 - player.width);
  player.cooldown = Math.max(0, player.cooldown - dt);
  player.hitTimer = Math.max(0, player.hitTimer - dt);

  if (input.fire) {
    firePlayerShot();
  }
}

function updateInvaders(dt) {
  const bounds = getInvaderBounds();
  if (!bounds || state.status !== "playing") {
    return;
  }

  const projectedLeft = bounds.left + formation.direction * formation.speed * dt;
  const projectedRight = bounds.right + formation.direction * formation.speed * dt;

  if (projectedLeft < 24 || projectedRight > WIDTH - 24) {
    formation.direction *= -1;
    formation.speed += 8;
    invaders.forEach((invader) => {
      if (invader.alive) {
        invader.y += formation.descent;
      }
    });
  } else {
    invaders.forEach((invader) => {
      if (invader.alive) {
        invader.x += formation.direction * formation.speed * dt;
      }
    });
  }

  const refreshedBounds = getInvaderBounds();

  formation.shootTimer -= dt;
  if (formation.shootTimer <= 0) {
    fireEnemyShot();
    formation.shootTimer = Math.max(0.2, 0.82 - state.wave * 0.045) + Math.random() * 0.42;
  }

  if (refreshedBounds && refreshedBounds.bottom >= player.y) {
    offerRevive("The invaders reached the defense line");
  }
}

function updateBullets(dt) {
  bullets.forEach((bullet) => {
    bullet.y += bullet.vy * dt;
  });

  bullets = bullets.filter(
    (bullet) => !bullet.dead && bullet.y + bullet.height > -30 && bullet.y < HEIGHT + 30,
  );
}

function updateParticles(dt) {
  particles.forEach((particle) => {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
  });

  particles = particles.filter((particle) => particle.life > 0);

  floaters.forEach((floater) => {
    floater.y -= 42 * dt;
    floater.life -= dt;
  });

  floaters = floaters.filter((floater) => floater.life > 0);
}

function handleShieldCollisions(entity) {
  const hitIndex = shields.findIndex((block) => intersects(entity, block));
  if (hitIndex === -1) {
    return false;
  }

  const [destroyed] = shields.splice(hitIndex, 1);
  createParticles(
    destroyed.x + destroyed.width / 2,
    destroyed.y + destroyed.height / 2,
    getEquipped("shield").color,
    5,
  );
  return true;
}

function handlePlayerDamage() {
  if (player.hitTimer > 0) {
    return;
  }

  player.hitTimer = 1;
  state.screenShake = 0.22;
  createParticles(player.x + player.width / 2, player.y + player.height / 2, THEME.danger, 16, 300);
  playTone("hit");

  if (state.shieldCharges > 0) {
    state.shieldCharges -= 1;
    resetPlayer();
    syncHud();
    showToast("Starter Guard absorbed the hit.", "success");
    return;
  }

  state.lives -= 1;
  if (state.lives <= 0) {
    offerRevive("Defense grid collapsed");
  } else {
    resetPlayer();
  }
}

function handleCollisions() {
  bullets.forEach((bullet) => {
    if (bullet.dead) {
      return;
    }

    if (handleShieldCollisions(bullet)) {
      bullet.dead = true;
      return;
    }

    if (bullet.owner === "player") {
      const target = invaders.find((invader) => invader.alive && intersects(bullet, invader));
      if (target) {
        target.alive = false;
        bullet.dead = true;
        const scoreGain = 20 + (5 - target.row) * 8;
        state.score += scoreGain;
        state.runKills += 1;
        awardCoins(1, "enemy_kill");
        updateBestScore();
        createFloater(target.x + target.width / 2, target.y, "+1 coin");
        createParticles(
          target.x + target.width / 2,
          target.y + target.height / 2,
          THEME.accentStrong,
          12,
          280,
        );
        playTone("kill");
      }
      return;
    }

    if (intersects(bullet, player)) {
      bullet.dead = true;
      handlePlayerDamage();
    }
  });

  bullets.forEach((first, index) => {
    if (first.dead || first.owner !== "player") {
      return;
    }

    for (let bulletIndex = index + 1; bulletIndex < bullets.length; bulletIndex += 1) {
      const second = bullets[bulletIndex];
      if (second.dead || second.owner !== "enemy") {
        continue;
      }

      if (intersects(first, second)) {
        first.dead = true;
        second.dead = true;
        createParticles(first.x, first.y, THEME.text, 6);
        break;
      }
    }
  });

  invaders.forEach((invader) => {
    if (!invader.alive) {
      return;
    }

    shields = shields.filter((block) => !intersects(invader, block));
  });

  bullets = bullets.filter((bullet) => !bullet.dead);

  const livingInvaders = invaders.filter((invader) => invader.alive);
  if (livingInvaders.length === 0 && state.status === "playing") {
    const waveBonus = 14 + state.wave * 3;
    state.score += 150 + state.wave * 20;
    state.runWavesCleared += 1;
    awardCoins(waveBonus, "wave_clear");
    updateBestScore();
    state.status = "intermission";
    state.previousStatus = "intermission";
    state.overlayTimer = 1.25;
    updateRunStatus(`Wave clear: +${waveBonus} coins`);
    playTone("clear");
  }
}

function updateStars(dt) {
  stars.forEach((star) => {
    star.y += star.speed * dt;
    if (star.y > HEIGHT + 4) {
      star.y = -4;
      star.x = Math.random() * WIDTH;
    }
  });
}

function update(dt) {
  updateStars(dt);
  updateParticles(dt);
  state.screenShake = Math.max(0, state.screenShake - dt);

  if (state.status === "intermission") {
    state.overlayTimer -= dt;
    if (state.overlayTimer <= 0) {
      state.wave += 1;
      createWave(state.wave);
    }
    syncHud();
    return;
  }

  if (state.status !== "playing") {
    syncHud();
    return;
  }

  state.runSeconds += dt;
  state.overlayTimer = Math.max(0, state.overlayTimer - dt);
  updatePlayer(dt);
  updateInvaders(dt);
  updateBullets(dt);
  handleCollisions();
  syncHud();
}

function drawStars() {
  stars.forEach((star) => {
    ctx.fillStyle = `rgba(248, 251, 255, ${star.alpha})`;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  });
}

function drawArena() {
  const backdrop = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  backdrop.addColorStop(0, THEME.bgTop);
  backdrop.addColorStop(0.58, THEME.bgMid);
  backdrop.addColorStop(1, THEME.bgBottom);
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(WIDTH / 2, HEIGHT * 0.18, 30, WIDTH / 2, HEIGHT * 0.18, HEIGHT * 0.8);
  glow.addColorStop(0, "rgba(255, 212, 90, 0.14)");
  glow.addColorStop(0.35, "rgba(93, 242, 165, 0.09)");
  glow.addColorStop(1, "rgba(5, 7, 6, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = "rgba(93, 242, 165, 0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let y = 94; y < HEIGHT - 54; y += 74) {
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
  }

  for (let x = 84; x < WIDTH; x += 84) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT - 40);
  }

  ctx.stroke();

  ctx.fillStyle = "rgba(93, 242, 165, 0.08)";
  ctx.fillRect(0, HEIGHT - 160, WIDTH, 160);

  ctx.strokeStyle = "rgba(93, 242, 165, 0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT - 160);
  ctx.lineTo(WIDTH, HEIGHT - 160);
  ctx.stroke();
}

function drawPlayer() {
  if (player.hitTimer > 0 && Math.floor(player.hitTimer * 14) % 2 === 0) {
    return;
  }

  const ship = getEquipped("ship");
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = ship.color;
  ctx.fillRect(16, 0, 36, 8);
  ctx.fillRect(8, 8, 52, 8);
  ctx.fillRect(0, 16, 68, 8);
  ctx.fillStyle = ship.trim || THEME.text;
  ctx.fillRect(30, -8, 8, 8);

  if (state.shieldCharges > 0) {
    ctx.strokeStyle = getEquipped("shield").color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.72;
    ctx.strokeRect(-6, -12, 80, 42);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function drawInvader(invader) {
  const tint = [
    THEME.danger,
    THEME.accentStrong,
    THEME.accent,
    THEME.accentCool,
    THEME.text,
    "#ffc1a8",
  ][invader.row % 6];

  ctx.save();
  ctx.translate(invader.x, invader.y);
  ctx.fillStyle = tint;
  ctx.fillRect(6, 0, 30, 6);
  ctx.fillRect(0, 6, 42, 6);
  ctx.fillRect(0, 12, 8, 6);
  ctx.fillRect(14, 12, 14, 6);
  ctx.fillRect(34, 12, 8, 6);
  ctx.fillRect(6, 18, 8, 6);
  ctx.fillRect(28, 18, 8, 6);
  ctx.fillRect(2, 24, 8, 6);
  ctx.fillRect(32, 24, 8, 6);
  ctx.restore();
}

function drawBullets() {
  bullets.forEach((bullet) => {
    ctx.fillStyle = bullet.color || (bullet.owner === "player" ? getEquipped("laser").color : THEME.danger);
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
  });
}

function drawShields() {
  const shield = getEquipped("shield");
  shields.forEach((block) => {
    ctx.fillStyle = shield.color;
    ctx.fillRect(block.x, block.y, block.width, block.height);
  });
}

function drawParticles() {
  particles.forEach((particle) => {
    ctx.globalAlpha = clamp(particle.life / 0.6, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  });
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.textAlign = "center";
  ctx.font = '700 20px "Bahnschrift", "Arial Narrow", sans-serif';
  floaters.forEach((floater) => {
    ctx.globalAlpha = clamp(floater.life / 0.8, 0, 1);
    ctx.fillStyle = floater.color;
    ctx.fillText(floater.text, floater.x, floater.y);
  });
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawCanvasOverlay() {
  if (state.status === "intermission") {
    ctx.fillStyle = "rgba(5, 7, 6, 0.48)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = THEME.accentStrong;
    ctx.textAlign = "center";
    ctx.font = '700 46px "Bahnschrift", "Arial Narrow", sans-serif';
    ctx.fillText("SECTOR CLEAR", WIDTH / 2, HEIGHT / 2 - 10);
    ctx.font = '400 22px "Aptos", "Segoe UI", sans-serif';
    ctx.fillStyle = THEME.text;
    ctx.fillText(`Wave ${state.wave + 1} incoming`, WIDTH / 2, HEIGHT / 2 + 26);
    return;
  }

  if (state.status === "paused") {
    ctx.fillStyle = "rgba(5, 7, 6, 0.58)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = THEME.text;
    ctx.textAlign = "center";
    ctx.font = '700 50px "Bahnschrift", "Arial Narrow", sans-serif';
    ctx.fillText("PAUSED", WIDTH / 2, HEIGHT / 2);
    return;
  }

  if (state.overlayTimer <= 0 || state.status !== "playing") {
    return;
  }

  ctx.fillStyle = "rgba(5, 7, 6, 0.24)";
  ctx.fillRect(0, HEIGHT - 92, WIDTH, 92);
  ctx.fillStyle = THEME.muted;
  ctx.textAlign = "center";
  ctx.font = '400 24px "Aptos", "Segoe UI", sans-serif';
  ctx.fillText("Clear the formation before it reaches your line", WIDTH / 2, HEIGHT - 38);
}

function render() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.save();

  if (state.screenShake > 0) {
    const shake = state.screenShake * 18;
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }

  drawArena();
  drawStars();
  drawShields();
  invaders.forEach((invader) => {
    if (invader.alive) {
      drawInvader(invader);
    }
  });
  drawBullets();
  drawPlayer();
  drawParticles();

  ctx.fillStyle = "rgba(93, 242, 165, 0.58)";
  ctx.fillRect(0, HEIGHT - 28, WIDTH, 2);
  drawCanvasOverlay();
  ctx.restore();
}

function frame(timestamp) {
  const dt = Math.min((timestamp - previousTime) / 1000, 0.033);
  previousTime = timestamp;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

function setInput(action, active) {
  if (action in input) {
    input[action] = active;
  }
}

function movePlayerToClientX(clientX) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) {
    return;
  }

  const pointerX = clamp((clientX - rect.left) / rect.width, 0, 1) * WIDTH;
  player.x = clamp(pointerX - player.width / 2, 22, WIDTH - 22 - player.width);
}

function releaseCanvasPointer(pointerId) {
  if (canvasPointer.id !== null && pointerId !== undefined && pointerId !== canvasPointer.id) {
    return;
  }

  if (
    canvasPointer.id !== null &&
    typeof canvas.releasePointerCapture === "function" &&
    canvas.hasPointerCapture?.(canvasPointer.id)
  ) {
    try {
      canvas.releasePointerCapture(canvasPointer.id);
    } catch {
      // Some clients release capture automatically when the touch leaves the webview.
    }
  }

  canvasPointer.active = false;
  canvasPointer.id = null;
  if (usesTouchLayout()) {
    input.fire = false;
  }
}

function openStart() {
  if (state.status === "playing" || state.status === "intermission") {
    pauseGame();
  }

  hideAllMajorOverlays();
  setOverlay(nodes.startOverlay, true);
  syncHud();
}

function openShop() {
  if (state.status === "playing" || state.status === "intermission") {
    pauseGame();
  }

  renderShop();
  hideAllMajorOverlays();
  setOverlay(nodes.shopOverlay, true);
}

function openSettings() {
  if (state.status === "playing" || state.status === "intermission") {
    pauseGame();
  }

  syncSettingsControls();
  hideAllMajorOverlays();
  setOverlay(nodes.settingsOverlay, true);
}

function closeMenuOverlay() {
  hideAllMajorOverlays();

  if (state.status === "paused") {
    setOverlay(nodes.pauseOverlay, true);
    return;
  }

  if (state.status === "gameover") {
    setOverlay(nodes.gameOverOverlay, true);
    return;
  }

  if (state.status === "ready") {
    setOverlay(nodes.startOverlay, true);
  }
}

function renderShop() {
  if (!nodes.shopGrid) {
    return;
  }

  nodes.shopGrid.replaceChildren();
  ITEM_CATALOG.filter((item) => item.cost > 0).forEach((item) => {
    const owned = hasItem(item.id);
    const equipped = profile.equipped[item.type] === item.id;
    const card = document.createElement("article");
    card.className = "shop-card";
    card.dataset.type = item.type;

    const swatch = document.createElement("span");
    swatch.className = "shop-swatch";
    swatch.style.setProperty("--swatch-color", item.color || THEME.accentSoft);

    const name = document.createElement("h3");
    name.textContent = item.name;

    const description = document.createElement("p");
    description.textContent = item.description;

    const meta = document.createElement("span");
    meta.className = "shop-meta";
    meta.textContent = item.type === "upgrade" ? "Run upgrade" : item.type;

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.itemId = item.id;
    button.disabled = owned && (item.type === "upgrade" || equipped);

    if (!owned) {
      button.textContent = profile.coins >= item.cost ? `Unlock ${item.cost}` : `Need ${item.cost}`;
      button.disabled = profile.coins < item.cost;
    } else if (item.type === "upgrade") {
      button.textContent = "Owned";
    } else if (equipped) {
      button.textContent = "Equipped";
    } else {
      button.textContent = "Equip";
    }

    card.append(swatch, meta, name, description, button);
    nodes.shopGrid.append(card);
  });
  syncHud();
}

function handleShopAction(itemId) {
  const item = getItem(itemId);
  if (!item || item.cost === 0) {
    return;
  }

  if (!hasItem(item.id)) {
    if (profile.coins < item.cost) {
      showToast("Not enough coins yet.", "danger");
      return;
    }

    profile.coins -= item.cost;
    profile.owned.push(item.id);
    playTone("coin");
    showToast(`${item.name} unlocked.`, "success");
  }

  if (item.type !== "upgrade") {
    profile.equipped[item.type] = item.id;
    showToast(`${item.name} equipped.`, "success");
  }

  scheduleSaveProfile();
  renderShop();
  syncHud();
}

function syncSettingsControls() {
  if (nodes.soundToggle) {
    nodes.soundToggle.checked = Boolean(profile.settings.sound);
  }
  if (nodes.mockAdsToggle) {
    nodes.mockAdsToggle.checked = Boolean(profile.settings.mockRewardedAds);
    nodes.mockAdsToggle.disabled = platform.isTikTok;
  }
}

async function claimDailyReward() {
  const key = todayKey();
  if (profile.dailyClaimedOn === key) {
    showToast("Daily reward already claimed.", "info");
    return;
  }

  profile.dailyClaimedOn = key;
  awardCoins(45, "daily_reward", false);
  playTone("coin");
  showToast("Daily reward claimed: +45 coins", "success");
  await saveProfileNow();
}

async function handleShortcutReward() {
  const addResult = await platform.addShortcut();
  if (!addResult.ok) {
    showToast("Shortcut prompt is unavailable here.", "danger");
    return;
  }

  const rewardResult = await platform.claimShortcutReward();
  if (!rewardResult.ok && !rewardResult.mocked) {
    showToast("Shortcut reward check failed.", "danger");
    return;
  }

  if (profile.shortcutRewardClaimed) {
    showToast("Shortcut reward already claimed.", "info");
    return;
  }

  if (rewardResult.canReceiveReward || rewardResult.mocked) {
    profile.shortcutRewardClaimed = true;
    awardCoins(120, "shortcut_reward", false);
    playTone("coin");
    showToast("Shortcut reward claimed: +120 coins", "success");
    await saveProfileNow();
  } else {
    showToast("Shortcut reward is not ready yet.", "info");
  }
}

function bindInputs() {
  document.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "Space", "KeyA", "KeyD", "Enter", "KeyP", "Escape"].includes(event.code)) {
      event.preventDefault();
    }

    if (event.code === "ArrowLeft" || event.code === "KeyA") {
      setInput("left", true);
    }
    if (event.code === "ArrowRight" || event.code === "KeyD") {
      setInput("right", true);
    }
    if (event.code === "Space") {
      setInput("fire", true);
    }
    if (event.code === "Enter" && (state.status === "ready" || state.status === "gameover")) {
      startRun();
    }
    if (event.code === "KeyP") {
      if (state.status === "paused") {
        resumeGame();
      } else {
        pauseGame();
      }
    }
    if (event.code === "Escape") {
      openStart();
    }
  });

  document.addEventListener("keyup", (event) => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") {
      setInput("left", false);
    }
    if (event.code === "ArrowRight" || event.code === "KeyD") {
      setInput("right", false);
    }
    if (event.code === "Space") {
      setInput("fire", false);
    }
  });

  window.addEventListener("blur", () => {
    resetInputs();
    releaseCanvasPointer();
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    const { action } = button.dataset;
    const release = () => setInput(action, false);

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      ensureAudioContext();
      setInput(action, true);
      if (action === "fire") {
        firePlayerShot();
      }
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointerleave", release);
    button.addEventListener("pointercancel", release);
  });

  canvas.addEventListener("pointerdown", (event) => {
    ensureAudioContext();

    if (state.status === "ready") {
      startRun();
      return;
    }

    if (event.pointerType === "mouse") {
      return;
    }

    if (state.status !== "playing") {
      return;
    }

    event.preventDefault();
    canvasPointer.active = true;
    canvasPointer.id = event.pointerId;
    if (typeof canvas.setPointerCapture === "function") {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Some embedded webviews reject capture if the gesture is already owned.
      }
    }

    input.left = false;
    input.right = false;
    input.fire = true;
    movePlayerToClientX(event.clientX);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!canvasPointer.active || event.pointerId !== canvasPointer.id) {
      return;
    }

    event.preventDefault();
    movePlayerToClientX(event.clientX);
  });

  canvas.addEventListener("pointerup", (event) => releaseCanvasPointer(event.pointerId));
  canvas.addEventListener("pointercancel", (event) => releaseCanvasPointer(event.pointerId));
  canvas.addEventListener("pointerleave", (event) => releaseCanvasPointer(event.pointerId));
}

function bindButtons() {
  document.querySelectorAll("[data-start-run]").forEach((button) => {
    button.addEventListener("click", startRun);
  });

  document.querySelectorAll("[data-open-shop]").forEach((button) => {
    button.addEventListener("click", openShop);
  });

  document.querySelectorAll("[data-open-settings]").forEach((button) => {
    button.addEventListener("click", openSettings);
  });

  document.querySelectorAll("[data-open-start]").forEach((button) => {
    button.addEventListener("click", openStart);
  });

  document.querySelectorAll("[data-close-overlay]").forEach((button) => {
    button.addEventListener("click", closeMenuOverlay);
  });

  document.querySelectorAll("[data-pause]").forEach((button) => {
    button.addEventListener("click", () => pauseGame());
  });

  document.querySelectorAll("[data-resume]").forEach((button) => {
    button.addEventListener("click", resumeGame);
  });

  document.querySelectorAll("[data-skip-revive]").forEach((button) => {
    button.addEventListener("click", () => finalizeRun("Defense grid collapsed"));
  });

  document.querySelectorAll("[data-watch-revive]").forEach((button) => {
    button.addEventListener("click", handleReviveAd);
  });

  nodes.doubleCoinsButton?.addEventListener("click", handleDoubleCoins);
  nodes.dailyButton?.addEventListener("click", claimDailyReward);
  nodes.shortcutButton?.addEventListener("click", handleShortcutReward);

  nodes.shopGrid?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-item-id]");
    if (!button) {
      return;
    }

    handleShopAction(button.dataset.itemId);
  });

  nodes.soundToggle?.addEventListener("change", () => {
    profile.settings.sound = nodes.soundToggle.checked;
    scheduleSaveProfile();
    showToast(profile.settings.sound ? "Sound on." : "Sound off.", "info");
  });

  nodes.mockAdsToggle?.addEventListener("change", () => {
    profile.settings.mockRewardedAds = nodes.mockAdsToggle.checked;
    if (typeof platform.setMockRewardedAds === "function") {
      platform.setMockRewardedAds(profile.settings.mockRewardedAds);
    }
    scheduleSaveProfile();
    showToast(
      profile.settings.mockRewardedAds ? "Browser rewarded ads succeed." : "Browser rewarded ads fail.",
      "info",
    );
  });
}

function bindViewport() {
  window.addEventListener("resize", scheduleCanvasFit);
  window.addEventListener("orientationchange", scheduleCanvasFit);
  window.visualViewport?.addEventListener("resize", scheduleCanvasFit);
  window.visualViewport?.addEventListener("scroll", scheduleCanvasFit);

  if (typeof touchQuery.addEventListener === "function") {
    touchQuery.addEventListener("change", scheduleCanvasFit);
  } else if (typeof touchQuery.addListener === "function") {
    touchQuery.addListener(scheduleCanvasFit);
  }
}

async function boot() {
  bindInputs();
  bindButtons();
  bindViewport();
  setOverlay(nodes.loadingOverlay, true);

  const initResult = await platform.init();
  if (initResult.ok) {
    updatePlatformStatus(platform.isTikTok ? "TikTok SDK ready" : "Browser mock ready", "ready");
  } else {
    updatePlatformStatus("SDK fallback active", "warning");
    showToast(initResult.error || "TikTok SDK is not ready. Browser mocks are active.", "danger");
    platform = createPlatform(APP_CONFIG);
  }

  platform.pauseHooks(() => pauseGame("platform"));
  platform.resumeHooks(() => {
    if (state.status === "paused") {
      updateRunStatus("Ready to resume");
    }
  });

  const loginResult = await platform.login();
  if (!loginResult.ok) {
    showToast("Silent login failed. Local progress still works.", "danger");
  }

  await loadProfile();
  syncSettingsControls();
  renderShop();
  syncHud();
  scheduleCanvasFit();
  state.status = "ready";
  hideAllMajorOverlays();
  setOverlay(nodes.startOverlay, true);
  updateRunStatus("Ready");
  previousTime = performance.now();
  requestAnimationFrame(frame);
}

boot().catch((error) => {
  console.error("[game] Boot failed", error);
  updatePlatformStatus("Boot error", "danger");
  showToast("Game boot failed. Check the console for details.", "danger");
});
