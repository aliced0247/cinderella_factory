/**
 * UIScene：画面固定UI（Phase 1最小）
 *  - 上部：所持リル表示（金縁風フレーム #F2B73F）
 *  - 下部：建設パレット（4種＋向きボタン）
 *  - 左下：姫移動用の仮想スティック
 */
window.CF = window.CF || {};

// シーン間で共有するUI状態
CF.ui = {
  tool: null,     // 選択中の建設道具（null=選択なし）
  buildDir: 0,    // 設置時の向き
  modal: false,   // クローゼット／増築などのモーダル表示中
  isOverUI() { return false; } // UIScene生成時に差し替え
};
CF.input = { joy: { x: 0, y: 0 } };

(function () {
  const P = CF.PALETTE;
  const BOTTOM_H = 84;
  const TOP_H = 44;

  CF.UIScene = class UIScene extends Phaser.Scene {
    constructor() {
      super('UI');
    }

    create() {
      this.buttons = {};
      this.toastText = null;
      this.joyPointerId = null;
      this.scroll = { min: 0, max: 0 };       // パレット横スクロール範囲
      this.paletteDrag = null;                // パレットのドラッグ状態
      this.paletteDragging = false;           // ドラッグ中（タップ抑止フラグ）

      this.createTopBar();
      this.createBottomBar();
      this.createJoystick();
      this.relayout();

      // 当たり判定をGameSceneと共有
      CF.ui.isOverUI = (x, y) => this.isOverUI(x, y);

      CF.events.on('money', this.updateMoney, this);
      CF.events.on('toast', this.showToast, this);
      CF.events.on('wardrobe:open', this.openWardrobe, this);
      CF.events.on('expand:open', this.openExpand, this);
      this.scale.on('resize', () => this.relayout());

      this.events.on('shutdown', () => {
        CF.events.off('money', this.updateMoney, this);
        CF.events.off('toast', this.showToast, this);
        CF.events.off('wardrobe:open', this.openWardrobe, this);
        CF.events.off('expand:open', this.openExpand, this);
      });

      this.modal = null;

      // 仮想スティック＋パレット横スクロール
      this.input.on('pointerdown', (p) => this.onUiDown(p));
      this.input.on('pointermove', (p) => this.onUiMove(p));
      this.input.on('pointerup', (p) => this.onUiUp(p));
      this.input.on('pointerupoutside', (p) => this.onUiUp(p));
    }

    // ------------------------------------------------------------ 入力ルーティング

    inBottomBar(p) {
      return p.y >= this.scale.height - BOTTOM_H;
    }

    onUiDown(p) {
      if (CF.ui.modal) return; // モーダル中はスティック・パレットを止める
      this.paletteDragging = false;
      // スティック優先（左下の円内）
      const dj = Phaser.Math.Distance.Between(p.x, p.y, this.joyBase.x, this.joyBase.y);
      if (dj <= 70 && this.joyPointerId === null && !this.inBottomBar(p)) {
        this.joyDown(p);
        return;
      }
      // 下部バー：パレットの横スクロール開始（タップ判定はボタン側）
      if (this.inBottomBar(p) && this.paletteDrag === null) {
        this.paletteDrag = { id: p.id, startX: p.x, x0: this.paletteStrip.x };
      }
    }

    onUiMove(p) {
      this.joyMove(p);
      if (this.paletteDrag && this.paletteDrag.id === p.id && p.isDown) {
        const dx = p.x - this.paletteDrag.startX;
        if (Math.abs(dx) > 8) this.paletteDragging = true;
        if (this.paletteDragging) {
          this.paletteStrip.x = Phaser.Math.Clamp(
            this.paletteDrag.x0 + dx, this.scroll.min, this.scroll.max);
        }
      }
    }

    onUiUp(p) {
      this.joyUp(p);
      if (this.paletteDrag && this.paletteDrag.id === p.id) this.paletteDrag = null;
    }

    // ------------------------------------------------------------ 上部バー（所持リル）

    createTopBar() {
      this.topBar = this.add.container(0, 0);
      this.topBg = this.add.rectangle(0, 0, 190, TOP_H - 10, CF.hex(P.MILK), 0.95)
        .setStrokeStyle(3, CF.hex(P.GOLD_2));
      this.topGem = this.add.image(-72, 0, 'item_gem_polished').setScale(1.4);
      this.moneyText = this.add.text(-56, 0, '', {
        fontSize: '17px', fontStyle: 'bold', color: P.GOLD_3
      }).setOrigin(0, 0.5);
      this.topBar.add([this.topBg, this.topGem, this.moneyText]);
      this.updateMoney();
    }

    updateMoney() {
      this.moneyText.setText(`${CF.state.money.toLocaleString()} リル`);
      this.refreshButtons();
    }

    affordable(type) {
      return CF.state.money >= CF.BUILDINGS[type].cost;
    }

    /** 各建設ボタンの見た目を「選択中／買えるか」で更新 */
    refreshButtons() {
      if (!this.buttons) return;
      // 選択中の道具が買えなくなったら自動で解除
      if (CF.ui.tool && !this.affordable(CF.ui.tool)) {
        CF.ui.tool = null;
        CF.events.emit('tool', null);
      }
      for (const type of CF.BUILD_ORDER) {
        const btn = this.buttons[type];
        if (!btn) continue;
        const sel = CF.ui.tool === type;
        const ok = this.affordable(type);
        // リル不足はグレーアウト（選択不可）
        const alpha = ok ? 1 : 0.4;
        btn.icon.setAlpha(alpha);
        btn.label.setAlpha(alpha);
        btn.bg.setFillStyle(CF.hex(sel ? P.GOLD_1 : (ok ? P.MILK : P.MILK_TEA)),
          ok ? 1 : 0.6);
        btn.bg.setStrokeStyle(sel ? 3 : 2, CF.hex(sel ? P.GOLD_2 : P.MILK_TEA));
        // 価格バッジ：買えるなら金、買えないなら赤系（必要額を強調）
        btn.costBg.setFillStyle(CF.hex(ok ? P.GOLD_1 : P.SUGAR_PINK))
          .setStrokeStyle(1, CF.hex(ok ? P.GOLD_2 : P.CHERRY));
        btn.costTx.setColor(ok ? P.GOLD_3 : P.CHERRY).setAlpha(1);
      }
    }

    // ------------------------------------------------------------ 下部バー（建設パレット）

    createBottomBar() {
      this.bottomBg = this.add.rectangle(0, 0, 100, BOTTOM_H, CF.hex(P.CREAM), 0.96)
        .setStrokeStyle(2, CF.hex(P.GOLD_2)).setOrigin(0.5);

      // 横スクロールするパレット帯（建設ボタンを内包）
      this.paletteStrip = this.add.container(0, 0);

      for (const type of CF.BUILD_ORDER) {
        const def = CF.BUILDINGS[type];
        const cont = this.add.container(0, 0);
        const bg = this.add.rectangle(0, -4, 58, 58, CF.hex(P.MILK))
          .setStrokeStyle(2, CF.hex(P.MILK_TEA)).setInteractive();
        const icon = this.add.image(0, -8, def.tex)
          .setScale(def.size === 1 ? 1.1 : 0.62);
        const label = this.add.text(0, 22, def.name, {
          fontSize: '9px', fontStyle: 'bold', color: P.COCOA_SHADOW
        }).setOrigin(0.5);
        // 価格バッジ（上部・金色）
        const costBg = this.add.rectangle(0, -27, 46, 15, CF.hex(P.GOLD_1))
          .setStrokeStyle(1, CF.hex(P.GOLD_2));
        const costTx = this.add.text(0, -27, `${def.cost}リル`, {
          fontSize: '10px', fontStyle: 'bold', color: P.GOLD_3
        }).setOrigin(0.5);
        cont.add([bg, icon, label, costBg, costTx]);
        bg.on('pointerup', () => this.selectTool(type));
        this.paletteStrip.add(cont);
        this.buttons[type] = { cont, bg, icon, label, costBg, costTx };
      }

      // パレット帯のマスク（はみ出しを下部バー内に収める）
      this.paletteMaskG = this.add.graphics().setVisible(false);
      this.paletteStrip.setMask(this.paletteMaskG.createGeometryMask());

      // 向きボタン（右端固定・スクロールしない）
      this.dirBtn = this.add.container(0, 0);
      const dbg = this.add.rectangle(0, -4, 58, 58, CF.hex(P.LAVENDER_1))
        .setStrokeStyle(2, CF.hex(P.LAVENDER_3)).setInteractive();
      this.dirArrow = this.add.text(0, -8, '➜', {
        fontSize: '24px', fontStyle: 'bold', color: P.LAVENDER_3
      }).setOrigin(0.5);
      const dlabel = this.add.text(0, 22, 'むき', {
        fontSize: '9px', fontStyle: 'bold', color: P.COCOA_SHADOW
      }).setOrigin(0.5);
      this.dirBtn.add([dbg, this.dirArrow, dlabel]);
      dbg.on('pointerup', () => {
        if (this.paletteDragging || CF.ui.modal) return;
        CF.ui.buildDir = (CF.ui.buildDir + 1) & 3;
        this.dirArrow.setRotation(CF.ui.buildDir * Math.PI / 2);
      });
    }

    selectTool(type) {
      if (this.paletteDragging || CF.ui.modal) return; // スクロール中／モーダル中は無視
      // リル不足の道具は選べない（必要額を案内）
      if (CF.ui.tool !== type && !this.affordable(type)) {
        this.showToast(`${CF.BUILDINGS[type].name}には${CF.BUILDINGS[type].cost}リル必要だよ`);
        return;
      }
      CF.ui.tool = (CF.ui.tool === type) ? null : type; // 再タップで解除
      this.refreshButtons();
      CF.events.emit('tool', CF.ui.tool);
      if (CF.ui.tool === 'belt') this.showToast('ドラッグでベルトを連続敷設できるよ');
      else if (CF.ui.tool) this.showToast(`タップで${CF.BUILDINGS[CF.ui.tool].name}を設置`);
    }

    // ------------------------------------------------------------ 仮想スティック

    createJoystick() {
      this.joyBase = this.add.circle(0, 0, 46, CF.hex(P.MILK), 0.45)
        .setStrokeStyle(3, CF.hex(P.GOLD_2), 0.7);
      this.joyKnob = this.add.circle(0, 0, 20, CF.hex(P.PINK_2), 0.85)
        .setStrokeStyle(2, CF.hex(P.PINK_3), 0.9);
    }

    joyDown(p) {
      const d = Phaser.Math.Distance.Between(p.x, p.y, this.joyBase.x, this.joyBase.y);
      if (d <= 70 && this.joyPointerId === null) {
        this.joyPointerId = p.id;
        this.joyMove(p);
      }
    }

    joyMove(p) {
      if (p.id !== this.joyPointerId || !p.isDown) return;
      let dx = p.x - this.joyBase.x;
      let dy = p.y - this.joyBase.y;
      const len = Math.hypot(dx, dy);
      const max = 40;
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      this.joyKnob.setPosition(this.joyBase.x + dx, this.joyBase.y + dy);
      const dead = 6;
      CF.input.joy.x = len > dead ? dx / max : 0;
      CF.input.joy.y = len > dead ? dy / max : 0;
    }

    joyUp(p) {
      if (p.id !== this.joyPointerId) return;
      this.joyPointerId = null;
      CF.input.joy.x = 0;
      CF.input.joy.y = 0;
      this.joyKnob.setPosition(this.joyBase.x, this.joyBase.y);
    }

    // ------------------------------------------------------------ レイアウト（縦横両対応）

    relayout() {
      const w = this.scale.width;
      const h = this.scale.height;
      const stripY = h - BOTTOM_H / 2;

      this.topBar.setPosition(w / 2, 6 + TOP_H / 2 - 5);
      this.bottomBg.setPosition(w / 2, stripY).setSize(w, BOTTOM_H);

      const bw = 58, gap = 8, pad = 8;

      // 向きボタン（右端固定）
      const dirX = w - pad - bw / 2;
      this.dirBtn.setPosition(dirX, stripY);

      // パレット帯：右端の向きボタンの左側が可動領域
      const regionLeft = pad;
      const regionRight = dirX - bw / 2 - gap;
      const availW = Math.max(bw, regionRight - regionLeft);

      const n = CF.BUILD_ORDER.length;
      const contentW = n * bw + (n - 1) * gap;
      // 帯内のローカル配置（左から）
      CF.BUILD_ORDER.forEach((k, i) => {
        this.buttons[k].cont.setPosition(i * (bw + gap) + bw / 2, 0);
      });

      if (contentW <= availW) {
        // 収まる：中央寄せ・スクロールなし
        const x = regionLeft + (availW - contentW) / 2;
        this.scroll.min = this.scroll.max = x;
      } else {
        this.scroll.max = regionLeft;                       // 先頭を左端に
        this.scroll.min = regionLeft + availW - contentW;   // 末尾を右端に
      }
      this.paletteStrip.y = stripY;
      this.paletteStrip.x = Phaser.Math.Clamp(this.paletteStrip.x, this.scroll.min, this.scroll.max);

      // マスク更新（帯の可視範囲＝下部バー内の可動領域）
      this.paletteMaskG.clear();
      this.paletteMaskG.fillStyle(0xffffff);
      this.paletteMaskG.fillRect(regionLeft - bw / 2, h - BOTTOM_H, availW + bw, BOTTOM_H);

      // スティックは左下（下部バーの上）
      const jx = 76;
      const jy = h - BOTTOM_H - 72;
      this.joyBase.setPosition(jx, jy);
      this.joyKnob.setPosition(jx, jy);

      if (this.toastText) this.toastText.setPosition(w / 2, h - BOTTOM_H - 24);
    }

    isOverUI(x, y) {
      const w = this.scale.width;
      const h = this.scale.height;
      if (CF.ui.modal) return true;       // モーダル中は全面UI扱い
      if (y >= h - BOTTOM_H) return true; // 下部バー
      // 上部バー
      if (Math.abs(x - this.topBar.x) < 100 && y < this.topBar.y + TOP_H / 2) return true;
      // スティック
      if (Phaser.Math.Distance.Between(x, y, this.joyBase.x, this.joyBase.y) <= 70) return true;
      return false;
    }

    // ------------------------------------------------------------ モーダル（着せ替え／増築）
    // UIScene は zoom 1 の固定カメラなので、モーダルは画面座標でブレずに出せる

    _openModal() {
      this.closeModal();
      CF.ui.modal = true;
      CF.input.joy.x = CF.input.joy.y = 0;
      this.joyPointerId = null;
      this.joyKnob.setPosition(this.joyBase.x, this.joyBase.y);
      const w = this.scale.width, h = this.scale.height;
      const layer = this.add.container(0, 0).setDepth(1000);
      const dim = this.add.rectangle(0, 0, w, h, CF.hex(P.MIDNIGHT), 0.45).setOrigin(0).setInteractive();
      layer.add(dim);
      this.modal = layer;
      return { layer, cx: w / 2, cy: h / 2 };
    }

    closeModal() {
      if (this.modal) { this.modal.destroy(); this.modal = null; }
      CF.ui.modal = false;
    }

    _panel(m, pw, ph, title) {
      const { layer, cx, cy } = m;
      const panel = this.add.rectangle(cx, cy, pw, ph, CF.hex(P.MILK), 0.98).setStrokeStyle(3, CF.hex(P.GOLD_2));
      const head = this.add.text(cx, cy - ph / 2 + 18, title, { fontSize: '16px', fontStyle: 'bold', color: P.GOLD_3 }).setOrigin(0.5);
      const xBg = this.add.rectangle(cx + pw / 2 - 16, cy - ph / 2 + 16, 26, 26, CF.hex(P.SUGAR_PINK)).setStrokeStyle(2, CF.hex(P.CHERRY)).setInteractive();
      const xTx = this.add.text(xBg.x, xBg.y, '✕', { fontSize: '15px', fontStyle: 'bold', color: P.CHERRY }).setOrigin(0.5);
      xBg.on('pointerup', () => this.closeModal());
      layer.add([panel, head, xBg, xTx]);
      return { cx, cy, pw, ph };
    }

    openWardrobe() {
      const m = this._openModal();
      const pw = 300, ph = 232;
      const pn = this._panel(m, pw, ph, 'クローゼット');
      const rows = [
        { type: 'dress', fx: '見た目が変わる' },
        { type: 'tiara', fx: '納品売上 +5%' },
        { type: 'bouquet', fx: '歩く速さ +10%' }
      ];
      rows.forEach((row, idx) => {
        const y = pn.cy - 56 + idx * 56;
        const slot = CF.EQUIP_SLOT[row.type];
        const count = CF.state.wardrobe[row.type] || 0;
        const equipped = CF.state.equip[slot] === row.type;
        const dim = count === 0 && !equipped;

        const icon = this.add.image(pn.cx - pw / 2 + 30, y, CF.ITEMS[row.type].tex).setScale(1.7).setAlpha(dim ? 0.4 : 1);
        const name = this.add.text(pn.cx - pw / 2 + 52, y - 9, `${CF.ITEMS[row.type].name} ×${count}`, {
          fontSize: '13px', fontStyle: 'bold', color: P.COCOA_SHADOW
        }).setOrigin(0, 0.5).setAlpha(dim ? 0.5 : 1);
        const fx = this.add.text(pn.cx - pw / 2 + 52, y + 9, row.fx, { fontSize: '10px', color: P.LAVENDER_3 }).setOrigin(0, 0.5).setAlpha(dim ? 0.5 : 1);

        const bx = pn.cx + pw / 2 - 44;
        const fill = equipped ? P.GOLD_1 : (dim ? P.MILK_TEA : P.MINT_1);
        const stroke = equipped ? P.GOLD_2 : (dim ? P.BISCUIT : P.MINT_3);
        const btn = this.add.rectangle(bx, y, 64, 30, CF.hex(fill)).setStrokeStyle(2, CF.hex(stroke));
        const btx = this.add.text(bx, y, equipped ? '外す' : '装備', {
          fontSize: '12px', fontStyle: 'bold', color: equipped ? P.GOLD_3 : P.COCOA_SHADOW
        }).setOrigin(0.5).setAlpha(dim ? 0.5 : 1);
        if (!dim) {
          btn.setInteractive();
          btn.on('pointerup', () => {
            CF.state.equip[slot] = equipped ? null : row.type;
            CF.events.emit('appearance');   // 姫の見た目を更新（GameScene）
            CF.events.emit('toast', equipped ? `${CF.ITEMS[row.type].name}を外した` : `${CF.ITEMS[row.type].name}を装備！`);
            CF.Save.request();
            this.openWardrobe(); // 再描画
          });
        }
        m.layer.add([icon, name, fx, btn, btx]);
      });
    }

    openExpand() {
      const m = this._openModal();
      const pw = 280, ph = 162;
      const pn = this._panel(m, pw, ph, '工房を増築する？');
      const info = this.add.text(pn.cx, pn.cy - 18, `右どなりに新しい部屋（${CF.ROOM_W}×${CF.ROOM_H}）`, {
        fontSize: '12px', color: P.COCOA_SHADOW, align: 'center'
      }).setOrigin(0.5);
      const cost = this.add.text(pn.cx, pn.cy + 4, `${CF.EXPAND_COST} リル`, { fontSize: '20px', fontStyle: 'bold', color: P.GOLD_3 }).setOrigin(0.5);

      const noBg = this.add.rectangle(pn.cx - 64, pn.cy + 44, 96, 34, CF.hex(P.MILK_TEA)).setStrokeStyle(2, CF.hex(P.BISCUIT)).setInteractive();
      const noTx = this.add.text(noBg.x, noBg.y, 'やめる', { fontSize: '13px', fontStyle: 'bold', color: P.COCOA_SHADOW }).setOrigin(0.5);
      noBg.on('pointerup', () => this.closeModal());

      const ok = CF.state.money >= CF.EXPAND_COST;
      const yesBg = this.add.rectangle(pn.cx + 64, pn.cy + 44, 96, 34, CF.hex(ok ? P.GOLD_1 : P.MILK_TEA)).setStrokeStyle(2, CF.hex(ok ? P.GOLD_2 : P.BISCUIT));
      const yesTx = this.add.text(yesBg.x, yesBg.y, ok ? '増築する' : `あと${CF.EXPAND_COST - CF.state.money}`, {
        fontSize: '13px', fontStyle: 'bold', color: ok ? P.GOLD_3 : P.COCOA_SHADOW
      }).setOrigin(0.5).setAlpha(ok ? 1 : 0.6);
      if (ok) {
        yesBg.setInteractive();
        yesBg.on('pointerup', () => { CF.events.emit('expand:do'); this.closeModal(); });
      }
      m.layer.add([info, cost, noBg, noTx, yesBg, yesTx]);
    }

    // ------------------------------------------------------------ トースト

    showToast(msg) {
      if (this.toastText) this.toastText.destroy();
      const t = this.add.text(this.scale.width / 2, this.scale.height - BOTTOM_H - 24, msg, {
        fontSize: '13px', fontStyle: 'bold',
        color: P.COCOA_SHADOW,
        backgroundColor: P.MILK,
        padding: { x: 10, y: 5 }
      }).setOrigin(0.5).setAlpha(0.97);
      this.toastText = t;
      this.tweens.add({
        targets: t, alpha: 0, delay: 1600, duration: 400,
        onComplete: () => { if (this.toastText === t) this.toastText = null; t.destroy(); }
      });
    }
  };
})();
