/**
 * scripts/full-e2e-test.js
 * Test full E2E: 2-player flow + room list auto-detect.
 */

const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

let pass = 0, fail = 0;
function check(name, fn) {
  console.log('\n--- ' + name + ' ---');
  try { fn(); console.log('✓ OK'); pass++; }
  catch (e) { console.error('!!! ' + e.message); fail++; }
}

function emit(socket, event, payload) {
  return new Promise((resolve) => {
    socket.emit(event, payload, (resp) => resolve(resp));
    setTimeout(() => resolve({ ok: false, error: 'TIMEOUT' }), 3000);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('=== FULL E2E TEST ===\n');

  // Test 1: HTTP API
  check('GET /api/rooms return JSON array', async () => {
    const res = await fetch(SERVER_URL + '/api/rooms');
    if (!res.ok) throw new Error('Status ' + res.status);
    const list = await res.json();
    if (!Array.isArray(list)) throw new Error('Bukan array');
  });

  // Setup host
  const hostSocket = io(SERVER_URL, { transports: ['websocket'] });
  await new Promise(r => hostSocket.on('connect', r));

  // Track latest room:update on host
  let hostLatestUpdate = null;
  hostSocket.on('room:update', (data) => { hostLatestUpdate = data; });

  console.log('\nStep 1: HOST create room');
  const createResp = await emit(hostSocket, 'room:create', { mode: '1v1', playerName: 'Host' });
  if (!createResp?.ok) throw new Error('Create gagal: ' + JSON.stringify(createResp));
  const roomCode = createResp.roomCode;
  console.log('  Room code: ' + roomCode);

  await sleep(300); // tunggu broadcast

  check('API /api/rooms menampilkan room baru', async () => {
    const res = await fetch(SERVER_URL + '/api/rooms');
    const list = await res.json();
    const found = list.find(r => r.code === roomCode);
    if (!found) throw new Error('Room tidak ada di list');
    if (found.hostName !== 'Host') throw new Error('Host name salah');
    if (found.players !== 1) throw new Error('Player count salah');
    if (found.mode !== '1v1') throw new Error('Mode salah');
  });

  // Test 3: setup guest
  const guestSocket = io(SERVER_URL, { transports: ['websocket'] });
  await new Promise(r => guestSocket.on('connect', r));
  let guestLatestUpdate = null;
  guestSocket.on('room:update', (data) => { guestLatestUpdate = data; });

  console.log('\nStep 2: GUEST join room');
  const joinResp = await emit(guestSocket, 'room:join', { roomCode, playerName: 'Guest' });
  if (!joinResp?.ok) throw new Error('Join gagal');

  await sleep(300);

  check('Kedua client melihat 2 pemain', () => {
    if (!hostLatestUpdate || hostLatestUpdate.players.length !== 2) throw new Error('Host players=' + (hostLatestUpdate?.players?.length));
    if (!guestLatestUpdate || guestLatestUpdate.players.length !== 2) throw new Error('Guest players=' + (guestLatestUpdate?.players?.length));
  });

  console.log('\nStep 3: GUEST klik ready');
  const readyResp = await emit(guestSocket, 'room:toggleReady', null);
  if (!readyResp?.ok || readyResp.ready !== true) throw new Error('Toggle ready gagal: ' + JSON.stringify(readyResp));

  await sleep(300);

  check('canStart=true setelah guest ready', () => {
    if (!hostLatestUpdate || !hostLatestUpdate.canStart) throw new Error('Host canStart=' + hostLatestUpdate?.canStart);
  });

  console.log('\nStep 4: HOST klik mulai');
  const roundStartPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout round:start')), 5000);
    hostSocket.once('round:start', (data) => { clearTimeout(timer); resolve(data); });
  });
  const startResp = await emit(hostSocket, 'match:start', null);
  if (!startResp?.ok) throw new Error('Start gagal: ' + JSON.stringify(startResp));
  const roundData = await roundStartPromise;

  check('round:start diterima HOST dengan question valid', () => {
    if (!roundData.question || !roundData.question.kanji) throw new Error('Question tidak ada');
    if (!roundData.options || roundData.options.length !== 3) throw new Error('Options bukan 3');
  });

  // Guest juga harus menerima round:start
  const guestRoundPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout guest round:start')), 3000);
    guestSocket.once('round:start', (data) => { clearTimeout(timer); resolve(data); });
  });
  const guestRound = await guestRoundPromise;

  check('Guest juga menerima round:start dengan data sama', () => {
    if (guestRound.question.kanji !== roundData.question.kanji) throw new Error('Kanji beda');
    if (guestRound.options.join('|') !== roundData.options.join('|')) throw new Error('Options beda');
  });

  console.log('\nStep 5: Submit jawaban dari kedua player');
  const answer = roundData.options[0];
  const resultPromise1 = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout host result')), 3000);
    hostSocket.once('round:result', (data) => { clearTimeout(t); resolve(data); });
  });
  const resultPromise2 = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout guest result')), 3000);
    guestSocket.once('round:result', (data) => { clearTimeout(t); resolve(data); });
  });

  await emit(hostSocket, 'round:answer', { answer });
  await emit(guestSocket, 'round:answer', { answer });
  const [result1, result2] = await Promise.all([resultPromise1, resultPromise2]);

  check('Round result diterima kedua client dengan damage benar', () => {
    if (!result1.results || result1.results.length !== 2) throw new Error('Results bukan 2');
    // damage calculation berdasarkan jawaban yang sama (kedua player submit answer yg sama → damage sama)
    const damages = result1.results.map(r => r.damage);
    if (damages[0] !== damages[1]) throw new Error("Damage harus sama karena kedua player jawab sama, dapat [" + damages.join(",") + "]");
    if (result1.players[0].hp !== result1.players[1].hp) throw new Error("HP kedua player harus sama");
  });

  // Cleanup
  hostSocket.disconnect();
  guestSocket.disconnect();

  console.log('\n=== HASIL ===');
  console.log('✓ ' + pass + ' test PASS, ' + fail + ' FAIL');
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => { console.error('TEST ERROR:', err); process.exit(1); });
