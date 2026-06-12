/* シンデレラ・ファクトリー Phase 3 スモークテスト
 * 着せ替え・手拾い・増築・セーブ引継を実ブラウザで自動検証する。
 * 使い方： npx http-server -p 8080 -s & ; node tools/smoke-test-phase3.js
 */
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { const r = require('child_process').execSync('npm root -g').toString().trim(); ({ chromium } = require(r + '/playwright')); }

const ok = (c, m) => console.log((c ? '✓ ' : '✗ ') + m) || (!c && (process.exitCode = 1));

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://127.0.0.1:8080/index.html');
  await page.waitForFunction(() => window.CF && CF.game && CF.game.scene.isActive('Game'), null, { timeout: 15000 });
  await page.evaluate(() => localStorage.removeItem(CF.Save.KEY));
  await page.reload();
  await page.waitForFunction(() => window.CF && CF.game && CF.game.scene.isActive('Game'), null, { timeout: 15000 });
  console.log('— 起動 —');

  // 姫スプライト 1.3倍表示
  const pr = await page.evaluate(() => {
    const gs = CF.game.scene.getScene('Game');
    return { scale: +gs.princess.scaleX.toFixed(2), tex: gs.textures.get('princess').getSourceImage().width };
  });
  ok(pr.scale === 1.3 && pr.tex === 59, `姫スプライト59px素材を1.3倍表示（scale=${pr.scale}）`);

  // ----- 回帰：工房台の2素材合成→納品（新エンジンでも動くか） -----
  const chain = await page.evaluate(async () => {
    const gs = CF.game.scene.getScene('Game');
    CF.state.equip = { body: null, head: null, hand: null };
    const at = CF.World.place('atelier', 0, 2, 2, 0);
    at.recipeIndex = 1;                 // ブーケ（リボン+花）
    at.buffer = { ribbon: 1, flower: 1 }; // 入力が揃った状態を再現
    CF.World.place('belt', 0, 4, 2, 0);
    CF.World.place('belt', 0, 5, 2, 0);
    CF.World.place('delivery', 0, 6, 1, 0);
    for (const b of CF.World.rooms[0].buildings) if (!gs.buildingSprites.get(b.id)) gs.addBuildingSprite(b);
    const before = CF.state.money;
    await new Promise(r => setTimeout(r, 7000));
    return { gain: CF.state.money - before };
  });
  ok(chain.gain === 15, `工房台で2素材合成→ブーケ納品（+15）実測：+${chain.gain}`);

  // ----- 着せ替え：収蔵→装備の効果（売上+5% / 速度+10% / 見た目tint） -----
  const equipFx = await page.evaluate(() => {
    // 収蔵品を直接付与して装備
    CF.state.wardrobe = { dress: 1, tiara: 1, bouquet: 1 };
    const gs = CF.game.scene.getScene('Game');
    // ティアラ装備 → 納品売上 +5%（ドレス40 → 42）
    CF.state.equip.head = 'tiara';
    const sellWith = Math.round(CF.ITEMS.dress.price * CF.EQUIP_FX.tiara.sellMul);
    // ブーケ装備 → 速度 +10%
    CF.state.equip.hand = 'bouquet';
    // ドレス装備 → tint（見た目変化）
    CF.state.equip.body = 'dress';
    gs.applyPrincessAppearance();
    return { sellWith, tinted: gs.princess.tintTopLeft !== 0xffffff && gs.princess.isTinted };
  });
  ok(equipFx.sellWith === 42, `ティアラ装備で売上+5%（ドレス40→${equipFx.sellWith}）`);
  ok(equipFx.tinted, 'ドレス装備で姫の見た目が変化（tint適用）');

  // 実際にドレスを納品して+5%が効くか（ライン無しで delivery に直接落として確認）
  const sold = await page.evaluate(async () => {
    // 部屋0に納品箱＋ベルト＋手動アイテム投入で1個売る
    const gs = CF.game.scene.getScene('Game');
    CF.World.place('delivery', 0, 5, 5, 0); gs.refreshRooms();
    for (const b of CF.World.rooms[0].buildings) gs.addBuildingSprite(b);
    CF.World.place('belt', 0, 4, 6, 0); // delivery(5,5..6,6) の back セル(5,6)へ西から
    const before = CF.state.money;
    // ベルト(4,6)→delivery(5,6) に dress を流す
    CF.Logistics.dropOnBelt('dress', 0, 4, 6);
    // 数秒回す
    await new Promise(r => setTimeout(r, 2000));
    return { gain: CF.state.money - before };
  });
  ok(sold.gain === 42, `ドレス納品で+42リル（ティアラ+5%反映）実測：+${sold.gain}`);

  // ----- 手拾い：ベルト上のアイテムを拾って別ベルトへ置き直し（詰み救済） -----
  const carry = await page.evaluate(() => {
    const gs = CF.game.scene.getScene('Game');
    CF.state.equip = { body: null, head: null, hand: null }; gs.applyPrincessAppearance();
    CF.World.place('belt', 0, 10, 10, 0);
    CF.World.place('belt', 0, 12, 10, 0);
    const it = CF.Logistics.spawnAt('gem_ore', 0, 10, 10);
    gs.pickUpItem(it);
    const held = CF.state.hand;
    const beforeItems = CF.Logistics.items.length;
    // 別ベルトへ置き直し
    const belt = CF.World.at(0, 12, 10);
    gs.handleCarryTap(belt, { ri: 0, x: 12, y: 10 });
    return { held, afterHand: CF.state.hand, placed: CF.Logistics.items.length, beforeItems };
  });
  ok(carry.held === 'gem_ore', '手拾い：原料を持てる');
  ok(carry.afterHand === null && carry.placed === 1, '別ベルトへ置き直し（詰み救済）OK');

  // 高級品はクローゼット収蔵可、原料は不可
  const store = await page.evaluate(() => {
    const gs = CF.game.scene.getScene('Game');
    CF.World.place('closet', 0, 15, 10, 0);
    for (const b of CF.World.rooms[0].buildings) if (!gs.buildingSprites.get(b.id)) gs.addBuildingSprite(b);
    const closet = CF.World.at(0, 15, 10);
    CF.state.wardrobe = {};
    // 高級品 → 収蔵される
    CF.state.hand = 'tiara';
    gs.handleCarryTap(closet, { ri: 0, x: 15, y: 10 });
    const luxStored = (CF.state.wardrobe.tiara || 0) === 1 && CF.state.hand === null;
    // 原料 → 拒否（手持ちのまま）
    CF.state.hand = 'gem_ore';
    gs.handleCarryTap(closet, { ri: 0, x: 15, y: 10 });
    const rawRejected = CF.state.hand === 'gem_ore' && !CF.state.wardrobe.gem_ore;
    CF.state.hand = null;
    return { luxStored, rawRejected };
  });
  ok(store.luxStored, 'クローゼット：高級品（ティアラ）を収蔵');
  ok(store.rawRejected, 'クローゼット：原料は収蔵拒否');

  // ----- 増築：800リル減算→2部屋目→新部屋で設置＆生産 -----
  const expand = await page.evaluate(async () => {
    const gs = CF.game.scene.getScene('Game');
    CF.state.money = 1000;
    const before = CF.state.money;
    gs.doExpand();
    const rooms = CF.World.rooms.length;
    const spent = before - CF.state.money;
    // 新部屋（ri=1）に泉→ベルト→納品箱で生産
    gs.refreshRooms();
    CF.World.place('spawner', 1, 2, 4, 0);
    CF.World.place('belt', 1, 4, 4, 0);
    CF.World.place('belt', 1, 5, 4, 0);
    CF.World.place('delivery', 1, 6, 3, 0);
    for (const b of CF.World.rooms[1].buildings) if (!gs.buildingSprites.get(b.id)) gs.addBuildingSprite(b);
    const m0 = CF.state.money;
    await new Promise(r => setTimeout(r, 6000)); // 泉3s + 搬送
    return { rooms, spent, produced: CF.state.money - m0, totalW: CF.World.totalWidthTiles() };
  });
  ok(expand.rooms === 2 && expand.spent === 800, `増築：800リル減算で2部屋に（spent=${expand.spent}）`);
  ok(expand.produced > 0, `新部屋で生産が回る（+${expand.produced}リル）`);

  // 部屋間の扉：扉の高さでは通行可、壁では不可
  const door = await page.evaluate(() => {
    const gs = CF.game.scene.getScene('Game');
    const sx = CF.ROOM_W * CF.TILE;
    const doorY = (CF.DOOR_Y + 1) * CF.TILE;
    const wallY = 1 * CF.TILE;
    return {
      doorPass: !gs.seamBlocked(sx - 5, sx + 5, doorY),
      wallBlock: gs.seamBlocked(sx - 5, sx + 5, wallY)
    };
  });
  ok(door.doorPass && door.wallBlock, '扉は通行可・壁は通行不可');

  // 最後の泉の全額払い戻し（増築後も機能）
  const refund = await page.evaluate(() => {
    const gs = CF.game.scene.getScene('Game');
    // 全部屋の泉を1個だけ残して撤去 → 最後の1個は全額(50)返る
    let spawners = [];
    for (let ri = 0; ri < CF.World.rooms.length; ri++)
      for (const b of CF.World.rooms[ri].buildings)
        if (CF.BUILDINGS[b.type].kind === 'spawner') spawners.push(b);
    // 1個だけ残す
    while (spawners.length > 1) { const b = spawners.pop(); gs.removeBuilding(b); }
    const last = spawners[0];
    const before = CF.state.money;
    gs.removeBuilding(last);
    return { refund: CF.state.money - before };
  });
  ok(refund.refund === 50, `最後の泉は全額払い戻し（+${refund.refund}）`);

  // ----- セーブ引継（工場・リル・装備・収蔵・2部屋） -----
  const saved = await page.evaluate(() => {
    CF.state.money = 555;
    CF.state.wardrobe = { dress: 2, tiara: 1 };
    CF.state.equip = { body: 'dress', head: 'tiara', hand: null };
    CF.Save.save();
    return {
      rooms: CF.World.rooms.length,
      b0: CF.World.rooms[0].buildings.length,
      b1: CF.World.rooms[1].buildings.length
    };
  });
  await page.reload();
  await page.waitForFunction(() => window.CF && CF.game && CF.game.scene.isActive('Game'), null, { timeout: 15000 });
  const restored = await page.evaluate(() => ({
    money: CF.state.money,
    rooms: CF.World.rooms.length,
    b0: CF.World.rooms[0].buildings.length,
    b1: CF.World.rooms[1] ? CF.World.rooms[1].buildings.length : 0,
    wardrobe: CF.state.wardrobe,
    equip: CF.state.equip,
    tinted: CF.game.scene.getScene('Game').princess.isTinted
  }));
  ok(restored.money === 555 && restored.rooms === saved.rooms &&
     restored.b0 === saved.b0 && restored.b1 === saved.b1,
     `セーブ引継：${restored.rooms}部屋 / 設備${restored.b0}+${restored.b1} / ${restored.money}リル`);
  ok((restored.wardrobe.dress === 2) && restored.equip.head === 'tiara' && restored.tinted,
     '収蔵品・装備（ドレスtint含む）も復元');

  ok(errors.length === 0, errors.length ? ('コンソールエラー:' + errors.slice(0, 4)) : 'コンソールエラーなし');

  await page.screenshot({ path: '/tmp/p3_portrait.png' });
  await browser.close();
})().catch((e) => { console.error('✗ テスト失敗:', e.message); process.exit(1); });
