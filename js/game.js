// ============================================================
// game.js — Game init, update loop, input, level select
// ============================================================

// === LEVEL SELECT ===
function buildLevelGrid() {
  var grid = document.getElementById('ls-grid');
  grid.innerHTML = '';
  for (var i = 0; i < LEVELS.length; i++) {
    var btn = document.createElement('button');
    btn.className = 'level-btn' + (i >= unlockedLevels ? ' locked' : '');
    btn.style.animationDelay = (i * 0.06) + 's';
    var clr = LEVEL_COLORS[i % LEVEL_COLORS.length];
    btn.style.background = clr.bg;
    btn.style.boxShadow = '0 5px 18px ' + clr.shadow;
    if (i < unlockedLevels) {
      var stars = '', s = levelStars[i];
      for (var j = 0; j < 3; j++) stars += (j < s ? '\u2605' : '\u2606');
      btn.innerHTML = '<span class="lb-num">' + (i + 1) + '</span><span class="lb-stars">' + stars + '</span>';
      (function (idx) { btn.addEventListener('click', function () { startLevel(idx); }); })(i);
    } else {
      btn.innerHTML = '<span class="lb-lock">\uD83D\uDD12</span><span class="lb-num" style="font-size:16px;opacity:0.6">' + (i + 1) + '</span>';
    }
    grid.appendChild(btn);
  }
}

function showLevelSelect() {
  gameActive = false;
  document.getElementById('win-screen').classList.remove('show');
  document.getElementById('cal-toggle').style.display = 'none';
  if (typeof editor !== 'undefined' && editor._testIdx !== undefined) {
    editorCleanupTest();
    showEditor(false);
    return;
  }
  document.getElementById('level-screen').classList.remove('hidden');
  if (typeof editorCleanupTest === 'function') editorCleanupTest();
  buildLevelGrid();
}

function startLevel(idx) {
  currentLevel = idx;
  gameActive = true;
  document.getElementById('level-screen').classList.add('hidden');
  document.getElementById('cal-toggle').style.display = '';
  ensureAudio();
  initGame();
}

function goNextLevel() {
  if (currentLevel + 1 < LEVELS.length) startLevel(currentLevel + 1);
  else showLevelSelect();
}

// === GAME INIT ===
function initGame() {
  won = false; score = 0; particles = []; physMarbles = []; jumpers = []; tick = 0; hoverIdx = -1;
  document.getElementById('win-screen').classList.remove('show');
  computeLayout(); initBeltSlots();

  var totalSlots = L.rows * L.cols;
  var lvl = LEVELS[currentLevel];

  // ── Build boxSlots from grid or legacy random ──
  var boxSlots = {};
  if (lvl.grid) {
    for (var i = 0; i < Math.min(lvl.grid.length, totalSlots); i++) {
      var cell = lvl.grid[i];
      if (cell === null || cell === undefined) continue;
      if (typeof cell === 'number') {
        if (cell >= 0) boxSlots[i] = { ci: cell, boxType: 'default' };
      } else if (typeof cell === 'object' && cell.ci >= 0) {
        boxSlots[i] = { ci: cell.ci, boxType: cell.type || 'default' };
      }
    }
    if (lvl.mrbPerBox) MRB_PER_BOX = lvl.mrbPerBox;
    if (lvl.sortCap) SORT_CAP = lvl.sortCap;
  } else {
    var totalBoxes = 4 * STOCK_PER_CLR;
    var cl = [];
    for (var c = 0; c < 4; c++) for (var n = 0; n < STOCK_PER_CLR; n++) cl.push(c);
    shuffle(cl);
    var slotIndices = [];
    for (var i = 0; i < totalSlots; i++) slotIndices.push(i);
    shuffle(slotIndices);
    for (var i = 0; i < totalBoxes; i++) boxSlots[slotIndices[i]] = { ci: cl[i], boxType: 'default' };
  }

  // ── Count per color for sort columns ──
  var colorCounts = [];
  for (var c = 0; c < NUM_COLORS; c++) colorCounts.push(0);
  for (var k in boxSlots) colorCounts[boxSlots[k].ci]++;
  var sortPerColor = [];
  for (var c = 0; c < NUM_COLORS; c++) {
    var totalMrb = colorCounts[c] * MRB_PER_BOX;
    sortPerColor.push(SORT_CAP > 0 ? Math.ceil(totalMrb / SORT_CAP) : 0);
  }

  // ── Build stock ──
  stock = [];
  for (var r = 0; r < L.rows; r++) for (var c = 0; c < L.cols; c++) {
    var idx = r * L.cols + c;
    var slot = boxSlots[idx];
    if (!slot) {
      stock.push({ ci: 0, used: false, remaining: 0, spawning: false, spawnIdx: 0,
        revealed: true, empty: true, boxType: 'default',
        iceHP: 0, iceCrackT: 0, iceShatterT: 0,
        x: L.sx + c * (L.bw + L.bg), y: L.sy + r * (L.bh + L.bg),
        shakeT: 0, hoverT: 0, popT: 0, revealT: 0, emptyT: 0, idlePhase: 0 });
    } else {
      var isIce = (slot.boxType === 'ice');
      stock.push({ ci: slot.ci, used: false, remaining: MRB_PER_BOX, spawning: false, spawnIdx: 0,
        revealed: isIce ? true : false, empty: false,
        boxType: slot.boxType || 'default',
        iceHP: isIce ? 2 : 0,
        iceCrackT: 0,     // animation timer for crack effect
        iceShatterT: 0,   // animation timer for final shatter
        x: L.sx + c * (L.bw + L.bg), y: L.sy + r * (L.bh + L.bg),
        shakeT: 0, hoverT: 0, popT: 0, revealT: 0, emptyT: 0,
        idlePhase: Math.random() * Math.PI * 2 });
    }
  }

  // ── Initial reveal: lowest non-empty box per column ──
  for (var c = 0; c < L.cols; c++) {
    for (var r = L.rows - 1; r >= 0; r--) {
      var b = stock[r * L.cols + c];
      if (!b.empty) { b.revealed = true; break; }
    }
  }

  // ── Sort columns ──
  var allBoxes = [];
  for (var c = 0; c < NUM_COLORS; c++) for (var r = 0; r < sortPerColor[c]; r++)
    allBoxes.push({ ci: c, filled: 0, popT: 0, vis: true, shineT: 0, squishT: 0 });
  shuffle(allBoxes);
  sortCols = [[], [], [], []];
  for (var i = 0; i < allBoxes.length; i++) sortCols[i % 4].push(allBoxes[i]);

  // Lock buttons
  var numLocks = lvl.lockButtons || 0;
  for (var li2 = 0; li2 < numLocks; li2++) {
    var lockCol = Math.floor(Math.random() * 4);
    var lockRow = Math.min(2 + Math.floor(Math.random() * 4), sortCols[lockCol].length);
    sortCols[lockCol].splice(lockRow, 0, { type: 'lock', ci: -1, filled: 0, popT: 0, vis: true, shineT: 0, squishT: 0, triggerT: 0, triggered: false });
  }
}

// === ADJACENCY REVEAL ===
function revealAdjacentBoxes(idx) {
  var row = Math.floor(idx / L.cols), col = idx % L.cols;
  var neighbors = [];
  if (row > 0)          neighbors.push((row - 1) * L.cols + col);
  if (row < L.rows - 1) neighbors.push((row + 1) * L.cols + col);
  if (col > 0)          neighbors.push(row * L.cols + (col - 1));
  if (col < L.cols - 1) neighbors.push(row * L.cols + (col + 1));
  for (var ni = 0; ni < neighbors.length; ni++) {
    var nb = stock[neighbors[ni]];
    if (nb.empty || nb.used || nb.revealed || nb.spawning) continue;
    nb.revealed = true;
    nb.revealT = 1.0;
    var bx = nb.x + L.bw / 2, by = nb.y + L.bh / 2;
    var burstColor = (nb.boxType === 'hidden') ? '#FFD700' : COLORS[nb.ci].fill;
    for (var p = 0; p < 12; p++) {
      var a = Math.PI * 2 * p / 12 + Math.random() * 0.3, sp = 3 + Math.random() * 4;
      particles.push({ x: bx, y: by, vx: Math.cos(a) * sp * S, vy: Math.sin(a) * sp * S,
        r: (2 + Math.random() * 4) * S, color: burstColor, life: 1, decay: 0.02 + Math.random() * 0.015, grav: false });
    }
    sfx.pop();
  }
}

// === ICE DAMAGE ===
function damageAdjacentIce(idx) {
  var row = Math.floor(idx / L.cols), col = idx % L.cols;
  var neighbors = [];
  if (row > 0)          neighbors.push((row - 1) * L.cols + col);
  if (row < L.rows - 1) neighbors.push((row + 1) * L.cols + col);
  if (col > 0)          neighbors.push(row * L.cols + (col - 1));
  if (col < L.cols - 1) neighbors.push(row * L.cols + (col + 1));
  for (var ni = 0; ni < neighbors.length; ni++) {
    var nb = stock[neighbors[ni]];
    if (nb.empty || nb.used || nb.iceHP <= 0) continue;

    nb.iceHP--;
    var bx = nb.x + L.bw / 2, by = nb.y + L.bh / 2;

    if (nb.iceHP === 1) {
      // ── Ice cracked ──
      nb.iceCrackT = 1.0;
      nb.shakeT = 0.4;
      sfx.pop();
      // Ice shard particles
      for (var p = 0; p < 10; p++) {
        var a = Math.PI * 2 * p / 10 + Math.random() * 0.4, sp = 2 + Math.random() * 3;
        particles.push({ x: bx, y: by, vx: Math.cos(a) * sp * S, vy: Math.sin(a) * sp * S,
          r: (1.5 + Math.random() * 3) * S, color: 'rgba(180,225,255,0.8)',
          life: 0.8, decay: 0.03 + Math.random() * 0.02, grav: false });
      }
    } else if (nb.iceHP === 0) {
      // ── Ice shattered — box is now free! ──
      nb.iceShatterT = 1.0;
      nb.popT = 0.8;
      nb.boxType = 'default';  // becomes a normal box
      sfx.complete();
      // Big shatter burst — icy particles
      for (var p = 0; p < 20; p++) {
        var a = Math.PI * 2 * p / 20 + Math.random() * 0.3, sp = 3 + Math.random() * 5;
        particles.push({ x: bx, y: by, vx: Math.cos(a) * sp * S, vy: Math.sin(a) * sp * S - 2 * S,
          r: (2 + Math.random() * 4) * S,
          color: Math.random() > 0.5 ? 'rgba(180,225,255,0.9)' : 'rgba(220,240,255,0.9)',
          life: 1, decay: 0.015 + Math.random() * 0.015, grav: true });
      }
      // White flash particles
      for (var p = 0; p < 8; p++) {
        var a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2;
        particles.push({ x: bx, y: by, vx: Math.cos(a) * sp * S, vy: Math.sin(a) * sp * S,
          r: (3 + Math.random() * 3) * S, color: 'rgba(255,255,255,0.7)',
          life: 0.6, decay: 0.04, grav: false });
      }
    }
  }
}

function isBoxTappable(idx) {
  var b = stock[idx];
  if (b.empty || b.used) return false;
  if (b.spawning || b.revealT > 0) return false;
  if (b.iceHP > 0) return false;  // ← frozen boxes cannot be tapped
  return b.revealed;
}

function getSortBoxY(ci, vi) { return L.sTop + vi * (L.sBh + L.sGap); }

// === INPUT ===
function handleTap(px, py) {
  if (won || !gameActive) return;
  ensureAudio();
  if (px >= L.bkX && px <= L.bkX + L.bkSize && py >= L.bkY && py <= L.bkY + L.bkSize) { showLevelSelect(); return; }
  for (var i = 0; i < stock.length; i++) {
    var b = stock[i];
    if (b.empty || b.used || b.spawning || b.revealT > 0) continue;
    if (px >= b.x && px <= b.x + L.bw && py >= b.y && py <= b.y + L.bh) {
      if (!isBoxTappable(i)) { b.shakeT = 0.5; return; }
      b.popT = 1;
      sfx.pop();
      spawnBurst(b.x + L.bw / 2, b.y + L.bh / 2, COLORS[b.ci].fill, 18);
      spawnPhysMarbles(b);
      revealAdjacentBoxes(i);
      damageAdjacentIce(i);   // ← damage ice on neighboring boxes
      return;
    }
  }
}
canvas.addEventListener('click', function (e) { handleTap(e.clientX, e.clientY); });
canvas.addEventListener('touchstart', function (e) { e.preventDefault(); handleTap(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
document.getElementById('cal-panel').addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: false });
canvas.addEventListener('mousemove', function (e) {
  hoverIdx = -1;
  if (!gameActive) return;
  if (e.clientX >= L.bkX && e.clientX <= L.bkX + L.bkSize && e.clientY >= L.bkY && e.clientY <= L.bkY + L.bkSize) { canvas.style.cursor = 'pointer'; return; }
  for (var i = 0; i < stock.length; i++) {
    var b = stock[i];
    if (b.empty || b.used || b.spawning || b.revealT > 0) continue;
    if (!isBoxTappable(i)) continue;
    if (e.clientX >= b.x && e.clientX <= b.x + L.bw && e.clientY >= b.y && e.clientY <= b.y + L.bh) { hoverIdx = i; break; }
  }
  canvas.style.cursor = hoverIdx >= 0 ? 'pointer' : 'default';
});

// === UPDATE ===
function update() {
  if (!gameActive) return;
  tick++;
  physicsStep();

  beltOffset = (beltOffset + BELT_SPEED * S) % 1;
  for (var i = 0; i < BELT_SLOTS; i++) {
    if (beltSlots[i].arriveAnim > 0) beltSlots[i].arriveAnim = Math.max(0, beltSlots[i].arriveAnim - 0.025);
  }

  // Belt → sort matching
  for (var si = 0; si < BELT_SLOTS; si++) {
    var slot = beltSlots[si]; if (slot.marble < 0) continue;
    var slotT = getSlotT(si);
    for (var c = 0; c < 4; c++) {
      var col = sortCols[c]; var tv = -1;
      for (var r = 0; r < col.length; r++) { if (col[r].vis) { tv = r; break; } }
      if (tv < 0 || col[tv].ci !== slot.marble) continue;
      var inFlight = 0;
      for (var j = 0; j < jumpers.length; j++) if (jumpers[j].targetCol === c) inFlight++;
      if (col[tv].filled + inFlight >= SORT_CAP) continue;
      var bt = L.sortBeltT[c]; var diff = Math.abs(slotT - bt); var wdiff = Math.min(diff, 1 - diff);
      if (wdiff < 0.015) {
        var aj = false;
        for (var j = 0; j < jumpers.length; j++) if (jumpers[j].slotIdx === si) { aj = true; break; }
        if (aj) continue;
        var pos = getSlotPos(si);
        jumpers.push({ ci: slot.marble, slotIdx: si, startX: pos.x, startY: pos.y, targetCol: c, targetSlot: col[tv].filled + inFlight, t: 0 });
        slot.marble = -1; break;
      }
    }
  }

  // Jumper animation
  for (var i = jumpers.length - 1; i >= 0; i--) {
    var j = jumpers[i]; j.t += 0.04;
    if (j.t >= 1) {
      var col = sortCols[j.targetCol]; var tv = -1;
      for (var r = 0; r < col.length; r++) { if (col[r].vis) { tv = r; break; } }
      if (tv >= 0 && col[tv].ci === j.ci && col[tv].filled < SORT_CAP) {
        col[tv].filled++; col[tv].shineT = 1; col[tv].squishT = 1; score += 10;
        var sx2 = L.sSx + j.targetCol * (L.sBw + L.sColGap) + L.sBw / 2 + (j.targetSlot - 1) * (L.sBw / 4);
        var sy2 = getSortBoxY(j.targetCol, 0) + L.sBh / 2;
        spawnBurst(sx2, sy2, COLORS[j.ci].fill, 8); sfx.sort();
        if (col[tv].filled >= SORT_CAP) {
          var cx2 = L.sSx + j.targetCol * (L.sBw + L.sColGap) + L.sBw / 2;
          col[tv].popT = 1; score += 50; sfx.complete();
          spawnBurst(cx2, sy2, COLORS[j.ci].fill, 28);
          spawnConfetti(cx2, sy2, 20);
          (function (rc, rt) { setTimeout(function () { rc[rt].vis = false; checkWin(); }, 400); })(col, tv);
        }
      }
      jumpers.splice(i, 1); continue;
    }
  }

  // Stock animations
  for (var i = 0; i < stock.length; i++) {
    var b = stock[i];
    if (b.empty) continue;
    if (b.shakeT > 0) b.shakeT = Math.max(0, b.shakeT - 0.04);
    if (b.popT > 0) b.popT = Math.max(0, b.popT - 0.025);
    if (b.revealT > 0) b.revealT = Math.max(0, b.revealT - 0.03);
    if (b.emptyT > 0) b.emptyT = Math.max(0, b.emptyT - 0.025);
    // Ice animation timers
    if (b.iceCrackT > 0) b.iceCrackT = Math.max(0, b.iceCrackT - 0.03);
    if (b.iceShatterT > 0) b.iceShatterT = Math.max(0, b.iceShatterT - 0.025);
    var th = (i === hoverIdx && !b.used && isBoxTappable(i)) ? 1 : 0;
    b.hoverT += (th - b.hoverT) * 0.12;
  }

  // Phys marble spawn bounce
  for (var i = 0; i < physMarbles.length; i++) {
    if (physMarbles[i].spawnT > 0) physMarbles[i].spawnT = Math.max(0, physMarbles[i].spawnT - 0.05);
  }

  // Sort box animations
  for (var c = 0; c < sortCols.length; c++) {
    var col = sortCols[c];
    for (var r = 0; r < col.length; r++) {
      if (col[r].popT > 0) col[r].popT = Math.max(0, col[r].popT - 0.018);
      if (col[r].shineT > 0) col[r].shineT = Math.max(0, col[r].shineT - 0.025);
      if (col[r].squishT > 0) col[r].squishT = Math.max(0, col[r].squishT - 0.06);
    }
  }

  // Lock button trigger
  for (var c = 0; c < sortCols.length; c++) {
    var col = sortCols[c]; var topVis = -1;
    for (var r = 0; r < col.length; r++) if (col[r].vis) { topVis = r; break; }
    if (topVis < 0) continue;
    var box = col[topVis];
    if (box.type === 'lock' && !box.triggered) {
      box.triggered = true; box.triggerT = 1.0; box.shineT = 1;
      sfx.complete();
      var bx = L.sSx + c * (L.sBw + L.sColGap) + L.sBw / 2;
      var by = getSortBoxY(c, 0) + L.sBh / 2;
      spawnBurst(bx, by, '#FFD700', 20); spawnConfetti(bx, by, 15);
      (function (boxRef) {
        setTimeout(function () { boxRef.popT = 1; }, 300);
        setTimeout(function () { boxRef.vis = false; checkWin(); }, 700);
      })(box);
    }
    if (box.type === 'lock' && box.triggerT > 0) box.triggerT = Math.max(0, box.triggerT - 0.03);
  }

  tickParticles();
  updateRollingSound();
}

function checkWin() {
  for (var c = 0; c < sortCols.length; c++)
    for (var r = 0; r < sortCols[c].length; r++)
      if (sortCols[c][r].vis) return;
  if (!won) {
    won = true; sfx.win();
    levelStars[currentLevel] = 3;
    if (currentLevel + 1 < LEVELS.length && unlockedLevels <= currentLevel + 1) unlockedLevels = currentLevel + 2;
    document.getElementById('win-msg').textContent = 'Level ' + (currentLevel + 1) + ' complete!';
    spawnConfetti(W / 2, H / 3, 60);
    setTimeout(function () { spawnConfetti(W * 0.3, H / 2, 40); }, 200);
    setTimeout(function () { spawnConfetti(W * 0.7, H / 2, 40); }, 400);
    setTimeout(function () { spawnConfetti(W / 2, H / 4, 50); }, 600);
    setTimeout(function () { spawnConfetti(W / 2, H / 2, 80); }, 800);
    setTimeout(function () { document.getElementById('win-screen').classList.add('show'); }, 2000);
  }
}

// === MAIN LOOP ===
function frame() {
  if (gameActive) {
    update();
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawFunnel();
    drawStock();
    drawPhysMarbles();
    drawBelt();
    drawJumpers();
    drawSortArea();
    drawBackButton();
    drawParticles();
    drawDebugWalls();
  }
  requestAnimationFrame(frame);
}

// === BOOT ===
resize();
showLevelSelect();
frame();
