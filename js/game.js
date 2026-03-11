// ============================================================
// game.js — Game init, update loop, input, level select
//           + Tunnel spawning integration
//           + Wall cell support
//           + Pack box support
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
      for (var j = 0; j < 3; j++) stars += (j < s ? '\u2B50' : '\u2606');
      btn.innerHTML = '<span class="lb-num">' + (i + 1) + '</span><span class="lb-stars">' + stars + '</span>';
      btn.setAttribute('data-idx', i);
      btn.addEventListener('click', function () { startLevel(parseInt(this.getAttribute('data-idx'))); });
    } else {
      btn.innerHTML = '<span class="lb-lock">\uD83D\uDD12</span>';
    }
    grid.appendChild(btn);
  }
}

function showLevelSelect() {
  gameActive = false;
  editorCleanupTest();
  document.getElementById('win-screen').classList.remove('show');
  document.getElementById('level-screen').classList.remove('hidden');
  document.getElementById('cal-toggle').style.display = 'none';
  hideEditor();
  buildLevelGrid();
}

function goNextLevel() {
  document.getElementById('win-screen').classList.remove('show');
  if (currentLevel + 1 < LEVELS.length) startLevel(currentLevel + 1);
  else showLevelSelect();
}

// === START LEVEL ===
function startLevel(idx) {
  editorCleanupTest();
  currentLevel = idx;
  var lvl = LEVELS[idx];
  document.getElementById('level-screen').classList.add('hidden');
  document.getElementById('cal-toggle').style.display = 'block';
  MRB_PER_BOX = lvl.mrbPerBox || 9;
  SORT_CAP = lvl.sortCap || 3;
  won = false; tick = 0; physMarbles = []; jumpers = []; particles = []; hoverIdx = -1;
  totalBlockerMarbles = 0;
  blockersOnBelt = 0;
  blockerCollecting = false;
  blockerCollectT = 0;
  blockerCollectSlots = [];
  blockerCollectCleared = false;
  resize();
  initBeltSlots();
  gameActive = true;

  // ── Parse grid ──
  var boxSlots = [], tunnelSlots = [], wallSlots = [];
  if (lvl.grid) {
    for (var g = 0; g < lvl.grid.length; g++) {
      var cell = lvl.grid[g];
      if (!cell) { boxSlots.push(null); tunnelSlots.push(null); wallSlots.push(null); }
      else if (cell.wall) { boxSlots.push(null); tunnelSlots.push(null); wallSlots.push({ wall: true }); }
      else if (cell.tunnel) { boxSlots.push(null); tunnelSlots.push({ dir: cell.dir || 'bottom', contents: cell.contents || [] }); wallSlots.push(null); }
      else if (typeof cell === 'number') { boxSlots.push(cell >= 0 ? { ci: cell, boxType: 'default' } : null); tunnelSlots.push(null); wallSlots.push(null); }
      else { boxSlots.push({ ci: cell.ci, boxType: cell.type || 'default', packColors: cell.packColors || null }); tunnelSlots.push(null); wallSlots.push(null); }
    }
  } else {
    var colorCounts = [0, 0, 0, 0, 0, 0, 0, 0];
    var slots = [];
    for (var c = 0; c < 4; c++) for (var n = 0; n < 6; n++) slots.push(c);
    shuffle(slots);
    for (var g = 0; g < 49; g++) {
      boxSlots.push(slots[g] !== undefined ? { ci: slots[g], boxType: 'default' } : null);
      tunnelSlots.push(null);
      wallSlots.push(null);
    }
  }

  // ── Count marbles per color ──
  var colorMarblesTotal = [];
  for (var c = 0; c < NUM_COLORS; c++) colorMarblesTotal.push(0);

  for (var g = 0; g < boxSlots.length; g++) {
    var slot = boxSlots[g];
    if (!slot) continue;
    // MODIFIED: Handle pack boxes
    var isBlockerBox = (slot.boxType === 'blocker');
    var isPackBox = (slot.boxType === 'pack');
    if (isPackBox && slot.packColors) {
      for (var pc = 0; pc < slot.packColors.length; pc++) {
        colorMarblesTotal[slot.packColors[pc]] += PACK_MARBLES_PER_COLOR;
      }
    } else {
      var regularPerBox = isBlockerBox ? (MRB_PER_BOX - BLOCKER_PER_BOX) : MRB_PER_BOX;
      colorMarblesTotal[slot.ci] += regularPerBox;
    }
    if (isBlockerBox) totalBlockerMarbles += BLOCKER_PER_BOX;
  }

  // Count tunnel contents
  for (var g = 0; g < tunnelSlots.length; g++) {
    var tSlot = tunnelSlots[g];
    if (!tSlot || !tSlot.contents) continue;
    for (var tc = 0; tc < tSlot.contents.length; tc++) {
      var tItem = tSlot.contents[tc];
      // MODIFIED: Handle pack boxes in tunnels
      var isBlockerBox = (tItem.type === 'blocker');
      var isPackBox = (tItem.type === 'pack');
      if (isPackBox && tItem.packColors) {
        for (var pc = 0; pc < tItem.packColors.length; pc++) {
          colorMarblesTotal[tItem.packColors[pc]] += PACK_MARBLES_PER_COLOR;
        }
      } else {
        var regularPerBox = isBlockerBox ? (MRB_PER_BOX - BLOCKER_PER_BOX) : MRB_PER_BOX;
        colorMarblesTotal[tItem.ci] += regularPerBox;
      }
      if (isBlockerBox) totalBlockerMarbles += BLOCKER_PER_BOX;
    }
  }
  var sortPerColor = [];
  for (var c = 0; c < NUM_COLORS; c++) {
    sortPerColor.push(SORT_CAP > 0 ? Math.ceil(colorMarblesTotal[c] / SORT_CAP) : 0);
  }

  // ── Build stock ──
  stock = [];
  for (var r = 0; r < L.rows; r++) for (var c = 0; c < L.cols; c++) {
    var idx = r * L.cols + c;
    var slot = boxSlots[idx];
    var tSlot = tunnelSlots[idx];
    var wSlot = wallSlots[idx];

    if (tSlot) {
      // Tunnel entry
      stock.push({
        isTunnel: true, isWall: false,
        tunnelDir: tSlot.dir,
        tunnelContents: tSlot.contents.map(function (item) { return { ci: item.ci, type: item.type || 'default', packColors: item.packColors || null }; }),
        tunnelTotal: tSlot.contents.length,
        tunnelSpawning: false,
        tunnelCooldown: 60,
        ci: 0, used: false, remaining: 0, spawning: false, spawnIdx: 0,
        revealed: true, empty: false, boxType: 'default',
        iceHP: 0, iceCrackT: 0, iceShatterT: 0, blockerCount: 0,
        packColors: null,
        x: L.sx + c * (L.bw + L.bg), y: L.sy + r * (L.bh + L.bg),
        shakeT: 0, hoverT: 0, popT: 0, revealT: 0, emptyT: 0, idlePhase: 0
      });
    } else if (wSlot) {
      // Wall cell — inert structural element
      stock.push({
        isWall: true, isTunnel: false,
        ci: 0, used: false, remaining: 0, spawning: false, spawnIdx: 0,
        revealed: false, empty: false, boxType: 'default',
        iceHP: 0, iceCrackT: 0, iceShatterT: 0, blockerCount: 0,
        packColors: null,
        x: L.sx + c * (L.bw + L.bg), y: L.sy + r * (L.bh + L.bg),
        shakeT: 0, hoverT: 0, popT: 0, revealT: 0, emptyT: 0, idlePhase: 0
      });
    } else if (!slot) {
      stock.push({ ci: 0, used: false, remaining: 0, spawning: false, spawnIdx: 0,
        revealed: true, empty: true, boxType: 'default', isTunnel: false, isWall: false,
        iceHP: 0, iceCrackT: 0, iceShatterT: 0, blockerCount: 0,
        packColors: null,
        x: L.sx + c * (L.bw + L.bg), y: L.sy + r * (L.bh + L.bg),
        shakeT: 0, hoverT: 0, popT: 0, revealT: 0, emptyT: 0, idlePhase: 0 });
    } else {
      var isIce = (slot.boxType === 'ice');
      var isBlocker = (slot.boxType === 'blocker');
      var isPack = (slot.boxType === 'pack');
      // MODIFIED: Include packColors in stock item
      stock.push({ ci: slot.ci, used: false, remaining: MRB_PER_BOX, spawning: false, spawnIdx: 0,
        revealed: isIce ? true : false, empty: false,
        boxType: slot.boxType || 'default', isTunnel: false, isWall: false,
        iceHP: isIce ? 2 : 0,
        iceCrackT: 0, iceShatterT: 0,
        blockerCount: isBlocker ? BLOCKER_PER_BOX : 0,
        packColors: isPack ? (slot.packColors || [slot.ci, slot.ci, slot.ci]) : null,
        x: L.sx + c * (L.bw + L.bg), y: L.sy + r * (L.bh + L.bg),
        shakeT: 0, hoverT: 0, popT: 0, revealT: 0, emptyT: 0,
        idlePhase: Math.random() * Math.PI * 2 });
    }
  }

  // ── Initial reveal: lowest non-empty box per column ──
  for (var c = 0; c < L.cols; c++) {
    for (var r = L.rows - 1; r >= 0; r--) {
      var b = stock[r * L.cols + c];
      if (!b.empty && !b.isTunnel && !b.isWall) { b.revealed = true; break; }
    }
  }

  // ── Reveal boxes adjacent to initially empty/tunnel cells ──
  var changed = true;
  while (changed) {
    changed = false;
    for (var i = 0; i < stock.length; i++) {
      if (!isCellTrulyEmpty(i)) continue;
      var row2 = Math.floor(i / L.cols), col2 = i % L.cols;
      var nbrs = [];
      if (row2 > 0)          nbrs.push((row2 - 1) * L.cols + col2);
      if (row2 < L.rows - 1) nbrs.push((row2 + 1) * L.cols + col2);
      if (col2 > 0)          nbrs.push(row2 * L.cols + (col2 - 1));
      if (col2 < L.cols - 1) nbrs.push(row2 * L.cols + (col2 + 1));
      for (var ni = 0; ni < nbrs.length; ni++) {
        var nb = stock[nbrs[ni]];
        if (nb.isTunnel || nb.isWall || nb.empty || nb.used || nb.revealed) continue;
        nb.revealed = true;
        changed = true;
      }
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

// === EMPTY-CELL REVEAL ===
function isCellTrulyEmpty(idx) {
  var s = stock[idx];
  if (!s) return false;
  if (s.isWall) return false;
  if (s.isTunnel) {
    if (s.tunnelContents && s.tunnelContents.length > 0) return false;
    var exitIdx = getTunnelExitIdx(idx);
    if (exitIdx >= 0 && stock[exitIdx] && !stock[exitIdx].isTunnel
        && !stock[exitIdx].empty && !stock[exitIdx].used) return false;
    return true;
  }
  if (!s.empty && !s.used) return false;
  for (var i = 0; i < stock.length; i++) {
    if (stock[i].isTunnel && stock[i].tunnelContents && stock[i].tunnelContents.length > 0) {
      if (getTunnelExitIdx(i) === idx) return false;
    }
  }
  return true;
}

var _revealVisited = {};
function revealAroundEmptyCell(idx) {
  if (!isCellTrulyEmpty(idx)) return;
  if (_revealVisited[idx]) return;
  _revealVisited[idx] = true;
  var row = Math.floor(idx / L.cols), col = idx % L.cols;
  var neighbors = [];
  if (row > 0)          neighbors.push((row - 1) * L.cols + col);
  if (row < L.rows - 1) neighbors.push((row + 1) * L.cols + col);
  if (col > 0)          neighbors.push(row * L.cols + (col - 1));
  if (col < L.cols - 1) neighbors.push(row * L.cols + (col + 1));
  for (var ni = 0; ni < neighbors.length; ni++) {
    var nIdx = neighbors[ni];
    var nb = stock[nIdx];
    if (nb.isTunnel) {
      if (isCellTrulyEmpty(nIdx)) revealAroundEmptyCell(nIdx);
      continue;
    }
    if (nb.isWall || nb.empty || nb.used || nb.revealed || nb.spawning) continue;
    nb.revealed = true;
    nb.revealT = 1.0;
    var bx = nb.x + L.bw / 2, by = nb.y + L.bh / 2;
    var burstColor = (nb.boxType === 'hidden') ? '#C89CF2' : COLORS[nb.ci].fill;
    spawnBurst(bx, by, burstColor, 12);
    sfx.pop();
  }
  delete _revealVisited[idx];
}

function damageAdjacentIce(idx) {
  var row = Math.floor(idx / L.cols), col = idx % L.cols;
  var neighbors = [];
  if (row > 0)          neighbors.push((row - 1) * L.cols + col);
  if (row < L.rows - 1) neighbors.push((row + 1) * L.cols + col);
  if (col > 0)          neighbors.push(row * L.cols + (col - 1));
  if (col < L.cols - 1) neighbors.push(row * L.cols + (col + 1));
  for (var ni = 0; ni < neighbors.length; ni++) {
    var nIdx = neighbors[ni];
    var nb = stock[nIdx];
    if (nb.isTunnel || nb.isWall || nb.empty || nb.used) continue;
    if (nb.iceHP > 0) {
      nb.iceHP--;
      nb.iceCrackT = 1;
      var bx = nb.x + L.bw / 2, by = nb.y + L.bh / 2;
      if (nb.iceHP <= 0) {
        nb.iceShatterT = 1;
        for (var p = 0; p < 12; p++) {
          var a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 3;
          particles.push({ x: bx, y: by, vx: Math.cos(a) * sp * S, vy: Math.sin(a) * sp * S - 2 * S,
            r: (3 + Math.random() * 4) * S,
            color: Math.random() > 0.5 ? 'rgba(180,225,255,0.9)' : 'rgba(220,240,255,0.9)',
            life: 1, decay: 0.015 + Math.random() * 0.015, grav: true });
        }
        for (var p = 0; p < 8; p++) {
          var a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2;
          particles.push({ x: bx, y: by, vx: Math.cos(a) * sp * S, vy: Math.sin(a) * sp * S,
            r: (3 + Math.random() * 3) * S, color: 'rgba(255,255,255,0.7)',
            life: 0.6, decay: 0.04, grav: false });
        }
      }
    }
  }
}

function isBoxTappable(idx) {
  var b = stock[idx];
  if (b.isTunnel) return false;
  if (b.isWall) return false;
  if (b.empty || b.used) return false;
  if (b.spawning || b.revealT > 0) return false;
  if (b.iceHP > 0) return false;
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
    if (b.isTunnel || b.isWall) continue;
    if (b.empty || b.used || b.spawning || b.revealT > 0) continue;
    if (px >= b.x && px <= b.x + L.bw && py >= b.y && py <= b.y + L.bh) {
      if (!isBoxTappable(i)) { b.shakeT = 0.5; return; }
      b.popT = 1;
      sfx.pop();
      // MODIFIED: Use pack first color for burst
      var burstCi = (b.boxType === 'pack' && b.packColors) ? b.packColors[0] : b.ci;
      spawnBurst(b.x + L.bw / 2, b.y + L.bh / 2, COLORS[burstCi].fill, 18);
      spawnPhysMarbles(b);
      damageAdjacentIce(i);
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
    if (b.isTunnel || b.isWall) continue;
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

  // ── Tunnel spawning ──
  trySpawnFromTunnels();

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
      if (tv >= 0 && col[tv].ci === j.ci) {
        col[tv].filled++;
        col[tv].squishT = 1;
        sfx.sort();
        if (col[tv].filled >= SORT_CAP) {
          col[tv].popT = 1; col[tv].shineT = 1;
          sfx.complete();
          var bx2 = L.sSx + j.targetCol * (L.sBw + L.sColGap) + L.sBw / 2;
          var by2 = getSortBoxY(j.targetCol, 0) + L.sBh / 2;
          spawnBurst(bx2, by2, COLORS[j.ci].fill, 20);
          spawnConfetti(bx2, by2, 15);
          (function (box) { setTimeout(function () { box.vis = false; checkWin(); }, 600); })(col[tv]);
        }
      }
      jumpers.splice(i, 1);
    }
  }

  // Blocker collection
  if (!blockerCollecting && totalBlockerMarbles > 0) {
    blockersOnBelt = 0;
    blockerCollectSlots = [];
    for (var i = 0; i < BELT_SLOTS; i++) {
      if (beltSlots[i].marble === BLOCKER_CI) { blockersOnBelt++; blockerCollectSlots.push(i); }
    }
    if (blockersOnBelt >= totalBlockerMarbles) {
      blockerCollecting = true; blockerCollectT = 1; blockerCollectCleared = false;
    }
  }
  if (blockerCollecting) {
    blockerCollectT = Math.max(0, blockerCollectT - 0.015);
    if (blockerCollectT <= 0.5 && !blockerCollectCleared) {
      blockerCollectCleared = true;
      for (var k = 0; k < blockerCollectSlots.length; k++) {
        var csi = blockerCollectSlots[k];
        if (beltSlots[csi].marble === BLOCKER_CI) {
          var cpos = getSlotPos(csi);
          beltSlots[csi].marble = -1;
          spawnBurst(cpos.x, cpos.y, COLORS[BLOCKER_CI].light, 10);
          for (var p = 0; p < 3; p++) {
            var a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2;
            particles.push({ x: cpos.x, y: cpos.y,
              vx: (L.beltCx - cpos.x) * 0.03 + Math.cos(a) * sp * S,
              vy: ((L.beltTopY + L.beltBotY) / 2 - cpos.y) * 0.03 + Math.sin(a) * sp * S,
              r: (2 + Math.random() * 3) * S, color: '#fff', life: 0.8, decay: 0.03, grav: false });
          }
        }
      }
      var bcx = L.beltCx, bcy = (L.beltTopY + L.beltBotY) / 2;
      spawnBurst(bcx, bcy, '#A89E94', 20);
      spawnConfetti(bcx, bcy, 25);
      sfx.win();
      blockersOnBelt = 0;
    }
    if (blockerCollectT <= 0) {
      blockerCollecting = false;
      blockerCollectT = 0;
      blockerCollectSlots = [];
    }
  }

  // Stock animations
  for (var i = 0; i < stock.length; i++) {
    var b = stock[i];
    if (b.isTunnel || b.isWall) continue;
    if (b.empty) continue;
    if (b.shakeT > 0) b.shakeT = Math.max(0, b.shakeT - 0.04);
    if (b.popT > 0) b.popT = Math.max(0, b.popT - 0.025);
    if (b.revealT > 0) b.revealT = Math.max(0, b.revealT - 0.03);
    if (b.emptyT > 0) b.emptyT = Math.max(0, b.emptyT - 0.025);
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
  for (var i = 0; i < stock.length; i++) {
    if (stock[i].isTunnel && stock[i].tunnelContents && stock[i].tunnelContents.length > 0) return;
  }
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
    drawBlockerProgress();
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
