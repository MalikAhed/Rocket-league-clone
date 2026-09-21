const $ = selector => document.querySelector(selector);
const defaults = {blue:{primary:'#1358bd',accent:'#151a20',finish:'gloss'},orange:{primary:'#e96c16',accent:'#151a20',finish:'gloss'}};
const paints = structuredClone(defaults);
try {
  const saved = JSON.parse(localStorage.getItem('rocket-soccer.garage'));
  for (const team of ['blue','orange']) for (const key of ['primary','accent','finish']) {
    const value = saved?.[team]?.[key];
    if (key === 'finish' ? ['gloss','matte'].includes(value) : /^#[0-9a-f]{6}$/i.test(value)) paints[team][key] = value;
  }
} catch {}

// Installed before the arena loads: navigation never depends on asset loading.
export function createGameMenu() {
  const menu = $('#game-menu'), message = $('#menu-message');
  const mapOnly = new URLSearchParams(location.search).has('mapOnly');
  let play = null, panel = 'home', team = 'blue', bot = 'nexto', mode = 'freeplay', busy = false, ready = false;
  let lastPad = [], navTime = 0, lastText = '';
  const buttons = () => [...menu.querySelector(`[data-panel="${panel}"]`).querySelectorAll('button,input,select')].filter(b => !b.disabled);
  function say(text = '', error = false) { message.textContent = text; message.dataset.error = String(error); }
  function show(name, focus = true) {
    panel = name; menu.hidden = false; document.body.dataset.menuOpen = 'true';
    for (const node of menu.querySelectorAll('[data-panel]')) node.hidden = node.dataset.panel !== name;
    if (name === 'garage') fillPaint();
    if (play && !play.active) { play.preview?.(name === 'garage'); play.setPaint?.(paints[name === 'garage' ? team : 'blue']); }
    if (focus) buttons()[0]?.focus();
  }
  function hide() { menu.hidden = true; document.body.dataset.menuOpen = 'false'; $('#scene').focus(); }
  function gameHUD(on) {
    $('#match-scoreboard').hidden = !on || mode !== 'offline';
    $('#boost-gauge').hidden = !on; $('#pause-game').hidden = !on;
    $('#freeplay-caption').hidden = !on || mode !== 'freeplay';
    if (!on) $('#match-announcement').hidden = true;
  }
  function fillPaint() {
    for (const key of ['primary','accent','finish']) $('#garage-'+key).value = paints[team][key];
    for (const b of menu.querySelectorAll('[data-paint-team]')) b.setAttribute('aria-pressed',String(b.dataset.paintTeam === team));
    const colors = team === 'blue' ? ['#1358bd','#087ed1','#16405f','#129b9b','#473ba4','#215b40'] : ['#e96c16','#d59b19','#ab2622','#af3858','#774497','#6d4020'];
    $('#paint-swatches').replaceChildren(...colors.map(color => {
      const b = document.createElement('button'); b.style.setProperty('--paint',color); b.setAttribute('aria-label','Paint '+color); b.setAttribute('aria-pressed',String(paints[team].primary === color));
      b.onclick = () => { paints[team].primary = color; savePaint(); fillPaint(); }; return b;
    }));
    play?.setPaint?.(paints[team]);
  }
  function savePaint() { try { localStorage.setItem('rocket-soccer.garage',JSON.stringify(paints)); } catch {} play?.setPaint?.(paints[team]); }
  for (const key of ['primary','accent','finish']) $('#garage-'+key).addEventListener('input',e => { paints[team][key] = e.target.value; savePaint(); });
  function setBusy(value) { busy = value; menu.setAttribute('aria-busy',String(value)); for (const b of menu.querySelectorAll('button,input,select')) b.disabled = value; }
  async function start(nextMode = mode) {
    if (busy) return;
    if (!ready || !play) { say('The arena is still loading. Play will be ready shortly.'); return; }
    mode = nextMode; setBusy(true); say(mode === 'offline' ? `Loading ${bot === 'seer' ? 'Seer v0' : bot.toUpperCase()}…` : 'Starting Free Play…');
    try {
      play.setPaint?.(paints.blue);
      if (play.start) await play.start(mode,bot,paints.orange);
      else if (mode === 'freeplay') play.setActive(true);
      else throw Error('Offline match setup is being connected. Free Play is available.');
      say(); hide(); gameHUD(true);
    } catch (error) { play.setPaused?.(true); say(error.message,true); }
    finally { setBusy(false); }
  }
  function pause() { if (!play?.active || busy) return; play.setPaused?.(true); show('pause'); }
  function resume() { if (!play?.active || busy) return; say(); play.setPaused?.(false); hide(); }
  function leave() { if (busy) return; play?.leave?.(); if (play?.active) play.setActive(false); gameHUD(false); say(); show('home'); }
  function back() {
    if (busy) return;
    if (menu.hidden) return pause();
    if (panel === 'pause') return resume();
    if (panel === 'results') return leave();
    show(panel === 'offline' ? 'play' : 'home');
  }
  menu.addEventListener('click',e => {
    const b = e.target.closest('button'); if (!b || busy) return;
    if (b.dataset.menu) { say(ready ? '' : 'Loading arena…'); if (b.dataset.menu === 'quit') { play?.leave?.(); gameHUD(false); } show(b.dataset.menu); }
    if (b.dataset.start) start(b.dataset.start);
    if (b.dataset.bot) { bot = b.dataset.bot; for (const n of menu.querySelectorAll('[data-bot]')) n.setAttribute('aria-pressed',String(n === b)); }
    if (b.dataset.paintTeam) { team = b.dataset.paintTeam; fillPaint(); }
    if (b.dataset.action === 'resume') resume();
    if (b.dataset.action === 'restart') start();
    if (b.dataset.action === 'leave') leave();
  });
  $('#pause-game').onclick = pause;
  function move(delta) { const list = buttons(), index = list.indexOf(document.activeElement); list[(index+delta+list.length)%list.length]?.focus(); }
  window.addEventListener('keydown',e => {
    if (e.code === 'Escape') { e.preventDefault(); back(); return; }
    if (menu.hidden || busy || /INPUT|SELECT/.test(document.activeElement?.tagName)) return;
    if (['ArrowDown','ArrowUp'].includes(e.code)) { e.preventDefault(); move(e.code === 'ArrowDown' ? 1 : -1); }
  });
  window.addEventListener('blur',() => { if (menu.hidden) pause(); });
  document.addEventListener('visibilitychange',() => { if (document.hidden && menu.hidden) pause(); });
  if (mapOnly) {
    menu.hidden = true;
    document.body.dataset.menuOpen = 'false';
    return { bind() {}, ready() {}, error(error) { console.error(error); }, update() {} };
  }
  show('home',false);
  return {
    bind(value) { play = value; play.onMatchEnd = state => { $('#match-winner').textContent = state.winner === 0 ? 'BLUE WINS!' : 'ORANGE WINS!'; $('#final-score').textContent = `${state.blueScore} — ${state.orangeScore}`; show('results'); }; play.onError = text => { pause(); say(text,true); }; play.preview?.(panel === 'garage'); play.setPaint?.(paints[panel === 'garage' ? team : 'blue']); },
    ready() { ready = true; say(); },
    error(error) { say(error.message ?? String(error),true); },
    update() {
      const pad = !new URLSearchParams(location.search).has('keyboardOnly') && document.hasFocus() ? [...(navigator.getGamepads?.() ?? [])].find(p => p?.connected) : null;
      const pressed = pad ? pad.buttons.map(b => b.pressed) : [];
      if (pressed[9] && !lastPad[9]) back();
      if (!menu.hidden && !busy && pad) {
        const now = performance.now(), direction = pressed[12] || pad.axes[1] < -.55 ? -1 : pressed[13] || pad.axes[1] > .55 ? 1 : 0;
        if (direction && now-navTime > 200) { move(direction); navTime = now; }
        if (pressed[0] && !lastPad[0]) { const target = buttons().includes(document.activeElement) ? document.activeElement : buttons()[0]; target?.click(); }
        if (pressed[1] && !lastPad[1]) back();
      }
      lastPad = pressed;
      if (!play?.active) return;
      const state = play.matchState;
      $('#boost-number').textContent = mode === 'freeplay' ? '∞' : String(Math.round(play.boost ?? 0));
      if (!state) return;
      $('#score-blue').textContent = state.blueScore; $('#score-orange').textContent = state.orangeScore;
      const seconds = state.overtime ? Math.floor(state.overtimeSeconds) : Math.ceil(state.remainingSeconds);
      $('#match-clock').textContent = `${state.overtime ? '+' : ''}${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
      const text = mode === 'offline' && state.phase === 'kickoff' ? (state.countdown || 'GO!') : play.celebrating ? (mode === 'freeplay' ? 'GOAL!' : `${state.scorer === 0 ? 'BLUE' : 'ORANGE'} SCORED!`) : '';
      if (text !== lastText) { $('#match-announcement').textContent = text; lastText = text; }
      $('#match-announcement').hidden = !text || !menu.hidden;
    }
  };
}

