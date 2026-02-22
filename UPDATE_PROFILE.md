# Profile 명령어 이모지 버튼 추가

## 요구사항
`/profile` 명령어에 이모지 버튼을 추가해서 직접 액션을 실행할 수 있게 만들기

## 버튼 구성
프로필 메시지 하단에 버튼 행 추가:

```
[⚔️ 탐험] [🎒 인벤토리] [🏪 상점] [📈 스탯]
```

## 각 버튼 동작
1. **⚔️ 탐험** - 존 선택 버튼 표시 (Zone 1, Zone 2, Zone 3)
2. **🎒 인벤토리** - "인벤토리 시스템은 Week 2에 구현됩니다" 메시지 (ephemeral)
3. **🏪 상점** - "상점 시스템은 Week 2에 구현됩니다" 메시지 (ephemeral)
4. **📈 스탯** - 현재 프로필 다시 표시 (업데이트)

## 구현 방법
1. `src/commands/profile.js` 수정:
   - ActionRowBuilder + ButtonBuilder 추가
   - 버튼 4개 생성 (customId: `profile_explore`, `profile_inventory`, `profile_shop`, `profile_stats`)

2. `src/bot.js`에 버튼 인터랙션 핸들러 추가:
   - `profile_explore` → 존 선택 버튼 표시
   - `profile_inventory` → "Week 2 예정" 메시지
   - `profile_shop` → "Week 2 예정" 메시지  
   - `profile_stats` → 프로필 업데이트

3. 탐험 버튼 클릭 시:
   - 새 메시지로 존 선택 버튼 표시: [Zone 1] [Zone 2] [Zone 3]
   - 존 선택 → 기존 `/explore` 로직 실행

## 완료 후
봇을 재시작하고 테스트 가능하도록 준비

---

**즉시 구현해주세요!**
