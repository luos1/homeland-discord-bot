const express = require('express');
const cors = require('cors');

const ADMIN_KEY = process.env.ADMIN_KEY || 'homeland-admin-secret-2025';

function createAdminRouter(prisma, client) {
  const router = express.Router();

  // CORS
  router.use(cors({
    origin: [
      'https://luos1.github.io',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
    ],
  }));

  router.use(express.json());

  // Auth middleware
  router.use((req, res, next) => {
    const key = req.headers['x-admin-key'];
    if (key !== ADMIN_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  });

  // Stats
  router.get('/stats', async (req, res) => {
    try {
      const totalUsers = await prisma.character.count();
      
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const activeUsers = await prisma.character.count({
        where: { updatedAt: { gte: oneDayAgo } }
      });

      const goldAgg = await prisma.character.aggregate({
        _sum: { gold: true }
      });

      const premiumUsers = await prisma.premiumSubscription.count({
        where: { endDate: { gte: new Date() } }
      });

      res.json({
        totalUsers,
        activeUsers,
        totalGold: goldAgg._sum.gold || 0,
        premiumUsers
      });
    } catch (error) {
      console.error('[Admin] Stats error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Search User
  router.get('/user', async (req, res) => {
    try {
      const { discordId, name } = req.query;
      
      let user = null;
      if (discordId) {
        user = await prisma.character.findFirst({
          where: { odUserId: discordId }
        });
      } else if (name) {
        user = await prisma.character.findFirst({
          where: { name: { contains: name, mode: 'insensitive' } }
        });
      }

      if (!user) {
        return res.json({ user: null });
      }

      res.json({ user });
    } catch (error) {
      console.error('[Admin] User search error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Give Gold/Gems
  router.post('/give', async (req, res) => {
    try {
      const { discordId, type, amount, reason } = req.body;

      if (!discordId || !type || !amount) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const character = await prisma.character.findFirst({
        where: { odUserId: discordId }
      });

      if (!character) {
        return res.status(404).json({ error: 'Character not found' });
      }

      const updateData = {};
      if (type === 'gold') {
        updateData.gold = { increment: amount };
      } else if (type === 'gems') {
        updateData.gems = { increment: amount };
      }

      await prisma.character.update({
        where: { id: character.id },
        data: updateData
      });

      console.log(`[Admin] Gave ${amount} ${type} to ${character.name} (${discordId}). Reason: ${reason}`);

      // Send DM notification
      try {
        const user = await client.users.fetch(discordId);
        await user.send(`🎁 **운영자 지급**\n${type === 'gold' ? '💰 골드' : '💎 젬'}: +${amount}\n사유: ${reason || '없음'}`);
      } catch (dmError) {
        console.error('[Admin] Failed to send DM:', dmError);
      }

      res.json({ ok: true });
    } catch (error) {
      console.error('[Admin] Give error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Give Premium
  router.post('/premium', async (req, res) => {
    try {
      const { discordId, days } = req.body;

      if (!discordId || !days) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const character = await prisma.character.findFirst({
        where: { odUserId: discordId }
      });

      if (!character) {
        return res.status(404).json({ error: 'Character not found' });
      }

      const now = new Date();
      const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      await prisma.premiumSubscription.upsert({
        where: { odUserId: discordId },
        update: { endDate, updatedAt: now },
        create: { odUserId: discordId, startDate: now, endDate }
      });

      console.log(`[Admin] Gave ${days} days premium to ${character.name} (${discordId})`);

      // Send DM notification
      try {
        const user = await client.users.fetch(discordId);
        await user.send(`⭐ **프리미엄 지급**\n기간: ${days}일\n만료일: ${endDate.toLocaleDateString()}\n\n프리미엄 혜택을 즐겨주세요! 🎉`);
      } catch (dmError) {
        console.error('[Admin] Failed to send DM:', dmError);
      }

      res.json({ ok: true });
    } catch (error) {
      console.error('[Admin] Premium error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Send Announcement
  router.post('/announce', async (req, res) => {
    try {
      const { title, content, channelId } = req.body;

      if (!title || !content || !channelId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const channel = await client.channels.fetch(channelId);
      if (!channel) {
        return res.status(404).json({ error: 'Channel not found' });
      }

      const message = `# ${title}\n\n${content}`;
      await channel.send(message);

      console.log(`[Admin] Sent announcement to ${channelId}: ${title}`);

      res.json({ ok: true });
    } catch (error) {
      console.error('[Admin] Announce error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = { createAdminRouter };
