/* ============================================================
   TETRIS — Liquid Glass Edition
   Instant-lock Tetris with ghost piece, hold, next queue,
   wall kicks (SRS), and NES-style scoring.
   ============================================================ */

(() => {
  'use strict';

  // ============================
  // CONSTANTS
  // ============================
  const COLS = 10;
  const ROWS = 20;
  const HIDDEN_ROWS = 4;
  const TOTAL_ROWS = ROWS + HIDDEN_ROWS;

  // SRS Tetrominoes
  const SHAPES = {
    I: { cells: [[0,0],[1,0],[2,0],[3,0]], color: '#00d4ff' },
    O: { cells: [[0,0],[1,0],[0,1],[1,1]], color: '#ffd700' },
    T: { cells: [[0,0],[1,0],[2,0],[1,1]], color: '#b06aff' },
    S: { cells: [[1,0],[2,0],[0,1],[1,1]], color: '#50fa7b' },
    Z: { cells: [[0,0],[1,0],[1,1],[2,1]], color: '#ff6b6b' },
    J: { cells: [[0,0],[0,1],[1,1],[2,1]], color: '#5b8cff' },
    L: { cells: [[2,0],[0,1],[1,1],[2,1]], color: '#ffa07a' }
  };

  const KICKS_JLSTZ = [
    [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]]
  ];
  const KICKS_I = [
    [[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
    [[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
    [[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
    [[0,0],[1,0],[-2,0],[1,2],[-2,-1]]
  ];

  const LINE_SCORES = [0, 100, 300, 500, 800];
  const SOFT_DROP_SCORE = 1;
  const HARD_DROP_SCORE = 2;
  const DAS_DELAY = 170;
  const DAS_REPEAT = 45;

  const PIECE_COLORS = {};
  for (const [k, v] of Object.entries(SHAPES)) PIECE_COLORS[k] = v.color;

  // ============================
  // STATE
  // ============================
  let board = [];
  let currentPiece = null;
  let holdPiece = null;
  let holdUsed = false;
  let nextQueue = [];
  let bag = [];
  let score = 0, level = 1, lines = 0;
  let gamePhase = 'start';
  let dropTimer = 0;
  let rafId = null;
  let lineClearRows = [];
  let lineClearTimer = 0;
  const LINE_CLEAR_DURATION = 200;

  // Input
  const keys = {};
  const justPressed = {};
  let dasKey = null, dasTimer = 0, dasActive = false;

  // Audio
  let audioCtx = null;

  // Sizing
  let cellSize = 30;

  // ============================
  // DOM
  // ============================
  const gameCanvas = document.getElementById('game-canvas');
  const ctx = gameCanvas.getContext('2d');
  const holdCanvas = document.getElementById('hold-canvas');
  const holdCtx = holdCanvas.getContext('2d');
  const nextCanvas = document.getElementById('next-canvas');
  const nextCtx = nextCanvas.getContext('2d');

  const startScreen = document.getElementById('start-screen');
  const gameScreen = document.getElementById('game-screen');
  const pauseOverlay = document.getElementById('pause-overlay');
  const gameoverOverlay = document.getElementById('gameover-overlay');

  const scoreDisplay = document.getElementById('score-display');
  const levelDisplay = document.getElementById('level-display');
  const linesDisplay = document.getElementById('lines-display');
  const finalScore = document.getElementById('final-score');
  const finalLevel = document.getElementById('final-level');
  const finalLines = document.getElementById('final-lines');

  // ============================
  // SIZING — dynamic to fit viewport
  // ============================
  function computeCellSize() {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const maxFromH = Math.floor((vh - 30) / ROWS);
    const sidePanelWidth = vw < 600 ? 200 : 320;
    const maxFromW = Math.floor((vw - sidePanelWidth) / COLS);
    return Math.max(14, Math.min(38, maxFromH, maxFromW));
  }

  function resizeCanvas() {
    cellSize = computeCellSize();
    document.documentElement.style.setProperty('--cell-size', cellSize + 'px');

    const logW = COLS * cellSize;
    const logH = ROWS * cellSize;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    gameCanvas.style.width = logW + 'px';
    gameCanvas.style.height = logH + 'px';
    gameCanvas.width = logW * dpr;
    gameCanvas.height = logH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ============================
  // AUDIO
  // ============================
  function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function playSFX(freq, dur, type = 'square', vol = 0.12) {
    if (!audioCtx) return;
    try {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + dur);
    } catch (e) {}
  }

  function sfxMove()     { playSFX(320, 0.04, 'sine', 0.06); }
  function sfxRotate()   { playSFX(520, 0.05, 'sine', 0.08); }
  function sfxDrop()     { playSFX(160, 0.08, 'triangle', 0.12); }
  function sfxLock()     { playSFX(220, 0.06, 'square', 0.08); }
  function sfxHold()     { playSFX(440, 0.06, 'sine', 0.07); }
  function sfxClear()    { playSFX(880, 0.18, 'sine', 0.12); }
  function sfxGameOver() {
    playSFX(200, 0.3, 'sawtooth', 0.1);
    setTimeout(() => playSFX(140, 0.4, 'sawtooth', 0.08), 200);
  }

  // ============================
  // BOARD
  // ============================
  function createBoard() {
    board = [];
    for (let r = 0; r < TOTAL_ROWS; r++) board.push(new Array(COLS).fill(null));
  }

  function isValid(cells, ox, oy) {
    for (const [cx, cy] of cells) {
      const nx = cx + ox, ny = cy + oy;
      if (nx < 0 || nx >= COLS || ny >= TOTAL_ROWS) return false;
      if (ny >= 0 && board[ny][nx]) return false;
    }
    return true;
  }

  function canMoveDown() {
    return currentPiece && isValid(currentPiece.cells, currentPiece.x, currentPiece.y + 1);
  }

  // ============================
  // BAG & QUEUE
  // ============================
  function shuffleBag() {
    const t = Object.keys(SHAPES);
    for (let i = t.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [t[i], t[j]] = [t[j], t[i]];
    }
    return t;
  }

  function fillQueue() {
    while (nextQueue.length < 5) {
      if (!bag.length) bag = shuffleBag();
      nextQueue.push(bag.pop());
    }
  }

  function pullNext() {
    fillQueue();
    const type = nextQueue.shift();
    fillQueue();
    return type;
  }

  // ============================
  // PIECE
  // ============================
  function createPiece(type) {
    return {
      type,
      cells: SHAPES[type].cells.map(c => [...c]),
      x: type === 'O' ? Math.floor(COLS / 2) - 1 : Math.floor(COLS / 2) - 2,
      y: HIDDEN_ROWS - 2,
      rotation: 0
    };
  }

  function rotateCells(cells, type) {
    if (type === 'O') return cells.map(c => [...c]);
    const size = type === 'I' ? 4 : 3;
    return cells.map(([x, y]) => [size - 1 - y, x]);
  }

  function tryRotate(piece) {
    if (piece.type === 'O') return false;
    const nc = rotateCells(piece.cells, piece.type);
    const kicks = piece.type === 'I' ? KICKS_I : KICKS_JLSTZ;
    for (const [kx, ky] of kicks[piece.rotation]) {
      if (isValid(nc, piece.x + kx, piece.y - ky)) {
        piece.cells = nc;
        piece.x += kx;
        piece.y -= ky;
        piece.rotation = (piece.rotation + 1) % 4;
        return true;
      }
    }
    return false;
  }

  function movePiece(dx, dy) {
    if (isValid(currentPiece.cells, currentPiece.x + dx, currentPiece.y + dy)) {
      currentPiece.x += dx;
      currentPiece.y += dy;
      return true;
    }
    return false;
  }

  function ghostY() {
    let gy = currentPiece.y;
    while (isValid(currentPiece.cells, currentPiece.x, gy + 1)) gy++;
    return gy;
  }

  // INSTANT LOCK — the moment a piece can't move down, it locks.
  function lockPiece() {
    for (const [cx, cy] of currentPiece.cells) {
      const ax = cx + currentPiece.x;
      const ay = cy + currentPiece.y;
      if (ay >= 0 && ay < TOTAL_ROWS) board[ay][ax] = currentPiece.type;
    }
    sfxLock();
    checkLines();
    holdUsed = false;
    spawnPiece();
  }

  function checkLines() {
    const rows = [];
    for (let r = 0; r < TOTAL_ROWS; r++) {
      if (board[r].every(c => c !== null)) rows.push(r);
    }
    if (rows.length) {
      lineClearRows = rows;
      lineClearTimer = LINE_CLEAR_DURATION;
      sfxClear();
      setTimeout(() => {
        for (const r of rows.sort((a, b) => b - a)) {
          board.splice(r, 1);
          board.unshift(new Array(COLS).fill(null));
        }
        lineClearRows = [];
      }, LINE_CLEAR_DURATION);
      score += LINE_SCORES[rows.length] * level;
      lines += rows.length;
      level = Math.floor(lines / 10) + 1;
      updateHUD();
    }
  }

  function spawnPiece() {
    currentPiece = createPiece(pullNext());
    dropTimer = 0;
    if (!isValid(currentPiece.cells, currentPiece.x, currentPiece.y)) gameOver();
    drawNext();
  }

  function doHold() {
    if (holdUsed) return;
    holdUsed = true;
    sfxHold();
    const type = currentPiece.type;
    if (holdPiece) {
      currentPiece = createPiece(holdPiece);
    } else {
      spawnPiece();
    }
    holdPiece = type;
    dropTimer = 0;
    drawHold();
  }

  function hardDrop() {
    let d = 0;
    while (movePiece(0, 1)) d++;
    score += d * HARD_DROP_SCORE;
    updateHUD();
    sfxDrop();
    lockPiece();
  }

  // ============================
  // HUD
  // ============================
  function updateHUD() {
    scoreDisplay.textContent = score.toLocaleString();
    levelDisplay.textContent = level;
    linesDisplay.textContent = lines;
  }

  // ============================
  // DRAWING
  // ============================
  function hexRGBA(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function drawCell(c, x, y, color, cs, alpha = 1, ghost = false) {
    const pad = 1;
    const rx = x * cs + pad, ry = y * cs + pad;
    const s = cs - pad * 2;
    const rad = Math.max(2, cs * 0.12);

    c.save();
    c.globalAlpha = alpha;

    if (ghost) {
      c.strokeStyle = hexRGBA(color, 0.35);
      c.lineWidth = 1.5;
      c.beginPath(); c.roundRect(rx, ry, s, s, rad); c.stroke();
      c.fillStyle = hexRGBA(color, 0.06);
      c.fill();
    } else {
      // Glass block: gradient fill + highlight + border
      const gr = c.createLinearGradient(rx, ry, rx + s, ry + s);
      gr.addColorStop(0, hexRGBA(color, 0.9));
      gr.addColorStop(1, hexRGBA(color, 0.55));
      c.fillStyle = gr;
      c.beginPath(); c.roundRect(rx, ry, s, s, rad); c.fill();

      // Top-left glass reflection
      const hl = c.createLinearGradient(rx, ry, rx + s * 0.5, ry + s * 0.5);
      hl.addColorStop(0, 'rgba(255,255,255,0.38)');
      hl.addColorStop(0.4, 'rgba(255,255,255,0.08)');
      hl.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = hl;
      c.beginPath(); c.roundRect(rx, ry, s, s, rad); c.fill();

      // Subtle inner shadow at bottom
      const bs = c.createLinearGradient(rx, ry + s * 0.6, rx, ry + s);
      bs.addColorStop(0, 'rgba(0,0,0,0)');
      bs.addColorStop(1, 'rgba(0,0,0,0.15)');
      c.fillStyle = bs;
      c.beginPath(); c.roundRect(rx, ry, s, s, rad); c.fill();

      // Border
      c.strokeStyle = hexRGBA(color, 0.4);
      c.lineWidth = 0.5;
      c.beginPath(); c.roundRect(rx, ry, s, s, rad); c.stroke();
    }
    c.restore();
  }

  function drawBoard() {
    const cs = cellSize;
    const w = COLS * cs, h = ROWS * cs;
    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * cs, 0); ctx.lineTo(c * cs, h); ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * cs); ctx.lineTo(w, r * cs); ctx.stroke();
    }

    // Locked cells
    for (let r = HIDDEN_ROWS; r < TOTAL_ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c]) {
          const clearing = lineClearRows.includes(r);
          const a = clearing ? (Math.sin(Date.now() / 40) * 0.5 + 0.5) : 1;
          drawCell(ctx, c, r - HIDDEN_ROWS, PIECE_COLORS[board[r][c]], cs, a);
        }
      }
    }

    if (!currentPiece || gamePhase !== 'playing') return;

    // Ghost
    const gy = ghostY();
    for (const [cx, cy] of currentPiece.cells) {
      const dy = cy + gy - HIDDEN_ROWS;
      if (dy >= 0) drawCell(ctx, cx + currentPiece.x, dy, PIECE_COLORS[currentPiece.type], cs, 1, true);
    }

    // Current piece
    for (const [cx, cy] of currentPiece.cells) {
      const dy = cy + currentPiece.y - HIDDEN_ROWS;
      if (dy >= 0) drawCell(ctx, cx + currentPiece.x, dy, PIECE_COLORS[currentPiece.type], cs);
    }
  }

  function drawHold() {
    const w = holdCanvas.width, h = holdCanvas.height;
    holdCtx.clearRect(0, 0, w, h);
    if (!holdPiece) return;

    const ms = Math.min(22, cellSize * 0.7);
    const cells = SHAPES[holdPiece].cells;
    let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
    for (const [x, y] of cells) { mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mny = Math.min(mny, y); mxy = Math.max(mxy, y); }
    const pw = (mxx - mnx + 1) * ms, ph = (mxy - mny + 1) * ms;

    holdCtx.save();
    holdCtx.translate((w - pw) / 2, (h - ph) / 2);
    for (const [x, y] of cells) {
      drawCell(holdCtx, x - mnx, y - mny, PIECE_COLORS[holdPiece], ms, holdUsed ? 0.35 : 1);
    }
    holdCtx.restore();
  }

  function drawNext() {
    const w = nextCanvas.width, h = nextCanvas.height;
    nextCtx.clearRect(0, 0, w, h);

    const ms = Math.min(17, cellSize * 0.55);
    const spacing = h / 5;

    for (let i = 0; i < Math.min(nextQueue.length, 5); i++) {
      const type = nextQueue[i];
      const cells = SHAPES[type].cells;
      let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
      for (const [x, y] of cells) { mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mny = Math.min(mny, y); mxy = Math.max(mxy, y); }
      const pw = (mxx - mnx + 1) * ms, ph = (mxy - mny + 1) * ms;

      nextCtx.save();
      nextCtx.translate((w - pw) / 2, i * spacing + (spacing - ph) / 2);
      for (const [x, y] of cells) {
        drawCell(nextCtx, x - mnx, y - mny, PIECE_COLORS[type], ms, 1 - i * 0.12);
      }
      nextCtx.restore();
    }
  }

  // ============================
  // SPEED
  // ============================
  function dropInterval() {
    if (level <= 1) return 800;
    if (level <= 3) return 600;
    if (level <= 5) return 400;
    if (level <= 7) return 280;
    if (level <= 9) return 180;
    if (level <= 12) return 120;
    if (level <= 15) return 80;
    return 60;
  }

  // ============================
  // INPUT
  // ============================
  function handleInput(dt) {
    if (gamePhase !== 'playing') return;

    // Rotate
    if (justPressed['ArrowUp'] || justPressed['KeyX']) {
      if (tryRotate(currentPiece)) sfxRotate();
    }

    // Hold
    if (justPressed['KeyC'] || justPressed['ShiftLeft'] || justPressed['ShiftRight']) {
      doHold();
    }

    // Hard drop
    if (justPressed['Space']) {
      hardDrop();
      return;
    }

    // Soft drop — accelerate falling, lock instantly when grounded
    if (keys['ArrowDown']) {
      if (movePiece(0, 1)) {
        score += SOFT_DROP_SCORE;
        dropTimer = 0;
      }
      // If piece is now sitting on something, lock it immediately
      if (!canMoveDown()) {
        lockPiece();
        return;
      }
    }

    // Horizontal DAS
    let hDir = 0;
    if (justPressed['ArrowLeft'])       { hDir = -1; dasKey = 'ArrowLeft'; dasTimer = 0; dasActive = false; }
    else if (justPressed['ArrowRight']) { hDir = 1; dasKey = 'ArrowRight'; dasTimer = 0; dasActive = false; }
    else if (keys['ArrowLeft'] && dasKey === 'ArrowLeft') {
      dasTimer += dt;
      if (dasTimer >= DAS_DELAY) { if (!dasActive) { dasActive = true; dasTimer = DAS_DELAY; } if (dasTimer >= DAS_DELAY + DAS_REPEAT) { hDir = -1; dasTimer = DAS_DELAY; } }
    }
    else if (keys['ArrowRight'] && dasKey === 'ArrowRight') {
      dasTimer += dt;
      if (dasTimer >= DAS_DELAY) { if (!dasActive) { dasActive = true; dasTimer = DAS_DELAY; } if (dasTimer >= DAS_DELAY + DAS_REPEAT) { hDir = 1; dasTimer = DAS_DELAY; } }
    }
    else { dasKey = null; dasTimer = 0; dasActive = false; }

    if (hDir && movePiece(hDir, 0)) sfxMove();
  }

  // ============================
  // GAME LOOP
  // ============================
  function update(dt) {
    if (gamePhase !== 'playing') return;
    if (lineClearTimer > 0) { lineClearTimer -= dt; return; }

    handleInput(dt);

    // Gravity
    dropTimer += dt;
    if (dropTimer >= dropInterval()) {
      dropTimer -= dropInterval();
      if (!movePiece(0, 1)) {
        // INSTANT LOCK — piece can't move down, lock it now
        lockPiece();
        return;
      }
    }

    // Also check: if after any input the piece is sitting on something, lock next gravity tick.
    // But we only lock on gravity failure above — this keeps it instant yet fair.
  }

  let prevTime = 0;
  function gameLoop(ts) {
    rafId = requestAnimationFrame(gameLoop);
    const dt = Math.min(ts - prevTime, 100);
    prevTime = ts;
    update(dt);
    drawBoard();
    for (const k in justPressed) delete justPressed[k];
  }

  // ============================
  // GAME FLOW
  // ============================
  function startGame() {
    initAudio();
    createBoard();
    bag = shuffleBag();
    nextQueue = [];
    fillQueue();
    holdPiece = null;
    holdUsed = false;
    score = 0; level = 1; lines = 0;
    dropTimer = 0;
    lineClearRows = [];
    lineClearTimer = 0;
    dasKey = null; dasTimer = 0; dasActive = false;

    updateHUD();
    resizeCanvas();
    drawHold();
    spawnPiece();
    showScreen('game');
    gamePhase = 'playing';
    prevTime = performance.now();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(gameLoop);
  }

  function pauseGame() {
    if (gamePhase !== 'playing') return;
    gamePhase = 'paused';
    pauseOverlay.classList.add('active');
  }

  function resumeGame() {
    if (gamePhase !== 'paused') return;
    gamePhase = 'playing';
    pauseOverlay.classList.remove('active');
    prevTime = performance.now();
  }

  function gameOver() {
    gamePhase = 'gameover';
    sfxGameOver();
    finalScore.textContent = score.toLocaleString();
    finalLevel.textContent = level;
    finalLines.textContent = lines;
    gameoverOverlay.classList.add('active');
  }

  function showScreen(name) {
    startScreen.classList.remove('active');
    gameScreen.classList.remove('active');
    pauseOverlay.classList.remove('active');
    gameoverOverlay.classList.remove('active');
    if (name === 'start') startScreen.classList.add('active');
    if (name === 'game') gameScreen.classList.add('active');
  }

  // ============================
  // EVENTS
  // ============================
  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;

    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (gamePhase === 'playing') pauseGame();
      else if (gamePhase === 'paused') resumeGame();
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  });

  document.addEventListener('keyup', (e) => { keys[e.code] = false; });

  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('resume-btn').addEventListener('click', resumeGame);
  document.getElementById('restart-btn').addEventListener('click', () => {
    gameoverOverlay.classList.remove('active');
    startGame();
  });

  window.addEventListener('resize', () => {
    if (gamePhase === 'playing' || gamePhase === 'paused') resizeCanvas();
  });

  // ============================
  // TEST HOOKS
  // ============================
  window.render_game_to_text = function () {
    const pc = currentPiece ? { type: currentPiece.type, x: currentPiece.x, y: currentPiece.y - HIDDEN_ROWS, rotation: currentPiece.rotation } : null;
    return JSON.stringify({ phase: gamePhase, score, level, lines, currentPiece: pc, holdPiece, nextQueue: nextQueue.slice(0, 3), ghostY: currentPiece ? ghostY() - HIDDEN_ROWS : null });
  };

  window.advanceTime = function (ms) {
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i++) update(1000 / 60);
    drawBoard();
  };

  // ============================
  // INIT
  // ============================
  showScreen('start');
  resizeCanvas();
})();
