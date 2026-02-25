# 🚀 Phase 1 - 빠른 시작 가이드

**3분 안에 배포 시작하기**

---

## ⚡ 빠른 배포 (3단계)

### 1️⃣ 데이터베이스 마이그레이션
```bash
cd /Users/sang-junlee/homeland-discord-bot
psql -U your_user -d homeland_db -f migrations/add_spin_system.sql
npx prisma generate
```

### 2️⃣ 서버 재시작
```bash
npm run dev
```

### 3️⃣ 명령어 테스트
```
Discord에서:
/spin
/attendance
/achievements
```

✅ **완료!**

---

## 🧪 빠른 테스트 (1분)

```bash
# Discord에서 실행:
/spin           # → 룰렛 애니메이션 + 보상
/attendance     # → 출석 체크 + 보상
/achievements   # → 업적 목록 (20개+)
/daily          # → 일일 미션 확인
```

---

## 📊 무엇이 추가되었나?

### 🎰 `/spin` - 행운의 룰렛
- **하루 1회 무료** (프리미엄: 3회)
- 골드, 젬, 상자 획득
- 레전더리 확률 0.1% 🌟

### 📅 `/attendance` - 출석 강화
- **7일**: +골드 1,000 + 젬 30 + 레어
- **14일**: +골드 3,000 + 젬 50 + 에픽
- **30일**: +골드 10,000 + 젬 100 + 레전더리 + 칭호

### 🏆 `/achievements` - 업적 20개+
- 전투, 보스, 성장, 재화
- 생산, 소셜, 강화
- 숨겨진 업적 5개

---

## 📁 주요 파일

### 신규 파일
```
src/commands/spin.js                  ← 룰렛 시스템
migrations/add_spin_system.sql        ← DB 마이그레이션
PHASE1_IMPLEMENTATION_GUIDE.md        ← 상세 가이드
PHASE1_COMPLETION_REPORT.md           ← 완료 보고서
```

### 수정된 파일
```
src/game/attendance.js                ← 보상 강화
src/commands/attendance.js            ← 젬/칭호
src/game/achievement-system.js        ← 업적 20개
src/commands/achievements.js          ← 카테고리 추가
src/game/premium.js                   ← dailySpins
prisma/schema.prisma                  ← 테이블 추가
```

---

## 🐛 문제 발생 시

### `/spin` 명령어가 안 보여요
```bash
# 명령어 재등록
node deploy-commands.js
```

### 데이터베이스 에러
```bash
# 스키마 확인
npx prisma studio

# 재생성
npx prisma generate
```

### 스핀 안 돼요
```sql
-- DB 확인
SELECT * FROM "DailySpin" WHERE "userId" = 'YOUR_DISCORD_ID';
```

---

## 📞 도움이 필요하면?

1. **상세 가이드**: `PHASE1_IMPLEMENTATION_GUIDE.md`
2. **완료 보고서**: `PHASE1_COMPLETION_REPORT.md`
3. **제리에게 문의**: Discord DM

---

## 🎯 체크리스트

배포 전:
- [ ] DB 마이그레이션 완료
- [ ] 서버 재시작
- [ ] 테스트 3개 명령어 확인

배포 후:
- [ ] 사용자 공지
- [ ] 모니터링 설정
- [ ] 피드백 수집

---

**소요 시간**: 3분  
**난이도**: ⭐ 쉬움  
**결과**: 재미 +1.8점 🚀
