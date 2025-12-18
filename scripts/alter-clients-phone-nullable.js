const { sequelize } = require('../config/database');

async function run() {
  try {
    console.log('Altering clients.phone to allow NULL...');
    await sequelize.authenticate();
    await sequelize.query('ALTER TABLE "clients" ALTER COLUMN "phone" DROP NOT NULL;');
    console.log('✅ Column clients.phone is now NULLABLE');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message || err);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}

module.exports = { run };
