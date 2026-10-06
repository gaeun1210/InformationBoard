#!/usr/bin/env bash
# 저장소 현재 파일 + 전체 Git 기록에서 비밀값처럼 보이는 문자열 검색
# 결과가 "0건"이면 통과. (이 파일 자신은 검색 대상에서 제외)
PAT='(api[_-]?key|apikey|secret|password|passwd|bearer |authorization:|access[_-]?token|ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})'
echo "== 현재 파일 =="
git grep -n -i -E "$PAT" -- . ':!scripts/secret-scan.sh' ':!README.md' ':!SUBMISSION.md' | tee /tmp/scan-now.txt
echo "현재 파일: $(wc -l < /tmp/scan-now.txt)건"
echo "== 전체 Git 기록 =="
git log -p --all -- . ':!scripts/secret-scan.sh' ':!README.md' ':!SUBMISSION.md' | grep -i -E "^\+.*$PAT" | tee /tmp/scan-hist.txt
echo "Git 기록: $(wc -l < /tmp/scan-hist.txt)건"
