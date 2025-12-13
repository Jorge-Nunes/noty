const express = require('express');
const { Op } = require('sequelize');
const moment = require('moment');
const { Payment, Client, MessageLog } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Get all payments with filters and pagination
router.get('/', authMiddleware, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status = 'all',
      dateFrom = '',
      dateTo = '',
      search = '',
      sortBy = 'due_date',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const whereClause = {};

    if (status !== 'all') {
      whereClause.status = status;
    }

    if (dateFrom && dateTo) {
      whereClause.due_date = {
        [Op.between]: [dateFrom, dateTo]
      };
    } else if (dateFrom) {
      whereClause.due_date = {
        [Op.gte]: dateFrom
      };
    } else if (dateTo) {
      whereClause.due_date = {
        [Op.lte]: dateTo
      };
    }

    // Include clause for client search
    const includeClause = {
      model: Client,
      as: 'client',
      attributes: ['id', 'name', 'email', 'phone', 'cpf_cnpj', 'notifications_enabled']
    };

    if (search) {
      includeClause.where = {
        [Op.or]: [
          { name: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } },
          { phone: { [Op.iLike]: `%${search}%` } },
          { cpf_cnpj: { [Op.iLike]: `%${search}%` } }
        ]
      };
    }

    const { count, rows } = await Payment.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: offset,
      order: [[sortBy, sortOrder.toUpperCase()]],
      include: [
        includeClause,
        {
          model: MessageLog,
          as: 'messages',
          attributes: ['id', 'message_type', 'status', 'sent_at'],
          separate: true,
          limit: 3,
          order: [['created_at', 'DESC']]
        }
      ]
    });

    res.json({
      success: true,
      data: {
        payments: rows,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(count / parseInt(limit)),
          total_items: count,
          items_per_page: parseInt(limit)
        }
      }
    });

  } catch (error) {
    logger.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar pagamentos'
    });
  }
});

// Get payment by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.id, {
      include: [
        {
          model: Client,
          as: 'client'
        },
        {
          model: MessageLog,
          as: 'messages',
          order: [['created_at', 'DESC']]
        }
      ]
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Pagamento não encontrado'
      });
    }

    res.json({
      success: true,
      data: { payment }
    });

  } catch (error) {
    logger.error('Get payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar pagamento'
    });
  }
});

// Get payments due today
router.get('/due/today', authMiddleware, async (req, res) => {
  try {
    const today = moment().format('YYYY-MM-DD');

    const payments = await Payment.findAll({
      where: {
        due_date: today,
        status: 'PENDING'
      },
      include: [
        {
          model: Client,
          as: 'client',
          where: { 
            is_active: true,
            notifications_enabled: true 
          }
        }
      ],
      order: [['value', 'DESC']]
    });

    res.json({
      success: true,
      data: { payments }
    });

  } catch (error) {
    logger.error('Get payments due today error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar pagamentos que vencem hoje'
    });
  }
});

// Get overdue payments
router.get('/status/overdue', authMiddleware, async (req, res) => {
  try {
    const payments = await Payment.findAll({
      where: {
        status: 'OVERDUE'
      },
      include: [
        {
          model: Client,
          as: 'client',
          where: { 
            is_active: true,
            notifications_enabled: true 
          }
        }
      ],
      order: [['due_date', 'ASC']]
    });

    res.json({
      success: true,
      data: { payments }
    });

  } catch (error) {
    logger.error('Get overdue payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar pagamentos vencidos'
    });
  }
});

// Get payments with upcoming warnings
router.get('/warnings/upcoming', authMiddleware, async (req, res) => {
  try {
    const { Config } = require('../models');
    
    // Get warning days from config
    const warningDaysConfig = await Config.findOne({
      where: { key: 'warning_days' }
    });
    const warningDays = warningDaysConfig ? parseInt(warningDaysConfig.value) : 2;

    const warningDate = moment().add(warningDays, 'days').format('YYYY-MM-DD');

    const payments = await Payment.findAll({
      where: {
        due_date: warningDate,
        status: 'PENDING'
      },
      include: [
        {
          model: Client,
          as: 'client',
          where: { 
            is_active: true,
            notifications_enabled: true 
          }
        }
      ],
      order: [['value', 'DESC']]
    });

    res.json({
      success: true,
      data: { 
        payments,
        warning_days: warningDays,
        warning_date: warningDate
      }
    });

  } catch (error) {
    logger.error('Get upcoming warnings error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar pagamentos para aviso'
    });
  }
});

// Get payment statistics
router.get('/stats/summary', authMiddleware, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    let dateFilter = {};
    if (period === 'today') {
      const today = moment().format('YYYY-MM-DD');
      dateFilter = { due_date: today };
    } else if (period === 'week') {
      const startOfWeek = moment().startOf('week').format('YYYY-MM-DD');
      const endOfWeek = moment().endOf('week').format('YYYY-MM-DD');
      dateFilter = { due_date: { [Op.between]: [startOfWeek, endOfWeek] } };
    } else if (period === 'month') {
      const startOfMonth = moment().startOf('month').format('YYYY-MM-DD');
      const endOfMonth = moment().endOf('month').format('YYYY-MM-DD');
      dateFilter = { due_date: { [Op.between]: [startOfMonth, endOfMonth] } };
    }

    const stats = await Payment.findAll({
      where: dateFilter,
      attributes: [
        'status',
        [Payment.sequelize.fn('COUNT', Payment.sequelize.col('id')), 'count'],
        [Payment.sequelize.fn('SUM', Payment.sequelize.col('value')), 'total_value']
      ],
      group: ['status'],
      raw: true
    });

    res.json({
      success: true,
      data: { 
        stats,
        period 
      }
    });

  } catch (error) {
    logger.error('Get payment stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estatísticas de pagamentos'
    });
  }
});

module.exports = router;