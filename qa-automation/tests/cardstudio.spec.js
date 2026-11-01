// 카드팩 스튜디오 자동 테스트 — TC 하나에 테스트 하나 (TC 작성 규칙 044 W1·C1~C4)
// - 테스트 이름은 tc/cardstudio_tc.json 의 [번호] 제목을 그대로 쓴다. 번호 앞자리 = 근거(0 공통, 1~12 기본 단계, 13~16 미션, 17~19 규칙 엔진)
// - 화면 테스트: 진행 상태를 localStorage('cardStudio2')에 넣고 새로고침해서 원하는 단계에서 시작한다.
// - 규칙 테스트: 게임이 전역에 둔 엔진(CardRules·BattleEngine·Gacha)을 page.evaluate로 직접 불러 판정한다.
// - 게임 코드는 건드리지 않는다. 무작위가 필요한 화면 테스트는 Date.now를 고정해 매번 같은 결과가 나오게 한다.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const DIR = process.env.CARDSTUDIO_DIR || path.resolve(__dirname, '..', '..', '스토리게임만들기', 'card-studio');
const URL = pathToFileURL(path.join(DIR, 'studio.html')).href;
const FIXTURE = path.join(DIR, '얼음_진행.json');
const IMG = (n) => path.join(DIR, 'image', n);
const TCS = require('../tc/cardstudio_tc.json');
const TITLE = Object.fromEntries(TCS.automated.map((t) => [t.id, t.title]));

require(path.join(DIR, 'cardRules.js'));
require(path.join(DIR, 'battle.js'));
require(path.join(DIR, 'gacha.js'));
const B = globalThis.BattleEngine, G = globalThis.Gacha;
const clone = (o) => JSON.parse(JSON.stringify(o));

/** TC 번호로 테스트를 만든다 (제목은 TC JSON에서) */
function t(num, fn, opts) {
  const id = 'CS-' + String(num).padStart(3, '0');
  if (!TITLE[id]) throw new Error('TC JSON에 없는 번호: ' + id);
  test(`[${id}] ${TITLE[id]}`, opts || {}, fn);
}

// ---------------------------------------------------------------- 진행 상태 만들기

const CORE = ['s1-theme', 's1-cards', 's1-balance', 's1-desc', 's1-art', 's1-commit', 's1-battle', 's1-sim', 'f-more', 'f-league', 'f-gacha', 's1-save'];
const base = (a) => clone(B.BASE_PACKS[a]).map((c) => { delete c.attr; return c; });
const fire8 = () => base('불꽃');
const packOf = (name, cards) => ({ name, cards, images: {}, style: '' });
/** 카드 8장짜리 강한 팩(코스트 1·공격 40)과 약한 팩(코스트 9·공격 1) — 대전을 몇 턴 만에 끝내기 위해 */
const strong = () => Array.from({ length: 8 }, (_, i) => ({ id: 's' + i, name: '강타 ' + i, type: '균형형', rarity: '일반', cost: 1, attack: 40, defense: 40, desc: '세게 친다' }));
const weak = () => Array.from({ length: 8 }, (_, i) => ({ id: 'w' + i, name: '허수 ' + i, type: '균형형', rarity: '전설', cost: 9, attack: 1, defense: 1, desc: '서 있다' }));

/** step 앞의 기본 단계는 모두 통과. packs: 속성 배열(기본 카드팩) 또는 {속성: 팩} */
function makeState({ step, packs = [], theme, packName, cards, extra = {} }) {
  const passed = {};
  for (const k of CORE) { if (k === step) break; passed[k] = true; }
  let P = {};
  if (Array.isArray(packs)) packs.forEach((a) => { P[a] = packOf(a + '팩', base(a)); });
  else P = packs;
  const keys = Object.keys(P), last = keys[keys.length - 1];
  return Object.assign({
    step, passed, count: {}, override: {},
    theme: theme !== undefined ? theme : (last || ''), style: '',
    packName: packName !== undefined ? packName : (last ? P[last].name : ''),
    cards: cards || (last ? clone(P[last].cards) : []), images: {},
    decks: [], extraDecks: [], tone: '', tests: [], packs: P, editing: last || null
  }, extra);
}
const fixtureState = () => JSON.parse(fs.readFileSync(FIXTURE, 'utf-8')).state;

function dialogs(page, action = 'accept') {
  const msgs = [];
  page.on('dialog', (d) => { msgs.push(d.message()); d[action](); });
  return msgs;
}
async function open(page, state, seed) {
  if (seed) await page.addInitScript((s) => { Date.now = () => s; }, seed);
  await page.goto(URL);
  if (state) {
    await page.evaluate((r) => localStorage.setItem('cardStudio2', r), JSON.stringify(state));
    await page.reload();
  }
}
const kicker = (page) => page.locator('.step-head .kicker');
const h2 = (page) => page.locator('.step-head h2');
const nextBtn = (page) => page.locator('.next-bar button.btn.primary');
const barState = (page) => page.locator('.next-bar .state');
const railBtn = (page, title) => page.locator('#rail button', { hasText: title });
const themeBtn = (page, attr) => page.locator('.theme', { has: page.locator('strong', { hasText: new RegExp(' ' + attr + '$') }) });
const ok = (page, text) => page.locator('.checks li.ok', { hasText: text });
const bad = (page, text) => page.locator('.checks li.bad', { hasText: text });
const btn = (page, text) => page.locator('button', { hasText: text });
async function paste(page, text, label = '붙여넣고 확인', nth = 0) {
  await page.locator('textarea.paste').nth(nth).fill(text);
  await btn(page, label).first().click();
}
const answer = (cards, before = '좋아요! 카드팩을 만들었어요.') =>
  before + '\n```json\n' + JSON.stringify({ cards }, null, 2) + '\n```\n설명: 공격형 3장, 방어형 2장, 균형형 2장이에요.';
function tmpFile(info, name, content) {
  fs.mkdirSync(info.outputDir, { recursive: true });
  const p = path.join(info.outputDir, name);
  fs.writeFileSync(p, content);
  return p;
}

// ================================================================ S00 공통

t(1, async ({ page }) => { await open(page); await expect(page.locator('.topbar h1')).toContainText('카드팩 스튜디오'); });
t(2, async ({ page }) => { await open(page); await expect(kicker(page)).toHaveText('기본 1단계 / 12'); });
t(3, async ({ page }) => { await open(page); await expect(h2(page)).toHaveText('카드팩 속성 정하기'); });
t(4, async ({ page }) => {
  await open(page);
  await expect(page.locator('#rail h2').first()).toHaveText('기본 단계');
  await expect(page.locator('#rail ol').nth(0).locator('button')).toHaveCount(12);
});
t(5, async ({ page }) => { await open(page); await expect(page.locator('#rail ol').nth(0).locator('button').nth(0)).toBeEnabled(); });
t(6, async ({ page }) => {
  await open(page);
  const core = page.locator('#rail ol').nth(0).locator('button');
  for (let i = 1; i < 12; i++) await expect(core.nth(i)).toBeDisabled();
});
t(7, async ({ page }) => { await open(page); await expect(page.locator('#rail h2').nth(1)).toHaveText('추가 미션 (기본 단계를 마치면 열려요)'); });
t(8, async ({ page }) => {
  await open(page);
  const m = page.locator('#rail ol').nth(1).locator('button');
  await expect(m).toHaveCount(4);
  for (let i = 0; i < 4; i++) await expect(m.nth(i)).toBeDisabled();
});
t(9, async ({ page }) => { await open(page, fixtureState()); await expect(page.locator('#rail h2').nth(1)).toHaveText('추가 미션'); });
t(10, async ({ page }) => {
  await open(page, fixtureState());
  const m = page.locator('#rail ol').nth(1).locator('button');
  for (let i = 0; i < 4; i++) await expect(m.nth(i)).toBeEnabled();
});
t(11, async ({ page }) => { await open(page); await expect(page.locator('#btnLoad')).toHaveText('진행 파일 불러오기'); });
t(12, async ({ page }) => {
  const msgs = dialogs(page); await open(page);
  await page.locator('#fileLoad').setInputFiles(FIXTURE);
  await expect.poll(() => msgs).toContain('불러왔어요: 얼음');
});
t(13, async ({ page }) => {
  dialogs(page); await open(page);
  await page.locator('#fileLoad').setInputFiles(FIXTURE);
  await expect(page.locator('#packLabel')).toHaveText('· 얼음');
});
t(14, async ({ page }) => {
  dialogs(page); await open(page);
  await page.locator('#fileLoad').setInputFiles(FIXTURE);
  await expect(page.locator('#rail ol').nth(0).locator('button.done')).toHaveCount(11);
});
t(15, async ({ page }, info) => {
  const msgs = dialogs(page); await open(page);
  await page.locator('#fileLoad').setInputFiles(tmpFile(info, 'other.json', JSON.stringify({ app: 'other-app', state: {} })));
  await expect.poll(() => msgs).toContain('카드팩 스튜디오에서 저장한 진행 파일이 아니에요.');
});
t(16, async ({ page }, info) => {
  const msgs = dialogs(page); await open(page);
  await page.locator('#fileLoad').setInputFiles(tmpFile(info, 'other.json', JSON.stringify({ app: 'other-app', state: { packName: '가짜' } })));
  await expect.poll(() => msgs.length).toBe(1);
  await expect(page.locator('#packLabel')).toHaveText('');
});
t(17, async ({ page }, info) => {
  const msgs = dialogs(page); await open(page);
  await page.locator('#fileLoad').setInputFiles(tmpFile(info, 'broken.json', '이건 JSON이 아니에요'));
  await expect.poll(() => msgs).toContain('카드팩 스튜디오에서 저장한 진행 파일이 아니에요.');
});
t(18, async ({ page }) => {
  await open(page); await themeBtn(page, '숲').click(); await page.reload();
  await expect(themeBtn(page, '숲')).toHaveClass(/\bon\b/);
});
t(19, async ({ page }) => {
  await open(page); await page.locator('input.text').fill('고대 숲'); await page.reload();
  await expect(page.locator('input.text')).toHaveValue('고대 숲');
});
t(20, async ({ page }) => {
  await open(page, makeState({ step: 's1-cards', theme: '불꽃', packName: '화산' })); await page.reload();
  await expect(kicker(page)).toHaveText('기본 2단계 / 12');
});
t(21, async ({ page }) => {
  await open(page, fixtureState()); await railBtn(page, '카드팩 속성 정하기').click();
  await expect(kicker(page)).toHaveText('기본 1단계 / 12');
});
t(22, async ({ page }) => { await open(page); await expect(page.locator('#rail button.current')).toContainText('카드팩 속성 정하기'); });
t(23, async ({ page }) => {
  await open(page); await themeBtn(page, '불꽃').click(); await page.locator('input.text').fill('화산');
  await nextBtn(page).click();
  await expect(kicker(page)).toHaveText('기본 2단계 / 12');
});

// ================================================================ S01 1단계

const pick = async (page, name = '화산') => { await themeBtn(page, '불꽃').click(); await page.locator('input.text').fill(name); };
t(101, async ({ page }) => {
  await open(page);
  await expect(page.locator('.themes .theme strong')).toHaveText(['🔥 불꽃', '❄️ 얼음', '🌿 숲', '⚙️ 기계']);
});
t(102, async ({ page }) => { await open(page); await expect(themeBtn(page, '불꽃').locator('span')).toHaveText('화산과 불의 정령 · 불꽃은(는) 숲에 강함'); });
t(103, async ({ page }) => { await open(page); await expect(page.locator('.rulebox p').first()).toContainText('속성은 4개예요. 상성: 🔥 불꽃 → 🌿 숲 → ⚙️ 기계 → ❄️ 얼음 → 🔥 불꽃.'); });
t(104, async ({ page }) => { await open(page); await expect(page.locator('.rulebox')).toContainText('지금 만드는 건 1번째 카드팩이에요.'); });
t(105, async ({ page }) => { await open(page); await themeBtn(page, '불꽃').click(); await expect(themeBtn(page, '불꽃')).toHaveClass(/\bon\b/); });
t(106, async ({ page }) => { await open(page); await expect(bad(page, '속성을 하나 고르세요.')).toBeVisible(); });
t(107, async ({ page }) => { await open(page); await themeBtn(page, '불꽃').click(); await expect(ok(page, '속성: 불꽃')).toBeVisible(); });
t(108, async ({ page }) => { await open(page); await expect(bad(page, '카드팩 이름을 2글자 이상 쓰세요.')).toBeVisible(); });
t(109, async ({ page }) => { await open(page); await page.locator('input.text').fill('화'); await expect(bad(page, '카드팩 이름을 2글자 이상 쓰세요.')).toBeVisible(); });
t(110, async ({ page }) => { await open(page); await page.locator('input.text').fill('화산'); await expect(ok(page, '카드팩 이름: 화산')).toBeVisible(); });
t(111, async ({ page }) => {
  await open(page); const n = page.locator('input.text'); await n.click();
  await n.pressSequentially('가나다라마바사아자차카타파하가나다라마바');
  await expect(n).toHaveValue('가나다라마바사아자차카타파하가나다라마바');
});
t(112, async ({ page }) => {
  await open(page); const n = page.locator('input.text'); await n.click();
  await n.pressSequentially('가나다라마바사아자차카타파하가나다라마바사');
  await expect(n).toHaveValue('가나다라마바사아자차카타파하가나다라마바');
});
t(113, async ({ page }) => { await open(page); await page.locator('input.text').fill('화산'); await expect(page.locator('#packLabel')).toHaveText('· 화산'); });
t(114, async ({ page }) => { await open(page); await pick(page); await expect(nextBtn(page)).toBeEnabled(); });
t(115, async ({ page }) => { await open(page); await pick(page); await expect(barState(page)).toHaveText('확인 완료. 다음으로 넘어가세요.'); });
t(116, async ({ page }) => { await open(page); await page.locator('input.text').fill('화산'); await expect(nextBtn(page)).toBeDisabled(); });
t(117, async ({ page }) => { await open(page); await page.locator('input.text').fill('화산'); await expect(barState(page)).toHaveText('속성과 이름을 정하면 넘어갈 수 있어요.'); });
t(118, async ({ page }) => { await open(page); await page.locator('input.text').fill(' 화 '); await expect(bad(page, '카드팩 이름을 2글자 이상 쓰세요.')).toBeVisible(); });
const newPackState = () => makeState({ step: 's1-theme', packs: { '불꽃': packOf('화산', fire8()) }, extra: { editing: null, theme: '', packName: '', cards: [] } });
t(119, async ({ page }) => { await open(page, newPackState()); await expect(themeBtn(page, '불꽃')).toBeDisabled(); });
t(120, async ({ page }) => { await open(page, newPackState()); await expect(themeBtn(page, '불꽃').locator('span')).toHaveText('완성: "화산"'); });
t(121, async ({ page }) => { await open(page, newPackState()); await expect(page.locator('.rulebox')).toContainText('두 번째 팩은 첫 번째 팩과 상성 관계가 있는 속성을 고르면 대전이 더 재미있어요.'); });

// ================================================================ S02 2단계

const cardsStep = (extra) => makeState({ step: 's1-cards', theme: '불꽃', packName: '화산', extra });
const pastedOK = (page) => expect(ok(page, '카드 8장이 형식에 맞게 들어왔어요.')).toBeVisible();
const prompt = (page, i = 0) => page.locator('.promptbox pre').nth(i);
t(201, async ({ page }) => { await open(page, cardsStep()); await expect(prompt(page)).toContainText('"불꽃" 테마의 카드팩 "화산"에 들어갈 카드 8장'); });
t(202, async ({ page }) => { await open(page, cardsStep()); await expect(prompt(page)).toContainText('{"cards":['); });
t(203, async ({ page }) => { await open(page, cardsStep()); await expect(page.locator('.promptbox button')).toHaveText('프롬프트 복사'); });
t(204, async ({ page }) => { await open(page, cardsStep()); await expect(page.locator('textarea.paste')).toHaveAttribute('placeholder', '여기에 클로드 답변을 통째로 붙여넣으세요. 설명이 섞여 있어도 괜찮아요.'); });
t(205, async ({ page }) => { await open(page, cardsStep()); await expect(bad(page, '아직 카드가 없어요. ✕가 나오면 안내대로 클로드에게 다시 요청하세요.')).toBeVisible(); });
t(206, async ({ page }) => { await open(page, cardsStep()); await paste(page, answer(fire8())); await expect(page.locator('.cards .card')).toHaveCount(8); });
t(207, async ({ page }) => { await open(page, cardsStep()); await paste(page, answer(fire8())); await pastedOK(page); });
t(208, async ({ page }) => { await open(page, cardsStep()); await paste(page, answer(fire8())); await expect(nextBtn(page)).toBeEnabled(); });
t(209, async ({ page }) => { await open(page, cardsStep()); await paste(page, answer(fire8().slice(0, 7))); await expect(bad(page, '카드가 8장이어야 하는데 7장이 왔어요.')).toBeVisible(); });
t(210, async ({ page }) => {
  await open(page, cardsStep());
  const c = fire8(); c.push(Object.assign(clone(c[0]), { id: 'f9', name: '아홉째' }));
  await paste(page, answer(c));
  await expect(bad(page, '카드가 8장이어야 하는데 9장이 왔어요.')).toBeVisible();
});
t(211, async ({ page }) => { await open(page, cardsStep()); await paste(page, '여기 카드예요\n{"cards":[{"id":"c1"'); await expect(page.locator('.checks li.bad').first()).toContainText('데이터가 중간에 잘렸어요.'); });
t(212, async ({ page }) => { await open(page, cardsStep()); await paste(page, ''); await expect(page.locator('.checks li.bad').first()).toContainText('붙여넣은 내용이 비어 있어요.'); });
t(213, async ({ page }) => { await open(page, cardsStep()); await paste(page, '미안해요, 카드를 만들지 못했어요'); await expect(page.locator('.checks li.bad').first()).toContainText('답변 안에서 데이터를 찾지 못했어요.'); });
t(214, async ({ page }) => { await open(page, cardsStep()); await paste(page, '{"cards":[{"id":"c1" "name":"x"}]}'); await expect(page.locator('.checks li.bad').first()).toContainText('데이터 모양이 깨져 있어요.'); });
t(215, async ({ page }) => { await open(page, cardsStep()); await paste(page, '{"deck":[1]}'); await expect(page.locator('.checks li.bad').first()).toContainText('카드 목록을 찾지 못했어요.'); });
const withCard0 = (o) => { const c = fire8(); Object.assign(c[0], o); return c; };
t(216, async ({ page }) => { await open(page, cardsStep()); await paste(page, answer(withCard0({ name: '' }))); await expect(bad(page, '1번 카드: 이름이 없어요.')).toBeVisible(); });
t(217, async ({ page }) => { await open(page, cardsStep()); await paste(page, answer(withCard0({ type: '마법형' }))); await expect(bad(page, '1번 카드(불씨 정령): 유형이 "마법형"인데, 공격형·방어형·균형형 중 하나여야 해요.')).toBeVisible(); });
t(218, async ({ page }) => { await open(page, cardsStep()); await paste(page, answer(withCard0({ rarity: '신화' }))); await expect(bad(page, '1번 카드(불씨 정령): 등급이 "신화"인데, 일반·희귀·전설 중 하나여야 해요.')).toBeVisible(); });
t(219, async ({ page }) => { await open(page, cardsStep()); await paste(page, answer(withCard0({ ability: '비행' }))); await expect(bad(page, '1번 카드(불씨 정령): 능력이 "비행"인데, 선공·관통·보호막 중 하나이거나 비워야 해요.')).toBeVisible(); });
t(220, async ({ page }) => { await open(page, cardsStep()); await paste(page, answer(fire8().slice(0, 7))); await expect(bad(page, '클로드에게 "위 문제를 고쳐서 같은 형식으로 다시 출력해줘"라고 보내고, 새 답변을 다시 붙여넣으세요.')).toBeVisible(); });
t(221, async ({ page }) => { await open(page, cardsStep()); await paste(page, answer(fire8().slice(0, 7))); await expect(nextBtn(page)).toBeDisabled(); });
t(222, async ({ page }) => { await open(page, cardsStep()); await paste(page, answer(withCard0({ type: 'attack' }))); await expect(page.locator('.cards .card').first().locator('.meta')).toHaveText('공격형 · 일반'); });
t(223, async ({ page }) => { await open(page, cardsStep()); await paste(page, answer(withCard0({ rarity: 'rare' }))); await expect(page.locator('.cards .card').first().locator('.meta')).toHaveText('공격형 · 희귀'); });
t(224, async ({ page }) => { await open(page, cardsStep()); await paste(page, answer(withCard0({ cost: '1' }))); await pastedOK(page); });
t(225, async ({ page }) => { await open(page, cardsStep()); await paste(page, JSON.stringify({ cards: fire8() }).replace(/\]\}$/, ',]}')); await pastedOK(page); });
t(226, async ({ page }) => { await open(page, cardsStep()); await paste(page, JSON.stringify({ cards: fire8() }).replace(/"/g, '“')); await pastedOK(page); });
t(227, async ({ page }) => {
  const passed = {}; CORE.slice(0, 6).forEach((k) => { passed[k] = true; });
  await open(page, cardsStep({ passed }));
  await paste(page, answer(fire8()));
  await expect(railBtn(page, '카드 설명문 검수')).toBeDisabled();
});
t(228, async ({ page }) => {
  await open(page, cardsStep({ cards: fire8(), images: { f1: 'data:image/png;base64,iVBORw0KGgo=' } }));
  await paste(page, answer(fire8()));
  await pastedOK(page);
  expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('cardStudio2')).images).length)).toBe(0);
});

// ================================================================ S03 3단계

function balanceState() {
  const cards = fire8();
  cards[1].attack = 10;          // f2 화염 검사: 합 13 (코스트 2 기준 8~12) → 위반
  cards[2].defense = 8;          // f3 재의 수도승: 균형형 5/8 → 위반
  return makeState({ step: 's1-balance', theme: '불꽃', packName: '화산', cards });
}
const recheck = '붙여넣고 다시 검사';
t(301, async ({ page }) => { await open(page, balanceState()); await expect(page.locator('.rulebox p').first()).toHaveText('① 공격+방어 합은 코스트 × 5와 비슷해야 해요 (±2까지 허용).'); });
t(302, async ({ page }) => { await open(page, balanceState()); await expect(bad(page, '규칙을 어긴 카드가 2장 있어요.')).toBeVisible(); });
t(303, async ({ page }) => { await open(page, balanceState()); await expect(page.locator('.cards .card.bad')).toHaveCount(2); });
t(304, async ({ page }) => { await open(page, balanceState()); await expect(page.locator('.cards .card.good')).toHaveCount(6); });
t(305, async ({ page }) => { await open(page, balanceState()); await expect(page.locator('.card[data-id=f2] .issue').first()).toHaveText('공격+방어 합이 13인데, 코스트 2이면 2 × 5 = 10 근처(8~12)여야 해요.'); });
t(306, async ({ page }) => { await open(page, balanceState()); await expect(prompt(page)).toContainText('- f2 화염 검사:'); });
t(307, async ({ page }) => { await open(page, balanceState()); await expect(prompt(page)).toContainText('- f3 재의 수도승:'); });
t(308, async ({ page }) => {
  await open(page, balanceState());
  const txt = await prompt(page).textContent();
  const section = txt.slice(txt.indexOf('문제가 있는 카드:'), txt.indexOf('지금 카드팩 전체:'));
  expect(section).not.toContain('- f1 ');
});
t(309, async ({ page }) => { await open(page, balanceState()); await paste(page, answer(fire8()), recheck); await expect(ok(page, '8장 모두 규칙을 지켜요.')).toBeVisible(); });
t(310, async ({ page }) => { await open(page, balanceState()); await paste(page, answer(fire8()), recheck); await expect(page.locator('.todo li', { hasText: 'AI 수정 1회 만에 모두 통과했어요.' })).toBeVisible(); });
t(311, async ({ page }) => { await open(page, balanceState()); await paste(page, answer(fire8()), recheck); await expect(nextBtn(page)).toBeEnabled(); });
t(312, async ({ page }) => {
  await open(page, makeState({ step: 's1-balance', theme: '불꽃', packName: '화산', cards: fire8() }));
  await expect(page.locator('.todo li', { hasText: '처음부터 모두 통과했어요.' })).toBeVisible();
});
t(313, async ({ page }) => { await open(page, balanceState()); await paste(page, answer(withCard0({ id: 'x1' })), recheck); await expect(page.locator('.checks li.bad').last()).toContainText('카드 id가 바뀌었어요.'); });
t(314, async ({ page }) => { await open(page, balanceState()); await paste(page, answer(fire8().slice(0, 7)), recheck); await expect(bad(page, '카드가 8장이어야 하는데 7장이 왔어요.')).toBeVisible(); });
t(315, async ({ page }) => { await open(page, balanceState()); await paste(page, answer(withCard0({ name: '바뀐 이름' })), recheck); await expect(page.locator('.cards .card').first().locator('.name')).toHaveText('불씨 정령'); });
t(316, async ({ page }) => {
  await open(page, balanceState());
  const c = fire8(); c[1].attack = 10;
  await paste(page, answer(c), recheck);
  await expect(page.locator('.todo li', { hasText: '(지금까지 수정 1회)' })).toBeVisible();
});
t(317, async ({ page }) => { await open(page, balanceState()); await expect(nextBtn(page)).toBeDisabled(); });
t(318, async ({ page }) => { await open(page, balanceState()); await expect(barState(page)).toHaveText('빨간 카드가 없어지면 넘어갈 수 있어요.'); });
t(319, async ({ page }) => { await open(page, balanceState()); await expect(page.locator('button.link', { hasText: '강사 확인 후 넘어가기' })).toBeVisible(); });
t(320, async ({ page }) => {
  const msgs = dialogs(page); await open(page, balanceState());
  await page.locator('button.link', { hasText: '강사 확인 후 넘어가기' }).click();
  await expect.poll(() => msgs).toContain('강사가 확인했나요? 이 단계를 통과로 처리합니다.');
});
t(321, async ({ page }) => {
  dialogs(page); await open(page, balanceState());
  await page.locator('button.link', { hasText: '강사 확인 후 넘어가기' }).click();
  await expect(nextBtn(page)).toBeEnabled();
});
t(322, async ({ page }) => {
  const msgs = dialogs(page, 'dismiss'); await open(page, balanceState());
  await page.locator('button.link', { hasText: '강사 확인 후 넘어가기' }).click();
  await expect.poll(() => msgs.length).toBe(1);
  await expect(nextBtn(page)).toBeDisabled();
});

// ================================================================ S04 4단계

const descState = (cards) => makeState({ step: 's1-desc', theme: '불꽃', packName: '화산', cards: cards || withCard0({ desc: '작은 불꽃 3개로 공격한다' }) });
t(401, async ({ page }) => { await open(page, descState()); await expect(page.locator('.rulebox p').first()).toHaveText('설명은 30자 이내, 숫자는 쓰지 않아요.'); });
t(402, async ({ page }) => { await open(page, descState(fire8())); await expect(ok(page, '8장 모두 설명 규칙을 지켜요.')).toBeVisible(); });
t(403, async ({ page }) => { await open(page, descState()); await expect(bad(page, '설명을 고쳐야 할 카드가 1장 있어요.')).toBeVisible(); });
t(404, async ({ page }) => { await open(page, descState()); await expect(page.locator('.card[data-id=f1] .issue').first()).toContainText('설명에 숫자가 있어요.'); });
t(405, async ({ page }) => { await open(page, descState()); await expect(prompt(page)).toContainText('desc만 고쳐줘'); });
t(406, async ({ page }) => { await open(page, descState()); await paste(page, answer(withCard0({ attack: 9 })), recheck); await expect(page.locator('.card[data-id=f1] .atk')).toHaveText('⚔ 4'); });
t(407, async ({ page }) => { await open(page, descState()); await paste(page, answer(fire8()), recheck); await expect(ok(page, '8장 모두 설명 규칙을 지켜요.')).toBeVisible(); });
t(408, async ({ page }) => { await open(page, descState()); await expect(nextBtn(page)).toBeDisabled(); });

// ================================================================ S05 5단계

const artState = (style = '') => makeState({ step: 's1-art', theme: '불꽃', packName: '화산', cards: fire8(), extra: { style } });
const PNG = ['불씨정령.png', '화염견습생.png', '잿불방패병.png', '불꽃 사냥개.png'];
async function addImages(page, n) {
  for (let i = 0; i < n; i++) {
    await page.locator('.cards .card').nth(i).locator('input[type=file]').setInputFiles(IMG(PNG[i]));
    await expect(page.locator('.checks li', { hasText: '그림이 들어간 카드 ' + (i + 1) + '장' })).toBeVisible();
  }
}
t(501, async ({ page }) => { await open(page, artState()); await expect(page.locator('.main select option')).toHaveCount(8); });
t(502, async ({ page }) => { await open(page, artState()); await expect(page.locator('.main select')).toHaveValue('f1'); });
t(503, async ({ page }) => { await open(page, artState('판타지 카드 일러스트')); await expect(prompt(page)).toHaveText('판타지 카드 일러스트, 불씨 정령, 작은 불꽃으로 공격한다, 캐릭터 중심 구도, 단순한 배경'); });
t(504, async ({ page }) => { await open(page, artState()); await page.locator('.main select').selectOption('f2'); await expect(prompt(page)).toContainText('화염 검사'); });
t(505, async ({ page }) => { await open(page, artState()); await expect(bad(page, '그림이 들어간 카드 0장 / 최소 4장')).toBeVisible(); });
t(506, async ({ page }) => { await open(page, artState()); await addImages(page, 3); await expect(bad(page, '그림이 들어간 카드 3장 / 최소 4장')).toBeVisible(); });
t(507, async ({ page }) => { await open(page, artState()); await addImages(page, 3); await expect(nextBtn(page)).toBeDisabled(); });
t(508, async ({ page }) => { await open(page, artState()); await addImages(page, 4); await expect(ok(page, '그림이 들어간 카드 4장 / 최소 4장')).toBeVisible(); });
t(509, async ({ page }) => { await open(page, artState()); await addImages(page, 4); await expect(nextBtn(page)).toBeEnabled(); });
t(510, async ({ page }) => { await open(page, artState()); await addImages(page, 1); await expect(page.locator('.cards .card').first().locator('.art img')).toHaveCount(1); });
t(511, async ({ page }) => { await open(page, artState()); await addImages(page, 1); await expect(page.locator('.main select option[value=f1]')).toHaveText('불씨 정령 (그림 있음)'); });
t(512, async ({ page }) => {
  await open(page, artState()); await addImages(page, 1);
  await page.locator('.cards .card').first().locator('input[type=file]').setInputFiles(IMG(PNG[1]));
  await page.waitForTimeout(500);
  await expect(page.locator('.checks li', { hasText: '그림이 들어간 카드 1장 / 최소 4장' })).toBeVisible();
});
t(513, async ({ page }, info) => {
  const msgs = dialogs(page); await open(page, artState());
  await page.locator('.cards .card').first().locator('input[type=file]').setInputFiles(tmpFile(info, 'not_image.txt', '그림 아님'));
  await expect.poll(() => msgs).toContain('이미지 파일만 넣을 수 있어요.');
});
t(514, async ({ page }, info) => {
  const msgs = dialogs(page); await open(page, artState());
  await page.locator('.cards .card').first().locator('input[type=file]').setInputFiles(tmpFile(info, 'not_image.txt', '그림 아님'));
  await expect.poll(() => msgs.length).toBe(1);
  await expect(bad(page, '그림이 들어간 카드 0장 / 최소 4장')).toBeVisible();
});

// ================================================================ S06 6단계

const commitState = () => makeState({ step: 's1-commit', theme: '불꽃', packName: '화산', cards: fire8() });
const register = (page, name = '화산') => btn(page, '"' + name + '" 카드팩 등록').click();
t(601, async ({ page }) => { await open(page, commitState()); await expect(btn(page, '"화산" 카드팩 등록')).toBeVisible(); });
t(602, async ({ page }) => { await open(page, commitState()); await expect(bad(page, '아직 등록한 카드팩이 없어요.')).toBeVisible(); });
t(603, async ({ page }) => { await open(page, commitState()); await register(page); await expect(ok(page, '🔥 불꽃 · "화산" 8장')).toBeVisible(); });
t(604, async ({ page }) => { await open(page, commitState()); await register(page); await expect(btn(page, '두 번째 카드팩 만들기')).toBeVisible(); });
t(605, async ({ page }) => { await open(page, commitState()); await register(page); await expect(nextBtn(page)).toBeDisabled(); });
t(606, async ({ page }) => { await open(page, commitState()); await register(page); await expect(barState(page)).toHaveText('서로 다른 속성 카드팩 2개를 등록하면 넘어갈 수 있어요.'); });
t(607, async ({ page }) => {
  await open(page, commitState()); await register(page); await btn(page, '두 번째 카드팩 만들기').click();
  await expect(kicker(page)).toHaveText('기본 1단계 / 12');
});
t(608, async ({ page }) => {
  await open(page, makeState({ step: 's1-commit', packs: { '불꽃': packOf('화산', fire8()) }, extra: { editing: null, theme: '숲', packName: '고대 숲', cards: base('숲') } }));
  await register(page, '고대 숲');
  await expect(nextBtn(page)).toBeEnabled();
});

// ================================================================ S07 7단계 대전

const battleState = (packs, extra) => makeState({ step: 's1-battle', packs: packs || ['불꽃', '숲'], extra });
const attrBtn = (page, side, label) => page.locator('.attr-pick').nth(side).locator('.attr-btn', { hasText: new RegExp('^' + label) });
/** 내 첫 손패(4장)에 코스트 1 '불씨 정령'과 코스트 2 이상 카드가 함께 들어오는 시드 */
function battleSeed() {
  const pack = (a) => B.BASE_PACKS[a].map((c) => Object.assign(clone(c), { attr: a, img: '' }));
  for (let s = 1; s < 100000; s++) {
    const hand = B.newGame(pack('불꽃'), pack('숲'), { seed: s }).sides[0].hand;
    if (hand.some((c) => c.name === '불씨 정령') && hand.some((c) => c.cost >= 2)) return s;
  }
  throw new Error('시드를 찾지 못함');
}
const SEED = battleSeed();
async function startBattle(page, state) {
  await open(page, state || battleState(), SEED);
  await attrBtn(page, 0, '🔥 불꽃').click();
  await attrBtn(page, 1, '🌿 숲').click();
  await btn(page, '대전 시작').click();
  await expect(page.locator('.hand .bcard').first()).toBeVisible();
}
const winState = (extra) => battleState({ '불꽃': packOf('불꽃팩', strong()), '숲': packOf('숲팩', weak()) }, extra);
const loseState = () => battleState({ '불꽃': packOf('불꽃팩', weak()), '숲': packOf('숲팩', strong()) });
async function myTurn(page, mana) { await expect(page.locator('.mana .note')).toContainText('마나 ' + mana + ' / ' + mana, { timeout: 20_000 }); }
async function winGame(page) {
  await page.locator('.hand .bcard').first().click();
  await page.locator('.lane.target').first().click();
  await btn(page, '턴 종료').click();
  await myTurn(page, 2);
  await btn(page, '턴 종료').click();
  await expect(page.locator('.banner')).toHaveText('승리! 🎉', { timeout: 20_000 });
}
t(701, async ({ page }) => { await open(page, battleState()); await expect(page.locator('.pack', { hasText: '🔥 불꽃' })).toContainText('"불꽃팩" · 8장'); });
t(702, async ({ page }) => { await open(page, battleState()); await expect(page.locator('.pack', { hasText: '❄️ 얼음' })).toContainText('카드팩 없음'); });
t(703, async ({ page }) => { await open(page, battleState()); await expect(attrBtn(page, 0, '❄️ 얼음')).toBeDisabled(); });
t(704, async ({ page }) => { await open(page, battleState()); await expect(attrBtn(page, 1, '🌿 숲')).toBeDisabled(); });
t(705, async ({ page }) => { await open(page, battleState()); await attrBtn(page, 0, '🔥 불꽃').click(); await expect(attrBtn(page, 1, '🔥 불꽃')).toBeDisabled(); });
t(706, async ({ page }) => { await open(page, battleState()); await attrBtn(page, 0, '🔥 불꽃').click(); await expect(attrBtn(page, 1, '🌿 숲').locator('small')).toHaveText('내가 유리'); });
t(707, async ({ page }) => { await open(page, battleState()); await expect(btn(page, '대전 시작')).toBeDisabled(); });
t(708, async ({ page }) => {
  await open(page, battleState()); await attrBtn(page, 0, '🔥 불꽃').click(); await btn(page, '🎲 랜덤 상대와 대전').click();
  await expect(page.locator('.hint')).toHaveText('🎲 컴퓨터가 고른 상대: 🌿 숲 — 내가 유리한 상대예요.');
});
t(709, async ({ page }) => { await startBattle(page); await expect(page.locator('.hand .bcard')).toHaveCount(4); });
t(710, async ({ page }) => { await startBattle(page); await expect(page.locator('.mana .note')).toContainText('마나 1 / 1'); });
t(711, async ({ page }) => { await startBattle(page); await expect(page.locator('.hero[data-side="나"] .num')).toHaveText('체력 30'); });
t(712, async ({ page }) => { await startBattle(page); await expect(page.locator('.hero[data-side="컴퓨터"] .num')).toHaveText('체력 30'); });
t(713, async ({ page }) => { await startBattle(page); await expect(page.locator('.hint')).toHaveText('손패에서 낼 카드를 고르세요. 다 냈으면 [턴 종료].'); });
t(714, async ({ page }) => { await startBattle(page); await expect(page.locator('.log div').first()).toHaveText('1턴 · 나 차례 (마나 1)'); });
t(715, async ({ page }) => { await startBattle(page); await page.locator('.hand .bcard.off').first().click(); await expect(page.locator('.hint')).toHaveText('마나가 부족해요.'); });
const ember = (page) => page.locator('.hand .bcard', { hasText: '불씨 정령' });
t(716, async ({ page }) => { await startBattle(page); await ember(page).click(); await expect(page.locator('.lane.target')).toHaveCount(3); });
t(717, async ({ page }) => { await startBattle(page); await ember(page).click(); await expect(page.locator('.hint')).toHaveText('카드를 낼 칸을 고르세요. 칸마다 상성이 표시돼요.'); });
t(718, async ({ page }) => { await startBattle(page); await ember(page).click(); await expect(page.locator('.lane.target .adv').first()).toHaveText('맞은편 비어 있음 → 영웅 공격'); });
t(719, async ({ page }) => { await startBattle(page); await ember(page).click(); await ember(page).click(); await expect(page.locator('.lane.target')).toHaveCount(0); });
const myLanes = (page) => page.locator('.game .lanes').nth(1);
t(720, async ({ page }) => { await startBattle(page); await ember(page).click(); await page.locator('.lane.target').first().click(); await expect(myLanes(page).locator('.bcard', { hasText: '불씨 정령' })).toBeVisible(); });
t(721, async ({ page }) => { await startBattle(page); await ember(page).click(); await page.locator('.lane.target').first().click(); await expect(myLanes(page).locator('.bcard.sleep')).toHaveCount(1); });
t(722, async ({ page }) => { await startBattle(page); await ember(page).click(); await page.locator('.lane.target').first().click(); await expect(page.locator('.mana .note')).toContainText('마나 0 / 1'); });
t(723, async ({ page }) => { await startBattle(page); await btn(page, '턴 종료').click(); await myTurn(page, 2); }, { timeout: 60_000 });
t(724, async ({ page }) => { await startBattle(page); await btn(page, '턴 종료').click(); await myTurn(page, 2); await expect(page.locator('.log')).toContainText('3턴 · 나 차례'); }, { timeout: 60_000 });
t(725, async ({ page }) => { await startBattle(page, winState()); await winGame(page); }, { timeout: 60_000 });
t(726, async ({ page }) => {
  await startBattle(page, loseState());
  await btn(page, '턴 종료').click();
  await myTurn(page, 2);
  await btn(page, '턴 종료').click();
  await expect(page.locator('.banner')).toHaveText('패배', { timeout: 25_000 });
}, { timeout: 60_000 });
t(727, async ({ page }) => { await startBattle(page, winState()); await winGame(page); await expect(btn(page, '같은 상대와 다시')).toBeVisible(); }, { timeout: 60_000 });
t(728, async ({ page }) => {
  await startBattle(page, winState()); await winGame(page); await btn(page, '같은 상대와 다시').click();
  await expect(page.locator('.mana .note')).toContainText('마나 1 / 1');
}, { timeout: 60_000 });
t(729, async ({ page }) => {
  await startBattle(page, winState()); await winGame(page); await btn(page, '속성 다시 고르기').click();
  await expect(btn(page, '대전 시작')).toBeVisible();
}, { timeout: 60_000 });
t(730, async ({ page }) => { await startBattle(page, winState()); await winGame(page); await expect(page.locator('.note', { hasText: '끝까지 한 판 수' })).toHaveText('끝까지 한 판 수: 1 / 3'); }, { timeout: 60_000 });
t(731, async ({ page }) => { await startBattle(page, winState({ count: { games: 2 } })); await winGame(page); await expect(nextBtn(page)).toBeEnabled(); }, { timeout: 60_000 });

// ================================================================ S08 시뮬레이션

const simState = (extra) => makeState({ step: 's1-sim', packs: ['불꽃', '숲'], extra });
const simPred = () => simState({ pred: { winner: '불꽃', pct: 70, why: '상성 우위' } });
async function predict(page, pct, why) {
  const pctInput = page.locator('input[type=number]');
  if (pct !== null) await pctInput.fill(String(pct));
  await page.locator('input.text[type=text]').fill(why);
  await btn(page, '예상 저장').click();
}
t(801, async ({ page }) => { await open(page, simState()); await expect(page.locator('.todo li .what').first()).toContainText('시뮬레이션을 돌리기 전에 먼저 예상하세요.'); });
t(802, async ({ page }) => { await open(page, simState()); await predict(page, null, '상성 우위'); await expect(bad(page, '이길 확률을 0~100 사이 숫자로 쓰세요.')).toBeVisible(); });
t(803, async ({ page }) => { await open(page, simState()); await predict(page, 101, '상성 우위'); await expect(bad(page, '이길 확률을 0~100 사이 숫자로 쓰세요.')).toBeVisible(); });
t(804, async ({ page }) => { await open(page, simState()); await predict(page, -1, '상성 우위'); await expect(bad(page, '이길 확률을 0~100 사이 숫자로 쓰세요.')).toBeVisible(); });
t(805, async ({ page }) => { await open(page, simState()); await predict(page, 0, '상성 우위'); await expect(page.locator('.checks li', { hasText: '내 예상: 불꽃팩 0% 승' })).toBeVisible(); });
t(806, async ({ page }) => { await open(page, simState()); await predict(page, 100, '상성 우위'); await expect(page.locator('.checks li', { hasText: '내 예상: 불꽃팩 100% 승' })).toBeVisible(); });
t(807, async ({ page }) => { await open(page, simState()); await predict(page, 70, '상성우'); await expect(bad(page, '왜 그렇게 생각하는지 한 줄로 쓰세요.')).toBeVisible(); });
t(808, async ({ page }) => { await open(page, simState()); await predict(page, 70, '상성우위'); await expect(page.locator('.checks li', { hasText: '내 예상: 불꽃팩 70% 승 — "상성우위"' })).toBeVisible(); });
const replayNote = (page) => page.locator('.replay-board span.note', { hasText: '턴' });   // 칸의 '비어 있음' 표시와 구분
t(809, async ({ page }) => { await open(page, simPred()); await btn(page, '한 판 돌리기').click(); await expect(replayNote(page)).toHaveText(/^1 \/ \d+ 턴/); });
t(810, async ({ page }) => { await open(page, simPred()); await btn(page, '한 판 돌리기').click(); await expect(btn(page, '◀ 이전 턴')).toBeDisabled(); });
t(811, async ({ page }) => { await open(page, simPred()); await btn(page, '한 판 돌리기').click(); await btn(page, '다음 턴 ▶').click(); await expect(replayNote(page)).toHaveText(/^2 \/ \d+ 턴/); });
t(812, async ({ page }) => { await open(page, simPred()); await btn(page, '한 판 돌리기').click(); await page.locator('.replay-board button', { hasText: /^끝$/ }).click(); await expect(replayNote(page)).toContainText('결과:'); });
t(813, async ({ page }) => { await open(page, simPred()); await btn(page, '한 판 돌리기').click(); await expect(ok(page, '한 판 재생을 봤어요.')).toBeVisible(); });
t(814, async ({ page }) => { await open(page, simPred()); await btn(page, '100판씩 돌리기').click(); await expect(ok(page, '실제 100판 결과: 불꽃팩')).toBeVisible(); });
t(815, async ({ page }) => { await open(page, simPred()); await btn(page, '한 판 돌리기').click(); await btn(page, '100판씩 돌리기').click(); await expect(nextBtn(page)).toBeEnabled(); });
t(816, async ({ page }) => { await open(page, simPred()); await btn(page, '100판씩 돌리기').click(); await expect(ok(page, '실제 100판 결과')).toBeVisible(); await expect(nextBtn(page)).toBeDisabled(); });
t(817, async ({ page }) => {
  const msgs = dialogs(page); await open(page, simPred());
  await page.locator('select.sel').nth(1).selectOption('불꽃');
  await btn(page, '한 판 돌리기').click();
  await expect.poll(() => msgs).toContain('서로 다른 속성을 고르세요.');
});

// ================================================================ S09 나머지 속성

const moreState = (packs) => makeState({ step: 'f-more', packs: packs || ['불꽃', '숲'] });
t(901, async ({ page }) => { await open(page, moreState()); await expect(page.locator('.pack', { hasText: '🔥 불꽃' })).toContainText('"불꽃팩" · 8장'); });
t(902, async ({ page }) => { await open(page, moreState()); await expect(page.locator('.pack', { hasText: '❄️ 얼음' })).toContainText('아직 없음'); });
t(903, async ({ page }) => { await open(page, moreState()); await expect(btn(page, '카드팩 하나 더 만들기 (3/4)')).toBeVisible(); });
t(904, async ({ page }) => { await open(page, moreState()); await btn(page, '카드팩 하나 더 만들기 (3/4)').click(); await expect(kicker(page)).toHaveText('기본 1단계 / 12'); });
t(905, async ({ page }) => { await open(page, moreState()); await expect(bad(page, '카드팩 2개 / 4개')).toBeVisible(); });
t(906, async ({ page }) => { await open(page, moreState()); await expect(nextBtn(page)).toBeDisabled(); });
t(907, async ({ page }) => { await open(page, moreState()); await expect(page.locator('button.link')).toHaveCount(0); });
t(908, async ({ page }) => { await open(page, moreState(['불꽃', '숲', '기계'])); await expect(page.locator('button.link', { hasText: '강사 확인 후 넘어가기' })).toBeVisible(); });
t(909, async ({ page }) => { await open(page, moreState(['불꽃', '숲', '기계', '얼음'])); await expect(ok(page, '4속성 카드팩이 모두 준비됐어요.')).toBeVisible(); });
t(910, async ({ page }) => { await open(page, moreState(['불꽃', '숲', '기계', '얼음'])); await expect(nextBtn(page)).toBeEnabled(); });
t(911, async ({ page }) => {
  const passed = {}; CORE.slice(0, 8).forEach((k) => { passed[k] = true; });
  await open(page, makeState({ step: 's1-commit', packs: ['불꽃', '숲'], extra: { passed, loop: true, editing: null, theme: '얼음', packName: '얼음팩', cards: base('얼음') } }));
  await register(page, '얼음팩');
  await btn(page, '카드팩 목록으로 돌아가기').click();
  await expect(h2(page)).toHaveText('나머지 속성 카드팩 만들기');
});

// ================================================================ S10 리그전

const ALL4 = ['불꽃', '숲', '기계', '얼음'];
const leagueState = (extra) => makeState({ step: 'f-league', packs: ALL4, extra });
const PRED = { top: '불꽃', low: '얼음', why: '공격형이 많아서' };
const packsObj = () => Object.fromEntries(ALL4.map((a) => [a, B.BASE_PACKS[a].map((c) => Object.assign(clone(c), { attr: a }))]));
const spreadOf = (L) => Math.max(...L.attrs.map((a) => L.overall[a])) - Math.min(...L.attrs.map((a) => L.overall[a]));
function leagueSeed(cond, packs) {
  for (let s = 1; s < 300; s++) if (cond(spreadOf(B.attrLeague(packs || packsObj(), 100, s + 1)))) return s;   // 화면: seed = Date.now() % 100000 + 1
  return null;
}
// 기본 카드팩은 어느 시드든 차이 15%p 이하, 진행 파일(얼음_진행.json) 카드팩은 52%p 이상 → '초과' TC는 진행 파일 카드팩으로
const fixtureLeague = () => { const st = fixtureState(); return makeState({ step: 'f-league', packs: st.packs, extra: { leaguePred: PRED } }); };
const fixturePacksObj = () => { const st = fixtureState(); return Object.fromEntries(Object.keys(st.packs).map((a) => [a, st.packs[a].cards.map((c) => Object.assign({}, c, { attr: a }))])); };
const FAKE_L = {
  attrs: ALL4,
  table: { '불꽃': { '숲': 70, '기계': 50, '얼음': 50 }, '숲': { '불꽃': 30, '기계': 50, '얼음': 50 }, '기계': { '불꽃': 50, '숲': 50, '얼음': 50 }, '얼음': { '불꽃': 50, '숲': 50, '기계': 50 } },
  overall: { '불꽃': 70, '숲': 40, '기계': 50, '얼음': 45 }
};
const leagueSelects = (page) => page.locator('.main select.text');
t(1001, async ({ page }) => { await open(page, leagueState()); await expect(page.locator('.rulebox')).toContainText('속성끼리 100판씩 싸우게 해서 "종합 승률"을 구해요.'); });
t(1002, async ({ page }) => {
  await open(page, leagueState());
  await leagueSelects(page).nth(1).selectOption('불꽃');
  await page.locator('input.text[type=text]').fill('공격형이 많아서'); await btn(page, '예상 저장').click();
  await expect(bad(page, '가장 강한 속성과 가장 약한 속성은 달라야 해요.')).toBeVisible();
});
t(1003, async ({ page }) => {
  await open(page, leagueState());
  await leagueSelects(page).nth(1).selectOption('얼음');
  await page.locator('input.text[type=text]').fill('공격형'); await btn(page, '예상 저장').click();
  await expect(bad(page, '왜 그렇게 생각하는지 한 줄로 쓰세요.')).toBeVisible();
});
t(1004, async ({ page }) => {
  await open(page, leagueState());
  await leagueSelects(page).nth(1).selectOption('얼음');
  await page.locator('input.text[type=text]').fill('공격형이 많아서'); await btn(page, '예상 저장').click();
  await expect(page.locator('.todo li .what').first()).toContainText('내 예상: 가장 강한 속성 불꽃, 가장 약한 속성 얼음');
});
t(1005, async ({ page }) => { await open(page, leagueState({ leaguePred: PRED })); await expect(btn(page, '100판씩 돌리기 (총 600판)')).toBeVisible(); });
t(1006, async ({ page }) => { await open(page, leagueState({ leaguePred: PRED })); await btn(page, '100판씩 돌리기').click(); await expect(page.locator('table.league tr')).toHaveCount(5); });
t(1007, async ({ page }) => { await open(page, leagueState({ leaguePred: PRED })); await btn(page, '100판씩 돌리기').click(); await expect(page.locator('.checks li', { hasText: '가장 강한 속성: 예상 불꽃 / 실제' })).toBeVisible(); });
t(1008, async ({ page }) => {
  const s = leagueSeed((d) => d <= 25); test.skip(s === null, '기본 카드팩으로 차이 25%p 이하가 나오는 시드가 없음');
  await open(page, leagueState({ leaguePred: PRED }), s); await btn(page, '100판씩 돌리기').click();
  await expect(nextBtn(page)).toBeEnabled();
});
t(1009, async ({ page }) => {
  const s = leagueSeed((d) => d > 25, fixturePacksObj());
  await open(page, fixtureLeague(), s); await btn(page, '100판씩 돌리기').click();
  await expect(page.locator('.todo li', { hasText: '카드팩을 AI로 조정해 보세요.' })).toBeVisible();
});
t(1010, async ({ page }) => {
  const s = leagueSeed((d) => d > 25, fixturePacksObj());
  await open(page, fixtureLeague(), s); await btn(page, '100판씩 돌리기').click();
  await expect(nextBtn(page)).toBeDisabled();
});
t(1011, async ({ page }) => {
  const st = leagueState({ leaguePred: PRED, leagueRes: FAKE_L });
  st.packs['숲'].cards[1].attack = 20;                                   // 숲 w2: 합 24 (코스트 2) → 위반
  await open(page, st);
  await expect(page.locator('.todo li', { hasText: '카드팩이 카드 규칙을 어겼어요.' })).toBeVisible();
});
t(1012, async ({ page }) => {
  await open(page, leagueState({ leaguePred: PRED, leagueRes: FAKE_L, count: { leagueAdj: 1 } }));
  await expect(page.locator('.todo li', { hasText: 'AI 조정을 1번 했어요. 아직 차이가 있지만 넘어가도 돼요.' })).toBeVisible();
});
t(1013, async ({ page }) => { await open(page, leagueState({ leaguePred: PRED, leagueRes: FAKE_L })); await expect(page.locator('table.league td.hi', { hasText: '70%' }).first()).toBeVisible(); });
t(1014, async ({ page }) => { await open(page, leagueState({ leaguePred: PRED, leagueRes: FAKE_L })); await expect(page.locator('table.league td.lo', { hasText: '30%' }).first()).toBeVisible(); });

// ================================================================ S11 카드뽑기

const DESIGN = { rates: { '일반': 75, '희귀': 20, '전설': 5 }, pity: 30, claims: { card_legend_pct: 5, pack_at_least_one_pct: 22.6, avg_packs_per_legend: 4 }, notice: '카드 한 장마다 전설 5% 확률이며, 30팩 동안 전설이 없으면 천장으로 보장합니다.' };
const withDesign = (o) => Object.assign(clone(DESIGN), o);
const gachaState = (gacha) => makeState({ step: 'f-gacha', packs: ALL4, extra: { gacha: gacha || {} } });
const PRED_G = { n: 250, why: '5000 x 0.05' };
const designAnswer = (d) => '설계 이유: 전설은 희귀하게 두었어요.\n' + JSON.stringify(d);
const pullBtn = (page) => btn(page, '팩 1개 뽑기');
const sinceNote = (page) => page.locator('.note', { hasText: '전설 없이 지나간 팩:' });
const poolOf = (packs) => G.buildPool(Object.fromEntries(Object.keys(packs).map((a) => [a, { cards: packs[a].cards || packs[a] }])));
/** 화면 뽑기(rng(Date.now() % 100000 + 7))에서 조건에 맞는 시드 */
function pullSeed(design, cond) {
  const pool = poolOf(Object.fromEntries(ALL4.map((a) => [a, base(a)])));
  for (let s = 1; s < 100000; s++) { if (cond(G.rng(s + 7), design, pool)) return s; }
  throw new Error('시드를 찾지 못함');
}
t(1101, async ({ page }) => { await open(page, gachaState()); await expect(bad(page, '아직 설계가 없어요.')).toBeVisible(); });
t(1102, async ({ page }) => { await open(page, gachaState()); await expect(prompt(page)).toContainText('내 카드 수: 일반 16장, 희귀 12장, 전설 4장'); });
t(1103, async ({ page }) => { await open(page, gachaState()); await paste(page, designAnswer(DESIGN)); await expect(ok(page, '확률: 일반 75% · 희귀 20% · 전설 5%')).toBeVisible(); });
t(1104, async ({ page }) => { await open(page, gachaState()); await paste(page, designAnswer(withDesign({ rates: { '일반': 74, '희귀': 20, '전설': 5 } }))); await expect(bad(page, '확률 합이 99이에요. 100이어야 해요.')).toBeVisible(); });
t(1105, async ({ page }) => { await open(page, gachaState()); await paste(page, designAnswer(withDesign({ notice: '짧은 문구' }))); await expect(bad(page, 'notice(확률 안내 문구)가 필요해요.')).toBeVisible(); });
async function gpredict(page, n, why) {
  if (n !== null) await page.locator('input[type=number]').fill(String(n));
  await page.locator('input.text[type=text]').fill(why);
  await btn(page, '예상 저장').click();
}
t(1106, async ({ page }) => { await open(page, gachaState({ design: DESIGN })); await gpredict(page, null, '5000 x 0.05'); await expect(bad(page, '전설 카드 장수를 0 이상 숫자로 쓰세요.')).toBeVisible(); });
t(1107, async ({ page }) => { await open(page, gachaState({ design: DESIGN })); await gpredict(page, 250, '계산함'); await expect(bad(page, '어떻게 계산했는지 한 줄로 쓰세요.')).toBeVisible(); });
t(1108, async ({ page }) => { await open(page, gachaState({ design: DESIGN })); await gpredict(page, 250, '5000 x 0.05'); await expect(page.locator('.todo li .what', { hasText: '내 예상: 전설 250장 — "5000 x 0.05"' })).toBeVisible(); });
t(1109, async ({ page }) => { await open(page, gachaState({ design: DESIGN, pred: PRED_G }), 12345); await btn(page, '1,000팩 시뮬레이션').click(); await expect(page.locator('.checks li', { hasText: '(총 5000장)' })).toBeVisible(); });
t(1110, async ({ page }) => { await open(page, gachaState({ design: DESIGN, pred: PRED_G }), 12345); await btn(page, '1,000팩 시뮬레이션').click(); await expect(ok(page, '전설 카드: 예상 250장')).toBeVisible(); });
t(1111, async ({ page }) => { await open(page, gachaState({ design: DESIGN, pred: { n: 100, why: '대충 이 정도' } }), 12345); await btn(page, '1,000팩 시뮬레이션').click(); await expect(bad(page, '전설 카드: 예상 100장')).toBeVisible(); });
t(1112, async ({ page }) => { await open(page, gachaState({ design: DESIGN, pred: PRED_G })); await pullBtn(page).click(); await expect(page.locator('.pull .pc')).toHaveCount(5); });
t(1113, async ({ page }) => { await open(page, gachaState({ design: DESIGN, pred: PRED_G, drew: 0 })); await pullBtn(page).click(); await expect(page.locator('.note', { hasText: '뽑은 팩' })).toHaveText('뽑은 팩 1 / 3'); });
t(1114, async ({ page }) => { await open(page, gachaState({ design: DESIGN, pred: PRED_G })); await pullBtn(page).click(); await expect(sinceNote(page)).toHaveText(/^전설 없이 지나간 팩: \d+ \/ 천장 30/); });
t(1115, async ({ page }) => {
  const d = withDesign({ rates: { '일반': 89, '희귀': 10, '전설': 1 }, pity: 10 });
  const seed = pullSeed(d, (rand, dd, pool) => {
    const st = { since: 0 };
    for (let k = 0; k < 9; k++) if (G.openPack(dd, pool, st, rand).cards.some((c) => c.rarity === '전설')) return false;
    return G.openPack(dd, pool, st, rand).forced;
  });
  await open(page, gachaState({ design: d, pred: PRED_G }), seed);
  for (let i = 0; i < 10; i++) await pullBtn(page).click();
  await expect(sinceNote(page)).toContainText('— 천장 발동! 전설 1장이 보장됐어요.');
});
t(1116, async ({ page }) => {
  const seed = pullSeed(DESIGN, (rand, d, pool) => {
    const st = { since: 0 };
    for (let k = 0; k < 3; k++) if (G.openPack(d, pool, st, rand).cards.some((c) => c.rarity === '전설')) return false;
    return true;
  });
  await open(page, gachaState({ design: DESIGN, pred: PRED_G }), seed);
  for (let i = 1; i <= 3; i++) { await pullBtn(page).click(); await expect(sinceNote(page)).toHaveText('전설 없이 지나간 팩: ' + i + ' / 천장 30'); }
  await page.reload();
  await pullBtn(page).click();                                         // 같은 시드라 새로고침 뒤 첫 팩도 전설 없음
  await expect(sinceNote(page), '새로고침 전 3팩에 이어서 4가 되어야 함 (천장 카운트 저장 여부는 기획 확인 필요, SCRUM-142)')
    .toHaveText('전설 없이 지나간 팩: 4 / 천장 30');
});
t(1117, async ({ page }) => { await open(page, gachaState({ design: DESIGN, pred: PRED_G })); await expect(ok(page, '확률 안내의 수치가 모두 맞아요.')).toBeVisible(); });
const wrongClaims = () => withDesign({ claims: { card_legend_pct: 5, pack_at_least_one_pct: 25, avg_packs_per_legend: 4 } });
t(1118, async ({ page }) => { await open(page, gachaState({ design: wrongClaims(), pred: PRED_G })); await expect(bad(page, '확률 안내의 수치가 틀린 곳이 있어요.')).toBeVisible(); });
t(1119, async ({ page }) => {
  await open(page, gachaState({ design: wrongClaims(), pred: PRED_G }));
  await expect(page.locator('.promptbox pre', { hasText: '네가 만든 카드뽑기 확률 안내의 수치가 실제 계산과 달라.' })).toBeVisible();
});
t(1120, async ({ page }) => {
  await open(page, gachaState({ design: wrongClaims(), pred: PRED_G }));
  await paste(page, designAnswer(withDesign({ rates: { '일반': 50, '희귀': 40, '전설': 10 } })), '붙여넣고 다시 검수', 1);
  await expect(ok(page, '확률: 일반 75% · 희귀 20% · 전설 5%')).toBeVisible();
});
const SIM = { withPity: G.simulate(DESIGN, 1000, 1, true), noPity: G.simulate(DESIGN, 1000, 1, false) };
t(1121, async ({ page }) => { await open(page, gachaState({ design: DESIGN, pred: PRED_G, sim: SIM, drew: 3 })); await expect(nextBtn(page)).toBeEnabled(); });
t(1122, async ({ page }) => { await open(page, gachaState({ design: DESIGN, pred: PRED_G, sim: SIM, drew: 2 })); await expect(nextBtn(page)).toBeDisabled(); });

// ================================================================ S12 진행 파일 저장

async function toSave(page, st) { await open(page, st || fixtureState()); await railBtn(page, '진행 파일 저장').click(); }
async function save(page) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('.main button', { hasText: '진행 파일 저장' }).click()]);
  return dl;
}
t(1201, async ({ page }) => { await toSave(page); await expect(page.locator('.checks li', { hasText: '❄️ "얼음" 카드 8장 · 그림' })).toBeVisible(); });
t(1202, async ({ page }) => { await toSave(page); await expect(page.locator('.checks li', { hasText: 'AI 수정: 밸런스 1회, 설명문 1회' })).toBeVisible(); });
t(1203, async ({ page }) => { await toSave(page); expect((await save(page)).suggestedFilename()).toBe('얼음_진행.json'); });
t(1204, async ({ page }) => {
  await toSave(page);
  const saved = JSON.parse(fs.readFileSync(await (await save(page)).path(), 'utf-8'));
  expect([saved.app, Object.keys(saved.state.packs).length]).toEqual(['card-studio', 4]);
});
t(1205, async ({ page }) => { await toSave(page); await save(page); await expect(ok(page, '저장했어요. 내려받은 파일은 [진행 파일 불러오기]로 다시 열 수 있어요.')).toBeVisible(); });
t(1206, async ({ page }) => {
  const st = fixtureState(); st.packName = 'a/b:c'; st.editing = null;
  await toSave(page, st);
  expect((await save(page)).suggestedFilename()).toBe('abc_진행.json');
});

// ================================================================ 추가 미션

const missionState = (step, packs, extra) => makeState({ step, packs: packs || ALL4, extra });
t(1301, async ({ page }) => { await open(page, missionState('m1-art')); await expect(page.locator('.todo li').first().locator('button')).toHaveCount(4); });
t(1302, async ({ page }) => { await open(page, missionState('m1-art')); await btn(page, '🔥 불꽃팩').click(); await expect(page.locator('.cards .card .name').first()).toHaveText('불씨 정령'); });
t(1303, async ({ page }) => { await open(page, missionState('m1-art')); await expect(barState(page).first()).toHaveText('등록한 카드팩의 모든 카드에 그림을 넣으면 끝나요.'); });
t(1401, async ({ page }) => {
  await open(page, missionState('m1-tone'));
  await expect(btn(page, '어린이용 말투')).toBeVisible();
  await expect(btn(page, '진지한 말투')).toBeVisible();
});
t(1402, async ({ page }) => { await open(page, missionState('m1-tone')); await btn(page, '어린이용 말투').click(); await expect(bad(page, '어린이용 말투가 아니거나 규칙을 어긴 설명이 8개 있어요.')).toBeVisible(); });
t(1403, async ({ page }) => { await open(page, missionState('m1-tone')); await btn(page, '진지한 말투').click(); await expect(ok(page, '"얼음팩" 8장 모두 진지한 말투예요.')).toBeVisible(); });
t(1404, async ({ page }) => { await open(page, missionState('m1-tone')); await btn(page, '어린이용 말투').click(); await expect(prompt(page)).toContainText('모든 설명은 어린이용 말투'); });
const winBoth = (extra) => missionState('m1-winboth', { '불꽃': packOf('불꽃팩', strong()), '숲': packOf('숲팩', weak()) }, extra);
t(1501, async ({ page }) => { await open(page, winBoth()); await expect(bad(page, '🔥 "불꽃팩"로 아직 못 이김')).toBeVisible(); });
t(1502, async ({ page }) => { await startBattle(page, winBoth()); await winGame(page); await expect(ok(page, '🔥 "불꽃팩"로 승리함')).toBeVisible(); }, { timeout: 60_000 });
t(1503, async ({ page }) => {
  await startBattle(page, winBoth({ winsBy: { '숲': true } })); await winGame(page);
  await expect(barState(page)).toHaveText('확인 완료. 다음으로 넘어가세요.');
}, { timeout: 60_000 });
t(1601, async ({ page }) => { await open(page, missionState('m1-boost', ['불꽃', '숲'])); await expect(page.locator('.checks li', { hasText: '승률: 처음' })).toBeVisible(); });
t(1602, async ({ page }) => { await open(page, missionState('m1-boost', ['불꽃', '숲'])); await expect(page.locator('.promptbox pre', { hasText: '300판 중' })).toBeVisible(); });
t(1603, async ({ page }) => {
  const st = missionState('m1-boost', ['불꽃', '숲'], { boost: { attr: '숲', other: '불꽃', before: 40 } });
  st.packs['숲'].cards[1].attack = 20;
  st.cards[1].attack = 20;                                             // 지금 열린 카드팩(숲)의 작업 사본도 같이
  await open(page, st);
  await expect(page.locator('.todo li .what', { hasText: '카드 규칙을 어긴 카드가 있어요.' })).toBeVisible();
});

// ================================================================ E1 카드 규칙 엔진

const CARD = { id: 'c1', name: '테스트', type: '균형형', rarity: '일반', cost: 2, attack: 5, defense: 5, desc: '', ability: '' };
const norm = (page, o) => page.evaluate((c) => window.CardRules.normalizeCards([c]).errors.join(' | '), Object.assign({}, CARD, o));
const check = (page, o) => page.evaluate((c) => window.CardRules.checkCard(c).map((i) => i.msg).join(' | '), Object.assign({}, CARD, o));
const desc = (page, o, tone) => page.evaluate(([c, tn]) => window.CardRules.checkDesc(c, tn).map((i) => i.msg).join(' | '), [Object.assign({}, CARD, o), tone || null]);
const toneOnly = (page, d, tone) => page.evaluate(([dd, tn]) => window.CardRules.checkDesc({ type: '균형형', desc: dd }, tn).filter((i) => i.rule === 'tone').map((i) => i.msg).join(), [d, tone]);
const E1 = [
  [1701, (p) => norm(p, { cost: 0 }), '코스트는 1~9 정수여야 해요.'], [1702, (p) => norm(p, { cost: 1 }), ''],
  [1703, (p) => norm(p, { cost: 9 }), ''], [1704, (p) => norm(p, { cost: 10 }), '코스트는 1~9 정수여야 해요.'],
  [1705, (p) => norm(p, { attack: 40 }), ''], [1706, (p) => norm(p, { attack: 41 }), '공격력은 0~40 정수여야 해요.'],
  [1707, (p) => norm(p, { defense: 41 }), '방어력은 0~40 정수여야 해요.'],
  [1708, (p) => check(p, { attack: 3, defense: 4 }), '공격+방어 합이 7인데'], [1709, (p) => check(p, { attack: 4, defense: 4 }), ''],
  [1710, (p) => check(p, { attack: 6, defense: 6 }), ''], [1711, (p) => check(p, { attack: 6, defense: 7 }), '공격+방어 합이 13인데'],
  [1712, (p) => check(p, { cost: 3, attack: 8, defense: 7 }), ''], [1713, (p) => check(p, { cost: 4, attack: 10, defense: 10 }), '일반 등급은 코스트 3 이하여야 해요(지금 4).'],
  [1714, (p) => check(p, { rarity: '희귀', cost: 6, attack: 15, defense: 15 }), ''], [1715, (p) => check(p, { rarity: '희귀', cost: 7, attack: 18, defense: 17 }), '희귀 등급은 코스트 6 이하여야 해요(지금 7).'],
  [1716, (p) => check(p, { rarity: '전설', cost: 9, attack: 23, defense: 22 }), ''],
  [1717, (p) => check(p, { type: '공격형' }), '공격형인데 공격(5)이 방어(5)보다 크지 않아요.'], [1718, (p) => check(p, { type: '공격형', attack: 6, defense: 4 }), ''],
  [1719, (p) => check(p, { type: '방어형', attack: 6, defense: 4 }), '방어형인데 방어(4)가 공격(6)보다 크지 않아요.'], [1720, (p) => check(p, { type: '방어형', attack: 4, defense: 6 }), ''],
  [1721, (p) => check(p, { attack: 5, defense: 6 }), ''], [1722, (p) => check(p, { attack: 4, defense: 6 }), '균형형인데 공격(4)과 방어(6) 차이가 1보다 커요.'],
  [1723, (p) => check(p, { cost: 1, attack: 0, defense: 0, ability: '선공' }), '능력(선공)이 있으면 코스트가 2 이상이어야 해요.'],
  [1724, (p) => check(p, { cost: 3, ability: '선공' }), ''], [1725, (p) => check(p, { cost: 3 }), '공격+방어 합이 10인데'],
  [1726, (p) => desc(p, { desc: '가'.repeat(30) }), ''], [1727, (p) => desc(p, { desc: '가'.repeat(31) }), '설명은 30자 이내여야 해요(지금 31자).'],
  [1728, (p) => desc(p, { desc: '불꽃 3개를 던진다' }), '설명에 숫자가 있어요.'], [1729, (p) => desc(p, { desc: '' }), '설명이 비어 있어요.'],
  [1730, (p) => desc(p, { type: '방어형', desc: '적을 베어 파괴한다' }), '방어형인데 설명이 공격하는 느낌이에요'],
  [1731, (p) => desc(p, { type: '공격형', desc: '성문을 지킨다' }), '공격형인데 설명이 지키는 느낌이에요'],
  [1732, (p) => toneOnly(p, '불꽃을 뿜어요', '어린이용'), ''], [1733, (p) => toneOnly(p, '불꽃을 뿜는다', '어린이용'), '어린이용 말투가 아니에요.'],
  [1734, (p) => toneOnly(p, '불꽃을 뿜는다', '진지한'), ''], [1735, (p) => toneOnly(p, '불꽃을 뿜어요', '진지한'), '진지한 말투가 아니에요.'],
];
for (const [num, run, want] of E1) {
  t(num, async ({ page }) => {
    await open(page);
    const got = await run(page);
    if (want === '') expect(got).toBe(''); else expect(got).toContain(want);
  });
}
t(1736, async ({ page }) => {
  await open(page);
  const ids = await page.evaluate((c) => window.CardRules.normalizeCards([c, Object.assign({}, c, { name: '둘째' })]).cards.map((x) => x.id), CARD);
  expect(ids[1]).toBe('c2');
});

// ================================================================ E2 전투 엔진

/** 칸을 비운 게임에 카드를 놓고(공격 가능 상태) 내 턴을 turns번 끝낸다 */
const clash = (page, setup) => page.evaluate((setup) => {
  const B = window.BattleEngine;
  const mk = (o) => Object.assign({ id: o.name, type: '균형형', rarity: '일반', cost: 1, desc: '', ability: '' }, o);
  const st = B.newGame(B.BASE_PACKS['불꽃'], B.BASE_PACKS['숲'], { seed: 1, attrA: '불꽃', attrB: setup.foeAttr || '숲' });
  st.sides.forEach((s) => { s.board = [null, null, null]; });
  const place = (side, o) => { const c = mk(o); c.hp = c.defense; c.ready = true; c.shield = c.ability === '보호막'; st.sides[side].board[0] = c; };
  if (setup.mine) place(0, setup.mine);
  if (setup.foe) place(1, setup.foe);
  const out = [];
  for (let k = 0; k < (setup.turns || 1); k++) {
    st.active = 0;
    const from = st.log.length;
    B.endTurn(st);
    const ev = st.log.slice(from).map((l) => l.ev).find((e) => e && e.type === 'clash') || null;
    out.push({ text: st.log.slice(from).map((l) => l.text).join('\n'), ev, foeHp: st.sides[1].hp,
      foeCard: st.sides[1].board[0] && { hp: st.sides[1].board[0].hp }, myCard: st.sides[0].board[0] && { hp: st.sides[0].board[0].hp } });
  }
  return out;
}, setup);
const vs = (aAttr, dAttr) => ({ mine: { name: 'A', attr: aAttr, attack: 4, defense: 5 }, foe: { name: 'D', attr: dAttr, attack: 2, defense: 10 } });
t(1801, async ({ page }) => { await open(page); const [r] = await clash(page, vs('불꽃', '숲')); expect(r.ev.dealt).toBe(6); });
t(1802, async ({ page }) => { await open(page); const [r] = await clash(page, vs('불꽃', '숲')); expect(r.ev.back).toBe(2); });
t(1803, async ({ page }) => { await open(page); const [r] = await clash(page, vs('불꽃', '숲')); expect(r.text).toContain('(상성 ×1.5)'); });
t(1804, async ({ page }) => { await open(page); const [r] = await clash(page, vs('숲', '기계')); expect(r.ev.dealt).toBe(6); });
t(1805, async ({ page }) => { await open(page); const [r] = await clash(page, vs('기계', '얼음')); expect(r.ev.dealt).toBe(6); });
t(1806, async ({ page }) => { await open(page); const [r] = await clash(page, vs('얼음', '불꽃')); expect(r.ev.dealt).toBe(6); });
t(1807, async ({ page }) => { await open(page); const [r] = await clash(page, vs('숲', '불꽃')); expect(r.ev.dealt).toBe(4); });
t(1808, async ({ page }) => { await open(page); const [r] = await clash(page, { mine: { name: 'A', attr: '불꽃', attack: 4, defense: 5 }, foeAttr: '숲' }); expect(r.foeHp).toBe(26); });
const pierce = (hp) => ({ mine: { name: '창병', attr: '얼음', attack: 10, defense: 20, ability: '관통' }, foe: { name: '허수아비', attr: '숲', attack: 0, defense: hp } });
t(1809, async ({ page }) => { await open(page); const [r] = await clash(page, pierce(4)); expect(r.foeHp).toBe(24); });
t(1810, async ({ page }) => { await open(page); const [r] = await clash(page, pierce(4)); expect(r.text).toContain('관통! 남은 피해 6'); });
t(1811, async ({ page }) => { await open(page); const [r] = await clash(page, pierce(20)); expect(r.foeHp).toBe(30); });
const shield = { turns: 2, mine: { name: '검사', attr: '얼음', attack: 5, defense: 20 }, foe: { name: '방패병', attr: '숲', attack: 0, defense: 20, ability: '보호막' } };
t(1812, async ({ page }) => { await open(page); const [r1] = await clash(page, shield); expect(r1.ev.dealt).toBe(0); });
t(1813, async ({ page }) => { await open(page); const [, r2] = await clash(page, shield); expect(r2.foeCard.hp).toBe(15); });
const playAndEnd = (page, ability) => page.evaluate((ability) => {
  const B = window.BattleEngine;
  const st = B.newGame(B.BASE_PACKS['불꽃'], B.BASE_PACKS['숲'], { seed: 1, attrA: '불꽃', attrB: '숲' });
  st.sides.forEach((s) => { s.board = [null, null, null]; });
  st.sides[0].hand.unshift({ id: 'x', name: '돌격병', attr: '불꽃', type: '공격형', rarity: '일반', cost: 1, attack: 5, defense: 2, desc: '', ability });
  B.playCard(st, 0, 0); B.endTurn(st);
  return st.sides[1].hp;
}, ability);
t(1814, async ({ page }) => { await open(page); expect(await playAndEnd(page, '선공')).toBe(25); });
t(1815, async ({ page }) => { await open(page); expect(await playAndEnd(page, '')).toBe(30); });
/** 새 게임에서 카드 내기 실패 문구 */
const playErr = (page, kind) => page.evaluate((kind) => {
  const B = window.BattleEngine;
  const st = B.newGame(B.BASE_PACKS['불꽃'], B.BASE_PACKS['숲'], { seed: 1 });
  const me = st.sides[0];
  me.board = [null, null, null];
  const small = { id: 's', name: '작은 카드', attr: '불꽃', cost: 1, attack: 1, defense: 1 };
  if (kind === 'mana') { me.hand.unshift({ id: 'big', name: '큰 카드', attr: '불꽃', cost: 3, attack: 9, defense: 6 }); return B.playCard(st, 0, 0); }
  me.hand.unshift(small);
  if (kind === 'taken') { me.board[1] = Object.assign({ hp: 1 }, small); return B.playCard(st, 0, 1); }
  if (kind === 'lane') return B.playCard(st, 0, 3);
  if (kind === 'over') { st.over = true; return B.playCard(st, 0, 0); }
  if (kind === 'hand') return B.playCard(st, 9, 0);
}, kind);
t(1816, async ({ page }) => { await open(page); expect(await playErr(page, 'mana')).toBe('마나가 부족해요 (필요 3, 남은 마나 1).'); });
t(1817, async ({ page }) => { await open(page); expect(await playErr(page, 'taken')).toBe('그 칸에는 이미 카드가 있어요.'); });
t(1818, async ({ page }) => { await open(page); expect(await playErr(page, 'lane')).toBe('칸을 골라야 해요.'); });
t(1819, async ({ page }) => { await open(page); expect(await playErr(page, 'over')).toBe('게임이 끝났어요.'); });
t(1820, async ({ page }) => { await open(page); expect(await playErr(page, 'hand')).toBe('그 카드는 손에 없어요.'); });
/** 아무도 카드를 내지 않고 턴만 넘긴다 */
const idle = (page, fn) => page.evaluate((src) => {
  const B = window.BattleEngine;
  const st = B.newGame(B.BASE_PACKS['불꽃'], B.BASE_PACKS['숲'], { seed: 1 });
  st.sides.forEach((s) => { s.board = [null, null, null]; });
  return new Function('B', 'st', src)(B, st);
}, fn);
t(1821, async ({ page }) => { await open(page); expect(await idle(page, 'for (let i = 0; i < 4; i++) B.endTurn(st); return st.sides[0].mana;')).toBe(3); });
t(1822, async ({ page }) => { await open(page); expect(await idle(page, 'for (let i = 0; i < 20; i++) B.endTurn(st); return st.sides[0].mana;')).toBe(10); });
t(1823, async ({ page }) => {
  await open(page);
  expect(await idle(page, 'const me = st.sides[0]; while (me.hand.length < 7) me.hand.push(JSON.parse(JSON.stringify(me.hand[0]))); B.endTurn(st); B.endTurn(st); return me.hand.length;')).toBe(7);
});
t(1824, async ({ page }) => {
  await open(page);
  const games = await page.evaluate(() => {
    const B = window.BattleEngine, out = [];
    for (let s = 1; s <= 30; s++) { const st = B.playAiGame(B.BASE_PACKS['불꽃'], B.BASE_PACKS['숲'], { seed: s }); out.push(st.over && st.turn <= 30); }
    return out;
  });
  expect(games.every(Boolean)).toBe(true);
});
t(1825, async ({ page }) => {
  await open(page);
  expect(await idle(page, 'st.sides[0].hp = 20; let g = 0; while (!st.over && g++ < 40) B.endTurn(st); return st.winner;')).toBe(1);
});
t(1826, async ({ page }) => {
  await open(page);
  const [a, b] = await page.evaluate(() => [1, 2].map(() => window.BattleEngine.simulate(window.BattleEngine.BASE_PACKS['불꽃'], window.BattleEngine.BASE_PACKS['숲'], 20, 123)));
  expect(b).toEqual(a);
});
t(1827, async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => window.BattleEngine.simulate(window.BattleEngine.BASE_PACKS['불꽃'], window.BattleEngine.BASE_PACKS['숲'], 100, 7));
  expect(r.winsA + r.winsB + r.draws).toBe(100);
});
t(1828, async ({ page }) => {
  await open(page);
  const [r] = await clash(page, { mine: { name: '검사', attr: '얼음', attack: 10, defense: 20 }, foe: { name: '허수아비', attr: '숲', attack: 0, defense: 4 } });
  expect(r.foeCard).toBeNull();
});

// ================================================================ E3 카드뽑기 엔진

const validate = (page, o) => page.evaluate(([d, o2]) => window.Gacha.validateDesign(Object.assign(d, o2)).join(' | '), [clone(DESIGN), o]);
const R3 = (n, h, l) => ({ rates: { '일반': n, '희귀': h, '전설': l } });
const E3 = [
  [1901, R3(74, 20, 5), '확률 합이 99이에요. 100이어야 해요.'], [1902, {}, ''],
  [1903, R3(75, 24.5, 0.5), '전설 확률은 1~10 사이여야 해요(지금 0.5).'], [1904, R3(79, 20, 1), ''], [1905, R3(70, 20, 10), ''],
  [1906, R3(69, 20, 11), '전설 확률은 1~10 사이여야 해요(지금 11).'], [1907, R3(49, 46, 5), '일반 확률은 50 이상이어야 해요(지금 49).'],
  [1908, R3(92, 3, 5), '희귀 확률은 전설 확률보다 크거나 같아야 해요.'],
  [1909, { pity: 9 }, '천장(pity)은 10~100 사이 정수여야 해요.'], [1910, { pity: 10 }, ''], [1911, { pity: 100 }, ''],
  [1912, { pity: 101 }, '천장(pity)은 10~100 사이 정수여야 해요.'], [1913, { claims: null }, 'claims에 card_legend_pct 숫자가 필요해요.'],
];
for (const [num, o, want] of E3) {
  t(num, async ({ page }) => {
    await open(page);
    const got = await validate(page, o);
    if (want === '') expect(got).toBe(''); else expect(got).toContain(want);
  });
}
const audit = (page, c) => page.evaluate(([rates, claims]) => window.Gacha.audit({ rates, claims }), [DESIGN.rates, { card_legend_pct: c[0], pack_at_least_one_pct: c[1], avg_packs_per_legend: c[2] }]);
const wrongLabels = (rows) => rows.filter((r) => !r.ok).map((r) => r.label);
t(1914, async ({ page }) => { await open(page); expect(wrongLabels(await audit(page, [5, 22.6, 4]))).toEqual([]); });
t(1915, async ({ page }) => { await open(page); expect(wrongLabels(await audit(page, [5, 25, 4]))).toEqual(['팩 1개에서 전설이 1장 이상 나올 확률(%)']); });
t(1916, async ({ page }) => { await open(page); expect((await audit(page, [5, 25, 4])).find((r) => !r.ok).truth).toBe(22.6); });
t(1917, async ({ page }) => { await open(page); expect(wrongLabels(await audit(page, [5, 22.6, 5]))).toEqual(['전설 1장을 얻기까지 평균 팩 수']); });
t(1918, async ({ page }) => { await open(page); expect(wrongLabels(await audit(page, [5, 23.6, 4])), '허용 오차 ±1 안쪽(차이 1.0)인데 틀림으로 판정되는지').toEqual([]); });
t(1919, async ({ page }) => { await open(page); expect(wrongLabels(await audit(page, [5, 23.7, 4]))).toEqual(['팩 1개에서 전설이 1장 이상 나올 확률(%)']); });
const lowLegend = { rates: { '일반': 89, '희귀': 10, '전설': 1 }, pity: 10 };
const gsim = (page, d, seed, pity) => page.evaluate(([dd, s, p]) => window.Gacha.simulate(dd, 1000, s, p), [d, seed, pity]);
t(1920, async ({ page }) => { await open(page); expect((await gsim(page, lowLegend, 42, true)).maxGap).toBeLessThanOrEqual(9); });
t(1921, async ({ page }) => { await open(page); expect((await gsim(page, lowLegend, 42, true)).forced).toBeGreaterThanOrEqual(1); });
t(1922, async ({ page }) => { await open(page); expect((await gsim(page, lowLegend, 42, false)).maxGap).toBeGreaterThanOrEqual(10); });
t(1923, async ({ page }) => {
  await open(page);
  const pcts = await page.evaluate((d) => [1, 2, 3, 4, 5].map((s) => window.Gacha.simulate(d, 1000, s, false)['전설'] / 5000 * 100), DESIGN);
  for (const p of pcts) { expect(p).toBeGreaterThanOrEqual(4); expect(p).toBeLessThanOrEqual(6); }
});
t(1924, async ({ page }) => { await open(page); expect(await page.evaluate((d) => window.Gacha.openPack(d, null, { since: 0 }, window.Gacha.rng(1)).cards.length, DESIGN)).toBe(5); });
t(1925, async ({ page }) => {
  await open(page);
  const since = await page.evaluate((d) => {
    const G = window.Gacha;
    for (let s = 1; s < 10000; s++) {
      const st = { since: 5 };
      const p = G.openPack(d, null, st, G.rng(s));
      if (p.cards.some((c) => c.rarity === '전설') && !p.forced) return st.since;
    }
    return -1;
  }, DESIGN);
  expect(since).toBe(0);
});
