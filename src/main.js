/**
 * シンデレラ・ファクトリー Phase 1 — 起動
 * Factorioリスペクト工場自動化 × お姫様成り上がり
 */
window.CF = window.CF || {};

// シーン間イベントバス
CF.events = new Phaser.Events.EventEmitter();

CF.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: CF.PALETTE.MILK,
  scale: {
    mode: Phaser.Scale.RESIZE,        // 縦持ち・横持ち両対応
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  render: {
    pixelArt: true,                   // ドット絵前提（拡大時もくっきり）
    roundPixels: true
  },
  scene: [CF.BootScene, CF.GameScene, CF.UIScene]
});

// 定期オートセーブ（保険。通常は変更時のデバウンス保存）
setInterval(() => {
  if (CF.state && CF.World.rooms.length) CF.Save.save();
}, 15000);
