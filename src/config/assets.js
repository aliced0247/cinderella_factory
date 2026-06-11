/**
 * アセット・マニフェスト（素材差し替えの一元管理ポイント）
 *
 * ★ここが「画像パスとロジックの分離」の要★
 *
 * 各エントリ：
 *   file … 画像ファイルのパス。null ならプレースホルダーを自動生成する
 *   gen  … プレースホルダー生成関数名（core/placeholders.js のキー）
 *   w,h  … 期待サイズ（px）。差し替え画像もこのサイズで作ること
 *
 * 【ドット素材が完成したら】
 *   file に 'assets/xxx.png' を書くだけで差し替え完了。コード変更は不要。
 *   例： building_spawner: { file: 'assets/spawner.png', gen: 'spawner', w: 64, h: 64 },
 *
 * 【向きの規約】
 *   向きを持つもの（ベルト・機械）は「東向き（→ +X）」で描く。回転はコード側で行う。
 */
window.CF = window.CF || {};

CF.ASSETS = {
  // --- 床（32×32） ---
  floor_a:           { file: null, gen: 'floor_a',        w: 32, h: 32 },  // クリーム
  floor_b:           { file: null, gen: 'floor_b',        w: 32, h: 32 },  // シュガーピンク

  // --- 設備 ---
  belt:              { file: null, gen: 'belt',           w: 32, h: 32 },  // 東向き
  building_spawner:  { file: null, gen: 'spawner',        w: 64, h: 64 },  // 魔法の泉 2×2
  building_polisher: { file: null, gen: 'polisher',       w: 64, h: 64 },  // 研磨機 2×2
  building_delivery: { file: null, gen: 'delivery',       w: 64, h: 64 },  // 納品箱 2×2

  // --- アイテム ---
  item_gem_ore:      { file: null, gen: 'gem_ore',        w: 16, h: 16 },
  item_gem_polished: { file: null, gen: 'gem_polished',   w: 16, h: 16 },

  // --- キャラ ---
  princess:          { file: null, gen: 'princess',       w: 32, h: 48 },  // 姫 32×48

  // --- エフェクト ---
  sparkle:           { file: null, gen: 'sparkle',        w: 8,  h: 8 }    // キラキラ粒子
};
