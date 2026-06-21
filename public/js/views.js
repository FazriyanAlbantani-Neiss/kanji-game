/**
 * views.js — Pure render functions untuk Nintendo 2001 chrome style.
 *
 * Setiap fungsi mengembalikan string HTML yang menggunakan design system
 * class `n-*` (dari public/css/nintendo.css).
 *
 * Layout untuk Android (touch-first):
 *  - Semua touch target minimal 44px
 *  - touch-action: manipulation di button
 *  - Padding cukup untuk jari
 */

const Views = {
  // ════════════════════════════════════════════════════════════
  // Top Nav (Carbon Navy dengan halftone)
  // ════════════════════════════════════════════════════════════
  topNav(opts = {}) {
    const { activeTab, roomCode, mode } = opts;
    return `
      <nav class="n-nav">
        <a class="n-nav__brand" href="#" id="nav-home" style="text-decoration: none; display: flex; align-items: center;">
          <span class="n-nav__brand-emoji">🏯</span>
          <span class="n-nav__brand-text">IKUZE JAPAN</span>
        </a>
        <div class="n-nav__menu">
          ${activeTab === 'lobby' ? '<button class="n-nav__menu-item n-nav__menu-item--active">Lobby</button>' : '<button class="n-nav__menu-item" data-go="lobby">Lobby</button>'}
          ${activeTab === 'room' ? '<button class="n-nav__menu-item n-nav__menu-item--active">Room</button>' : '<button class="n-nav__menu-item" data-go="room">Room</button>'}
          ${activeTab === 'battle' ? '<button class="n-nav__menu-item n-nav__menu-item--active">Battle</button>' : '<button class="n-nav__menu-item" data-go="battle">Battle</button>'}
        </div>
        <div class="n-nav__right">
          ${roomCode ? `<span class="n-badge n-badge--amber">${UI.escapeHtml(roomCode)}</span>` : ''}
          ${mode ? `<span class="n-badge n-badge--carbon">${mode === '2v2' ? '2v2' : '1v1'}</span>` : ''}
          <button class="n-nav__audio-toggle" id="btn-audio-toggle" title="Toggle audio">
            <span id="audio-icon">${typeof AudioManager !== 'undefined' && AudioManager.muted ? '🔇' : '🔊'}</span>
          </button>
        </div>
      </nav>
      ${activeTab ? `
        <div class="n-subnav">
          <span class="n-subnav__crumb">Home</span>
          <span class="n-subnav__sep">›</span>
          <span class="n-subnav__crumb">${UI.escapeHtml(activeTab)}</span>
          ${roomCode ? `
            <span class="n-subnav__sep">›</span>
            <span class="n-subnav__current">${UI.escapeHtml(roomCode)}</span>
          ` : ''}
        </div>
      ` : ''}
    `;
  },

  /**
   * Render daftar room yang tersedia (untuk lobby).
   * Auto-detect dari server (broadcast setiap 3 detik).
   */
  roomList(rooms) {
    if (!rooms || rooms.length === 0) {
      return `
        <div class="n-plate n-plate--inset" style="text-align: center; padding: 10px;">
          <div style="font-size: 11px; font-weight: 700; color: var(--c-muted-indigo); text-transform: uppercase; letter-spacing: 0.5px;">
            ⏳ Belum ada room terbuka.<br>
            <span style="font-size: 10px; color: var(--c-muted); font-weight: 400;">Buat room baru di atas, atau minta kode dari teman.</span>
          </div>
        </div>
      `;
    }
    return rooms.map(r => `
      <article class="n-castle" data-room-code="${UI.escapeHtml(r.code)}" style="padding: 6px 10px;">
        <div class="n-castle__name">
          <span class="n-badge n-badge--amber">${UI.escapeHtml(r.code)}</span>
          <span class="n-badge n-badge--carbon">${r.mode === '2v2' ? '2v2' : '1v1'}</span>
          <span class="n-badge n-badge--carbon">${UI.escapeHtml((r.level || 'n5').toUpperCase())}</span>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px; gap: 8px;">
          <span style="font-size: 10px; color: var(--c-ink-soft); font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px;">
            👑 ${UI.escapeHtml(r.hostName)} · ${r.players}/${r.capacity} pemain
          </span>
          <button type="button" class="n-btn n-btn--primary" data-join-room="${UI.escapeHtml(r.code)}" style="font-size: 10px; padding: 4px 10px; min-height: 28px;">
            ▶ JOIN
          </button>
        </div>
      </article>
    `).join('');
  },

  // ════════════════════════════════════════════════════════════
  // Lobby — Logo Pill + Hero Panel + Form Panels
  // ════════════════════════════════════════════════════════════
  lobby(state) {
    const selectedMode = state?.selectedMode || '1v1';
    return `
      ${this.topNav({ activeTab: 'lobby' })}
      <div class="n-page">
        <div class="n-page__inner">
          <h1 class="n-page__title">🏯 Kanji Duel — Quick Match</h1>

          <div class="n-hero">
            <div class="n-hero__display">DUEL<br>START</div>
            <div class="n-hero__tagline">
              ⚔️ Tes kecepatan & ketepatanmu ⚔️<br>
              Bom meledak setiap 5 detik!
            </div>
            <div class="n-hero__cta">
              <span class="n-badge n-badge--amber">v2.0 Mobile</span>
              <span class="n-badge n-badge--carbon">Multiplayer</span>
            </div>
          </div>

          <div class="n-section-bar">
            <span class="n-section-bar__glyph"></span>
            <span class="n-section-bar__text">≡ Profil Player</span>
          </div>
          <div class="n-plate" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <div>
              <div style="font-size: 10px; font-weight: 700; color: var(--n-ink-soft); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Username Aktif</div>
              <div style="font-size: 15px; font-weight: 900; color: var(--n-carbon);">${UI.escapeHtml(state.username || 'Belum diset')}</div>
            </div>
            <button class="n-btn n-btn--secondary" id="btn-edit-username" style="font-size: 10px; padding: 6px 12px; min-height: 28px;">UBAH</button>
          </div>

          <div class="n-section-bar">
            <span class="n-section-bar__glyph"></span>
            <span class="n-section-bar__text">≡ Quick Match — Pilih Mode</span>
          </div>

          <div class="n-plate">
            <div class="n-field">
              <label class="n-field__label">≡ Level Kanji</label>
              <select id="create-level" class="n-field__input">
                <option value="n5" ${state.selectedLevel === 'n5' ? 'selected' : ''}>N5 (Pemula)</option>
                <option value="n4" ${state.selectedLevel === 'n4' ? 'selected' : ''}>N4 (Dasar)</option>
                <option value="n3" ${state.selectedLevel === 'n3' ? 'selected' : ''}>N3 (Menengah)</option>
                <option value="n2" ${state.selectedLevel === 'n2' ? 'selected' : ''}>N2 (Mahir)</option>
                <option value="n1" ${state.selectedLevel === 'n1' ? 'selected' : ''}>N1 (Fasih)</option>
              </select>
            </div>

            <div class="n-field">
              <label class="n-field__label">≡ Mode Pertandingan</label>
              <div style="display: flex; gap: 4px; padding: 4px 0;">
                <button type="button" class="n-answer__btn ${selectedMode === '1v1' ? 'n-answer__btn--selected' : ''}" data-mode="1v1" id="mode-1v1" style="flex: 1;">
                  <span class="n-answer__btn-letter">A</span>
                  <span class="n-answer__btn-text">1 vs 1</span>
                </button>
                <button type="button" class="n-answer__btn ${selectedMode === '2v2' ? 'n-answer__btn--selected' : ''}" data-mode="2v2" id="mode-2v2" style="flex: 1;">
                  <span class="n-answer__btn-letter">B</span>
                  <span class="n-answer__btn-text">2 vs 2</span>
                </button>
              </div>
            </div>

            <button id="btn-create" class="n-btn n-btn--submit n-btn--block n-btn--large">
              ▶ BUAT ROOM
            </button>
          </div>

          <div class="n-section-bar">
            <span class="n-section-bar__glyph"></span>
            <span class="n-section-bar__text">≡ Room Tersedia — Auto-detect</span>
            <span class="n-section-bar__action" id="room-list-count">0</span>
          </div>
          <div class="n-stack" id="room-list" style="margin-bottom: 10px;">
            ${this.roomList(state.availableRooms || [])}
          </div>

          <div class="n-section-bar">
            <span class="n-section-bar__glyph"></span>
            <span class="n-section-bar__text">≡ Join Room Teman (input kode)</span>
          </div>

          <div class="n-plate">
            <div class="n-field">
              <label class="n-field__label" for="join-code">≡ Kode Room</label>
              <input id="join-code" class="n-field__input" type="text" placeholder="ABCD12" maxlength="6" autocomplete="off" style="text-transform: uppercase; font-family: monospace; letter-spacing: 4px; text-align: center;" />
            </div>
            <button id="btn-join" class="n-btn n-btn--primary n-btn--block">
              ▶ JOIN
            </button>
          </div>
        </div>

        ${this.footer()}
      </div>
    `;
  },

  // ════════════════════════════════════════════════════════════
  // Room (Waiting) — Player slots dengan chrome plates
  // ════════════════════════════════════════════════════════════
  room(state) {
    const me = state.players.find((p) => p.id === Client.socket?.id);
    const isHost = !!me?.host;
    const team1 = state.players.filter((p) => p.team === 1);
    const team2 = state.players.filter((p) => p.team === 2);

    return `
      ${this.topNav({ activeTab: 'room', roomCode: state.code, mode: state.mode })}
      <div class="n-page">
        <div class="n-page__inner">
          <h1 class="n-page__title">≡ Room ${UI.escapeHtml(state.code)}</h1>

          <div class="n-section-bar">
            <span class="n-section-bar__glyph"></span>
            <span class="n-section-bar__text">≡ Status Room</span>
            <span class="n-section-bar__action">${state.players.length}/${state.capacity}</span>
          </div>

          <div class="n-plate">
            <p style="margin-bottom: 8px; font-size: 11px; font-weight: 700; color: var(--n-ink-soft); text-transform: uppercase; letter-spacing: 0.5px;">
              ${this.roomStatusText(state)}
            </p>

            <div class="n-section-bar" style="margin-bottom: 6px;">
              <span class="n-section-bar__text">Tim 1</span>
            </div>
            <div class="n-stack" style="margin-bottom: 10px;">
              ${team1.length === 0 ? this.emptySlot() : team1.map((p) => this.playerSlot(p, state, p.id === me?.id, isHost)).join('')}
            </div>

            <div class="n-section-bar" style="margin-bottom: 6px;">
              <span class="n-section-bar__text">Tim 2</span>
            </div>
            <div class="n-stack" style="margin-bottom: 10px;">
              ${team2.length === 0 ? this.emptySlot() : team2.map((p) => this.playerSlot(p, state, p.id === me?.id, isHost)).join('')}
            </div>
          </div>

          <div class="n-plate" style="text-align: center;">
            ${
              isHost
                ? `<button class="n-btn n-btn--submit n-btn--block n-btn--large" id="btn-start" ${state.canStart ? '' : 'disabled'}>
                    ${state.canStart ? '🚀 MULAI PERTANDINGAN!' : '⏳ ' + (state.players.length < state.capacity ? `Menunggu ${state.capacity - state.players.length} pemain lagi...` : 'Menunggu semua siap...')}
                  </button>`
                : `<button class="n-btn n-btn--primary n-btn--block n-btn--large" id="btn-ready">
                    ${me?.ready ? '↩ BATAL SIAP' : '✓ SAYA SIAP'}
                  </button>`
            }
            <button class="n-btn n-btn--secondary n-btn--block" id="btn-leave" style="margin-top: 6px;">
              ⬅ Keluar Room
            </button>
          </div>
        </div>
        ${this.footer()}
      </div>
    `;
  },

  roomStatusText(state) {
    const need = state.capacity - state.players.length;
    if (need > 0) return `⏳ Menunggu ${need} pemain lagi...`;
    if (!state.canStart) {
      const waiting = state.players.filter((p) => !p.host && !p.ready);
      if (waiting.length > 0) {
        return `⏳ Menunggu ${waiting.map((p) => p.name).join(', ')} siap...`;
      }
    }
    return '✅ Siap dimulai!';
  },

  playerSlot(player, _state, isMe, isViewerHost) {
    let badge = '';
    let statusClass = '';
    let statusText = '';

    if (player.host) {
      badge = '<strong>HOST</strong>';
      statusText = '🛡️ Host';
      statusClass = 'n-badge--amber';
    } else if (player.ready) {
      statusText = '✓ Siap';
      statusClass = 'n-badge--shield';
    } else {
      statusText = '⏳ Belum siap';
      statusClass = 'n-badge--carbon';
    }

    return `
      <div class="n-castle" style="${isMe ? 'border-color: var(--n-signal); border-width: 2px;' : ''}; position: relative;">
        <div class="n-castle__name">
          <span>${UI.escapeHtml(player.name)} ${isMe ? '<span class="n-badge n-badge--carbon">YOU</span>' : ''}</span>
          ${badge}
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
          <span class="n-badge ${statusClass}" style="flex: 0 0 auto;">${statusText}</span>
          ${isViewerHost && !player.host ? `<button class="n-btn n-btn--danger" style="padding: 2px 8px; font-size: 10px; min-height: unset; height: 24px;" data-kick-player="${UI.escapeHtml(player.id)}">KICK</button>` : ''}
        </div>
      </div>
    `;
  },

  emptySlot() {
    return `
      <div class="n-castle" style="opacity: 0.55; background: var(--n-platinum);">
        <div class="n-castle__name">
          <span style="color: var(--n-muted-indigo);">— Slot Kosong —</span>
        </div>
        <div style="font-size: 11px; color: var(--n-muted-indigo); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
          ⏳ Menunggu pemain...
        </div>
      </div>
    `;
  },

  // ════════════════════════════════════════════════════════════
  // Battle — Kanji display + Castle panels + Answer buttons
  // ════════════════════════════════════════════════════════════
  battle(state) {
    const team1 = state.players.filter((p) => p.team === 1);
    const team2 = state.players.filter((p) => p.team === 2);

    return `
      ${this.topNav({ activeTab: 'battle', roomCode: state.roomCode, mode: state.mode })}
      <div class="n-page">
        <div class="n-page__inner">

          <div class="n-arena__battle">
            <!-- Tim 1 (kiri) -->
            ${team1.map((p) => this.castlePanel(p, state, 'left')).join('')}

            <!-- Field tengah -->
            <div class="n-arena__field">
              <div class="n-arena__field__label">≡ Soal Ronde ${state.roundNumber}/${state.maxRounds}</div>

              <div class="n-timer" id="battle-timer">5.0</div>

              <div class="n-kanji">${UI.escapeHtml(state.question?.kanji || '?')}</div>

              <div class="n-answer" id="answer-grid">
                ${(state.options || [])
                  .map((opt, i) => this.answerButton(opt, i, state))
                  .join('')}
              </div>

              <div class="n-arena__status">
                ${state.answered ? '✓ Jawaban terkunci' : '⏱ Pilih dalam 5 detik!'}
              </div>

              <button class="n-btn n-btn--secondary" id="btn-leave-battle" style="margin-top: 8px; align-self: center;">
                ⬅ Keluar
              </button>
            </div>

            <!-- Tim 2 (kanan) -->
            ${team2.map((p) => this.castlePanel(p, state, 'right')).join('')}
          </div>

          ${state.lastResult ? this.roundResultModal(state.lastResult, state.players) : ''}
          ${state.matchEnd ? this.matchEndModal(state.matchEnd, state.players) : ''}
        </div>
        ${this.footer()}
      </div>
    `;
  },

  castlePanel(player, state, side) {
    const hp = Math.max(0, player.hp);
    const hpColor = hp > 60 ? 'good' : hp > 30 ? 'warn' : 'danger';
    const isMe = player.id === Client.socket?.id;

    let visualState = '';
    let badge = '';
    if (hp === 0) {
      visualState = 'defeated';
      badge = `<div class="n-castle__badge n-castle__badge--defeated">KO</div>`;
    } else if (state.lastResult?.results) {
      const myResult = state.lastResult.results.find((r) => r.playerId === player.id);
      if (myResult) {
        if (myResult.shielded) {
          visualState = 'shield';
          badge = `<div class="n-castle__badge n-castle__badge--shield">🛡 SHIELD</div>`;
        } else if (!myResult.correct) {
          visualState = 'damage';
          badge = `<div class="n-castle__badge n-castle__badge--damage">💥 −${myResult.damage}</div>`;
        }
      }
    }

    return `
      <div class="n-castle ${isMe ? 'n-castle--me' : ''} ${side === 'right' ? 'n-castle--right' : 'n-castle--left'}" style="${visualState === 'shield' ? 'border-color: var(--n-shield); border-width: 2px;' : ''}${visualState === 'damage' ? 'animation: n-shake 0.5s;' : ''}">
        ${badge}
        <div class="n-castle__name">
          <span>${UI.escapeHtml(player.name)}${isMe ? ' <span class="n-badge n-badge--amber" style="font-size: 8px;">YOU</span>' : ''}${player.host ? ' <strong>HOST</strong>' : ''}</span>
        </div>
        <div class="n-castle__hp">
          <div class="n-castle__hp-bar">
            <div class="n-castle__hp-fill n-castle__hp-fill--${hpColor}" style="width: ${hp}%;"></div>
          </div>
          <div class="n-castle__hp-label">${hp}/100</div>
        </div>
      </div>
    `;
  },

  answerButton(opt, index, state) {
    let cls = 'n-answer__btn';
    if (state.selectedAnswer === opt) cls += ' n-answer__btn--selected';
    if (state.lastResult?.correctAnswer) {
      if (opt === state.lastResult.correctAnswer) cls += ' n-answer__btn--correct';
      else if (opt === state.selectedAnswer) cls += ' n-answer__btn--wrong';
    }
    const disabled = state.answered || state.lastResult ? 'disabled' : '';
    const letter = String.fromCharCode(65 + index);
    return `
      <button class="${cls}" data-answer="${UI.escapeHtml(opt)}" ${disabled}>
        <span class="n-answer__btn-letter">${letter}</span>
        <span class="n-answer__btn-text">${UI.escapeHtml(opt)}</span>
        <span style="font-size: 14px; color: var(--n-chrome-indigo);">▶</span>
      </button>
    `;
  },

  // ════════════════════════════════════════════════════════════
  // Modal — Carbon header dengan chrome-indigo bevel
  // ════════════════════════════════════════════════════════════
  roundResultModal(result, players) {
    if (!result || !result.results) return '';
    return `
      <div class="n-modal-backdrop">
        <div class="n-modal" id="round-result-modal">
          <div class="n-modal__header">
            <span>≡ Ronde ${result.roundNumber} Selesai</span>
          </div>
          <div class="n-modal__body">
            <p style="text-align: center; margin-bottom: 12px; padding: 8px; background: var(--n-amber); color: var(--n-carbon); border: 1px solid var(--n-nav-gold); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-size: 11px;">
              ⭐ Jawaban benar: <strong style="font-size: 13px;">${UI.escapeHtml(result.correctAnswer)}</strong>
            </p>
            <div class="n-stack">
              ${result.results.map((res) => `
                <div class="n-castle" style="padding: 6px;">
                  <div class="n-castle__name">
                    <span>${UI.escapeHtml(res.name)}</span>
                    <span class="n-badge ${res.shielded ? 'n-badge--shield' : 'n-badge--red'}">${res.shielded ? '🛡 SHIELD' : `−${res.damage} HP`}</span>
                  </div>
                  <div style="font-size: 11px; color: var(--n-ink-soft); font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px;">
                    ${res.correct ? '✓ BENAR' : res.submitted ? '✗ SALAH' : '⏱ TIDAK JAWAB'} · Tim ${res.team}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="n-modal__actions">
            <button class="n-btn n-btn--primary" disabled>⏳ 3 detik...</button>
          </div>
        </div>
      </div>
    `;
  },

  matchEndModal(end, players) {
    if (!end || !players || !Array.isArray(players)) return '';
    const me = players.find((p) => p.id === Client.socket?.id);

    let title, subtitle, winColor;
    if (end.winner === 'draw') {
      title = '⚖️ SERI!';
      subtitle = 'Tidak ada pemenang.';
      winColor = 'var(--n-amber)';
    } else if (me?.team === end.winner) {
      title = '🏆 KAMU MENANG!';
      subtitle = `Tim ${end.winner} memenangkan duel.`;
      winColor = 'var(--n-shield)';
    } else {
      title = '💀 KAMU KALAH';
      subtitle = `Tim ${end.winner} memenangkan duel.`;
      winColor = 'var(--n-primary)';
    }

    return `
      <div class="n-modal-backdrop">
        <div class="n-modal" id="match-end-modal">
          <div class="n-modal__header">
            <span>≡ Pertandingan Selesai</span>
          </div>
          <div class="n-modal__body">
            <div style="text-align: center; padding: 16px 8px; background: ${winColor}; color: var(--n-on-primary); border: 1px solid; margin-bottom: 12px;">
              <div style="font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">${title}</div>
              <div style="font-size: 12px; font-weight: 700;">${subtitle}</div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              ${[1, 2].map((team) => {
                const teamPlayers = end.finalPlayers.filter((p) => p.team === team);
                const totalHp = end.totalHp[team];
                const isWinner = end.winner === team;
                return `
                  <div class="n-plate ${isWinner ? '' : ''}" style="padding: 8px; ${isWinner ? 'background: var(--n-shield); color: var(--n-on-primary);' : ''}">
                    <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Tim ${team} ${isWinner ? '🏆' : ''}</div>
                    <div style="font-size: 22px; font-weight: 900; font-variant-numeric: tabular-nums; line-height: 1;">${totalHp} HP</div>
                    <div style="font-size: 10px; margin-top: 4px; opacity: 0.85;">${teamPlayers.map(p => UI.escapeHtml(p.name)).join(', ') || '—'}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
          <div class="n-modal__actions">
            <button class="n-btn n-btn--submit" id="btn-back-lobby">⬅ Kembali ke Lobby</button>
          </div>
        </div>
      </div>
    `;
  },

  usernameModal() {
    return `
      <div class="n-modal-backdrop" id="username-modal-backdrop" style="z-index: 9999;">
        <div class="n-modal">
          <div class="n-modal__header">
            <span>≡ Set Username</span>
          </div>
          <div class="n-modal__body">
            <p style="font-size: 12px; margin-bottom: 8px;">Silakan masukkan username kamu sebelum bermain.</p>
            <input id="global-username-input" class="n-field__input" type="text" placeholder="Nama Kamu" maxlength="20" autocomplete="off" />
          </div>
          <div class="n-modal__actions">
            <button class="n-btn n-btn--submit n-btn--block" id="btn-save-username">Simpan</button>
          </div>
        </div>
      </div>
    `;
  },

  confirmDialog(opts) {
    if (!opts) return '';
    const { title, message, confirmText = 'Ya', cancelText = 'Batal', danger = false } = opts;
    return `
      <div class="n-modal-backdrop">
        <div class="n-modal">
          <div class="n-modal__header">
            <span>≡ ${UI.escapeHtml(title)}</span>
          </div>
          <div class="n-modal__body">
            <p style="font-size: 12px; line-height: 1.5;">${UI.escapeHtml(message)}</p>
          </div>
          <div class="n-modal__actions">
            <button class="n-btn n-btn--secondary" id="btn-confirm-cancel">${UI.escapeHtml(cancelText)}</button>
            <button class="n-btn ${danger ? 'n-btn--danger' : 'n-btn--submit'}" id="btn-confirm-ok">${UI.escapeHtml(confirmText)}</button>
          </div>
        </div>
      </div>
    `;
  },

  // ════════════════════════════════════════════════════════════
  // Footer (Carbon dengan ESRB badge)
  // ════════════════════════════════════════════════════════════
  footer() {
    return `
      <footer class="n-footer" style="margin-top: auto; height: auto; min-height: unset; padding: 32px 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; text-align: center; box-sizing: border-box; background: var(--n-carbon, #21242e); border-top: 2px solid var(--n-nav-gold, #cfb078);">
        <h2 style="font-size: 28px; font-weight: 900; color: var(--n-surface, #ffffff); letter-spacing: 4px; margin: 0 0 4px 0; opacity: 0.95;">
          IKUZE JAPAN
        </h2>
        <div style="display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; color: var(--n-platinum, #dedede); opacity: 0.55; line-height: 1.4; text-transform: uppercase;">
          <span>© 2026 Kanji Duel</span>
          <span>&bull;</span>
          <span>Multiplayer Quiz Battle</span>
        </div>
      </footer>
    `;
  },
};

// Add shake animation for damage (used in castlePanel)
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    @keyframes n-shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-4px); }
      40% { transform: translateX(4px); }
      60% { transform: translateX(-3px); }
      80% { transform: translateX(3px); }
    }
    .n-castle--shield { border-color: var(--n-shield); border-width: 2px; animation: n-shield-glow 1.5s infinite; }
    @keyframes n-shield-glow {
      0%, 100% { box-shadow: 0 0 4px var(--n-shield); }
      50% { box-shadow: 0 0 12px var(--n-shield); }
    }
  `;
  document.head.appendChild(styleEl);
}
