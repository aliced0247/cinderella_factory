/**
 * アイテム定義（Phase 1は2種）
 * price … 納品箱に入れたときの売値（リル）※仮価格
 * tex   … テクスチャキー（config/assets.js のキーに対応）
 */
window.CF = window.CF || {};

CF.ITEMS = {
  gem_ore: {
    name: '宝石原石',
    price: 1,
    tex: 'item_gem_ore'
  },
  gem_polished: {
    name: '研磨宝石',
    price: 5,
    tex: 'item_gem_polished'
  }
};
