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
      'webhook_logs',
      'traccar_integrations'
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
    
    // Check clients.phone nullability
    console.log('\n🔍 Verificando nulabilidade de clients.phone...');
    const [phoneNullability] = await sequelize.query(`
      SELECT is_nullable FROM information_schema.columns 
      WHERE table_name = 'clients' AND column_name = 'phone';
    `);

    if (phoneNullability.length > 0) {
      const isNullable = (phoneNullability[0].is_nullable || '').toUpperCase() === 'YES';
      if (isNullable) {
        console.log('✅ Coluna clients.phone permite NULL');
      } else {
        console.log('⚠️ Coluna clients.phone NÃO permite NULL (pode quebrar a sincronização do Asaas)');
        if (process.env.AUTO_FIX_CLIENTS_PHONE_NULLABLE === 'true') {
          try {
            console.log('🛠️  Corrigindo: tornando clients.phone NULLABLE...');
            await sequelize.query('ALTER TABLE "clients" ALTER COLUMN "phone" DROP NOT NULL;');
            console.log('✅ Column clients.phone agora permite NULL');
          } catch (fixErr) {
            console.log('❌ Falha ao corrigir automaticamente:', fixErr.message || fixErr);
            console.log('➡️  Execute manualmente: npm run migrate:clients:phone-nullable');
          }
        } else {
          console.log('➡️  Recomenda-se executar: npm run migrate:clients:phone-nullable');
          console.log('    ou defina AUTO_FIX_CLIENTS_PHONE_NULLABLE=true para correção automática');
        }
      }
    } else {
      console.log('❓ Não foi possível determinar a nulabilidade de clients.phone');
    }
    
    // Check ENUM values for message_templates.type
    console.log('\n🔎 Verificando ENUM message_templates.type...');
    try {
      const enumTypeName = 'enum_message_templates_type';
      const [enumValues] = await sequelize.query(`
        SELECT e.enumlabel AS value
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = :enumTypeName
        ORDER BY e.enumsortorder;`, { replacements: { enumTypeName } });

      const values = enumValues.map(v => v.value);
      console.log('   Valores atuais:', values.join(', '));

      const requiredEnumValues = ['traccar_warning_threshold', 'traccar_warning_final'];
      let enumOk = true;
      for (const val of requiredEnumValues) {
        if (!values.includes(val)) {
          enumOk = false;
          console.log(`❌ ENUM ausente: ${val}`);
        } else {
          console.log(`✅ ENUM presente: ${val}`);
        }
      }

      if (!enumOk) {
        console.log('\n➡️  Aplique a migração de ENUM antes do seed:');
        console.log('   npm run migrate:templates-enum');
      }
    } catch (e) {
      console.log('⚠️  Não foi possível verificar ENUM de templates:', e.message || e);
    }

    // Check presence of Traccar templates
    console.log('\n🔎 Verificando templates Traccar...');
    try {
      const requiredTemplates = [
        'traccar_block',
        'traccar_unblock',
        'traccar_warning',
        'traccar_warning_threshold',
        'traccar_warning_final'
      ];
      const [existingTemplates] = await sequelize.query(`
        SELECT type FROM message_templates WHERE type = ANY(:types)
      `, { replacements: { types: requiredTemplates } });

      const existingTypes = new Set(existingTemplates.map(r => r.type));
      let allTemplatesOk = true;
      for (const t of requiredTemplates) {
        if (existingTypes.has(t)) {
          console.log(`✅ Template presente: ${t}`);
        } else {
          allTemplatesOk = false;
          console.log(`❌ Template ausente: ${t}`);
        }
      }

      if (!allTemplatesOk) {
        console.log('\n➡️  Execute os seeds para criar/atualizar templates:');
        console.log('   npm run seed:new-traccar-templates');
        console.log('   node scripts/init-traccar-templates.js');
      }
    } catch (e) {
      console.log('⚠️  Não foi possível verificar templates Traccar:', e.message || e);
    }

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