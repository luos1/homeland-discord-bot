# 🎮 HOMELAND Discord RPG Bot

턴제 전투 시스템을 갖춘 디스코드 RPG 게임 봇입니다.

## ✨ 주요 기능

- 🎯 **3가지 직업 시스템**: 전사, 레인저, 마법사
- ⚔️ **턴제 전투**: 공격, 방어, 포션, 도망 선택
- 📈 **레벨 시스템**: Lv.1~50, 경험치 & 스탯 성장
- 🗺️ **3개 탐험 지역**: 난이도별 몬스터 출현
- 🛡️ **전략적 전투**: 크리티컬, 방어 메커니즘
- 💾 **SQLite 데이터베이스**: 경량, 설정 불필요

## 📦 명령어

| 명령어 | 설명 |
|--------|------|
| `/create` | 캐릭터 생성 (직업 선택) |
| `/profile` | 프로필 확인 (버튼 네비게이션) |
| `/explore` | 탐험 시작 (지역 선택) |
| `/play` | 빠른 시작 (캐릭터 없으면 생성, 있으면 프로필) |

## 🚀 Railway 무료 배포 (추천)

### 1단계: Discord 봇 생성
1. [Discord Developer Portal](https://discord.com/developers/applications) 접속
2. "New Application" 클릭
3. Bot 탭 → "Add Bot" 클릭
4. **TOKEN** 복사 (나중에 필요)
5. OAuth2 → General:
   - **CLIENT ID** 복사
6. OAuth2 → URL Generator:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Embed Links`, `Use External Emojis`, `Add Reactions`
   - 생성된 URL로 봇 초대

### 2단계: Railway 배포
1. [Railway.app](https://railway.app) 가입 (GitHub 연동)
2. "New Project" → "Deploy from GitHub repo"
3. 이 리포지토리 선택
4. 환경 변수 설정:
   - `DISCORD_TOKEN`: 1단계에서 복사한 토큰
   - `DISCORD_CLIENT_ID`: 1단계에서 복사한 Client ID
   - `DATABASE_URL`: `file:./homeland.db` (기본값)
5. Deploy 클릭!

**✅ 완료!** 봇이 24/7 온라인 상태가 됩니다 (월 $5 무료 크레딧)

## 💻 로컬 실행

### 필수 요구사항
- Node.js 18+ 
- npm 또는 yarn

### 설치
```bash
# 1. 리포지토리 클론
git clone https://github.com/yourusername/homeland-discord-bot.git
cd homeland-discord-bot

# 2. 패키지 설치
npm install

# 3. 환경 변수 설정
cp .env.example .env
# .env 파일 열어서 DISCORD_TOKEN, DISCORD_CLIENT_ID 입력

# 4. 데이터베이스 초기화
npx prisma generate
npx prisma db push

# 5. 봇 실행
npm start
```

## 🧪 테스트 실행

```bash
# 전체 테스트 실행
npm run test

# 변경 감지 모드
npm run test:watch

# 커버리지 포함 실행
npm run test:coverage
```

테스트 코드는 `tests/commands/`와 `tests/helpers/`에 구성되어 있습니다.

## 🎯 게임 시스템

### 직업 (Class)
- **전사** 🛡️: 높은 체력 & 방어력 (HP 120, ATK 12, DEF 8)
- **레인저** 🏹: 균형잡힌 능력치 (HP 100, ATK 15, DEF 5)
- **마법사** 🔮: 높은 공격력 (HP 80, ATK 18, DEF 3)

### 전투 메커니즘
- **공격**: 기본 피해 (15% 크리티컬 확률, 1.65배 데미지)
- **방어**: 이번 턴 피해 55% 감소
- **포션**: 체력 35% 회복 (전투당 3개 제공)
- **도망**: 45% 성공 확률 (실패 시 턴 소모)

### 레벨업
- 경험치 획득 → 레벨업 시 HP/ATK/DEF 자동 증가
- 최대 레벨: 50

## 📁 프로젝트 구조

```
homeland-discord-bot/
├── src/
│   ├── bot.js              # 메인 진입점
│   ├── commands/           # 슬래시 명령어
│   │   ├── create.js
│   │   ├── profile.js
│   │   ├── explore.js
│   │   └── play.js
│   ├── game/               # 게임 로직
│   │   ├── combat.js       # 전투 시스템
│   │   ├── leveling.js     # 레벨/경험치
│   │   └── monsters.js     # 몬스터 데이터
│   ├── database/           # DB 설정
│   │   ├── client.js
│   │   └── schema.prisma
│   └── utils/              # 유틸리티
│       └── ui.js           # UI 헬퍼
├── .env.example
├── package.json
├── railway.json
└── README.md
```

## 🛠️ 기술 스택

- **Discord.js v14**: 디스코드 봇 프레임워크
- **Prisma**: 타입 안전 ORM
- **SQLite**: 경량 데이터베이스
- **Node.js**: 런타임

## 📝 라이센스

MIT License - 자유롭게 사용, 수정, 배포 가능합니다.

## 🤝 기여

이슈 제보 및 PR 환영합니다!

## 💡 로드맵

- [ ] 인벤토리 시스템
- [ ] 상점 (아이템 구매/판매)
- [ ] 길드 시스템
- [ ] PvP 대전
- [ ] 랜덤 이벤트 (보물, 함정, 상인)
- [ ] 레어 몹 (Shiny, Boss)
- [ ] 미니 게임 (주사위 도박)

---

**Made with ❤️ by 너구리상회 AI Studio**
