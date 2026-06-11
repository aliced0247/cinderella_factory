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

      // 仮想スティック操作
      this.input.on('pointerdown', (p) => this.joyDown(p));
      this.input.on('pointermove', (p) => this.joyMove(p));
      this.input.on('pointerup', (p) => this.joyUp(p));
      this.input.on('pointerupoutside', (p) => this.joyUp(p));
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
    }

    // ------------------------------------------------------------ 下部バー（建設パレット）

    createBottomBar() {
      this.bottomBar = this.add.container(0, 0);
      this.bottomBg = this.add.rectangle(0, 0, 100, BOTTOM_H, CF.hex(P.CREAM), 0.96)
        .setStrokeStyle(2, CF.hex(P.GOLD_2));
      this.bottomBar.add(this.bottomBg);

      // 建設ボタン4種
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
        cont.add([bg, icon, label]);
        bg.on('pointerup', () => this.selectTool(type));
        this.bottomBar.add(cont);
        this.buttons[type] = { cont, bg, icon };
      }

      // 向きボタン（次に設置するものの向き）
      {
        const cont = this.add.container(0, 0);
        const bg = this.add.rectangle(0, -4, 58, 58, CF.hex(P.LAVENDER_1))
          .setStrokeStyle(2, CF.hex(P.LAVENDER_3)).setInteractive();
        this.dirArrow = this.add.text(0, -8, '➜', {
          fontSize: '24px', fontStyle: 'bold', color: P.LAVENDER_3
        }).setOrigin(0.5);
        const label = this.add.text(0, 22, 'むき', {
          fontSize: '9px', fontStyle: 'bold', color: P.COCOA_SHADOW
        }).setOrigin(0.5);
        cont.add([bg, this.dirArrow, label]);
        bg.on('pointerup', () => {
          CF.ui.buildDir = (CF.ui.buildDir + 1) & 3;
          this.dirArrow.setRotation(CF.ui.buildDir * Math.PI / 2);
        });
        this.bottomBar.add(cont);
        this.buttons._dir = { cont, bg };
      }
    }

    selectTool(type) {
      CF.ui.tool = (CF.ui.tool === type) ? null : type; // 再タップで解除
      for (const t of CF.BUILD_ORDER) {
        const sel = CF.ui.tool === t;
        this.buttons[t].bg
          .setFillStyle(CF.hex(sel ? P.GOLD_1 : P.MILK))
          .setStrokeStyle(sel ? 3 : 2, CF.hex(sel ? P.GOLD_2 : P.MILK_TEA));
      }
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

      this.topBar.setPosition(w / 2, 6 + TOP_H / 2 - 5);
      this.bottomBar.setPosition(w / 2, h - BOTTOM_H / 2);
      this.bottomBg.setSize(w, BOTTOM_H);

      // ボタンを中央寄せで並べる
      const keys = [...CF.BUILD_ORDER, '_dir'];
      const bw = 58, gap = Math.min(10, (w - bw * keys.length) / (keys.length + 1));
      const total = bw * keys.length + gap * (keys.length - 1);
      let x = -total / 2 + bw / 2;
      for (const k of keys) {
        this.buttons[k].cont.setPosition(x, 0);
        x += bw + gap;
      }

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
