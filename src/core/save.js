/**
 * セーブ／ロード（localStorage）
 * 保存対象：所持リル＋各部屋の設備配置
 * ※ベルト上を流れているアイテム・加工中の中身はPhase 1では保存しない
 */
window.CF = window.CF || {};

CF.Save = {
  KEY: 'cinderella_factory_save_v1',
  _timer: null,

  /** 現在の状態をシリアライズして保存 */
  save() {
    try {
      const data = {
        v: 1,
        money: CF.state.money,
        rooms: CF.World.rooms.map((room) => ({
          w: room.w,
          h: room.h,
          buildings: room.buildings.map((b) => ({
            t: b.type, x: b.x, y: b.y, d: b.dir
          }))
        }))
      };
      localStorage.setItem(this.KEY, JSON.stringify(data));
    } catch (e) {
      // プライベートブラウズ等で失敗しても遊べるように握りつぶす
      console.warn('セーブ失敗:', e);
    }
  },

  /** 保存データを読む（無ければnull） */
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.v !== 1) return null;
      return data;
    } catch (e) {
      console.warn('ロード失敗:', e);
      return null;
    }
  },

  /** 変更時に呼ぶ（1秒デバウンスで自動保存） */
  request() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._timer = null;
      this.save();
    }, 1000);
  },

  /** データ全消去（デバッグ用：コンソールから CF.Save.reset()） */
  reset() {
    localStorage.removeItem(this.KEY);
    location.reload();
  }
};

// タブを閉じる・バックグラウンドに回る瞬間にも保存
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && CF.state) CF.Save.save();
});
