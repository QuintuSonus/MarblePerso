// ============================================================
// box_magnet.js — Magnet box type
// A utility box that attracts and captures marbles from the funnel.
// Tap to activate (starts capturing). Tap again to deactivate
// (releases all captured marbles back into the funnel).
// Capacity: 9 marbles.
// ============================================================

var MAGNET_CAPACITY = 9;
var MAGNET_CAPTURE_INTERVAL = 10; // frames between captures

registerBoxType('magnet', {
  label: 'Magnet',
  editorColor: '#E74C3C',

  drawClosed: function (ctx, x, y, w, h, ci, S, tick, idlePhase, stockItem) {
    ctx.save();

    // Dark metallic base
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = 4 * S;
    ctx.shadowOffsetY = 2 * S;
    var grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#A93226');
    grad.addColorStop(1, '#7B241C');
    ctx.fillStyle = grad;
    rRect(x, y, w, h, 6 * S);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Color tint
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = COLORS[ci].fill;
    rRect(x, y, w, h, 6 * S);
    ctx.fill();

    // Border
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = '#7B241C';
    ctx.lineWidth = 1.5 * S;
    rRect(x, y, w, h, 6 * S);
    ctx.stroke();

    // Magnet symbol
    ctx.globalAlpha = 0.35;
    drawMagnetSymbol(ctx, x + w / 2, y + h / 2, Math.min(w, h) * 0.6, S);

    // Lock icon
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + (h * 0.18) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\uD83D\uDD12', x + w * 0.85, y + h * 0.15);

    ctx.restore();
  },

  drawReveal: function (ctx, x, y, w, h, ci, S, phase, remaining, tick, stockItem) {
    var popScale = 1 + Math.sin(phase * Math.PI) * 0.1;
    ctx.save();
    ctx.scale(popScale, popScale);

    if (phase < 0.5) {
      ctx.globalAlpha = 1 - phase * 2;
      this.drawClosed(ctx, x, y, w, h, ci, S, tick, 0, stockItem);
      ctx.globalAlpha = phase * 2;
    }

    drawMagnetBoxOpen(ctx, x, y, w, h, S, tick, stockItem, false);

    ctx.restore();
  },

  editorCellStyle: function (ci, gridItem) {
    return {
      background: 'linear-gradient(135deg, #E74C3C, #A93226)',
      borderColor: '#7B241C'
    };
  },

  editorCellHTML: function (ci, gridItem) {
    return '<span class="ed-cell-dot" style="font-size:10px;color:#fff;font-weight:bold">M</span>';
  }
});

// ── Draw a U-shaped magnet symbol ──
function drawMagnetSymbol(ctx, cx, cy, size, S) {
  ctx.save();
  ctx.translate(cx, cy);

  var r = size * 0.3;
  var armW = size * 0.18;
  var armH = size * 0.3;

  ctx.lineWidth = armW;
  ctx.lineCap = 'butt';

  // U-shape arc
  ctx.strokeStyle = '#C0392B';
  ctx.beginPath();
  ctx.arc(0, armH * 0.2, r, 0, Math.PI, false);
  ctx.stroke();

  // Left arm
  ctx.strokeStyle = '#E74C3C';
  ctx.beginPath();
  ctx.moveTo(-r, armH * 0.2);
  ctx.lineTo(-r, -armH);
  ctx.stroke();

  // Right arm
  ctx.strokeStyle = '#3498DB';
  ctx.beginPath();
  ctx.moveTo(r, armH * 0.2);
  ctx.lineTo(r, -armH);
  ctx.stroke();

  // Tips
  ctx.fillStyle = '#E74C3C';
  ctx.fillRect(-r - armW / 2, -armH - armW * 0.3, armW, armW * 0.6);
  ctx.fillStyle = '#3498DB';
  ctx.fillRect(r - armW / 2, -armH - armW * 0.3, armW, armW * 0.6);

  ctx.restore();
}

// ── Draw magnet box in open/revealed state ──
function drawMagnetBoxOpen(ctx, x, y, w, h, S, tick, stockItem, isActive) {
  ctx.save();

  // Active glow
  if (isActive) {
    var glowAlpha = 0.2 + Math.sin(tick * 0.08) * 0.1;
    ctx.shadowColor = 'rgba(231,76,60,' + glowAlpha + ')';
    ctx.shadowBlur = 15 * S;
  } else {
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 5 * S;
    ctx.shadowOffsetY = 2 * S;
  }

  // Box body
  var grad = ctx.createLinearGradient(x, y, x, y + h);
  if (isActive) {
    grad.addColorStop(0, '#E74C3C');
    grad.addColorStop(0.5, '#C0392B');
    grad.addColorStop(1, '#A93226');
  } else {
    grad.addColorStop(0, '#D4534A');
    grad.addColorStop(0.5, '#B03A32');
    grad.addColorStop(1, '#8C2E27');
  }
  ctx.fillStyle = grad;
  rRect(x, y, w, h, 6 * S);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Border
  ctx.strokeStyle = isActive ? '#E74C3C' : '#7B241C';
  ctx.lineWidth = (isActive ? 2 : 1.5) * S;
  rRect(x, y, w, h, 6 * S);
  ctx.stroke();

  // Active pulse ring
  if (isActive) {
    var pulsePhase = (tick * 0.05) % 1;
    var pulseR = 1 + pulsePhase * 0.3;
    var pulseAlpha = 0.3 * (1 - pulsePhase);
    ctx.globalAlpha = pulseAlpha;
    ctx.strokeStyle = '#E74C3C';
    ctx.lineWidth = 2 * S;
    rRect(x - 3 * S * pulseR, y - 3 * S * pulseR, w + 6 * S * pulseR, h + 6 * S * pulseR, 8 * S);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Magnet symbol at top
  var symbolSize = Math.min(w, h) * 0.3;
  var hasMarbles = stockItem && stockItem.magnetMarbles && stockItem.magnetMarbles.length > 0;
  var symbolY = hasMarbles ? y + h * 0.18 : y + h * 0.35;
  ctx.globalAlpha = isActive ? 0.7 : 0.4;
  drawMagnetSymbol(ctx, x + w / 2, symbolY, symbolSize, S);
  ctx.globalAlpha = 1;

  // Draw captured marbles in 3x3 grid
  if (hasMarbles) {
    var marblesArr = stockItem.magnetMarbles;
    var count = marblesArr.length;
    var mr = Math.min(5 * S, w / 10);
    var mg = Math.min(10 * S, w / 5);
    var mgY = mg * 0.85;
    var mCenterY = y + h * 0.58;

    for (var mi = 0; mi < count; mi++) {
      var row = Math.floor(mi / 3);
      var col = mi % 3;
      var mx = x + w / 2 + (col - 1) * mg;
      var my = mCenterY + (row - 1) * mgY;
      drawMarble(mx, my, mr, marblesArr[mi].ci);
    }
  }

  // Capacity text
  var capturedCount = (stockItem && stockItem.magnetMarbles) ? stockItem.magnetMarbles.length : 0;
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#fff';
  ctx.font = (h * 0.12) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(capturedCount + '/' + MAGNET_CAPACITY, x + w / 2, y + h - 2 * S);
  ctx.globalAlpha = 1;

  // State indicator
  ctx.globalAlpha = 0.6;
  ctx.font = 'bold ' + (h * 0.1) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = isActive ? '#AAFFAA' : '#FFAAAA';
  ctx.fillText(isActive ? 'ON' : 'TAP', x + w / 2, y + 2 * S);
  ctx.globalAlpha = 1;

  ctx.restore();
}

// ── Update magnet boxes (called from game.js update loop) ──
function updateMagnetBoxes() {
  for (var i = 0; i < stock.length; i++) {
    var b = stock[i];
    if (b.boxType !== 'magnet') continue;
    if (!b.magnetMarbles) b.magnetMarbles = [];
    if (!b.magnetActive) continue;

    // Capture physics marbles one at a time
    if (b.magnetMarbles.length < MAGNET_CAPACITY && physMarbles.length > 0) {
      if (!b._magnetTimer) b._magnetTimer = 0;
      b._magnetTimer++;

      if (b._magnetTimer >= MAGNET_CAPTURE_INTERVAL) {
        b._magnetTimer = 0;

        // Find nearest marble
        var bx = b.x + L.bw / 2;
        var by = b.y + L.bh / 2;
        var nearest = -1;
        var nearDist = Infinity;

        for (var mi = 0; mi < physMarbles.length; mi++) {
          var m = physMarbles[mi];
          var dx = bx - m.x;
          var dy = by - m.y;
          var dist = dx * dx + dy * dy;
          if (dist < nearDist) {
            nearDist = dist;
            nearest = mi;
          }
        }

        if (nearest >= 0) {
          var m = physMarbles[nearest];
          b.magnetMarbles.push({ ci: m.ci });

          // Particle trail from marble to magnet
          for (var p = 0; p < 5; p++) {
            var t = p / 5;
            particles.push({
              x: m.x + (bx - m.x) * t,
              y: m.y + (by - m.y) * t,
              vx: (Math.random() - 0.5) * S,
              vy: -1 * S,
              r: (2 + Math.random() * 2) * S,
              color: COLORS[m.ci].fill,
              life: 0.4 + t * 0.3,
              decay: 0.04,
              grav: false
            });
          }

          spawnBurst(m.x, m.y, COLORS[m.ci].fill, 6);
          spawnBurst(bx, by, '#E74C3C', 4);
          sfx.drop();
          physMarbles.splice(nearest, 1);
        }
      }
    }
  }
}

// ── Release all captured marbles back into the funnel ──
function magnetRelease(b) {
  if (!b.magnetMarbles || b.magnetMarbles.length === 0) return;

  var bx = b.x + L.bw / 2;
  var by = b.y + L.bh / 2;
  var MR = getMR();
  var marbles = b.magnetMarbles.slice();
  b.magnetMarbles = [];

  for (var i = 0; i < marbles.length; i++) {
    (function (idx) {
      setTimeout(function () {
        var angle = Math.random() * Math.PI * 2;
        var spread = 6 * S;
        physMarbles.push({
          x: bx + Math.cos(angle) * spread,
          y: by + Math.sin(angle) * spread,
          vx: (Math.random() - 0.5) * 3 * S,
          vy: (1 + Math.random() * 2) * S,
          ci: marbles[idx].ci,
          r: MR,
          spawnT: 0.5
        });
        spawnBurst(bx, by, COLORS[marbles[idx].ci].fill, 3);
        sfx.drop();
      }, idx * 80);
    })(i);
  }

  spawnBurst(bx, by, '#E74C3C', 15);
}

// ── Draw magnetic attraction effects ──
function drawMagnetEffects() {
  for (var i = 0; i < stock.length; i++) {
    var b = stock[i];
    if (b.boxType !== 'magnet' || !b.magnetActive) continue;
    if (b.magnetMarbles && b.magnetMarbles.length >= MAGNET_CAPACITY) continue;

    var bx = b.x + L.bw / 2;
    var by = b.y + L.bh / 2;

    // Draw subtle attraction lines to physics marbles
    ctx.save();
    for (var mi = 0; mi < physMarbles.length; mi++) {
      var m = physMarbles[mi];
      var dx = bx - m.x;
      var dy = by - m.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var maxDist = 250 * S;

      if (dist < maxDist) {
        var alpha = 0.15 * (1 - dist / maxDist);
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#E74C3C';
        ctx.lineWidth = 1 * S;
        ctx.setLineDash([2 * S, 4 * S]);
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    ctx.restore();

    // Spawn attraction particles
    if (tick % 8 === 0 && physMarbles.length > 0) {
      var randIdx = Math.floor(Math.random() * physMarbles.length);
      var rm = physMarbles[randIdx];
      var rdx = bx - rm.x;
      var rdy = by - rm.y;
      var rdist = Math.sqrt(rdx * rdx + rdy * rdy);
      if (rdist < 250 * S && rdist > 1) {
        particles.push({
          x: rm.x, y: rm.y,
          vx: rdx / rdist * 3 * S,
          vy: rdy / rdist * 3 * S,
          r: (1.5 + Math.random()) * S,
          color: '#E74C3C',
          life: 0.4, decay: 0.02, grav: false
        });
      }
    }
  }
}
