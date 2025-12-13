const { Config } = require('../models');
const logger = require('../utils/logger');

async function initTraccarConfigs() {
  try {
    logger.info('Inicializando configurações padrão do Traccar...');

    const defaultConfigs = [
      {
        key: 'traccar_url',
        value: '',
        description: 'URL do servidor Traccar'
      },
      {
        key: 'traccar_token',
        value: '',
        description: 'Token de autenticação do Traccar'
      },
      {
        key: 'traccar_enabled',
        value: 'false',
        description: 'Habilita integração com Traccar'
      },
      {
        key: 'auto_block_enabled',
        value: 'true',
        description: 'Habilita bloqueio automático no Traccar'
      },
      {
        key: 'block_after_days',
        value: '7',
        description: 'Dias em atraso antes do bloqueio'
      },
      {
        key: 'block_after_amount',
        value: '0',
        description: 'Valor mínimo em atraso para bloqueio (0 = desabilitado)'
      },
      {
        key: 'block_after_count',
        value: '3',
        description: 'Quantidade de cobranças em atraso antes do bloqueio'
      },
      {
        key: 'unblock_on_payment',
        value: 'true',
        description: 'Desbloquear automaticamente ao receber pagamento'
      },
      {
        key: 'whitelist_clients',
        value: '[]',
        description: 'Lista de IDs de clientes isentos do bloqueio automático'
      }
    ];

    for (const config of defaultConfigs) {
      const existing = await Config.findOne({
        where: { key: config.key }
      });

      if (!existing) {
        await Config.create(config);
        logger.info(`Configuração criada: ${config.key} = ${config.value}`);
      } else {
        logger.info(`Configuração já existe: ${config.key}`);
      }
    }

    logger.info('Configurações do Traccar inicializadas com sucesso');

  } catch (error) {
    logger.error('Erro ao inicializar configurações do Traccar:', error);
    throw error;
  }
}

// Executa se chamado diretamente
if (require.main === module) {
  const { sequelize } = require('../config/database');
  
  (async () => {
    try {
      await sequelize.authenticate();
      await initTraccarConfigs();
      process.exit(0);
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  })();
}

module.exports = { initTraccarConfigs };