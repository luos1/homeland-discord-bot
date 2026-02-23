# Homeland 레이드 웹 UI

## 프로토타입 (Phase 1)

**목표**: 고블린 왕 레이드 기본 시스템 구현

### 기능
- ✅ 3x3 채스판 UI
- ✅ 8명 공대원 RTS 컨트롤
- ✅ 클릭/우클릭 이동/스킬 사용
- ✅ 실시간 채팅
- ✅ Socket.io 실시간 동기화

## 로컬 실행 방법

### 1. 백엔드 서버 시작 (터미널 1)

```bash
cd homeland-discord-bot
node src/raid-server.js
```

서버 시작: `http://localhost:3001`

### 2. 프론트엔드 시작 (터미널 2)

```bash
cd homeland-discord-bot/web-raid
npm start
```

브라우저 자동 오픈: `http://localhost:3000`

## 조작 방법

### 공대장 (RTS 컨트롤)
1. **캐릭터 선택**: 채스판에서 공대원 클릭
2. **이동**: 선택 후 빈 타일 클릭
3. **스킬 사용**: 
   - 하단 스킬 패널에서 스킬 클릭
   - 또는 우측 공대원 상태에서 캐릭터 클릭

### 공대원
- 실시간 채팅으로 조언
- 자기 캐릭터 상태 모니터링

## 현재 구현된 것

- ✅ 기본 UI (채스판, 공대원 상태, 스킬 패널, 채팅)
- ✅ 캐릭터 이동 로직
- ✅ 스킬 사용 로직 (기본)
- ✅ 실시간 채팅
- ✅ 고블린 왕 보스 데이터
- ✅ 8명 더미 공대원

## 다음 구현 예정

- [ ] 턴 시스템 (5초 타이머)
- [ ] 보스 AI 패턴
- [ ] 전투 데미지 계산
- [ ] Discord 연동 (입장/보상)
- [ ] 승리/패배 조건

## 기술 스택

**Frontend**:
- React 18
- Socket.io-client
- CSS (Grid, Flexbox, Animation)

**Backend**:
- Express.js
- Socket.io
- In-memory state (프로토타입)

## 디렉토리 구조

```
web-raid/
├── src/
│   ├── App.js           # 메인 로직
│   ├── components/
│   │   ├── Chessboard.js       # 채스판 UI
│   │   ├── PartyStatus.js      # 공대원 상태
│   │   ├── SkillPanel.js       # 스킬 패널
│   │   └── ChatBox.js          # 채팅
│   └── *.css            # 스타일
└── README.md

homeland-discord-bot/
└── src/
    └── raid-server.js   # 레이드 서버
```

## 테스트 시나리오

1. 백엔드 + 프론트엔드 실행
2. 브라우저에서 `http://localhost:3000` 접속
3. 채스판에서 탱커1 클릭 → 다른 타일 클릭 (이동)
4. 힐러1 선택 → 스킬 패널에서 회복 클릭
5. 채팅으로 "테스트" 입력 → 전송

---

**Phase 1 목표**: 1주일 내 기본 전투 로직 완성
