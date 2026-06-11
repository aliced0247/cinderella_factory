/**
 * BootScene：アセット読み込み → プレースホルダー生成 → ゲーム開始
 *
 * config/assets.js の file が指定されていれば画像を読み込み、
 * 無い（または読み込み失敗）ならプレースホルダーを自動生成する。
 * → 素材差し替えでコード変更が発生しない構造
 */
window.CF = window.CF || {};

CF.BootScene = class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // 読み込み失敗してもプレースホルダーで続行できるようにする
    this.load.on('loaderror', (file) => {
      console.warn('画像の読み込みに失敗（プレースホルダーで続行）:', file.key);
    });
    for (const [key, a] of Object.entries(CF.ASSETS)) {
      if (a.file) this.load.image(key, a.file);
    }
  }

  create() {
    // 画像が無いものはプレースホルダー生成
    for (const [key, a] of Object.entries(CF.ASSETS)) {
      if (!this.textures.exists(key)) {
        const gen = CF.PLACEHOLDERS[a.gen];
        if (gen) gen(this, key, a.w, a.h);
        else console.error('プレースホルダー未定義:', a.gen);
      }
    }

    // ワールド初期化（セーブがあれば復元）
    CF.World.init();
    CF.Logistics.reset();

    this.scene.start('Game');
    this.scene.launch('UI');
  }
};
