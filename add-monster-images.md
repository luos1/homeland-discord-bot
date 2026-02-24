# 몬스터 이미지 추가 가이드

## 1단계: 이미지 생성 (멜키오르)

### ComfyUI 접속
```
http://192.168.0.10:8188
```

### 프롬프트 사용
`monster-image-prompts.md` 참고

### 배치 생성 설정
- 크기: 512x512
- 포맷: PNG
- 배경: 투명 또는 흰색
- 저장: `C:\Users\sinnd\ComfyUI\output\monsters\`

---

## 2단계: 이미지 업로드

### 옵션 A: GitHub (추천)
```bash
# 이미지를 GitHub에 업로드
cp /path/to/monsters/*.png ~/homeland-discord-bot/assets/monsters/
cd ~/homeland-discord-bot
git add assets/monsters/
git commit -m "Add monster images"
git push
```

### 옵션 B: Imgur/CDN
- Imgur에 업로드
- 직접 링크 복사
- 몬스터 데이터에 URL 추가

---

## 3단계: 코드 수정

### monsters.js 수정
```javascript
const MONSTERS = {
  slime: {
    name: '슬라임',
    // ... 기존 데이터
    imageUrl: 'https://raw.githubusercontent.com/your-repo/assets/monsters/slime.png',
  },
};
```

### combat.js 수정
```javascript
function createCombatEmbed({
  character,
  session,
  battleLog = [],
  title = null,
  status = 'ongoing',
  rewards = null,
  levelUpDetails = null,
  droppedEquipment = null,
  droppedResource = null,
}) {
  const resolvedTitle = title ?? combatResultTitle(status, session.monsterName);
  
  // ... 기존 코드 ...
  
  const embed = new EmbedBuilder()
    .setColor(resolveCombatColor(status, levelUpDetails))
    .setTitle(resolvedTitle)
    .setDescription(description)
    .setFooter({
      text: '홈랜드 전투 시스템',
    });
  
  // 몬스터 이미지 추가
  if (session.monsterImageUrl) {
    embed.setThumbnail(session.monsterImageUrl);
  }
  
  return embed;
}
```

---

## 빠른 테스트 (임시 이미지)

임시로 placeholder 이미지 사용:
```javascript
const MONSTER_PLACEHOLDER_IMAGES = {
  slime: 'https://via.placeholder.com/512/00FF00/FFFFFF?text=Slime',
  goblin: 'https://via.placeholder.com/512/008000/FFFFFF?text=Goblin',
  wolf: 'https://via.placeholder.com/512/808080/FFFFFF?text=Wolf',
};
```

---

## 최종 확인
- [ ] 이미지 생성 완료 (12개)
- [ ] GitHub/CDN 업로드 완료
- [ ] monsters.js 수정
- [ ] combat.js 수정
- [ ] Discord 테스트 완료
