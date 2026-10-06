// 서버(GitHub Actions)에서 실행: 실제 조회 → 원자료·일별값 저장
// 비밀키·환경변수 없이 동작합니다.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { SIGNAL, fetchLive, applySuccess, applyFailure, emptyState, kstDateTime } = require('../core.js');

const BOARD = new URL('../data/board.json', import.meta.url);
const RAW_DIR = new URL('../data/raw/', import.meta.url);

let state;
try { state = JSON.parse(await readFile(BOARD, 'utf8')); } catch { state = emptyState(); }

// 다른 장소의 기록과 섞이지 않도록 막습니다.
if (state.signal_id !== SIGNAL.signal_id) {
  if (state.records.length > 0) {
    console.error(`중단: data/board.json 에 다른 신호(${state.signal_id}) 기록 ${state.records.length}건이 있습니다.`);
    console.error('장소를 바꿨다면 data/board.json 을 빈 상태로 되돌리고 data/raw/ 의 파일을 지운 뒤 다시 실행하세요.');
    process.exit(1);
  }
  state = emptyState();
}

const result = await fetchLive({ timeoutMs: 15000 });

if (result.ok) {
  const before = state.records.length;
  state = applySuccess(state, result.reading);
  await mkdir(RAW_DIR, { recursive: true });
  await writeFile(new URL(`${result.reading.record_date}.json`, RAW_DIR), JSON.stringify(result.raw, null, 2) + '\n');
  console.log(`성공 ${result.reading.normalized_value}${result.reading.unit} / 기록일 ${result.reading.record_date} / 조회 ${kstDateTime(result.reading.retrieved_at)}`);
  console.log(`일별 행 ${before} -> ${state.records.length}`);
} else {
  state = applyFailure(state, result.error_code, result.retrieved_at, { http_status: result.http_status, detail: result.detail });
  console.log(`실패 ${result.error_code} ${result.http_status ?? ''} - 기존 기록 ${state.records.length}건 유지`);
}

await writeFile(BOARD, JSON.stringify(state, null, 2) + '\n');
