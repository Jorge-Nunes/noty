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

    // Totais por status (sem paginação), respeitando filtros de data e busca
    const totalsRaw = await Payment.findAll({
      where: whereClause,
      attributes: [
        'status',
        [Payment.sequelize.fn('COUNT', Payment.sequelize.col('payments.id')), 'count']
      ],
      include: search ? [includeClause] : [],
      group: ['payments.status'],
      raw: true
    });
    const totalsByStatus = totalsRaw.reduce((acc, cur) => { acc[cur.status] = parseInt(cur.count, 10); return acc; }, {});

    // Sanitize sort fields and support sorting by client name
    const allowedSortFields = ['due_date','value','status','billing_type','description','warning_count','created_at','updated_at','client'];
    const sortFieldRaw = allowedSortFields.includes(sortBy) ? sortBy : 'due_date';
    const sortDir = ['ASC','DESC'].includes(String(sortOrder).toUpperCase()) ? String(sortOrder).toUpperCase() : 'ASC';

    const orderClause = sortFieldRaw === 'client' 
      ? [[{ model: Client, as: 'client' }, 'name', sortDir]]
      : [[sortFieldRaw, sortDir]];

    const { count, rows } = await Payment.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: offset,
      // Evita duplicatas e ambiguidade de COUNT(id) em joins
      distinct: true,
      // Count should target the primary key of the base model; specifying table alias here
      // may cause Sequelize to generate an invalid path alias like "payments->payments".
      // Let Sequelize default to the base model PK by omitting `col`.
      subQuery: false,
      order: orderClause,
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
        },
        totalsByStatus
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

// Update payment
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const allowed = [
      'value','net_value','original_value','interest_value','description','billing_type','status',
      'due_date','original_due_date','payment_date','client_payment_date','installment',
      'external_reference','notification_disabled','authorized_only','invoice_url','bank_slip_url'
    ];
    const data = {};
    for (const k of allowed) if (k in req.body) data[k] = req.body[k];

    const payment = await Payment.findByPk(id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Pagamento não encontrado' });
    }

    const oldStatus = payment.status;
    await payment.update(data);
    
    // ⚡ Reconciliação em tempo real se status mudou
    let reconciliationResult = null;
    if (data.status && data.status !== oldStatus && payment.client_id) {
      try {
        const TraccarAutomationService = require('../services/TraccarAutomationService');
        logger.info(`🔄 Reconciliação após edição de pagamento (${oldStatus} → ${data.status})`);
        reconciliationResult = await TraccarAutomationService.reconcileClientBlockStatus(payment.client_id);
        
        if (reconciliationResult.changed) {
          logger.info(`✅ Cliente ${reconciliationResult.action} automaticamente após edição`);
        }
      } catch (reconciliationError) {
        logger.error(`⚠️ Erro na reconciliação após edição:`, reconciliationError.message);
      }
    }

    return res.json({ 
      success: true, 
      data: { payment },
      reconciliation: reconciliationResult
    });
  } catch (error) {
    logger.error('Update payment error:', error);
    return res.status(500).json({ success: false, message: 'Erro ao atualizar pagamento' });
  }
});

// Update payment status only
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ success: false, message: 'Status é obrigatório' });

    const payment = await Payment.findByPk(id);
    if (!payment) return res.status(404).json({ success: false, message: 'Pagamento não encontrado' });

    const oldStatus = payment.status;
    await payment.update({ status });
    
    // ⚡ Reconciliação em tempo real após mudança de status
    let reconciliationResult = null;
    if (status !== oldStatus && payment.client_id) {
      try {
        const TraccarAutomationService = require('../services/TraccarAutomationService');
        logger.info(`🔄 Reconciliação após mudança de status (${oldStatus} → ${status})`);
        reconciliationResult = await TraccarAutomationService.reconcileClientBlockStatus(payment.client_id);
        
        if (reconciliationResult.changed) {
          logger.info(`✅ Cliente ${reconciliationResult.action} automaticamente após mudança de status`);
        }
      } catch (reconciliationError) {
        logger.error(`⚠️ Erro na reconciliação após mudança de status:`, reconciliationError.message);
      }
    }

    return res.json({ 
      success: true, 
      data: { payment },
      reconciliation: reconciliationResult
    });
  } catch (error) {
    logger.error('Update payment status error:', error);
    return res.status(500).json({ success: false, message: 'Erro ao atualizar status do pagamento' });
  }
});

// Delete payment
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const payment = await Payment.findByPk(id);
    if (!payment) return res.status(404).json({ success: false, message: 'Pagamento não encontrado' });

    await payment.destroy();
    return res.json({ success: true, message: 'Pagamento excluído com sucesso' });
  } catch (error) {
    logger.error('Delete payment error:', error);
    return res.status(500).json({ success: false, message: 'Erro ao excluir pagamento' });
  }
});

// Reconciliação manual de clientes no Traccar
router.post('/reconcile-traccar', authMiddleware, async (req, res) => {
  try {
    const { client_ids, force_all } = req.body;
    const TraccarAutomationService = require('../services/TraccarAutomationService');
    const { Client } = require('../models');
    
    let clientIdsToProcess = [];
    
    if (force_all) {
      // Reconciliar todos os clientes com integração Traccar
      const clients = await Client.findAll({
        include: [{
          model: require('../models').TraccarIntegration,
          as: 'TraccarIntegration',
          where: { traccar_user_id: { [require('sequelize').Op.ne]: null } },
          required: true
        }],
        attributes: ['id']
      });
      clientIdsToProcess = clients.map(c => c.id);
    } else if (client_ids && Array.isArray(client_ids)) {
      clientIdsToProcess = client_ids;
    } else {
      return res.status(400).json({ 
        success: false, 
        message: 'Forneça client_ids (array) ou force_all (boolean)' 
      });
    }

    if (clientIdsToProcess.length === 0) {
      return res.json({
        success: true,
        message: 'Nenhum cliente para processar',
        processed: 0
      });
    }

    logger.info(`🔄 Reconciliação manual iniciada para ${clientIdsToProcess.length} clientes`);
    
    const results = await TraccarAutomationService.reconcileMultipleClients(clientIdsToProcess);
    
    const stats = {
      processed: results.length,
      blocked: results.filter(r => r.action === 'blocked').length,
      unblocked: results.filter(r => r.action === 'unblocked').length,
      no_change: results.filter(r => r.action === 'none').length,
      skipped: results.filter(r => r.skipped).length,
      errors: results.filter(r => r.error).length
    };

    return res.json({
      success: true,
      message: `Reconciliação concluída: ${stats.blocked} bloqueados, ${stats.unblocked} desbloqueados`,
      stats,
      details: results
    });

  } catch (error) {
    logger.error('Erro na reconciliação manual:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro na reconciliação manual',
      error: error.message 
    });
  }
});

module.exports = router;