// 기밀 경로의 고정 실행기: AI가 쓴 코드를 실행하지 않고, 정해진 조작(누르기·입력·키)과 판정만 한다.
// 사용 (secure_tc.py가 부른다):
//   node tools/local_runner.cjs scan <게임.html> <요소목록.json>
//   node tools/local_runner.cjs run  <게임.html> <계획.json> <결과.json> <스크린샷 폴더>
// 게임 페이지의 외부 통신은 막는다 (file: data: blob: 만 허용). 화면에는 건수만 출력한다.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('@playwright/test');

const CLICK_MS = 2500;
const CHECK_MS = 1500;

async function openPage(browser, url, counters) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.route('**/*', route => {
    const u = route.request().url();
    if (/^(file|data|blob):/.test(u)) return route.continue();
    counters.blocked += 1;
    return route.abort();
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 15000 });
  return { context, page };
}

// 페이지 안에서 조작할 수 있는 요소를 모은다 (숨은 화면의 요소 포함)
function collect() {
  const out = [];
  const nodes = document.querySelectorAll('button,a[href],input,select,textarea,[role=button],[onclick]');
  for (const el of nodes) {
    const tag = el.tagName.toLowerCase();
    const text = (el.innerText || el.textContent || el.value || el.placeholder || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    const id = el.id || '';
    if (!id && !text) continue;
    if (!id && /["\\]/.test(text)) continue;
    out.push({ tag, text, sel: id ? `[id="${id.replace(/"/g, '\\"')}"]` : `${tag}:text-is("${text}")` });
  }
  return { elements: out, canvas: document.querySelectorAll('canvas').length };
}

async function scan(gamePath, outPath) {
  const url = pathToFileURL(gamePath).href;
  const counters = { blocked: 0 };
  const browser = await chromium.launch();
  const found = new Map();
  let canvas = 0;
  const add = r => { canvas = Math.max(canvas, r.canvas); for (const e of r.elements) if (!found.has(e.sel)) found.set(e.sel, e); };
  const first = await openPage(browser, url, counters);
  add(await first.page.evaluate(collect));
  await first.context.close();
  // 버튼을 한 번씩 눌러 그때 새로 생기는 요소도 찾는다 (한 단계, 최대 15개)
  for (const e of [...found.values()].slice(0, 15)) {
    const s = await openPage(browser, url, counters);
    try {
      await s.page.locator(e.sel).first().click({ timeout: 800 });
      add(await s.page.evaluate(collect));
    } catch { /* 숨었거나 눌리지 않는 요소 */ }
    await s.context.close();
  }
  await browser.close();
  fs.writeFileSync(outPath, JSON.stringify({ elements: [...found.values()], canvas, blocked: counters.blocked }), 'utf8');
  console.log(`  화면 요소 ${found.size}개 · canvas ${canvas}개 · 막은 외부 요청 ${counters.blocked}건`);
}

async function holds(page, check) {
  if (check.kind === 'text_visible' || check.kind === 'text_hidden') {
    const visible = await page.getByText(check.text).filter({ visible: true }).count() > 0;
    return check.kind === 'text_visible' ? visible : !visible;
  }
  const loc = page.locator(check.sel).first();
  if (await loc.count() === 0) return false;
  const enabled = await loc.isEnabled();
  return check.kind === 'enabled' ? enabled : !enabled;
}

async function holdsWithin(page, check) {
  const end = Date.now() + CHECK_MS;
  for (;;) {
    if (await holds(page, check)) return true;
    if (Date.now() > end) return false;
    await page.waitForTimeout(100);
  }
}

async function runOne(browser, url, plan, shotDir, counters) {
  const { context, page } = await openPage(browser, url, counters);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message || e).slice(0, 200)));
  const r = { id: plan.id, status: 'passed', detail: '', screenshot: '', errors };
  try {
    const before = await holds(page, plan.check);
    for (const [i, a] of plan.actions.entries()) {
      for (let n = 0; n < a.repeat; n += 1) {
        try {
          const loc = page.locator(a.sel).first();
          if (a.do === 'fill') await loc.fill(a.value, { timeout: CLICK_MS });
          else if (a.do === 'press') await page.keyboard.press(a.value);
          else await loc.click({ timeout: CLICK_MS });
        } catch {
          r.status = 'blocked';
          r.detail = `${i + 1}번째 조작(${n + 1}회째)을 할 수 없음`;
          break;
        }
      }
      if (r.status === 'blocked') break;
    }
    if (r.status !== 'blocked') {
      if (await holdsWithin(page, plan.check)) {
        // 조작 전에도 이미 맞았다면 조작 결과를 판정했다고 볼 수 없다
        if (before && plan.actions.length) { r.status = 'weak'; r.detail = '조작 전에도 같은 상태 — 판정이 약함'; }
      } else {
        r.status = 'failed';
        r.detail = '기대한 상태가 아님';
      }
    }
  } catch (e) {
    r.status = 'blocked';
    r.detail = '실행 오류';
  }
  if (r.status === 'failed' || r.status === 'blocked') {
    const shot = path.join(shotDir, `${plan.id}.png`);
    await page.screenshot({ path: shot }).catch(() => {});
    if (fs.existsSync(shot)) r.screenshot = path.basename(shot);
  }
  await context.close();
  return r;
}

async function run(gamePath, planPath, outPath, shotDir) {
  const url = pathToFileURL(gamePath).href;
  const plans = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  fs.mkdirSync(shotDir, { recursive: true });
  const counters = { blocked: 0 };
  const browser = await chromium.launch();
  const results = [];
  for (const plan of plans) results.push(await runOne(browser, url, plan, shotDir, counters));
  await browser.close();
  fs.writeFileSync(outPath, JSON.stringify({ results, blocked: counters.blocked }, null, 1), 'utf8');
}

// 탐색 테스트: 기획서·AI 없이 보이는 요소를 무작위로 눌러 스크립트 오류·멈춤을 찾는다. 같은 씨앗이면 같은 순서로 누른다.
async function explore(gamePath, outPath, shotDir, runs, stepsPerRun) {
  const url = pathToFileURL(gamePath).href;
  fs.mkdirSync(shotDir, { recursive: true });
  const counters = { blocked: 0 };
  const browser = await chromium.launch();
  const issues = new Map();
  const pressed = new Map();
  let clicks = 0;
  for (let seed = 1; seed <= runs; seed += 1) {
    let x = seed * 7919;
    const rnd = n => { x = (x * 1103515245 + 12345) % 2147483648; return x % n; };
    const { context, page } = await openPage(browser, url, counters);
    const path_ = [];
    const report = async (kind, text) => {
      const key = `${kind}: ${text}`;
      if (issues.has(key)) { issues.get(key).count += 1; return; }
      const shot = path.join(shotDir, `탐색${issues.size + 1}.png`);
      await page.screenshot({ path: shot, timeout: 3000 }).catch(() => {});
      issues.set(key, { kind, text, count: 1, seed, steps: path_.slice(-12), screenshot: fs.existsSync(shot) ? path.basename(shot) : '' });
    };
    const pending = [];
    page.on('pageerror', e => pending.push(['스크립트 오류', String(e.message || e).split('\n')[0].slice(0, 160)]));
    page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource/.test(m.text())) pending.push(['콘솔 오류', m.text().split('\n')[0].slice(0, 160)]); });
    for (let step = 0; step < stepsPerRun; step += 1) {
      let elements = [];
      try {
        elements = await page.evaluate(() => {
          const out = [];
          for (const el of document.querySelectorAll('button,a[href],input,select,[role=button],[onclick]')) {
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height || el.disabled || getComputedStyle(el).visibility === 'hidden') continue;
            const label = (el.id ? `#${el.id} ` : '') + (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 24);
            out.push({ label, x: r.x + r.width / 2, y: r.y + r.height / 2 });
          }
          return out;
        });
      } catch { await report('멈춤', '페이지 응답 없음'); break; }
      if (!elements.length) {            // 버튼이 없으면 게임 화면(canvas): 이동 키와 화면 클릭으로 조작한다
        const key = ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', ' '][rnd(9)];
        const label = `(키 ${key})`;
        path_.push(label);
        pressed.set('(키·화면 조작)', (pressed.get('(키·화면 조작)') || 0) + 1);
        clicks += 1;
        await page.keyboard.down(key).catch(() => {});
        await page.mouse.click(100 + rnd(1080), 100 + rnd(600)).catch(() => {});
        await page.waitForTimeout(300);
        await page.keyboard.up(key).catch(() => {});
        for (const [k, t] of pending.splice(0)) await report(k, t);
        continue;
      }
      const el = elements[rnd(elements.length)];
      path_.push(el.label);
      pressed.set(el.label, (pressed.get(el.label) || 0) + 1);
      clicks += 1;
      await page.mouse.click(el.x, el.y).catch(() => {});
      await page.waitForTimeout(120);
      const alive = await Promise.race([page.evaluate(() => 1).catch(() => 0), new Promise(res => setTimeout(() => res(0), 5000))]);
      for (const [k, t] of pending.splice(0)) await report(k, t);
      if (!alive) { await report('멈춤', '5초 안에 응답 없음'); break; }
    }
    await context.close().catch(() => {});
  }
  await browser.close();
  const result = { runs, stepsPerRun, clicks, distinct: pressed.size, blocked: counters.blocked, issues: [...issues.values()], pressed: [...pressed.entries()].sort((a, b) => b[1] - a[1]) };
  fs.writeFileSync(outPath, JSON.stringify(result, null, 1), 'utf8');
  console.log(`  탐색: ${runs}판 · 클릭 ${clicks}회 · 눌러 본 요소 ${pressed.size}종 · 발견 ${issues.size}종 · 막은 외부 요청 ${counters.blocked}건`);
}

const [mode, ...rest] = process.argv.slice(2);
const job = mode === 'scan' ? scan(rest[0], rest[1])
  : mode === 'run' ? run(rest[0], rest[1], rest[2], rest[3])
    : mode === 'explore' ? explore(rest[0], rest[1], rest[2], Number(rest[3] || 5), Number(rest[4] || 40))
      : Promise.reject(new Error('scan, run 또는 explore'));
job.catch(e => { console.error('실행기 오류:', String(e.message || e).split('\n')[0].slice(0, 120)); process.exit(1); });
