const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreNode = document.getElementById("score");
const livesNode = document.getElementById("lives");
const levelNode = document.getElementById("level");
const bestNode = document.getElementById("best");
const modeHintNode = document.getElementById("mode-hint");
const restartButton = document.getElementById("restart-button");
const gameStage = document.querySelector(".game-stage");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const BOARD_RATIO = WIDTH / HEIGHT;
const STORAGE_KEY = "space-invaders-best-score";
const TOUCH_LAYOUT_CLASS = "touch-layout";
const touchQuery = window.matchMedia("(hover: none) and (pointer: coarse)");
const THEME = {
  text: "#f8fbff",
  muted: "#98a9c0",
  accent: "#41d7b7",
  accentCool: "#6ea8ff",
  accentStrong: "#ff8b5e",
  accentSoft: "#ffd27a",
  danger: "#ff7c87",
  bgTop: "#081224",
  bgMid: "#0d1830",
  bgBottom: "#040813",
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
  speed: 440,
  cooldown: 0,
  hitTimer: 0,
  x: WIDTH / 2 - 34,
  y: HEIGHT - 70,
};

function readBestScore() {
  try {
    return Number.parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10) || 0;
  } catch {
    return 0;
  }
}

const state = {
  score: 0,
  lives: 3,
  level: 1,
  status: "playing",
  overlayTimer: 0,
  bestScore: readBestScore(),
};

let invaders = [];
let bullets = [];
let particles = [];
let shields = [];
let fitCanvasFrame = 0;
let formation = {
  direction: 1,
  speed: 52,
  descent: 28,
  shootTimer: 0.8,
};

const canvasPointer = {
  active: false,
  id: null,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function usesTouchLayout() {
  return touchQuery.matches;
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
  if (!canvas || !gameStage) {
    return;
  }

  if (!usesTouchLayout()) {
    canvas.style.removeProperty("width");
    canvas.style.removeProperty("height");
    return;
  }

  const { width: availableWidth, height: availableHeight } = gameStage.getBoundingClientRect();
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

function refreshTouchLayout() {
  document.body.classList.toggle(TOUCH_LAYOUT_CLASS, usesTouchLayout());
  updateModeHint();
  scheduleCanvasFit();
}

function updateModeHint() {
  if (!modeHintNode) {
    return;
  }

  modeHintNode.textContent = usesTouchLayout()
    ? "Touch: drag on the playfield to steer, hold Fire to keep shooting, and tap Restart anytime."
    : "Keyboard: use A / D or the arrow keys to move, Space to fire, and Enter to restart.";
}

function intersects(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function resetPlayer() {
  player.x = WIDTH / 2 - player.width / 2;
  player.cooldown = 0;
}

function fullyResetPlayer() {
  resetPlayer();
  player.hitTimer = 0;
}

function syncHud() {
  scoreNode.textContent = String(state.score);
  livesNode.textContent = String(state.lives);
  levelNode.textContent = String(state.level);
  bestNode.textContent = String(state.bestScore);
}

function updateBestScore() {
  if (state.score <= state.bestScore) {
    return;
  }

  state.bestScore = state.score;
  try {
    localStorage.setItem(STORAGE_KEY, String(state.bestScore));
  } catch {
    // Ignore storage failures so the game still runs in restricted contexts.
  }
}

function createParticles(x, y, color, amount = 12) {
  for (let index = 0; index < amount; index += 1) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 220,
      vy: (Math.random() - 0.5) * 220,
      size: Math.random() * 4 + 2,
      life: Math.random() * 0.35 + 0.22,
      color,
    });
  }
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
  shields = [
    ...createShield(140, HEIGHT - 180),
    ...createShield(350, HEIGHT - 180),
    ...createShield(560, HEIGHT - 180),
    ...createShield(770, HEIGHT - 180),
  ];
}

function createWave(level) {
  const rows = Math.min(4 + Math.floor((level - 1) / 2), 6);
  const columns = 10;
  const horizontalGap = 62;
  const verticalGap = 52;
  const baseX = 120;
  const baseY = 90;

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
    speed: 54 + level * 10,
    descent: 24 + level * 1.2,
    shootTimer: 0.65,
  };

  bullets = [];
  rebuildShields();
  state.status = "playing";
  state.overlayTimer = 1.2;
}

function restartGame() {
  state.score = 0;
  state.lives = 3;
  state.level = 1;
  particles = [];
  fullyResetPlayer();
  createWave(1);
  updateBestScore();
  syncHud();
}

function firePlayerShot() {
  if (player.cooldown > 0 || state.status !== "playing") {
    return;
  }

  bullets.push({
    x: player.x + player.width / 2 - 2,
    y: player.y - 16,
    width: 4,
    height: 16,
    vy: -700,
    owner: "player",
  });

  player.cooldown = 0.28;
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
    vy: 320 + state.level * 22,
    owner: "enemy",
  });
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
    formation.shootTimer = Math.max(0.24, 0.9 - state.level * 0.04) + Math.random() * 0.45;
  }

  if (refreshedBounds && refreshedBounds.bottom >= player.y) {
    state.status = "gameover";
    state.overlayTimer = 999;
    updateBestScore();
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
    THEME.accent,
    5,
  );
  return true;
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
        state.score += 20 + (5 - target.row) * 8;
        updateBestScore();
        createParticles(
          target.x + target.width / 2,
          target.y + target.height / 2,
          THEME.accentStrong,
          10,
        );
      }
      return;
    }

    if (player.hitTimer <= 0 && intersects(bullet, player)) {
      bullet.dead = true;
      state.lives -= 1;
      player.hitTimer = 1;
      createParticles(player.x + player.width / 2, player.y + player.height / 2, THEME.danger, 16);

      if (state.lives <= 0) {
        state.status = "gameover";
        state.overlayTimer = 999;
        updateBestScore();
      } else {
        resetPlayer();
      }
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
    state.score += 150;
    updateBestScore();
    state.status = "intermission";
    state.overlayTimer = 1.4;
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

  if (state.status === "intermission") {
    state.overlayTimer -= dt;
    if (state.overlayTimer <= 0) {
      state.level += 1;
      createWave(state.level);
    }
    syncHud();
    return;
  }

  if (state.status === "gameover") {
    syncHud();
    return;
  }

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
  backdrop.addColorStop(0.56, THEME.bgMid);
  backdrop.addColorStop(1, THEME.bgBottom);
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(WIDTH / 2, HEIGHT * 0.18, 30, WIDTH / 2, HEIGHT * 0.18, HEIGHT * 0.78);
  glow.addColorStop(0, "rgba(110, 168, 255, 0.16)");
  glow.addColorStop(0.35, "rgba(65, 215, 183, 0.08)");
  glow.addColorStop(1, "rgba(4, 8, 19, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = "rgba(110, 168, 255, 0.08)";
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

  ctx.fillStyle = "rgba(65, 215, 183, 0.08)";
  ctx.fillRect(0, HEIGHT - 132, WIDTH, 132);

  ctx.strokeStyle = "rgba(65, 215, 183, 0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT - 132);
  ctx.lineTo(WIDTH, HEIGHT - 132);
  ctx.stroke();
}

function drawPlayer() {
  if (player.hitTimer > 0 && Math.floor(player.hitTimer * 12) % 2 === 0) {
    return;
  }

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = THEME.accent;
  ctx.fillRect(16, 0, 36, 8);
  ctx.fillRect(8, 8, 52, 8);
  ctx.fillRect(0, 16, 68, 8);
  ctx.fillStyle = THEME.text;
  ctx.fillRect(30, -8, 8, 8);
  ctx.restore();
}

function drawInvader(invader) {
  const tint = [
    THEME.danger,
    THEME.accentStrong,
    THEME.accent,
    THEME.accentCool,
    THEME.text,
    "#ffb8a1",
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
    ctx.fillStyle = bullet.owner === "player" ? THEME.accentSoft : THEME.danger;
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
  });
}

function drawShields() {
  shields.forEach((block) => {
    ctx.fillStyle = THEME.accent;
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
}

function drawOverlay() {
  if (state.status === "gameover") {
    ctx.fillStyle = "rgba(4, 8, 19, 0.76)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = THEME.text;
    ctx.textAlign = "center";
    ctx.font = '700 58px "Bahnschrift", "Arial Narrow", sans-serif';
    ctx.fillText("GAME OVER", WIDTH / 2, HEIGHT / 2 - 28);
    ctx.font = '400 24px "Aptos", "Segoe UI", sans-serif';
    ctx.fillStyle = THEME.muted;
    ctx.fillText(
      usesTouchLayout()
        ? "Tap Restart or the playfield to launch a new run"
        : "Press Enter to launch a new run",
      WIDTH / 2,
      HEIGHT / 2 + 24,
    );
    return;
  }

  if (state.status === "intermission") {
    ctx.fillStyle = "rgba(4, 8, 19, 0.44)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = THEME.accentStrong;
    ctx.textAlign = "center";
    ctx.font = '700 44px "Bahnschrift", "Arial Narrow", sans-serif';
    ctx.fillText("Sector Clear", WIDTH / 2, HEIGHT / 2 - 10);
    ctx.font = '400 22px "Aptos", "Segoe UI", sans-serif';
    ctx.fillStyle = THEME.text;
    ctx.fillText(`Wave ${state.level + 1} incoming`, WIDTH / 2, HEIGHT / 2 + 26);
    return;
  }

  if (state.overlayTimer <= 0) {
    return;
  }

  ctx.fillStyle = "rgba(4, 8, 19, 0.24)";
  ctx.fillRect(0, HEIGHT - 92, WIDTH, 92);
  ctx.fillStyle = THEME.muted;
  ctx.textAlign = "center";
  ctx.font = '400 24px "Aptos", "Segoe UI", sans-serif';
  ctx.fillText("Clear the formation before it reaches your line", WIDTH / 2, HEIGHT - 38);
}

function render() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
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

  ctx.fillStyle = "rgba(65, 215, 183, 0.52)";
  ctx.fillRect(0, HEIGHT - 28, WIDTH, 2);

  drawOverlay();
}

let previousTime = performance.now();

function frame(timestamp) {
  const dt = Math.min((timestamp - previousTime) / 1000, 0.033);
  previousTime = timestamp;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

function setInput(action, active) {
  input[action] = active;
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
      // Ignore pointer capture cleanup errors from browsers that already released it.
    }
  }

  canvasPointer.active = false;
  canvasPointer.id = null;
}

document.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "Space", "KeyA", "KeyD", "Enter"].includes(event.code)) {
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
  if (event.code === "Enter" && state.status === "gameover") {
    restartGame();
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
  input.left = false;
  input.right = false;
  input.fire = false;
  releaseCanvasPointer();
});

document.querySelectorAll("[data-action]").forEach((button) => {
  const { action } = button.dataset;

  const release = () => setInput(action, false);

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
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
  if (event.pointerType === "mouse") {
    return;
  }

  event.preventDefault();

  if (state.status === "gameover") {
    restartGame();
    return;
  }

  canvasPointer.active = true;
  canvasPointer.id = event.pointerId;
  if (typeof canvas.setPointerCapture === "function") {
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers reject capture when the pointer is already handled elsewhere.
    }
  }

  input.left = false;
  input.right = false;
  movePlayerToClientX(event.clientX);
});

canvas.addEventListener("pointermove", (event) => {
  if (!canvasPointer.active || event.pointerId !== canvasPointer.id) {
    return;
  }

  event.preventDefault();
  movePlayerToClientX(event.clientX);
});

canvas.addEventListener("pointerup", (event) => {
  releaseCanvasPointer(event.pointerId);
});

canvas.addEventListener("pointercancel", (event) => {
  releaseCanvasPointer(event.pointerId);
});

canvas.addEventListener("pointerleave", (event) => {
  releaseCanvasPointer(event.pointerId);
});

restartButton?.addEventListener("click", () => {
  restartGame();
});

window.addEventListener("resize", scheduleCanvasFit);
window.addEventListener("orientationchange", scheduleCanvasFit);
window.visualViewport?.addEventListener("resize", scheduleCanvasFit);
window.visualViewport?.addEventListener("scroll", scheduleCanvasFit);

if (typeof touchQuery.addEventListener === "function") {
  touchQuery.addEventListener("change", refreshTouchLayout);
} else if (typeof touchQuery.addListener === "function") {
  touchQuery.addListener(refreshTouchLayout);
}

restartGame();
refreshTouchLayout();
requestAnimationFrame(frame);
