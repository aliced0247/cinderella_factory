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
      this.scale.on('resize', () => this.relayout());

      this.events.on('shutdown', () => {
        CF.events.off('money', this.updateMoney, this);
        CF.events.off('toast', this.showToast, this);
      });

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
        if (this.paletteDragging) return;
        CF.ui.buildDir = (CF.ui.buildDir + 1) & 3;
        this.dirArrow.setRotation(CF.ui.buildDir * Math.PI / 2);
      });
    }

    selectTool(type) {
      if (this.paletteDragging) return; // スクロール中のタップは無視
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
      if (y >= h - BOTTOM_H) return true; // 下部バー
      // 上部バー
      if (Math.abs(x - this.topBar.x) < 100 && y < this.topBar.y + TOP_H / 2) return true;
      // スティック
      if (Phaser.Math.Distance.Between(x, y, this.joyBase.x, this.joyBase.y) <= 70) return true;
      return false;
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
