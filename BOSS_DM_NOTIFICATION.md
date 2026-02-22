# 보스 등장 전체 DM 알림 시스템

## 기능 개요
보스 몬스터가 등장하면 해당 서버의 모든 캐릭터 보유 유저에게 DM으로 알림

---

## 보스 등장 시나리오

### 1. 월드 보스 (서버 전체 이벤트)
```
💀 긴급 알림!

━━━━━━━━━━━━━━━━━━
  🐉 전설의 드래곤 등장! 🐉
━━━━━━━━━━━━━━━━━━

📍 위치: 죽음의 산맥
❤️ HP: 50,000 / 50,000
⏰ 제한 시간: 1시간

🎁 처치 보상:
   - 전설 장비 확정 드롭
   - 대량 골드
   - 특별 칭호

⚠️ 서버 전체가 협력해야 처치 가능!

[⚔️ 즉시 참전] [📊 현황 보기]
```

### 2. 일반 보스 (개인 전투)
```
⚡ 보스 발견!

━━━━━━━━━━━━━━━━━━
  👑 언데드 킹 👑
  Lv. 15 (보스)
━━━━━━━━━━━━━━━━━━

📍 현재 Zone 2에 등장 중

🎁 처치 보상:
   - 경험치 +500
   - 골드 +1000
   - 희귀 장비 확정

💪 당신의 레벨: 12
⚠️ 권장 레벨: 15+

[⚔️ 도전하기] [🏠 나중에]
```

---

## 구현 방식

### 1. 보스 등장 로직

**보스 발생 확률:**
- 일반 보스: 5% (전투 시작 시)
- 월드 보스: 랜덤 시간 (1일 1-2회)

**보스 등장 시:**
```javascript
// src/game/combat.js or src/game/worldBoss.js

async function spawnBoss(type, guildId, zoneKey) {
  // 1. 보스 생성
  const boss = createBoss(type);
  
  // 2. 서버 내 모든 캐릭터 보유 유저 조회
  const users = await prisma.character.findMany({
    where: {
      user: {
        // 해당 서버 멤버만 (서버 ID 필터링 필요)
      }
    },
    select: {
      userId: true,
      user: {
        select: {
          discordId: true
        }
      },
      level: true
    }
  });
  
  // 3. 모든 유저에게 DM 발송
  await sendBossNotificationDM(users, boss, zoneKey);
  
  // 4. 서버 채널에도 공지
  await sendBossNotificationChannel(guildId, boss, zoneKey);
}
```

### 2. DM 발송 함수

```javascript
async function sendBossNotificationDM(users, boss, zone) {
  const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  const { EMBED_COLORS, createDivider } = require('../utils/ui');
  
  const bossEmbed = new EmbedBuilder()
    .setColor(EMBED_COLORS.warning)
    .setTitle(`⚡ ${boss.type === 'world' ? '전설의 보스' : '보스'} 발견!`)
    .setDescription([
      createDivider(),
      `  👑 ${boss.name} 👑`,
      `  Lv. ${boss.level} (보스)`,
      createDivider(),
      '',
      `📍 위치: ${zone.name}`,
      `❤️ HP: ${boss.hp.toLocaleString()} / ${boss.maxHp.toLocaleString()}`,
      boss.timeLimit ? `⏰ 제한 시간: ${boss.timeLimit}` : '',
      '',
      '🎁 처치 보상:',
      `   - 경험치 +${boss.xpReward}`,
      `   - 골드 +${boss.goldReward}`,
      `   - ${boss.itemReward}`,
      '',
      boss.type === 'world' 
        ? '⚠️ 서버 전체가 협력해야 처치 가능!'
        : `⚠️ 권장 레벨: ${boss.recommendedLevel}+`,
    ].filter(Boolean).join('\n'))
    .setFooter({
      text: '지금 참전하여 전설적인 보상을 획득하세요!'
    })
    .setTimestamp();
  
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`boss_challenge_${boss.id}`)
      .setLabel('즉시 참전')
      .setEmoji('⚔️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`boss_status_${boss.id}`)
      .setLabel('현황 보기')
      .setEmoji('📊')
      .setStyle(ButtonStyle.Secondary),
  );
  
  // 모든 유저에게 DM 발송 (실패해도 계속 진행)
  for (const userData of users) {
    try {
      const user = await client.users.fetch(userData.userId);
      await user.send({
        embeds: [bossEmbed],
        components: [actionRow]
      });
    } catch (error) {
      // DM 실패 (차단, 설정 등) - 무시하고 계속
      console.log(`Failed to send DM to ${userData.userId}:`, error.message);
    }
  }
}
```

### 3. 서버 채널 공지

```javascript
async function sendBossNotificationChannel(guildId, boss, zone) {
  // 서버의 기본 채널 또는 보스 전용 채널에 공지
  const guild = await client.guilds.fetch(guildId);
  const channel = guild.channels.cache.find(
    ch => ch.name === 'homeland-boss' || ch.name === 'general'
  );
  
  if (channel) {
    await channel.send({
      content: '@everyone',
      embeds: [bossEmbed],
      components: [actionRow]
    });
  }
}
```

---

## DM 알림 설정 (선택적)

### 유저가 알림 ON/OFF 가능

```javascript
// /settings 명령어
module.exports = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('알림 설정을 변경합니다')
    .addStringOption(option =>
      option
        .setName('boss-notification')
        .setDescription('보스 등장 DM 알림')
        .setRequired(true)
        .addChoices(
          { name: '켜기', value: 'on' },
          { name: '끄기', value: 'off' }
        )
    ),
    
  async execute(interaction, { prisma }) {
    const setting = interaction.options.getString('boss-notification');
    
    await prisma.user.update({
      where: { discordId: interaction.user.id },
      data: { bossNotificationEnabled: setting === 'on' }
    });
    
    await interaction.reply({
      content: `보스 알림이 ${setting === 'on' ? '켜졌습니다' : '꺼졌습니다'}.`,
      ephemeral: true
    });
  }
};
```

---

## DB 스키마 추가

### User 모델
```prisma
model User {
  discordId String @id
  username  String
  character Character?
  bossNotificationEnabled Boolean @default(true) // 보스 알림 설정
  guildId   String? // 어느 서버 멤버인지
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### WorldBoss 모델
```prisma
model WorldBoss {
  id              String   @id @default(cuid())
  guildId         String   // 어느 서버의 보스인지
  bossType        String   // 'world' | 'normal'
  name            String
  level           Int
  currentHp       Int
  maxHp           Int
  zone            String
  spawnedAt       DateTime @default(now())
  expiresAt       DateTime? // 월드 보스 제한 시간
  isDefeated      Boolean  @default(false)
  participants    Json     // { userId: damage } 형태
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

---

## 보스 유형별 알림 전략

### 일반 보스 (5% 확률)
- **알림 대상**: 현재 온라인 유저만 (선택)
- **알림 방식**: DM + 서버 채널 공지
- **긴급도**: 중간

### 월드 보스 (1일 1-2회)
- **알림 대상**: 서버 전체 유저
- **알림 방식**: DM + @everyone 공지
- **긴급도**: 높음

### 레어 보스 (0.1% 확률)
- **알림 대상**: 서버 전체 + 인접 서버 (선택)
- **알림 방식**: DM + @everyone + 특별 이펙트
- **긴급도**: 최고

---

## 구현 우선순위

### Phase 1: 기본 DM 알림 (즉시)
- ✅ 보스 등장 시 서버 내 모든 유저에게 DM
- ✅ 서버 채널에도 공지
- ✅ DM 실패 시 무시하고 계속

### Phase 2: 알림 설정 (나중에)
- ✅ `/settings` 명령어로 알림 ON/OFF
- ✅ DB에 설정 저장

### Phase 3: 고급 기능 (나중에)
- ✅ 레벨 필터링 (권장 레벨 이상만 알림)
- ✅ 쿨다운 (너무 자주 안 보내기)
- ✅ 알림 통계 (몇 명에게 발송했는지)

---

## 예상 효과

**Before:**
- 보스 등장해도 아무도 모름
- 우연히 발견한 사람만 혜택

**After:**
- 전체 알림 → 즉시 참여 가능
- 커뮤니티 활성화
- 보스 전투 = 이벤트 느낌
- 유저 리텐션 증가

---

## Codex 구현 지시

**UX 한글화 완료 후 즉시 추가:**

1. ✅ WorldBoss 모델 추가
2. ✅ sendBossNotificationDM() 함수
3. ✅ 보스 등장 시 DM 발송 로직
4. ✅ 서버 채널 공지
5. ✅ DM 버튼 핸들러 (즉시 참전)

**완료 예상: 30분**
