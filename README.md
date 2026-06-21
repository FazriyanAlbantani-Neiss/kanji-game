# 🏯 Kanji Duel

> Multiplayer real-time quiz battle kanji Jepang. Bentuk tim, jawab soal
> secepat mungkin, dan jaga bentengmu dari bom yang meledak setiap 5 detik.

![Stack](https://img.shields.io/badge/Node.js-%E2%89%A518-green)
![Stack](https://img.shields.io/badge/Express-4.x-lightgrey)
![Stack](https://img.shields.io/badge/Socket.IO-4.x-black)

UI mengikuti design tokens dan shape language yang didefinisikan di
`design.md` (Rausch #ff385c sebagai brand color, soft rounded corners,
generous whitespace, single-tier shadow).

---

## 📋 Spesifikasi Singkat

| Aspek | Detail |
|---|---|
| Genre | Real-time quiz battle (1v1 & 2v2) |
| Platform | Web (HTML/CSS/JS murni, tidak butuh build) |
| Backend | Node.js + Express + Socket.IO |
| Frontend | Vanilla SPA (3 views: Lobby / Room / Battle) |
| Database | Tidak ada (MVP) — soal di file JSON, state di-memory |
| Round time | 5 detik per ronde |
| Initial HP | 100 HP per pemain |
| Base damage | 10 HP per ledakan |

### Aturan Damage (wajib)

**Mode 1v1**
- Jawaban benar → `0 damage` (player mendapat 🛡 SHIELD)
- Jawaban salah / tidak jawab → `10 damage` ke player tersebut

**Mode 2v2**
- 2 pemain benar dalam tim → `0 damage` untuk tim
- 1 pemain benar dalam tim → `5 damage` untuk tim
- 0 pemain benar dalam tim → `10 damage` untuk tim

### Anti-cheat (server-authoritative)

- ✅ Jawaban hanya diterima sekali per ronde per player
- ✅ Server yang menentukan benar/salah & damage
- ✅ Timer dikontrol server (`setTimeout` + `endsAt` timestamp)
- ✅ Validasi jawaban harus ada di opsi ronde aktif
- ✅ Jawaban setelah timer habis otomatis diabaikan

---

## 🏗 Arsitektur

```
┌──────────┐        Socket.IO         ┌──────────────┐
│  Client  │ ◄──────────────────────► │   server.js  │
│ (SPA)    │   (websocket transport)  │  Express +   │
└──────────┘                          │  Socket.IO   │
                                      └──────┬───────┘
                                             │
                       ┌─────────────────────┼─────────────────────┐
                       ▼                     ▼                     ▼
               ┌────────────┐         ┌────────────┐         ┌──────────────┐
               │ game/Room  │  owns   │ game/Match │  uses   │  data/       │
               │            │ ──────► │            │ ──────► │  questions   │
               │  (lobby +  │         │ (rounds,   │         │  .json       │
               │   state)   │         │  damage)   │         │  (30 soal)   │
               └────────────┘         └────────────┘         └──────────────┘
```

**Prinsip pemisahan:**

- `server.js` — HTTP + Socket.IO wiring, route dispatch.
- `game/Room.js` — Representasi satu room (lobby), assign tim, ready state,
  transisi ke Match. Tidak tahu soal.
- `game/Match.js` — Logika murni ronde & damage (tidak tahu HTTP). Dipanggil
  oleh Room saat match dimulai. Authoritative untuk damage & winner.
- `game/questionLoader.js` — Loader + validator untuk bank soal JSON.
- `data/questions.json` — 30 soal kanji dummy.
- `public/js/views.js` — Pure render functions (HTML strings). Tidak tahu
  Socket.
- `public/js/client.js` — SPA controller: state, socket events, view
  switching, timer display.
- `public/js/ui.js` — Helper DOM kecil (toast, escape, format).
- `public/css/styles.css` — Design tokens (langsung dari `design.md`).

---

## 📁 Struktur Folder

```
kanji-duel/
├── package.json
├── README.md
├── server.js                  # Express + Socket.IO entry
├── data/
│   └── questions.json         # 30 soal kanji (dummy)
├── game/
│   ├── Room.js                # Room / lobby logic
│   ├── Match.js               # Round + damage logic (server-authoritative)
│   └── questionLoader.js      # Load + validate soal JSON
└── public/
    ├── index.html             # SPA shell
    ├── css/
    │   └── styles.css         # Design system (Airbnb-inspired)
    └── js/
        ├── ui.js              # DOM helpers
        ├── views.js           # View render functions
        └── client.js          # SPA controller + Socket.IO
```

---

## 🎮 Flow Game (Lobby → Match End)

```
[Lobby]
   │  Player klik "Buat Room" (pilih mode 1v1/2v2 + isi nama)
   │  atau "Join Room" (kode + nama)
   ▼
[Room (waiting)]
   │  - Room code ditampilkan (6 char)
   │  - Slots pemain (1v1 = 2 slot, 2v2 = 4 slot, dibagi 2 tim)
   │  - Non-host klik "Saya Siap"
   │  - Host klik "Mulai Pertandingan" saat semua siap & room penuh
   ▼
[Battle]
   │  Server mengirim soal (kanji + 3 opsi) + endsAt ke semua player
   │  Timer 5 detik berjalan (sync dari server timestamp)
   │  Player klik 1 dari 3 opsi jawaban (terkunci setelah klik)
   │  ─────────────────────────────────────────────
   │  Setiap ronde selesai → server hitung damage per tim:
   │    1v1: benar=0, salah/tidak=10
   │    2v2: 2benar=0, 1benar=5, 0benar=10
   │  HP pemain di-update, modal hasil ronde ditampilkan 3 detik
   │  Lalu ronde berikutnya dimulai (sampai 10 ronde atau ada tim habis)
   ▼
[Match End]
   │  Modal: "KAMU MENANG! 🎉" / "KAMU KALAH" / "SERI!"
   │  Final HP per tim, daftar pemain
   │  Tombol "Kembali ke Lobby"
   ▼
[Lobby] (loop)
```

---

## 🚀 Cara Menjalankan

### Prasyarat

- Node.js **v18+** (cek dengan `node -v`)
- npm (sudah termasuk dengan Node.js)

### Instalasi

```bash
cd kanji-duel
npm install
```

### Menjalankan server

```bash
npm start
```

Output yang diharapkan:

```
╭──────────────────────────────────────────╮
│  🏯 Kanji Duel — Server running          │
│  ➜  http://localhost:3000                 │
╰──────────────────────────────────────────╯
```

### Cara main (uji multiplayer)

1. Buka **`http://localhost:3000`** di **dua tab browser** (atau dua device).
2. **Tab 1** → klik "Buat Room" → pilih mode (1v1/2v2) → isi nama → Buat.
   Catat kode room (mis. `K7P3X2`).
3. **Tab 2** → klik "Join Room" → masukkan kode + nama → Join.
4. Tab 2 klik "Saya Siap". Host (Tab 1) klik "Mulai Pertandingan".
5. Jawab secepat mungkin! Bom meledak setiap 5 detik.

> 💡 Untuk uji **2v2**, buka **4 tab** — 2 jadi Tim 1, 2 jadi Tim 2.

### Cara kill server

Tekan `Ctrl+C` di terminal.

---

## 📡 Socket Events (referensi)

### Client → Server

| Event | Payload | Deskripsi |
|---|---|---|
| `room:create` | `{ mode, playerName }` | Buat room baru |
| `room:join` | `{ roomCode, playerName }` | Join ke room |
| `room:toggleReady` | — | Toggle status siap (non-host) |
| `match:start` | — | Mulai pertandingan (host) |
| `round:answer` | `{ answer }` | Kirim jawaban untuk ronde aktif |
| `room:leave` | — | Keluar dari room |

### Server → Client

| Event | Payload | Deskripsi |
|---|---|---|
| `room:update` | `{ code, mode, players, canStart }` | State room/lobby berubah |
| `round:start` | `{ roundNumber, question, options, endsAt }` | Ronde baru dimulai |
| `round:progress` | `{ answeredCount, total }` | Ada player yang submit |
| `round:result` | `{ roundNumber, correctAnswer, results, players }` | Hasil ronde (damage, HP) |
| `match:end` | `{ winner, finalPlayers, totalHp }` | Pertandingan selesai |
| `error` | `{ message }` | Error notification |

---

## 🎨 Design System (ringkasan)

Semua token diambil langsung dari `design.md`:

| Token | Value |
|---|---|
| `--c-primary` (Rausch) | `#ff385c` |
| `--c-ink` | `#222222` |
| `--c-canvas` | `#ffffff` |
| `--r-sm` (button) | `8px` |
| `--r-md` (card) | `14px` |
| `--r-full` (pill) | `9999px` |
| Font | Inter (substitute Airbnb Cereal VF) + Noto Sans JP |
| Shadow | 1 tier (untuk card hover / modal) |

Komponen UI yang di-mapping dari design.md:
- **top-nav** — sticky white bar, logo + room code
- **card** — 14px radius, 1px hairline border + soft shadow
- **button-primary** — Rausch fill, 8px radius, 48px height
- **search-bar-pill** (adapted) → **answer-btn** pill shape untuk ronde
- **property-card** → **player-card** untuk HP bar pemain

---

## 🧪 Testing Manual Checklist

Setelah `npm install` dan `npm start`, uji:

- [ ] Buat room di tab 1 → kode room muncul, mode pill bekerja
- [ ] Join dari tab 2 dengan kode yang sama
- [ ] Host bisa kick-start setelah non-host "Siap"
- [ ] Semua pemain dapat soal **identik** di ronde yang sama
- [ ] Klik jawaban mengunci tombol (tidak bisa diklik lagi)
- [ ] Timer 5.0 → 0.0, berubah warna merah di ≤1.5 detik
- [ ] HP bar bergerak setelah ronde (10 / 5 / 0 damage sesuai rule)
- [ ] Shield hijau muncul untuk pemain yang jawab benar
- [ ] Modal hasil ronde auto-dismiss 3 detik, lanjut ronde baru
- [ ] Setelah 10 ronde atau salah satu tim habis → modal akhir
- [ ] Tombol "Kembali ke Lobby" kembali ke halaman awal

---

## 🛣 Roadmap (post-MVP)

- [ ] Reconnect handling (jika player disconnect di tengah match)
- [ ] Statistik per pemain (win streak, akurasi)
- [ ] Bank soal dinamis (import CSV / admin panel)
- [ ] Tingkat kesulitan kanji (N5 / N4 / N3 / JLPT level)
- [ ] Matchmaking otomatis tanpa kode room
- [ ] Leaderboard global
- [ ] Sound effects & animations polish
- [ ] Database (SQLite) untuk persistensi

---

## 📝 Lisensi

MIT — bebas digunakan untuk belajar, prototyping, atau produksi kecil.
