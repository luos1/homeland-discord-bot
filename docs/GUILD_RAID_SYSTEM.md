# 길드 & 레이드 시스템 설계

## 개요
Discord 봇 특성에 맞춘 **비동기 협동 시스템**
- 길드: 커뮤니티/버프/창고 중심
- 레이드: 턴제 기반 누적 데미지 방식

---

## 1. 길드 시스템

### 1.1 길드 구조

```prisma
model Guild {
  id          Int      @id @default(autoincrement())
  name        String   @unique
  description String?
  level       Int      @default(1)
  exp         Int      @default(0)
  gold        Int      @default(0)
  
  masterId    Int      @unique  // 길드장 (Character.id)
  maxMembers  Int      @default(10)
  
  // 길드 버프
  combatBonus Float    @default(0)  // 전투 보너스 %
  goldBonus   Float    @default(0)  // 골드 보너스 %
  expBonus    Float    @default(0)  // 경험치 보너스 %
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  members     GuildMember[]
  warehouse   GuildWarehouse[]
  raids       RaidSession[]
}

model GuildMember {
  id          Int      @id @default(autoincrement())
  guildId     Int
  guild       Guild    @relation(fields: [guildId], references: [id])
  characterId Int      @unique
  character   Character @relation(fields: [characterId], references: [id])
  
  rank        String   @default("member")  // master, officer, member
  contribution Int     @default(0)         // 길드 기여도
  
  joinedAt    DateTime @default(now())
  
  @@unique([guildId, characterId])
  @@index([guildId, rank])
}

model GuildWarehouse {
  id          Int      @id @default(autoincrement())
  guildId     Int
  guild       Guild    @relation(fields: [guildId], references: [id])
  
  itemType    String   // "resource", "equipment", "consumable"
  itemKey     String
  itemName    String
  quantity    Int      @default(1)
  
  depositedBy Int      // Character.id
  depositedAt DateTime @default(now())
  
  @@index([guildId, itemType])
}
```

### 1.2 길드 명령어

#### /guild create
```
길드 생성
- 비용: 10,000G
- 이름: 2-20자 (한글/영문/숫자)
- 설명: 선택 (최대 200자)
- 자동으로 길드장 지정
```

#### /guild
```
길드 정보 표시
- 길드 레벨/경험치
- 멤버 수 (현재/최대)
- 길드 창고 요약
- 버프 현황

버튼:
[📋 멤버 목록] [📦 창고] [💰 기부] [⚙️ 관리]
```

#### /guild invite <@유저>
```
길드 초대
- 권한: 길드장, 부길드장
- 대상이 길드 없어야 함
- 초대 수락/거절 버튼
```

#### /guild warehouse
```
길드 창고
- 탭: [자원] [장비] [소비템]
- 버튼: [넣기] [빼기]

권한:
- 넣기: 모든 멤버
- 빼기: 길드장, 부길드장만
```

#### /guild donate
```
길드 기부
- 골드 기부 → 길드 골드 증가
- 자원 기부 → 길드 창고 저장
- 기여도 증가 (기부 가치의 10%)
```

### 1.3 길드 레벨 시스템

| 레벨 | 필요 경험치 | 최대 인원 | 보너스 |
|------|------------|----------|--------|
| 1 | 0 | 10 | - |
| 2 | 10,000 | 15 | 골드 +5% |
| 3 | 30,000 | 20 | 전투 +3% |
| 4 | 60,000 | 25 | 경험치 +5% |
| 5 | 100,000 | 30 | 골드 +10% |
| 6 | 150,000 | 35 | 전투 +5% |
| 7 | 220,000 | 40 | 경험치 +10% |
| 8 | 300,000 | 50 | 골드 +15% |
| 9 | 400,000 | 60 | 전투 +8% |
| 10 | 500,000 | 80 | 모든 보너스 +20% |

**경험치 획득:**
- 길드원 전투 승리: 10 exp
- 길드원 생산 성공: 5 exp
- 길드 레이드 참여: 100 exp
- 길드 레이드 클리어: 500 exp

### 1.4 길드 랭킹

```
/guild ranking

기준:
1. 길드 레벨 (높을수록)
2. 총 경험치 (많을수록)
3. 멤버 수 (많을수록)

표시:
TOP 10 길드
- 길드명, 레벨, 멤버 수, 길드장
```

---

## 2. 파티 시스템

### 2.1 파티 구조

```prisma
model Party {
  id          Int      @id @default(autoincrement())
  leaderId    Int      // Character.id
  maxMembers  Int      @default(5)
  
  status      String   @default("recruiting")  // recruiting, active, disbanded
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  members     PartyMember[]
  dungeonRun  DungeonRun?
}

model PartyMember {
  id          Int      @id @default(autoincrement())
  partyId     Int
  party       Party    @relation(fields: [partyId], references: [id])
  characterId Int
  character   Character @relation(fields: [characterId], references: [id])
  
  joinedAt    DateTime @default(now())
  
  @@unique([partyId, characterId])
}
```

### 2.2 파티 명령어

#### /party create
```
파티 생성
- 자동으로 파티장 지정
- 최대 5명 (기본)
```

#### /party invite <@유저>
```
파티 초대
- 권한: 파티장만
- 대상이 파티 없어야 함
```

#### /party
```
파티 정보
- 파티장, 멤버 목록
- 상태 (모집 중/활동 중)

버튼:
[📋 멤버] [🏃 던전] [❌ 탈퇴]
```

---

## 3. 레이드 시스템 (비동기 협동)

### 3.1 핵심 개념

**Discord 봇 제약:**
- 실시간 동기화 어려움
- 턴제 기반 전투 시스템

**해결책:**
- **비동기 기여도 방식**
- 각자 자기 턴에 공격
- 누적 데미지로 보스 HP 감소
- 시간 제한 내 클리어

### 3.2 레이드 구조

```prisma
model RaidBoss {
  id          Int      @id @default(autoincrement())
  key         String   @unique
  name        String
  level       Int
  
  maxHp       Int      // 100,000+
  attack      Int
  defense     Int
  
  skills      Json     // 보스 패턴
  rewards     Json     // 보상 테이블
  
  tier        Int      @default(1)  // 1-5 (난이도)
  minPlayers  Int      @default(5)
  maxPlayers  Int      @default(20)
  
  timeLimit   Int      @default(86400)  // 24시간 (초)
}

model RaidSession {
  id          Int      @id @default(autoincrement())
  bossKey     String
  boss        RaidBoss @relation(fields: [bossKey], references: [key])
  
  guildId     Int?
  guild       Guild?   @relation(fields: [guildId], references: [id])
  
  currentHp   Int      // 보스 현재 HP
  maxHp       Int      // 보스 최대 HP
  
  status      String   @default("recruiting")  // recruiting, active, cleared, failed
  
  startedAt   DateTime?
  endsAt      DateTime?
  clearedAt   DateTime?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  participants RaidParticipant[]
  logs        RaidLog[]
}

model RaidParticipant {
  id          Int      @id @default(autoincrement())
  raidId      Int
  raid        RaidSession @relation(fields: [raidId], references: [id])
  characterId Int
  character   Character @relation(fields: [characterId], references: [id])
  
  totalDamage Int      @default(0)
  turns       Int      @default(0)
  deaths      Int      @default(0)
  
  joinedAt    DateTime @default(now())
  lastAttackAt DateTime?
  
  @@unique([raidId, characterId])
  @@index([raidId, totalDamage])  // 기여도 순위용
}

model RaidLog {
  id          Int      @id @default(autoincrement())
  raidId      Int
  raid        RaidSession @relation(fields: [raidId], references: [id])
  
  characterId Int?
  action      String   // "attack", "skill", "death", "boss_action"
  damage      Int      @default(0)
  message     String
  
  createdAt   DateTime @default(now())
  
  @@index([raidId, createdAt])
}
```

### 3.3 레이드 흐름

#### 1단계: 레이드 생성
```
/raid create <보스명>

- 권한: 길드장 (길드 레이드) 또는 누구나 (오픈 레이드)
- 보스 선택 (티어별)
- 모집 시작 (버튼: [🔔 참가 신청])
```

#### 2단계: 참가자 모집
```
[레이드 공고]
🐲 고대 드래곤 레이드

보스: 바하무트 (Lv.50)
HP: 100,000
참가: 5/20명
제한 시간: 24시간
보상: 전설 장비, 희귀 재료

[🔔 참가 신청] [📋 참가자 목록] [❌ 취소]
```

#### 3단계: 레이드 시작
```
최소 인원 달성 시 길드장/생성자가 시작

[⚔️ 레이드 시작] 버튼 클릭
→ 24시간 타이머 시작
→ 모든 참가자에게 알림
```

#### 4단계: 전투 (비동기)
```
/raid attack

- 자기 턴에 공격
- 턴당 1회 공격 (쿨다운 1시간)
- 스킬 사용 가능
- 데미지 누적 → 보스 HP 감소

[보스 현황]
🐲 바하무트
HP: 87,340 / 100,000 ████████░░ 87%
참가자: 12명
누적 데미지: 12,660
남은 시간: 18시간 23분

[⚔️ 공격] [🔥 스킬] [📊 기여도] [🏃 탈주]
```

#### 5단계: 보상 분배
```
클리어 시:
- 기여도 순위에 따라 보상 차등 지급
- MVP (최다 데미지): 추가 보상
- 전원 기본 보상 + 길드 경험치

실패 시:
- 시간 초과 or 전멸
- 참가자 전원 소량 보상
```

### 3.4 레이드 보스 티어

| 티어 | 레벨 | HP | 참가 인원 | 시간 제한 | 보상 |
|------|-----|----|-----------|-----------| -----|
| 1 | 10-20 | 10,000 | 3-10 | 12시간 | 희귀 장비 |
| 2 | 20-30 | 30,000 | 5-15 | 24시간 | 영웅 장비 |
| 3 | 30-40 | 60,000 | 8-20 | 24시간 | 전설 재료 |
| 4 | 40-50 | 100,000 | 10-25 | 48시간 | 전설 장비 |
| 5 | 50+ | 200,000+ | 15-30 | 72시간 | 신화 장비 |

### 3.5 레이드 보스 예시

#### T1: 고블린 왕
```
레벨: 15
HP: 10,000
공격: 30
방어: 15

패턴:
- 무리 소환 (참가자 랜덤 1명 추가 피해)
- 광폭화 (공격력 1.5배, 3턴)

보상:
- 희귀 무기 (랜덤)
- 고블린 왕관 (칭호 재료)
- 골드 5,000-10,000
```

#### T3: 고대 드래곤
```
레벨: 40
HP: 60,000
공격: 80
방어: 50

패턴:
- 화염 브레스 (전체 공격)
- 비행 (회피율 증가, 2턴)
- 용의 분노 (HP 50% 이하 시 공격력 2배)

보상:
- 전설 무기/방어구 (랜덤)
- 드래곤 비늘 (제작 재료)
- 드래곤 슬레이어 칭호
- 골드 50,000-100,000
```

#### T5: 마왕 아자젤
```
레벨: 60
HP: 250,000
공격: 150
방어: 100

패턴:
- 어둠의 장막 (전체 디버프)
- 지옥문 소환 (악마 3마리 추가)
- 멸망의 심판 (HP 20% 이하 시 전체 즉사급 공격)

보상:
- 신화 장비 세트 (확정)
- 마왕의 왕관 (특별 칭호)
- 전설 재료 x10
- 골드 500,000+
```

### 3.6 레이드 기여도 시스템

```javascript
// 기여도 계산
contribution = totalDamage + (turns × 100) - (deaths × 500)

// 보상 분배
rank1 (MVP): baseReward × 2.0 + bonus
rank2-3:     baseReward × 1.5
rank4-10:    baseReward × 1.2
rank11+:     baseReward × 1.0
```

### 3.7 레이드 쿨다운
- 동일 보스: 일주일 1회
- 다른 보스: 제한 없음
- 길드 레이드: 일주일 2회

---

## 4. 구현 우선순위

### Phase 1: 길드 시스템 (Week 5)
- [ ] 길드 CRUD (생성/가입/탈퇴/해체)
- [ ] 길드 정보 표시
- [ ] 길드 멤버 관리
- [ ] 길드 레벨/경험치
- [ ] 길드 버프 적용

### Phase 2: 길드 창고 (Week 5)
- [ ] 창고 시스템
- [ ] 기부 시스템
- [ ] 기여도 추적

### Phase 3: 파티 시스템 (Week 6)
- [ ] 파티 생성/초대/탈퇴
- [ ] 파티 정보 표시
- [ ] 파티 던전 연동 (나중에)

### Phase 4: 레이드 시스템 (Week 6)
- [ ] 레이드 보스 정의
- [ ] 레이드 생성/참가
- [ ] 비동기 전투 시스템
- [ ] 기여도 추적
- [ ] 보상 분배
- [ ] 레이드 랭킹

### Phase 5: 고급 기능 (Week 7+)
- [ ] 길드 랭킹
- [ ] 길드 vs 길드
- [ ] 주간/월간 레이드
- [ ] 레이드 리더보드

---

## 5. UI/UX 예시

### 길드 메인
```
🏰 HOMELAND 길드

레벨: 5 (경험치: 120,450 / 150,000)
멤버: 28 / 35
길드장: @luos
골드: 1,250,000G

🎁 길드 버프
⚔️ 전투 보너스: +5%
💰 골드 보너스: +10%
✨ 경험치 보너스: +5%

[📋 멤버 목록] [📦 창고] [💰 기부] [⚙️ 관리]
[🏘️ 마을로]
```

### 레이드 전투
```
⚔️ 레이드: 고대 드래곤

🐲 바하무트 (Lv.40)
HP: 42,780 / 60,000 ███████░░░ 71%

⏰ 남은 시간: 16시간 32분
👥 참가자: 15명

📊 나의 기여도
- 총 데미지: 3,240
- 공격 횟수: 8회
- 현재 순위: 3위

[⚔️ 공격] [🔥 스킬 사용] [📊 순위표] [🏃 탈주]
```

### 레이드 완료
```
🎉 레이드 클리어!

🐲 바하무트를 처치했습니다!

⏱️ 클리어 시간: 18시간 45분
👥 참가자: 15명
💀 총 사망: 23회

🏆 MVP: @user123 (데미지: 12,450)

📦 보상
- 전설 무기: 드래곤슬레이어 (확정)
- 드래곤 비늘 x5
- 골드 75,000G
- 길드 경험치 +500

[📊 전체 순위] [🏘️ 마을로]
```

---

## 6. 기술적 고려사항

### 6.1 레이드 동기화
```javascript
// 레이드 공격 처리 (트랜잭션)
await prisma.$transaction(async (tx) => {
  // 1. 레이드 잠금 (race condition 방지)
  const raid = await tx.raidSession.update({
    where: { id: raidId },
    data: { updatedAt: new Date() },  // 낙관적 잠금
  });
  
  // 2. 데미지 계산
  const damage = calculateDamage(character, boss);
  
  // 3. HP 업데이트
  const newHp = Math.max(0, raid.currentHp - damage);
  
  // 4. 참가자 기여도 업데이트
  await tx.raidParticipant.update({
    where: { raidId_characterId: { raidId, characterId } },
    data: {
      totalDamage: { increment: damage },
      turns: { increment: 1 },
      lastAttackAt: new Date(),
    },
  });
  
  // 5. 레이드 상태 업데이트
  await tx.raidSession.update({
    where: { id: raidId },
    data: {
      currentHp: newHp,
      status: newHp === 0 ? 'cleared' : 'active',
    },
  });
  
  // 6. 로그 기록
  await tx.raidLog.create({
    data: {
      raidId,
      characterId,
      action: 'attack',
      damage,
      message: `${character.name}이(가) ${damage} 데미지를 입혔습니다!`,
    },
  });
});
```

### 6.2 레이드 스케줄러
```javascript
// 매시간 만료된 레이드 체크
cron.schedule('0 * * * *', async () => {
  const expiredRaids = await prisma.raidSession.findMany({
    where: {
      status: 'active',
      endsAt: { lte: new Date() },
    },
  });
  
  for (const raid of expiredRaids) {
    if (raid.currentHp > 0) {
      // 실패 처리
      await handleRaidFailure(raid);
    }
  }
});
```

### 6.3 쿨다운 관리
```javascript
// 공격 가능 여부 체크
function canAttack(participant) {
  if (!participant.lastAttackAt) return true;
  
  const cooldown = 60 * 60 * 1000;  // 1시간
  const elapsed = Date.now() - participant.lastAttackAt.getTime();
  
  return elapsed >= cooldown;
}
```

---

**작성일**: 2026-02-23  
**상태**: 설계 완료  
**담당**: Maru (AI Assistant)
