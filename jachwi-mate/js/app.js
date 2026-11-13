/* ===== 자취 메이트 앱 ===== */
(function(){
'use strict';

/* ---------- 유틸 ---------- */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const won = n => (Math.round(n) || 0).toLocaleString('ko-KR') + '원';
const stars = n => '★'.repeat(n) + '☆'.repeat(3 - n);
const R = {}; RECIPES.forEach(r => R[r.id] = r);

function hash(s){ let h = 2166136261; for (const c of s){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed){ let a = hash(seed); return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function todayStr(){ const d = new Date(); return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate(); }
function slotNow(){ const h = new Date().getHours(); if (h >= 5 && h < 11) return '아침'; if (h >= 11 && h < 16) return '점심'; if (h >= 16 && h < 22) return '저녁'; return '야식'; }
function fmtQ(q){
  if (q >= 10 && Number.isInteger(q)) return String(q);
  const fr = [[0,''],[.25,'¼'],[1/3,'⅓'],[.5,'½'],[2/3,'⅔'],[.75,'¾']];
  let w = Math.floor(q + 0.01), f = q - w; if (f < 0) f = 0;
  if (f > 0.94){ w += 1; f = 0; }
  for (const [v, s] of fr){ if (Math.abs(f - v) < 0.06) return ((w ? w : '') + s) || '0'; }
  return String(Math.round(q * 10) / 10);
}

/* ---------- 저장소 ---------- */
const KEY = 'jm_v1';
function fresh(){ return {fav:[], have:{}, price:{}, items:ITEMS.map(x => Object.assign({}, x, {st:'todo'})), shop:[], set:{alcohol:true}, rec:{}}; }
function load(){
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && Array.isArray(s.items)) return Object.assign(fresh(), s, {set:Object.assign({alcohol:true}, s.set || {})}); } catch(e){}
  return fresh();
}
let S = load();
function save(){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e){} }

/* ---------- 예산 계산 ---------- */
function isHave(name, staple){ const v = S.have[name]; return v === undefined ? !!staple : !!v; }
function ingCost(r, i, serv){ const k = r.id + '|' + i; if (S.price[k] !== undefined) return Math.round(S.price[k] * serv); return Math.round(r.ing[i][3] * serv / 10) * 10; }
function recipeCost(r, serv = 1, needed = true){
  let t = 0; r.ing.forEach((g, i) => { if (needed && isHave(g[0], g[4])) return; t += ingCost(r, i, serv); }); return t;
}
function itemStats(){
  const it = S.items, sum = f => it.filter(f).reduce((a, x) => a + (+x.p || 0), 0);
  const tier = {}; [1,2,3,4].forEach(t => tier[t] = sum(x => x.tier === t));
  return {n:it.length, have:it.filter(x => x.st === 'have').length, total:sum(() => true), plan:sum(x => x.st === 'plan'), haveSum:sum(x => x.st === 'have'), left:sum(x => x.st !== 'have'), tier};
}

/* ---------- 오늘의 추천 ---------- */
function recN(slot){ const d = todayStr(); if (!S.rec || S.rec.d !== d) S.rec = {d, n:{}}; return S.rec.n[slot] || 0; }
function recommend(slot, n){
  const r = rng(todayStr() + slot + n), pick = a => a.length ? a[Math.floor(r() * a.length)] : null;
  const pool = role => RECIPES.filter(x => x.role === role && x.meals.includes(slot));
  const main = pick(pool('main'));
  const side = slot === '야식' ? null : pick(pool('side'));
  const snack = (slot === '저녁' || slot === '야식') ? pick(pool('snack')) : null;
  let drink = null, alt = null;
  if (slot === '저녁' || slot === '야식'){
    const tags = (snack && snack.drink) || (main && main.drink) || ['beer'];
    let key = pick(tags.filter(k => DRINKS[k] && (S.set.alcohol || !DRINKS[k].alc)));
    if (!key) key = 'zero';
    drink = key; alt = key === 'zero' ? 'soda' : 'zero';
  }
  return {slot, main, side, snack, drink, alt};
}

/* ---------- 상태 ---------- */
let tab = (['home','recipes','items','shop','tips'].indexOf(new URLSearchParams(location.search).get('tab')) >= 0 ? new URLSearchParams(location.search).get('tab') : 'home'), homeSlot = slotNow(), recUi = {cat:'전체', q:''}, itemTier = 0, sheet = null;
const openCats = new Set(['가전']);

/* ---------- 토스트·타이머 ---------- */
let toastIv = null;
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastIv); toastIv = setTimeout(() => t.hidden = true, 2200); }
let T = null, timerIv = null;
function startTimer(min, label){
  clearInterval(timerIv); T = {end:Date.now() + min * 60000, label}; tickTimer(); timerIv = setInterval(tickTimer, 500); toast('⏱ ' + min + '분 타이머 시작');
}
function stopTimer(){ clearInterval(timerIv); T = null; $('#timer').hidden = true; }
function tickTimer(){
  const el = $('#timer'); if (!T){ el.hidden = true; return; }
  const left = Math.max(0, Math.round((T.end - Date.now()) / 1000));
  el.hidden = false;
  if (left <= 0){
    clearInterval(timerIv); el.innerHTML = '⏰ ' + esc(T.label) + ' 끝났어요! <button data-act="stop-timer">닫기</button>'; T = null;
    try { navigator.vibrate && navigator.vibrate([300, 150, 300]); } catch(e){}
    try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(); o.connect(c.destination); o.frequency.value = 880; o.start(); setTimeout(() => { o.stop(); c.close(); }, 400); } catch(e){}
    return;
  }
  el.innerHTML = '⏱ ' + esc(T.label) + ' ' + String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0') + ' <button data-act="stop-timer">끄기</button>';
}

/* ---------- 홈 ---------- */
function mealLine(label, r){
  if (!r) return '';
  return `<button class="mini" data-act="open-recipe" data-id="${r.id}"><span class="em">${r.e}</span><span class="grow"><span class="lbl">${label}</span><br><b>${esc(r.n)}</b> <span class="muted">· ${r.time}분 · 약 ${won(recipeCost(r))}</span></span><span class="muted">›</span></button>`;
}
function viewHome(){
  const slot = homeSlot, rec = recommend(slot, recN(slot)), h = new Date().getHours();
  const greet = h < 5 ? '늦은 밤이네요 🌙' : h < 11 ? '좋은 아침이에요 ☀️' : h < 16 ? '점심 챙겨 드세요 🍚' : h < 22 ? '오늘 저녁은 뭐 먹을까요? 🍽️' : '출출한 밤이네요 🌙';
  const m = rec.main, mainCost = [m, rec.side, rec.snack].filter(Boolean).reduce((a, x) => a + recipeCost(x), 0);
  const dk = rec.drink ? DRINKS[rec.drink] : null, alt = rec.alt ? DRINKS[rec.alt] : null;
  const st = itemStats(), pct = st.n ? Math.round(st.have / st.n * 100) : 0;
  const flat = []; TIPS.forEach(g => g.items.forEach(i => flat.push(i)));
  const tip = flat[Math.floor(rng(todayStr())() * flat.length)];
  const desc = {아침:'아침은 간단하게, 15분 안에 끝나는 메뉴예요.', 점심:'점심은 든든하지만 부담 없는 메뉴예요.', 저녁:'저녁은 헤비하게! 반찬과 간식, 음료까지 한 상으로 골라드려요.', 야식:'야식은 가볍게 한입 거리와 음료로 골랐어요.'}[slot];
  return `
  <div class="hello"><b>${greet}</b><span class="muted">${desc}</span></div>
  <div class="chips">${['아침','점심','저녁','야식'].map(s => `<button class="chip ${s === slot ? 'on' : ''}" data-act="slot" data-v="${s}">${s}</button>`).join('')}</div>
  ${m ? `<button class="rec-main" data-act="open-recipe" data-id="${m.id}"><span class="big">${m.e}</span><span class="grow"><span class="tag">오늘의 ${slot} 메인</span><h3>${esc(m.n)}</h3><span class="muted">${m.time}분 · 난이도 ${stars(m.lv)} · 1인분 약 ${won(recipeCost(m))}</span></span></button>` : ''}
  ${mealLine(slot === '야식' ? '곁들일 한입' : '반찬', rec.side)}
  ${mealLine('간식·안주', rec.snack)}
  ${dk ? `<div class="drink"><span class="lbl">${dk.alc ? '🔞 성인용 음료 추천' : '음료 추천'}</span><br><b>${dk.e} ${esc(dk.n)}</b> <span class="muted">· 약 ${won(dk.price)}</span><br><span class="muted">${esc(dk.why)}</span>${alt ? `<br><span class="muted">무알콜 대안: ${alt.e} ${esc(alt.n)} · 약 ${won(alt.price)}</span>` : ''}${dk.alc ? '<br><span class="muted">술은 적당히, 미성년자는 마시면 안 돼요.</span>' : ''}</div>` : ''}
  <div class="sum"><span>이 한 상 재료비 <span class="muted">(집에 있는 재료 제외)</span></span><b>${won(mainCost)}</b></div>
  <button class="btn ghost block" data-act="shuffle">🔄 다른 메뉴 보기</button>

  <div class="sec-title"><h2>내 자취템 현황</h2><button class="muted" data-tab="items">전체 보기 ›</button></div>
  <div class="card">
    <div class="row between"><b>${st.have} / ${st.n}개 준비</b><span class="muted">${pct}%</span></div>
    <div class="bar" style="margin-top:8px"><i style="width:${pct}%"></i></div>
    <div class="stat-grid">
      <div class="stat"><div class="muted">구매 예정</div><div class="v">${won(st.plan)}</div></div>
      <div class="stat"><div class="muted">앞으로 필요한 금액</div><div class="v">${won(st.left)}</div></div>
    </div>
  </div>
  <div class="tipbox"><b>💡 오늘의 자취 팁 · ${esc(tip.t)}</b><br>${esc(tip.b)}</div>`;
}

/* ---------- 레시피 ---------- */
const RCATS = ['전체','⭐ 즐겨찾기','아침','저녁','계란','토스트','찌개','김치','닭','라면','떡볶이','국수','밥','고기','반찬','안주'];
function recipeListHtml(){
  let list = RECIPES.slice();
  const c = recUi.cat, q = recUi.q.trim();
  if (c === '⭐ 즐겨찾기') list = list.filter(r => S.fav.includes(r.id));
  else if (c === '아침') list = list.filter(r => r.meals.includes('아침'));
  else if (c === '저녁') list = list.filter(r => r.meals.includes('저녁'));
  else if (c !== '전체') list = list.filter(r => r.cat === c);
  if (q) list = list.filter(r => r.n.includes(q) || r.ing.some(g => g[0].includes(q)));
  if (!list.length) return '<div class="empty">조건에 맞는 레시피가 없어요.</div>';
  return list.map(r => `<button class="ritem" data-act="open-recipe" data-id="${r.id}"><span class="em">${r.e}</span><span class="grow"><h3>${esc(r.n)} ${S.fav.includes(r.id) ? '<span class="fav-on">★</span>' : ''}</h3><span class="meta">${r.cat} · ${r.time}분 · ${stars(r.lv)}<br>${r.meals.join('·')}</span></span><span class="price">${won(recipeCost(r))}</span></button>`).join('');
}
function viewRecipes(){
  return `<div class="search"><input type="search" id="rq" placeholder="요리 이름이나 재료 검색 (예: 계란, 김치)" value="${esc(recUi.q)}"></div>
  <div class="chips">${RCATS.map(c => `<button class="chip ${c === recUi.cat ? 'on' : ''}" data-act="rcat" data-v="${c}">${c}</button>`).join('')}</div>
  <div class="rlist" id="rlist">${recipeListHtml()}</div>
  <p class="note">가격은 1인분 기준, 집에 있는 재료를 뺀 대략적인 추정치예요. 레시피 안에서 직접 고칠 수 있어요.</p>`;
}
function recipeSheetHtml(r, serv){
  const rows = r.ing.map((g, i) => {
    const have = isHave(g[0], g[4]);
    return `<div class="ing ${have ? 'have' : ''}"><input type="checkbox" data-act="have" data-i="${i}" ${have ? 'checked' : ''} aria-label="집에 있음"><div class="nm">${esc(g[0])}<small>${fmtQ(g[1] * serv)}${esc(g[2])}</small></div><input type="number" inputmode="numeric" min="0" step="10" data-act="price" data-i="${i}" value="${ingCost(r, i, serv)}" aria-label="${esc(g[0])} 가격"></div>`;
  }).join('');
  const all = recipeCost(r, serv, false), need = recipeCost(r, serv, true);
  const steps = r.steps.map(s => `<li>${esc(s[0])}${s[1] ? `<br><button class="timer-btn" data-act="timer" data-m="${s[1]}" data-l="${esc(r.n)}">⏱ ${s[1]}분 타이머</button>` : ''}</li>`).join('');
  return `
  <div class="hero-r"><div class="big">${r.e}</div><div class="meta"><span class="tag">${r.cat}</span><span class="tag green">${r.time}분</span><span class="tag blue">난이도 ${stars(r.lv)}</span><span class="tag">${r.meals.join('·')}</span></div></div>
  <div class="row between card">
    <div><b>인분</b><div class="muted">재료량과 가격이 함께 바뀌어요</div></div>
    <div class="stepper"><button data-act="serv" data-d="-1" aria-label="인분 줄이기">−</button><b>${serv}인분</b><button data-act="serv" data-d="1" aria-label="인분 늘리기">+</button></div>
  </div>
  <div class="card">
    <h3>🧺 재료와 예산</h3>
    <div class="muted" style="margin-bottom:6px">체크 = 집에 있음(예산에서 제외). 가격 칸을 눌러 직접 고칠 수 있어요.</div>
    ${rows}
    <div class="total"><span>재료비 전체</span><span>${won(all)}</span></div>
    <div class="total"><span>집에 있는 재료 제외</span><span>${won(need)}</span></div>
    <div class="total big"><span>1인분당</span><span>${won(need / serv)}</span></div>
    <button class="btn block" style="margin-top:12px" data-act="add-shop">🛒 필요한 재료 장보기에 담기</button>
  </div>
  <div class="card"><h3>👩‍🍳 만드는 법</h3><div class="muted" style="margin-bottom:8px">양념 계량은 1인분 기준이에요. 인분을 늘리면 양을 비례해서 늘리세요.</div><ol class="steps">${steps}</ol>
    <div class="tip-r"><b>💡 팁</b><br>${esc(r.tip)}</div></div>
  <p class="note">가격은 2026년 하반기 마트 기준 대략적인 추정치예요(계란 한 판 약 7천원대 기준). 사는 곳에 따라 달라서, 직접 고친 값이 저장돼요.</p>`;
}

/* ---------- 자취템 ---------- */
function viewItems(){
  const st = itemStats(), pct = st.n ? Math.round(st.have / st.n * 100) : 0;
  const list = S.items.filter(x => !itemTier || x.tier === itemTier);
  const cats = CATS.concat(['기타']);
  const groups = cats.map(c => {
    const arr = list.filter(x => x.cat === c); if (!arr.length) return '';
    const done = arr.filter(x => x.st === 'have').length, sub = arr.reduce((a, x) => a + (+x.p || 0), 0);
    const rows = arr.slice().sort((a, b) => a.tier - b.tier || (b.star - a.star)).map(x => {
      const ico = x.st === 'have' ? '✅' : x.st === 'plan' ? '🛒' : '⬜';
      return `<div class="it ${x.st === 'have' ? 'done' : ''}"><button class="st ${x.st}" data-act="st" data-id="${x.id}" aria-label="상태 변경">${ico}</button>
        <button class="nm" data-act="edit-item" data-id="${x.id}"><b>${x.star ? '⭐ ' : ''}${esc(x.n)}</b><small>${itemTier ? '' : TIERS[x.tier] + ' · '}${x.memo ? esc(x.memo) : '탭해서 수정'}</small></button><span class="pr">${won(x.p)}</span></div>`;
    }).join('');
    return `<details class="cat" data-cat="${c}" ${openCats.has(c) ? 'open' : ''}><summary><span>${CAT_EMOJI[c] || '📦'}</span><span class="grow">${c}<small>${done}/${arr.length}개 · 합계 ${won(sub)}</small></span><span class="muted">▾</span></summary>${rows}</details>`;
  }).join('');
  return `
  <div class="card sumcard">
    <div class="muted">전체 예산 합계</div><div class="big-num">${won(st.total)}</div>
    <div class="row between" style="margin-top:8px"><b>${st.have} / ${st.n}개 준비</b><span class="muted">${pct}%</span></div>
    <div class="bar" style="margin-top:6px"><i style="width:${pct}%"></i></div>
    <div class="stat-grid">
      <div class="stat"><div class="muted">구매 예정 합계</div><div class="v">${won(st.plan)}</div></div>
      <div class="stat"><div class="muted">구매·보유 완료</div><div class="v">${won(st.haveSum)}</div></div>
      <div class="stat"><div class="muted">앞으로 필요</div><div class="v">${won(st.left)}</div></div>
      <div class="stat"><div class="muted">1단계만 사면</div><div class="v">${won(st.tier[1])}</div></div>
    </div>
    <p class="note" style="margin-bottom:0">⬜ 구매 전 → 🛒 구매 예정 → ✅ 보유 순으로 아이콘을 눌러 바꿔요. ⭐은 첫날 없으면 곤란한 것이에요.</p>
  </div>
  <div class="chips"><button class="chip ${!itemTier ? 'on' : ''}" data-act="tier" data-v="0">전체</button>${[1,2,3,4].map(t => `<button class="chip ${itemTier === t ? 'on' : ''}" data-act="tier" data-v="${t}">${t}단계 · ${TIERS[t]}</button>`).join('')}</div>
  ${itemTier ? `<p class="muted" style="margin:0 2px 8px">${TIERS[itemTier]} 합계: <b>${won(st.tier[itemTier])}</b></p>` : ''}
  ${groups || '<div class="empty">항목이 없어요. 아래 + 버튼으로 추가하세요.</div>'}
  <button class="fab" data-act="new-item" aria-label="자취템 추가">+</button>`;
}
function itemFormHtml(x){
  const isNew = !x.id;
  return `
  <label class="fld">이름<input type="text" id="f-n" value="${esc(x.n || '')}" maxlength="40" placeholder="예: 전기장판"></label>
  <label class="fld">분류<select id="f-cat">${CATS.concat(['기타']).map(c => `<option ${c === x.cat ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
  <label class="fld">단계<select id="f-tier">${[1,2,3,4].map(t => `<option value="${t}" ${t === x.tier ? 'selected' : ''}>${t}단계 · ${TIERS[t]}</option>`).join('')}</select></label>
  <label class="fld">예상 가격(원)<input type="number" inputmode="numeric" id="f-p" min="0" step="100" value="${x.p || 0}"></label>
  <label class="fld">메모<input type="text" id="f-memo" value="${esc(x.memo || '')}" maxlength="60" placeholder="예: 소형 / 중고로"></label>
  <div class="sw"><span>⭐ 첫날 없으면 곤란한 필수템</span><input type="checkbox" id="f-star" ${x.star ? 'checked' : ''}></div>
  <div class="row" style="margin-top:16px"><button class="btn grow" data-act="save-item">저장</button>${isNew ? '' : '<button class="btn danger" data-act="del-item" data-armed="0">삭제</button>'}</div>`;
}

/* ---------- 장보기 ---------- */
function viewShop(){
  const food = S.shop, plan = S.items.filter(x => x.st === 'plan');
  const foodLeft = food.filter(x => !x.done).reduce((a, x) => a + (+x.price || 0), 0);
  const foodDone = food.filter(x => x.done).reduce((a, x) => a + (+x.price || 0), 0);
  const planSum = plan.reduce((a, x) => a + (+x.p || 0), 0);
  const foodRows = food.map((x, i) => `<div class="shop-row ${x.done ? 'done' : ''}"><input type="checkbox" data-act="shop-done" data-i="${i}" ${x.done ? 'checked' : ''} aria-label="구매 체크"><div class="nm">${esc(x.name)}<br><span class="muted">${esc(x.src)}</span></div><input type="number" inputmode="numeric" min="0" step="10" data-act="shop-price" data-i="${i}" value="${x.price}" aria-label="가격"><button class="x" data-act="shop-del" data-i="${i}" aria-label="삭제">✕</button></div>`).join('');
  const planRows = plan.map(x => `<div class="shop-row"><input type="checkbox" data-act="plan-done" data-id="${x.id}" aria-label="구매 완료"><div class="nm">${esc(x.n)}<br><span class="muted">${x.cat}</span></div><span class="pr" style="text-align:right;font-weight:700">${won(x.p)}</span><span></span></div>`).join('');
  return `
  <div class="card">
    <div class="muted">이번 장보기 예상 합계</div><div class="big-num">${won(foodLeft + planSum)}</div>
    <div class="stat-grid"><div class="stat"><div class="muted">식재료(남은 것)</div><div class="v">${won(foodLeft)}</div></div><div class="stat"><div class="muted">자취템 구매 예정</div><div class="v">${won(planSum)}</div></div>
    <div class="stat"><div class="muted">식재료 체크 완료</div><div class="v">${won(foodDone)}</div></div></div>
  </div>
  <div class="sec-title"><h2>🥬 식재료</h2><span class="muted">${food.length}개</span></div>
  <div class="card">${foodRows || '<div class="empty">레시피 화면에서 [장보기에 담기]를 눌러 추가하세요.</div>'}
    ${food.length ? `<div class="row" style="margin-top:10px"><button class="btn ghost grow" data-act="shop-clear-done">체크한 것 비우기</button><button class="btn ghost grow" data-act="shop-clear-all">전체 비우기</button></div>` : ''}</div>
  <div class="sec-title"><h2>🛒 자취템 (구매 예정)</h2><span class="muted">${plan.length}개</span></div>
  <div class="card">${planRows || '<div class="empty">자취템 탭에서 아이콘을 눌러 🛒 구매 예정으로 바꾸면 여기에 나와요.</div>'}</div>`;
}

/* ---------- 꿀팁 ---------- */
function viewTips(){
  return TIPS.map(g => `<div class="tgrp"><h2>${g.g}</h2>${g.items.map(i => `<details><summary>${esc(i.t)}</summary><p>${esc(i.b)}</p></details>`).join('')}</div>`).join('')
    + '<p class="note">일반적인 안내예요. 계약·세금·보증 관련 사항은 반드시 공식 기관이나 전문가에게 확인하세요.</p>';
}

/* ---------- 설정 ---------- */
function settingsHtml(){
  return `
  <div class="sw"><span>🍺 저녁·야식에 술 추천 보기<br><span class="muted">끄면 무알콜 음료만 추천해요 (성인용)</span></span><input type="checkbox" data-act="alc" ${S.set.alcohol ? 'checked' : ''}></div>
  <h3 style="margin-top:20px">백업</h3>
  <p class="muted">체크 상태, 수정한 가격, 즐겨찾기를 파일로 저장하고 다시 불러올 수 있어요. 앱 데이터를 지우기 전에 백업하세요.</p>
  <div class="row"><button class="btn ghost grow" data-act="export">내보내기</button><label class="btn ghost grow" style="cursor:pointer">불러오기<input type="file" accept="application/json,.json" data-act="import" hidden></label></div>
  <h3 style="margin-top:20px">초기화</h3>
  <div class="row"><button class="btn ghost grow" data-act="reset-price" data-armed="0">수정한 재료 가격 되돌리기</button></div>
  <div class="row" style="margin-top:10px"><button class="btn danger grow" data-act="reset-all" data-armed="0">모든 데이터 초기화</button></div>
  <p class="note">자취 메이트 · 가격은 2026년 하반기 기준 대략적인 추정치이며 직접 수정할 수 있어요. 데이터는 이 기기에만 저장돼요.</p>`;
}

/* ---------- 렌더링 ---------- */
function render(){
  const v = $('#view');
  v.innerHTML = {home:viewHome, recipes:viewRecipes, items:viewItems, shop:viewShop, tips:viewTips}[tab]();
  $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
}
function setTab(t){ tab = t; render(); window.scrollTo(0, 0); }

/* ---------- 시트 ---------- */
function openSheet(s){
  sheet = s; const el = $('#sheet'); const wasOpen = !el.hidden;
  el.hidden = false; drawSheet();
  if (!wasOpen){ try { history.pushState({sheet:1}, ''); } catch(e){} el.scrollTop = 0; }
}
function drawSheet(){
  if (!sheet) return;
  const body = $('#sheet-body'), title = $('#sheet-title'), keep = $('#sheet').scrollTop;
  if (sheet.type === 'recipe'){ const r = R[sheet.id]; title.textContent = r.n; body.innerHTML = recipeSheetHtml(r, sheet.serv);
    const hb = $('.sheet-head .fav'); if (hb) hb.remove();
    const b = document.createElement('button'); b.className = 'icon-btn fav'; b.dataset.act = 'fav'; b.setAttribute('aria-label', '즐겨찾기');
    b.innerHTML = S.fav.includes(r.id) ? '<span class="fav-on">★</span>' : '☆'; $('.sheet-head').appendChild(b);
  } else {
    const hb = $('.sheet-head .fav'); if (hb) hb.remove();
    if (sheet.type === 'item'){ const x = sheet.id ? S.items.find(i => i.id === sheet.id) : {cat:sheet.cat || '주방', tier:sheet.tier || 1, p:0}; title.textContent = sheet.id ? '자취템 수정' : '자취템 추가'; body.innerHTML = itemFormHtml(x); }
    else { title.textContent = '설정'; body.innerHTML = settingsHtml(); }
  }
  $('#sheet').scrollTop = keep;
}
function hideSheet(){ $('#sheet').hidden = true; sheet = null; render(); }
function closeSheet(){ if (history.state && history.state.sheet) history.back(); else hideSheet(); }
window.addEventListener('popstate', () => { if (!$('#sheet').hidden) hideSheet(); });

/* ---------- 이벤트 ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act],[data-tab]'); if (!t) return;
  if (t.dataset.tab){ setTab(t.dataset.tab); return; }
  const a = t.dataset.act, id = t.dataset.id;
  switch (a){
    case 'open-recipe': openSheet({type:'recipe', id, serv:1}); break;
    case 'slot': homeSlot = t.dataset.v; render(); break;
    case 'shuffle': { recN(homeSlot); S.rec.n[homeSlot] = (S.rec.n[homeSlot] || 0) + 1; save(); render(); break; }
    case 'rcat': recUi.cat = t.dataset.v; render(); break;
    case 'serv': sheet.serv = Math.min(6, Math.max(1, sheet.serv + (+t.dataset.d))); drawSheet(); break;
    case 'fav': { const i = S.fav.indexOf(sheet.id); if (i >= 0) S.fav.splice(i, 1); else S.fav.push(sheet.id); save(); drawSheet(); toast(i >= 0 ? '즐겨찾기에서 뺐어요' : '즐겨찾기에 담았어요'); break; }
    case 'timer': startTimer(+t.dataset.m, t.dataset.l); break;
    case 'stop-timer': stopTimer(); break;
    case 'add-shop': {
      const r = R[sheet.id]; let n = 0;
      r.ing.forEach((g, i) => {
        if (isHave(g[0], g[4]) || g[3] === 0) return;
        const k = r.id + '|' + i; if (S.shop.some(x => x.k === k)) return;
        S.shop.push({k, name:g[0] + ' ' + fmtQ(g[1] * sheet.serv) + g[2], price:ingCost(r, i, sheet.serv), src:r.n, done:false}); n++;
      });
      save(); toast(n ? n + '개 재료를 장보기에 담았어요' : '이미 담았거나 집에 있는 재료예요'); break;
    }
    case 'tier': itemTier = +t.dataset.v; render(); break;
    case 'st': { const x = S.items.find(i => i.id === id); x.st = x.st === 'todo' ? 'plan' : x.st === 'plan' ? 'have' : 'todo'; save(); render(); break; }
    case 'edit-item': openSheet({type:'item', id}); break;
    case 'new-item': openSheet({type:'item', id:null, tier:itemTier || 1}); break;
    case 'save-item': {
      const n = $('#f-n').value.trim(); if (!n){ toast('이름을 입력해주세요'); return; }
      const data = {n, cat:$('#f-cat').value, tier:+$('#f-tier').value, p:Math.max(0, +$('#f-p').value || 0), memo:$('#f-memo').value.trim(), star:$('#f-star').checked};
      if (sheet.id) Object.assign(S.items.find(i => i.id === sheet.id), data);
      else { S.items.push(Object.assign({id:'u' + Date.now(), st:'todo'}, data)); openCats.add(data.cat); }
      save(); toast('저장했어요'); closeSheet(); break;
    }
    case 'del-item': {
      if (t.dataset.armed !== '1'){ t.dataset.armed = '1'; t.textContent = '정말 삭제'; toast('한 번 더 누르면 삭제돼요'); return; }
      S.items = S.items.filter(i => i.id !== sheet.id); save(); toast('삭제했어요'); closeSheet(); break;
    }
    case 'shop-del': S.shop.splice(+t.dataset.i, 1); save(); render(); break;
    case 'shop-clear-done': S.shop = S.shop.filter(x => !x.done); save(); render(); break;
    case 'shop-clear-all': S.shop = []; save(); render(); break;
    case 'settings': openSheet({type:'settings'}); break;
    case 'close-sheet': closeSheet(); break;
    case 'export': {
      const blob = new Blob([JSON.stringify(S, null, 1)], {type:'application/json'});
      const a2 = document.createElement('a'); a2.href = URL.createObjectURL(blob); a2.download = 'jachwi-mate-backup.json';
      document.body.appendChild(a2); a2.click(); setTimeout(() => { URL.revokeObjectURL(a2.href); a2.remove(); }, 500); toast('백업 파일을 저장했어요'); break;
    }
    case 'reset-price': {
      if (t.dataset.armed !== '1'){ t.dataset.armed = '1'; t.textContent = '정말 되돌리기'; return; }
      S.price = {}; save(); toast('가격을 기본값으로 되돌렸어요'); closeSheet(); break;
    }
    case 'reset-all': {
      if (t.dataset.armed !== '1'){ t.dataset.armed = '1'; t.textContent = '정말 전부 지우기'; return; }
      S = fresh(); save(); toast('초기화했어요'); closeSheet(); break;
    }
  }
});

document.addEventListener('change', e => {
  const t = e.target, a = t.dataset && t.dataset.act; if (!a) return;
  if (a === 'have'){ const g = R[sheet.id].ing[+t.dataset.i]; S.have[g[0]] = t.checked; save(); drawSheet(); }
  else if (a === 'price'){
    const r = R[sheet.id], i = +t.dataset.i, v = Math.max(0, +t.value || 0);
    S.price[r.id + '|' + i] = v / sheet.serv; save(); drawSheet();
  }
  else if (a === 'shop-done'){ S.shop[+t.dataset.i].done = t.checked; save(); render(); }
  else if (a === 'shop-price'){ S.shop[+t.dataset.i].price = Math.max(0, +t.value || 0); save(); render(); }
  else if (a === 'plan-done'){ const x = S.items.find(i => i.id === t.dataset.id); x.st = 'have'; save(); toast('구매 완료로 바꿨어요'); render(); }
  else if (a === 'alc'){ S.set.alcohol = t.checked; save(); }
  else if (a === 'import'){
    const f = t.files[0]; if (!f) return; const fr = new FileReader();
    fr.onload = () => { try { const d = JSON.parse(fr.result); if (!d || !Array.isArray(d.items)) throw 0; S = Object.assign(fresh(), d, {set:Object.assign({alcohol:true}, d.set || {})}); save(); toast('백업을 불러왔어요'); closeSheet(); } catch(err){ toast('올바른 백업 파일이 아니에요'); } };
    fr.readAsText(f);
  }
});

document.addEventListener('input', e => {
  if (e.target.id === 'rq'){ recUi.q = e.target.value; $('#rlist').innerHTML = recipeListHtml(); }
});
document.addEventListener('toggle', e => {
  const d = e.target; if (d.classList && d.classList.contains('cat')){ if (d.open) openCats.add(d.dataset.cat); else openCats.delete(d.dataset.cat); }
}, true);

/* ---------- 시작 ---------- */
render();
if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0){
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
})();
