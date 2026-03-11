// ============================================================
// box_pack.js — Marble Pack box type
// Contains 9 marbles across 3 distinct colors (3 of each).
// The player can see all 3 colors on the closed pack.
// Tapping releases all 9 marbles at once onto the conveyor.
// ============================================================

var PACK_MARBLES_PER_COLOR = 3;
var PACK_NUM_COLORS = 3;
var PACK_TOTAL = PACK_MARBLES_PER_COLOR * PACK_NUM_COLORS; // 9

// Helper: get the color index for a given marble slot in a pack
function getPackMarbleColor(packColors, slotIdx) {
  // Slots 0-2 → color 0, 3-5 → color 1, 6-8 → color 2
  var groupIdx = Math.floor(slotIdx / PACK_MARBLES_PER_COLOR);
  if (groupIdx >= PACK_NUM_COLORS) groupIdx = PACK_NUM_COLORS - 1;
  return packColors[groupIdx];
}

// Helper: pick 3 random distinct color indices
function pickPackColors() {
  var available = [];
  for (var i = 0; i < NUM_COLORS; i++) available.push(i);
  shuffle(available);
  return [available[0], available[1], available[2]];
}

registerBoxType('pack', {
  label: 'Pack',
  editorColor: '#D4A84C',

  // ── Closed state: tri-color box showing all 3 colors ──
  drawClosed: function (ctx, x, y, w, h, ci, S, tick, idlePhase, stockItem) {
    // Retrieve pack colors from the stock item or fall back to ci
    var pc = (stockItem && stockItem.packColors) ? stockItem.packColors : [ci, ci, ci];

    ctx.save();

    // Base box with neutral dark background
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = 4 * S;
    ctx.shadowOffsetY = 2 * S;
    var baseGrad = ctx.createLinearGradient(x, y, x, y + h);
    baseGrad.addColorStop(0, '#8A7D6B');
    baseGrad.addColorStop(1, '#6A5D4B');
    ctx.fillStyle = baseGrad;
    rRect(x, y, w, h, 6 * S);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Three horizontal color bands
    var bandH = h * 0.22;
    var bandW = w * 0.7;
    var bandX = x + (w - bandW) / 2;
    var bandGap = (h - bandH * 3) / 4;

    ctx.save();
    ctx.beginPath();
    rRect(x, y, w, h, 6 * S);
    ctx.clip();

    for (var b = 0; b < 3; b++) {
      var c = COLORS[pc[b]];
      var by = y + bandGap * (b + 1) + bandH * b;
      ctx.globalAlpha = 0.7;
      var bGrad = ctx.createLinearGradient(bandX, by, bandX + bandW, by);
      bGrad.addColorStop(0, c.light);
      bGrad.addColorStop(0.5, c.fill);
      bGrad.addColorStop(1, c.dark);
      ctx.fillStyle = bGrad;
      rRect(bandX, by, bandW, bandH, 3 * S);
      ctx.fill();

      // Small marble dot on each band
      ctx.globalAlpha = 0.85;
      var dotR = Math.min(bandH * 0.3, w * 0.05);
      var dotCx = bandX + bandW * 0.5;
      var dotCy = by + bandH / 2;
      for (var d = -1; d <= 1; d++) {
        var dx = dotCx + d * bandW * 0.25;
        var grd = ctx.createRadialGradient(dx - dotR * 0.2, dotCy - dotR * 0.2, dotR * 0.1, dx, dotCy, dotR);
        grd.addColorStop(0, c.light);
        grd.addColorStop(1, c.dark);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(dx, dotCy, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // Border
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = '#5A4D3B';
    ctx.lineWidth = 1.5 * S;
    rRect(x, y, w, h, 6 * S);
    ctx.stroke();

    // Lock icon
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + (h * 0.2) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\uD83D\uDD12', x + w * 0.88, y + h * 0.15);

    ctx.restore();
  },

  // ── Reveal animation ──
  drawReveal: function (ctx, x, y, w, h, ci, S, phase, remaining, tick, stockItem) {
    var pc = (stockItem && stockItem.packColors) ? stockItem.packColors : [ci, ci, ci];
    var popScale = 1 + Math.sin(phase * Math.PI) * 0.12;

    ctx.save();
    ctx.scale(popScale, popScale);

    if (phase < 0.5) {
      ctx.globalAlpha = 1 - phase * 2;
      this.drawClosed(ctx, x, y, w, h, ci, S, tick, 0, stockItem);
      ctx.globalAlpha = phase * 2;
    }

    // Draw neutral-colored box body (use first pack color)
    drawBox(x, y, w, h, pc[0]);

    ctx.globalAlpha = 1;
    if (remaining > 0 && phase > 0.3) {
      ctx.globalAlpha = Math.min(1, (phase - 0.3) / 0.5);
      drawBoxMarblesPack(pc, remaining);
      ctx.globalAlpha = 1;
      drawBoxLip(pc[0]);
    }

    ctx.restore();
  },

  editorCellStyle: function (ci, gridItem) {
    var pc = (gridItem && gridItem.packColors) ? gridItem.packColors : [ci, (ci + 1) % NUM_COLORS, (ci + 2) % NUM_COLORS];
    var c0 = COLORS[pc[0]], c1 = COLORS[pc[1]], c2 = COLORS[pc[2]];
    return {
      background: 'linear-gradient(180deg,' + c0.fill + ' 30%,' + c1.fill + ' 50%,' + c2.fill + ' 70%)',
      borderColor: '#D4A84C'
    };
  },

  editorCellHTML: function (ci, gridItem) {
    var pc = (gridItem && gridItem.packColors) ? gridItem.packColors : [ci, (ci + 1) % NUM_COLORS, (ci + 2) % NUM_COLORS];
    var html = '<span class="ed-cell-dot" style="font-size:7px;line-height:1.1;display:flex;flex-direction:column;align-items:center;gap:0">';
    for (var i = 0; i < 3; i++) {
      html += '<span style="color:' + COLORS[pc[i]].fill + '">&#9679;</span>';
    }
    html += '</span>';
    return html;
  }
});
