// replay.js — 공개 합성 fixture 재생. 실제 수집과 같은 applySuccess / applyFailure 를 호출합니다.
// 판정은 공식 참조 adapter(adapter-reset.example.js)와 같은 순서로 transport와 payload만 보고 합니다.
// fixture 안의 expected(정답)는 판정에 쓰지 않고, 재생 뒤 "기대 대조"에만 씁니다.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.T04Replay = factory(root.T04Core);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Core) {
'use strict';
const { emptyState, applySuccess, applyFailure, failureKey, kstDate, dayOverDay } = Core;

const PACKAGE_ID = 'aleph-t04-real-information-board-public-contract-v2';

// asset-manifest.json(공개 배포본)에 적힌 SHA-256
const FIXTURES = {
  'T04-NORMAL-D1-A': { file: 'fixtures/normal-d1-a.json', sha256: '14bcc9267f40b4bec2ecb87f2886abbe0536905ef6d398d21ab4041f3410f696' },
  'T04-NORMAL-D1-B': { file: 'fixtures/normal-d1-b.json', sha256: '4a9a688a94acbf8decba59f6f01991121fd03a322364239606f39872bab866b1' },
  'T04-NORMAL-D2':   { file: 'fixtures/normal-d2.json',   sha256: '8194b41d81838446d99611b34343b12b10afcf8a3e7a56d8a5e5ad6f7afc86f4' },
  'T04-TIMEOUT':     { file: 'fixtures/timeout.json',     sha256: '4516eca5129dcce6c43d06d76c37889a9dd27c7d4f70371c63f9d9019db3aceb' },
  'T04-AUTH-401':    { file: 'fixtures/auth-401.json',    sha256: '43137419d6cc220dabb2d2a99e63c369070f8686393d34fd3eea741d0b1ae5fd' },
  'T04-RATE-429':    { file: 'fixtures/rate-429.json',    sha256: '788652bf624f91d00b35843372bc5c6dcc810712a0bf29e16c0f337052c37a11' },
  'T04-OFFLINE':     { file: 'fixtures/offline.json',     sha256: '61760d554088196e2979cfde2509482fc5dfe1f2c5772e92a824ce8dde12446d' },
  'T04-SCHEMA-BREAK':{ file: 'fixtures/schema-break.json',sha256: '21bef6532b1f9a008fcf2f4d97b7330125eaeb5de8414fafde2bb991a1b935ee' },
  'T04-RECOVER-D2':  { file: 'fixtures/recover-d2.json',  sha256: 'fecab12b34fac4d7c053083bad220748fceca88f91e2b5a024907a34e6620b04' },
};

const SEQUENCES = {
  success: ['T04-NORMAL-D1-A', 'T04-NORMAL-D1-B', 'T04-NORMAL-D2'],
  baseline: ['T04-NORMAL-D1-A', 'T04-NORMAL-D1-B'],
  failures: ['T04-TIMEOUT', 'T04-AUTH-401', 'T04-RATE-429', 'T04-OFFLINE', 'T04-SCHEMA-BREAK'],
  recovery: ['T04-NORMAL-D1-A', 'T04-NORMAL-D1-B', 'T04-TIMEOUT', 'T04-RECOVER-D2'],
};

async function sha256Hex(buf) {
  if (!globalThis.crypto || !globalThis.crypto.subtle) return null; // 해시 계산 불가 환경
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const KEYS = ['signal_id', 'normalized_value', 'unit', 'source_name', 'source_url', 'source_time', 'fetched_at', 'record_timezone', 'record_date'];

/** normalized-reading.schema.json 검사 (참조 adapter와 같은 규칙). 통과 못 하면 이유 문자열. */
function invalidReason(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return '정규화 값이 객체가 아님';
  const k = Object.keys(r).sort();
  if (k.length !== KEYS.length || k.some((x, i) => x !== [...KEYS].sort()[i])) return '필드 구성이 다름';
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(r.signal_id)) return 'signal_id 형식';
  if (typeof r.normalized_value !== 'number' || !Number.isFinite(r.normalized_value)) return 'normalized_value가 숫자가 아님';
  if (typeof r.unit !== 'string' || !r.unit.trim()) return 'unit 없음';
  if (typeof r.source_name !== 'string' || !r.source_name.trim()) return 'source_name 없음';
  if (!/^https:\/\//.test(String(r.source_url))) return 'source_url이 https가 아님';
  if (r.source_time !== null && Number.isNaN(new Date(r.source_time).getTime())) return 'source_time 형식';
  if (Number.isNaN(new Date(r.fetched_at).getTime())) return 'fetched_at 형식';
  if (r.record_timezone !== 'Asia/Seoul') return 'record_timezone';
  if (r.record_date !== kstDate(r.fetched_at)) return 'record_date가 fetched_at의 KST 날짜와 다름';
  return null;
}

/** fixture JSON → 재생 입력 (transport와 payload만 사용) */
function interpret(id, fx) {
  if (!fx || !fx.transport) return { kind: 'missing', id, notes: ['fixture 파일 없음'] };
  const t = fx.transport;
  const base = { id, virtual_now: fx.virtual_now, http_status: t.status ?? null, notes: [] };
  const fail = (code, why) => ({ ...base, kind: 'failure', error_code: code, key: failureKey(code), detail: why });
  if (t.mode === 'timeout' || (t.delay_ms ?? 0) > (t.deadline_ms ?? Infinity)) return fail('timeout', `응답 ${t.delay_ms}ms > 제한 ${t.deadline_ms}ms`);
  if (t.mode === 'offline') return fail('offline', '네트워크 없음');
  if (t.status === 401 || t.status === 403) return fail('auth', `HTTP ${t.status}`);
  if (t.status === 429) return fail('rate_limit', `HTTP 429${t.headers && t.headers['retry-after'] ? ` · retry-after ${t.headers['retry-after']}s` : ''}`);
  if (!(t.status >= 200 && t.status < 300)) return fail('schema_error', `HTTP ${t.status}`);
  const why = invalidReason(fx.payload);
  if (why) return fail('schema_error', why);
  const p = fx.payload;
  return {
    ...base, kind: 'success',
    raw: p, // 원자료 (fixture payload)
    reading: {
      signal_id: p.signal_id, record_date: p.record_date, normalized_value: p.normalized_value, unit: p.unit,
      source_url: p.source_url, source_observed_at: p.source_time, retrieved_at: new Date(p.fetched_at).toISOString(), timezone: 'Asia/Seoul',
      source_name: p.source_name, source_time: p.source_time, fetched_at: p.fetched_at, record_timezone: p.record_timezone,
      fixture_id: id,
    },
  };
}

/** 한 fixture 재생 → 새 상태 */
function play(state, id, input) {
  if (input.kind === 'success') return applySuccess(state, input.reading);
  if (input.kind === 'failure') return applyFailure(state, input.error_code, new Date(input.virtual_now).toISOString(), { http_status: input.http_status, detail: `합성 재생 ${id} · ${input.detail}` });
  return state;
}

const resetState = () => emptyState('aleph-demo-index');

/** 재생 뒤 상태가 fixture의 expected와 같은지 (freshness·error_code·행 수·저장값·변화) */
function checkExpected(fx, st) {
  const e = fx && fx.expected;
  if (!e) return null;
  const d = dayOverDay(st.records);
  const delta = d && !d.error ? Math.abs(d.delta) : null;
  const got = {
    freshness: st.status.freshness, error_code: st.status.error_code, row_count: st.records.length,
    stored_value: st.last_good ? st.last_good.normalized_value : null,
    delta,
  };
  const bad = ['freshness', 'error_code', 'row_count', 'stored_value', 'delta'].filter((k) => e[k] !== got[k]);
  if (e.record_date && st.last_good && st.last_good.record_date !== e.record_date) bad.push('record_date');
  return { ok: bad.length === 0, bad, got, expected: e };
}

return { PACKAGE_ID, FIXTURES, SEQUENCES, sha256Hex, interpret, play, resetState, checkExpected, invalidReason };
});
