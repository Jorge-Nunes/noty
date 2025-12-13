const express = require('express');
const { Op } = require('sequelize');
const moment = require('moment');
const { AutomationLog, MessageLog } = require('../models');
const { authMiddleware, operatorMiddleware } = require('../middleware/auth');
const AsaasService = require('../services/AsaasService');
const EvolutionService = require('../services/EvolutionService');
const AutomationService = require('../services/AutomationService');
const logger = require('../utils/logger');

const router = express.Router();

// Manual sync with Asaas
router.post('/sync/asaas', authMiddleware, operatorMiddleware, async (req, res) => {
  try {
    const automationLog = await AutomationLog.create({
      user_id: req.user.id,
      automation_type: 'manual_sync',
      status: 'started',
      started_at: new Date()
    });

    // Start sync in background
    AsaasService.syncAllData()
      .then(async (results) => {
        await automationLog.update({
          status: 'completed',
          clients_processed: results.clientsCount || 0,
          payments_processed: results.paymentsCount || 0,
          execution_time: Math.floor((new Date() - automationLog.started_at) / 1000),
          summary: results,
          completed_at: new Date()
        });
      })
      .catch(async (error) => {
        logger.error('Manual sync error:', error);
        await automationLog.update({
          status: 'failed',
          error_details: { message: error.message, stack: error.stack },
          completed_at: new Date()
        });
      });

    logger.info(`Manual Asaas sync started by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Sincronização iniciada. Verifique os logs para acompanhar o progresso.',
      data: { automation_log_id: automationLog.id }
    });

  } catch (error) {
    logger.error('Start manual sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao iniciar sincronização'
    });
  }
});

// Send warning notifications manually
router.post('/send/warnings', authMiddleware, operatorMiddleware, async (req, res) => {
  try {
    const automationLog = await AutomationLog.create({
      user_id: req.user.id,
      automation_type: 'warning_pending',
      status: 'started',
      started_at: new Date()
    });

    // Start warning process in background
    AutomationService.sendWarningNotifications()
      .then(async (results) => {
        await automationLog.update({
          status: 'completed',
          clients_processed: results.clientsProcessed || 0,
          payments_processed: results.paymentsProcessed || 0,
          messages_sent: results.messagesSent || 0,
          messages_failed: results.messagesFailed || 0,
          execution_time: Math.floor((new Date() - automationLog.started_at) / 1000),
          summary: results,
          completed_at: new Date()
        });
      })
      .catch(async (error) => {
        logger.error('Warning notifications error:', error);
        await automationLog.update({
          status: 'failed',
          error_details: { message: error.message, stack: error.stack },
          completed_at: new Date()
        });
      });

    logger.info(`Manual warning notifications started by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Envio de avisos iniciado. Verifique os logs para acompanhar o progresso.',
      data: { automation_log_id: automationLog.id }
    });

  } catch (error) {
    logger.error('Start warning notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao iniciar envio de avisos'
    });
  }
});

// Send overdue notifications manually
router.post('/send/overdue', authMiddleware, operatorMiddleware, async (req, res) => {
  try {
    const automationLog = await AutomationLog.create({
      user_id: req.user.id,
      automation_type: 'overdue_notification',
      status: 'started',
      started_at: new Date()
    });

    // Start overdue process in background
    AutomationService.sendOverdueNotifications()
      .then(async (results) => {
        await automationLog.update({
          status: 'completed',
          clients_processed: results.clientsProcessed || 0,
          payments_processed: results.paymentsProcessed || 0,
          messages_sent: results.messagesSent || 0,
          messages_failed: results.messagesFailed || 0,
          execution_time: Math.floor((new Date() - automationLog.started_at) / 1000),
          summary: results,
          completed_at: new Date()
        });
      })
      .catch(async (error) => {
        logger.error('Overdue notifications error:', error);
        await automationLog.update({
          status: 'failed',
          error_details: { message: error.message, stack: error.stack },
          completed_at: new Date()
        });
      });

    logger.info(`Manual overdue notifications started by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Envio de cobranças vencidas iniciado. Verifique os logs para acompanhar o progresso.',
      data: { automation_log_id: automationLog.id }
    });

  } catch (error) {
    logger.error('Start overdue notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao iniciar envio de cobranças vencidas'
    });
  }
});

// Send manual message to client
router.post('/send/manual-message', authMiddleware, operatorMiddleware, async (req, res) => {
  try {
    const { client_id, payment_id, message, phone_number } = req.body;

    if (!client_id || !message || !phone_number) {
      return res.status(400).json({
        success: false,
        message: 'client_id, message e phone_number são obrigatórios'
      });
    }

    // Create message log
    const messageLog = await MessageLog.create({
      client_id,
      payment_id: payment_id || null,
      user_id: req.user.id,
      phone_number,
      message_content: message,
      message_type: 'manual',
      status: 'pending'
    });

    // Send message via Evolution API
    const result = await EvolutionService.sendMessage(phone_number, message);

    if (result.success) {
      await messageLog.update({
        status: 'sent',
        evolution_response: result.data,
        sent_at: new Date()
      });

      logger.info(`Manual message sent by ${req.user.email} to ${phone_number}`);

      res.json({
        success: true,
        message: 'Mensagem enviada com sucesso',
        data: { message_log: messageLog }
      });
    } else {
      await messageLog.update({
        status: 'failed',
        error_message: typeof result.error === 'object' ? JSON.stringify(result.error) : result.error,
        evolution_response: result.data
      });

      res.status(400).json({
        success: false,
        message: 'Erro ao enviar mensagem',
        error: result.error
      });
    }

  } catch (error) {
    logger.error('Send manual message error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao enviar mensagem manual'
    });
  }
});

// Get automation logs
router.get('/logs', authMiddleware, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      type = 'all',
      status = 'all'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const whereClause = {};
    if (type !== 'all') {
      whereClause.automation_type = type;
    }
    if (status !== 'all') {
      whereClause.status = status;
    }

    const { count, rows } = await AutomationLog.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: offset,
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        logs: rows,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(count / parseInt(limit)),
          total_items: count,
          items_per_page: parseInt(limit)
        }
      }
    });

  } catch (error) {
    logger.error('Get automation logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar logs de automação'
    });
  }
});

// Get automation log by ID
router.get('/logs/:id', authMiddleware, async (req, res) => {
  try {
    const log = await AutomationLog.findByPk(req.params.id);

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Log de automação não encontrado'
      });
    }

    res.json({
      success: true,
      data: { log }
    });

  } catch (error) {
    logger.error('Get automation log error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar log de automação'
    });
  }
});

// Get message logs
router.get('/messages', authMiddleware, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      type = 'all',
      status = 'all',
      client_id = null
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const whereClause = {};
    if (type !== 'all') {
      whereClause.message_type = type;
    }
    if (status !== 'all') {
      whereClause.status = status;
    }
    if (client_id) {
      whereClause.client_id = client_id;
    }

    const { count, rows } = await MessageLog.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: offset,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: require('../models').Client,
          as: 'client',
          attributes: ['id', 'name', 'phone']
        },
        {
          model: require('../models').Payment,
          as: 'payment',
          attributes: ['id', 'value', 'due_date'],
          required: false
        }
      ]
    });

    res.json({
      success: true,
      data: {
        messages: rows,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(count / parseInt(limit)),
          total_items: count,
          items_per_page: parseInt(limit)
        }
      }
    });

  } catch (error) {
    logger.error('Get message logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar logs de mensagens'
    });
  }
});

// Get automation status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    // Get last automation runs
    const lastRuns = await AutomationLog.findAll({
      limit: 5,
      order: [['created_at', 'DESC']],
      attributes: ['automation_type', 'status', 'started_at', 'completed_at', 'messages_sent', 'messages_failed']
    });

    // Get running automations
    const runningAutomations = await AutomationLog.findAll({
      where: {
        status: 'started',
        started_at: {
          [Op.gte]: moment().subtract(1, 'hour').toDate()
        }
      }
    });

    // Get today's stats
    const todayStart = moment().startOf('day').toDate();
    const todayStats = await MessageLog.findAll({
      where: {
        created_at: {
          [Op.gte]: todayStart
        }
      },
      attributes: [
        'status',
        [MessageLog.sequelize.fn('COUNT', MessageLog.sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    res.json({
      success: true,
      data: {
        last_runs: lastRuns,
        running_automations: runningAutomations,
        today_stats: todayStats
      }
    });

  } catch (error) {
    logger.error('Get automation status error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar status da automação'
    });
  }
});

module.exports = router;