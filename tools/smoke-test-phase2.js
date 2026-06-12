/**
 * シンデレラ・ファクトリー Phase 2 スモークテスト
 * 実ブラウザでレシピ深化の要素を自動検証する：
 *   - 新設備（絹糸/花の泉・ミシン・工房台）の存在と種類ごと上限2
 *   - 最後の泉は全額払い戻し／泉が複数あれば半額
 *   - ミシンのレシピ切替（絹糸→レース）
 *   - 工房台の2素材合成（揃うまで待機→揃ったら加工→ドレス+40リル）
 *   - レシピ外素材は受け取らない（ベルト上で詰まる）
 *   - セーブ引継（所持リル・設備・選択レシピが復元）
 *
 * 使い方： npx http-server -p 8080 -s  →  node tools/smoke-test-phase2.js
 */
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { const r = require('child_process').execSync('npm root -g').toString().trim(); ({ chromium } = require(r + '/playwright')); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = false;
function check(ok, label, extra) {
  console.log((ok ? '✓ ' : '✗ ') + label + (extra != null ? '：' + extra : ''));
  if (!ok) failed = true;
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  const boot = async () => {
    await page.waitForFunction(() => window.CF && CF.game && CF.game.scene.isActive('Game'), null, { timeout: 15000 });
  };
  // まっさらな状態でリロード。reload時の visibilitychange 自動保存が
  // 直前の設備を書き戻さないよう、保存キー削除＋ワールドを空にしてから。
  const fresh = async () => {
    await page.evaluate(() => {
      // 走っている描画ループが壊れないよう、room自体は残して中身だけ空に
      CF.World.rooms.forEach((r) => {
        r.buildings.length = 0;
        r.grid.forEach((row) => row.fill(null));
      });
      CF.Logistics.reset();
      try { localStorage.removeItem(CF.Save.KEY); } catch (e) {}
    });
    await page.reload(); await boot();
  };
  await page.goto('http://127.0.0.1:8080/index.html');
  await boot();
  await fresh();
  console.log('✓ ゲーム起動（Gameシーン稼働）');

  // 0) 新設備の存在・種類ごと上限2
  const defs = await page.evaluate(() => {
    const need = ['spawner_silk', 'spawner_flower', 'sewing', 'atelier'];
    const exist = need.every((k) => CF.BUILDINGS[k]);
    // 絹糸の泉を2つ置く → 3つ目は不可（種類ごと上限2）
    CF.World.place('spawner_silk', 1, 1, 0);
    CF.World.place('spawner_silk', 4, 1, 0);
    const third = CF.World.canPlace('spawner_silk', 7, 1);
    // 別種（花）は独立して置ける
    const flowerOk = CF.World.canPlace('spawner_flower', 1, 4);
    return { exist, third, flowerOk };
  });
  check(defs.exist, '新設備4種が定義済み');
  check(!defs.third && defs.flowerOk, '泉は種類ごとに上限2（絹糸3つ目×／花は別枠○）');

  // 1) 最後の泉＝全額払い戻し／複数あれば半額（クリーン状態で検証）
  await fresh();
  const refund = await page.evaluate(() => {
    const gs = CF.game.scene.getScene('Game');
    const place = (t, x, y) => { const b = CF.World.place(t, x, y, 0); gs.spend(CF.BUILDINGS[t].cost); gs.addBuildingSprite(b); return b; };
    // 泉1つだけ → 撤去で全額
    const s1 = place('spawner', 2, 2);
    let m = CF.state.money; gs.removeBuilding(s1); const full = CF.state.money - m;
    // 泉2つ → 1つ撤去で半額
    place('spawner', 2, 2); const s2 = place('spawner_silk', 5, 2);
    m = CF.state.money; gs.removeBuilding(s2); const half = CF.state.money - m;
    return { full, half };
  });
  check(refund.full === 50, '最後の泉は全額払い戻し', refund.full);
  check(refund.half === 25, '泉が複数なら半額払い戻し', refund.half);

  // 以降は資金を気にせず物流を検証
  await fresh();
  await page.evaluate(() => { CF.state.money = 99999; CF.events.emit('money'); });

  // 2) ミシンのレシピ切替（絹糸→レース）
  const sewok = await page.evaluate(() => {
    const gs = CF.game.scene.getScene('Game');
    const place = (t, x, y, d) => { const b = CF.World.place(t, x, y, d); gs.addBuildingSprite(b); return b; };
    place('spawner_silk', 1, 5, 0);            // front: (3,5),(3,6)
    place('belt', 3, 5, 0);
    const sew = place('sewing', 4, 4, 0);       // back: (4,4),(4,5)
    sew.recipeIndex = 1;                        // レシピ切替：レース
    place('belt', 6, 5, 0); place('belt', 7, 5, 0); place('belt', 8, 5, 0); // 出力受け
    return true;
  });
  check(sewok, 'ミシン＋絹糸ラインを配置（レシピ=レース）');
  // レースが流れてくるのを待つ（リボンは出ないこと）
  await page.waitForFunction(() => CF.Logistics.items.some((it) => it.type === 'lace'), null, { timeout: 20000 });
  const sewItems = await page.evaluate(() => ({
    lace: CF.Logistics.items.some((it) => it.type === 'lace'),
    ribbon: CF.Logistics.items.some((it) => it.type === 'ribbon')
  }));
  check(sewItems.lace && !sewItems.ribbon, 'ミシンがレース生産（リボンは出ない）');

  // 3) 工房台の2素材合成（ドレス＝レース+リボン）
  const built = await page.evaluate(() => {
    const gs = CF.game.scene.getScene('Game');
    const place = (t, x, y, d) => { const b = CF.World.place(t, x, y, d); gs.addBuildingSprite(b); return b; };
    const at = place('atelier', 10, 10, 0);     // back: (10,10),(10,11) / front: (12,10),(12,11)
    at.recipeIndex = 2;                          // ドレス（レース1+リボン1）
    place('belt', 9, 10, 0);                     // 入力口へ（上段）
    place('belt', 9, 11, 0);                     // 入力口へ（下段）
    place('belt', 12, 10, 0); place('belt', 13, 10, 0); // 出力
    place('delivery', 14, 9, 0);                 // occupies (14,9),(15,9),(14,10),(15,10)
    return { id: at.id };
  });
  check(!!built.id, '工房台＋入出力ラインを配置（レシピ=ドレス）');

  // リボンだけ投入 → まだ加工しない（揃うまで待機）
  await page.evaluate(() => CF.Logistics.spawnAt('ribbon', 9, 10));
  await sleep(1500);
  const half = await page.evaluate(() => {
    const at = CF.World.room().buildings.find((b) => b.type === 'atelier');
    return { processing: !!at.processing, ribbon: at.buffer.ribbon || 0, output: at.output };
  });
  check(half.ribbon >= 1 && !half.processing && !half.output, '片方だけでは加工しない（揃うまで待機）', `buf.ribbon=${half.ribbon}`);

  // レースを投入 → 揃って加工 → ドレス → 納品で +40
  const before = await page.evaluate(() => CF.state.money);
  await page.evaluate(() => CF.Logistics.spawnAt('lace', 9, 11));
  await page.waitForFunction((m) => CF.state.money >= m + 40, before, { timeout: 20000 });
  const after = await page.evaluate(() => CF.state.money);
  check(after - before >= 40, '2素材が揃うとドレス生成→納品で+40リル', after - before);

  // 4) レシピ外素材は受け取らない（ベルト上で詰まる）
  await page.evaluate(() => CF.Logistics.spawnAt('gem_ore', 9, 10));
  await sleep(1500);
  const jam = await page.evaluate(() => {
    const at = CF.World.room().buildings.find((b) => b.type === 'atelier');
    return {
      stuck: CF.Logistics.items.some((it) => it.type === 'gem_ore'),
      buffered: at.buffer.gem_ore || 0
    };
  });
  check(jam.stuck && jam.buffered === 0, 'レシピ外（宝石原石）は受け取らずベルト上で詰まる');

  // 5) セーブ引継（所持リル・設備・選択レシピ）
  const pre = await page.evaluate(() => {
    CF.Save.save();
    return {
      money: CF.state.money,
      count: CF.World.room().buildings.length,
      sewIdx: CF.World.room().buildings.find((b) => b.type === 'sewing').recipeIndex,
      atIdx: CF.World.room().buildings.find((b) => b.type === 'atelier').recipeIndex
    };
  });
  await page.reload(); await boot();
  const post = await page.evaluate(() => ({
    money: CF.state.money,
    count: CF.World.room().buildings.length,
    sewIdx: (CF.World.room().buildings.find((b) => b.type === 'sewing') || {}).recipeIndex,
    atIdx: (CF.World.room().buildings.find((b) => b.type === 'atelier') || {}).recipeIndex
  }));
  check(post.money === pre.money && post.count === pre.count, 'セーブ引継：所持リルと設備数が復元', `${post.money}リル/${post.count}件`);
  check(post.sewIdx === 1 && post.atIdx === 2, 'セーブ引継：選択レシピが復元（ミシン=レース/工房台=ドレス）');

  // スクショ
  await sleep(1500);
  await page.screenshot({ path: '/tmp/p2_portrait.png' });
  await page.setViewportSize({ width: 844, height: 390 });
  await sleep(1200);
  await page.screenshot({ path: '/tmp/p2_landscape.png' });
  console.log('✓ スクショ保存（/tmp/p2_portrait.png, /tmp/p2_landscape.png）');

  check(errors.length === 0, 'コンソールエラーなし', errors.slice(0, 4).join(' | '));

  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('✗ テスト失敗:', e.message); process.exit(1); });
