// ============================================================
// editor.js — Level Editor (reads box types from registry)
//             + Tunnel placement, orientation, contents editing
//             + Wall placement
//             + Pack placement and color editing
//             + Rocket placement and editing
// ============================================================

var editor = {
  grid: [],
  name: 'Custom Level',
  desc: 'My custom level',
  mrbPerBox: 9,
  sortCap: 3,
  lockButtons: 0,
  activeColor: 0,
  activeType: BoxTypeOrder[0],
  tunnelMode: false,
  tunnelDir: 'bottom',
  selectedTunnel: -1,
  wallMode: false,
  selectedPack: -1,
  // ROCKET
  rocketMode: false,
  rocketDir: 'right',
  selectedRocket: -1,
  _rocketIdCounter: 0,
  visible: false
};

function editorInit() {
  editor.grid = [];
  for (var i = 0; i < 49; i++) editor.grid.push(null);
  editor.name = 'Custom Level';
  editor.desc = 'My custom level';
  editor.mrbPerBox = 9;
  editor.sortCap = 3;
  editor.lockButtons = 0;
  editor.activeColor = 0;
  editor.activeType = BoxTypeOrder[0];
  editor.tunnelMode = false;
  editor.tunnelDir = 'bottom';
  editor.selectedTunnel = -1;
  editor.wallMode = false;
  editor.selectedPack = -1;
  editor.rocketMode = false;
  editor.rocketDir = 'right';
  editor.selectedRocket = -1;
  editor._rocketIdCounter = 0;
}

function showEditor(fresh) {
  gameActive = false;
  document.getElementById('win-screen').classList.remove('show');
  document.getElementById('home-screen').classList.add('hidden');
  document.getElementById('cal-toggle').style.display = 'none';
  document.getElementById('editor-screen').classList.remove('hidden');
  editor.visible = true;
  if (fresh !== false) editorInit();
  editorBuildUI();
}

function hideEditor() {
  document.getElementById('editor-screen').classList.add('hidden');
  editor.visible = false;
}

function editorBack() { hideEditor(); showLevelSelect(); }

function editorBuildUI() {
  editorRenderGrid();
  editorRenderToolbar();
  editorRenderSettings();
  editorUpdateStats();
  editorRenderTunnelPanel();
  editorRenderPackPanel();
  editorRenderRocketPanel();
}

// ── Grid ──
function editorRenderGrid() {
  var el = document.getElementById('ed-grid');
  el.innerHTML = '';
  for (var i = 0; i < 49; i++) {
    var cell = document.createElement('div');
    cell.className = 'ed-cell';
    var v = editor.grid[i];
    if (v && v.wall) {
      cell.style.background = 'linear-gradient(135deg,#9A8D7B,#6F6355)';
      cell.style.borderColor = '#8A7D6B';
      cell.innerHTML = '<span class="ed-cell-dot" style="color:rgba(255,255,255,0.5);font-size:14px">&#9632;</span>';
    } else if (v && v.tunnel) {
      var isSelected = (editor.selectedTunnel === i);
      cell.style.background = 'linear-gradient(135deg,#3D3548,#252030)';
      cell.style.borderColor = isSelected ? '#FFD080' : '#6A6070';
      if (isSelected) cell.style.boxShadow = '0 0 0 2px rgba(255,208,128,0.5)';
      var arrow = TUNNEL_DIR_ARROWS[v.dir] || '\u25BC';
      var count = v.contents ? v.contents.length : 0;
      cell.innerHTML = '<span class="ed-cell-dot" style="color:#FFD080;font-size:13px">' + arrow +
        '</span><span class="ed-tunnel-badge">' + count + '</span>';
    } else if (v && v.rocket) {
      // ROCKET core cell
      cell.style.background = 'linear-gradient(135deg,#FF6B35,#E8552A)';
      cell.style.borderColor = '#C44420';
      var isSelected = (editor.selectedRocket !== -1 && v.rocketId ===
        (editor.grid[editor.selectedRocket] ? editor.grid[editor.selectedRocket].rocketId : -1));
      if (isSelected) cell.style.boxShadow = '0 0 0 2px rgba(255,107,53,0.5)';
      var arrow = ROCKET_DIR_ARROWS[v.rocketDir] || '\u25B6';
      var underLabel = v.underCi !== undefined ? CLR_NAMES[v.underCi][0].toUpperCase() : '?';
      cell.innerHTML = '<span class="ed-cell-dot" style="font-size:9px;color:rgba(255,255,255,0.8)">' +
        arrow + '</span><span style="position:absolute;bottom:1px;right:2px;font-size:6px;color:rgba(255,255,255,0.5)">' +
        underLabel + '</span>';
    } else if (v && v.ci >= 0) {
      var bt = getBoxType(v.type);
      var st = bt.editorCellStyle(v.ci, v);
      cell.style.background = st.background;
      cell.style.borderColor = st.borderColor;
      cell.innerHTML = bt.editorCellHTML(v.ci, v);
      if (v.type === 'pack' && editor.selectedPack === i) {
        cell.style.boxShadow = '0 0 0 2px rgba(212,168,76,0.7)';
      }
    } else {
      cell.style.background = 'rgba(180,165,145,0.25)';
      cell.style.borderColor = 'rgba(160,140,120,0.3)';
    }
    cell.setAttribute('data-idx', i);
    cell.addEventListener('click', editorCellClick);
    cell.addEventListener('contextmenu', editorCellErase);
    el.appendChild(cell);
  }
}

function editorCellClick(e) {
  var idx = parseInt(e.currentTarget.getAttribute('data-idx'));

  if (editor.wallMode) {
    var existing = editor.grid[idx];
    if (existing && existing.wall) {
      editor.grid[idx] = null;
    } else {
      editor.grid[idx] = { wall: true };
    }
    if (editor.selectedTunnel === idx) editor.selectedTunnel = -1;
    editor.selectedPack = -1;
    editor.selectedRocket = -1;
    editorRenderGrid(); editorUpdateStats(); editorRenderTunnelPanel(); editorRenderPackPanel(); editorRenderRocketPanel();
    return;
  }

  // ROCKET mode
  if (editor.rocketMode) {
    if (editor.activeColor === -1) {
      var existing = editor.grid[idx];
      if (existing && existing.rocket) {
        var rid = existing.rocketId;
        for (var ri = 0; ri < 49; ri++) {
          if (editor.grid[ri] && editor.grid[ri].rocket && editor.grid[ri].rocketId === rid) {
            editor.grid[ri] = null;
          }
        }
        if (editor.selectedRocket === idx) editor.selectedRocket = -1;
      } else {
        editor.grid[idx] = null;
      }
    } else {
      var existing = editor.grid[idx];
      // Click an existing core → select its rocket
      if (existing && existing.rocket) {
        editor.selectedRocket = idx;
      } else {
        // Place new rocket: clicked cell = trigger (stays free), cores at +1 and +2
        var coreIdxs = getRocketCoreIndices(idx, editor.rocketDir, 7, 7);
        if (!coreIdxs) {
          editorShowToast('Not enough space for rocket!');
          return;
        }
        var rid = ++editor._rocketIdCounter;
        // Only check/clear core positions (trigger cell is free for any box)
        for (var pi = 0; pi < coreIdxs.length; pi++) {
          var ex = editor.grid[coreIdxs[pi]];
          if (ex && ex.rocket) {
            var oldRid = ex.rocketId;
            for (var ri = 0; ri < 49; ri++) {
              if (editor.grid[ri] && editor.grid[ri].rocket && editor.grid[ri].rocketId === oldRid) {
                editor.grid[ri] = null;
              }
            }
          }
        }
        // Place 2 cores (no tail placed on the trigger cell)
        editor.grid[coreIdxs[0]] = {
          rocket: true, rocketId: rid, rocketRole: 'core',
          rocketDir: editor.rocketDir,
          underCi: editor.activeColor, underType: 'default'
        };
        editor.grid[coreIdxs[1]] = {
          rocket: true, rocketId: rid, rocketRole: 'core',
          rocketDir: editor.rocketDir,
          underCi: (editor.activeColor + 1) % NUM_COLORS, underType: 'default'
        };
        editor.selectedRocket = coreIdxs[0]; // select back core
        editor.selectedPack = -1;
        editor.selectedTunnel = -1;
      }
    }
    editorRenderGrid(); editorUpdateStats(); editorRenderTunnelPanel(); editorRenderPackPanel(); editorRenderRocketPanel();
    return;
  }

  if (editor.tunnelMode) {
    var existing = editor.grid[idx];
    if (existing && existing.tunnel) {
      editor.selectedTunnel = idx;
    } else if (editor.activeColor === -1) {
      editor.grid[idx] = null;
      if (editor.selectedTunnel === idx) editor.selectedTunnel = -1;
    } else {
      editor.grid[idx] = { tunnel: true, dir: editor.tunnelDir, contents: [] };
      editor.selectedTunnel = idx;
    }
    editor.selectedPack = -1;
    editor.selectedRocket = -1;
  } else {
    if (editor.activeColor === -1) {
      editor.grid[idx] = null;
      if (editor.selectedTunnel === idx) editor.selectedTunnel = -1;
      editor.selectedPack = -1;
      editor.selectedRocket = -1;
    } else {
      var existing = editor.grid[idx];
      if (existing && !existing.tunnel && !existing.wall && !existing.rocket && existing.type === editor.activeType && (existing.type === 'pack' || existing.ci === editor.activeColor)) {
        if (existing.type === 'pack') {
          editor.selectedPack = idx;
          editorRenderGrid(); editorRenderPackPanel(); editorUpdateStats(); editorRenderTunnelPanel(); editorRenderRocketPanel();
          return;
        }
        editor.grid[idx] = null;
        editor.selectedPack = -1;
      } else {
        if (editor.activeType === 'pack') {
          var pc = pickPackColors();
          if (pc.indexOf(editor.activeColor) >= 0) {
            pc.splice(pc.indexOf(editor.activeColor), 1);
            pc.unshift(editor.activeColor);
          } else {
            pc[0] = editor.activeColor;
          }
          editor.grid[idx] = { ci: pc[0], type: 'pack', packColors: pc };
          editor.selectedPack = idx;
        } else {
          editor.grid[idx] = { ci: editor.activeColor, type: editor.activeType };
          editor.selectedPack = -1;
        }
      }
      if (editor.selectedTunnel === idx) editor.selectedTunnel = -1;
      editor.selectedRocket = -1;
    }
  }
  editorRenderGrid(); editorUpdateStats(); editorRenderTunnelPanel(); editorRenderPackPanel(); editorRenderRocketPanel();
}

function editorCellErase(e) {
  e.preventDefault();
  var idx = parseInt(e.currentTarget.getAttribute('data-idx'));
  // If erasing a rocket cell, erase the whole rocket
  var v = editor.grid[idx];
  if (v && v.rocket) {
    var rid = v.rocketId;
    for (var ri = 0; ri < 49; ri++) {
      if (editor.grid[ri] && editor.grid[ri].rocket && editor.grid[ri].rocketId === rid) {
        editor.grid[ri] = null;
      }
    }
    if (editor.selectedRocket === idx) editor.selectedRocket = -1;
  } else {
    editor.grid[idx] = null;
  }
  if (editor.selectedTunnel === idx) editor.selectedTunnel = -1;
  if (editor.selectedPack === idx) editor.selectedPack = -1;
  editorRenderGrid(); editorUpdateStats(); editorRenderTunnelPanel(); editorRenderPackPanel(); editorRenderRocketPanel();
}

// ── Toolbar ──
function editorRenderToolbar() {
  var el = document.getElementById('ed-toolbar');
  el.innerHTML = '';

  var typeRow = document.createElement('div');
  typeRow.className = 'ed-type-row';

  for (var t = 0; t < BoxTypeOrder.length; t++) {
    var id = BoxTypeOrder[t];
    var bt = BoxTypes[id];
    var tb = document.createElement('button');
    tb.className = 'ed-type-btn' + (!editor.tunnelMode && !editor.wallMode && !editor.rocketMode && editor.activeType === id ? ' active' : '');
    tb.textContent = bt.label;
    tb.setAttribute('data-type', id);
    tb.addEventListener('click', function () {
      editor.activeType = this.getAttribute('data-type');
      editor.tunnelMode = false;
      editor.wallMode = false;
      editor.rocketMode = false;
      editorRenderToolbar(); editorRenderTunnelPanel(); editorRenderPackPanel(); editorRenderRocketPanel();
    });
    typeRow.appendChild(tb);
  }

  // Wall
  var wallBtn = document.createElement('button');
  wallBtn.className = 'ed-type-btn' + (editor.wallMode ? ' active' : '');
  wallBtn.textContent = '\u25A0 Wall';
  wallBtn.style.borderColor = editor.wallMode ? 'rgba(138,125,107,0.6)' : '';
  wallBtn.style.color = editor.wallMode ? '#6F6355' : '';
  wallBtn.addEventListener('click', function () {
    editor.wallMode = true; editor.tunnelMode = false; editor.rocketMode = false;
    editorRenderToolbar(); editorRenderTunnelPanel(); editorRenderPackPanel(); editorRenderRocketPanel();
  });
  typeRow.appendChild(wallBtn);

  // Tunnel
  var tunnelBtn = document.createElement('button');
  tunnelBtn.className = 'ed-type-btn' + (editor.tunnelMode ? ' active' : '');
  tunnelBtn.textContent = '\uD83D\uDD73 Tunnel';
  tunnelBtn.style.borderColor = editor.tunnelMode ? 'rgba(255,190,80,0.6)' : '';
  tunnelBtn.style.color = editor.tunnelMode ? '#E8A84C' : '';
  tunnelBtn.addEventListener('click', function () {
    editor.tunnelMode = true; editor.wallMode = false; editor.rocketMode = false;
    editorRenderToolbar(); editorRenderTunnelPanel(); editorRenderPackPanel(); editorRenderRocketPanel();
  });
  typeRow.appendChild(tunnelBtn);

  // ROCKET
  var rocketBtn = document.createElement('button');
  rocketBtn.className = 'ed-type-btn' + (editor.rocketMode ? ' active' : '');
  rocketBtn.textContent = '\uD83D\uDE80 Rocket';
  rocketBtn.style.borderColor = editor.rocketMode ? 'rgba(255,107,53,0.6)' : '';
  rocketBtn.style.color = editor.rocketMode ? '#FF6B35' : '';
  rocketBtn.addEventListener('click', function () {
    editor.rocketMode = true; editor.tunnelMode = false; editor.wallMode = false;
    editorRenderToolbar(); editorRenderTunnelPanel(); editorRenderPackPanel(); editorRenderRocketPanel();
  });
  typeRow.appendChild(rocketBtn);

  el.appendChild(typeRow);

  if (editor.tunnelMode) {
    var dirRow = document.createElement('div');
    dirRow.className = 'ed-color-row';
    var eraser = document.createElement('button');
    eraser.className = 'ed-tool' + (editor.activeColor === -1 ? ' active' : '');
    eraser.style.background = 'rgba(180,165,145,0.5)';
    eraser.innerHTML = '\u2716'; eraser.title = 'Eraser';
    eraser.addEventListener('click', function () { editor.activeColor = -1; editorRenderToolbar(); });
    dirRow.appendChild(eraser);
    var dirs = ['top', 'left', 'bottom', 'right'];
    var dirSymbols = ['\u25B2', '\u25C0', '\u25BC', '\u25B6'];
    for (var d = 0; d < dirs.length; d++) {
      var db = document.createElement('button');
      db.className = 'ed-tool' + (editor.tunnelDir === dirs[d] && editor.activeColor !== -1 ? ' active' : '');
      db.style.background = 'linear-gradient(135deg,#3D3548,#252030)';
      db.innerHTML = dirSymbols[d]; db.title = dirs[d];
      db.setAttribute('data-dir', dirs[d]);
      db.addEventListener('click', function () {
        editor.tunnelDir = this.getAttribute('data-dir');
        editor.activeColor = 0; editorRenderToolbar();
      });
      dirRow.appendChild(db);
    }
    el.appendChild(dirRow);
  } else if (editor.rocketMode) {
    // ROCKET: Direction selector
    var dirRow = document.createElement('div');
    dirRow.className = 'ed-color-row';
    var eraser = document.createElement('button');
    eraser.className = 'ed-tool' + (editor.activeColor === -1 ? ' active' : '');
    eraser.style.background = 'rgba(180,165,145,0.5)';
    eraser.innerHTML = '\u2716'; eraser.title = 'Eraser';
    eraser.addEventListener('click', function () { editor.activeColor = -1; editorRenderToolbar(); });
    dirRow.appendChild(eraser);
    var dirs = ['up', 'left', 'down', 'right'];
    var dirSymbols = ['\u25B2', '\u25C0', '\u25BC', '\u25B6'];
    for (var d = 0; d < dirs.length; d++) {
      var db = document.createElement('button');
      db.className = 'ed-tool' + (editor.rocketDir === dirs[d] && editor.activeColor !== -1 ? ' active' : '');
      db.style.background = 'linear-gradient(135deg,#FF6B35,#E8552A)';
      db.innerHTML = dirSymbols[d]; db.title = dirs[d];
      db.setAttribute('data-dir', dirs[d]);
      db.addEventListener('click', function () {
        editor.rocketDir = this.getAttribute('data-dir');
        editor.activeColor = 0; editorRenderToolbar();
      });
      dirRow.appendChild(db);
    }
    el.appendChild(dirRow);
    // Color palette for rocket tail/under colors
    var colorRow = document.createElement('div');
    colorRow.className = 'ed-color-row';
    for (var ci = 0; ci < NUM_COLORS; ci++) {
      var cb = document.createElement('button');
      cb.className = 'ed-tool' + (editor.activeColor === ci ? ' active' : '');
      cb.style.background = COLORS[ci].fill;
      cb.innerHTML = CLR_NAMES[ci][0].toUpperCase(); cb.title = CLR_NAMES[ci];
      cb.setAttribute('data-ci', ci);
      cb.addEventListener('click', function () {
        editor.activeColor = parseInt(this.getAttribute('data-ci')); editorRenderToolbar();
      });
      colorRow.appendChild(cb);
    }
    el.appendChild(colorRow);
  } else {
    // Normal color palette
    var colorRow = document.createElement('div');
    colorRow.className = 'ed-color-row';
    var eraser = document.createElement('button');
    eraser.className = 'ed-tool' + (editor.activeColor === -1 ? ' active' : '');
    eraser.style.background = 'rgba(180,165,145,0.5)';
    eraser.innerHTML = '\u2716'; eraser.title = 'Eraser';
    eraser.addEventListener('click', function () { editor.activeColor = -1; editorRenderToolbar(); });
    colorRow.appendChild(eraser);
    for (var ci = 0; ci < NUM_COLORS; ci++) {
      var cb = document.createElement('button');
      cb.className = 'ed-tool' + (editor.activeColor === ci ? ' active' : '');
      cb.style.background = COLORS[ci].fill;
      cb.innerHTML = CLR_NAMES[ci][0].toUpperCase(); cb.title = CLR_NAMES[ci];
      cb.setAttribute('data-ci', ci);
      cb.addEventListener('click', function () {
        editor.activeColor = parseInt(this.getAttribute('data-ci')); editorRenderToolbar();
      });
      colorRow.appendChild(cb);
    }
    el.appendChild(colorRow);
  }
}

// ── Tunnel panel ──
function editorRenderTunnelPanel() {
  var container = document.getElementById('ed-tunnel-panel');
  if (!container) return;
  if (editor.selectedTunnel < 0 || !editor.grid[editor.selectedTunnel] || !editor.grid[editor.selectedTunnel].tunnel) {
    container.style.display = 'none'; return;
  }
  container.style.display = 'block';
  var tunnel = editor.grid[editor.selectedTunnel];
  var html = '';
  html += '<div class="ed-section-title"><span class="icon">\uD83D\uDD73</span> Tunnel #' + (editor.selectedTunnel + 1) + ' — Direction</div>';
  html += '<div class="ed-tunnel-dir-row">';
  var dirs = ['top', 'left', 'bottom', 'right'];
  var dirLabels = ['\u25B2 Up', '\u25C0 Left', '\u25BC Down', '\u25B6 Right'];
  for (var d = 0; d < dirs.length; d++) {
    var active = tunnel.dir === dirs[d] ? ' active' : '';
    html += '<button class="ed-tunnel-dir-btn' + active + '" data-dir="' + dirs[d] + '">' + dirLabels[d] + '</button>';
  }
  html += '</div>';
  var row = Math.floor(editor.selectedTunnel / 7), col = editor.selectedTunnel % 7;
  var er = row, ec = col;
  if (tunnel.dir === 'top') er--; else if (tunnel.dir === 'bottom') er++;
  else if (tunnel.dir === 'left') ec--; else if (tunnel.dir === 'right') ec++;
  var exitValid = (er >= 0 && er < 7 && ec >= 0 && ec < 7);
  if (!exitValid) html += '<div class="ed-stat-warn" style="margin:4px 0">Exit points outside the grid!</div>';
  html += '<div class="ed-section-title" style="margin-top:8px"><span class="icon">\uD83D\uDCE6</span> Stored Boxes (' + tunnel.contents.length + ')</div>';
  html += '<div class="ed-tunnel-contents">';
  if (tunnel.contents.length === 0) {
    html += '<span style="font-size:11px;color:#9C8A70;font-style:italic">Empty — add boxes below</span>';
  } else {
    for (var ci2 = 0; ci2 < tunnel.contents.length; ci2++) {
      var item = tunnel.contents[ci2];
      var c = COLORS[item.ci];
      var typeLabel = (BoxTypes[item.type] || BoxTypes[BoxTypeOrder[0]]).label;
      html += '<span class="ed-tunnel-item" data-cidx="' + ci2 + '" title="' + CLR_NAMES[item.ci] + ' ' + typeLabel + ' — click to remove" style="background:' + c.fill + '">';
      html += '<span style="font-size:8px;opacity:0.7">' + typeLabel[0] + '</span></span>';
    }
  }
  html += '</div>';
  html += '<div class="ed-section-title" style="margin-top:8px"><span class="icon">&#10133;</span> Add Box to Tunnel</div>';
  html += '<div class="ed-tunnel-add-row"><select id="ed-tunnel-add-type" class="ed-tunnel-select">';
  for (var t = 0; t < BoxTypeOrder.length; t++) {
    html += '<option value="' + BoxTypeOrder[t] + '">' + BoxTypes[BoxTypeOrder[t]].label + '</option>';
  }
  html += '</select></div>';
  html += '<div class="ed-tunnel-add-colors">';
  for (var ci3 = 0; ci3 < NUM_COLORS; ci3++) {
    html += '<button class="ed-tunnel-add-clr" data-ci="' + ci3 + '" style="background:' + COLORS[ci3].fill + '" title="Add ' + CLR_NAMES[ci3] + '">' + CLR_NAMES[ci3][0].toUpperCase() + '</button>';
  }
  html += '</div>';
  if (tunnel.contents.length > 0) html += '<div style="text-align:center;margin-top:6px"><button class="ed-qbtn" id="ed-tunnel-clear">Clear All</button></div>';
  container.innerHTML = html;

  // Bind events
  var dirBtns = container.querySelectorAll('.ed-tunnel-dir-btn');
  for (var d2 = 0; d2 < dirBtns.length; d2++) {
    dirBtns[d2].addEventListener('click', function () {
      if (editor.selectedTunnel >= 0 && editor.grid[editor.selectedTunnel]) {
        editor.grid[editor.selectedTunnel].dir = this.getAttribute('data-dir');
        editorRenderGrid(); editorRenderTunnelPanel(); editorUpdateStats();
      }
    });
  }
  var items = container.querySelectorAll('.ed-tunnel-item');
  for (var it = 0; it < items.length; it++) {
    items[it].addEventListener('click', function () {
      var cidx = parseInt(this.getAttribute('data-cidx'));
      if (editor.selectedTunnel >= 0 && editor.grid[editor.selectedTunnel]) {
        editor.grid[editor.selectedTunnel].contents.splice(cidx, 1);
        editorRenderGrid(); editorRenderTunnelPanel(); editorUpdateStats();
      }
    });
  }
  var addClrs = container.querySelectorAll('.ed-tunnel-add-clr');
  for (var ac = 0; ac < addClrs.length; ac++) {
    addClrs[ac].addEventListener('click', function () {
      var ci4 = parseInt(this.getAttribute('data-ci'));
      var typeEl = document.getElementById('ed-tunnel-add-type');
      var type = typeEl ? typeEl.value : 'default';
      if (editor.selectedTunnel >= 0 && editor.grid[editor.selectedTunnel]) {
        var newItem = { ci: ci4, type: type };
        if (type === 'pack') {
          var pc = pickPackColors();
          pc[0] = ci4;
          newItem.packColors = pc;
        }
        editor.grid[editor.selectedTunnel].contents.push(newItem);
        editorRenderGrid(); editorRenderTunnelPanel(); editorUpdateStats();
      }
    });
  }
  var clearBtn = document.getElementById('ed-tunnel-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      if (editor.selectedTunnel >= 0 && editor.grid[editor.selectedTunnel]) {
        editor.grid[editor.selectedTunnel].contents = [];
        editorRenderGrid(); editorRenderTunnelPanel(); editorUpdateStats();
      }
    });
  }
}

// ── Pack panel ──
function editorRenderPackPanel() {
  var container = document.getElementById('ed-pack-panel');
  if (!container) return;
  if (editor.selectedPack < 0 || !editor.grid[editor.selectedPack] || editor.grid[editor.selectedPack].type !== 'pack') {
    container.style.display = 'none'; return;
  }
  container.style.display = 'block';
  var pack = editor.grid[editor.selectedPack];
  var pc = pack.packColors || [pack.ci, (pack.ci + 1) % NUM_COLORS, (pack.ci + 2) % NUM_COLORS];
  var html = '';
  html += '<div class="ed-section-title"><span class="icon">&#127912;</span> Marble Pack #' + (editor.selectedPack + 1) + ' — Colors</div>';
  html += '<div style="font-size:10px;color:#9C8A70;margin-bottom:6px">3 colors &times; 3 marbles each = 9 marbles total</div>';
  for (var slot = 0; slot < 3; slot++) {
    html += '<div style="display:flex;align-items:center;gap:6px;margin:6px 0">';
    html += '<span style="font-size:11px;color:#8B6914;width:50px">Color ' + (slot + 1) + ':</span>';
    html += '<div class="ed-tunnel-add-colors" style="margin:0">';
    for (var ci = 0; ci < NUM_COLORS; ci++) {
      var isActive = (pc[slot] === ci);
      var usedByOther = false;
      for (var os = 0; os < 3; os++) {
        if (os !== slot && pc[os] === ci) { usedByOther = true; break; }
      }
      var style = 'background:' + COLORS[ci].fill + ';';
      if (isActive) style += 'box-shadow:0 0 0 2px #fff,0 0 0 4px ' + COLORS[ci].dark + ';transform:scale(1.15);';
      if (usedByOther) style += 'opacity:0.3;cursor:not-allowed;';
      html += '<button class="ed-tunnel-add-clr ed-pack-clr-btn" data-slot="' + slot + '" data-ci="' + ci + '"' +
        (usedByOther ? ' disabled' : '') + ' style="' + style + '">' + CLR_NAMES[ci][0].toUpperCase() + '</button>';
    }
    html += '</div></div>';
  }
  container.innerHTML = html;
  var clrBtns = container.querySelectorAll('.ed-pack-clr-btn');
  for (var cb = 0; cb < clrBtns.length; cb++) {
    clrBtns[cb].addEventListener('click', function () {
      if (this.disabled) return;
      var slot = parseInt(this.getAttribute('data-slot'));
      var ci = parseInt(this.getAttribute('data-ci'));
      if (editor.selectedPack >= 0 && editor.grid[editor.selectedPack]) {
        var p = editor.grid[editor.selectedPack];
        if (!p.packColors) p.packColors = [p.ci, (p.ci + 1) % NUM_COLORS, (p.ci + 2) % NUM_COLORS];
        p.packColors[slot] = ci;
        p.ci = p.packColors[0];
        editorRenderGrid(); editorRenderPackPanel(); editorUpdateStats();
      }
    });
  }
}

// ── ROCKET panel ──
function editorRenderRocketPanel() {
  var container = document.getElementById('ed-rocket-panel');
  if (!container) return;
  if (editor.selectedRocket < 0 || !editor.grid[editor.selectedRocket] ||
      !editor.grid[editor.selectedRocket].rocket) {
    container.style.display = 'none'; return;
  }
  container.style.display = 'block';
  var selectedCore = editor.grid[editor.selectedRocket];
  var rid = selectedCore.rocketId;
  var dir = selectedCore.rocketDir;
  var cores = [];
  for (var i = 0; i < 49; i++) {
    if (editor.grid[i] && editor.grid[i].rocket && editor.grid[i].rocketId === rid) {
      cores.push({ idx: i, cell: editor.grid[i] });
    }
  }
  // Compute trigger cell from back core
  var d = ROCKET_DIR_DELTA[dir];
  var backCoreIdx = -1;
  if (cores.length === 2) {
    var r0 = Math.floor(cores[0].idx / 7), c0 = cores[0].idx % 7;
    var r1 = Math.floor(cores[1].idx / 7), c1 = cores[1].idx % 7;
    var proj0 = r0 * d.dr + c0 * d.dc;
    var proj1 = r1 * d.dr + c1 * d.dc;
    backCoreIdx = proj0 <= proj1 ? cores[0].idx : cores[1].idx;
  }
  var triggerIdx = backCoreIdx >= 0 ? getRocketTriggerIdx(backCoreIdx, dir, 7, 7) : -1;
  var triggerLabel = triggerIdx >= 0 ? 'row ' + (Math.floor(triggerIdx / 7) + 1) + ', col ' + (triggerIdx % 7 + 1) : 'out of bounds!';

  var html = '';
  html += '<div class="ed-section-title"><span class="icon">\uD83D\uDE80</span> Rocket #' + rid + '</div>';
  html += '<div class="ed-rocket-info">Trigger cell: <b>' + triggerLabel + '</b> (place any box there)</div>';
  html += '<div class="ed-rocket-info">Direction: ' + dir + '</div>';

  // Direction changer
  html += '<div class="ed-tunnel-dir-row" style="margin-top:6px">';
  var dirs = ['up', 'left', 'down', 'right'];
  var dirLabels = ['\u25B2 Up', '\u25C0 Left', '\u25BC Down', '\u25B6 Right'];
  for (var dd = 0; dd < dirs.length; dd++) {
    var active = dir === dirs[dd] ? ' active' : '';
    html += '<button class="ed-tunnel-dir-btn' + active + '" data-dir="' + dirs[dd] + '">' + dirLabels[dd] + '</button>';
  }
  html += '</div>';

  // Core under-box colors
  for (var c = 0; c < cores.length; c++) {
    html += '<div class="ed-rocket-info" style="font-weight:600;margin-top:6px">Core ' + (c + 1) + ' hidden box:</div>';
    html += '<div class="ed-rocket-color-row">';
    for (var ci = 0; ci < NUM_COLORS; ci++) {
      var cls = (cores[c].cell.underCi === ci) ? ' active-clr' : '';
      html += '<button class="ed-rocket-clr' + cls + '" data-target="core' + c + '" data-ci="' + ci + '" data-coreidx="' + cores[c].idx + '" style="background:' + COLORS[ci].fill + '">' + CLR_NAMES[ci][0].toUpperCase() + '</button>';
    }
    html += '</div>';
  }

  html += '<div style="text-align:center;margin-top:8px"><button class="ed-qbtn" id="ed-rocket-delete">\uD83D\uDDD1 Delete Rocket</button></div>';
  container.innerHTML = html;

  // Bind direction buttons
  var dirBtns = container.querySelectorAll('.ed-tunnel-dir-btn');
  for (var d2 = 0; d2 < dirBtns.length; d2++) {
    dirBtns[d2].addEventListener('click', function () {
      editorChangeRocketDir(editor.selectedRocket, this.getAttribute('data-dir'));
    });
  }
  // Bind color buttons
  var clrBtns = container.querySelectorAll('.ed-rocket-clr');
  for (var cb = 0; cb < clrBtns.length; cb++) {
    clrBtns[cb].addEventListener('click', function () {
      var coreIdx = parseInt(this.getAttribute('data-coreidx'));
      var ci = parseInt(this.getAttribute('data-ci'));
      if (editor.grid[coreIdx]) editor.grid[coreIdx].underCi = ci;
      editorRenderGrid(); editorRenderRocketPanel(); editorUpdateStats();
    });
  }
  // Bind delete
  var delBtn = document.getElementById('ed-rocket-delete');
  if (delBtn) {
    delBtn.addEventListener('click', function () {
      if (editor.selectedRocket >= 0 && editor.grid[editor.selectedRocket]) {
        var rid = editor.grid[editor.selectedRocket].rocketId;
        for (var ri = 0; ri < 49; ri++) {
          if (editor.grid[ri] && editor.grid[ri].rocket && editor.grid[ri].rocketId === rid) editor.grid[ri] = null;
        }
        editor.selectedRocket = -1;
        editorRenderGrid(); editorRenderRocketPanel(); editorUpdateStats();
      }
    });
  }
}

function editorChangeRocketDir(coreIdx, newDir) {
  var core = editor.grid[coreIdx];
  if (!core || !core.rocket) return;
  var rid = core.rocketId;
  var oldDir = core.rocketDir;
  if (oldDir === newDir) return;

  // Find all cores and their under-colors
  var oldCores = [];
  for (var ri = 0; ri < 49; ri++) {
    if (editor.grid[ri] && editor.grid[ri].rocket && editor.grid[ri].rocketId === rid) {
      oldCores.push({ idx: ri, underCi: editor.grid[ri].underCi });
    }
  }

  // Compute old trigger cell to place new cores relative to it
  var d = ROCKET_DIR_DELTA[oldDir];
  var backIdx = oldCores[0].idx;
  if (oldCores.length === 2) {
    var r0 = Math.floor(oldCores[0].idx / 7), c0 = oldCores[0].idx % 7;
    var r1 = Math.floor(oldCores[1].idx / 7), c1 = oldCores[1].idx % 7;
    var proj0 = r0 * d.dr + c0 * d.dc;
    var proj1 = r1 * d.dr + c1 * d.dc;
    backIdx = proj0 <= proj1 ? oldCores[0].idx : oldCores[1].idx;
  }
  var triggerIdx = getRocketTriggerIdx(backIdx, oldDir, 7, 7);
  if (triggerIdx < 0) { editorShowToast('Cannot change direction!'); return; }

  // Compute new core positions from the same trigger cell
  var newCoreIdxs = getRocketCoreIndices(triggerIdx, newDir, 7, 7);
  if (!newCoreIdxs) { editorShowToast('Not enough space!'); return; }

  // Check new positions aren't occupied by non-rocket things
  for (var ni = 0; ni < newCoreIdxs.length; ni++) {
    var ex = editor.grid[newCoreIdxs[ni]];
    if (ex && (!ex.rocket || ex.rocketId !== rid)) { editorShowToast('Cores would overlap!'); return; }
  }

  // Remove old cores
  for (var ri = 0; ri < 49; ri++) {
    if (editor.grid[ri] && editor.grid[ri].rocket && editor.grid[ri].rocketId === rid) {
      editor.grid[ri] = null;
    }
  }

  // Place new cores
  editor.grid[newCoreIdxs[0]] = { rocket: true, rocketId: rid, rocketRole: 'core', rocketDir: newDir,
    underCi: oldCores[0] ? oldCores[0].underCi : 0, underType: 'default' };
  editor.grid[newCoreIdxs[1]] = { rocket: true, rocketId: rid, rocketRole: 'core', rocketDir: newDir,
    underCi: oldCores[1] ? oldCores[1].underCi : 1, underType: 'default' };

  editor.selectedRocket = newCoreIdxs[0];
  editorRenderGrid(); editorRenderRocketPanel(); editorUpdateStats();
}

// ── Stats ──
function editorUpdateStats() {
  var counts = []; for (var c = 0; c < NUM_COLORS; c++) counts.push(0);
  var typeCounts = {};
  var total = 0, wallCount = 0, tunnelCount = 0, tunnelBoxCount = 0, totalBlockers = 0, rocketCount = 0;
  var regularMrb = []; for (var c = 0; c < NUM_COLORS; c++) regularMrb.push(0);

  for (var i = 0; i < 49; i++) {
    var v = editor.grid[i];
    if (!v) continue;
    if (v.wall) { wallCount++; continue; }
    if (v.tunnel) {
      tunnelCount++;
      if (v.contents) {
        tunnelBoxCount += v.contents.length;
        for (var tc = 0; tc < v.contents.length; tc++) {
          var tItem = v.contents[tc];
          if (tItem.type === 'pack' && tItem.packColors) {
            for (var pc = 0; pc < tItem.packColors.length; pc++) regularMrb[tItem.packColors[pc]] += PACK_MARBLES_PER_COLOR;
          } else if (tItem.type === 'blocker') {
            regularMrb[tItem.ci] += Math.max(0, editor.mrbPerBox - BLOCKER_PER_BOX);
            totalBlockers += BLOCKER_PER_BOX;
          } else {
            regularMrb[tItem.ci] += editor.mrbPerBox;
          }
        }
      }
      continue;
    }
    if (v.rocket) {
      if (v.rocketRole === 'core') {
        var uci = v.underCi !== undefined ? v.underCi : 0;
        regularMrb[uci] += editor.mrbPerBox;
      }
      // Count one rocket per pair of cores (count on first core found)
      var alreadyCounted = false;
      for (var ri = 0; ri < i; ri++) {
        if (editor.grid[ri] && editor.grid[ri].rocket && editor.grid[ri].rocketId === v.rocketId) { alreadyCounted = true; break; }
      }
      if (!alreadyCounted) rocketCount++;
      continue;
    }
    if (v.ci >= 0) {
      counts[v.ci]++; total++;
      typeCounts[v.type] = (typeCounts[v.type] || 0) + 1;
      if (v.type === 'pack' && v.packColors) {
        for (var pc = 0; pc < v.packColors.length; pc++) regularMrb[v.packColors[pc]] += PACK_MARBLES_PER_COLOR;
      } else if (v.type === 'blocker') {
        regularMrb[v.ci] += Math.max(0, editor.mrbPerBox - BLOCKER_PER_BOX);
        totalBlockers += BLOCKER_PER_BOX;
      } else {
        regularMrb[v.ci] += editor.mrbPerBox;
      }
    }
  }
  var el = document.getElementById('ed-stats');
  var html = '<span class="ed-stat-total">' + total + ' boxes</span>';
  for (var t = 0; t < BoxTypeOrder.length; t++) {
    var tid = BoxTypeOrder[t];
    if (typeCounts[tid]) html += '<span class="ed-stat-chip" style="background:' + BoxTypes[tid].editorColor + '">' + typeCounts[tid] + ' ' + BoxTypes[tid].label.toLowerCase() + '</span>';
  }
  if (wallCount > 0) html += '<span class="ed-stat-chip" style="background:#8A7D6B">' + wallCount + ' wall' + (wallCount > 1 ? 's' : '') + '</span>';
  if (tunnelCount > 0) html += '<span class="ed-stat-chip" style="background:#3D3548;border:1px solid #6A6070">' + tunnelCount + ' tunnel' + (tunnelCount > 1 ? 's' : '') + ' (' + tunnelBoxCount + ' stored)</span>';
  if (rocketCount > 0) html += '<span class="ed-stat-chip" style="background:#FF6B35">' + rocketCount + ' rocket' + (rocketCount > 1 ? 's' : '') + '</span>';
  if (totalBlockers > 0) html += '<span class="ed-stat-chip" style="background:' + COLORS[BLOCKER_CI].fill + '">' + totalBlockers + ' blocker mrb</span>';
  for (var c = 0; c < NUM_COLORS; c++) {
    if (counts[c] > 0) html += '<span class="ed-stat-chip" style="background:' + COLORS[c].fill + '">' + counts[c] + '</span>';
  }
  var warn = '';
  var totalAll = total + tunnelBoxCount;
  if (totalAll === 0) {
    warn = 'Place some boxes to create a level';
  } else {
    for (var c = 0; c < NUM_COLORS; c++) {
      if (regularMrb[c] > 0 && regularMrb[c] % editor.sortCap !== 0) {
        warn = CLR_NAMES[c] + ' regular marbles (' + regularMrb[c] + ') not divisible by sort cap (' + editor.sortCap + ')';
        break;
      }
    }
    if (!warn && totalBlockers > 0 && totalBlockers % 3 !== 0) warn = 'Total blocker marbles (' + totalBlockers + ') must be a multiple of 3';
  }
  if (warn) html += '<span class="ed-stat-warn">' + warn + '</span>';
  el.innerHTML = html;
}

// ── Settings ──
function editorRenderSettings() {
  var el = document.getElementById('ed-settings-body');
  el.innerHTML = '';
  var fields = [
    { label: 'Marbles/Box', key: 'mrbPerBox', min: 1, max: 25, step: 1 },
    { label: 'Sort Cap', key: 'sortCap', min: 1, max: 9, step: 1 },
    { label: 'Lock Btns', key: 'lockButtons', min: 0, max: 5, step: 1 }
  ];
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    var row = document.createElement('div');
    row.className = 'ed-setting-row';
    row.innerHTML = '<label>' + f.label + '</label>' +
      '<input type="range" id="ed-s-' + f.key + '" min="' + f.min + '" max="' + f.max + '" step="' + f.step + '" value="' + editor[f.key] + '">' +
      '<span class="ed-s-val" id="ed-s-' + f.key + '-v">' + editor[f.key] + '</span>';
    el.appendChild(row);
  }
  for (var i = 0; i < fields.length; i++) {
    (function (f) {
      var sl = document.getElementById('ed-s-' + f.key);
      var vl = document.getElementById('ed-s-' + f.key + '-v');
      sl.addEventListener('input', function () {
        editor[f.key] = parseInt(sl.value);
        vl.textContent = sl.value;
        editorUpdateStats();
      });
    })(fields[i]);
  }
}

// ── Build level ──
function editorBuildLevel() {
  return {
    name: editor.name, desc: editor.desc,
    mrbPerBox: editor.mrbPerBox, sortCap: editor.sortCap,
    lockButtons: editor.lockButtons,
    grid: editor.grid.slice()
  };
}

// ── Test play ──
function editorTestPlay() {
  var total = 0;
  for (var i = 0; i < 49; i++) if (editor.grid[i]) total++;
  if (total === 0) { editorShowToast('Place some boxes first!'); return; }
  hideEditor();
  var lvl = editorBuildLevel();
  var testIdx = LEVELS.length;
  LEVELS.push(lvl);
  levelStars.push(0);
  startLevel(testIdx);
  editor._testIdx = testIdx;
}

function editorCleanupTest() {
  if (editor._testIdx !== undefined && editor._testIdx === LEVELS.length - 1) {
    LEVELS.pop(); levelStars.pop(); editor._testIdx = undefined;
  }
}

// ── Export / Import ──
function editorExportJSON() {
  var json = JSON.stringify(editorBuildLevel(), null, 2);
  if (navigator.clipboard) {
    navigator.clipboard.writeText(json).then(function () { editorShowToast('Copied to clipboard!'); })
      .catch(function () { editorShowExportFallback(json); });
  } else { editorShowExportFallback(json); }
}

function editorShowExportFallback(json) {
  var ta = document.getElementById('ed-export-area');
  ta.value = json; ta.style.display = 'block'; ta.select();
  editorShowToast('Select all and copy');
}

function editorImportJSON() {
  var ta = document.getElementById('ed-export-area');
  if (ta.style.display === 'block' && ta.value.trim()) {
    try {
      var lvl = JSON.parse(ta.value);
      if (lvl.grid && lvl.grid.length === 49) {
        for (var i = 0; i < 49; i++) {
          var cell = lvl.grid[i];
          if (cell === null || cell === undefined || cell === -1) editor.grid[i] = null;
          else if (typeof cell === 'number') editor.grid[i] = cell >= 0 ? { ci: cell, type: 'default' } : null;
          else if (cell.wall) editor.grid[i] = { wall: true };
          else if (cell.tunnel) editor.grid[i] = { tunnel: true, dir: cell.dir || 'bottom', contents: cell.contents || [] };
          else editor.grid[i] = cell;
        }
      }
      if (lvl.mrbPerBox) editor.mrbPerBox = lvl.mrbPerBox;
      if (lvl.sortCap) editor.sortCap = lvl.sortCap;
      if (lvl.lockButtons !== undefined) editor.lockButtons = lvl.lockButtons;
      if (lvl.name) editor.name = lvl.name;
      if (lvl.desc) editor.desc = lvl.desc;
      var nameEl = document.getElementById('ed-name');
      var descEl = document.getElementById('ed-desc');
      if (nameEl) nameEl.value = editor.name;
      if (descEl) descEl.value = editor.desc;
      editor.selectedTunnel = -1;
      editor.selectedPack = -1;
      editor.selectedRocket = -1;
      // Update rocket ID counter
      var maxRid = 0;
      for (var ri = 0; ri < 49; ri++) {
        if (editor.grid[ri] && editor.grid[ri].rocket && editor.grid[ri].rocketId > maxRid) maxRid = editor.grid[ri].rocketId;
      }
      editor._rocketIdCounter = maxRid;
      ta.style.display = 'none';
      editorBuildUI();
      editorShowToast('Imported!');
    } catch (e) { editorShowToast('Invalid JSON'); }
  } else {
    ta.style.display = 'block'; ta.value = '';
    ta.placeholder = 'Paste level JSON here, then click Import again';
    ta.focus();
  }
}

function editorShowToast(msg) {
  var el = document.getElementById('ed-toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(function () { el.classList.remove('show'); }, 2000);
}

function editorSetName(val) { editor.name = val; }
function editorSetDesc(val) { editor.desc = val; }

function editorFillRandom() {
  editorInit();
  var slots = [];
  for (var c = 0; c < 4; c++) for (var n = 0; n < 6; n++) slots.push(c);
  shuffle(slots);
  for (var i = 0; i < slots.length && i < 49; i++) {
    editor.grid[i] = { ci: slots[i], type: 'default' };
  }
  editorBuildUI();
}

function editorClearAll() {
  for (var i = 0; i < 49; i++) editor.grid[i] = null;
  editor.selectedTunnel = -1;
  editor.selectedPack = -1;
  editor.selectedRocket = -1;
  editorBuildUI();
}

function pickPackColors() {
  var available = [];
  for (var c = 0; c < NUM_COLORS; c++) available.push(c);
  shuffle(available);
  return [available[0], available[1], available[2]];
}
