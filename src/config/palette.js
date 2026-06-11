/**
 * 姫の国 パレット表 v1（全40色・確定）
 * 出典：「👑 お姫様工場ゲーム 設計書 v1」
 * ※アクセント高彩度6色はレア素材・宝石・重要UI限定（画面の5%以下）
 */
window.CF = window.CF || {};

CF.PALETTE = {
  // --- 昼ベース ---
  MILK:          '#FFFDF7', // ミルク
  CREAM:         '#FFF3E2', // クリーム（床市松A）
  SUGAR_PINK:    '#FFE9F0', // シュガーピンク（床市松B）
  MILK_TEA:      '#EBD8BF', // ミルクティー
  BISCUIT:       '#D6B68C', // ビスケット
  COCOA_SHADOW:  '#A98563', // ココアシャドウ

  // --- ピンク系（布・リボン・ベルトレーン） ---
  PINK_1:        '#FFD3E3',
  PINK_2:        '#FF9EC6',
  PINK_3:        '#E26FA0',

  // --- ミント系（植物・ガラス・水） ---
  MINT_1:        '#CFF5E6',
  MINT_2:        '#8FE3C6',
  MINT_3:        '#4FBF9F',

  // --- ラベンダー系（魔法・機構） ---
  LAVENDER_1:    '#E6DCFF',
  LAVENDER_2:    '#BCA6F2',
  LAVENDER_3:    '#8E79CC',

  // --- レモン系（光・蜂蜜） ---
  LEMON_1:       '#FFF3C4',
  LEMON_2:       '#FFE08A',
  LEMON_3:       '#ECBE4D',

  // --- アクセント高彩度（レア素材・宝石・重要UIのみ） ---
  JEWEL_PINK:    '#FF4F9A', // ジュエルピンク
  CHERRY:        '#E8334E', // チェリー
  CLEAR_CORAL:   '#FF6F52',
  CLEAR_TURQUOISE:'#14C5C5',
  CLEAR_BLUE:    '#2E8BFF',
  CLEAR_VIOLET:  '#8A4FFF',

  // --- 金系（豪華さ・名声の記号） ---
  GOLD_1:        '#FFE9A8',
  GOLD_2:        '#F2B73F',
  GOLD_3:        '#B97E1F',

  // --- 夜ベース（Phase 1未使用・定義のみ） ---
  MIDNIGHT:      '#161A3D',
  NIGHT_SKY:     '#232A57',
  MOON_LAVENDER: '#6E6BAE',
  STARLIGHT:     '#C9C6F0',

  // --- 夜メイン（Phase 1未使用・定義のみ） ---
  NIGHT_PINK_1:  '#E06FB8',
  NIGHT_PINK_2:  '#A84B90',
  NIGHT_MINT_1:  '#56B8C4',
  NIGHT_MINT_2:  '#2F7E93',
  NIGHT_LAV_1:   '#8E7FE0',
  NIGHT_LAV_2:   '#5F54A8',
  MOON_LEMON_1:  '#F4D77A',
  MOON_LEMON_2:  '#C9A23F',

  // --- 夜の金 ---
  MOON_GOLD:     '#FFD86B'
};

/** '#RRGGBB' → 0xRRGGBB（Phaser用） */
CF.hex = function (h) { return parseInt(h.slice(1), 16); };
