const { Config } = require('../models');
const logger = require('../utils/logger');

async function migrateAutomationTimes() {
  try {
    logger.info('Starting automation time migration...');

    // Check for old hour configs
    const pendingHourConfig = await Config.findOne({ where: { key: 'automation_hour_pending' } });
    const overdueHourConfig = await Config.findOne({ where: { key: 'automation_hour_overdue' } });

    // Check if new time configs already exist
    const pendingTimeConfig = await Config.findOne({ where: { key: 'automation_time_pending' } });
    const overdueTimeConfig = await Config.findOne({ where: { key: 'automation_time_overdue' } });

    // Migrate pending time
    if (pendingHourConfig && !pendingTimeConfig) {
      const hour = parseInt(pendingHourConfig.value) || 9;
      const timeValue = `${hour.toString().padStart(2, '0')}:00`;
      
      await Config.create({
        key: 'automation_time_pending',
        value: timeValue,
        description: 'Horário para execução da automação de avisos (formato HH:MM)',
        type: 'string',
        category: 'automation',
        is_active: true
      });
      
      logger.info(`Created automation_time_pending: ${timeValue} (migrated from hour ${hour})`);
    }

    // Migrate overdue time
    if (overdueHourConfig && !overdueTimeConfig) {
      const hour = parseInt(overdueHourConfig.value) || 11;
      const timeValue = `${hour.toString().padStart(2, '0')}:00`;
      
      await Config.create({
        key: 'automation_time_overdue',
        value: timeValue,
        description: 'Horário para execução da automação de vencidos (formato HH:MM)',
        type: 'string',
        category: 'automation',
        is_active: true
      });
      
      logger.info(`Created automation_time_overdue: ${timeValue} (migrated from hour ${hour})`);
    }

    logger.info('Automation time migration completed successfully');

  } catch (error) {
    logger.error('Migration error:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateAutomationTimes()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateAutomationTimes };