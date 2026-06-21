const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PROJECT_DIR = path.join(__dirname, '..');
function readFile(p) { return fs.readFileSync(path.join(PUBLIC_DIR, p), 'utf-8'); }
function readProjectFile(p) { return fs.readFileSync(path.join(PROJECT_DIR, p), 'utf-8'); }

let pass = 0, fail = 0;
function check(name, fn) {
  console.log(`\n--- ${name} ---`);
  try { fn(); console.log('✓ OK'); pass++; }
  catch (e) { console.error(`!!! ${e.message}`); fail++; }
}

function setupCtx(myId) {
  const sandbox = {
    console, setTimeout, clearTimeout, Promise, Math, Date, Array, Object, JSON, String, Number, Boolean,
    document: {
      createElement: () => ({ appendChild: () => {} }),
      head: { appendChild: function() {} },
      body: { appendChild: function() {} },
      getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    },
  };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext([
    'globalThis.AudioManager = { init: () => {}, unlock: () => {}, toggleMute: () => false, bgm: () => {}, sfx: () => {}, setVolume: () => {}, muted: false };',
    readFile('js/ui.js'),
    readFile('js/views.js'),
    'globalThis.UI = UI; globalThis.Views = Views;',
  ].join('\n'), ctx, { filename: 'combined.js' });
  ctx.Client = { socket: { id: myId || 'mock-id' } };
  return ctx;
}

check('lobby pakai design system Nintendo', () => {
  const ctx = setupCtx();
  const result = ctx.Views.lobby({ selectedMode: '1v1' });
  if (!result.includes('n-nav')) throw new Error('harus ada top nav');
  if (!result.includes('n-hero')) throw new Error('harus ada hero panel');
  if (!result.includes('n-btn--submit')) throw new Error('harus ada submit button');
  if (!result.includes('KANJI DUEL')) throw new Error('harus ada brand text');
});

check('room: HOST btn-start, GUEST btn-ready', () => {
  const hostCtx = setupCtx('host-id');
  const hostResult = hostCtx.Views.room({
    code: 'ABC123', mode: '1v1', capacity: 2, canStart: true,
    players: [
      { id: 'host-id', name: 'Host', team: 1, host: true, ready: false },
      { id: 'guest-id', name: 'Guest', team: 2, host: false, ready: true },
    ],
  });
  if (!hostResult.includes('id="btn-start"')) throw new Error('HOST btn-start');
  if (!hostResult.includes('MULAI PERTANDINGAN')) throw new Error('HOST btn-start text');

  const guestCtx = setupCtx('guest-id-1');
  const guestResult = guestCtx.Views.room({
    code: 'ABC123', mode: '1v1', capacity: 2, canStart: false,
    players: [
      { id: 'host-id', name: 'Host', team: 1, host: true, ready: false },
      { id: 'guest-id-1', name: 'Guest', team: 2, host: false, ready: false },
    ],
  });
  if (!guestResult.includes('id="btn-ready"')) throw new Error('GUEST btn-ready');
  if (!guestResult.includes('SAYA SIAP')) throw new Error('GUEST belum ready');
});

check('battle pakai design system Nintendo', () => {
  const ctx = setupCtx('host-id');
  const result = ctx.Views.battle({
    roomCode: 'ABC123', mode: '1v1',
    players: [
      { id: 'host-id', name: 'Host', team: 1, host: true, ready: false, hp: 100 },
      { id: 'guest-id', name: 'Guest', team: 2, host: false, ready: true, hp: 100 },
    ],
    roundNumber: 1, maxRounds: 10,
    question: { kanji: '日' },
    options: ['Matahari / Hari', 'Bulan', 'Bintang'],
    answered: false, selectedAnswer: null, lastResult: null,
  });
  if (!result.includes('n-kanji')) throw new Error('kanji display');
  if (!result.includes('n-timer')) throw new Error('timer');
  if (!result.includes('n-answer__btn')) throw new Error('answer buttons');
  if (!result.includes('data-answer="Matahari / Hari"')) throw new Error('data-answer');
});

check('battle: HP bar color-coded', () => {
  const ctx = setupCtx();
  const result = ctx.Views.battle({
    roomCode: 'ABC', mode: '1v1',
    players: [
      { id: 'p1', name: 'H', team: 1, host: true, ready: false, hp: 100 },
      { id: 'p2', name: 'G', team: 2, host: false, ready: true, hp: 25 },
    ],
    roundNumber: 1, maxRounds: 10,
    question: { kanji: '日' }, options: ['A', 'B', 'C'],
    answered: false, selectedAnswer: null, lastResult: null,
  });
  if (!result.includes('n-castle__hp-fill--good')) throw new Error('HP good');
  if (!result.includes('n-castle__hp-fill--danger')) throw new Error('HP danger');
});

check('battle: shield & damage badge', () => {
  const ctx = setupCtx();
  const result = ctx.Views.battle({
    roomCode: 'ABC', mode: '1v1',
    players: [
      { id: 'p1', name: 'H', team: 1, host: true, ready: false, hp: 100 },
      { id: 'p2', name: 'G', team: 2, host: false, ready: true, hp: 90 },
    ],
    roundNumber: 2, maxRounds: 10,
    question: { kanji: '月' }, options: ['Bulan', 'Matahari', 'Tahun'],
    answered: true, selectedAnswer: 'Bulan',
    lastResult: {
      roundNumber: 1, correctAnswer: 'Bulan',
      results: [
        { playerId: 'p1', name: 'H', team: 1, correct: true, shielded: true, damage: 0 },
        { playerId: 'p2', name: 'G', team: 2, correct: false, shielded: false, damage: 10 },
      ],
    },
  });
  if (!result.includes('n-castle__badge--shield')) throw new Error('shield badge');
  if (!result.includes('SHIELD')) throw new Error('SHIELD text');
  if (!result.includes('n-castle__badge--damage')) throw new Error('damage badge');
  if (!result.includes('−10')) throw new Error('damage -10');
});

check('modal pakai design system', () => {
  const ctx = setupCtx();
  const result = ctx.Views.roundResultModal({
    roundNumber: 1, correctAnswer: 'Air',
    results: [{ playerId: 'p1', name: 'P1', team: 1, correct: true, submitted: 'Air', shielded: true, damage: 0 }],
  });
  if (!result.includes('n-modal-backdrop')) throw new Error('modal backdrop');
  if (!result.includes('n-modal__header')) throw new Error('modal header');
  if (!result.includes('n-modal__body')) throw new Error('modal body');
  if (!result.includes('n-modal__actions')) throw new Error('modal actions');
});

check('roomList renders available rooms', () => {
  const ctx = setupCtx();
  const result = ctx.Views.roomList([
    { code: 'ABC123', mode: '1v1', hostName: 'Host1', players: 1, capacity: 2 },
    { code: 'XYZ789', mode: '2v2', hostName: 'Host2', players: 2, capacity: 4 },
  ]);
  if (!result.includes('ABC123')) throw new Error('harus ada code ABC123');
  if (!result.includes('XYZ789')) throw new Error('harus ada code XYZ789');
  if (!result.includes('data-join-room=')) throw new Error('harus ada data-join-room attribute');
  if (!result.includes('Host1')) throw new Error('harus ada hostName Host1');
});

check('roomList renders empty state', () => {
  const ctx = setupCtx();
  const result = ctx.Views.roomList([]);
  if (!result.includes('Belum ada room')) throw new Error('harus tampil empty state');
});

check('footer dengan ESRB badge', () => {
  const ctx = setupCtx();
  const result = ctx.Views.footer();
  if (!result.includes('n-footer')) throw new Error('footer');
  if (!result.includes('n-footer__esrb')) throw new Error('ESRB badge');
  if (!result.includes('ESRB')) throw new Error('ESRB text');
});

check('audio.js API lengkap (BGM + SFX + control)', () => {
  const code = readFile('js/audio.js');
  const required = ['init', 'unlock', 'playBGM', 'stopBGM', 'playSFX', 'sfx(', 'bgm(', 'toggleMute', 'setVolume', 'localStorage'];
  for (const m of required) {
    if (!code.includes(m)) throw new Error(`AudioManager.${m} tidak ada`);
  }
});

check('client.js: audio lifecycle integrated', () => {
  const code = readFile('js/client.js');
  const triggers = [
    "AudioManager.bgm('battle')",
    "AudioManager.bgm('room')",
    "AudioManager.bgm('lobby')",
    "AudioManager.bgm('victory')",
    "AudioManager.bgm('defeat')",
    "AudioManager.sfx('click')",
    "AudioManager.sfx('correct')",
    "AudioManager.sfx('wrong')",
    "AudioManager.sfx('shield')",
    "AudioManager.sfx('explosion')",
    "AudioManager.sfx('tick')",
  ];
  for (const t of triggers) {
    if (!code.includes(t)) throw new Error(`'${t}' tidak dipanggil`);
  }
});

check('CSS nintendo.css design tokens lengkap', () => {
  const css = readFile('css/nintendo.css');
  if (!css.includes('#e60012')) throw new Error('Nintendo Red');
  if (!css.includes('#f68d1f')) throw new Error('Signal Orange');
  if (!css.includes('#ecab37')) throw new Error('Amber');
  if (!css.includes('#7a8aba')) throw new Error('Periwinkle canvas');
  if (!css.includes('#21242e')) throw new Error('Carbon Navy');
  if (!css.includes('halftone')) throw new Error('halftone texture');
  if (!css.includes('bevel')) throw new Error('bevel border');
  if (!css.includes('touch-action: manipulation')) throw new Error('touch optimization');
  if (!css.includes('44px')) throw new Error('touch target 44px');
  if (!css.includes('@media (max-width: 600px)')) throw new Error('mobile breakpoint');
  if (!css.includes('@media (max-width: 380px)')) throw new Error('tiny android breakpoint');
});

check('CSS: tidak ada fixed width besar (aman mobile)', () => {
  const css = readFile('css/nintendo.css');
  const lines = css.split('\n');
  const big = lines.filter(line => {
    if (line.includes('max-width:') || line.includes('min-width:')) return false;
    const m = line.match(/(^|[\s;{])width:\s*(\d+)px/);
    return m && parseInt(m[2], 10) > 400;
  });
  if (big.length > 0) {
    throw new Error('Ada ' + big.length + ' fixed width > 400px');
  }
});

check('Server: Cache-Control no-store aktif', () => {
  const code = readProjectFile('server.js');
  if (!code.includes('no-store')) throw new Error('Server harus set no-store');
});

check('Server: SW sudah dihapus', () => {
  if (fs.existsSync(path.join(PUBLIC_DIR, 'sw.js'))) {
    throw new Error('sw.js masih ada');
  }
});

check('index.html load audio.js dan nintendo.css', () => {
  const html = readFile('index.html');
  if (!html.includes('nintendo.css')) throw new Error('harus load nintendo.css');
  if (!html.includes('audio.js')) throw new Error('harus load audio.js');
  if (!html.includes('serviceWorker')) throw new Error('harus ada SW unregister untuk clear cache lama');
});

console.log('\n=== HASIL ===');
console.log('✓ ' + pass + ' test PASS, ' + fail + ' FAIL');
process.exit(fail > 0 ? 1 : 0);
