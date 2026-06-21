/**
 * Kanji Duel — Server Entry
 * Express + Socket.IO server dengan room list auto-detect.
 */

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');

const Room = require('./game/Room');
const { loadQuestions } = require('./game/questionLoader');

const { updateLeaderboard, getLeaderboard } = require('./game/leaderboard');

const PORT = process.env.PORT || 3000;
const app = express();

app.use(cors({ origin: '*' }));

const server = http.createServer(app);
const io = new Server(server, { 
  cors: { 
    origin: '*',
    methods: ['GET', 'POST']
  } 
});

app.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  next();
});
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/rooms', (_req, res) => {
  res.json(getAvailableRooms());
});

app.get('/api/leaderboard', (_req, res) => {
  res.json(getLeaderboard());
});

function getAvailableRooms() {
  const list = [];
  for (const [code, room] of rooms.entries()) {
    if (room.status === 'lobby' && !room.isFull()) {
      list.push({
        code,
        mode: room.mode,
        level: room.level,
        hostName: (room.players.find(p => p.host) || {}).name || '?',
        players: room.players.length,
        capacity: room.capacity,
      });
    }
  }
  return list;
}

const rooms = new Map();

// --- BOT MANAGER ---
const BOT_NAMES = ['Hiroshi', 'Sakura', 'Kenji', 'Yuki', 'Takeshi', 'Akira', 'Mei', 'Ryota', 'Sora', 'Kaito', 'Rin', 'Ren'];

function createBot(botType = 'random') {
  let skill, type;
  const rand = Math.random();

  if (botType === 'random') {
    if (rand < 0.25) type = 'hoster';       // Suka bikin room
    else if (rand < 0.5) type = 'joiner';   // Suka gabung ke room orang
    else if (rand < 0.75) type = 'master';  // Jago jawab
    else type = 'noob';                     // Sering salah jawab
  } else {
    type = botType;
  }

  if (type === 'master') skill = 0.85 + Math.random() * 0.15; // 85% - 100%
  else if (type === 'noob') skill = 0.2 + Math.random() * 0.2; // 20% - 40%
  else skill = 0.4 + Math.random() * 0.4; // normal: 40% - 80%

  return {
    id: 'BOT_' + Math.random().toString(36).substr(2, 9),
    name: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
    isBot: true,
    botType: type,
    skill
  };
}

function attachBotHooksToRoom(room) {
  room.onMatchCreate = (match) => {
    match.onRoundStart = (round) => {
      const botsInMatch = match.players.filter(p => p.isBot);
      botsInMatch.forEach(b => {
        setTimeout(() => {
           if (!match.currentRound || match.currentRound.roundNumber !== round.roundNumber) return;
           const isCorrect = Math.random() < b.skill;
           let answer = round.correctAnswer;
           if (!isCorrect && round.options.length > 1) {
              const wrongOptions = round.options.filter(o => o !== round.correctAnswer);
              answer = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
           }
           match.submitAnswer(b.id, answer);
        }, 1500 + Math.random() * 4000); // Wait 1.5 - 5.5 detik sebelum menjawab
      });
    };
  };
}

function joinBotToRoom(room) {
  if (room.isFull()) return;
  const bot = createBot('joiner');
  const player = room.addPlayer(bot.id, bot.name);
  if (!player) return;
  player.isBot = true;
  player.skill = bot.skill;
  player.botType = bot.botType;
  player.ready = true;
  console.log(`[bot] ${bot.name} (tipe: ${bot.botType}) otomatis bergabung ke room ${room.code}`);
  room.broadcastState();
}

function createBotRoom() {
  const bot = createBot('hoster');
  const code = generateRoomCode();
  const mode = Math.random() > 0.5 ? '1v1' : '2v2';
  const levels = ['n5', 'n4', 'n3'];
  const level = levels[Math.floor(Math.random() * levels.length)];
  const questions = loadQuestions(level);
  
  const room = new Room(code, mode, level, io, questions);
  room.onGameFinish = (winner, finalPlayers) => {
    if (winner !== 'draw') {
       updateLeaderboard(winner, finalPlayers, level);
    }
    // Bot akan membubarkan room-nya setelah match berakhir (delay 5 detik)
    setTimeout(() => {
       const botsInRoom = room.players.filter(p => p.isBot);
       botsInRoom.forEach(b => room.removePlayer(b.id, { reason: 'bot_leave' }));
       if (room.isEmpty()) rooms.delete(code);
    }, 5000);
  };
  
  attachBotHooksToRoom(room);

  rooms.set(code, room);
  const player = room.addPlayer(bot.id, bot.name);
  player.isBot = true;
  player.skill = bot.skill;
  player.botType = bot.botType;
  player.ready = true;
  
  console.log(`[bot] ${bot.name} (tipe: ${bot.botType}) membuat room baru ${room.code}`);
  room.broadcastState();
}

let lastRoomActivity = Date.now();
// Jalankan pengecekan bot lebih cepat, setiap 3 detik
setInterval(() => {
  const now = Date.now();
  let hasOpenRoom = false;
  let activeBotsCount = 0;
  
  for (const room of rooms.values()) {
    activeBotsCount += room.players.filter(p => p.isBot).length;
    
    if (room.status === 'lobby' && !room.isFull()) {
      hasOpenRoom = true;
      if (now - room.createdAt > 20000 && activeBotsCount < 4) {
        // Jika room menganggur > 20 detik dan limit bot belum tercapai (Maks 4 bot di seluruh server)
        joinBotToRoom(room);
        room.createdAt = now; // Reset timer agar tidak kebanjiran bot sekaligus
      }
    }
    
    // Jika bot adalah host dan room sudah bisa dimulai, paksa bot memulai
    if (room.status === 'lobby' && room.canStart()) {
      const host = room.players.find(p => p.host);
      if (host && host.isBot) {
        room.startMatch();
        room.broadcastState();
      }
    }
  }

  if (hasOpenRoom) {
    lastRoomActivity = now;
  } else {
    // Jika tidak ada room terbuka sama sekali selama 45 detik
    if (now - lastRoomActivity > 45000 && activeBotsCount < 4) {
      createBotRoom();
      lastRoomActivity = now;
    }
  }
}, 3000);

function findRoomByPlayerName(playerName) {
  if (!playerName) return null;
  for (const room of rooms.values()) {
    const player = room.players.find(p => p.name === playerName);
    if (player) return room;
  }
  return null;
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');
  } while (rooms.has(code));
  return code;
}

// Broadcast room list setiap 3 detik ke SEMUA socket
setInterval(() => {
  io.emit('room:list', getAvailableRooms());
}, 3000);

io.on('connection', (socket) => {
  console.log('[connect] ' + socket.id);
  let currentRoom = null;

  socket.on('room:create', ({ mode, playerName, level }, cb) => {
    try {
      const existingRoom = findRoomByPlayerName(playerName);
      if (existingRoom) {
        // Return existing room if they are already in one
        const player = existingRoom.players.find(p => p.name === playerName);
        player.id = socket.id; // Update socket id
        currentRoom = existingRoom;
        socket.join(existingRoom.code);
        cb && cb({ ok: true, roomCode: existingRoom.code, roomMode: existingRoom.mode, player: { id: socket.id, ...player } });
        existingRoom.broadcastState();
        return;
      }

      if (!['1v1', '2v2'].includes(mode)) {
        return cb && cb({ ok: false, error: 'Mode tidak valid' });
      }
      const code = generateRoomCode();
      const questions = loadQuestions(level);
      const room = new Room(code, mode, level, io, questions);
      room.onGameFinish = (winner, finalPlayers) => {
        if (winner !== 'draw') {
           updateLeaderboard(winner, finalPlayers, level);
        }
      };
      
      // Tambahkan hook bot agar jika nanti ada bot masuk, dia bisa berpartisipasi
      attachBotHooksToRoom(room);

      rooms.set(code, room);

      const player = room.addPlayer(socket.id, playerName);
      currentRoom = room;
      socket.join(code);

      console.log('[room:create] ' + code + ' mode=' + mode + ' level=' + level + ' host=' + player.name);
      cb && cb({ ok: true, roomCode: code, roomMode: mode, player: { id: socket.id, ...player } });
      room.broadcastState();
    } catch (err) {
      console.error('[room:create] error', err);
      cb && cb({ ok: false, error: 'Gagal membuat room' });
    }
  });

  socket.on('room:join', ({ roomCode, playerName }, cb) => {
    try {
      const existingRoom = findRoomByPlayerName(playerName);
      const code = (roomCode || '').toUpperCase().trim();
      
      if (existingRoom) {
        if (existingRoom.code === code) {
          // Reclaim
          const player = existingRoom.players.find(p => p.name === playerName);
          player.id = socket.id;
          currentRoom = existingRoom;
          socket.join(existingRoom.code);
          cb && cb({ ok: true, roomCode: existingRoom.code, roomMode: existingRoom.mode, player: { id: socket.id, ...player } });
          existingRoom.broadcastState();
          return;
        } else {
          return cb && cb({ ok: false, error: 'Kamu sudah berada di room lain. Silakan keluar dulu.' });
        }
      }

      const room = rooms.get(code);
      if (!room) return cb && cb({ ok: false, error: 'Room tidak ditemukan' });
      if (room.status !== 'lobby') return cb && cb({ ok: false, error: 'Room sudah mulai' });
      if (room.isFull()) return cb && cb({ ok: false, error: 'Room penuh' });

      const player = room.addPlayer(socket.id, playerName);
      if (!player) {
         return cb && cb({ ok: false, error: 'Room penuh' });
      }

      currentRoom = room;
      socket.join(code);

      console.log('[room:join] ' + code + ' player=' + player.name);
      cb && cb({ ok: true, roomCode: code, roomMode: room.mode, player: { id: socket.id, ...player } });
      room.broadcastState();
    } catch (err) {
      console.error('[room:join] error', err);
      cb && cb({ ok: false, error: 'Gagal join room' });
    }
  });

  socket.on('room:toggleReady', (_payload, cb) => {
    if (!currentRoom) return cb && cb({ ok: false, error: 'Tidak di room' });
    const result = currentRoom.toggleReadyWithResult(socket.id);
    if (!result.ok) return cb && cb(result);
    cb && cb({ ok: true, ready: result.ready });
  });

  socket.on('room:switchTeam', (_payload, cb) => {
    if (!currentRoom) return cb && cb({ ok: false, error: 'Tidak di room' });
    const result = currentRoom.switchTeam(socket.id);
    cb && cb(result);
  });

  socket.on('match:start', (_payload, cb) => {
    console.log('[match:start] from ' + socket.id);
    if (!currentRoom) {
      const err = { ok: false, error: 'Kamu belum masuk room. Coba refresh halaman.' };
      socket.emit('error', { message: err.error });
      return cb && cb(err);
    }
    if (!currentRoom.isHost(socket.id)) {
      const err = { ok: false, error: 'Hanya host yang bisa memulai pertandingan' };
      socket.emit('error', { message: err.error });
      return cb && cb(err);
    }
    const started = currentRoom.startMatch();
    if (!started) {
      const reason = currentRoom.canStart() ? 'Tidak bisa memulai (coba lagi)' : 'Belum semua pemain siap';
      const err = { ok: false, error: reason };
      socket.emit('error', { message: reason });
      return cb && cb(err);
    }
    console.log('[match:start] ✓ match started in ' + currentRoom.code);
    cb && cb({ ok: true });
  });

  socket.on('round:answer', ({ answer }, cb) => {
    if (currentRoom && currentRoom.match) {
      const accepted = currentRoom.match.submitAnswer(socket.id, answer);
      cb && cb({ ok: accepted });
    } else {
      cb && cb({ ok: false, error: 'Tidak ada ronde aktif' });
    }
  });

  socket.on('room:kick', ({ playerId }, cb) => {
    try {
      if (!currentRoom) return cb && cb({ ok: false, error: 'Tidak di room' });
      if (!currentRoom.isHost(socket.id)) return cb && cb({ ok: false, error: 'Hanya host yang bisa kick' });

      const playerToKick = currentRoom.players.find(p => p.id === playerId);
      if (!playerToKick) return cb && cb({ ok: false, error: 'Player tidak ditemukan' });
      if (playerToKick.id === socket.id) return cb && cb({ ok: false, error: 'Tidak bisa kick diri sendiri' });

      console.log('[room:kick] ' + playerId + ' by ' + socket.id);
      
      // Emit to the specific player so they handle leaving
      io.to(playerId).emit('room:kicked');
      
      // We also forcefully remove them from the room logic immediately
      currentRoom.removePlayer(playerId, { reason: 'kicked' });
      
      cb && cb({ ok: true });
    } catch (err) {
      console.error('[room:kick] error', err);
      cb && cb({ ok: false, error: 'Gagal melakukan kick' });
    }
  });

  socket.on('room:chat', ({ text }, cb) => {
    try {
      if (!currentRoom) return cb && cb({ ok: false, error: 'Tidak di room' });
      const player = currentRoom.players.find(p => p.id === socket.id);
      if (!player) return cb && cb({ ok: false, error: 'Player tidak valid' });

      const cleanText = (text || '').trim().slice(0, 100);
      if (!cleanText) return cb && cb({ ok: false, error: 'Pesan kosong' });

      io.to(currentRoom.code).emit('room:chat', {
        playerId: socket.id,
        name: player.name,
        text: cleanText,
        time: Date.now()
      });
      cb && cb({ ok: true });
    } catch (err) {
      console.error('[room:chat] error', err);
      cb && cb({ ok: false, error: 'Gagal mengirim chat' });
    }
  });

  socket.on('room:leave', (_payload, cb) => {
    if (currentRoom) {
      console.log('[room:leave] ' + socket.id + ' from ' + currentRoom.code);
      currentRoom.removePlayer(socket.id, { reason: 'leave' });
      if (currentRoom.isEmpty()) rooms.delete(currentRoom.code);
      socket.leave(currentRoom.code);
      currentRoom = null;
    }
    cb && cb({ ok: true });
  });

  socket.on('disconnect', () => {
    console.log('[disconnect] ' + socket.id);
    if (currentRoom) {
      currentRoom.removePlayer(socket.id, { reason: 'disconnect' });
      if (currentRoom.isEmpty()) rooms.delete(currentRoom.code);
    }
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('╭──────────────────────────────────────────╮');
  console.log('│  🏯 Kanji Duel — Server running          │');
  console.log('│  ➜  http://localhost:' + PORT + '                 │');
  console.log('╰──────────────────────────────────────────╯');
  console.log('');
});
