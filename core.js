// core.js — 실제 수집(Node)과 화면(브라우저), 합성 재생이 모두 같이 쓰는 규칙
// 비밀키 없음: Open-Meteo는 키 없이 호출하는 공개 API입니다.
// 일반 <script>와 Node require 둘 다에서 읽히는 형태(UMD)라 파일을 직접 열어도 버튼이 동작합니다.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.T04Core = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
'use strict';

const TZ = 'Asia/Seoul';

const SIGNAL = {
  signal_id: 'daegu-dongseongro-temperature-2m',
  place: '대구 동성로',
  lat: 35.8694,
  lon: 128.5959,
  label: '대구 동성로 부근 현재 기온 (지상 2m)',
  unit: '°C',
  source_name: 'Open-Meteo Forecast API · current.temperature_2m',
  source_url:
    'https://api.open-meteo.com/v1/forecast?latitude=35.8694&longitude=128.5959&current=temperature_2m&timezone=Asia%2FSeoul',
  raw_field: 'current.temperature_2m',
};

// ---------- 시간 ----------
const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

/** 기준 시간대(Asia/Seoul)의 날짜 키 YYYY-MM-DD. 일별 기록의 고유키로 씁니다. */
function kstDate(iso) {
  return dateFmt.format(new Date(iso));
}
function kstDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${dateFmt.format(d)} ${timeFmt.format(d)} KST`;
}
function utcDate(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

// ---------- 정규화 + 형식 검사 ----------
class SchemaError extends Error {
  constructor(msg) { super(msg); this.name = 'SchemaError'; }
}

/** Open-Meteo 원 응답 → 정규화 값. 형식이 기대와 다르면 SchemaError. */
function normalizeOpenMeteo(raw, retrievedAtIso) {
  if (!raw || typeof raw !== 'object') throw new SchemaError('응답이 JSON 객체가 아닙니다');
  const c = raw.current;
  const u = raw.current_units;
  if (!c || typeof c !== 'object') throw new SchemaError('current 필드가 없습니다');
  if (typeof c.temperature_2m !== 'number' || !Number.isFinite(c.temperature_2m))
    throw new SchemaError('current.temperature_2m 이 숫자가 아닙니다');
  if (!u || u.temperature_2m !== '°C') throw new SchemaError('단위가 °C 가 아닙니다');
  if (typeof c.time !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(c.time))
    throw new SchemaError('current.time 형식이 다릅니다');
  if (raw.utc_offset_seconds !== 32400) throw new SchemaError('응답 시간대가 Asia/Seoul(+09:00)이 아닙니다');

  const observed = (c.time.length === 16 ? c.time + ':00' : c.time) + '+09:00';
  return {
    signal_id: SIGNAL.signal_id,
    record_date: kstDate(retrievedAtIso),
    normalized_value: c.temperature_2m,
    unit: '°C',
    source_url: SIGNAL.source_url,
    source_observed_at: observed,
    retrieved_at: retrievedAtIso,
    timezone: TZ,
    // 공식 normalized-reading 형식과 같은 의미의 필드
    source_name: SIGNAL.source_name,
    source_time: observed,
    fetched_at: retrievedAtIso,
    record_timezone: TZ,
  };
}

// ---------- 저장 상태 ----------
function emptyState(signal_id = SIGNAL.signal_id) {
  return {
    signal_id,
    timezone: TZ,
    records: [],
    last_good: null,
    status: { state: 'empty', error_code: 'none', checked_at: null, http_status: null, detail: '' },
  };
}

const clone = (o) => JSON.parse(JSON.stringify(o));

/** 성공: signal_id + record_date 가 같으면 그 행을 갱신, 아니면 새 행. */
function applySuccess(state, reading) {
  const s = clone(state);
  const record_id = `${reading.signal_id}:${reading.record_date}`;
  const idx = s.records.findIndex((r) => r.record_id === record_id);
  const row = { record_id, ...reading };
  if (idx >= 0) {
    row.first_saved_at = s.records[idx].first_saved_at;
    row.success_count = (s.records[idx].success_count || 1) + 1;
    s.records[idx] = row; // 같은 날 → 한 건으로 합침 (마지막 성공값)
  } else {
    row.first_saved_at = reading.retrieved_at;
    row.success_count = 1;
    s.records.push(row);
  }
  s.records.sort((a, b) => a.record_date.localeCompare(b.record_date));
  s.last_good = clone(row);
  s.status = { state: 'fresh', freshness: 'fresh', error_code: 'none', checked_at: reading.retrieved_at, http_status: 200, detail: '' };
  return s;
}

/** 실패: 기록과 마지막 정상값은 그대로 두고 상태만 바꿉니다. */
function applyFailure(state, error_code, checkedAtIso, extra = {}) {
  const s = clone(state);
  s.status = {
    state: s.last_good ? 'stale' : 'error', // 화면용 (정상값이 아예 없으면 error)
    freshness: 'stale',                    // 공식 상태 스키마 값
    error_code,
    checked_at: checkedAtIso,
    http_status: extra.http_status ?? null,
    detail: extra.detail ?? '',
  };
  return s;
}

// ---------- 어제 대비 ----------
const round1 = (n) => Math.round(n * 10) / 10;

/** 날짜순 마지막 두 기록으로 변화값 재계산. 규칙: 오늘값 − 이전값, 소수 첫째 자리 반올림. */
function dayOverDay(records) {
  const rows = [...records].sort((a, b) => a.record_date.localeCompare(b.record_date));
  if (rows.length < 2) return null;
  const prev = rows[rows.length - 2];
  const curr = rows[rows.length - 1];
  if (prev.unit !== curr.unit) return { error: '단위가 달라 비교할 수 없습니다', prev, curr };
  return { prev, curr, delta: round1(curr.normalized_value - prev.normalized_value), unit: curr.unit };
}

function fmtSigned(n) {
  if (n === 0) return '±0.0';
  return (n > 0 ? '+' : '−') + Math.abs(n).toFixed(1);
}

// ---------- 실패 분류 ----------
// 공식 계약(reading-status.schema.json)의 오류 코드: timeout · auth · rate_limit · offline · schema_error
const ERROR_CODES = ['timeout', 'auth', 'rate_limit', 'offline', 'schema_error'];
const FAILURES = {
  timeout: {
    name: '응답 지연',
    what: '원천이 제한 시간 안에 답하지 않아 조회를 중단했습니다.',
    next: '잠시 뒤 다시 시도하세요. 여러 번 반복되면 Open-Meteo 쪽 지연입니다.',
  },
  auth: {
    name: '원천 접근 거절 (401/403)',
    what: '데이터 원천이 이 요청을 거절했습니다. 이 화면의 로그인 문제가 아닙니다.',
    next: '다시 시도해도 같으면 원천의 이용 조건이나 주소가 바뀌었는지 확인해야 합니다.',
  },
  rate_limit: {
    name: '호출 제한 (429)',
    what: '짧은 시간에 너무 많이 호출해 원천이 잠시 막았습니다.',
    next: '몇 분 기다린 뒤 다시 시도하세요. 연속으로 누르면 더 늦어집니다.',
  },
  offline: {
    name: '오프라인',
    what: '네트워크에 연결되지 않아 원천에 닿지 못했습니다.',
    next: '인터넷 연결을 확인한 뒤 다시 시도하세요.',
  },
  schema_error: {
    name: '응답 형식 변경',
    what: '응답은 왔지만 기대한 필드나 형식이 아니어서 값을 믿을 수 없어 버렸습니다.',
    next: '다시 시도해도 같다면 원천이 형식을 바꾼 것입니다. 정규화 코드를 고쳐야 합니다.',
  },
};

/** 오류 코드를 공식 다섯 가지로 맞춥니다 (예전 이름으로 저장된 기록도 읽히게). */
function failureKey(code = '') {
  const c = String(code).toLowerCase();
  if (ERROR_CODES.includes(c)) return c;
  if (c.includes('timeout') || c.includes('slow')) return 'timeout';
  if (c.includes('401') || c.includes('403') || c.includes('auth') || c.includes('forbidden')) return 'auth';
  if (c.includes('429') || c.includes('rate')) return 'rate_limit';
  if (c.includes('offline') || c.includes('network')) return 'offline';
  return 'schema_error';
}

/** 실제 호출. HTTP 상태·시간초과·오프라인·형식 변경을 각각 다른 코드로 돌려줍니다. */
async function fetchLive({ fetchImpl = fetch, timeoutMs = 10000, now = () => new Date().toISOString(), isOffline = () => false } = {}) {
  const retrieved_at = now();
  if (isOffline()) return { ok: false, error_code: 'offline', retrieved_at };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetchImpl(SIGNAL.source_url, { signal: ctrl.signal, cache: 'no-store' });
  } catch (e) {
    clearTimeout(timer);
    if (e && e.name === 'AbortError') return { ok: false, error_code: 'timeout', retrieved_at };
    return { ok: false, error_code: 'offline', retrieved_at, detail: String(e && e.message) };
  }
  clearTimeout(timer);
  if (res.status === 401 || res.status === 403) return { ok: false, error_code: 'auth', http_status: res.status, retrieved_at };
  if (res.status === 429) return { ok: false, error_code: 'rate_limit', http_status: 429, retrieved_at };
  if (!res.ok) return { ok: false, error_code: 'schema_error', http_status: res.status, retrieved_at, detail: `HTTP ${res.status}` }; // 공식 참조 adapter와 같은 분류
  let raw;
  try {
    raw = await res.json();
  } catch {
    return { ok: false, error_code: 'schema_error', http_status: res.status, retrieved_at, detail: 'JSON이 아닙니다' };
  }
  try {
    return { ok: true, raw, reading: normalizeOpenMeteo(raw, retrieved_at) };
  } catch (e) {
    return { ok: false, error_code: 'schema_error', http_status: res.status, retrieved_at, detail: e.message, raw };
  }
}

return {
  TZ, SIGNAL, kstDate, kstDateTime, utcDate, SchemaError, normalizeOpenMeteo,
  emptyState, applySuccess, applyFailure, round1, dayOverDay, fmtSigned,
  ERROR_CODES, FAILURES, failureKey, fetchLive,
};
});
