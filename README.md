# 동성로 기온 기록판 (T04 오늘의 진짜 정보판)

대구 동성로 부근 현재 기온(지상 2m, °C)을 하루 한 번 기록하고 어제와 비교합니다.
원천이 응답하지 않을 때는 마지막 정상값을 지우지 않고 "오래된 값"으로 표시한 뒤, 실패 종류별 설명과 다음 행동을 보여 줍니다.

## 고른 값

| 항목 | 내용 |
|---|---|
| 값 | Open-Meteo `current.temperature_2m` (모델 기반 현재 기온, 관측소 실측 아님) |
| 단위 | °C |
| 출처 | https://api.open-meteo.com/v1/forecast?latitude=35.8694&longitude=128.5959&current=temperature_2m&timezone=Asia%2FSeoul |
| 출처 시각 | 응답의 `current.time` (+09:00) |
| 조회 시각 | 서버가 받아 온 시각 `retrieved_at` |
| 기준 시간대 | Asia/Seoul — 일별 키 `signal_id + record_date(KST)` |
| 좌표 | 북위 35.8694°, 동경 128.5959° (대구 중구 동성로) |
| 비밀키 | 없음 (키 없이 쓰는 공개 API) |

## 구조

```
index.html · style.css · app.js  공개 심사 화면 (GitHub Pages)
assets/bg-day.jpg · bg-night.jpg  뒷배경 일러스트 (KST 06–17시 낮 / 18–05시 밤)
bgm.js                  코드로 연주하는 배경음악 "맑은 아침" (기본 꺼짐)
core.js                 정규화·형식 검사·저장·실패·어제 대비 (수집·화면·재생이 같이 씀, UMD)
replay.js               공개 합성 fixture 재생 + SHA-256 대조 + README 기대값 대조
scripts/collect.mjs     실제 조회 → data/raw/<날짜>.json, data/board.json 저장
scripts/selftest.mjs    합성값 자체 시험 (node scripts/selftest.mjs)
scripts/secret-scan.sh  비밀값 검색
.github/workflows/collect.yml  수동 실행 수집 (cron 없음)
data/board.json         일별 기록 + 마지막 정상값 + 상태
fixtures/               공개 fixture 9개 (공식 꾸러미 원본, SHA-256 일치)
fixtures-embedded.js    fixture 원문 사본 (파일을 직접 열 때만 사용, 같은 해시 검사)
```

## 규칙

- 같은 KST 날짜에 다시 성공하면 그 행을 갱신합니다(`success_count` 증가). 다음 KST 날짜면 새 행.
- 실패는 기록과 마지막 정상값을 건드리지 않고 `status`만 `stale / error_code`로 바꿉니다.
- 어제 대비 = 날짜순 마지막 행 값 − 바로 앞 행 값, 소수 첫째 자리 반올림.
- 오류 코드(공식 상태 스키마): `timeout` · `auth`(401/403) · `rate_limit`(429) · `offline` · `schema_error`(형식 변경·기타 HTTP 오류).
- fixture 판정은 공식 참조 adapter와 같은 순서로 transport·payload만 보고 하며, fixture 안의 expected는 판정 뒤 대조에만 씁니다.

## 실제 기록 2건 만드는 법

1. 저장소 **Actions → 오늘 값 수집 → Run workflow** (첫날 1번)
2. **다른 KST 날짜에** 같은 방법으로 1번 더
3. 각 날 실행 후 같은 날에는 다시 실행하지 않습니다. 같은 날 재실행은 값을 갱신하므로 이미 제출한 기록과 달라질 수 있습니다.
4. 두 건이 생긴 뒤에는 더 실행하지 않습니다 (세 번째 날이 생기면 어제 대비 기준이 바뀝니다).
