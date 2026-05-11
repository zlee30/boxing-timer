/* ══════════════════════════════════════
   BOXING TIMER — app.js
══════════════════════════════════════ */

var audioCtx = null;

function getAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function beep(freq, dur, vol, type) {
  freq = freq || 880;
  dur  = dur  || 0.1;
  vol  = vol  || 0.4;
  type = type || 'sine';
  try {
    var ctx  = getAudio();
    var osc  = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type            = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.05);
  } catch (e) {}
}

function alarm() {
  var delays = [0, 180, 360, 540, 700, 860];
  var freqs  = [1046, 880, 1046, 880, 1046, 880];
  delays.forEach(function (d, i) {
    setTimeout(function () { beep(freqs[i], 0.16, 0.5, 'square'); }, d);
  });
}

function lapBeep() {
  beep(1046, 0.06, 0.3);
  setTimeout(function () { beep(1318, 0.1, 0.3); }, 80);
}

function startBeep() { beep(660, 0.08, 0.3); }

/* ── Helpers ── */
function pad(n) {
  return String(Math.floor(Math.abs(n))).padStart(2, '0');
}

function setDigits(ids, str) {
  ids.forEach(function (id, i) {
    var el = document.getElementById(id);
    if (el) el.textContent = str[i] || '0';
  });
}

function clearOnFocus(el) {
  el.value = '';
}

function clampVal(el, min, max) {
  var v = parseInt(el.value);
  if (isNaN(v) || el.value === '') v = 0;
  if (v < min) v = min;
  if (v > max) v = max;
  el.value = v;
}

/* ── Mode switch ── */
var currentMode = 'timer';

function switchMode() {
  currentMode = (currentMode === 'timer') ? 'stopwatch' : 'timer';
  var btn     = document.getElementById('modeSwitchBtn');
  var timerEl = document.getElementById('timerMode');
  var swEl    = document.getElementById('stopwatchMode');
  if (currentMode === 'stopwatch') {
    btn.textContent       = 'TIMER';
    timerEl.style.display = 'none';
    swEl.style.display    = 'flex';
  } else {
    btn.textContent       = 'STOPWATCH';
    timerEl.style.display = 'flex';
    swEl.style.display    = 'none';
  }
  beep(660, 0.06, 0.2);
}

/* ══════════════════════════════════════
   TIMER
══════════════════════════════════════ */
var tRunning = false;
var tPaused  = false;
var tIv      = null;
var tTotal   = 0;
var tRem     = 0;
var rTotal   = 0;
var rRem     = 0;
var isRest   = false;
var setting  = false;

var pv   = { ph: 0, pm: 0, ps: 0, rm: 0, rs: 0 };
var pmax = { ph: 23, pm: 59, ps: 59, rm: 59, rs: 59 };

function adj(id, dir) {
  var el = document.getElementById(id);
  var v  = parseInt(el.value) || 0;
  var mx = pmax[id];
  v += dir;
  if (v < 0)  v = mx;
  if (v > mx) v = 0;
  pv[id]   = v;
  el.value = v;
}

function tSetToggle() {
  if (tRunning) return;
  setting = !setting;
  var pickerEl = document.getElementById('pickersEl');
  var setBtn   = document.getElementById('tSetBtn');

  if (setting) {
    pickerEl.classList.add('show');
    setBtn.textContent = 'DONE';
    var h  = Math.floor(tTotal / 3600000);
    var m  = Math.floor((tTotal % 3600000) / 60000);
    var s  = Math.floor((tTotal % 60000)   / 1000);
    var rm = Math.floor(rTotal / 60000);
    var rs = Math.floor((rTotal % 60000)   / 1000);
    pv = { ph: h, pm: m, ps: s, rm: rm, rs: rs };
    ['ph','pm','ps','rm','rs'].forEach(function (id) {
      document.getElementById(id).value = pv[id];
    });

  } else {
    /* ── THIS } WAS MISSING — it closes the else block ── */
    pickerEl.classList.remove('show');
    setBtn.textContent = 'SET';
    var ph = parseInt(document.getElementById('ph').value) || 0;
    var pm = parseInt(document.getElementById('pm').value) || 0;
    var ps = parseInt(document.getElementById('ps').value) || 0;
    var rm2 = parseInt(document.getElementById('rm').value) || 0;
    var rs2 = parseInt(document.getElementById('rs').value) || 0;
    tTotal = (ph * 3600 + pm * 60 + ps) * 1000;
    rTotal = (rm2 * 60 + rs2) * 1000;
    tRem   = tTotal;
    rRem   = rTotal;
    updateTimerDisplay(tTotal);
    updateRestDisplay(rTotal);
  }
}

function tStartStop() {
  if (setting) tSetToggle();
  var startBtn = document.getElementById('tStartBtn');
  var prBtn    = document.getElementById('tPRBtn');

  if (!tRunning) {
    if (tTotal <= 0) { alert('Tap SET to set a time first'); return; }
    tRunning = true;
    tPaused  = false;
    isRest   = false;
    if (!tRem || tRem <= 0) tRem = tTotal;

    startBtn.textContent   = 'STOP';
    startBtn.style.cssText = 'background:linear-gradient(180deg,rgba(160,20,20,0.95),rgba(120,10,10,0.98));border-color:rgba(220,40,40,0.7);color:#fff;';
    prBtn.disabled         = false;
    prBtn.textContent      = 'PAUSE';
    prBtn.style.cssText    = 'background:linear-gradient(180deg,rgba(160,80,10,0.95),rgba(120,55,5,0.98));border-color:rgba(220,120,20,0.7);color:#fff;';

    colonsOn();
    startBeep();
    var last = performance.now();

    tIv = setInterval(function () {
      if (tPaused) return;
      var now = performance.now();
      var dt  = now - last;
      last    = now;
      if (isRest) {
        rRem -= dt;
        updateRestDisplay(rRem);
        setCycle('REST');
        if (rRem <= 0) {
          rRem = rTotal; isRest = false; tRem = tTotal;
          alarm(); flashScreen(); setCycle('TIMER');
        }
      } else {
        tRem -= dt;
        updateTimerDisplay(tRem);
        if (tRem <= 0) {
          tRem = 0; updateTimerDisplay(0); alarm(); flashScreen();
          if (rTotal > 0) { isRest = true; rRem = rTotal; setCycle('REST'); }
          else { tRem = tTotal; setCycle('TIMER'); }
        }
      }
    }, 16);

  } else {
    clearInterval(tIv);
    tRunning = false; tPaused = false; isRest = false;
    startBtn.textContent   = 'START';
    startBtn.style.cssText = '';
    prBtn.disabled         = true;
    prBtn.textContent      = 'PAUSE';
    prBtn.style.cssText    = 'background:linear-gradient(180deg,rgba(160,80,10,0.95),rgba(120,55,5,0.98));border-color:rgba(220,120,20,0.7);color:#fff;';
    tRem = tTotal; rRem = rTotal;
    updateTimerDisplay(tTotal);
    updateRestDisplay(rTotal);
    setCycle('');
    colonsOff();
    beep(440, 0.12, 0.3);
  }
}

function tPauseResume() {
  if (!tRunning) return;
  tPaused = !tPaused;
  var prBtn = document.getElementById('tPRBtn');
  if (tPaused) {
    prBtn.textContent   = 'RESUME';
    prBtn.style.cssText = 'background:linear-gradient(180deg,rgba(80,100,60,0.95),rgba(55,75,35,0.98));border-color:rgba(138,158,114,0.6);color:#fff;';
    ['tC1','tC2'].forEach(function (id) {
      var el = document.getElementById(id);
      el.style.animation = 'none';
      el.style.opacity   = '0.12';
    });
    beep(440, 0.08, 0.25);
  } else {
    prBtn.textContent   = 'PAUSE';
    prBtn.style.cssText = 'background:linear-gradient(180deg,rgba(160,80,10,0.95),rgba(120,55,5,0.98));border-color:rgba(220,120,20,0.7);color:#fff;';
    ['tC1','tC2'].forEach(function (id) {
      var el = document.getElementById(id);
      el.style.animation = '';
      el.style.opacity   = '';
    });
    beep(660, 0.08, 0.25);
  }
}

function tReset() {
  if (tIv) clearInterval(tIv);
  tRunning = false; tPaused = false; isRest = false;
  tRem = tTotal; rRem = rTotal;
  var startBtn = document.getElementById('tStartBtn');
  var prBtn    = document.getElementById('tPRBtn');
  startBtn.textContent   = 'START';
  startBtn.style.cssText = '';
  prBtn.disabled         = true;
  prBtn.textContent      = 'PAUSE';
  prBtn.style.cssText    = 'background:linear-gradient(180deg,rgba(160,80,10,0.95),rgba(120,55,5,0.98));border-color:rgba(220,120,20,0.7);color:#fff;';
  updateTimerDisplay(tTotal);
  updateRestDisplay(rTotal);
  setCycle('');
  colonsOff();
  beep(440, 0.1, 0.2);
}

function updateTimerDisplay(ms) {
  ms = Math.max(0, ms);
  var h  = Math.floor(ms / 3600000);
  var m  = Math.floor((ms % 3600000) / 60000);
  var s  = Math.floor((ms % 60000)   / 1000);
  var cs = Math.floor((ms % 1000)    / 10);
  setDigits(['tH1','tH2','tM1','tM2','tS1','tS2'], pad(h) + pad(m) + pad(s));
  document.getElementById('tMs').textContent = '.' + pad(cs);
}

function updateRestDisplay(ms) {
  ms = Math.max(0, ms);
  var m = Math.floor(ms / 60000);
  var s = Math.floor((ms % 60000) / 1000);
  document.getElementById('restVal').textContent = pad(m) + ':' + pad(s);
}

function setCycle(state) {
  var el = document.getElementById('cycleEl');
  if (state === 'REST')       { el.textContent = '● REST';   el.className = 'cycle-badge rest'; }
  else if (state === 'TIMER') { el.textContent = '● ACTIVE'; el.className = 'cycle-badge'; }
  else                        { el.textContent = '';          el.className = 'cycle-badge'; }
}

function colonsOn() {
  ['tC1','tC2'].forEach(function (id) {
    var el = document.getElementById(id);
    el.classList.remove('off');
    el.style.animation = '';
    el.style.opacity   = '';
  });
}

function colonsOff() {
  ['tC1','tC2'].forEach(function (id) {
    var el = document.getElementById(id);
    el.classList.add('off');
    el.style.animation = 'none';
    el.style.opacity   = '0.12';
  });
}

function flashScreen() {
  var lcd = document.querySelector('#timerMode .t-screen');
  lcd.classList.remove('alarm-flash');
  void lcd.offsetWidth;
  lcd.classList.add('alarm-flash');
}

/* ══════════════════════════════════════
   STOPWATCH
══════════════════════════════════════ */
var swRunning  = false;
var swElapsed  = 0;
var swLapStart = 0;
var swLaps     = [];
var swIv       = null;

function swStartStop() {
  var startBtn = document.getElementById('swStartBtn');
  var lapBtn   = document.getElementById('swLapBtn');
  var colon    = document.getElementById('swCol');
  if (!swRunning) {
    swRunning              = true;
    startBtn.textContent   = 'STOP';
    startBtn.style.cssText = 'background:linear-gradient(180deg,rgba(160,20,20,0.95),rgba(120,10,10,0.98));border-color:rgba(220,40,40,0.7);color:#fff;';
    lapBtn.disabled        = false;
    colon.classList.remove('off');
    startBeep();
    var last = performance.now();
    swIv = setInterval(function () {
      var now = performance.now();
      swElapsed += now - last;
      last = now;
      updateSwDisplay(swElapsed);
    }, 16);
  } else {
    swRunning              = false;
    clearInterval(swIv);
    startBtn.textContent   = 'START';
    startBtn.style.cssText = '';
    lapBtn.disabled        = true;
    colon.classList.add('off');
    beep(440, 0.1, 0.25);
  }
}

function swLap() {
  if (!swRunning) return;
  var lapTime = swElapsed - swLapStart;
  swLapStart  = swElapsed;
  swLaps.push(lapTime);
  lapBeep();
  renderLaps();
}

function swReset() {
  if (swIv) clearInterval(swIv);
  swRunning  = false;
  swElapsed  = 0;
  swLapStart = 0;
  swLaps     = [];
  var startBtn = document.getElementById('swStartBtn');
  var lapBtn   = document.getElementById('swLapBtn');
  startBtn.textContent   = 'START';
  startBtn.style.cssText = '';
  lapBtn.disabled        = true;
  document.getElementById('swCol').classList.add('off');
  document.getElementById('lapsWrap').style.display = 'none';
  document.getElementById('lapsList').innerHTML     = '';
  updateSwDisplay(0);
  beep(440, 0.1, 0.2);
}

function renderLaps() {
  var list = document.getElementById('lapsList');
  var wrap = document.getElementById('lapsWrap');
  if (swLaps.length === 0) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  var fastest = Math.min.apply(null, swLaps);
  var slowest = Math.max.apply(null, swLaps);
  var html = swLaps.slice().reverse().map(function (t, ri) {
    var i   = swLaps.length - 1 - ri;
    var cls = 'lap-item';
    if (swLaps.length > 1) {
      if (t === fastest) cls += ' best';
      else if (t === slowest) cls += ' worst';
    }
    return '<div class="' + cls + '"><span class="ln">' + (i+1) + '</span><span class="lt">' + fmtLap(t) + '</span></div>';
  }).join('');
  list.innerHTML = html;
}

function fmtLap(ms) {
  var m  = Math.floor(ms / 60000);
  var s  = Math.floor((ms % 60000) / 1000);
  var cs = Math.floor((ms % 1000)  / 10);
  return pad(m) + ':' + pad(s) + '.' + pad(cs);
}

function updateSwDisplay(ms) {
  var m  = Math.floor(ms / 60000) % 60;
  var s  = Math.floor(ms / 1000)  % 60;
  var cs = Math.floor((ms % 1000) / 10);
  setDigits(['swM1','swM2','swS1','swS2'], pad(m) + pad(s));
  document.getElementById('swMs').textContent = '.' + pad(cs);
}

/* ── Init ── */
updateTimerDisplay(0);
updateRestDisplay(0);
document.getElementById('timerMode').style.display     = 'flex';
document.getElementById('stopwatchMode').style.display = 'none';