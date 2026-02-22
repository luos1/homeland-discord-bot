# HOMELAND - 몬스터 이미지 제작 요청서

**요청일**: 2026-02-22  
**제작 담당**: Melchior (ComfyUI)  
**용도**: Discord 봇 전투 화면  

---

## 🎨 이미지 스타일 가이드

**스타일**: 픽셀 아트 또는 판타지 일러스트  
**사이즈**: 512x512px (Discord Embed 최적화)  
**포맷**: PNG (투명 배경)  
**분위기**: 다크 판타지, 던전 크롤러  

---

## 📋 제작할 몬스터 (총 6종)

### Zone 1 - 초보자 숲 🌲

#### 1. 스켈레톤 그런트 (Lv.3)
**설명**: 낡은 갑옷을 걸친 언데드 해골 전사  
**특징**:
- 해골 전사
- 녹슨 검 들고 있음
- 찢어진 갑옷
- 초급 몬스터 느낌 (약하지만 위협적)

**프롬프트 예시**:
```
skeleton warrior, rusty armor, holding old sword, 
dark fantasy, pixel art style, 512x512, 
transparent background, undead creature
```

**저장 위치**: `assets/monsters/skeleton_grunt.png`

---

#### 2. 다이어울프 (Lv.5)
**설명**: 붉은 눈을 가진 거대한 늑대  
**특징**:
- 검은 털의 거대한 늑대
- 빛나는 붉은 눈
- 날카로운 이빨과 발톱
- 야생적이고 포악함

**프롬프트 예시**:
```
dire wolf, black fur, glowing red eyes, sharp fangs,
dark fantasy, fierce expression, 512x512,
transparent background, fantasy beast
```

**저장 위치**: `assets/monsters/dire_wolf.png`

---

### Zone 2 - 어둠의 동굴 ⛰️

#### 3. 언데드 기사 (Lv.14)
**설명**: 검은 갑옷의 언데드 기사  
**특징**:
- 완전 무장한 검은 갑옷
- 큰 검과 방패
- 헬멧 틈으로 보이는 빈 눈
- 강력하고 위압적

**프롬프트 예시**:
```
undead knight, black plate armor, large sword and shield,
dark fantasy, intimidating pose, 512x512,
transparent background, evil warrior
```

**저장 위치**: `assets/monsters/undead_knight.png`

---

#### 4. 고블린 주술사 (Lv.16)
**설명**: 지팡이를 든 사악한 고블린  
**특징**:
- 초록색 피부
- 뾰족한 귀
- 마법 지팡이 (해골 장식)
- 어둠 마법 효과 (보라색 기운)
- 교활한 표정

**프롬프트 예시**:
```
goblin shaman, green skin, pointed ears, magic staff,
purple magic aura, dark fantasy, sinister expression,
512x512, transparent background, fantasy creature
```

**저장 위치**: `assets/monsters/goblin_shaman.png`

---

### Zone 3 - 죽음의 산맥 🏔️

#### 5. 고대 드래곤 (Lv.32)
**설명**: 날개를 펼친 거대한 드래곤  
**특징**:
- 거대한 드래곤 (날개 펼침)
- 검은색/붉은색 비늘
- 화염 효과 (입에서 불)
- 날카로운 발톱과 이빨
- 압도적이고 전설적
- **보스급 느낌**

**프롬프트 예시**:
```
ancient dragon, massive wings spread, black and red scales,
breathing fire, sharp claws, dark fantasy, epic boss monster,
512x512, transparent background, legendary creature
```

**저장 위치**: `assets/monsters/ancient_dragon.png`

---

#### 6. 리치 군주 (Lv.35)
**설명**: 어둠의 마법사 언데드 왕  
**특징**:
- 해골 언데드
- 화려한 왕관 (부패한)
- 마법 지팡이 (어둠 오브)
- 찢어진 로브 (보라색/검정)
- 어둠 마법 오라
- 사악하고 강력한 **최종 보스급**

**프롬프트 예시**:
```
lich king, skeletal undead, corrupted crown, dark magic staff,
purple and black torn robes, dark aura, evil sorcerer,
dark fantasy, final boss, 512x512, transparent background
```

**저장 위치**: `assets/monsters/lich_lord.png`

---

## 📁 디렉토리 구조

```
homeland-discord-bot/
├── assets/
│   └── monsters/
│       ├── skeleton_grunt.png
│       ├── dire_wolf.png
│       ├── undead_knight.png
│       ├── goblin_shaman.png
│       ├── ancient_dragon.png
│       └── lich_lord.png
```

---

## 🔧 이미지 통합 작업 (제작 완료 후)

이미지 제작 완료 후:

1. **monsters.js에 이미지 경로 추가**
```javascript
const MONSTERS = {
  skeletonGrunt: {
    name: '스켈레톤 그런트',
    image: './assets/monsters/skeleton_grunt.png',
    // ... 기존 데이터
  },
  // ...
};
```

2. **Embed에 이미지 표시**
```javascript
embed.setThumbnail(`attachment://skeleton_grunt.png`)
```

3. **Discord.js AttachmentBuilder 사용**
```javascript
const attachment = new AttachmentBuilder('./assets/monsters/skeleton_grunt.png');
interaction.reply({ embeds: [embed], files: [attachment] });
```

---

## ✅ 체크리스트

- [ ] 스켈레톤 그런트 (Zone 1)
- [ ] 다이어울프 (Zone 1)
- [ ] 언데드 기사 (Zone 2)
- [ ] 고블린 주술사 (Zone 2)
- [ ] 고대 드래곤 (Zone 3)
- [ ] 리치 군주 (Zone 3)
- [ ] 이미지 경로 코드 통합
- [ ] Discord Embed 테스트

---

**제작 완료되면 알려주세요!**
