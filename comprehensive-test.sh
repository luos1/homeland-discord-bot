#!/bin/bash

# 전체 버그 점검 스크립트

echo "🔍 HOMELAND 전체 점검 시작..."
echo ""

# 1. 코드 품질 점검
echo "1️⃣ 코드 품질 점검"
echo "━━━━━━━━━━━━━━━━━━━━"

# 한글 클래스명 사용 확인
echo "📌 한글 클래스명 사용 확인..."
grep -r "class.*전사\|class.*궁수\|class.*마법사" src/ --include="*.js" | grep -v "CLASS_NAME_MAP\|localizeClassName\|comment" | head -20

echo ""
echo "📌 하드코딩된 클래스 체크..."
grep -r "warrior\|ranger\|sorcerer" src/ --include="*.js" | grep -v "CLASS_NAME_MAP\|SKILLS\|CLASS_PRESETS\|require\|comment" | wc -l

echo ""

# 2. 데이터베이스 일관성
echo "2️⃣ 데이터베이스 일관성"
echo "━━━━━━━━━━━━━━━━━━━━"
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    // 스킬 equipped 체크
    const skills = await prisma.skill.findMany();
    const unequipped = skills.filter(s => !s.equipped);
    console.log(\`📌 장착 안 된 스킬: \${unequipped.length}개\`);
    
    // 클래스 일관성 체크
    const characters = await prisma.character.findMany();
    const invalidClass = characters.filter(c => !['전사', '궁수', '마법사'].includes(c.class));
    console.log(\`📌 잘못된 클래스: \${invalidClass.length}개\`);
    
    // 전직 상태 체크
    const hasAdvanced = characters.filter(c => c.advancedClass);
    console.log(\`📌 전직 캐릭터: \${hasAdvanced.length}개\`);
  } catch (error) {
    console.error('❌ 에러:', error.message);
  } finally {
    await prisma.\$disconnect();
  }
}

check();
"

echo ""

# 3. 버튼 핸들러 체크
echo "3️⃣ 버튼 핸들러 커버리지"
echo "━━━━━━━━━━━━━━━━━━━━"
echo "📌 등록된 버튼 프리픽스..."
grep -h "BUTTON_PREFIX\|_PREFIX" src/**/*.js | grep "const\|export" | sort | uniq

echo ""
echo "📌 핸들러 누락 체크..."
grep -r "setCustomId" src/ --include="*.js" | grep -v "buildCombatCustomId\|build.*CustomId" | wc -l

echo ""

# 4. 에러 핸들링 체크
echo "4️⃣ 에러 핸들링"
echo "━━━━━━━━━━━━━━━━━━━━"
echo "📌 try-catch 없는 async 함수..."
grep -A 50 "async function" src/**/*.js | grep -B 1 "await" | grep -v "try\|catch" | wc -l

echo ""
echo "📌 interaction.reply 에러 체크..."
grep -r "interaction.reply\|interaction.update" src/ --include="*.js" | grep -v "try\|catch\|await" | wc -l

echo ""

# 5. 테스트 커버리지
echo "5️⃣ 테스트 커버리지"
echo "━━━━━━━━━━━━━━━━━━━━"
npm test 2>&1 | tail -10

echo ""
echo "✅ 점검 완료!"
echo ""
echo "📋 다음 단계:"
echo "   1. 발견된 이슈 수정"
echo "   2. 수동 테스트 (Discord UI)"
echo "   3. 배포 전 최종 확인"
