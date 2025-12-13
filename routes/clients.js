const express = require('express');
const { Op } = require('sequelize');
const Joi = require('joi');
const { Client, Payment, TraccarIntegration } = require('../models');
const { authMiddleware, operatorMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schema
const clientSchema = Joi.object({
  name: Joi.string().min(2).max(200).required(),
  email: Joi.string().email().optional().allow(''),
  phone: Joi.string().min(10).max(20).required(),
  mobile_phone: Joi.string().min(10).max(20).optional().allow(''),
  cpf_cnpj: Joi.string().min(11).max(20).optional().allow(''),
  company: Joi.string().max(200).optional().allow(''),
  address: Joi.string().optional().allow(''),
  address_number: Joi.string().max(20).optional().allow(''),
  complement: Joi.string().max(100).optional().allow(''),
  province: Joi.string().max(100).optional().allow(''),
  city: Joi.string().max(100).optional().allow(''),
  state: Joi.string().length(2).optional().allow(''),
  postal_code: Joi.string().max(10).optional().allow(''),
  observations: Joi.string().optional().allow(''),
  notifications_enabled: Joi.boolean().default(true)
});

// Get all clients with pagination and search
router.get('/', authMiddleware, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = 'all',
      sortBy = 'name',
      sortOrder = 'ASC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const whereClause = {};
    
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
        { cpf_cnpj: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (status !== 'all') {
      whereClause.is_active = status === 'active';
    }

    const { count, rows } = await Client.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: offset,
      order: [[sortBy, sortOrder.toUpperCase()]],
      include: [
        {
          model: Payment,
          as: 'payments',
          attributes: ['id', 'status', 'value', 'due_date'],
          separate: true,
          limit: 5,
          order: [['due_date', 'DESC']]
        },
        {
          model: TraccarIntegration,
          as: 'TraccarIntegration',
          required: false,
          attributes: ['traccar_user_id', 'mapping_method', 'is_blocked', 'last_sync_at']
        }
      ]
    });

    res.json({
      success: true,
      data: {
        clients: rows,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(count / parseInt(limit)),
          total_items: count,
          items_per_page: parseInt(limit)
        }
      }
    });

  } catch (error) {
    logger.error('Get clients error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar clientes'
    });
  }
});

// Get client by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const client = await Client.findByPk(req.params.id, {
      include: [
        {
          model: Payment,
          as: 'payments',
          order: [['due_date', 'DESC']]
        },
        {
          model: TraccarIntegration,
          as: 'TraccarIntegration',
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

    res.json({
      success: true,
      data: { client }
    });

  } catch (error) {
    logger.error('Get client error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar cliente'
    });
  }
});

// Create new client (manual)
router.post('/', authMiddleware, operatorMiddleware, async (req, res) => {
  try {
    const { error, value } = clientSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.details.map(detail => detail.message)
      });
    }

    // Check if client with same CPF/CNPJ already exists
    if (value.cpf_cnpj) {
      const existingClient = await Client.findOne({
        where: { cpf_cnpj: value.cpf_cnpj }
      });
      if (existingClient) {
        return res.status(400).json({
          success: false,
          message: 'Cliente já existe com este CPF/CNPJ'
        });
      }
    }

    // Generate a temporary asaas_id (will be updated when synced with Asaas)
    value.asaas_id = `manual_${Date.now()}`;

    const client = await Client.create(value);

    logger.info(`Client created manually: ${client.name} by ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Cliente criado com sucesso',
      data: { client }
    });

  } catch (error) {
    logger.error('Create client error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar cliente'
    });
  }
});

// Update client
router.put('/:id', authMiddleware, operatorMiddleware, async (req, res) => {
  try {
    const client = await Client.findByPk(req.params.id);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Cliente não encontrado'
      });
    }

    const { error, value } = clientSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.details.map(detail => detail.message)
      });
    }

    // Check if CPF/CNPJ is being changed and if it already exists
    if (value.cpf_cnpj && value.cpf_cnpj !== client.cpf_cnpj) {
      const existingClient = await Client.findOne({
        where: { 
          cpf_cnpj: value.cpf_cnpj,
          id: { [Op.ne]: client.id }
        }
      });
      if (existingClient) {
        return res.status(400).json({
          success: false,
          message: 'Outro cliente já existe com este CPF/CNPJ'
        });
      }
    }

    await client.update(value);

    logger.info(`Client updated: ${client.name} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Cliente atualizado com sucesso',
      data: { client }
    });

  } catch (error) {
    logger.error('Update client error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar cliente'
    });
  }
});

// Toggle client status (activate/deactivate)
router.patch('/:id/toggle-status', authMiddleware, operatorMiddleware, async (req, res) => {
  try {
    const client = await Client.findByPk(req.params.id);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Cliente não encontrado'
      });
    }

    await client.update({ is_active: !client.is_active });

    logger.info(`Client status toggled: ${client.name} (${client.is_active ? 'activated' : 'deactivated'}) by ${req.user.email}`);

    res.json({
      success: true,
      message: `Cliente ${client.is_active ? 'ativado' : 'desativado'} com sucesso`,
      data: { client }
    });

  } catch (error) {
    logger.error('Toggle client status error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao alterar status do cliente'
    });
  }
});

// Toggle notifications for client
router.patch('/:id/toggle-notifications', authMiddleware, operatorMiddleware, async (req, res) => {
  try {
    const client = await Client.findByPk(req.params.id);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Cliente não encontrado'
      });
    }

    await client.update({ notifications_enabled: !client.notifications_enabled });

    logger.info(`Client notifications toggled: ${client.name} (${client.notifications_enabled ? 'enabled' : 'disabled'}) by ${req.user.email}`);

    res.json({
      success: true,
      message: `Notificações ${client.notifications_enabled ? 'habilitadas' : 'desabilitadas'} para o cliente`,
      data: { client }
    });

  } catch (error) {
    logger.error('Toggle notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao alterar configuração de notificações'
    });
  }
});

module.exports = router;