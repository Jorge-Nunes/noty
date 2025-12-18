const express = require('express');
const Joi = require('joi');
const { Config } = require('../models');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Public route for company name (no authentication required)
router.get('/company-name', async (req, res) => {
  try {
    const config = await Config.findOne({
      where: { key: 'company_name' },
      attributes: ['value']
    });

    const companyName = config?.value || process.env.COMPANY_NAME || 'Sua Empresa';

    res.json({
      success: true,
      data: { value: companyName }
    });
  } catch (error) {
    logger.error('Error getting company name:', error);
    res.json({
      success: true,
      data: { value: process.env.COMPANY_NAME || 'Sua Empresa' }
    });
  }
});

// Public route for company logo (no authentication required)
router.get('/company-logo', async (req, res) => {
  try {
    const config = await Config.findOne({
      where: { key: 'company_logo' },
      attributes: ['value']
    });

    res.json({
      success: true,
      data: { value: config?.value || null }
    });
  } catch (error) {
    logger.error('Error getting company logo:', error);
    res.json({
      success: true,
      data: { value: null }
    });
  }
});

// Validation schemas
const configSchema = Joi.object({
  key: Joi.string().required(),
  value: Joi.string().required(),
  description: Joi.string().optional().allow(''),
  type: Joi.string().valid('string', 'number', 'boolean', 'json').default('string'),
  category: Joi.string().valid('asaas', 'evolution', 'automation', 'general').default('general')
});

// Get all configurations
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { category = 'all' } = req.query;

    const whereClause = { is_active: true };

    // Lista de configurações do Traccar que devem ser excluídas da aba Geral
    const traccarConfigKeys = [
      'traccar_url',
      'traccar_token',
      'traccar_enabled',
      'auto_block_enabled',
      'block_after_days',
      'block_after_amount',
      'block_after_count',
      'unblock_on_payment',
      'whitelist_clients',
      'traccar_notifications_enabled'
    ];

    if (category !== 'all') {
      whereClause.category = category;
    } else {
      // Se busca todas as categorias, exclui configurações específicas do Traccar
      whereClause.key = { [require('sequelize').Op.notIn]: traccarConfigKeys };
    }

    const configs = await Config.findAll({
      where: whereClause,
      order: [['category', 'ASC'], ['key', 'ASC']]
    });

    // Group configurations by category
    const groupedConfigs = configs.reduce((acc, config) => {
      if (!acc[config.category]) {
        acc[config.category] = [];
      }
      acc[config.category].push(config);
      return acc;
    }, {});

    res.json({
      success: true,
      data: { configs: groupedConfigs }
    });

  } catch (error) {
    logger.error('Get configs error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar configurações'
    });
  }
});

// Get configuration by key
router.get('/:key', authMiddleware, async (req, res) => {
  try {
    const config = await Config.findOne({
      where: { key: req.params.key, is_active: true }
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Configuração não encontrada'
      });
    }

    res.json({
      success: true,
      data: { config }
    });

  } catch (error) {
    logger.error('Get config error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar configuração'
    });
  }
});

// Create new configuration (admin only)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { error, value } = configSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.details.map(detail => detail.message)
      });
    }

    // Check if configuration already exists
    const existingConfig = await Config.findOne({
      where: { key: value.key }
    });

    if (existingConfig) {
      return res.status(400).json({
        success: false,
        message: 'Configuração já existe com esta chave'
      });
    }

    const config = await Config.create(value);

    logger.info(`Configuration created: ${config.key} by ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Configuração criada com sucesso',
      data: { config }
    });

  } catch (error) {
    logger.error('Create config error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar configuração'
    });
  }
});

// Update configuration (admin only)
router.put('/:key', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const config = await Config.findOne({
      where: { key: req.params.key, is_active: true }
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Configuração não encontrada'
      });
    }

    const updateSchema = Joi.object({
      value: Joi.string().required(),
      description: Joi.string().optional().allow(''),
      type: Joi.string().valid('string', 'number', 'boolean', 'json').optional(),
      category: Joi.string().valid('asaas', 'evolution', 'automation', 'general').optional()
    });

    const { error, value } = updateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.details.map(detail => detail.message)
      });
    }

    await config.update(value);

    // Invalidate Asaas service cache if Asaas credentials/URL changed
    try {
      if (['asaas_api_url', 'asaas_access_token'].includes(config.key)) {
        const AsaasService = require('../services/AsaasService');
        AsaasService.invalidate();
        logger.info('AsaasService cache invalidated after config change');
      }
    } catch (invalidateError) {
      logger.error('Error invalidating AsaasService cache:', invalidateError);
    }

    // Apply config changes instantly across services
    try {
      const updatedKey = config.key;
      // Evolution: invalidate to force reload on next call (or reinit now if desired)
      if (['evolution_api_url', 'evolution_api_key', 'evolution_instance'].includes(updatedKey)) {
        const EvolutionService = require('../services/EvolutionService');
        EvolutionService.invalidate();
        logger.info('EvolutionService invalidated after config change');
      }
      // Traccar notifications service depends on these keys
      if (['company_name', 'company_phone', 'traccar_url', 'traccar_notifications_enabled'].includes(updatedKey)) {
        const TraccarNotificationService = require('../services/TraccarNotificationService');
        await TraccarNotificationService.initialize();
        logger.info('TraccarNotificationService reloaded after config change');
      }
      // Scheduler: reschedule when automation time/hour changes
      if (['automation_time_pending', 'automation_time_overdue', 'automation_hour_pending', 'automation_hour_overdue'].includes(updatedKey)) {
        const SchedulerService = require('../services/SchedulerService');
        await SchedulerService.updateSchedules();
        logger.info('SchedulerService schedules updated after config change');
      }
      // Traccar: reinitialize when its core config changes
      if (['traccar_url', 'traccar_token', 'traccar_enabled'].includes(updatedKey)) {
        const TraccarService = require('../services/TraccarService');
        await TraccarService.initialize();
        logger.info('TraccarService reinitialized after config change');
      }
    } catch (applyError) {
      logger.error('Error applying config changes instantly:', applyError);
    }

    logger.info(`Configuration updated: ${config.key} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Configuração atualizada com sucesso',
      data: { config }
    });

  } catch (error) {
    logger.error('Update config error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar configuração'
    });
  }
});

// Bulk update configurations
router.put('/bulk/update', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { configs } = req.body;

    if (!Array.isArray(configs)) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos. Esperado array de configurações.'
      });
    }

    const bulkUpdateSchema = Joi.array().items(
      Joi.object({
        key: Joi.string().required(),
        value: Joi.string().allow('').required()
      })
    );

    const { error } = bulkUpdateSchema.validate(configs);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.details.map(detail => detail.message)
      });
    }

    const updatePromises = configs.map(async (configData) => {
      const config = await Config.findOne({
        where: { key: configData.key, is_active: true }
      });

      if (config) {
        await config.update({ value: configData.value });
        return { key: configData.key, status: 'updated' };
      } else {
        // Create the config if it doesn't exist (for new configs like company_logo)
        try {
          await Config.create({
            key: configData.key,
            value: configData.value,
            description: configData.key === 'company_logo' ? 'Logo da empresa em Base64' : configData.key,
            type: 'string',
            category: 'general',
            is_active: true
          });
          return { key: configData.key, status: 'created' };
        } catch (createError) {
          logger.error(`Error creating config ${configData.key}:`, createError);
          return { key: configData.key, status: 'error' };
        }
      }
    });

    const results = await Promise.all(updatePromises);

    logger.info(`Bulk configuration update by ${req.user.email}: ${JSON.stringify(results)}`);

    // If Asaas configs were part of the bulk update, invalidate cache
    try {
      const updatedKeys = configs.map(c => c.key);
      if (updatedKeys.includes('asaas_api_url') || updatedKeys.includes('asaas_access_token')) {
        const AsaasService = require('../services/AsaasService');
        AsaasService.invalidate();
        logger.info('AsaasService cache invalidated after bulk config update');
      }
    } catch (invalidateError) {
      logger.error('Error invalidating AsaasService cache after bulk update:', invalidateError);
    }

    // Apply bulk changes instantly across services
    try {
      const updatedKeys = configs.map(c => c.key);

      // Evolution
      if (updatedKeys.some(k => ['evolution_api_url', 'evolution_api_key', 'evolution_instance'].includes(k))) {
        const EvolutionService = require('../services/EvolutionService');
        EvolutionService.invalidate();
        logger.info('EvolutionService invalidated after bulk config update');
      }

      // Traccar notifications
      if (updatedKeys.some(k => ['company_name', 'company_phone', 'traccar_url', 'traccar_notifications_enabled'].includes(k))) {
        const TraccarNotificationService = require('../services/TraccarNotificationService');
        await TraccarNotificationService.initialize();
        logger.info('TraccarNotificationService reloaded after bulk config update');
      }

      // Scheduler
      if (updatedKeys.some(k => ['automation_time_pending', 'automation_time_overdue', 'automation_hour_pending', 'automation_hour_overdue'].includes(k))) {
        const SchedulerService = require('../services/SchedulerService');
        await SchedulerService.updateSchedules();
        logger.info('SchedulerService schedules updated after bulk config update');
      }

      // Traccar core config
      if (updatedKeys.some(k => ['traccar_url', 'traccar_token', 'traccar_enabled'].includes(k))) {
        const TraccarService = require('../services/TraccarService');
        await TraccarService.initialize();
        logger.info('TraccarService reinitialized after bulk config update');
      }
    } catch (applyError) {
      logger.error('Error applying bulk config changes instantly:', applyError);
    }

    res.json({
      success: true,
      message: 'Configurações atualizadas',
      data: { results }
    });

  } catch (error) {
    logger.error('Bulk update configs error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar configurações'
    });
  }
});

// Delete configuration (admin only)
router.delete('/:key', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const config = await Config.findOne({
      where: { key: req.params.key, is_active: true }
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Configuração não encontrada'
      });
    }

    await config.update({ is_active: false });

    logger.info(`Configuration deleted: ${config.key} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Configuração removida com sucesso'
    });

  } catch (error) {
    logger.error('Delete config error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao remover configuração'
    });
  }
});

// Test connection endpoints
router.post('/test/asaas', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const axios = require('axios');

    const asaasUrlConfig = await Config.findOne({ where: { key: 'asaas_api_url' } });
    const asaasTokenConfig = await Config.findOne({ where: { key: 'asaas_access_token' } });

    if (!asaasUrlConfig || !asaasTokenConfig) {
      return res.status(400).json({
        success: false,
        message: 'Configurações do Asaas não encontradas'
      });
    }

    const response = await axios.get(`${asaasUrlConfig.value}/customers?limit=1`, {
      headers: {
        'access_token': asaasTokenConfig.value,
        'accept': 'application/json'
      },
      timeout: 10000
    });

    logger.info(`Asaas connection test successful by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Conexão com Asaas realizada com sucesso',
      data: {
        status: response.status,
        hasMore: response.data.hasMore !== undefined
      }
    });

  } catch (error) {
    logger.error('Asaas connection test error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao testar conexão com Asaas',
      error: error.response?.data || error.message
    });
  }
});

router.post('/test/evolution', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const axios = require('axios');

    const evolutionUrlConfig = await Config.findOne({ where: { key: 'evolution_api_url' } });
    const evolutionKeyConfig = await Config.findOne({ where: { key: 'evolution_api_key' } });
    const instanceConfig = await Config.findOne({ where: { key: 'evolution_instance' } });

    if (!evolutionUrlConfig || !evolutionKeyConfig || !instanceConfig) {
      return res.status(400).json({
        success: false,
        message: 'Configurações da Evolution API não encontradas'
      });
    }

    const response = await axios.get(`${evolutionUrlConfig.value}/instance/fetchInstances`, {
      headers: {
        'apikey': evolutionKeyConfig.value
      },
      timeout: 10000
    });

    logger.info(`Evolution API connection test successful by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Conexão com Evolution API realizada com sucesso',
      data: {
        status: response.status,
        instances: response.data?.length || 0
      }
    });

  } catch (error) {
    logger.error('Evolution API connection test error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao testar conexão com Evolution API',
      error: error.response?.data || error.message
    });
  }
});

module.exports = router;