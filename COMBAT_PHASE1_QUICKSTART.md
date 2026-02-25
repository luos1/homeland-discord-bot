# 🎮 Combat Phase 1 - Quick Start Guide

## 🚀 빠른 시작

### 1. DB 마이그레이션 실행

```bash
cd /Users/sang-junlee/homeland-discord-bot

# Prisma 마이그레이션
npx prisma migrate dev --name combat_phase1_enhancements

# Prisma 클라이언트 재생성
npx prisma generate
```

### 2. 봇 재시작

```bash
# 개발 모드
npm run dev

# 또는 프로덕션 모드
npm start
```

### 3. 테스트

디스코드에서:
```
/play
→ Zone 1 선택 (초보자 숲)
→ 다이어울프 조우
→ 패턴 확인:
  - 턴 1: 견제 공격 (0.7배)
  - 턴 2: 울부짖음 (경고! ⚠️)
  - 턴 3: 맹렬한 돌진 (2배)
```

**방어 테스트:**
- 턴 2에서 경고 확인
- 턴 3에서 "방어" 버튼 클릭
- → "💥 반격 찬스!" 확인
- 턴 4에서 "공격" 클릭
- → "+20% 공격력" 확인

**회피 테스트:**
- 스킬 사용해서 MP 소모
- 몬스터 공격 → 15% 확률로 회피
- → "🔷 마나 10 회복!" 확인

**랜덤 이벤트 테스트:**
- 여러 턴 진행
- 20% 확률로 이벤트 발생:
  - ⚡ 번개 섬광 (몬스터 기절)
  - 🌟 결정적 순간 (크리티컬 확정)
  - 💀 위기일발 (몬스터 2배 공격)
  - 🍀 행운의 순간 (드롭 2배)

---

## 📋 새로운 기능

### 1. 몬스터 패턴 시스템
- 10종 몬스터에 패턴 추가
- 패턴별 공격력/방어력 변화
- 패턴 예고 메시지

### 2. 방어 강화
- 데미지 50% 감소 (기존 55%에서 개선)
- 강공격 패턴 대응 시 → 반격 찬스 버프
- 다음 턴 공격력 +20%

### 3. 회피 강화
- 회피 성공 시 MP 10 회복
- 화려한 연출

### 4. 랜덤 이벤트
- 전투 중 20% 확률로 발생
- 4가지 이벤트 종류

### 5. 전투 UI 개선
- 몬스터 패턴 실시간 표시
- 버프/디버프 표시
- 극적인 전투 로그

---

## 🐛 문제 발생 시

### DB 마이그레이션 오류
```bash
# 스키마 리셋 (주의: 개발 환경에서만!)
npx prisma migrate reset

# 다시 마이그레이션
npx prisma migrate dev
```

### 패턴이 표시되지 않음
- `monsters.js` 확인
- 패턴 데이터가 올바른지 확인

### 이벤트가 발생하지 않음
- 정상입니다! (20% 확률)
- 여러 번 전투 시도

---

## 📞 Support

문제 발생 시:
1. `/Users/sang-junlee/clawd_glsol/PHASE1_IMPLEMENTATION_REPORT.md` 참고
2. `src/game/combat-patterns.js` 모듈 확인
3. 로그 확인: `console.log`

**Status**: ✅ Ready for Testing
