/**
 * Match.js
 * --------------------------------
 * Logika inti pertandingan:
 *  - Pembagian ronde (5 detik per ronde)
 *  - Pengacakan soal & opsi
 *  - Pengumpulan jawaban (anti-duplicate)
 *  - Perhitungan damage sesuai mode (1v1 / 2v2)
 *  - Penentuan pemenang
 *
 * Aturan damage (server-authoritative):
 *
 *   Mode 1v1:
 *     - benar    → 0 damage (player dapat SHIELD)
 *     - salah / tidak jawab → 10 damage ke player tersebut
 *
 *   Mode 2v2:
 *     - 2 pemain benar dalam satu tim → 0 damage untuk tim
 *     - 1 pemain  benar dalam satu tim → 5 damage untuk tim
 *     - 0 pemain  benar dalam satu tim → 10 damage untuk tim
 *
 * Timer:
 *   - Server menyimpan `endsAt = Date.now() + 5000`.
 *   - setTimeout sebagai fallback jika ada jawaban yang tidak terkirim.
 *   - Klien menghitung mundur dari `endsAt` untuk display.
 */

class Match {
  constructor(mode, players, questions, io, roomCode) {
    this.mode = mode; // '1v1' | '2v2'
    this.players = players;
    this.questions = [...questions]; // copy agar shuffle tidak mengganggu global
    this.io = io;
    this.roomCode = roomCode;

    this.currentRound = null;
    this.roundNumber = 0;
    this.maxRounds = 10; // Batasi 10 ronde; jika masih seri → hitung HP tertinggi
    this.timerHandle = null;
  }

  // ─── Fisher–Yates shuffle ─────────────────────────────────────
  shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Mulai pertandingan: acak soal dan jalankan ronde pertama.
   */
  start() {
    this.shuffleArray(this.questions);
    this.startRound();
  }

  /**
   * Mulai satu ronde: pilih soal, acak opsi, broadcast ke semua player.
   */
  startRound() {
    // Cek apakah sudah ada pemenang → akhiri
    if (this.checkWin() || this.roundNumber >= this.maxRounds) {
      this.end();
      return;
    }

    this.roundNumber++;
    const question = this.questions[this.roundNumber - 1];
    const endsAt = Date.now() + 5000;

    // Acak urutan opsi jawaban
    const options = this.shuffleArray([question.answer, ...question.wrong]);

    this.currentRound = {
      roundNumber: this.roundNumber,
      question,
      options,
      correctAnswer: question.answer,
      endsAt,
      answers: {}, // playerId -> answer string
    };

    // Broadcast ke semua player di room
    this.io.to(this.roomCode).emit('round:start', {
      roundNumber: this.roundNumber,
      maxRounds: this.maxRounds,
      question: { kanji: question.kanji },
      options,
      endsAt,
      mode: this.mode,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        hp: p.hp,
      })),
    });

    // Timer fallback — jika ada player yang tidak menjawab dalam 5 detik
    this.timerHandle = setTimeout(() => this.endRound(), 5000);
  }

  /**
   * Terima jawaban dari player. Hanya boleh sekali per ronde per player.
   * Validasi: answer harus ada di opsi ronde ini.
   *
   * @returns {boolean} true jika jawaban diterima.
   */
  submitAnswer(playerId, answer) {
    if (!this.currentRound) return false;
    if (this.currentRound.answers[playerId] !== undefined) return false;
    if (!this.currentRound.options.includes(answer)) return false;

    this.currentRound.answers[playerId] = answer;

    // Beri tahu room bahwa satu jawaban masuk (untuk UI "answered")
    this.io.to(this.roomCode).emit('round:progress', {
      answeredCount: Object.keys(this.currentRound.answers).length,
      total: this.players.length,
    });

    // Jika semua player sudah menjawab, akhiri ronde lebih cepat
    if (Object.keys(this.currentRound.answers).length >= this.players.length) {
      this.endRound();
    }

    return true;
  }

  /**
   * Akhiri ronde: hitung damage per tim, broadcast hasil, lalu mulai ronde berikutnya.
   */
  endRound() {
    if (!this.currentRound) return;

    // Bersihkan timer
    if (this.timerHandle) {
      clearTimeout(this.timerHandle);
      this.timerHandle = null;
    }

    const correctAnswer = this.currentRound.correctAnswer;

    // Kumpulkan hasil per player
    const results = this.players.map((p) => {
      const submitted = this.currentRound.answers[p.id];
      const correct = submitted === correctAnswer;
      return { playerId: p.id, name: p.name, team: p.team, submitted, correct };
    });

    // Hitung damage per tim (untuk 2v2) atau per player (untuk 1v1)
    const damage = {}; // playerId -> damage number
    const teamCorrectCount = { 1: 0, 2: 0 };

    // Hitung dulu berapa pemain benar per tim
    results.forEach((r) => {
      if (r.correct) teamCorrectCount[r.team]++;
    });

    if (this.mode === '1v1') {
      // 1v1: damage langsung per player
      results.forEach((r) => {
        if (r.correct) {
          damage[r.playerId] = 0;
        } else {
          damage[r.playerId] = 10;
        }
      });
    } else {
      // 2v2: damage per tim, lalu apply ke masing-masing anggota tim
      [1, 2].forEach((team) => {
        const correctCount = teamCorrectCount[team];
        let teamDamage;
        if (correctCount === 2) teamDamage = 0;
        else if (correctCount === 1) teamDamage = 5;
        else teamDamage = 10;

        results
          .filter((r) => r.team === team)
          .forEach((r) => {
            damage[r.playerId] = teamDamage;
          });
      });
    }

    // Apply damage ke HP player
    results.forEach((r) => {
      const player = this.players.find((p) => p.id === r.playerId);
      if (player) {
        player.hp = Math.max(0, player.hp - damage[r.playerId]);
      }
      r.shielded = damage[r.playerId] === 0;
      r.damage = damage[r.playerId];
    });

    // Broadcast hasil ronde ke semua player
    this.io.to(this.roomCode).emit('round:result', {
      roundNumber: this.currentRound.roundNumber,
      correctAnswer,
      results,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        hp: p.hp,
      })),
    });

    // Tutup ronde, lalu mulai ronde berikutnya setelah jeda 3 detik
    this.currentRound = null;
    setTimeout(() => {
      // Cek apakah ada pemenang setelah damage
      if (this.checkWin() || this.roundNumber >= this.maxRounds) {
        this.end();
      } else {
        this.startRound();
      }
    }, 3000);
  }

  /**
   * Cek apakah salah satu tim sudah habis HP-nya.
   */
  checkWin() {
    const team1Alive = this.players.filter((p) => p.team === 1 && p.hp > 0);
    const team2Alive = this.players.filter((p) => p.team === 2 && p.hp > 0);
    return team1Alive.length === 0 || team2Alive.length === 0;
  }

  /**
   * Akhiri pertandingan: tentukan pemenang berdasarkan total HP per tim.
   */
  end() {
    if (this.timerHandle) clearTimeout(this.timerHandle);

    const totalHp1 = this.players
      .filter((p) => p.team === 1)
      .reduce((s, p) => s + p.hp, 0);
    const totalHp2 = this.players
      .filter((p) => p.team === 2)
      .reduce((s, p) => s + p.hp, 0);

    let winner;
    if (totalHp1 > totalHp2) winner = 1;
    else if (totalHp2 > totalHp1) winner = 2;
    else winner = 'draw';

    this.io.to(this.roomCode).emit('match:end', {
      winner,
      finalPlayers: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        hp: p.hp,
      })),
      totalHp: { 1: totalHp1, 2: totalHp2 },
    });
  }
}

module.exports = Match;
