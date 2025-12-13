const { sequelize } = require('../config/database');

async function verifyDatabase() {
  try {
    console.log('🔍 Verificando estrutura do banco de dados...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Conexão com banco estabelecida');
    
    // Get all tables
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('\n📋 Tabelas encontradas:');
    tables.forEach(table => {
      console.log(`   - ${table.table_name}`);
    });
    
    // Expected tables
    const expectedTables = [
      'users',
      'clients', 
      'payments',
      'configs',
      'message_logs',
      'automation_logs', 
      'message_templates',
      'webhook_logs'
    ];
    
    console.log('\n🔍 Verificando tabelas obrigatórias...');
    const existingTables = tables.map(t => t.table_name);
    
    let allTablesExist = true;
    for (const expectedTable of expectedTables) {
      if (existingTables.includes(expectedTable)) {
        console.log(`✅ ${expectedTable}`);
      } else {
        console.log(`❌ ${expectedTable} - AUSENTE!`);
        allTablesExist = false;
      }
    }
    
    if (allTablesExist) {
      console.log('\n🎉 Todas as tabelas obrigatórias estão presentes!');
      
      // Count records in each table
      console.log('\n📊 Contagem de registros:');
      for (const table of expectedTables) {
        try {
          const [result] = await sequelize.query(`SELECT COUNT(*) as count FROM ${table}`);
          console.log(`   ${table}: ${result[0].count} registros`);
        } catch (error) {
          console.log(`   ${table}: Erro ao contar - ${error.message}`);
        }
      }
    } else {
      console.log('\n⚠️  Algumas tabelas estão ausentes. Execute o script de inicialização:');
      console.log('   node scripts/init-database.js');
    }
    
    // Check admin user
    const [adminCheck] = await sequelize.query(`
      SELECT EXISTS(SELECT 1 FROM users WHERE email = 'admin@noty.com') as admin_exists;
    `);
    
    if (adminCheck[0].admin_exists) {
      console.log('\n👤 Usuário administrador: ✅ Configurado');
    } else {
      console.log('\n👤 Usuário administrador: ❌ Ausente');
    }
    
    // Check configurations
    const [configCheck] = await sequelize.query(`
      SELECT COUNT(*) as count FROM configs;
    `);
    
    console.log(`\n⚙️  Configurações: ${configCheck[0].count} registros`);
    
    // Check templates
    const [templateCheck] = await sequelize.query(`
      SELECT COUNT(*) as count FROM message_templates;
    `);
    
    console.log(`📝 Templates: ${templateCheck[0].count} registros`);
    
    console.log('\n✅ Verificação concluída!');
    
  } catch (error) {
    console.error('❌ Erro na verificação:', error);
    throw error;
  }
}

// Execute verification if this file is run directly
if (require.main === module) {
  verifyDatabase()
    .then(() => {
      console.log('\nVerificação finalizada com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Erro na verificação:', error);
      process.exit(1);
    });
}

module.exports = { verifyDatabase };