// app.js — 화면. 일반 <script>라서 파일을 직접 열어도 버튼이 동작합니다.
(function () {
  'use strict';
  const C = window.T04Core;
  const R = window.T04Replay;
  if (!C || !R) { document.getElementById('boot-error').hidden = false; return; }

  const $ = (s) => document.querySelector(s);
  const root = document.documentElement;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const shown = (v) => (typeof v === 'number' ? v.toFixed(1) : '—');
  const isFile = location.protocol === 'file:';
  if (isFile) $('#file-notice').hidden = false;

  // ---------- 시간대(배경) : 보는 사람의 현재 KST 시각 ----------
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  let mode = 'auto';
  let periodName = '낮';
  let firstPeriod = true;
  let lastLive = null;
  function kstNowParts() {
    const iso = new Date().toISOString();
    const s = C.kstDateTime(iso); // YYYY-MM-DD HH:mm:ss KST
    const d = new Date(s.slice(0, 10) + 'T00:00:00Z');
    return { date: s.slice(0, 10), hm: s.slice(11, 16), hour: Number(s.slice(11, 13)), wd: WD[d.getUTCDay()] };
  }
  const periodOf = (h) => (h >= 6 && h < 11 ? '아침' : h >= 11 && h < 18 ? '낮' : h >= 18 && h < 21 ? '저녁' : '밤');
  function applyPeriod() {
    const n = kstNowParts();
    const real = periodOf(n.hour);
    const isDay = (x) => x === '아침' || x === '낮';
    // 자동이면 실제 시간대, 낮/밤을 고르면 그쪽으로 맞춘 시간대
    const name = mode === 'auto' ? real : mode === 'day' ? (isDay(real) ? real : '낮') : (isDay(real) ? '밤' : real);
    const p = isDay(name) ? 'day' : 'night';
    const changed = firstPeriod || name !== periodName || root.dataset.period !== p;
    firstPeriod = false;
    periodName = name;
    if (root.dataset.period !== p || !$('#period-icon').innerHTML) $('#period-icon').innerHTML = p === 'day' ? sunIcon(26) : moonIcon(26);
    root.dataset.period = p;
    $('#now').textContent = `${n.date.replace(/-/g, '.')} (${n.wd}) ${n.hm} KST`;
    document.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    if (changed) {
      updateHand();
      const t = document.querySelector('#live .a-today');
      if (t && lastLive) t.outerHTML = todayPanel(lastLive);
      const ic = document.querySelector('#live .a-bubble .icon');
      if (ic) ic.innerHTML = p === 'night' ? moonIcon(96) : sunIcon(96);
    }
  }
  setInterval(applyPeriod, 30000);

  // ---------- 아이콘 ----------
  let icoN = 0;
  function sunIcon(size) { // 한낮의 태양 (A안)
    const k = 'su' + (++icoN);
    return `<svg class="sun-ic" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id="${k}h"><stop offset="0" stop-color="#FFF4C2" stop-opacity=".9"/><stop offset=".45" stop-color="#FFD866" stop-opacity=".35"/><stop offset="1" stop-color="#FFC94A" stop-opacity="0"/></radialGradient>
        <radialGradient id="${k}c" cx=".45" cy=".42"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".45" stop-color="#FFF5C4"/><stop offset=".8" stop-color="#FFD24A"/><stop offset="1" stop-color="#F7A928"/></radialGradient>
      </defs>
      <circle class="halo" cx="50" cy="50" r="48" fill="url(#${k}h)"/>
      <g class="rays" stroke="#FFF2B0" stroke-linecap="round" opacity=".6">
        <line x1="50" y1="6" x2="50" y2="20" stroke-width="1.8"/><line x1="50" y1="80" x2="50" y2="94" stroke-width="1.8"/>
        <line x1="6" y1="50" x2="20" y2="50" stroke-width="1.8"/><line x1="80" y1="50" x2="94" y2="50" stroke-width="1.8"/>
        <line x1="19" y1="19" x2="27" y2="27" stroke-width="1.1"/><line x1="73" y1="73" x2="81" y2="81" stroke-width="1.1"/>
        <line x1="81" y1="19" x2="73" y2="27" stroke-width="1.1"/><line x1="19" y1="81" x2="27" y2="73" stroke-width="1.1"/>
      </g>
      <circle cx="50" cy="50" r="22" fill="url(#${k}c)"/>
    </svg>`;
  }
  function moonIcon(size) { // 빛나는 초승달 + 반짝 별
    const k = 'mo' + (++icoN);
    const spark = (x, y, r, d) => `<path class="spark" style="animation-delay:${d}s;transform-origin:${x}px ${y}px" d="M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r}Z" fill="#FFF3C8"/>`;
    return `<svg class="moon-ic" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id="${k}h"><stop offset="0" stop-color="#E9E3FF" stop-opacity=".75"/><stop offset=".5" stop-color="#B9B0FF" stop-opacity=".25"/><stop offset="1" stop-color="#8F86F0" stop-opacity="0"/></radialGradient>
        <linearGradient id="${k}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#F4F1FF"/><stop offset="1" stop-color="#D9D2FF"/></linearGradient>
        <mask id="${k}m"><circle cx="48" cy="52" r="27" fill="#fff"/><circle cx="62" cy="41" r="21" fill="#000"/></mask>
        <filter id="${k}g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5"/></filter>
      </defs>
      <circle class="halo" cx="48" cy="52" r="46" fill="url(#${k}h)"/>
      <circle cx="48" cy="52" r="27" fill="#E6E0FF" mask="url(#${k}m)" filter="url(#${k}g)" opacity=".9"/>
      <circle cx="48" cy="52" r="27" fill="url(#${k}b)" mask="url(#${k}m)"/>
      ${size >= 40 ? spark(80, 20, 9, 0) + spark(88, 60, 6, -1.2) + spark(16, 22, 5, -0.6) + spark(76, 86, 4.5, -1.8) +
        '<circle class="spark" cx="90" cy="40" r="1.2" fill="#fff" style="animation-delay:-.9s;transform-origin:90px 40px"/><circle class="spark" cx="14" cy="76" r="1.1" fill="#fff" style="animation-delay:-2.1s;transform-origin:14px 76px"/>' : ''}
    </svg>`;
  }
  const labIcon = (size) => `<svg class="lab-ic" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="10" width="44" height="44" rx="10"/><rect x="22" y="22" width="20" height="20" rx="4"/></svg>`;

  const NOTE_OFF = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 17.5a3.5 3.5 0 1 1-2-3.16V5l12-2v11.5a3.5 3.5 0 1 1-2-3.16V7.4L9 8.73z"/></svg>';
  const NOTE_ON = '<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>';
  const vol = $('#bgm-vol');
  if (vol) vol.addEventListener('input', (e) => window.T04Bgm && window.T04Bgm.setVolume(e.target.value / 100));

  // ---------- 탭 ----------
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  function selectTab(tab, focus) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
    history.replaceState(null, '', '#' + tab.id.replace('tab-', ''));
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') selectTab(tabs[(i + 1) % tabs.length], true);
      if (e.key === 'ArrowLeft') selectTab(tabs[(i - 1 + tabs.length) % tabs.length], true);
    });
  });
  const initial = document.getElementById('tab-' + location.hash.slice(1));
  if (initial) selectTab(initial);

  // ---------- 패널 조각 (실제 기록과 재생실이 같이 씀) ----------
  const toneOf = (s) => (['fresh', 'stale', 'error'].includes(s) ? s : 'empty');
  function pill(state) {
    return {
      fresh: '<span class="pill p-fresh">최신</span>',
      stale: '<span class="pill p-stale">오래된 값</span>',
      error: '<span class="pill p-error">값 없음 · 오류</span>',
    }[state] || '<span class="pill p-empty">기록 없음</span>';
  }
  const digits = (txt) => [...txt].map((ch, i) => `<span class="dg" style="--d:${i}">${esc(ch)}</span>`).join('');

  function bubble(st, o) {
    const g = st.last_good;
    let icon = labIcon(64), cap = o.caption || '';
    if (o.real && g) {
      const hour = Number(C.kstDateTime(g.source_observed_at || g.retrieved_at).slice(11, 13));
      const name = periodOf(hour);
      icon = root.dataset.period === 'night' ? moonIcon(96) : sunIcon(96);
      const hm = (iso) => (iso ? C.kstDateTime(iso).slice(11, 16) : '—');
      cap = `출처 ${hm(g.source_observed_at)} · 조회 ${hm(g.retrieved_at)}`;
    } else if (o.real) { icon = root.dataset.period === 'night' ? moonIcon(96) : sunIcon(96); cap = '첫 기록을 기다리는 중'; }
    return `<section class="glass panel a-bubble is-${toneOf(st.status.state)}" style="--i:0">
      <div class="bubble">
        ${pill(st.status.state)}
        <span class="icon">${icon}</span>
        <div class="num" data-value>${g ? digits(shown(g.normalized_value)) : '—'}<span class="u">${esc(g ? g.unit : '')}</span></div>
        <div class="cap">${esc(cap)}</div>
        <div class="mini">
          <div><span>기록 날짜</span><b>${esc(g ? g.record_date.slice(5).replace('-', '.') : '—')}</b></div>
          <div><span>기준 시간대</span><b>KST</b></div>
          <div><span>상태</span><b>${esc(st.status.state)}</b></div>
        </div>
      </div>
    </section>`;
  }

  function statusPanel(st, o) {
    const s = toneOf(st.status.state);
    const g = st.last_good;
    const label = { fresh: '정상 수집', stale: '오래된 값 표시 중', error: '값 없음 · 오류', empty: '기록 없음' }[s];
    let body = '';
    if (s === 'stale' || s === 'error') {
      const f = C.FAILURES[C.failureKey(st.status.error_code)];
      body = `<div class="alert ${s === 'error' ? 'err' : ''}" role="status">
        <h4>${esc(f.name)}</h4>
        <span class="code">error_code ${esc(st.status.error_code)}${st.status.http_status ? ' · HTTP ' + esc(st.status.http_status) : ''} · 실패 ${esc(C.kstDateTime(st.status.checked_at))}</span>
        <p>${esc(f.what)}</p>
        <p><b>다음 행동</b> · ${esc(f.next)}</p>
        ${g ? `<p class="muted">구슬의 숫자는 ${esc(C.kstDateTime(g.retrieved_at))}에 받은 마지막 정상값입니다.</p>` : ''}
        <div class="btns"><button class="btn primary" data-act="${o.retryAct}">${esc(o.retryLabel)}</button></div>
      </div>`;
    } else if (o.extraStatus) body = o.extraStatus;
    return `<section class="glass panel a-status st-${s}" style="--i:3">
      <h3 class="ph"><i class="dot c-blue"></i>데이터 상태</h3>
      <div class="state"><span class="led"></span>${label}</div>
      <svg class="ecg" viewBox="0 0 240 38" preserveAspectRatio="none" aria-hidden="true">
        <path d="${s === 'fresh' ? 'M0 22 H70 L80 22 L88 6 L96 34 L104 14 L112 22 H160 L168 22 L174 12 L180 28 L186 22 H240' : 'M0 22 H240'}"/>
      </svg>
      <div class="small muted">마지막 정상 수집 ${g ? esc(C.kstDateTime(g.retrieved_at)) : '—'}</div>
      ${body}
    </section>`;
  }

  function comparePanel(st) {
    const d = C.dayOverDay(st.records);
    let inner;
    if (d && !d.error) {
      const cls = d.delta > 0 ? 'up' : d.delta < 0 ? 'down' : '';
      const arrow = d.delta > 0 ? '▲' : d.delta < 0 ? '▼' : '■';
      inner = `<div class="cmp">
          <div><div class="lbl">어제 · ${esc(d.prev.record_date.slice(5))}</div><div class="v yday">${shown(d.prev.normalized_value)}${esc(d.unit)}</div></div>
          <div class="arrow-r">→</div>
          <div><div class="lbl">오늘 · ${esc(d.curr.record_date.slice(5))}</div><div class="v tday">${shown(d.curr.normalized_value)}${esc(d.unit)}</div></div>
        </div>
        <div class="delta ${cls}">${arrow} <span data-delta>${C.fmtSigned(d.delta)} ${esc(d.unit)}</span></div>
        <div class="formula">${shown(d.curr.normalized_value)} − ${shown(d.prev.normalized_value)} = ${C.fmtSigned(d.delta)} · 소수 첫째 자리 반올림</div>`;
    } else {
      inner = `<p class="sub" style="margin:0">${d && d.error ? esc(d.error) : '비교할 전날 기록이 아직 없습니다. 다른 KST 날짜에 한 번 더 기록되면 변화가 나타납니다.'}</p>`;
    }
    return `<section class="glass panel a-compare" style="--i:1"><h3 class="ph"><i class="dot c-red"></i>어제와 오늘 비교</h3>${inner}</section>`;
  }

  function scalePanel(st) {
    const d = C.dayOverDay(st.records);
    const pos = (v) => Math.max(0, Math.min(100, ((v + 10) / 50) * 100));
    const inner = d && !d.error
      ? `<div class="track" aria-hidden="true">
          <span class="mark prev" style="--x:${pos(d.prev.normalized_value)}%"></span>
          <span class="mark today" style="--x:${pos(d.curr.normalized_value)}%"></span>
        </div>
        <div class="ticks"><span>−10°</span><span>0°</span><span>10°</span><span>20°</span><span>30°</span><span>40°</span></div>
        <div class="legend"><span><i style="background:#2F6FE0"></i>어제 ${shown(d.prev.normalized_value)}°</span><span><i style="background:#E5432F"></i>오늘 ${shown(d.curr.normalized_value)}°</span></div>`
      : '<p class="sub" style="margin:0">기록이 두 건 모이면 어제와 오늘이 눈금 위에 표시됩니다.</p>';
    return `<section class="glass panel a-scale" style="--i:2"><h3 class="ph"><i class="dot c-amber"></i>온도 눈금</h3>${inner}</section>`;
  }

  // ---------- 문구 : 기온 구간 × 현재 시간대(KST) + 어제 대비 ----------
  const PHRASES = {
    freeze: { 아침: '손끝이 시린 아침이에요. 장갑을 챙겨 보세요', 낮: '한낮에도 공기가 차요. 두꺼운 외투가 필요해요', 저녁: '해가 지니 금세 추워져요. 따뜻한 음료 한 잔 어때요?', 밤: '꽁꽁 언 밤이에요. 귀가길 따뜻하게 하세요' },
    chilly: { 아침: '쌀쌀한 아침이에요. 겉옷을 꼭 챙기세요', 낮: '햇살이 있어도 바람은 차요. 가벼운 코트가 좋아요', 저녁: '저녁 공기가 쌀쌀해요. 목도리가 반가운 날', 밤: '밤바람이 차가워요. 일찍 들어가는 것도 좋아요' },
    cool:   { 아침: '상쾌한 아침이에요. 얇은 겉옷 하나면 충분해요', 낮: '걷기 딱 좋은 선선한 낮이에요', 저녁: '선선한 저녁, 동성로 산책하기 좋아요', 밤: '밤공기가 선선해요. 가디건 하나 챙기세요' },
    mild:   { 아침: '포근하게 시작하는 아침이에요', 낮: '야외 활동하기 좋은 포근한 낮이에요', 저녁: '기분 좋은 저녁이에요. 약속 잡기 좋은 날', 밤: '포근한 밤이에요. 조금 걸어도 좋아요' },
    warm:   { 아침: '아침부터 따뜻해요. 가벼운 옷차림이 좋아요', 낮: '따뜻한 낮이에요. 물 자주 마시세요', 저녁: '따뜻한 저녁, 반팔로도 괜찮아요', 밤: '밤에도 따뜻해요. 창문 열고 쉬기 좋아요' },
    hot:    { 아침: '아침부터 더워요. 대프리카 시작이에요', 낮: '한낮 더위가 강해요. 그늘에서 쉬어 가세요', 저녁: '해가 져도 더워요. 시원한 곳을 찾아보세요', 밤: '열대야 같은 밤이에요. 잠들기 전 시원하게 하세요' },
  };
  const bandOf = (v) => (v < 5 ? 'freeze' : v < 12 ? 'chilly' : v < 18 ? 'cool' : v < 23 ? 'mild' : v < 28 ? 'warm' : 'hot');
  function phraseFor(st) {
    const g = st.last_good;
    if (!g) return null;
    return PHRASES[bandOf(g.normalized_value)][periodName];
  }
  function deltaPhrase(st) {
    const d = C.dayOverDay(st.records);
    if (!d || d.error) return st.last_good ? '내일 한 번 더 기록하면 어제와 비교해 드릴게요' : '';
    const a = Math.abs(d.delta).toFixed(1);
    if (d.delta >= 5) return `어제보다 ${a}°C나 올랐어요. 옷차림을 가볍게 바꿔 보세요`;
    if (d.delta >= 1) return `어제보다 ${a}°C 따뜻해요`;
    if (d.delta > -1) return '어제와 거의 비슷한 기온이에요';
    if (d.delta > -5) return `어제보다 ${a}°C 쌀쌀해요`;
    return `어제보다 ${a}°C나 떨어졌어요. 겉옷 꼭 챙기세요`;
  }
  function todayPanel(st) {
    const p = phraseFor(st);
    const msg = p || '아직 기록이 없어요';
    const sub = p ? deltaPhrase(st) : '저장소 Actions에서 “오늘 값 수집”을 실행하면 첫 기록이 생깁니다.';
    const stale = st.status.state === 'stale' || st.status.state === 'error'
      ? '<p class="today-stale">지금은 새 값을 받지 못해 마지막 기록을 보여 드리고 있어요</p>' : '';
    return `<section class="glass panel a-today" style="--i:4"><h3 class="ph"><i class="dot c-green"></i>오늘의 기록<span class="tag">${esc(periodName)} · ${p ? shown(st.last_good.normalized_value) + '°C 기준' : '기록 대기'}</span></h3>
      <p class="today-msg">${esc(msg)}</p><p class="today-sub">${esc(sub)}</p>${stale}</section>`;
  }
  function updateHand() {
    $('#hand').textContent = '오늘, 동성로의 기온'; // 낮·밤 공통 제목
  }

  function snapPanel(st, o) {
    const g = st.last_good;
    return `<section class="glass panel a-snap" style="--i:5">
      <h3 class="ph"><i class="dot c-violet"></i>데이터 스냅샷${g ? `<span class="tag">SNAP-${esc(g.record_date.replace(/-/g, ''))}</span>` : ''}</h3>
      <dl class="meta">
        <dt>값</dt><dd>${g ? shown(g.normalized_value) : '—'}</dd>
        <dt>단위</dt><dd>${esc(g ? g.unit : '—')}</dd>
        <dt>출처</dt><dd>${!g ? '—' : /^https:\/\//.test(g.source_url) && !/\.invalid\//.test(g.source_url) ? `<a href="${esc(g.source_url)}" target="_blank" rel="noopener">${esc(g.source_name || o.sourceName)}</a>` : esc(g.source_name || o.sourceName)}${g ? `<small>${esc(g.source_url)}</small>` : ''}</dd>
        <dt>출처 시각</dt><dd>${!g ? '—' : g.source_observed_at ? esc(C.kstDateTime(g.source_observed_at)) : '없음'}<small>${g && !g.source_observed_at ? '원천이 이번 응답에 시각을 주지 않음' : '원천이 이 값을 낸 시각'}</small></dd>
        <dt>조회 시각</dt><dd>${g ? esc(C.kstDateTime(g.retrieved_at)) : '—'}<small>우리가 받아 온 시각</small></dd>
        <dt>기준 시간대</dt><dd>Asia/Seoul (UTC+09:00)</dd>
        <dt>기록 날짜</dt><dd>${esc(g ? g.record_date : '—')}</dd>
        <dt>상태</dt><dd>${esc(st.status.state)} / ${esc(st.status.error_code)}</dd>
      </dl>
    </section>`;
  }

  function sourcePanel() {
    return `<section class="glass panel a-source" style="--i:7">
      <h3 class="ph"><i class="dot c-blue"></i>데이터 출처</h3>
      <a class="src-name" href="${esc(C.SIGNAL.source_url)}" target="_blank" rel="noopener">Open-Meteo</a>
      <div class="small muted">current.temperature_2m · 모델 기반 현재 기온 · 비밀키 없음</div>
      <span class="src-url">${esc(C.SIGNAL.source_url)}</span>
    </section>`;
  }

  // ---------- 실제 기록 ----------
  async function loadLive() {
    let st, loadErr = null;
    try {
      const res = await fetch('data/board.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      st = await res.json();
    } catch (e) {
      loadErr = isFile ? '파일을 직접 열어서 읽을 수 없습니다' : (e.message || '네트워크 오류');
      st = lastLive || C.emptyState();
    }
    lastLive = st;
    updateHand();
    let extraStatus = '<div class="btns" style="margin-top:12px"><button class="btn" data-act="live-reload">다시 불러오기</button></div>';
    if (loadErr) {
      extraStatus = `<div class="alert err"><h4>기록 파일을 불러오지 못했습니다</h4><p>${esc(loadErr)}. 연결을 확인한 뒤 다시 불러오세요. 이미 받은 값이 있으면 그대로 보여 줍니다.</p><div class="btns"><button class="btn primary" data-act="live-reload">다시 불러오기</button></div></div>`;
    }
    const o = { real: true, sourceName: 'Open-Meteo 예보 API', retryLabel: '다시 불러오기', retryAct: 'live-reload', extraStatus };
    $('#live').innerHTML =
      bubble(st, o) + comparePanel(st) + scalePanel(st) + statusPanel(st, o) + todayPanel(st) + snapPanel(st, o) +
      `<section class="glass panel a-rows" style="--i:6"><h3 class="ph"><i class="dot c-amber"></i>일별 기록<span class="tag">줄을 누르면 원자료 대조</span></h3><div id="rows"></div></section>` +
      sourcePanel();
    await renderRows(st);
  }

  async function renderRows(st) {
    if (!st.records.length) { $('#rows').innerHTML = '<div class="empty">기록 0건 · Asia/Seoul 날짜마다 한 줄씩 쌓입니다</div>'; return; }
    const items = await Promise.all([...st.records].reverse().map(async (r, idx) => {
      let raw = null;
      try { const res = await fetch(`data/raw/${r.record_date}.json`, { cache: 'no-store' }); if (res.ok) raw = await res.json(); } catch (e) {}
      const rawVal = raw && raw.current ? raw.current.temperature_2m : undefined;
      const screen = shown(r.normalized_value);
      const same = typeof rawVal === 'number' && rawVal === r.normalized_value && rawVal.toFixed(1) === screen;
      const hm = (iso) => C.kstDateTime(iso).slice(11, 16);
      return `<details class="rec" style="--i:${idx}">
        <summary>
          <span class="d">${esc(r.record_date)}</span>
          <span class="v">${screen} ${esc(r.unit)}</span>
          <span class="small muted times">출처 ${hm(r.source_observed_at)} · 조회 ${hm(r.retrieved_at)} KST</span>
          <span class="chk ${same ? 'ok' : 'bad'}">${same ? '원자료 일치' : '원자료 불일치'}</span>
        </summary>
        <div class="rec-body">
          <div class="trio">
            <div><span>원자료 ${esc(C.SIGNAL.raw_field)}</span><b>${rawVal ?? '없음'}</b></div>
            <div><span>저장값 normalized_value</span><b>${r.normalized_value}</b></div>
            <div><span>화면값</span><b>${screen}</b></div>
          </div>
          <dl class="meta">
            <dt>record_id</dt><dd>${esc(r.record_id)}</dd>
            <dt>source_url</dt><dd><a href="${esc(r.source_url)}" target="_blank" rel="noopener">${esc(r.source_url)}</a></dd>
            <dt>source_observed_at</dt><dd>${esc(r.source_observed_at)}<small>${esc(C.kstDateTime(r.source_observed_at))}</small></dd>
            <dt>retrieved_at</dt><dd>${esc(r.retrieved_at)}<small>${esc(C.kstDateTime(r.retrieved_at))}</small></dd>
            <dt>unit</dt><dd>${esc(r.unit)}</dd>
            <dt>같은 날 성공 횟수</dt><dd>${r.success_count}</dd>
          </dl>
          ${raw ? `<pre>${esc(JSON.stringify(raw, null, 2))}</pre>` : '<p class="small muted">원자료 파일을 읽지 못했습니다.</p>'}
        </div>
      </details>`;
    }));
    $('#rows').innerHTML = items.join('');
  }

  // ---------- 장애 재생실 ----------
  const inputs = {}, hashInfo = {}, fxJson = {};
  for (const id of Object.keys(R.FIXTURES)) inputs[id] = R.interpret(id, null);
  let lab = R.resetState();
  let log = ['초기화 → 행 0'];

  async function loadFixtures() {
    const copies = window.T04FixtureCopies || {};
    await Promise.all(Object.entries(R.FIXTURES).map(async ([id, spec]) => {
      let text = null, from = 'file';
      try {
        const res = await fetch(spec.file, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        text = new TextDecoder().decode(await res.arrayBuffer());
      } catch (e) {
        if (copies[id]) { text = copies[id]; from = 'copy'; }
      }
      if (text === null) { hashInfo[id] = { status: 'missing', actual: null, from }; return; }
      const actual = await R.sha256Hex(new TextEncoder().encode(text));
      hashInfo[id] = { status: actual === null ? 'nohash' : actual === spec.sha256 ? 'match' : 'mismatch', actual, from };
      try { fxJson[id] = JSON.parse(text); inputs[id] = R.interpret(id, fxJson[id]); } catch (e) { hashInfo[id].status = 'mismatch'; }
    }));
    renderPkg();
  }
  function judged(inp) { return inp.kind === 'success' ? 'fresh / none' : inp.kind === 'failure' ? 'stale / ' + inp.error_code : '—'; }
  function renderPkg() {
    const label = { match: '<span class="ok">일치</span>', mismatch: '<span class="bad">불일치</span>', missing: '<span class="bad">파일 없음</span>', nohash: '<span class="bad">계산 불가</span>' };
    const rows = Object.entries(R.FIXTURES).map(([id, s]) => {
      const h = hashInfo[id] || { status: 'missing' };
      const inp = inputs[id], e = fxJson[id] && fxJson[id].expected;
      const exp = e ? `${e.freshness} / ${e.error_code}` : '—';
      const good = e && judged(inp) === exp;
      return `<tr><td><b>${id}</b></td><td>${esc(s.file)}${h.from === 'copy' ? '<br><span class="small muted">내장 사본</span>' : ''}</td><td title="${esc(h.actual || '')}">${s.sha256.slice(0, 12)}…</td><td>${label[h.status]}</td>
        <td>${esc(judged(inp))}${inp.detail ? `<br><span class="small muted">${esc(inp.detail)}</span>` : ''}</td><td>${esc(exp)}</td><td>${e ? (good ? '<span class="ok">일치</span>' : '<span class="bad">다름</span>') : '—'}</td></tr>`;
    }).join('');
    $('#pkg').innerHTML = `<p class="sub">package ID <b>${R.PACKAGE_ID}</b> · 파일 SHA-256을 브라우저에서 직접 계산해 asset-manifest 값과 비교합니다. 판정은 transport와 payload만 보고 하며, fixture의 expected는 판정 뒤 대조에만 씁니다.</p>
      <div class="scroll"><table><thead><tr><th>fixture</th><th>파일</th><th>manifest SHA-256</th><th>해시 대조</th><th>이 앱의 판정</th><th>fixture expected</th><th>대조</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function step(id) {
    const before = lab.records.length;
    if (inputs[id].kind === 'missing') { log.push(`${id} → fixture 파일을 읽지 못해 재생하지 않음`); return; }
    lab = R.play(lab, id, inputs[id]);
    const c = R.checkExpected(fxJson[id], lab);
    log.push(`${id} → ${lab.status.freshness} / ${lab.status.error_code} · 행 ${before}→${lab.records.length} · 마지막 정상값 ${lab.last_good ? shown(lab.last_good.normalized_value) : '없음'}${c ? (c.ok ? ' · expected 일치' : ' · expected 다름: ' + c.bad.join(',')) : ''}`);
  }
  function reset() { lab = R.resetState(); log = ['초기화 → 행 0']; }
  function labTrio() {
    const g = lab.last_good;
    if (!g || !g.fixture_id || !fxJson[g.fixture_id]) return '';
    const raw = fxJson[g.fixture_id].payload.normalized_value;
    const same = raw === g.normalized_value && String(raw) === String(g.normalized_value);
    return `<section class="glass panel a-trio" style="--i:2"><h3 class="ph"><i class="dot c-green"></i>원자료 · 저장값 · 화면값<span class="tag">${esc(g.fixture_id)}</span></h3>
      <div class="trio"><div><span>원자료 payload</span><b>${raw}</b></div><div><span>저장값</span><b>${g.normalized_value}</b></div><div><span>화면값</span><b>${shown(g.normalized_value)}</b></div></div>
      <span class="chk ${same ? 'ok' : 'bad'}">${same ? '일치' : '불일치'}</span></section>`;
  }
  function renderLab() {
    const o = { real: false, caption: '합성 신호 · 실제 값 아님', sourceName: 'ALEPH 결정론 replay', retryLabel: '다시 시도 (T04-RECOVER-D2 재생)', retryAct: 'lab-retry' };
    $('#lab-view').innerHTML = bubble(lab, o) + statusPanel(lab, o) + comparePanel(lab) + snapPanel(lab, o) + labTrio();
    $('#lab-rows').innerHTML = lab.records.length
      ? `<table><thead><tr><th>record_id</th><th>기록 날짜</th><th>값</th><th>성공 횟수</th></tr></thead><tbody>${lab.records.map((r) => `<tr><td>${esc(r.record_id)}</td><td>${esc(r.record_date)}</td><td>${shown(r.normalized_value)} ${esc(r.unit)}</td><td>${r.success_count}</td></tr>`).join('')}</tbody></table>`
      : '<div class="empty">합성 행 0건 · 위 버튼으로 재생을 시작하세요</div>';
    $('#lab-log').innerHTML = log.slice(-12).map((l) => `<li>${esc(l)}</li>`).join('');
  }
  const failNames = { 'T04-TIMEOUT': '느린 응답', 'T04-AUTH-401': '원천 401 거절', 'T04-RATE-429': '호출 제한 429', 'T04-OFFLINE': '오프라인', 'T04-SCHEMA-BREAK': '형식 변경' };
  $('#fail-buttons').innerHTML = R.SEQUENCES.failures.map((id) => `<button class="btn" data-fail="${id}">${failNames[id]}</button>`).join('');
  $('#one-buttons').innerHTML = Object.keys(R.FIXTURES).map((id) => `<button class="btn" data-one="${id}">${id.replace('T04-', '')}</button>`).join('');

  // ---------- 하루 한 줄 ----------
  function dayTest() {
    const times = [['2026-08-24T00:00:00Z', 20.0], ['2026-08-24T09:00:00Z', 22.0], ['2026-08-24T14:59:30Z', 21.0], ['2026-08-24T15:00:10Z', 19.0]];
    let s = C.emptyState('day-key-test');
    const out = [`<tr style="--i:0"><td>시작</td><td>—</td><td>—</td><td>—</td><td>${s.records.length}</td></tr>`];
    times.forEach(([iso, v], i) => {
      s = C.applySuccess(s, { signal_id: 'day-key-test', record_date: C.kstDate(iso), normalized_value: v, unit: 'pt', source_url: 'synthetic', source_observed_at: iso, retrieved_at: iso, timezone: 'Asia/Seoul' });
      out.push(`<tr style="--i:${i + 1}"><td>${i + 1}번째 성공</td><td>${esc(C.kstDateTime(iso))}</td><td>${C.utcDate(iso)}</td><td><b>${C.kstDate(iso)}</b></td><td><b>${s.records.length}</b></td></tr>`);
    });
    const pass = s.records.length === 2 && s.records[0].success_count === 3;
    $('#day-out').innerHTML = `<table><thead><tr><th>실행</th><th>합성 시각 (KST)</th><th>UTC 날짜</th><th>KST 날짜 키</th><th>일별 행 수</th></tr></thead><tbody>${out.join('')}</tbody></table>
      <p class="${pass ? 'ok' : 'bad'}" style="margin-top:12px">${pass ? '통과 · 같은 날 세 번은 1행으로 합쳐지고(성공 3회), 다음 날은 새 행 — 행 수 0 → 1 → 1 → 1 → 2' : '실패'}</p>`;
  }

  // ---------- 버튼 한 곳에서 처리 ----------
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const act = b.dataset.act;
    if (b.dataset.mode) { mode = b.dataset.mode; applyPeriod(); return; }
    if (b.id === 'bgm') {
      const M = window.T04Bgm;
      if (!M) return;
      if (M.isPlaying()) M.stop(); else M.start();
      const on = M.isPlaying();
      b.setAttribute('aria-pressed', String(on));
      b.innerHTML = on ? NOTE_ON + '<span>음악 끄기</span>' : NOTE_OFF + '<span>음악 켜기</span>';
      $('#bgm-vol').hidden = !on;
      return;
    }
    if (act === 'live-reload') { loadLive(); return; }
    if (b.id === 'day-test') { dayTest(); return; }
    if (b.dataset.seq) {
      reset();
      for (const id of R.SEQUENCES[b.dataset.seq]) if (id !== 'T04-RECOVER-D2') step(id);
    } else if (b.dataset.fail) {
      reset();
      R.SEQUENCES.baseline.forEach(step);
      step(b.dataset.fail);
    } else if (b.dataset.one) step(b.dataset.one);
    else if (act === 'lab-retry') step('T04-RECOVER-D2');
    else if (act === 'reset') reset();
    else return;
    renderLab();
  });

  applyPeriod();
  renderPkg();
  renderLab();
  loadLive();
  loadFixtures().then(renderLab);
})();
