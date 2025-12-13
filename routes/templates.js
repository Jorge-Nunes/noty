const express = require('express');
const Joi = require('joi');
const { MessageTemplate, Config } = require('../models');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schema
const templateSchema = Joi.object({
  type: Joi.string().valid('warning', 'due_today', 'overdue', 'payment_received', 'payment_confirmed', 'traccar_block', 'traccar_unblock', 'traccar_warning').required(),
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().required(),
  template: Joi.string().required(),
  variables: Joi.alternatives().try(
    Joi.array().items(Joi.string()),
    Joi.string()
  ).optional(),
  is_active: Joi.boolean().default(true)
});

// Get all templates
router.get('/', authMiddleware, async (req, res) => {
  try {
    const templates = await MessageTemplate.findAll({
      order: [['type', 'ASC']]
    });

    res.json({
      success: true,
      data: { templates }
    });

  } catch (error) {
    logger.error('Get templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar templates de mensagens'
    });
  }
});

// Get template by type
router.get('/:type', authMiddleware, async (req, res) => {
  try {
    const template = await MessageTemplate.findOne({
      where: { type: req.params.type }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template não encontrado'
      });
    }

    res.json({
      success: true,
      data: { template }
    });

  } catch (error) {
    logger.error('Get template error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar template'
    });
  }
});

// Create or update template
router.put('/:type', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { error, value } = templateSchema.validate({
      type: req.params.type,
      ...req.body
    });
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.details.map(detail => detail.message)
      });
    }

    // Process variables field - ensure it's stored correctly
    const processedValue = { ...value };
    if (processedValue.variables) {
      if (typeof processedValue.variables === 'string') {
        // If it's already a JSON string, keep as is
        try {
          JSON.parse(processedValue.variables);
        } catch (e) {
          // If it's not valid JSON, wrap as array
          processedValue.variables = JSON.stringify([processedValue.variables]);
        }
      } else if (Array.isArray(processedValue.variables)) {
        // If it's an array, convert to JSON string
        processedValue.variables = JSON.stringify(processedValue.variables);
      }
    }

    const [template, created] = await MessageTemplate.upsert(processedValue, {
      returning: true
    });

    logger.info(`Template ${created ? 'created' : 'updated'}: ${template.type} by ${req.user.email}`);

    res.json({
      success: true,
      message: `Template ${created ? 'criado' : 'atualizado'} com sucesso`,
      data: { template }
    });

  } catch (error) {
    logger.error('Save template error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao salvar template'
    });
  }
});

// Delete template
router.delete('/:type', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const template = await MessageTemplate.findOne({
      where: { type: req.params.type }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template não encontrado'
      });
    }

    await template.destroy();

    logger.info(`Template deleted: ${template.type} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Template removido com sucesso'
    });

  } catch (error) {
    logger.error('Delete template error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao remover template'
    });
  }
});

// Test template with sample data
router.post('/:type/test', authMiddleware, async (req, res) => {
  try {
    const template = await MessageTemplate.findOne({
      where: { type: req.params.type }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template não encontrado'
      });
    }

    // Get company name from config
    let companyName = 'TEKSAT Rastreamento Veicular';
    try {
      const companyConfig = await Config.findOne({
        where: { 
          category: 'general',
          key: 'company_name'
        }
      });
      companyName = companyConfig?.value || process.env.COMPANY_NAME || 'TEKSAT Rastreamento Veicular';
      logger.info(`Template test using company name: ${companyName}`);
    } catch (error) {
      logger.warn('Could not get company name for test:', error.message);
    }

    // Sample data for testing
    let sampleData = {
      client_name: 'João Silva',
      client: {
        name: 'João Silva',
        phone: '11999999999'
      },
      payment: {
        value: 150.00,
        due_date: new Date().toISOString().split('T')[0],
        invoice_url: 'https://example.com/invoice/123',
        bank_slip_url: 'https://example.com/boleto/123'
      },
      company_name: companyName,
      company_phone: '(11) 99999-9999',
      company: {
        name: companyName
      }
    };

    // Add specific data for Traccar templates
    if (['traccar_block', 'traccar_unblock', 'traccar_warning'].includes(req.params.type)) {
      sampleData = {
        ...sampleData,
        overdue_amount: 'R$ 189,30',
        overdue_count: '2',
        overdue_days: '15',
        days_until_block: '2',
        traccar_url: 'https://traccar.exemplo.com',
        client_name: 'João Silva',
        company_name: companyName,
        company_phone: '(11) 99999-9999'
      };
    }

    const TemplateService = require('../services/TemplateService');
    const processedMessage = TemplateService.processTemplate(template.template, sampleData);

    res.json({
      success: true,
      data: {
        original: template.template,
        processed: processedMessage,
        sampleData
      }
    });

  } catch (error) {
    logger.error('Test template error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao testar template'
    });
  }
});

module.exports = router;