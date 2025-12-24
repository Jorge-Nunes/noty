const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { Config, Client, TraccarIntegration } = require('../models');
const TraccarService = require('../services/TraccarService');
const TraccarNotificationService = require('../services/TraccarNotificationService');
const PaymentQueries = require('../utils/paymentQueries');
const logger = require('../utils/logger');
const Joi = require('joi');

// Schema de validação para configuração
const configSchema = Joi.object({
  traccar_url: Joi.string().uri().required().messages({
    'string.uri': 'URL do Traccar deve ser válida',
    'any.required': 'URL do Traccar é obrigatória'
  }),
  traccar_token: Joi.string().min(10).required().messages({
    'string.min': 'Token deve ter pelo menos 10 caracteres',
    'any.required': 'Token do Traccar é obrigatório'
  }),
  traccar_enabled: Joi.boolean().default(true)
});

// Schema para regras de bloqueio
const blockRulesSchema = Joi.object({
  auto_block_enabled: Joi.boolean().default(true),
  block_after_days: Joi.number().integer().min(1).max(365).default(7),
  block_after_amount: Joi.number().min(0).default(0),
  block_after_count: Joi.number().integer().min(1).default(3),
  unblock_on_payment: Joi.boolean().default(true),
  whitelist_clients: Joi.array().items(Joi.string().uuid()).default([])
});

/**
 * GET /api/traccar/config
 * Busca configurações do Traccar
 */
router.get('/config', authMiddleware, async (req, res) => {
  try {
    const configs = await Config.findAll({
      where: {
        key: [
          'traccar_url', 'traccar_token', 'traccar_enabled',
          'auto_block_enabled', 'block_strategy', 'block_after_count', 'warn_after_days', 'block_after_days', 'unblock_on_payment',
          'whitelist_clients', 'traccar_notifications_enabled'
        ]
      }
    });

    const configObj = {};
    configs.forEach(config => {
      let value = config.value;

      // Converte valores para tipos apropriados
      if (['traccar_enabled', 'auto_block_enabled', 'unblock_on_payment', 'traccar_notifications_enabled'].includes(config.key)) {
        value = value === 'true';
      } else if (['block_after_count','warn_after_days','block_after_days'].includes(config.key)) {
        value = parseInt(value);
        if (Number.isNaN(value)) value = undefined;
      } else if (config.key === 'block_strategy') {
        value = (value === 'days') ? 'days' : 'count';
      } else if (config.key === 'whitelist_clients') {
        try {
          value = JSON.parse(value || '[]');
        } catch (e) {
          value = [];
        }
      }

      configObj[config.key] = value;
    });

    // Valores padrão
    const defaultConfig = {
      traccar_url: '',
      traccar_token: '',
      traccar_enabled: false,
      auto_block_enabled: true,
      block_strategy: 'count',
      block_after_count: 3,
      warn_after_days: 5,
      block_after_days: 10,
      unblock_on_payment: true,
      whitelist_clients: [],
      traccar_notifications_enabled: true
    };

    const finalConfig = { ...defaultConfig, ...configObj };

    // Remove token sensível da resposta (mostra apenas primeiros e últimos caracteres)
    if (finalConfig.traccar_token) {
      const token = finalConfig.traccar_token;
      finalConfig.traccar_token_display = token.length > 10
        ? `${token.slice(0, 4)}...${token.slice(-4)}`
        : '****';
    }

    res.json({
      success: true,
      config: finalConfig
    });

  } catch (error) {
    logger.error('Erro ao buscar configurações do Traccar:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/traccar/config
 * Salva configurações do Traccar
 */
router.post('/config', authMiddleware, async (req, res) => {
  try {
    // Cria schema completo que aceita tanto o formato antigo quanto o novo
    const completeSchema = Joi.object({
      traccar_url: Joi.string().uri().required().messages({
        'string.uri': 'URL do Traccar deve ser válida',
        'any.required': 'URL do Traccar é obrigatória'
      }),
      traccar_token: Joi.string().min(10).required().messages({
        'string.min': 'Token deve ter pelo menos 10 caracteres',
        'any.required': 'Token do Traccar é obrigatório'
      }),
      traccar_enabled: Joi.boolean().default(true),
      // Aceita regras tanto no nível raiz quanto aninhadas
      rules: Joi.object({
        auto_block_enabled: Joi.boolean().default(true),
        block_strategy: Joi.string().valid('count','days').default('count'),
        block_after_count: Joi.number().integer().min(1).max(20).default(3),
        warn_after_days: Joi.number().integer().min(1).max(365).default(5),
        block_after_days: Joi.number().integer().min(1).max(365).default(10),
        unblock_on_payment: Joi.boolean().default(true),
        whitelist_clients: Joi.array().items(Joi.string().uuid()).default([]),
        traccar_notifications_enabled: Joi.boolean().default(true)
      }).optional(),
      // Aceita também no nível raiz para compatibilidade
      auto_block_enabled: Joi.boolean().default(true),
      block_strategy: Joi.string().valid('count','days').default('count'),
      block_after_count: Joi.number().integer().min(1).max(20).default(3),
      warn_after_days: Joi.number().integer().min(1).max(365).default(5),
      block_after_days: Joi.number().integer().min(1).max(365).default(10),
      unblock_on_payment: Joi.boolean().default(true),
      whitelist_clients: Joi.array().items(Joi.string().uuid()).default([]),
      traccar_notifications_enabled: Joi.boolean().default(true)
    });

    // Valida todo o payload
    const { error, value: validatedData } = completeSchema.validate(req.body, { allowUnknown: true });
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    // Salva configurações básicas
    const configsToSave = [
      { key: 'traccar_url', value: validatedData.traccar_url },
      { key: 'traccar_token', value: validatedData.traccar_token },
      { key: 'traccar_enabled', value: String(validatedData.traccar_enabled) }
    ];

    // Pega regras do objeto aninhado ou do nível raiz
    const rules = validatedData.rules || {
      auto_block_enabled: validatedData.auto_block_enabled,
      block_strategy: validatedData.block_strategy,
      block_after_count: validatedData.block_after_count,
      warn_after_days: validatedData.warn_after_days,
      block_after_days: validatedData.block_after_days,
      unblock_on_payment: validatedData.unblock_on_payment,
      whitelist_clients: validatedData.whitelist_clients,
      traccar_notifications_enabled: validatedData.traccar_notifications_enabled
    };

    // Adiciona regras se houver dados válidos
    if (rules && typeof rules === 'object') {
      if (rules.auto_block_enabled !== undefined) {
        configsToSave.push({ key: 'auto_block_enabled', value: String(rules.auto_block_enabled) });
      }
      // Migração suave: persiste novas chaves se presentes
      if (rules.block_strategy !== undefined) {
        configsToSave.push({ key: 'block_strategy', value: String(rules.block_strategy) });
      }
      if (rules.block_after_count !== undefined) {
        configsToSave.push({ key: 'block_after_count', value: String(rules.block_after_count) });
      }
      if (rules.warn_after_days !== undefined) {
        configsToSave.push({ key: 'warn_after_days', value: String(rules.warn_after_days) });
      }
      if (rules.block_after_days !== undefined) {
        configsToSave.push({ key: 'block_after_days', value: String(rules.block_after_days) });
      }
      if (rules.unblock_on_payment !== undefined) {
        configsToSave.push({ key: 'unblock_on_payment', value: String(rules.unblock_on_payment) });
      }
      if (rules.whitelist_clients !== undefined) {
        configsToSave.push({ key: 'whitelist_clients', value: JSON.stringify(rules.whitelist_clients || []) });
      }
      if (rules.traccar_notifications_enabled !== undefined) {
        configsToSave.push({ key: 'traccar_notifications_enabled', value: String(rules.traccar_notifications_enabled) });
      }
    }

    // Salva no banco
    for (const config of configsToSave) {
      await Config.upsert(config);
    }

    // Testa a conexão com as novas configurações
    let connectionTest = null;
    try {
      await TraccarService.initialize();
      connectionTest = await TraccarService.testConnection();
    } catch (error) {
      connectionTest = {
        success: false,
        error: error.message
      };
    }

    logger.info('Configurações do Traccar atualizadas');

    res.json({
      success: true,
      message: 'Configurações salvas com sucesso',
      connectionTest
    });

  } catch (error) {
    logger.error('Erro ao salvar configurações do Traccar:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/traccar/test-connection
 * Testa conexão com Traccar
 */
router.get('/test-connection', authMiddleware, async (req, res) => {
  try {
    const status = await TraccarService.getServiceStatus();

    if (status.status === 'active') {
      res.json({
        success: true,
        message: 'Conexão estabelecida com sucesso',
        server: status.server
      });
    } else {
      res.status(400).json({
        success: false,
        message: status.message,
        status: status.status
      });
    }

  } catch (error) {
    logger.error('Erro ao testar conexão:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao testar conexão'
    });
  }
});

/**
 * GET /api/traccar/users
 * Lista usuários do Traccar
 */
router.get('/users', authMiddleware, async (req, res) => {
  try {
    const users = await TraccarService.getAllUsers();

    res.json({
      success: true,
      users: users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        disabled: user.disabled,
        administrator: user.administrator
      }))
    });

  } catch (error) {
    logger.error('Erro ao listar usuários do Traccar:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar usuários'
    });
  }
});

/**
 * POST /api/traccar/sync-clients
 * Sincroniza clientes com Traccar
 */
router.post('/sync-clients', authMiddleware, async (req, res) => {
  try {
    logger.info('Iniciando sincronização de clientes Traccar');

    const clients = await Client.findAll({
      include: [{
        model: TraccarIntegration,
        as: 'TraccarIntegration',
        required: false
      }]
    });

    logger.info(`Encontrados ${clients.length} clientes para sincronizar`);
    const syncResults = [];

    for (const client of clients) {
      logger.info(`Processando cliente: ${client.name} (${client.id})`);

      let integration = client.TraccarIntegration;
      let traccarUser = null;
      let mappingMethod = 'NOT_MAPPED';

      try {
        // Tenta mapear por email primeiro
        if (client.email) {
          logger.info(`Buscando usuário Traccar por email: ${client.email}`);
          traccarUser = await TraccarService.findUserByEmail(client.email);
          if (traccarUser) {
            mappingMethod = 'EMAIL';
            logger.info(`Usuário encontrado por email: ${traccarUser.name} (${traccarUser.id})`);
          }
        }

        // Se não encontrou por email, tenta por telefone
        if (!traccarUser && client.mobile_phone) {
          logger.info(`Buscando usuário Traccar por telefone: ${client.mobile_phone}`);
          traccarUser = await TraccarService.findUserByPhone(client.mobile_phone);
          if (traccarUser) {
            mappingMethod = 'PHONE';
            logger.info(`Usuário encontrado por telefone: ${traccarUser.name} (${traccarUser.id})`);
          }
        }

        // Cria ou atualiza integração
        const integrationData = {
          client_id: client.id,
          traccar_user_id: traccarUser?.id || null,
          traccar_email: traccarUser?.email || null,
          traccar_phone: traccarUser?.phone || null,
          mapping_method: mappingMethod,
          last_sync_at: new Date(),
          traccar_user_data: traccarUser || null,
          sync_errors: null
        };

        if (integration) {
          await integration.update(integrationData);
        } else {
          integration = await TraccarIntegration.create(integrationData);
        }

        syncResults.push({
          client_id: client.id,
          client_name: client.name,
          client_email: client.email,
          client_phone: client.mobile_phone,
          mapped: !!traccarUser,
          mapping_method: mappingMethod,
          traccar_user: traccarUser ? {
            id: traccarUser.id,
            name: traccarUser.name,
            email: traccarUser.email,
            disabled: traccarUser.disabled
          } : null
        });

      } catch (error) {
        logger.error(`Erro ao sincronizar cliente ${client.id}:`, error);

        // Salva erro na integração
        if (integration) {
          await integration.update({
            sync_errors: error.message,
            last_sync_at: new Date()
          });
        }

        syncResults.push({
          client_id: client.id,
          client_name: client.name,
          mapped: false,
          error: error.message
        });
      }
    }

    const summary = {
      total: syncResults.length,
      mapped: syncResults.filter(r => r.mapped).length,
      unmapped: syncResults.filter(r => !r.mapped && !r.error).length,
      errors: syncResults.filter(r => r.error).length
    };

    logger.info('Sincronização de clientes concluída:', summary);

    res.json({
      success: true,
      message: 'Sincronização concluída',
      summary,
      results: syncResults
    });

  } catch (error) {
    logger.error('Erro na sincronização de clientes:', error);
    res.status(500).json({
      success: false,
      message: 'Erro na sincronização'
    });
  }
});

/**
 * POST /api/traccar/clients/:clientId/block
 * Bloqueia cliente no Traccar
 */
router.post('/clients/:clientId/block', authMiddleware, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { reason } = req.body;

    const client = await Client.findByPk(clientId, {
      include: [{ model: TraccarIntegration, as: 'TraccarIntegration' }]
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Cliente não encontrado'
      });
    }

    const integration = client.TraccarIntegration;
    if (!integration || !integration.traccar_user_id) {
      return res.status(400).json({
        success: false,
        message: 'Cliente não está mapeado com Traccar'
      });
    }

    // Bloqueia no Traccar
    await TraccarService.blockUser(integration.traccar_user_id, reason);

    // Atualiza integração
    await integration.update({
      is_blocked: true,
      block_reason: reason,
      last_block_at: new Date(),
      last_sync_at: new Date()
    });

    logger.info(`Cliente ${client.name} bloqueado manualmente no Traccar`);

    // Envia notificação via WhatsApp
    try {
      const notificationResult = await TraccarNotificationService.sendBlockNotification(clientId, {
        reason: reason || 'Bloqueio manual',
        overdue_amount: 0,
        overdue_count: 0,
        overdue_days: 0
      });

      if (notificationResult.success) {
        logger.info(`Notificação de bloqueio enviada para ${client.name}`);
      } else {
        logger.warn(`Falha ao enviar notificação de bloqueio para ${client.name}: ${notificationResult.message}`);
      }
    } catch (notificationError) {
      logger.error(`Erro ao enviar notificação de bloqueio para ${client.name}:`, notificationError);
    }

    res.json({
      success: true,
      message: 'Cliente bloqueado com sucesso'
    });

  } catch (error) {
    logger.error('Erro ao bloquear cliente:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/traccar/clients/:clientId/unblock
 * Desbloqueia cliente no Traccar
 */
router.post('/clients/:clientId/unblock', authMiddleware, async (req, res) => {
  try {
    const { clientId } = req.params;

    const client = await Client.findByPk(clientId, {
      include: [{ model: TraccarIntegration, as: 'TraccarIntegration' }]
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Cliente não encontrado'
      });
    }

    const integration = client.TraccarIntegration;
    if (!integration || !integration.traccar_user_id) {
      return res.status(400).json({
        success: false,
        message: 'Cliente não está mapeado com Traccar'
      });
    }

    // Desbloqueia no Traccar
    await TraccarService.unblockUser(integration.traccar_user_id);

    // Atualiza integração
    await integration.update({
      is_blocked: false,
      block_reason: null,
      last_unblock_at: new Date(),
      last_sync_at: new Date()
    });

    logger.info(`Cliente ${client.name} desbloqueado manualmente no Traccar`);

    // Envia notificação via WhatsApp
    try {
      const notificationResult = await TraccarNotificationService.sendUnblockNotification(clientId);

      if (notificationResult.success) {
        logger.info(`Notificação de desbloqueio enviada para ${client.name}`);
      } else {
        logger.warn(`Falha ao enviar notificação de desbloqueio para ${client.name}: ${notificationResult.message}`);
      }
    } catch (notificationError) {
      logger.error(`Erro ao enviar notificação de desbloqueio para ${client.name}:`, notificationError);
    }

    res.json({
      success: true,
      message: 'Cliente desbloqueado com sucesso'
    });

  } catch (error) {
    logger.error('Erro ao desbloquear cliente:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/traccar/status
 * Status da integração
 */
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const serviceStatus = await TraccarService.getServiceStatus();

    // Estatísticas gerais
    const totalClients = await Client.count();
    const mappedClients = await TraccarIntegration.count({
      where: { mapping_method: ['EMAIL', 'PHONE', 'MANUAL'] }
    });
    const blockedClients = await TraccarIntegration.count({
      where: { is_blocked: true }
    });

    res.json({
      success: true,
      service: serviceStatus,
      stats: {
        total_clients: totalClients,
        mapped_clients: mappedClients,
        unmapped_clients: totalClients - mappedClients,
        blocked_clients: blockedClients,
        mapping_percentage: totalClients > 0 ? Math.round((mappedClients / totalClients) * 100) : 0
      }
    });

  } catch (error) {
    logger.error('Erro ao buscar status:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar status'
    });
  }
});

/**
 * POST /api/traccar/run-automation
 * Executa automação do Traccar manualmente
 */
router.post('/run-automation', authMiddleware, async (req, res) => {
  try {
    const TraccarAutomationService = require('../services/TraccarAutomationService');

    logger.info('Iniciando automação Traccar manualmente');

    await TraccarAutomationService.runAutomation();

    logger.info('Automação Traccar concluída manualmente');

    res.json({
      success: true,
      message: 'Automação Traccar executada com sucesso'
    });

  } catch (error) {
    logger.error('Erro ao executar automação Traccar:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/traccar/clients/:clientId/reset-block-status
 * Reseta o status de bloqueio do cliente para permitir que a automação o processe novamente
 */
router.post('/clients/:clientId/reset-block-status', authMiddleware, async (req, res) => {
  try {
    const { clientId } = req.params;

    const client = await Client.findByPk(clientId, {
      include: [{ model: TraccarIntegration, as: 'TraccarIntegration' }]
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Cliente não encontrado'
      });
    }

    const integration = client.TraccarIntegration;
    if (!integration) {
      return res.status(400).json({
        success: false,
        message: 'Cliente não possui integração com Traccar'
      });
    }

    // Reseta o status de bloqueio local
    await integration.update({
      is_blocked: false,
      block_reason: null,
      last_sync_at: new Date()
    });

    logger.info(`Status de bloqueio resetado para cliente ${client.name}`);

    res.json({
      success: true,
      message: 'Status de bloqueio resetado com sucesso. A automação poderá processar este cliente novamente.'
    });

  } catch (error) {
    logger.error('Erro ao resetar status de bloqueio:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/traccar/clients/:clientId/debug
 * Retorna informações de debug do cliente para diagnóstico
 */
router.get('/clients/:clientId/debug', authMiddleware, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { Payment } = require('../models');
    const { Op } = require('sequelize');

    const client = await Client.findByPk(clientId, {
      include: [
        { model: TraccarIntegration, as: 'TraccarIntegration' },
        {
          model: Payment,
          as: 'payments',
          where: PaymentQueries.getOverdueCondition(),
          required: false
        }
      ]
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Cliente não encontrado'
      });
    }

    // Busca configurações de automação
    const configs = await Config.findAll({
      where: {
        key: ['traccar_enabled', 'auto_block_enabled', 'block_after_count', 'whitelist_clients']
      }
    });

    const configObj = {};
    configs.forEach(config => {
      configObj[config.key] = config.value;
    });

    const integration = client.TraccarIntegration;
    const overduePayments = client.payments || [];
    const blockAfterCount = parseInt(configObj.block_after_count) || 3;
    const whitelist = JSON.parse(configObj.whitelist_clients || '[]');

    // Análise do status
    const analysis = {
      client_name: client.name,
      client_id: client.id,
      traccar_integration: integration ? {
        traccar_user_id: integration.traccar_user_id,
        is_blocked: integration.is_blocked,
        auto_block_enabled: integration.auto_block_enabled,
        mapping_method: integration.mapping_method,
        block_reason: integration.block_reason,
        last_block_at: integration.last_block_at,
        last_sync_at: integration.last_sync_at
      } : null,
      overdue_payments: {
        count: overduePayments.length,
        total_amount: overduePayments.reduce((sum, p) => sum + parseFloat(p.value || 0), 0),
        payments: overduePayments.map(p => ({
          id: p.id,
          asaas_id: p.asaas_id,
          value: p.value,
          due_date: p.due_date,
          status: p.status
        }))
      },
      automation_config: {
        traccar_enabled: configObj.traccar_enabled === 'true',
        auto_block_enabled: configObj.auto_block_enabled === 'true',
        block_after_count: blockAfterCount,
        is_whitelisted: whitelist.includes(client.id)
      },
      should_be_blocked: {
        meets_count_criteria: overduePayments.length >= blockAfterCount,
        has_traccar_mapping: !!(integration && integration.traccar_user_id),
        is_not_blocked: !(integration && integration.is_blocked),
        auto_block_enabled_for_client: !!(integration && integration.auto_block_enabled),
        not_whitelisted: !whitelist.includes(client.id)
      },
      reasons_not_blocked: []
    };

    // Determina por que o cliente não está sendo bloqueado
    if (!configObj.traccar_enabled || configObj.traccar_enabled !== 'true') {
      analysis.reasons_not_blocked.push('Integração Traccar está desabilitada globalmente');
    }
    if (!configObj.auto_block_enabled || configObj.auto_block_enabled !== 'true') {
      analysis.reasons_not_blocked.push('Bloqueio automático está desabilitado globalmente');
    }
    if (!integration) {
      analysis.reasons_not_blocked.push('Cliente não possui integração com Traccar');
    } else {
      if (!integration.traccar_user_id) {
        analysis.reasons_not_blocked.push('Cliente não está mapeado no Traccar (traccar_user_id é null)');
      }
      if (integration.is_blocked) {
        analysis.reasons_not_blocked.push('Cliente já está marcado como bloqueado no banco local');
      }
      if (!integration.auto_block_enabled) {
        analysis.reasons_not_blocked.push('Bloqueio automático está desabilitado para este cliente');
      }
    }
    if (whitelist.includes(client.id)) {
      analysis.reasons_not_blocked.push('Cliente está na lista branca (whitelist)');
    }
    if (overduePayments.length < blockAfterCount) {
      analysis.reasons_not_blocked.push(`Cliente tem ${overduePayments.length} cobranças em atraso, mas o mínimo para bloqueio é ${blockAfterCount}`);
    }

    if (analysis.reasons_not_blocked.length === 0) {
      analysis.reasons_not_blocked.push('Todas as condições para bloqueio estão atendidas. A automação deve processar este cliente na próxima execução.');
    }

    res.json({
      success: true,
      analysis
    });

  } catch (error) {
    logger.error('Erro ao buscar debug do cliente:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;