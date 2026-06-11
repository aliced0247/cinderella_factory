/**
 * アイテム定義
 * price … 納品箱に入れたときの売値（リル）※仮価格
 * tex   … テクスチャキー（config/assets.js のキーに対応）
 * tier  … 'raw'（原料）/ 'mid'（中間素材）/ 'lux'（高級品）。表示・演出の参考用
 *
 * 価格設計（Phase 2）：加工段数が深いほど跳ねる
 *   原料1 → 中間4〜6 → 高級品15〜40
 */
window.CF = window.CF || {};

CF.ITEMS = {
  // --- 原料 ---
  gem_ore:      { name: '宝石原石', price: 1,  tex: 'item_gem_ore',      tier: 'raw' },
  silk:         { name: '絹糸',     price: 1,  tex: 'item_silk',         tier: 'raw' },
  flower:       { name: '花',       price: 1,  tex: 'item_flower',       tier: 'raw' },

  // --- 中間素材 ---
  gem_polished: { name: '研磨宝石', price: 5,  tex: 'item_gem_polished', tier: 'mid' },
  ribbon:       { name: 'リボン',   price: 4,  tex: 'item_ribbon',       tier: 'mid' },
  lace:         { name: 'レース',   price: 6,  tex: 'item_lace',         tier: 'mid' },

  // --- 高級品 ---
  bouquet:      { name: 'ブーケ',   price: 15, tex: 'item_bouquet',      tier: 'lux' },
  tiara:        { name: 'ティアラ', price: 25, tex: 'item_tiara',        tier: 'lux' },
  dress:        { name: 'ドレス',   price: 40, tex: 'item_dress',        tier: 'lux' }
};
