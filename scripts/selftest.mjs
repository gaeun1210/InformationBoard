// node scripts/selftest.mjs — 저장·실패·회복·날짜키 규칙을 합성값으로 점검
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { applySuccess, emptyState, dayOverDay, kstDate, utcDate, normalizeOpenMeteo, SchemaError, fetchLive } = require('../core.js');
const { interpret, play, resetState, SEQUENCES, checkExpected, FIXTURES } = require('../replay.js');

let n = 0; const ok = (m) => { n++; console.log(`  ✓ ${m}`); };

// 하루 한 줄: 같은 KST 날짜 3번 + 다음 날 1번 (자정 경계 포함)
const r = (iso, v) => ({ signal_id: 's', record_date: kstDate(iso), normalized_value: v, unit: '°C', source_url: 'x', source_observed_at: iso, retrieved_at: iso, timezone: 'Asia/Seoul' });
let s = emptyState('s');
const counts = [s.records.length];
for (const [iso, v] of [['2026-08-24T00:00:00Z', 20], ['2026-08-24T09:00:00Z', 22], ['2026-08-24T14:59:30Z', 21], ['2026-08-24T15:00:10Z', 19]]) {
  s = applySuccess(s, r(iso, v)); counts.push(s.records.length);
}
assert.deepEqual(counts, [0, 1, 1, 1, 2]); ok('같은 날 3번 → 1행, 다음 날 → 2행');
assert.equal(utcDate('2026-08-24T15:00:10Z'), '2026-08-24'); assert.equal(kstDate('2026-08-24T15:00:10Z'), '2026-08-25'); ok('UTC 날짜가 아닌 KST 날짜로 키 생성');
assert.equal(s.records[0].success_count, 3); assert.equal(s.records[0].normalized_value, 21); ok('같은 날 마지막 성공값으로 갱신');
assert.deepEqual(dayOverDay(s.records).delta, -2); ok('어제 대비 = 19 − 21 = −2');

// 정규화·형식 검사
const good = { utc_offset_seconds: 32400, current_units: { time: 'iso8601', temperature_2m: '°C' }, current: { time: '2026-09-27T16:45', interval: 900, temperature_2m: 21.3 } };
const nr = normalizeOpenMeteo(good, '2026-09-27T07:50:00Z');
assert.equal(nr.normalized_value, 21.3); assert.equal(nr.source_observed_at, '2026-09-27T16:45:00+09:00'); assert.equal(nr.record_date, '2026-09-27'); ok('원자료 21.3 → 저장값 21.3');
assert.throws(() => normalizeOpenMeteo({ ...good, current: { time: 'x', temp: 1 } }, 'x'), SchemaError); ok('형식 변경 감지');

// fetchLive 분류 (가짜 fetch)
const mk = (status, body) => async () => ({ status, ok: status < 300, json: async () => body });
assert.equal((await fetchLive({ fetchImpl: mk(401) })).error_code, 'auth');
assert.equal((await fetchLive({ fetchImpl: mk(403) })).error_code, 'auth');
assert.equal((await fetchLive({ fetchImpl: mk(429) })).error_code, 'rate_limit');
assert.equal((await fetchLive({ fetchImpl: mk(200, { hello: 1 }) })).error_code, 'schema_error');
assert.equal((await fetchLive({ isOffline: () => true })).error_code, 'offline');
assert.equal((await fetchLive({ fetchImpl: async () => { throw new TypeError('Failed to fetch'); } })).error_code, 'offline');
const slow = (u, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(Object.assign(new Error('a'), { name: 'AbortError' }))));
assert.equal((await fetchLive({ fetchImpl: slow, timeoutMs: 30 })).error_code, 'timeout');
ok('실제 호출 경로의 실패 5종이 서로 다른 코드');

// 공식 fixture 9개로 재생 (판정은 transport/payload만, expected는 대조에만)
import { readFileSync } from 'node:fs';
const FX = {};
for (const [id, spec] of Object.entries(FIXTURES)) FX[id] = JSON.parse(readFileSync(new URL('../' + spec.file, import.meta.url), 'utf8'));
const runSeq = (seq) => { let st = resetState(); for (const id of seq) { st = play(st, id, interpret(id, FX[id])); const c = checkExpected(FX[id], st); assert.ok(c.ok, `${id} expected 다름: ${c.bad}`); } return st; };
let t = runSeq(SEQUENCES.success);
assert.equal(t.records.length, 2); assert.equal(Math.abs(dayOverDay(t.records).delta), 15); ok('정상 D1-A→D1-B→D2: 2행, 변화 15, expected 일치');
const codes = [];
for (const f of SEQUENCES.failures) {
  const u = runSeq([...SEQUENCES.baseline, f]);
  assert.equal(u.status.freshness, 'stale'); assert.equal(u.last_good.normalized_value, 105); assert.equal(u.records.length, 1);
  codes.push(u.status.error_code);
}
assert.deepEqual(codes, ['timeout', 'auth', 'rate_limit', 'offline', 'schema_error']); ok('실패 5종: stale · 공식 코드 5개 · 마지막 정상값 105 · 행 1건');
const v = runSeq(SEQUENCES.recovery);
assert.equal(v.status.freshness, 'fresh'); assert.equal(v.status.error_code, 'none'); assert.equal(v.records.length, 2);
assert.equal(v.records[1].record_date, '2026-08-25'); assert.equal(v.records[1].normalized_value, 120); ok('복구: fresh/none, 2행, 2026-08-25 신규 1건, 120');
console.log(`\n모두 통과 (${n}항목)`);
