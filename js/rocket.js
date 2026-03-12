// ============================================================
// rocket.js — Rocket mechanic
//
// A rocket occupies 2 grid cells (its "core"). The trigger
// cell is the cell adjacent to the back core, opposite to the
// launch direction. It is computed — not stored in the grid.
//
// Any box type can sit on the trigger cell. Once that cell
// becomes truly empty (same rule as reveal), the rocket
// launches in its direction, revealing the hidden boxes under
// its two core cells. A flying projectile can chain-react
// with other rockets it collides with.
// ============================================================

// ── Global state ──
var rocketProjectiles = [];
var ROCKET_LAUNCH_SPEED = 0.04;
var ROCKET_PROJECTILE_SPEED = 0.12;
var rocketActivationQueue = [];

// Persistent map: triggerCellIdx → { rocketId, activated }
// Computed once in startLevel() from core positions.
// Survives tunnel overwrites of stock[] at that cell.
var rocketTriggerCells = {};

// ── Direction helpers ──
var ROCKET_DIR_DELTA = {
  right: { dr: 0, dc: 1 },
  left:  { dr: 0, dc: -1 },
  down:  { dr: 1, dc: 0 },
  up:    { dr: -1, dc: 0 }
};
var ROCKET_DIR_ARROWS = { up: '\u25B2', left: '\u25C0', down: '\u25BC', right: '\u25B6' };

// Given a trigger cell index + direction, return the two core indices.
// Core 0 (back) is at trigger + 1 step, core 1 (nose) at trigger + 2 steps.
// Returns null if out of bounds.
function getRocketCoreIndices(triggerIdx, dir, cols, rows) {
  cols = cols || 7; rows = rows || 7;
  var tr = Math.floor(triggerIdx / cols), tc = triggerIdx % cols;
  var d = ROCKET_DIR_DELTA[dir];
  if (!d) return null;
  var c1r = tr + d.dr, c1c = tc + d.dc;
  var c2r = tr + d.dr * 2, c2c = tc + d.dc * 2;
  if (c1r < 0 || c1r >= rows || c1c < 0 || c1c >= cols) return null;
  if (c2r < 0 || c2r >= rows || c2c < 0 || c2c >= cols) return null;
  return [c1r * cols + c1c, c2r * cols + c2c];
}

// Given a back-core index + direction, compute the trigger cell index.
// Returns -1 if out of bounds.
function getRocketTriggerIdx(backCoreIdx, dir, cols, rows) {
  cols = cols || 7; rows = rows || 7;
  var d = ROCKET_DIR_DELTA[dir];
  if (!d) return -1;
  var cr = Math.floor(backCoreIdx / cols), cc = backCoreIdx % cols;
  var tr = cr - d.dr, tc = cc - d.dc;
  if (tr < 0 || tr >= rows || tc < 0 || tc >= cols) return -1;
  return tr * cols + tc;
}

// ── Drawing: rocket core on the grid ──
function drawRocketCoreOnGrid(ctx, x, y, w, h, S, dir, role, tick, launchT, activated) {
  ctx.save();

  var bodyGrad;
  if (dir === 'left' || dir === 'right') {
    bodyGrad = ctx.createLinearGradient(x, y, x, y + h);
  } else {
    bodyGrad = ctx.createLinearGradient(x, y, x + w, y);
  }
  bodyGrad.addColorStop(0, '#FF6B35');
  bodyGrad.addColorStop(0.3, '#FF8C5A');
  bodyGrad.addColorStop(0.7, '#E8552A');
  bodyGrad.addColorStop(1, '#C44420');

  ctx.shadowColor = 'rgba(200,60,20,0.35)';
  ctx.shadowBlur = 6 * S;
  ctx.shadowOffsetY = 2 * S;
  ctx.fillStyle = bodyGrad;

  var r = 6 * S;
  var nr = 1 * S;
  ctx.beginPath();
  if (dir === 'right') {
    var rl = role === 0 ? r : nr, rr = role === 1 ? r : nr;
    ctx.moveTo(x + rl, y); ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr); ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h); ctx.lineTo(x + rl, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rl); ctx.lineTo(x, y + rl);
    ctx.quadraticCurveTo(x, y, x + rl, y);
  } else if (dir === 'left') {
    var rl = role === 1 ? r : nr, rr = role === 0 ? r : nr;
    ctx.moveTo(x + rl, y); ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr); ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h); ctx.lineTo(x + rl, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rl); ctx.lineTo(x, y + rl);
    ctx.quadraticCurveTo(x, y, x + rl, y);
  } else if (dir === 'down') {
    var rt = role === 0 ? r : nr, rb = role === 1 ? r : nr;
    ctx.moveTo(x + rt, y); ctx.lineTo(x + w - rt, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rt); ctx.lineTo(x + w, y + h - rb);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rb, y + h); ctx.lineTo(x + rb, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rb); ctx.lineTo(x, y + rt);
    ctx.quadraticCurveTo(x, y, x + rt, y);
  } else {
    var rt = role === 1 ? r : nr, rb = role === 0 ? r : nr;
    ctx.moveTo(x + rt, y); ctx.lineTo(x + w - rt, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rt); ctx.lineTo(x + w, y + h - rb);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rb, y + h); ctx.lineTo(x + rb, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rb); ctx.lineTo(x, y + rt);
    ctx.quadraticCurveTo(x, y, x + rt, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  // Metallic stripe
  ctx.save();
  ctx.beginPath();
  if (dir === 'left' || dir === 'right') {
    var stripeY = y + h * 0.42, stripeH = h * 0.16;
    ctx.rect(x, stripeY, w, stripeH); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(x, stripeY, w, stripeH);
  } else {
    var stripeX = x + w * 0.42, stripeW = w * 0.16;
    ctx.rect(stripeX, y, stripeW, h); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(stripeX, y, stripeW, h);
  }
  ctx.restore();

  // Nose cone
  if (role === 1) {
    ctx.fillStyle = '#FFD700'; ctx.globalAlpha = 0.85;
    var noseSize = Math.min(w, h) * 0.22;
    var ncx = x + w / 2, ncy = y + h / 2;
    if (dir === 'right') ncx = x + w - noseSize * 0.5;
    else if (dir === 'left') ncx = x + noseSize * 0.5;
    else if (dir === 'down') ncy = y + h - noseSize * 0.5;
    else ncy = y + noseSize * 0.5;
    ctx.beginPath(); ctx.arc(ncx, ncy, noseSize, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Engine flame (back core, not launched)
  if (role === 0 && !activated) {
    var flameAlpha = 0.5 + Math.sin(tick * 0.15) * 0.2;
    ctx.globalAlpha = flameAlpha;
    var fs = Math.min(w, h) * 0.18;
    var flameOffset = fs * (0.8 + Math.sin(tick * 0.2) * 0.3);
    var fcx = x + w / 2, fcy = y + h / 2;
    if (dir === 'right') fcx = x - flameOffset * 0.3;
    else if (dir === 'left') fcx = x + w + flameOffset * 0.3;
    else if (dir === 'down') fcy = y - flameOffset * 0.3;
    else fcy = y + h + flameOffset * 0.3;
    ctx.fillStyle = '#FF6B35';
    ctx.beginPath(); ctx.arc(fcx, fcy, fs * 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.arc(fcx, fcy, fs * 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Direction arrow
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = 'bold ' + (Math.min(w, h) * 0.3) + 'px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(ROCKET_DIR_ARROWS[dir] || '\u25B6', x + w / 2, y + h / 2);

  ctx.strokeStyle = 'rgba(180,60,20,0.5)'; ctx.lineWidth = 1.5 * S;
  ctx.stroke();
  ctx.restore();
}

// ── Draw flying projectiles ──
function drawRocketProjectiles() {
  for (var i = 0; i < rocketProjectiles.length; i++) {
    var rp = rocketProjectiles[i];
    var size = L.bw * 0.35;
    ctx.save();
    ctx.translate(rp.x, rp.y);
    var angle = 0;
    if (rp.dx > 0) angle = 0;
    else if (rp.dx < 0) angle = Math.PI;
    else if (rp.dy > 0) angle = Math.PI / 2;
    else angle = -Math.PI / 2;
    ctx.rotate(angle);
    ctx.fillStyle = '#FF6B35';
    ctx.shadowColor = 'rgba(255,100,30,0.6)'; ctx.shadowBlur = 10 * S;
    ctx.beginPath(); ctx.ellipse(0, 0, size, size * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFD700'; ctx.shadowColor = 'transparent';
    ctx.beginPath(); ctx.arc(size * 0.6, 0, size * 0.25, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.6; ctx.fillStyle = '#FF8C5A';
    for (var p = 0; p < 3; p++) {
      var trailOff = -(size * 0.8 + p * size * 0.4 + Math.random() * size * 0.2);
      var trailR = size * (0.3 - p * 0.08);
      ctx.beginPath();
      ctx.arc(trailOff, (Math.random() - 0.5) * size * 0.3, Math.max(1, trailR), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ── Activate a rocket by its rocketId ──
function activateRocket(rocketId) {
  var coreIndices = [];
  for (var i = 0; i < stock.length; i++) {
    if (stock[i].rocketId === rocketId && stock[i].isRocketCore && !stock[i].rocketLaunched) {
      coreIndices.push(i);
    }
  }
  if (coreIndices.length === 0) return;

  var dir = null;
  for (var ci = 0; ci < coreIndices.length; ci++) {
    var core = stock[coreIndices[ci]];
    if (!dir) dir = core.rocketDir;
    core.rocketLaunched = true;
    core.rocketLaunchT = 1.0;
    var bx = core.x + L.bw / 2, by = core.y + L.bh / 2;
    spawnBurst(bx, by, '#FF6B35', 15);
    sfx.pop();
  }
  if (!dir) return;

  var d = ROCKET_DIR_DELTA[dir];
  var noseIdx = coreIndices.length > 1 ? coreIndices[1] : coreIndices[0];
  var noseB = stock[noseIdx];
  var startX = noseB.x + L.bw / 2, startY = noseB.y + L.bh / 2;
  var cellW = L.bw + L.bg, cellH = L.bh + L.bg;
  var speed = 8 * S;

  rocketProjectiles.push({
    x: startX + d.dc * cellW * 0.5,
    y: startY + d.dr * cellH * 0.5,
    dx: d.dc * speed, dy: d.dr * speed,
    rocketId: rocketId,
    lastCheckedRow: Math.floor(noseIdx / L.cols),
    lastCheckedCol: noseIdx % L.cols,
    life: 1.0
  });
}

// ── Update rockets (called each tick) ──
function updateRockets() {
  // Process activation queue
  for (var q = rocketActivationQueue.length - 1; q >= 0; q--) {
    rocketActivationQueue[q].delay--;
    if (rocketActivationQueue[q].delay <= 0) {
      activateRocket(rocketActivationQueue[q].rocketId);
      rocketActivationQueue.splice(q, 1);
    }
  }

  // Poll trigger cells. Fire when isCellTrulyEmpty.
  for (var idx in rocketTriggerCells) {
    var info = rocketTriggerCells[idx];
    if (info.activated) continue;
    if (!isCellTrulyEmpty(parseInt(idx))) continue;
    info.activated = true;
    rocketActivationQueue.push({ rocketId: info.rocketId, delay: 15 });
  }

  // Animate core launches
  for (var i = 0; i < stock.length; i++) {
    var b = stock[i];
    if (!b.isRocketCore) continue;
    if (b.rocketLaunchT > 0) {
      b.rocketLaunchT = Math.max(0, b.rocketLaunchT - ROCKET_LAUNCH_SPEED);
      if (b.rocketLaunchT <= 0) rocketConvertCore(i);
    }
  }

  // Update projectiles
  for (var i = rocketProjectiles.length - 1; i >= 0; i--) {
    var rp = rocketProjectiles[i];
    rp.x += rp.dx; rp.y += rp.dy; rp.life -= 0.015;

    if (tick % 2 === 0) {
      particles.push({
        x: rp.x - rp.dx * 2, y: rp.y - rp.dy * 2,
        vx: (Math.random() - 0.5) * 2 * S, vy: (Math.random() - 0.5) * 2 * S,
        r: (3 + Math.random() * 3) * S,
        color: Math.random() > 0.5 ? '#FF6B35' : '#FFD700',
        life: 0.5, decay: 0.04, grav: false
      });
    }

    var cellW = L.bw + L.bg, cellH = L.bh + L.bg;
    var curCol = Math.round((rp.x - L.sx - L.bw / 2) / cellW);
    var curRow = Math.round((rp.y - L.sy - L.bh / 2) / cellH);

    if (curCol !== rp.lastCheckedCol || curRow !== rp.lastCheckedRow) {
      rp.lastCheckedCol = curCol; rp.lastCheckedRow = curRow;
      if (curRow >= 0 && curRow < L.rows && curCol >= 0 && curCol < L.cols) {
        var cellIdx = curRow * L.cols + curCol;
        var cellB = stock[cellIdx];
        if (cellB && cellB.isRocketCore && cellB.rocketId !== rp.rocketId) {
          var alreadyQueued = false;
          for (var q = 0; q < rocketActivationQueue.length; q++) {
            if (rocketActivationQueue[q].rocketId === cellB.rocketId) { alreadyQueued = true; break; }
          }
          var alreadyLaunched = true;
          for (var si = 0; si < stock.length; si++) {
            if (stock[si].rocketId === cellB.rocketId && stock[si].isRocketCore && !stock[si].rocketLaunched) {
              alreadyLaunched = false; break;
            }
          }
          if (!alreadyQueued && !alreadyLaunched) {
            rocketActivationQueue.push({ rocketId: cellB.rocketId, delay: 8 });
            spawnBurst(rp.x, rp.y, '#FFD700', 20);
            spawnConfetti(rp.x, rp.y, 10);
            sfx.complete();
          }
        }
      }
    }
    if (curRow < -1 || curRow > L.rows || curCol < -1 || curCol > L.cols || rp.life <= 0) {
      rocketProjectiles.splice(i, 1);
    }
  }
}

// ── Convert a core cell to its underlying box ──
function rocketConvertCore(idx) {
  var b = stock[idx];
  if (!b.isRocketCore) return;
  var underCi = b.rocketUnderCi !== undefined ? b.rocketUnderCi : 0;
  var underType = b.rocketUnderType || 'default';
  b.isRocketCore = false;
  b.ci = underCi;
  b.boxType = underType;
  b.remaining = MRB_PER_BOX;
  b.revealed = true;
  b.revealT = 1.0;
  b.empty = false;
  b.used = false;
  b.spawning = false;
  b.spawnIdx = 0;
  b.iceHP = (underType === 'ice') ? 2 : 0;
  b.iceCrackT = 0; b.iceShatterT = 0;
  b.blockerCount = (underType === 'blocker') ? BLOCKER_PER_BOX : 0;
  b.packColors = null;
  b.isTunnel = false; b.isWall = false;
  var bx = b.x + L.bw / 2, by = b.y + L.bh / 2;
  spawnBurst(bx, by, COLORS[underCi].fill, 12);
  sfx.pop();
}
