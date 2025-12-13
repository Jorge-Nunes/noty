const {
  sequelize,
  User,
  Client,
  Payment,
  Config,
  MessageLog,
  AutomationLog,
  MessageTemplate,
  WebhookLog
} = require('../models');
const bcrypt = require('bcryptjs');
const TemplateService = require('../services/TemplateService');
const { initTraccarConfigs } = require('./init-traccar-configs');
const logger = require('../utils/logger');

async function initializeDatabase() {
  try {
    console.log('🔄 Inicializando banco de dados...');

    // Test connection
    await sequelize.authenticate();
    console.log('✅ Conexão com banco de dados estabelecida');

    // Sync all models (ensure all tables are created)
    console.log('📋 Criando/verificando tabelas do banco de dados...');

    // Force sync to ensure all tables and associations are properly created
    await sequelize.sync({ force: false, alter: false });

    // Verify all tables exist
    const tableNames = [
      'users', 'clients', 'payments', 'configs',
      'message_logs', 'automation_logs', 'message_templates', 'webhook_logs',
      'traccar_integrations'
    ];

    for (const tableName of tableNames) {
      const [results] = await sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = '${tableName}'
        );
      `);

      if (results[0].exists) {
        console.log(`✅ Tabela '${tableName}' verificada`);
      } else {
        console.warn(`⚠️  Tabela '${tableName}' não encontrada`);
      }
    }

    console.log('✅ Modelos sincronizados e tabelas verificadas');

    // Create default admin user if not exists
    const adminEmail = 'admin@noty.com';
    let adminUser = await User.findOne({ where: { email: adminEmail } });

    if (!adminUser) {
      adminUser = await User.create({
        name: 'Administrator',
        email: adminEmail,
        password: 'admin123', // Will be hashed automatically
        role: 'admin'
      });
      console.log('✅ Usuário administrador criado');
      console.log(`📧 Email: ${adminEmail}`);
      console.log(`🔑 Senha: admin123`);
    } else {
      console.log('ℹ️  Usuário administrador já existe');
    }

    // Create default configurations
    const defaultConfigs = [
      // Asaas configurations
      {
        key: 'asaas_api_url',
        value: 'https://api-sandbox.asaas.com/v3',
        description: 'URL da API do Asaas (sandbox ou produção)',
        type: 'string',
        category: 'asaas'
      },
      {
        key: 'asaas_access_token',
        value: '',
        description: 'Token de acesso da API do Asaas',
        type: 'string',
        category: 'asaas'
      },

      // Evolution API configurations
      {
        key: 'evolution_api_url',
        value: 'http://api.evo.dedyn.io:8081',
        description: 'URL da API Evolution',
        type: 'string',
        category: 'evolution'
      },
      {
        key: 'evolution_api_key',
        value: '',
        description: 'Chave da API Evolution',
        type: 'string',
        category: 'evolution'
      },
      {
        key: 'evolution_instance',
        value: '',
        description: 'Nome da instância Evolution',
        type: 'string',
        category: 'evolution'
      },

      // Automation configurations
      {
        key: 'warning_days',
        value: '2',
        description: 'Dias de antecedência para envio de avisos',
        type: 'number',
        category: 'automation'
      },
      {
        key: 'automation_hour_pending',
        value: '9',
        description: 'Hora para execução da automação de avisos (formato 24h)',
        type: 'number',
        category: 'automation'
      },
      {
        key: 'automation_hour_overdue',
        value: '11',
        description: 'Hora para execução da automação de vencidos (formato 24h)',
        type: 'number',
        category: 'automation'
      },

      // General configurations
      {
        key: 'company_name',
        value: 'TEKSAT Rastreamento Veicular',
        description: 'Nome da empresa para as mensagens',
        type: 'string',
        category: 'general'
      },
      {
        key: 'auto_sync_enabled',
        value: 'true',
        description: 'Sincronização automática habilitada',
        type: 'boolean',
        category: 'automation'
      },
      {
        key: 'notifications_enabled',
        value: 'true',
        description: 'Notificações automáticas habilitadas',
        type: 'boolean',
        category: 'automation'
      }
    ];

    for (const configData of defaultConfigs) {
      const [config, created] = await Config.findOrCreate({
        where: { key: configData.key },
        defaults: configData
      });

      if (created) {
        console.log(`✅ Configuração criada: ${configData.key}`);
      }
    }

    console.log('✅ Configurações padrão inicializadas');

    // Initialize default message templates
    console.log('🔄 Inicializando templates de mensagens...');
    await TemplateService.initializeDefaultTemplates();
    console.log('✅ Templates de mensagens inicializados');

    // Initialize Traccar configurations
    try {
      await initTraccarConfigs();
      logger.info('✅ Configurações do Traccar inicializadas');
    } catch (error) {
      logger.warn('⚠️  Configurações do Traccar já existem ou falharam ao inicializar');
    }

    console.log('🎉 Banco de dados inicializado com sucesso!');
    console.log('');
    console.log('📋 Próximos passos:');
    console.log('1. Configure as APIs do Asaas e Evolution no painel de configurações');
    console.log('2. Configure a integração com Traccar em /traccar');
    console.log('3. Execute a sincronização manual para importar dados');
    console.log('4. Configure os horários de automação conforme necessário');
    console.log('');

  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    throw error;
  }
}

// Run initialization if this file is executed directly
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('Inicialização concluída');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Falha na inicialização:', error);
      process.exit(1);
    });
}

module.exports = { initializeDatabase };