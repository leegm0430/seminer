// 슬라임 게임 자동 테스트
// - 테스트 이름 앞의 [공통-N]/[플레이-N]은 TC/슬라임게임_TC.xlsx의 번호다.
// - 게임 코드는 즉시 실행 함수 안에 있어 내부 값을 읽을 수 없다. 화면에 보이는 값(점수·다음 슬라임 이름·결과 창)으로만 판정한다.
// - 다음 슬라임은 Math.random으로 정해진다. 테스트마다 Math.random을 정해진 순서로 바꿔 결과를 매번 같게 만든다.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const TARGET = process.env.SLIME_TARGET || path.resolve(__dirname, '..', '..', 'slimegame.html');
const URL = pathToFileURL(TARGET).href;

const STAGE_NAMES = ['방울 슬라임', '미니 쁘띠 슬라임', '초록 슬라임', '블루 슬라임', '옐로우 큐브 슬라임'];
// Math.floor(v * 5) 가 원하는 단계가 되도록 고른 값
const STAGE_VALUE = [0.01, 0.21, 0.41, 0.61, 0.81];
const COOLDOWN_MS = 420;

/** 다음에 나올 슬라임 단계를 순서대로 고정한다.
 *  페이지를 불러오는 동안 외부 라이브러리도 Math.random을 쓰므로, 로드가 끝난 뒤 솔로 시작 직전에 바꾼다. */
async function fixRandom(page, stages) {
  const values = stages.map(s => STAGE_VALUE[s]);
  await page.evaluate((vals) => {
    let i = 0;
    Math.random = () => vals[i++ % vals.length];
  }, values);
}

/** 페이지 오류·콘솔 오류를 모은다. */
function collectErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  return errors;
}

async function openSolo(page, stages) {
  await page.goto(URL);
  if (stages) await fixRandom(page, stages);
  await page.click('#btn-solo');
  await expect(page.locator('#screen-solo')).toBeVisible();
  await page.locator('#canvas-solo').hover();
}

const nextName = (page) => page.locator('#solo-next-name');

// ---------------------------------------------------------------- 메뉴·화면 전환

test('[공통-7] 타이틀·서브 카피 노출', async ({ page }) => {
  await page.goto(URL);
  await expect(page.locator('h1')).toHaveText('슬라임 게임');
  await expect(page.locator('h1 + p')).toContainText('킹 슬라임');
});

test('[공통-8] 솔로 모드 진입 시 새 보드 초기화', async ({ page }) => {
  await openSolo(page);
  await expect(page.locator('#screen-menu')).toBeHidden();
  await expect(page.locator('#solo-score')).toHaveText('0');
  await expect(page.locator('#solo-chain .chain-item')).toHaveCount(11);
  await expect(page.locator('#solo-chain .chain-item.reached')).toHaveCount(0);
});

test('[공통-10] ← 메뉴로 링크로 메인 메뉴 복귀', async ({ page }) => {
  await openSolo(page);
  await page.click('#solo-back');
  await expect(page.locator('#screen-menu')).toBeVisible();
  await expect(page.locator('#screen-solo')).toBeHidden();
});

test('[공통-9] 멀티 모드 진입 시 방 만들기 탭 기본 활성', async ({ page }) => {
  await page.goto(URL);
  await page.click('#btn-multi');
  await expect(page.locator('#screen-multi-setup')).toBeVisible();
  await expect(page.locator('#panel-host')).toBeVisible();
  await expect(page.locator('#panel-join')).toBeHidden();
});

test('[플레이-24] [참가하기] 탭 전환 시 입력창 노출', async ({ page }) => {
  await page.goto(URL);
  await page.click('#btn-multi');
  await page.click('#tab-join');
  await expect(page.locator('#panel-join')).toBeVisible();
  await expect(page.locator('#join-input')).toBeVisible();
  await expect(page.locator('#panel-host')).toBeHidden();
});

test('[플레이-26] 빈 코드로 [연결하기] 시 안내 문구', async ({ page }) => {
  await page.goto(URL);
  await page.click('#btn-multi');
  await page.click('#tab-join');
  await page.fill('#join-input', '   ');
  await page.click('#join-btn');
  await expect(page.locator('#multi-status')).toHaveText('방 코드를 입력해주세요.');
});

test('[공통-11] 데스크톱(720px 초과) 모드 카드 가로 배치', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(URL);
  const solo = await page.locator('#btn-solo').boundingBox();
  const multi = await page.locator('#btn-multi').boundingBox();
  expect(Math.abs(solo.y - multi.y)).toBeLessThan(2);   // 같은 줄
  expect(multi.x).toBeGreaterThan(solo.x + solo.width - 1); // 오른쪽에
});

test('[공통-12] 모바일(720px 이하) 모드 카드 세로 배치', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  const solo = await page.locator('#btn-solo').boundingBox();
  const multi = await page.locator('#btn-multi').boundingBox();
  expect(multi.y).toBeGreaterThanOrEqual(solo.y + solo.height - 1); // 아래 줄
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollW).toBeLessThanOrEqual(390);                          // 가로 잘림 없음
});

// ---------------------------------------------------------------- 실행 환경

test('[공통-3] 물리 엔진 로드 후 콘솔 오류 없음', async ({ page }) => {
  const errors = collectErrors(page);
  await openSolo(page, [0, 1, 2]);
  expect(await page.evaluate(() => typeof window.Matter)).toBe('object');
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(COOLDOWN_MS + 80);
  }
  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
});

test('[공통-5] 외부 스크립트 차단 시 흰 화면 없이 메뉴 유지', async ({ page }) => {
  const errors = collectErrors(page);
  await page.route(/cdnjs\.cloudflare\.com/, route => route.abort());
  await page.goto(URL);
  await expect(page.locator('h1')).toHaveText('슬라임 게임'); // 흰 화면 아님
  await page.click('#btn-solo');
  await expect(page.locator('#screen-menu')).toBeVisible();              // 크래시 없이 메뉴에 머묾
  expect(errors.some(e => /Matter/.test(e))).toBeTruthy();              // 원인은 콘솔 오류로만 남음
});

// ---------------------------------------------------------------- 드롭

test('[플레이-4][플레이-6] 스페이스바로 드롭, 다음 슬라임 정보 갱신', async ({ page }) => {
  await openSolo(page, [0, 1, 2, 3, 4]);
  await expect(nextName(page)).toHaveText(STAGE_NAMES[0]);
  await page.keyboard.press('Space');
  await expect(nextName(page)).toHaveText(STAGE_NAMES[1]);
  await expect(page.locator('#solo-next-swatch')).toHaveCSS('background-color', 'rgb(255, 179, 209)'); // #FFB3D1
});

test('[플레이-3] 캔버스 클릭으로 드롭', async ({ page }) => {
  await openSolo(page, [0, 1, 2, 3, 4]);
  await page.locator('#canvas-solo').click({ position: { x: 190, y: 60 } });
  await expect(nextName(page)).toHaveText(STAGE_NAMES[1]);
});

test('[플레이-5] 드롭 쿨다운(0.42초) 내 추가 입력 무시', async ({ page }) => {
  await openSolo(page, [0, 1, 2, 3, 4]);
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');            // 0.42초 안의 두 번째 입력
  await page.waitForTimeout(100);
  await expect(nextName(page)).toHaveText(STAGE_NAMES[1]); // 한 번만 드롭됨
  await page.waitForTimeout(COOLDOWN_MS);
  await page.keyboard.press('Space');            // 쿨다운이 지난 뒤
  await expect(nextName(page)).toHaveText(STAGE_NAMES[2]);
});

// ---------------------------------------------------------------- 병합·점수

test('[플레이-7][플레이-8][플레이-10] 같은 단계 병합, 24점, 진화 체인 강조', async ({ page }) => {
  await openSolo(page, [0]);                     // 계속 1단계(방울)만 나오게
  await page.keyboard.press('Space');
  await page.waitForTimeout(COOLDOWN_MS + 600);  // 첫 슬라임이 바닥에 닿을 때까지
  await page.keyboard.press('Space');            // 같은 자리에 하나 더
  await expect(page.locator('#solo-score')).toHaveText('24', { timeout: 6000 }); // 2단계 점수 = 2*3/2*8
  await expect(page.locator('#solo-chain .chain-item').nth(1)).toHaveClass(/reached/);
});

// ---------------------------------------------------------------- 게임 오버 흐름

/** 가장 큰 낙하 단계(옐로우 큐브)를 계속 떨어뜨려 게임 오버를 만든다. */
async function playUntilGameOver(page) {
  const xs = [80, 190, 300];
  for (let i = 0; i < 120; i++) {
    if (await page.locator('#overlay-result').isVisible()) return;
    await page.mouse.move(0, 0);
    const box = await page.locator('#canvas-solo').boundingBox();
    await page.mouse.click(box.x + xs[i % xs.length] * box.width / 380, box.y + 40);
    await page.waitForTimeout(COOLDOWN_MS + 30);
  }
  throw new Error('120번 드롭해도 게임 오버가 나지 않음');
}

test('[플레이-16][플레이-12][공통-13][플레이-19] 게임 오버 → 최고 기록 → 결과 창 유지 → 다시하기', async ({ page }) => {
  await openSolo(page, [4]);

  await test.step('플레이-16 경고선을 넘겨 게임 오버', async () => {
    await playUntilGameOver(page);
    await expect(page.locator('#overlay-result')).toBeVisible();
    await expect(page.locator('#result-title')).toHaveText('게임 오버');
  });

  // 결과 창 점수 = 게임 오버 순간의 점수. (보드 점수는 탐색-1 버그 때문에 그 뒤에도 바뀔 수 있어 여기서는 쓰지 않는다)
  const score = await page.locator('#result-score').textContent();
  await test.step('플레이-12 최고 기록이 이번 점수로 갱신', async () => {
    expect(Number(score)).toBeGreaterThan(0);
    await expect(page.locator('#solo-best')).toHaveText(score);
  });

  await test.step('공통-13 Esc·바깥 클릭으로 닫히지 않음', async () => {
    await page.keyboard.press('Escape');
    await page.mouse.click(5, 5);
    await expect(page.locator('#overlay-result')).toBeVisible();
  });

  await test.step('플레이-19 다시하기 → 점수 0, 최고 기록 유지', async () => {
    await page.click('#result-retry');
    await expect(page.locator('#overlay-result')).toBeHidden();
    await expect(page.locator('#solo-score')).toHaveText('0');
    await expect(page.locator('#solo-best')).toHaveText(score);
  });
});

// 탐색 중 발견(2026-11-01): 기존 TC에 없는 항목이라 '탐색-1'로 추가.
// 게임 오버 뒤에도 물리 엔진이 멈추지 않아, 진행 중이던 병합 점수가 보드에만 더해진다(직접 재현 3회 중 2회).
// 매 판 생기지는 않으므로 최대 3판을 이어서 확인하고, 한 판이라도 어긋나면 실패로 본다.
test('[탐색-1] 게임 오버 뒤 보드 점수가 결과 창 점수와 같고 더 오르지 않음', async ({ page }) => {
  test.setTimeout(240_000);
  await openSolo(page, [4]);
  for (let game = 1; game <= 3; game++) {
    await playUntilGameOver(page);
    const result = await page.locator('#result-score').textContent();
    await page.waitForTimeout(3000);             // 남은 병합이 끝날 시간
    const board = await page.locator('#solo-score').textContent();
    expect(board, `${game}판째: 결과 창 ${result}점, 3초 뒤 보드 ${board}점`).toBe(result);
    await page.click('#result-retry');
  }
});

test('[플레이-20] 결과 창 [메뉴로]로 메인 메뉴 복귀', async ({ page }) => {
  await openSolo(page, [4]);
  await playUntilGameOver(page);
  await page.click('#result-menu');
  await expect(page.locator('#overlay-result')).toBeHidden();
  await expect(page.locator('#screen-menu')).toBeVisible();
});

// =====================================================================================
// AI 보충 TC (SG-xxx) — TC 작성 규칙 044 커버리지(C1~C5)로 2026-11-02 추가. TC 하나 = 테스트 하나.
// - 테스트 이름은 tc/slimegame_tc.json의 [번호] 제목. 같이 덮는 사용자 TC 번호(자동 목록에 있는 것)도 이름에 붙인다.
// - 게임 코드는 그대로 두고, 페이지가 열리기 전에 두 가지를 끼워 넣는다.
//   ① 물리 엔진(Matter)이 만들어질 때 엔진을 붙잡아 두기 → 원하는 단계 슬라임을 원하는 자리에 바로 놓는다.
//   ② 멀티 테스트에서는 P2P 라이브러리 대신 가짜 Peer → 서버 응답·상대 메시지를 테스트가 직접 보낸다.
// =====================================================================================

const TCS = require('../tc/slimegame_tc.json');
const AUTO_IDS = new Set(TCS.automated.map((x) => x.id));
const SG = Object.fromEntries(TCS.automated.filter((x) => x.id.startsWith('SG-')).map((x) => [x.id, x]));
const R = [15, 21, 27, 34, 42, 51, 61, 73, 87, 102, 124];          // 단계별 반지름 (게임 STAGES)
const FLOOR_TOP = 544;                                               // 바닥 윗면 y
const LIBS = {};                                                     // CDN 스크립트를 한 번만 받아 재사용

/** TC 번호로 테스트를 만든다 */
function t(num, fn, opts) {
  const id = 'SG-' + num, tc = SG[id];
  if (!tc) throw new Error('TC JSON에 없는 번호: ' + id);
  const also = (tc.also || '').split(',').map((s) => s.trim()).filter((x) => x && AUTO_IDS.has(x)).map((x) => `[${x}]`).join('');
  test(`[${id}]${also} ${tc.title}`, opts || {}, fn);
}

test.beforeAll(async () => {
  for (const [k, u] of [['matter', 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js'],
                        ['peer', 'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.2/peerjs.min.js']]) {
    if (!LIBS[k]) LIBS[k] = await (await fetch(u)).text();
  }
});

/** ① 엔진 붙잡기 + 테스트용 도우미(window.__sg) */
function HOOK() {
  window.__engines = [];
  let M;
  Object.defineProperty(window, 'Matter', {
    configurable: true, get() { return M; },
    set(v) {
      M = v;
      const orig = v.Engine.create;
      v.Engine.create = function (...a) { const e = orig.apply(this, a); window.__engines.push(e); return e; };
    },
  });
  const RR = [15, 21, 27, 34, 42, 51, 61, 73, 87, 102, 124];
  window.__sg = {
    eng() { return window.__engines[window.__engines.length - 1]; },
    bodies() { return M.Composite.allBodies(this.eng().world).filter((b) => !b.isStatic); },
    count() { return this.bodies().length; },
    add(stage, x, y, fresh) {
      const b = M.Bodies.circle(x, y, RR[stage], { restitution: 0.22, friction: 0.25, frictionAir: 0.0018, density: 0.0016 });
      b.slimeStage = stage; b.squashSx = 1; b.squashSy = 1;
      b.spawnedAt = fresh ? performance.now() : performance.now() - 5000;
      M.Composite.add(this.eng().world, b);
      return b.id;
    },
    remove(id) { const b = this.bodies().find((x) => x.id === id); if (b) M.Composite.remove(this.eng().world, b); },
    freeze() { this.eng().timing.timeScale = 0; },
    watch() {   // 이후 보드에 추가되는 슬라임의 위치·속도를 기록
      this.added = [];
      M.Events.on(this.eng().world, 'afterAdd', (e) => {
        for (const b of [].concat(e.object)) if (b.slimeStage !== undefined) this.added.push({ x: b.position.x, y: b.position.y, stage: b.slimeStage, vy: b.velocity.y });
      });
    },
  };
}

/** ② 가짜 P2P (PeerJS 대신) */
function FAKE_PEER() {
  window.__peers = [];
  class FakeConn {
    constructor(code) { this.code = code; this.open = false; this.h = {}; this.sent = []; this.closed = false; }
    on(e, f) { (this.h[e] = this.h[e] || []).push(f); }
    emit(e, ...a) { (this.h[e] || []).forEach((f) => f(...a)); }
    send(o) { this.sent.push(JSON.parse(JSON.stringify(o))); }
    close() { if (this.closed) return; this.closed = true; this.open = false; this.emit('close'); }
  }
  class FakePeer {
    constructor() { this.h = {}; this.destroyed = false; this.conns = []; window.__peers.push(this); }
    on(e, f) { (this.h[e] = this.h[e] || []).push(f); }
    emit(e, ...a) { (this.h[e] || []).forEach((f) => f(...a)); }
    connect(code) { const c = new FakeConn(code); this.conns.push(c); window.__conn = c; return c; }
    destroy() { this.destroyed = true; }
  }
  window.__FakeConn = FakeConn;
  window.Peer = FakePeer;
}

/** 페이지 열기. opts: random(Math.random 값 목록), fake(가짜 Peer), blockPeer, clock, viewport */
async function boot(page, opts = {}) {
  const errors = collectErrors(page);
  if (opts.viewport) await page.setViewportSize(opts.viewport);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.route(/matter\.min\.js/, (r) => r.fulfill({ body: LIBS.matter, contentType: 'application/javascript' }));
  await page.route(/peerjs\.min\.js/, (r) => (opts.blockPeer ? r.abort()
    : r.fulfill({ body: opts.fake ? '/* 가짜 Peer 사용 */' : LIBS.peer, contentType: 'application/javascript' })));
  await page.addInitScript(HOOK);
  if (opts.fake) await page.addInitScript(FAKE_PEER);
  if (opts.clock) await page.clock.install();
  await page.goto(URL);
  // 게임은 드롭 쿨다운을 페이지가 열린 뒤 시간(performance.now)으로 잰다 → 사람처럼 0.7초 지난 뒤 시작
  if (!opts.clock) await page.waitForFunction(() => performance.now() > 700);
  if (opts.random) await page.evaluate((v) => { let i = 0; Math.random = () => v[i++ % v.length]; }, opts.random);
  return errors;
}
/** 페이지 오류(스크립트 예외)만 — 일부러 막은 폰트·CDN 요청의 네트워크 메시지는 빼고 본다 */
const pageErrors = (errors) => errors.filter((e) => e.startsWith('pageerror'));
async function solo(page, opts = {}) {
  const errors = await boot(page, { random: [0.01], ...opts });
  await page.click('#btn-solo');
  await expect(page.locator('#screen-solo')).toBeVisible();
  return errors;
}
const ev = (page, fn, ...args) => page.evaluate(fn, ...args);
const count = (page) => ev(page, () => window.__sg.count());
const score = (page) => page.locator('#solo-score');
const overlayEl = (page) => page.locator('#overlay-result');
/** 같은 단계 슬라임 2개를 바닥 근처에 겹쳐 놓는다 → 곧 병합 */
const pair = (page, stage, x = 190) => ev(page, ([s, x0, f, r]) => {
  window.__sg.add(s, x0, f - r, false); window.__sg.add(s, x0, f - r * 1.6, false);
}, [stage, x, FLOOR_TOP, R[stage]]);
/** 방울 슬라임을 경고선(y 84)에 ratio만큼 걸쳐 놓는다 (보드 멈춤) */
const danger = (page, ratio, fresh = false, x = 300) => ev(page, ([r, f, x0]) => {
  window.__sg.freeze(); return window.__sg.add(0, x0, 84 - r * 30 + 15, f);
}, [ratio, fresh, x]);
const vignette = (page, id = 'solo') => page.locator('#vignette-' + id);
/** 점수 target을 만든 뒤 게임 오버 */
async function gameOverWith(page, target) {
  if (target === 24) { await pair(page, 0); await expect(score(page)).toHaveText('24'); }
  if (target === 48) { await pair(page, 1); await expect(score(page)).toHaveText('48'); }
  await danger(page, 0.7);
  await expect(overlayEl(page)).toBeVisible({ timeout: 5000 });
}
const STAGE5 = STAGE_NAMES;

// ---------------------------------------------------------------- G01 메인 메뉴
t(101, async ({ page }) => { await boot(page); await expect(page).toHaveTitle('슬라임 게임 — 킹 슬라임을 만들어라'); });
t(102, async ({ page }) => { await boot(page); await expect(page.locator('.title-row .eyebrow')).toHaveText('SLIME MERGE PUZZLE'); });
t(103, async ({ page }) => { await boot(page); await expect(page.locator('.title-row p')).toHaveText('같은 슬라임을 부딪혀 합치고, 최종 진화 킹 슬라임을 만들어보세요.'); });
t(104, async ({ page }) => { await boot(page); await expect(page.locator('#btn-solo h3')).toHaveText('솔로 모드'); });
t(105, async ({ page }) => { await boot(page); await expect(page.locator('#btn-solo .icon')).toHaveText('🫧'); });
t(106, async ({ page }) => { await boot(page); await expect(page.locator('#btn-solo p')).toHaveText('혼자 플레이하며 최고 점수를 경신하는 모드입니다. 경고선을 넘으면 게임 오버.'); });
t(107, async ({ page }) => { await boot(page); await expect(page.locator('#btn-solo .tag')).toHaveText('최고 기록 도전'); });
t(108, async ({ page }) => { await boot(page); await expect(page.locator('#btn-multi h3')).toHaveText('멀티 모드 (P2P 1:1)'); });
t(109, async ({ page }) => { await boot(page); await expect(page.locator('#btn-multi .icon')).toHaveText('⚔️'); });
t(110, async ({ page }) => { await boot(page); await expect(page.locator('#btn-multi p')).toHaveText('친구와 코드로 직접 연결해 대결합니다. 킹 슬라임을 먼저 만드는 사람이 승리!'); });
t(111, async ({ page }) => { await boot(page); await expect(page.locator('#btn-multi .tag')).toHaveText('1:1 실시간 대결'); });
t(112, async ({ page }) => {
  await boot(page);
  for (const s of ['#screen-solo', '#screen-multi-setup', '#screen-multi-game', '#overlay-result']) await expect(page.locator(s)).toBeHidden();
});
t(113, async ({ page }) => {
  await boot(page);
  await page.hover('#btn-solo');
  await expect.poll(() => page.$eval('#btn-solo', (e) => getComputedStyle(e).transform)).toBe('matrix(1, 0, 0, 1, 0, -4)');
});

// ---------------------------------------------------------------- G02 솔로 화면
const label = (page, id) => page.locator(`#${id}`).locator('xpath=preceding-sibling::div[1]');
t(201, async ({ page }) => { await solo(page); await expect(label(page, 'solo-score')).toHaveText('점수'); });
t(202, async ({ page }) => { await solo(page); await expect(label(page, 'solo-best')).toHaveText('최고 기록 (이번 세션)'); });
t(203, async ({ page }) => { await solo(page); await expect(page.locator('#solo-best')).toHaveText('0'); });
t(204, async ({ page }) => { await solo(page); await expect(label(page, 'solo-next-name')).toHaveText('다음 슬라임'); });
t(205, async ({ page }) => {
  await boot(page); await page.click('#btn-solo');
  expect(STAGE5).toContain(await page.textContent('#solo-next-name'));
});
t(206, async ({ page }) => { await solo(page); await expect(page.locator('#solo-restart')).toHaveText('↺ 다시하기'); });
t(207, async ({ page }) => { await solo(page); await expect(page.locator('#solo-back')).toHaveText('← 메뉴로'); });
t(208, async ({ page }) => { await solo(page); await expect(page.locator('#screen-solo .side-panel h3')).toHaveText('진화 체인'); });
t(209, async ({ page }) => {
  await solo(page);
  expect(await page.$eval('#canvas-solo', (c) => [c.width, c.height])).toEqual([380, 546]);
});
t(210, async ({ page }) => { await solo(page); await expect(vignette(page)).not.toHaveClass(/active/); });
t(211, async ({ page }) => {
  await solo(page); await pair(page, 0); await expect(score(page)).toHaveText('24');
  await page.click('#solo-restart');
  await expect(score(page)).toHaveText('0');
});
t(212, async ({ page }) => {
  await solo(page, { random: [0.01, 0.21, 0.41] });   // 서로 다른 단계 → 합쳐지지 않게
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(COOLDOWN_MS + 60); }
  expect(await count(page)).toBe(3);
  await page.click('#solo-restart');
  expect(await count(page)).toBe(0);
});
t(213, async ({ page }) => {
  await solo(page); await gameOverWith(page, 24);
  await page.click('#result-retry');
  await page.click('#solo-restart');
  await expect(page.locator('#solo-best')).toHaveText('24');
});
t(214, async ({ page }) => {
  const errors = await solo(page);
  await page.click('#solo-back');
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  await expect(page.locator('#screen-menu')).toBeVisible();
  expect(pageErrors(errors)).toEqual([]);
});
t(215, async ({ page }) => {
  await solo(page, { random: [0.01, 0.21, 0.41] });   // 서로 다른 단계 → 합쳐지지 않게
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(COOLDOWN_MS + 60); }
  await page.click('#solo-back'); await page.click('#btn-solo');
  expect(await count(page)).toBe(0);
});

// ---------------------------------------------------------------- G03 드롭
[0.0, 0.2, 0.4, 0.6, 0.8].forEach((v, i) => t(301 + i, async ({ page }) => {
  await solo(page, { random: [v] });
  await expect(page.locator('#solo-next-name')).toHaveText(STAGE5[i]);
}));
t(306, async ({ page }) => {
  await solo(page, { random: [0.999] });
  await expect(page.locator('#solo-next-name')).toHaveText('옐로우 큐브 슬라임');
});
[[0, 'rgb(255, 209, 220)'], [2, 'rgb(126, 217, 87)'], [3, 'rgb(79, 168, 222)'], [4, 'rgb(255, 217, 61)']].forEach(([s, rgb], i) => t(307 + i, async ({ page }) => {
  await solo(page, { random: [STAGE_VALUE[s]] });
  await expect(page.locator('#solo-next-swatch')).toHaveCSS('background-color', rgb);
}));
/** 마우스를 보드 가로 x에 두고 스페이스바 → 새로 생긴 슬라임 */
async function dropAt(page, x) {
  await ev(page, () => window.__sg.watch());
  const box = await page.locator('#canvas-solo').boundingBox();
  await page.mouse.move(box.x + x * box.width / 380, box.y + 100);
  await page.keyboard.press('Space');
  await expect.poll(() => ev(page, () => window.__sg.added.length)).toBe(1);
  return ev(page, () => window.__sg.added[0]);
}
t(311, async ({ page }) => { await solo(page); expect((await dropAt(page, 190)).x).toBeCloseTo(190, 0); });
t(312, async ({ page }) => { await solo(page); expect((await dropAt(page, 0)).x).toBeCloseTo(37, 0); });
t(313, async ({ page }) => { await solo(page); expect((await dropAt(page, 379)).x).toBeCloseTo(343, 0); });
t(314, async ({ page }) => { await solo(page, { random: [0.81] }); expect((await dropAt(page, 0)).x).toBeCloseTo(64, 0); });
t(315, async ({ page }) => { await solo(page); expect((await dropAt(page, 190)).y).toBeCloseTo(39, 0); });
t(316, async ({ page }) => {
  await solo(page);
  await page.keyboard.press('Space'); await page.waitForTimeout(300); await page.keyboard.press('Space');
  expect(await count(page)).toBe(1);
});
t(317, async ({ page }) => {
  await solo(page);
  await page.keyboard.press('Space'); await page.waitForTimeout(550); await page.keyboard.press('Space');
  expect(await count(page)).toBe(2);
});
t(318, async ({ page }) => {
  await solo(page);
  await page.locator('#canvas-solo').click({ position: { x: 190, y: 60 } });
  await page.keyboard.press('Space');
  expect(await count(page)).toBe(1);
});
t(319, async ({ page }) => {
  await solo(page); await gameOverWith(page, 0);
  const n = await count(page);
  await page.keyboard.press('Space'); await page.waitForTimeout(COOLDOWN_MS + 100);
  expect(await count(page)).toBe(n);
});
t(320, async ({ page }) => {
  await solo(page); await gameOverWith(page, 0);
  const n = await count(page);
  await ev(page, () => { const c = document.getElementById('canvas-solo'); const r = c.getBoundingClientRect();
    c.dispatchEvent(new MouseEvent('mousedown', { clientX: r.left + 190, clientY: r.top + 60, bubbles: true })); });
  await page.waitForTimeout(COOLDOWN_MS + 100);
  expect(await count(page)).toBe(n);
});
t(321, async ({ browser }) => {
  const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await solo(page);
  const box = await page.locator('#canvas-solo').boundingBox();
  await page.touchscreen.tap(box.x + 190, box.y + 60);
  await expect.poll(() => count(page)).toBe(1);
  await ctx.close();
});
t(322, async ({ browser }) => {
  const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await solo(page);
  await ev(page, () => window.__sg.watch());
  await ev(page, () => {
    const c = document.getElementById('canvas-solo'); const r = c.getBoundingClientRect();
    const touch = new Touch({ identifier: 1, target: c, clientX: r.left + 100 * r.width / 380, clientY: r.top + 60 });
    c.dispatchEvent(new TouchEvent('touchmove', { touches: [touch], cancelable: true, bubbles: true }));
  });
  await page.keyboard.press('Space');
  await expect.poll(() => ev(page, () => window.__sg.added.length)).toBe(1);
  expect((await ev(page, () => window.__sg.added[0])).x).toBeCloseTo(100, 0);
  await ctx.close();
});
t(323, async ({ page }) => {
  await solo(page, { viewport: { width: 1280, height: 500 } });
  await ev(page, () => window.scrollTo(0, 0));
  expect(await ev(page, () => document.documentElement.scrollHeight > innerHeight)).toBe(true);
  await page.keyboard.press('Space'); await page.waitForTimeout(300);
  expect(await ev(page, () => scrollY)).toBe(0);
});

// ---------------------------------------------------------------- G04 병합·점수
const SCORES = R.map((_, i) => Math.round((i + 1) * (i + 2) / 2 * 8));
for (let k = 1; k <= 9; k++) t(400 + k, async ({ page }) => {
  await solo(page); await pair(page, k);
  await expect(score(page)).toHaveText(String(SCORES[k + 1]), { timeout: 6000 });
});
t(410, async ({ page }) => {
  await solo(page); await pair(page, 10);
  await expect(score(page)).toHaveText('528', { timeout: 6000 });
  expect(await count(page)).toBe(0);
});
t(411, async ({ page }) => { await solo(page); await pair(page, 10); await expect(score(page)).toHaveText('528', { timeout: 6000 }); });
t(412, async ({ page }) => {
  await solo(page);
  await ev(page, () => { window.__sg.add(0, 190, 529, false); window.__sg.add(1, 190, 500, false); });
  await page.waitForTimeout(1500);
  await expect(score(page)).toHaveText('0');
});
t(413, async ({ page }) => {
  await solo(page); await ev(page, () => window.__sg.watch());
  await ev(page, () => { window.__sg.add(0, 170, 529, false); window.__sg.add(0, 190, 529, false); });
  await expect.poll(() => ev(page, () => window.__sg.added.filter((b) => b.stage === 1).length)).toBe(1);
  expect((await ev(page, () => window.__sg.added.find((b) => b.stage === 1))).x).toBeCloseTo(180, -1);
});
t(414, async ({ page }) => {
  await solo(page); await ev(page, () => window.__sg.watch()); await pair(page, 0);
  await expect.poll(() => ev(page, () => window.__sg.added.filter((b) => b.stage === 1).length)).toBe(1);
  expect((await ev(page, () => window.__sg.added.find((b) => b.stage === 1))).vy).toBeCloseTo(-1.5, 5);
});
t(415, async ({ page }) => {
  await solo(page); await pair(page, 0, 100); await pair(page, 0, 280);
  await expect(score(page)).toHaveText('48');
});
t(416, async ({ page }) => {
  await solo(page);
  await ev(page, () => { window.__sg.add(0, 190, 529, false); window.__sg.add(0, 190, 515, false); window.__sg.add(0, 190, 501, false); });
  await page.waitForTimeout(1500);
  await expect(score(page)).toHaveText('24');
});
t(417, async ({ page }) => {
  await solo(page); await pair(page, 9);
  await expect(score(page)).toHaveText('528', { timeout: 6000 });
  await page.waitForTimeout(2000);
  await expect(overlayEl(page)).toBeHidden();
});
t(418, async ({ page }) => {
  await solo(page); await pair(page, 0, 100); await expect(score(page)).toHaveText('24');
  await pair(page, 1, 280);
  await expect(score(page)).toHaveText('72');
});

// ---------------------------------------------------------------- G05 진화 체인
const ALL_STAGES = ['방울 슬라임', '미니 쁘띠 슬라임', '초록 슬라임', '블루 슬라임', '옐로우 큐브 슬라임', '마법사 슬라임',
  '메탈 슬라임', '엔젤 슬라임', '마그마 슬라임', '퀸 슬라임', '킹 슬라임'];
const chain = (page) => page.locator('#solo-chain .chain-item');
ALL_STAGES.forEach((name, i) => t(501 + i, async ({ page }) => {
  await solo(page);
  await expect(chain(page).nth(i)).toHaveText(`${i + 1}단계 · ${name}`);
}));
async function reach3(page) { await pair(page, 1); await expect(score(page)).toHaveText('48'); }
t(512, async ({ page }) => { await solo(page); await reach3(page); await expect(chain(page).nth(2)).toHaveClass(/reached/); });
t(513, async ({ page }) => { await solo(page); await reach3(page); await expect(chain(page).nth(3)).not.toHaveClass(/reached/); });
t(514, async ({ page }) => {
  await solo(page); await reach3(page);
  await pair(page, 0, 300); await expect(score(page)).toHaveText('72');
  await expect(page.locator('#solo-chain .chain-item.reached')).toHaveCount(3);
});
t(515, async ({ page }) => {
  await solo(page); await pair(page, 9); await expect(score(page)).toHaveText('528', { timeout: 6000 });
  await expect(chain(page).nth(10)).toHaveClass(/reached/);
});
t(516, async ({ page }) => {
  await solo(page); await reach3(page);
  await page.click('#solo-restart');
  await expect(page.locator('#solo-chain .chain-item.reached')).toHaveCount(0);
});

// ---------------------------------------------------------------- G06 경고선·게임 오버
t(601, async ({ page }) => { await solo(page); await danger(page, 0.59); await page.waitForTimeout(1800); await expect(vignette(page)).not.toHaveClass(/active/); });
t(602, async ({ page }) => { await solo(page); await danger(page, 0.6); await page.waitForTimeout(500); await expect(vignette(page)).toHaveClass(/active/); });
t(603, async ({ page }) => { await solo(page); await danger(page, 0.61); await page.waitForTimeout(500); await expect(vignette(page)).toHaveClass(/active/); });
t(604, async ({ page }) => { await solo(page); await danger(page, 0.7); await page.waitForTimeout(1200); await expect(overlayEl(page)).toBeHidden(); });
t(605, async ({ page }) => {
  await solo(page); await danger(page, 0.7);
  await expect(overlayEl(page)).toBeVisible({ timeout: 3000 });
  await expect(page.locator('#result-title')).toHaveText('게임 오버');
});
t(606, async ({ page }) => {
  await solo(page); const id = await danger(page, 0.7);
  await expect(vignette(page)).toHaveClass(/active/);
  await ev(page, (i) => window.__sg.remove(i), id);
  await expect(vignette(page)).not.toHaveClass(/active/);
});
t(607, async ({ page }) => {
  await solo(page); const id = await danger(page, 0.7);
  await page.waitForTimeout(1000);
  await ev(page, (i) => window.__sg.remove(i), id);
  await page.waitForTimeout(150);
  await danger(page, 0.7);
  await page.waitForTimeout(1000);
  await expect(overlayEl(page)).toBeHidden();
});
t(608, async ({ page }) => { await solo(page); await danger(page, 0.7, true); await page.waitForTimeout(300); await expect(vignette(page)).not.toHaveClass(/active/); });
t(609, async ({ page }) => { await solo(page); await danger(page, 0.7, true); await page.waitForTimeout(1000); await expect(vignette(page)).toHaveClass(/active/); });
/** 보드 y=84 줄에 빨간 점선 픽셀이 있는지 */
const redLine = (page) => page.$eval('#canvas-solo', (c) => {
  const d = c.getContext('2d').getImageData(22, 83, 200, 3).data;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 120 && d[i + 2] < 130) return true;
  return false;
});
t(610, async ({ page }) => {
  await solo(page); await danger(page, 0.7);
  await expect(vignette(page)).toHaveClass(/active/);
  expect(await redLine(page)).toBe(true);
});
t(611, async ({ page }) => { await solo(page); await page.waitForTimeout(300); expect(await redLine(page)).toBe(false); });

// ---------------------------------------------------------------- G07 결과 창 (솔로)
t(701, async ({ page }) => { await solo(page); await gameOverWith(page, 24); await expect(page.locator('#result-emoji')).toHaveText('🫧'); });
t(702, async ({ page }) => { await solo(page); await gameOverWith(page, 24); await expect(page.locator('#result-sub')).toHaveText('최종 점수 · 최고 기록 24'); });
t(703, async ({ page }) => { await solo(page); await gameOverWith(page, 24); await expect(page.locator('#result-score')).toHaveText('24'); });
t(704, async ({ page }) => { await solo(page); await gameOverWith(page, 24); await expect(page.locator('#result-retry')).toHaveText('다시하기'); });
t(705, async ({ page }) => { await solo(page); await gameOverWith(page, 24); await expect(page.locator('#result-menu')).toHaveText('메뉴로'); });

// ---------------------------------------------------------------- G08 최고 기록
const best = (page) => page.locator('#solo-best');
t(801, async ({ page }) => { await solo(page); await gameOverWith(page, 24); await expect(best(page)).toHaveText('24'); });
t(802, async ({ page }) => {
  await solo(page); await gameOverWith(page, 24);
  await page.click('#result-retry'); await gameOverWith(page, 0);
  await expect(page.locator('#result-score')).toHaveText('0');
  await expect(best(page)).toHaveText('24');
});
t(803, async ({ page }) => {
  await solo(page); await gameOverWith(page, 24);
  await page.click('#result-retry'); await gameOverWith(page, 48);
  await expect(best(page)).toHaveText('48');
});
t(804, async ({ page }) => {
  await solo(page); await gameOverWith(page, 24);
  await page.click('#result-retry'); await gameOverWith(page, 24);
  await expect(best(page)).toHaveText('24');
});
t(805, async ({ page }) => {
  await solo(page); await gameOverWith(page, 24);
  await page.reload(); await page.click('#btn-solo');
  await expect(best(page)).toHaveText('0');
});
t(806, async ({ page }) => {
  await solo(page); await gameOverWith(page, 24);
  await page.click('#result-menu'); await page.click('#btn-solo');
  await expect(best(page)).toHaveText('24');
});

// ---------------------------------------------------------------- 멀티 공통 (가짜 연결)
const status = (page) => page.locator('#multi-status');
const lastPeer = (page, fn, arg) => page.evaluate(([f, a]) => (0, eval)(f)(window.__peers[window.__peers.length - 1], a), [fn.toString(), arg]);
async function host(page, opts = {}) {
  await boot(page, { fake: true, ...opts });
  await page.click('#btn-multi');
  await expect(page.locator('#screen-multi-setup')).toBeVisible();
}
const hostOpen = (page, code = 'TEST-ROOM-1') => lastPeer(page, (p, c) => p.emit('open', c), code);
/** 방 만들기 → 코드 → 상대 접속 → 대결 화면 */
async function versus(page, opts = {}) {
  await host(page, opts); await hostOpen(page);
  await ev(page, () => { const c = new window.__FakeConn('guest'); c.open = true; window.__conn = c;
    window.__peers[window.__peers.length - 1].emit('connection', c); });
  await expect(page.locator('#screen-multi-game')).toBeVisible();
}
const conn = (page, fn, arg) => page.evaluate(([f, a]) => (0, eval)(f)(window.__conn, a), [fn.toString(), arg]);
const sentOf = (page, type) => conn(page, (c, ty) => c.sent.filter((m) => m.type === ty), type);
const oppData = (page, data) => conn(page, (c, d) => c.emit('data', d), data);
async function join(page, code = 'ABC-1', opts = {}) {
  await host(page, opts);
  await page.click('#tab-join');
  await page.fill('#join-input', code);
  await page.click('#join-btn');
}
const mScore = (page) => page.locator('#multi-score');

// ---------------------------------------------------------------- G09 방 만들기
t(901, async ({ page }) => { await host(page); await expect(page.locator('#tab-host')).toHaveText('방 만들기'); });
t(902, async ({ page }) => { await host(page); await expect(page.locator('#tab-join')).toHaveText('참가하기'); });
t(903, async ({ page }) => { await host(page); await expect(page.locator('#panel-host p')).toHaveText('아래 코드를 상대에게 전달하세요. 상대가 이 코드로 접속하면 자동으로 대결이 시작됩니다.'); });
t(904, async ({ page }) => { await host(page); await expect(page.locator('#host-code')).toHaveText('코드 생성 중...'); });
t(905, async ({ page }) => { await host(page); await expect(status(page)).toHaveText('상대방을 기다리는 중...'); });
t(906, async ({ page }) => { await host(page); await hostOpen(page); await expect(page.locator('#host-code')).toHaveText('TEST-ROOM-1'); });
t(907, async ({ page }) => { await host(page); await hostOpen(page); await expect(status(page)).toHaveText('코드 생성 완료 — 상대방의 접속을 기다리는 중...'); });
t(908, async ({ page }) => { await host(page); await hostOpen(page); await page.click('#copy-code'); await expect(status(page)).toHaveText('코드가 복사되었습니다.'); });
t(909, async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await host(page); await hostOpen(page); await page.click('#copy-code');
  expect(await ev(page, () => navigator.clipboard.readText())).toBe('TEST-ROOM-1');
});
t(910, async ({ page }) => { await host(page); await lastPeer(page, (p) => p.emit('error', { type: 'server-error' })); await expect(status(page)).toHaveText('연결 오류: server-error'); });
t(911, async ({ page }) => {
  await host(page); await hostOpen(page);
  await page.click('#tab-host');
  await expect(page.locator('#host-code')).toHaveText('코드 생성 중...');
});
t(912, async ({ page }) => {
  await host(page); await hostOpen(page);
  await page.click('#tab-join');
  expect(await ev(page, () => window.__peers[0].destroyed)).toBe(true);
});
t(913, async ({ page }) => { await host(page); await page.click('#multi-setup-back'); await expect(page.locator('#screen-menu')).toBeVisible(); });
t(914, async ({ page }) => { await host(page); await hostOpen(page); await page.click('#multi-setup-back'); expect(await ev(page, () => window.__peers[0].destroyed)).toBe(true); });
t(915, async ({ page }) => { await versus(page); });

// ---------------------------------------------------------------- G10 참가하기
async function joinTab(page) { await host(page); await page.click('#tab-join'); }
t(1001, async ({ page }) => { await joinTab(page); await expect(page.locator('#panel-join p')).toHaveText('상대에게 받은 방 코드를 입력하세요.'); });
t(1002, async ({ page }) => { await joinTab(page); await expect(page.locator('#join-input')).toHaveAttribute('placeholder', '방 코드 입력'); });
t(1003, async ({ page }) => { await joinTab(page); await expect(page.locator('#join-btn')).toHaveText('연결하기'); });
t(1004, async ({ page }) => { await join(page); await expect(status(page)).toHaveText('1/3 연결 서버에 접속 중...'); });
t(1005, async ({ page }) => { await join(page); await lastPeer(page, (p) => p.emit('open', 'me')); await expect(status(page)).toHaveText('2/3 상대방에게 연결 요청 중... (네트워크 경로 탐색)'); });
t(1006, async ({ page }) => {
  await join(page); await lastPeer(page, (p) => p.emit('open', 'me'));
  await conn(page, (c) => { c.open = true; c.emit('open'); });
  await expect(page.locator('#screen-multi-game')).toBeVisible();
});
t(1007, async ({ page }) => {
  await join(page, '  ABC-1  '); await lastPeer(page, (p) => p.emit('open', 'me'));
  expect(await lastPeer(page, (p) => p.conns[0].code)).toBe('ABC-1');
});
t(1008, async ({ page }) => {
  await join(page); await lastPeer(page, (p) => p.emit('error', { type: 'peer-unavailable' }));
  await expect(status(page)).toHaveText('해당 코드의 방을 찾을 수 없습니다. 코드를 다시 확인해주세요.');
});
t(1009, async ({ page }) => { await join(page); await lastPeer(page, (p) => p.emit('error', { type: 'network' })); await expect(status(page)).toHaveText('연결 오류: network'); });
t(1010, async ({ page }) => {
  await join(page); await lastPeer(page, (p) => p.emit('error', { type: 'peer-unavailable' }));
  await expect(status(page).getByRole('button', { name: '다시 연결 시도' })).toBeVisible({ timeout: 2000 });
});
t(1011, async ({ page }) => {
  await join(page); await lastPeer(page, (p) => p.emit('error', { type: 'peer-unavailable' }));
  await page.click('#join-btn');
  await expect(status(page)).toHaveText('1/3 연결 서버에 접속 중...');
});
t(1012, async ({ page }) => {
  await joinTab(page);
  const before = await ev(page, () => window.__peers.length);
  await page.click('#join-btn');
  expect(await ev(page, () => window.__peers.length)).toBe(before);
});

// ---------------------------------------------------------------- G11 시간 초과 (시계를 빠르게 돌림)
const TIMEOUT_MSG = '연결 시간 초과 — 상대방 네트워크에서 P2P가 차단되었을 수 있습니다.';
t(1101, async ({ page }) => { await join(page, 'ABC-1', { clock: true }); await page.clock.runFor(15900); await expect(status(page)).not.toContainText('시간 초과'); });
t(1102, async ({ page }) => { await join(page, 'ABC-1', { clock: true }); await page.clock.runFor(16100); await expect(status(page)).toContainText(TIMEOUT_MSG); });
t(1103, async ({ page }) => {
  await join(page, 'ABC-1', { clock: true }); await page.clock.runFor(16100);
  await expect(status(page).getByRole('button', { name: '다시 연결 시도' })).toBeVisible();
});
t(1104, async ({ page }) => {
  await join(page, 'ABC-1', { clock: true }); await page.clock.runFor(16100);
  await status(page).getByRole('button', { name: '다시 연결 시도' }).click();
  await expect(status(page)).toHaveText('1/3 연결 서버에 접속 중...');
});
t(1105, async ({ page }) => {
  await join(page, 'ABC-1', { clock: true }); await page.clock.runFor(16100);
  await status(page).getByRole('button', { name: '다시 연결 시도' }).click();
  await lastPeer(page, (p) => p.emit('open', 'me'));
  expect(await lastPeer(page, (p) => p.conns[0].code)).toBe('ABC-1');
});
t(1106, async ({ page }) => {
  await join(page, 'ABC-1', { clock: true }); await page.clock.runFor(5000);
  await lastPeer(page, (p) => p.emit('open', 'me'));
  await conn(page, (c) => { c.open = true; c.emit('open'); });
  await page.clock.runFor(20000);
  await expect(page.locator('#screen-multi-game')).toBeVisible();
  await expect(status(page)).not.toContainText('시간 초과');
});
t(1107, async ({ page }) => {
  await join(page, 'ABC-1', { clock: true }); await page.clock.runFor(16100);
  expect(await lastPeer(page, (p) => p.destroyed)).toBe(true);
});

// ---------------------------------------------------------------- G12 대결 화면
t(1201, async ({ page }) => { await versus(page); await expect(page.locator('.board-header.mine .header-label')).toHaveText('🫧 나'); });
t(1202, async ({ page }) => { await versus(page); await expect(page.locator('.board-header.opp .header-label')).toHaveText('⚔️ 상대방'); });
t(1203, async ({ page }) => { await versus(page); await expect(page.locator('.versus-divider')).toHaveText('VS'); });
t(1204, async ({ page }) => { await versus(page); await expect(page.locator('#opp-waiting')).toHaveText('상대방 화면을 기다리는 중...'); });
t(1205, async ({ page }) => { await versus(page); await expect(mScore(page)).toHaveText('0'); });
t(1206, async ({ page }) => { await versus(page); await expect(page.locator('#opp-score-text')).toHaveText('0'); });
t(1207, async ({ page }) => {
  await versus(page);
  const me = await page.locator('#canvas-multi').boundingBox(), op = await page.locator('#canvas-opponent').boundingBox();
  expect(op.x).toBeGreaterThan(me.x + me.width - 1);
});
t(1208, async ({ page }) => {
  await versus(page, { viewport: { width: 390, height: 844 } });
  const me = await page.locator('#canvas-multi').boundingBox(), op = await page.locator('#canvas-opponent').boundingBox();
  expect(op.y).toBeGreaterThan(me.y + me.height - 1);
});
t(1209, async ({ page }) => { await versus(page); expect(STAGE5).toContain(await page.textContent('#multi-next-name')); });
t(1210, async ({ page }) => { await versus(page); await pair(page, 0); await expect(mScore(page)).toHaveText('24'); });
t(1211, async ({ page }) => {
  await versus(page);
  const a = (await sentOf(page, 'state')).length;
  await page.waitForTimeout(500);
  expect((await sentOf(page, 'state')).length - a).toBeGreaterThanOrEqual(4);
});
t(1212, async ({ page }) => {
  await versus(page); await pair(page, 0); await expect(mScore(page)).toHaveText('24');
  await page.waitForTimeout(200);
  expect((await sentOf(page, 'state')).at(-1).score).toBe(24);
});
t(1213, async ({ page }) => {
  await versus(page); await danger(page, 0.7);
  await expect(vignette(page, 'multi')).toHaveClass(/active/);
  await page.waitForTimeout(200);
  expect((await sentOf(page, 'state')).at(-1).dangerRatio).toBe(1);
});
const oppState = (o = {}) => ({ type: 'state', bodies: [], score: 0, dangerRatio: 0, ...o });
t(1214, async ({ page }) => { await versus(page); await oppData(page, oppState()); await expect(page.locator('#opp-waiting')).toBeHidden(); });
t(1215, async ({ page }) => { await versus(page); await oppData(page, oppState({ score: 120 })); await expect(page.locator('#opp-score-text')).toHaveText('120'); });
t(1216, async ({ page }) => { await versus(page); await oppData(page, oppState({ dangerRatio: 1 })); await expect(vignette(page, 'opponent')).toHaveClass(/active/); });
t(1217, async ({ page }) => {
  await versus(page); await oppData(page, oppState({ dangerRatio: 1 }));
  await expect(vignette(page, 'opponent')).toHaveClass(/active/);
  await oppData(page, oppState({ dangerRatio: 0 }));
  await expect(vignette(page, 'opponent')).not.toHaveClass(/active/);
});
t(1218, async ({ page }) => {
  await versus(page);
  await oppData(page, oppState({ bodies: [{ x: 190, y: 300, stage: 4 }] }));
  await page.waitForTimeout(150);
  const px = await page.$eval('#canvas-opponent', (c) => Array.from(c.getContext('2d').getImageData(190, 300, 1, 1).data));
  expect(px.slice(0, 3)).not.toEqual([22, 15, 39]);   // 빈 보드 배경색(#160F27)이 아님
});

// ---------------------------------------------------------------- G13 승패
const rTitle = (page) => page.locator('#result-title');
async function myKing(page) { await pair(page, 9); await expect(overlayEl(page)).toBeVisible({ timeout: 6000 }); }
t(1301, async ({ page }) => { await versus(page); await myKing(page); await expect(page.locator('#result-emoji')).toHaveText('👑'); });
t(1302, async ({ page }) => { await versus(page); await myKing(page); await expect(rTitle(page)).toHaveText('승리! 킹 슬라임 완성'); });
t(1303, async ({ page }) => { await versus(page); await myKing(page); expect((await sentOf(page, 'win')).length).toBe(1); });
t(1304, async ({ page }) => { await versus(page); await oppData(page, { type: 'win', score: 999 }); await expect(rTitle(page)).toHaveText('패배'); });
t(1305, async ({ page }) => { await versus(page); await oppData(page, { type: 'win', score: 999 }); await expect(page.locator('#result-emoji')).toHaveText('💧'); });
t(1306, async ({ page }) => {
  await versus(page); await oppData(page, { type: 'win', score: 999 }); await expect(overlayEl(page)).toBeVisible();
  const n = await count(page);
  await page.keyboard.press('Space'); await page.waitForTimeout(COOLDOWN_MS + 100);
  expect(await count(page)).toBe(n);
});
async function myLineLose(page) { await danger(page, 0.7); await expect(overlayEl(page)).toBeVisible({ timeout: 5000 }); }
t(1307, async ({ page }) => { await versus(page); await myLineLose(page); await expect(rTitle(page)).toHaveText('패배'); });
t(1308, async ({ page }) => { await versus(page); await myLineLose(page); expect((await sentOf(page, 'lose')).length).toBe(1); });
t(1309, async ({ page }) => { await versus(page); await oppData(page, { type: 'lose' }); await expect(rTitle(page)).toHaveText('승리! 킹 슬라임 완성'); });
t(1310, async ({ page }) => {
  await versus(page); await oppData(page, { type: 'lose' }); await expect(rTitle(page)).toHaveText('승리! 킹 슬라임 완성');
  await oppData(page, { type: 'win', score: 999 });
  await page.waitForTimeout(200);
  await expect(rTitle(page)).toHaveText('승리! 킹 슬라임 완성');
});
t(1311, async ({ page }) => {
  await versus(page); await oppData(page, { type: 'lose' }); await expect(overlayEl(page)).toBeVisible();
  const a = (await sentOf(page, 'state')).length;
  await page.waitForTimeout(500);
  expect((await sentOf(page, 'state')).length).toBe(a);
});

// ---------------------------------------------------------------- G14 재대결·끊김
t(1401, async ({ page }) => {
  await versus(page); await pair(page, 0); await expect(mScore(page)).toHaveText('24');
  await oppData(page, { type: 'lose' }); await page.click('#result-retry');
  await expect(mScore(page)).toHaveText('0');
});
t(1402, async ({ page }) => {
  await versus(page); await oppData(page, { type: 'lose' }); await expect(overlayEl(page)).toBeVisible();
  const a = (await sentOf(page, 'state')).length;
  await page.click('#result-retry'); await page.waitForTimeout(300);
  expect((await sentOf(page, 'state')).length).toBeGreaterThan(a);
});
t(1403, async ({ page }) => {
  await versus(page); await oppData(page, oppState()); await expect(page.locator('#opp-waiting')).toBeHidden();
  await oppData(page, { type: 'lose' }); await page.click('#result-retry');
  await expect(page.locator('#opp-waiting')).toHaveText('상대방 화면을 기다리는 중...');
  await expect(page.locator('#opp-waiting')).toBeVisible();
});
t(1404, async ({ page }) => { await versus(page); await oppData(page, { type: 'lose' }); await page.click('#result-menu'); await expect(page.locator('#screen-menu')).toBeVisible(); });
t(1405, async ({ page }) => {
  await versus(page); await oppData(page, { type: 'lose' }); await page.click('#result-menu');
  expect(await conn(page, (c) => c.closed)).toBe(true);
});
t(1406, async ({ page }) => {
  await versus(page); await oppData(page, oppState());
  await conn(page, (c) => c.close());
  await expect(page.locator('#opp-waiting')).toHaveText('상대방과 연결이 끊어졌습니다.');
  await expect(page.locator('#opp-waiting')).toBeVisible();
});
t(1407, async ({ page }) => {
  await versus(page); await conn(page, (c) => c.close());
  const n = await count(page);
  await page.keyboard.press('Space');
  await expect.poll(() => count(page)).toBe(n + 1);
});

// ---------------------------------------------------------------- G15 실행 환경·반응형
t(1501, async ({ page }) => { await boot(page); await expect(page.locator('h1')).toHaveText('슬라임 게임'); });
t(1502, async ({ page }) => {
  const errors = await solo(page);
  await page.keyboard.press('Space'); await page.waitForTimeout(800);
  expect(pageErrors(errors)).toEqual([]);
});
t(1503, async ({ page }) => {
  await solo(page, { blockPeer: true });
  await page.keyboard.press('Space');
  await expect.poll(() => count(page)).toBe(1);
});
t(1504, async ({ page }) => {
  await boot(page, { blockPeer: true });
  await page.click('#btn-multi');
  await expect(page.locator('#screen-multi-setup')).toBeVisible();
});
async function boardRight(page, w) {
  await solo(page, { viewport: { width: w, height: 844 } });
  const b = await page.locator('#canvas-solo').boundingBox();
  return b.x + b.width;
}
t(1505, async ({ page }) => { expect(await boardRight(page, 390)).toBeLessThanOrEqual(390); });
t(1506, async ({ page }) => { expect(await boardRight(page, 360)).toBeLessThanOrEqual(360); });
t(1507, async ({ page }) => {
  await solo(page, { viewport: { width: 720, height: 900 } });
  const b = await page.locator('#canvas-solo').boundingBox(), p = await page.locator('#screen-solo .side-panel').boundingBox();
  expect(p.y).toBeGreaterThan(b.y + b.height - 1);
});
t(1508, async ({ page }) => {
  await solo(page, { viewport: { width: 721, height: 900 } });
  const b = await page.locator('#canvas-solo').boundingBox(), p = await page.locator('#screen-solo .side-panel').boundingBox();
  expect(p.x).toBeGreaterThan(b.x + b.width - 1);
});
