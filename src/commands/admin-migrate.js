const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-migrate')
    .setDescription('[ADMIN ONLY] Run database migrations')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    // Admin check
    if (interaction.user.id !== '766164672692224010') {
      return interaction.reply({ 
        content: '❌ This command is only for the bot owner.', 
        ephemeral: true 
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const migrations = [
      'migrations/add_spin_system.sql',
      'prisma/migrations/combat_phase1_enhancements/migration.sql',
      'prisma/migrations/add_funnel_tracking.sql'
    ];

    try {
      let results = '🔄 **Running Migrations**\n\n';

      for (const migrationPath of migrations) {
        results += `📄 ${migrationPath}\n`;
        
        const fullPath = path.join(process.cwd(), migrationPath);
        if (!fs.existsSync(fullPath)) {
          results += `  ❌ File not found\n\n`;
          continue;
        }

        const sql = fs.readFileSync(fullPath, 'utf8');
        
        // Split by semicolon and execute
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s && !s.startsWith('--') && s !== '');
        
        let successCount = 0;
        let skipCount = 0;
        
        for (const stmt of statements) {
          if (stmt) {
            try {
              await prisma.$executeRawUnsafe(stmt);
              successCount++;
            } catch (err) {
              if (err.message.includes('already exists')) {
                skipCount++;
              } else {
                throw err;
              }
            }
          }
        }
        
        results += `  ✅ ${successCount} statements executed`;
        if (skipCount > 0) {
          results += `, ${skipCount} skipped (already exists)`;
        }
        results += '\n\n';
      }

      results += '🎉 **Migration completed!**';
      await interaction.editReply(results);
      
    } catch (error) {
      console.error('Migration error:', error);
      await interaction.editReply(
        `❌ Migration failed:\n\`\`\`\n${error.message.substring(0, 1800)}\n\`\`\``
      );
    }
  },
};
