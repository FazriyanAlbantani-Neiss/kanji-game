/**
 * Room.js
 * --------------------------------
 * Representasi satu room/lobby:
 *  - Kode room, mode (1v1 / 2v2)
 *  - Daftar players (otomatis di-assign ke Tim 1 / Tim 2)
 *  - Status: 'lobby' | 'playing' | 'finished'
 *  - Transisi ke Match saat match:start dipanggil oleh host.
 */

const Match = require('./Match');

class Room {
  constructor(code, mode, level, io, questions) {
    this.code = code;
    this.mode = mode; // '1v1' | '2v2'
    this.level = level; // 'n5' | 'n4' | 'n3' | 'n2' | 'n1'
    this.io = io;
    this.questions = questions;

    this.players = []; // Array of { id, name, team, ready, host, hp }
    this.status = 'lobby';
    this.match = null;

    this.capacity = mode === '1v1' ? 2 : 4;
  }

  addPlayer(playerId, name) {
    if (this.players.length >= this.capacity) return null;
    const team = this.players.length < this.capacity / 2 ? 1 : 2;
    const player = {
      id: playerId,
      name: (name || `Pemain ${this.players.length + 1}`).trim().slice(0, 20),
      team,
      ready: false,
      host: this.players.length === 0,
      hp: 100,
    };
    this.players.push(player);
    return player;
  }

  removePlayer(playerId, _opts = {}) {
    const wasHost = this.isHost(playerId);
    this.players = this.players.filter((p) => p.id !== playerId);
    if (wasHost && this.players.length > 0) {
      this.players[0].host = true;
    }
    this.broadcastState();
  }

  isEmpty() { return this.players.length === 0; }
  isFull() { return this.players.length >= this.capacity; }

  isHost(playerId) {
    return this.players.find((p) => p.id === playerId)?.host === true;
  }

  /**
   * Toggle status siap untuk player non-host.
   * Host otomatis dianggap siap dan tidak bisa toggle.
   */
  toggleReady(playerId) {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || player.host) return false;
    player.ready = !player.ready;
    this.broadcastState();
    return true;
  }

  /**
   * Sama seperti toggleReady tapi mengembalikan info state baru
   * untuk dikirim balik ke client sebagai callback.
   */
  toggleReadyWithResult(playerId) {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return { ok: false, error: 'Pemain tidak ditemukan' };
    if (player.host) return { ok: false, error: 'Host tidak perlu toggle ready' };
    player.ready = !player.ready;
    this.broadcastState();
    return { ok: true, ready: player.ready };
  }

  /**
   * Cek apakah pertandingan bisa dimulai:
   *  - Room penuh
   *  - Semua player non-host sudah siap
   */
  canStart() {
    if (this.status !== 'lobby') return false;
    // Host TIDAK BISA mulai jika player belum penuh
    if (this.players.length !== this.capacity) return false;
    return this.players.filter((p) => !p.host).every((p) => p.ready);
  }

  startMatch() {
    if (!this.canStart()) return false;
    this.status = 'playing';
    this.players.forEach((p) => (p.hp = 100));
    this.match = new Match(this.mode, this.players, this.questions, this.io, this.code);
    this.match.start();
    return true;
  }

  submitAnswer(playerId, answer) {
    if (this.match) return this.match.submitAnswer(playerId, answer);
    return false;
  }

  broadcastState() {
    const state = {
      code: this.code,
      mode: this.mode,
      level: this.level,
      status: this.status,
      capacity: this.capacity,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        ready: p.ready,
        host: p.host,
        hp: p.hp,
      })),
      canStart: this.canStart(),
    };
    this.io.to(this.code).emit('room:update', state);
  }
}

module.exports = Room;
