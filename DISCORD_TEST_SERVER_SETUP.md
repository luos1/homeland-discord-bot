# Discord 테스트 서버 세팅 가이드

## 목적
Homeland 봇을 테스트할 Discord 서버를 생성하고 설정하는 방법

---

## 1. Discord 서버 생성

### 1-1. 서버 만들기
1. Discord 앱/웹 열기
2. 좌측 서버 목록 → 맨 아래 **[+]** 클릭
3. "직접 만들기" 선택
4. "나와 친구들을 위한 서버" 선택
5. 서버 이름: **Homeland Test** (원하는 이름)
6. "만들기" 클릭

### 1-2. 채널 구성
기본 채널 정리:
- `#general` → `#game` 으로 이름 변경
- `#voice` 채널 삭제 (선택사항)

추가 채널 생성:
- `#announcements` (공지용, 신화 드랍 등)
- `#trading` (거래용, 나중에)
- `#guild` (길드용, 나중에)

---

## 2. 봇 초대

### 2-1. 봇 초대 링크 사용
1. 아래 링크 클릭 (또는 직접 생성):
   ```
   https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands
   ```
   
2. **YOUR_CLIENT_ID**를 실제 봇 ID로 교체:
   - Discord Developer Portal (https://discord.com/developers/applications)
   - 해당 봇 선택 → General Information → Application ID 복사

3. 테스트 서버 선택 후 "승인"

### 2-2. 봇 권한 확인
봇이 다음 권한을 가지고 있는지 확인:
- ✅ 메시지 읽기
- ✅ 메시지 보내기
- ✅ 임베드 링크
- ✅ 파일 첨부
- ✅ 멘션 사용
- ✅ 슬래시 명령어 사용

---

## 3. 봇 테스트

### 3-1. 기본 명령어 테스트
`#game` 채널에서:

```
/create
```
→ 캐릭터 생성 (직업 선택)

```
/profile
```
→ 프로필 확인

```
/village
```
→ 마을 허브 (모든 기능 접근)

### 3-2. Discovery 시스템 테스트

#### A. 채집 랜덤 이벤트
```
/production
```
→ 생산 직업 선택 (Gatherer 추천)

```
/gather
```
→ 자원 채집 시작

**기다리는 동안:**
- 일반 (95%): 기본 자원
- 반짝이는 광석 (4.9%): 보너스 자원 +50%
- 고대 유적 (0.1%): +1000G + 전체 공지!

**빠른 테스트 방법:**
채집 시간을 1분으로 줄여서 빠르게 여러 번 시도 가능
(코드 수정 필요, 아래 참조)

#### B. Mythic 드랍 테스트
```
/combat
```
→ 전투 시작

```
Zone 4: 보스 지역
```
→ 보스 선택

**보스 처치:**
- 일반 (99.99%): 일반/희귀/영웅/전설 장비
- **신화 (0.01%)**: Mythic 장비 + 전체 공지!

**빠른 테스트 방법:**
확률을 50%로 올려서 테스트 (코드 수정, 아래 참조)

---

## 4. 빠른 테스트를 위한 임시 설정

### 4-1. Mythic 드랍 확률 조정
**파일:** `src/game/combat.js`

**찾기 (약 1190줄):**
```javascript
if (mythicRoll < 0.0001) {
```

**변경:**
```javascript
if (mythicRoll < 0.5) { // 50%로 임시 변경
```

**주의:** 테스트 후 원복 필수!

### 4-2. 채집 시간 단축
**파일:** `src/game/production-classes.js`

**찾기 (calculateGatherTime 함수):**
```javascript
export function calculateGatherTime(...) {
  // 기본 시간 (초 단위)
  const baseTime = 1200; // 20분
```

**변경:**
```javascript
  const baseTime = 60; // 1분으로 단축
```

**주의:** 테스트 후 원복 필수!

---

## 5. 실제 테스트 시나리오

### 시나리오 1: 신규 유저 플로우
```
1. /create → Warrior 선택
2. /profile → 초기 상태 확인
3. /combat → Zone 1 전투
4. /inventory → 드랍된 장비 확인
5. /village → 마을 허브 탐험
```

### 시나리오 2: Discovery 체험
```
1. /production → Gatherer 선택
2. /gather → 철광석 채집 (여러 번 반복)
3. 반짝이는 광석 발견 기대!
4. /combat → Zone 4 보스 전투 (여러 번)
5. Mythic 드랍 기대!
```

### 시나리오 3: 경제 시스템
```
1. /gather → 자원 채집
2. /market → 거래소에 판매
3. /shop → 골드로 장비 구매
4. /enhance → 장비 강화 (추후 구현)
```

---

## 6. 문제 해결

### 봇이 응답 없음
1. Railway 배포 상태 확인
   - https://railway.app (로그인)
   - 프로젝트 선택 → Deployments 확인
   - "Active" 상태여야 함

2. 환경 변수 확인
   - `DISCORD_TOKEN` 설정 확인
   - `DATABASE_URL` 설정 확인

3. 로그 확인
   - Railway → Deployments → 최신 빌드 → Logs

### 슬래시 명령어 안 보임
1. 봇 재초대
2. Discord 앱 재시작
3. 서버에서 나갔다가 다시 입장

### Discovery 이벤트 안 뜸
1. 확률이 낮아서 안 뜰 수 있음
   - 반짝이는 광석: 20번 중 1번
   - 고대 유적: 1000번 중 1번
   - Mythic 드랍: 10,000번 중 1번

2. 빠른 테스트:
   - 위의 "임시 설정" 참조
   - 확률 조정 후 재배포

---

## 7. 다음 단계

### 완료된 기능:
- [x] 캐릭터 생성
- [x] 전투 시스템
- [x] 생산 시스템
- [x] 경제 시스템
- [x] Discovery 시스템
- [x] Mythic 드랍
- [x] 채집 랜덤 이벤트

### 다음 구현 예정:
- [ ] 숨겨진 던전 (던전 10층 클리어 후 1% 확률)
- [ ] 히든 퀘스트 (조건부 시작)
- [ ] 파티 시스템 (2-4인 협력)
- [ ] 길드 시스템 (NPC 소유, 기여도)
- [ ] PvP 시스템 (도둑질, 듀얼)
- [ ] 장비 강화 (도박 시스템)

---

## 8. 피드백

테스트 후 피드백:
- 어떤 부분이 재밌었나요?
- 어떤 부분이 지루했나요?
- 버그가 있었나요?
- 추가했으면 하는 기능은?

**Discord에서 바로 말해주세요!**

---

**작성일**: 2026-02-23
**버전**: Discovery v1.0
