const socket = io();
const bgMusic = document.getElementById("bgMusic");
const musicToggle = document.getElementById("musicToggle");

bgMusic.volume = 0.25;

function startMusic() {
  bgMusic.play().then(() => {
    musicToggle.textContent = "🔊 MUSIC ON";
  }).catch(() => {});
}

function toggleMusic() {
  if (bgMusic.paused) {
    startMusic();
  } else {
    bgMusic.pause();
    musicToggle.textContent = "🔇 MUSIC OFF";
  }
}

musicToggle.onclick = toggleMusic;

// Start music after the first user interaction.
document.addEventListener("pointerdown", startMusic, { once: true });
const c = document.getElementById("game");
const x = c.getContext("2d");
const eventEl = document.getElementById("event");
const stats = document.getElementById("stats");
const leader = document.getElementById("leader");
const winner = document.getElementById("winner");
const winnerFlag = document.getElementById("winnerFlag");
const winnerName = document.getElementById("winnerName");

let s = null;
const flagImages = new Map();
const failedFlags = new Set();

function flagUrl(code) {
  // FlagCDN provides actual rectangular PNG flag images using ISO alpha-2 codes.
  return `https://flagcdn.com/w80/${code.toLowerCase()}.png`;
}

function loadFlag(code) {
  if (flagImages.has(code) || failedFlags.has(code)) return;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => flagImages.set(code, img);
  img.onerror = () => failedFlags.add(code);
  img.src = flagUrl(code);
}

socket.on("state", v => {
  s = v;
  for (const t of v.teams) loadFlag(t.code);
  eventEl.textContent = v.event;
  stats.textContent = `${v.survivors} / 250 SURVIVING  •  ROUND ${v.round}`;
  renderLeader();

  if (v.winner) {
    const q = v.teams.find(t => t.id === v.winner);
    winner.style.display = "flex";
    winnerFlag.textContent = q.flag;
    winnerName.textContent = q.name;
  } else {
    winner.style.display = "none";
  }
});

document.getElementById("reset").onclick = () => socket.emit("admin:reset");
document.getElementById("again").onclick = () => socket.emit("admin:reset");

function renderLeader() {
  if (!s) return;
  const alive = s.teams.filter(t => t.alive).sort((a, b) => b.hp - a.hp);
  const dead = s.teams.length - alive.length;

  leader.innerHTML =
    `<b>TOP SURVIVORS</b><div class="small">${alive.length} alive • ${dead} eliminated</div>` +
    alive.slice(0, 12).map(t => `
      <div class="row">
        <img class="mini-flag" src="${flagUrl(t.code)}" alt="">
        <div>
          <b>${t.name}</b>
          <div class="bar"><i style="width:${t.hp}%"></i></div>
        </div>
        <span>${Math.ceil(t.hp)}</span>
      </div>
    `).join("");
}

function roundRect(ctx, x0, y0, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x0 + rr, y0);
  ctx.arcTo(x0 + w, y0, x0 + w, y0 + h, rr);
  ctx.arcTo(x0 + w, y0 + h, x0, y0 + h, rr);
  ctx.arcTo(x0, y0 + h, x0, y0, rr);
  ctx.arcTo(x0, y0, x0 + w, y0, rr);
  ctx.closePath();
}

function drawFlag(t) {
  const img = flagImages.get(t.code);

  // Actual flag dimensions. No circular fighter graphic.
  const w = 27;
  const h = 18;
  const left = t.x - w / 2;
  const top = t.y - h / 2;

  x.save();

  if (!t.alive) {
    x.globalAlpha = 0.16;
  }

  // Motion trail behind the flag.
  if (Math.hypot(t.vx, t.vy) > 55) {
    x.globalAlpha *= 0.16;
    x.strokeStyle = "#65e6ff";
    x.lineWidth = 5;
    x.beginPath();
    x.moveTo(t.x - t.vx * 0.13, t.y - t.vy * 0.13);
    x.lineTo(t.x, t.y);
    x.stroke();
    x.globalAlpha = t.alive ? 1 : 0.16;
  }

  // Viewer boost / shield is shown as an outline around the flag,
  // not as a replacement for the flag.
  if (t.boost > 0) {
    x.shadowBlur = 18;
    x.shadowColor = "#ffd166";
    x.strokeStyle = "#ffd166";
    x.lineWidth = 2;
    roundRect(x, left - 4, top - 4, w + 8, h + 8, 5);
    x.stroke();
  }

  if (t.shield > 0) {
    x.shadowBlur = 14;
    x.shadowColor = "#63e5ff";
    x.strokeStyle = "#63e5ff";
    x.lineWidth = 2;
    roundRect(x, left - 3, top - 3, w + 6, h + 6, 5);
    x.stroke();
  }

  x.shadowBlur = 0;

  // White backing gives flags visibility against the dark arena.
  x.fillStyle = "#eef3f8";
  roundRect(x, left - 1, top - 1, w + 2, h + 2, 3);
  x.fill();

  if (img && img.complete && img.naturalWidth > 0) {
    x.drawImage(img, left, top, w, h);
  } else {
    // Graceful fallback while the real image is loading.
    x.font = "17px sans-serif";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillStyle = "#111";
    x.fillText(t.flag, t.x, t.y);
  }

  // HP indicator below the flag.
  const bw = 28, bh = 3;
  x.fillStyle = "#1a2637";
  x.fillRect(t.x - bw / 2, top + h + 4, bw, bh);
  x.fillStyle = "#5ee5ff";
  x.fillRect(t.x - bw / 2, top + h + 4, bw * Math.max(0, t.hp) / 100, bh);

  // Keep labels readable without cluttering all 250 flags.
  if (t.votes > 0 || t.hp > 85 || s.survivors <= 35) {
    x.font = "bold 8px Inter, Arial";
    x.textAlign = "center";
    x.textBaseline = "top";
    x.fillStyle = "#dce8f5";
    x.shadowBlur = 3;
    x.shadowColor = "#000";
    x.fillText(t.name, t.x, top + h + 9);
  }

  x.restore();
}

function glow(px, py, r, color, w, blur) {
  x.save();
  x.shadowBlur = blur;
  x.shadowColor = color;
  x.strokeStyle = color;
  x.lineWidth = w;
  x.beginPath();
  x.arc(px, py, r, 0, Math.PI * 2);
  x.stroke();
  x.restore();
}

function draw() {
  requestAnimationFrame(draw);
  if (!s) return;

  const pulse = (Math.sin(performance.now() * .004) + 1) / 2;
  x.clearRect(0, 0, c.width, c.height);

  const bg = x.createRadialGradient(900, 500, 30, 900, 500, 950);
  bg.addColorStop(0, "#101b2d");
  bg.addColorStop(.55, "#050914");
  bg.addColorStop(1, "#010205");
  x.fillStyle = bg;
  x.fillRect(0, 0, 1800, 1000);

  // Broadcast grid.
  x.globalAlpha = .12;
  x.strokeStyle = "#58708e";
  x.lineWidth = 1;
  for (let xx = 0; xx < 1800; xx += 45) {
    x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx, 1000); x.stroke();
  }
  for (let yy = 0; yy < 1000; yy += 45) {
    x.beginPath(); x.moveTo(0, yy); x.lineTo(1800, yy); x.stroke();
  }
  x.globalAlpha = 1;

  x.fillStyle = `rgba(90,20,180,${.045 + .035 * pulse})`;
  x.fillRect(0, 0, 1800, 1000);

  // One rotating opening in the circular arena wall.
  const gateA = s.gateAngle ?? -Math.PI / 2;
  const gateW = s.gateWidth ?? Math.PI / 5.2;
  const radius = s.arenaRadius;

  // Solid ring, leaving the opening empty.
  x.save();
  x.shadowBlur = 28;
  x.shadowColor = "#5ce1ff";
  x.strokeStyle = "#5ce1ff";
  x.lineWidth = 5;
  x.beginPath();
  x.arc(900, 500, radius, gateA + gateW/2, gateA + Math.PI*2 - gateW/2, false);
  x.stroke();
  x.restore();

  // Yellow rotating gap.
  x.save();
  x.strokeStyle = "#ffd166";
  x.lineWidth = 11;
  x.shadowBlur = 20;
  x.shadowColor = "#ffd166";
  x.beginPath();
  x.arc(900, 500, radius, gateA - gateW/2, gateA + gateW/2);
  x.stroke();
  x.restore();

  // Arrow shows the direction/location of the opening.
  const gx = 900 + Math.cos(gateA) * radius;
  const gy = 500 + Math.sin(gateA) * radius;
  x.save();
  x.translate(gx, gy);
  x.rotate(gateA);
  x.fillStyle = "#ffd166";
  x.beginPath();
  x.moveTo(18, 0);
  x.lineTo(-10, -10);
  x.lineTo(-10, 10);
  x.closePath();
  x.fill();
  x.restore();

  glow(900, 500, radius - 9, "#183d5b", 2, 0);

  x.save();
  x.translate(900, 500);
  x.rotate(performance.now() * .00012);
  x.strokeStyle = "#294764";
  x.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    x.beginPath();
    x.arc(0, 0, 35 + i * 18, 0, Math.PI * 2);
    x.stroke();
  }
  x.restore();

  // Impact particles.
  for (const p of s.particles) {
    x.globalAlpha = Math.max(0, p.life / p.max);
    x.fillStyle = "#69e8ff";
    x.beginPath();
    x.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
    x.fill();
  }
  x.globalAlpha = 1;

  for (const t of s.teams) drawFlag(t);
}

draw();
