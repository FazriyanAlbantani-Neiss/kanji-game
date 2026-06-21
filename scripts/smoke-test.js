/**
 * scripts/smoke-test.js
 * --------------------------------
 * Smoke test otomatis: jalankan server, lalu simulasikan 2 client
 * yang membuat room, join, start match, dan submit jawaban.
 *
 * Cara pakai:
 *   1. Terminal 1: node server.js
 *   2. Terminal 2: node scripts/smoke-test.js
 */

const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

function log(tag, msg) {
  console.log(`[${tag}] ${msg}`);
}

function createClient(name) {
  const socket = io(SERVER_URL, { transports: ['websocket'] });
  socket.on('connect', () => log(name, `connected: ${socket.id}`));
  socket.on('error', (e) => log(name, `ERROR: ${JSON.stringify(e)}`));
  return socket;
}

async function main() {
  const host = createClient('HOST');
  const guest = createClient('GUEST');

  await new Promise((r) => setTimeout(r, 500));

  // 1. Host create room
  const createResp = await new Promise((resolve) =>
    host.emit('room:create', { mode: '1v1', playerName: 'Host' }, resolve)
  );
  log('TEST', `room created: ${JSON.stringify(createResp)}`);
  const roomCode = createResp.roomCode;

  // 2. Guest join
  const joinResp = await new Promise((resolve) =>
    guest.emit('room:join', { roomCode, playerName: 'Guest' }, resolve)
  );
  log('TEST', `guest joined: ${JSON.stringify(joinResp)}`);

  // 3. Guest ready
  guest.emit('room:toggleReady');

  await new Promise((r) => setTimeout(r, 500));

  // 4. Subscribe ke round events di kedua client
  host.on('round:start', (d) => {
    log('HOST', `round started: kanji=${d.question.kanji} options=${JSON.stringify(d.options)} endsAt-delta=${d.endsAt - Date.now()}ms`);
    // Host jawab salah (pilih opsi index 0)
    setTimeout(() => host.emit('round:answer', { answer: d.options[0] }), 200);
  });
  guest.on('round:start', (d) => {
    log('GUEST', `round started: kanji=${d.question.kanji} options=${JSON.stringify(d.options)}`);
    // Guest jawab benar — cari yang = d.options... kita ambil yang pertama, kemungkinan salah,
    // jadi kita coba kedua dan ketiga
    setTimeout(() => {
      // Untuk smoke test, kita terima apapun; yang penting cek damage calculation
      guest.emit('round:answer', { answer: d.options[1] }, (resp) => {
        log('GUEST', `answer submit response: ${JSON.stringify(resp)}`);
      });
    }, 200);
  });

  host.on('round:result', (d) => {
    log('HOST', `ROUND RESULT: correct=${d.correctAnswer}`);
    d.results.forEach((r) => {
      log('HOST', `  ${r.name} [T${r.team}]: submitted=${r.submitted} correct=${r.correct} damage=${r.damage} shielded=${r.shielded}`);
    });
    d.players.forEach((p) => {
      log('HOST', `  ${p.name} HP now: ${p.hp}`);
    });
  });

  guest.on('round:result', (d) => {
    log('GUEST', `ROUND RESULT: correct=${d.correctAnswer}`);
  });

  // 5. Host start match
  await new Promise((r) => setTimeout(r, 200));
  log('TEST', 'host starting match...');
  host.emit('match:start');

  // 6. Tunggu 8 detik untuk 1 ronde penuh + sedikit
  await new Promise((r) => setTimeout(r, 8000));

  log('TEST', 'test complete, disconnecting');
  host.disconnect();
  guest.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
