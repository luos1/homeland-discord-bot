#!/bin/bash
# 배포 전 자동 테스트 스크립트

echo "🧪 배포 전 자동 테스트 시작..."
echo ""

FAILED=0

# 1. Syntax 체크
echo "📝 1. Syntax 체크..."
FILES=(
  "src/game/combat.js"
  "src/game/monsters.js"
  "src/handlers/interaction-handler.js"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    if node -c "$file" 2>/dev/null; then
      echo "  ✅ $file"
    else
      echo "  ❌ $file - Syntax Error!"
      FAILED=1
    fi
  fi
done

# combat-patterns.js가 있으면 체크
if [ -f "src/game/combat-patterns.js" ]; then
  echo "  🔍 combat-patterns.js 발견 - 추가 체크"
  
  # getMonsterBySessionName 함수가 export되었는지 확인
  if grep -q "getMonsterBySessionName" src/game/monsters.js; then
    echo "  ✅ getMonsterBySessionName in monsters.js"
  else
    echo "  ❌ getMonsterBySessionName NOT FOUND in monsters.js!"
    FAILED=1
  fi
  
  if node -c "src/game/combat-patterns.js" 2>/dev/null; then
    echo "  ✅ combat-patterns.js syntax OK"
  else
    echo "  ❌ combat-patterns.js syntax ERROR!"
    FAILED=1
  fi
fi

echo ""

# 2. 순환 참조 체크
echo "🔄 2. 순환 참조 체크..."

# combat.js가 combat-patterns.js를 import하는지
if grep -q "require.*combat-patterns" src/game/combat.js 2>/dev/null; then
  echo "  🔍 combat.js → combat-patterns.js import 발견"
  
  # combat-patterns.js가 combat.js를 import하는지
  if [ -f "src/game/combat-patterns.js" ] && grep -q "require.*combat\.js\|require.*\/combat'" src/game/combat-patterns.js 2>/dev/null; then
    echo "  ❌ 순환 참조 발견! (combat.js ↔ combat-patterns.js)"
    FAILED=1
  else
    echo "  ✅ 순환 참조 없음"
  fi
else
  echo "  ✅ combat-patterns.js 없음 (순환 참조 가능성 없음)"
fi

echo ""

# 3. 필수 함수 export 체크
echo "📦 3. Export 체크..."

if [ -f "src/game/combat-patterns.js" ]; then
  # combat-patterns.js가 getMonsterBySessionName을 사용하는지
  if grep -q "getMonsterBySessionName" src/game/combat-patterns.js; then
    echo "  🔍 combat-patterns.js에서 getMonsterBySessionName 사용"
    
    # monsters.js에서 export하는지 확인
    if grep -q "module.exports.*getMonsterBySessionName\|getMonsterBySessionName," src/game/monsters.js; then
      echo "  ✅ monsters.js에서 getMonsterBySessionName export 확인"
    else
      echo "  ❌ monsters.js에서 getMonsterBySessionName export 안 됨!"
      FAILED=1
    fi
  fi
fi

echo ""

# 4. Git 상태 체크
echo "📂 4. Git 상태..."
if git diff --quiet; then
  echo "  ✅ 변경사항 commit됨"
else
  echo "  ⚠️  commit 안 된 변경사항 있음"
  git status -s
fi

echo ""

# 결과
echo "═══════════════════════════════════════"
if [ $FAILED -eq 0 ]; then
  echo "✅ 모든 테스트 통과!"
  echo ""
  echo "다음 단계:"
  echo "1. 로컬에서 실제 Discord 봇 실행 (npm run dev)"
  echo "2. 전투 시스템 수동 테스트"
  echo "3. TEST_CHECKLIST.md 작성"
  echo "4. 형아 승인 받기"
  echo "5. git push origin main"
else
  echo "❌ 테스트 실패!"
  echo ""
  echo "배포 금지! 문제를 먼저 해결하세요."
fi
echo "═══════════════════════════════════════"

exit $FAILED
