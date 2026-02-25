# 🧪 Phase 4: 베타 테스트 준비 완료

**날짜**: 2026-02-25  
**목표**: 베타 테스터 모집 및 피드백 수집 시스템 구축

---

## 📋 베타 테스트 설문지 (Google Forms)

### 설문 제목
**홈랜드 Discord RPG 베타 테스트 피드백**

### 섹션 1: 기본 정보
1. Discord 사용자명 (예: username#1234)
2. 플레이 시간 (예: 30분, 1시간, 2시간)
3. 도달한 레벨 (숫자 입력)
4. 가장 많이 플레이한 존 (Zone 1/2/3/4)

### 섹션 2: 재미도 평가 (1-10점)
1. **전체 재미도** (1=매우 지루함, 10=매우 재미있음)
2. **전투 시스템** (1=지루함, 10=흥미진진함)
3. **레벨업 속도** (1=너무 느림, 10=적절함)
4. **보상 체감도** (1=보람 없음, 10=매우 보람 있음)
5. **난이도** (1=너무 쉬움, 10=너무 어려움)

### 섹션 3: 개방형 질문
1. 가장 재미있었던 부분은?
2. 가장 지루했던 부분은?
3. 개선이 필요한 부분은?
4. 추가하고 싶은 기능은?
5. 버그를 발견했나요? (있다면 설명)

### 섹션 4: 지속 의향
1. 내일도 계속 플레이하고 싶은가? (예/아니오/잘 모르겠음)
2. 친구에게 추천하고 싶은가? (예/아니오/잘 모르겠음)
3. 유료 아이템을 구매할 의향이 있는가? (예/아니오/잘 모르겠음)

---

## 📨 베타 테스터 모집 메시지

### Discord 공지 메시지
```markdown
@everyone 🎮 **홈랜드 RPG 베타 테스터 모집!**

Discord 서버에서 즐기는 텍스트 기반 RPG 게임 **홈랜드**의 베타 테스터를 모집합니다!

**참여 혜택:**
✨ 글로벌 런칭 전 먼저 체험
🎁 베타 테스터 전용 아이템 (런칭 후 지급)
💎 피드백 제공 시 프리미엄 화폐 100개 지급
🏆 베타 테스터 전용 뱃지

**참여 방법:**
1. `/create` 명령어로 캐릭터 생성
2. 최소 30분 이상 플레이
3. 설문지 작성: [Google Forms 링크]

**모집 기간:** 2026-02-25 ~ 2026-03-03 (1주일)
**목표 인원:** 10명

**문의:** DM으로 연락주세요!
```

### Reddit 포스트
```markdown
# 🎮 [Beta Test] HOMELAND - Discord Text-Based RPG

Hey r/discordbots! I'm looking for beta testers for my new Discord bot game **HOMELAND**.

**What is it?**
- Text-based RPG in Discord
- Combat, leveling, equipment, guilds
- Korean & English support (coming soon)
- Completely free to play

**What I need:**
- 10 testers to play for 30+ minutes
- Fill out a quick feedback form
- Report bugs (if any)

**Rewards for testers:**
- Exclusive beta tester badge
- 100 premium currency on launch
- Early access to new features

**How to join:**
1. Join my Discord: [Discord invite]
2. Use `/create` to start
3. Play and have fun!
4. Fill the form: [Google Forms link]

**Testing period:** Feb 25 - Mar 3

Thanks!
```

---

## 🎯 테스트 시나리오 (가이드)

### 초보자 플레이스루 (30분)
```
1. `/create` - 캐릭터 생성 (전사/궁수/마법사)
2. `/profile` - 캐릭터 확인
3. `/explore` → Zone 1 선택
4. 5회 전투 (공격/방어/포션 모두 사용)
5. `/profile` - 레벨업 확인
6. `/market` - 아이템 구매
7. `/explore` → Zone 2 도전
8. 3회 전투
9. 설문 작성
```

### 중급자 플레이스루 (1시간)
```
1. 초보자 플레이스루 완료
2. Zone 2에서 10회 전투
3. `/job` - 직업 변경 (선택)
4. `/farm` - 생산 스킬 시도
5. `/auction` - 경매장 확인
6. Zone 3 도전 (고난이도)
7. `/guild` - 길드 시스템 확인
8. 설문 작성
```

### 고급자 플레이스루 (2시간)
```
1. 중급자 플레이스루 완료
2. Zone 3에서 레벨 30 달성
3. 모든 기능 테스트
4. 버그 헌팅
5. 상세 피드백 작성
```

---

## 📊 성과 측정 지표

### 1일 리텐션
- **목표**: 50%+
- **계산**: (다음 날 접속자 / 첫날 접속자) * 100

### 3일 리텐션
- **목표**: 30%+
- **계산**: (3일 후 접속자 / 첫날 접속자) * 100

### 7일 리텐션
- **목표**: 20%+
- **계산**: (7일 후 접속자 / 첫날 접속자) * 100

### 평균 재미도
- **목표**: 7/10 이상
- **계산**: 설문 응답 평균

### NPS (Net Promoter Score)
- **목표**: 40+ (양호)
- **계산**: (추천 의향 - 비추천 의향) / 전체 응답자 * 100

---

## 🐛 버그 추적 시스템

### GitHub Issues 템플릿
```markdown
## 버그 설명
간단한 설명을 작성해주세요.

## 재현 단계
1. `/explore` 실행
2. Zone 1 선택
3. 고블린과 전투
4. 버그 발생

## 예상 동작
무엇이 일어나야 하는지 설명해주세요.

## 실제 동작
실제로 무슨 일이 일어났는지 설명해주세요.

## 스크린샷
가능하면 스크린샷을 첨부해주세요.

## 환경
- Discord 클라이언트: (Desktop/Mobile/Web)
- 사용자 ID: (Discord User ID)
- 발생 시각: (YYYY-MM-DD HH:MM)

## 추가 정보
기타 관련 정보를 작성해주세요.
```

---

## ✅ Phase 4 체크리스트

### 준비 단계
- [x] Google Forms 설문지 템플릿 작성
- [x] Discord 공지 메시지 작성
- [x] Reddit 포스트 작성
- [x] 테스트 시나리오 가이드 작성
- [x] 버그 추적 템플릿 작성

### 실행 단계 (형아 작업 필요)
- [ ] Google Forms 생성 및 링크 복사
- [ ] Discord 테스트 서버 생성
- [ ] 베타 테스터 모집 공지
- [ ] Reddit/Discord 커뮤니티에 포스팅
- [ ] 테스터 10명 모집
- [ ] 1주일 테스트 진행
- [ ] 피드백 수집 및 분석

### 분석 단계
- [ ] 설문 응답 분석
- [ ] 리텐션 지표 계산
- [ ] 버그 리스트업
- [ ] 개선 우선순위 설정
- [ ] Phase 4 완료 리포트 작성

---

## 💡 빠른 시작 가이드

### 1단계: Google Forms 생성 (10분)
1. https://forms.google.com 접속
2. 새 양식 만들기
3. 위 섹션 복사/붙여넣기
4. 공유 링크 복사

### 2단계: Discord 서버 준비 (5분)
1. 테스트 서버 생성 (또는 기존 서버 사용)
2. 봇 초대
3. 공지 채널에 모집 메시지 게시

### 3단계: 홍보 (10분)
1. Reddit에 포스트
2. Discord 서버 홍보
3. 친구에게 직접 초대

### 4단계: 테스트 관리 (1주일)
1. 매일 진행 상황 확인
2. 질문/버그 대응
3. 피드백 수집

---

**서브에이전트**: Jerry v2  
**상태**: Phase 4 준비 완료 ✅
