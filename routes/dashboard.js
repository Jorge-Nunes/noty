const express = require('express');
const { Op } = require('sequelize');
const moment = require('moment');
const { Client, Payment, MessageLog, AutomationLog } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Get dashboard statistics
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const today = moment().format('YYYY-MM-DD');
    const startOfMonth = moment().startOf('month').format('YYYY-MM-DD');
    const endOfMonth = moment().endOf('month').format('YYYY-MM-DD');

    // Total clients
    const totalClients = await Client.count({
      where: { is_active: true }
    });

    // Total payments this month
    const totalPaymentsThisMonth = await Payment.count({
      where: {
        created_at: {
          [Op.between]: [startOfMonth, endOfMonth]
        }
      }
    });

    // Pending payments
    const pendingPayments = await Payment.count({
      where: {
        status: 'PENDING'
      }
    });

    // Overdue payments
    const overduePayments = await Payment.count({
      where: {
        status: 'OVERDUE'
      }
    });

    // Payments due today
    const paymentsDueToday = await Payment.count({
      where: {
        due_date: today,
        status: 'PENDING'
      }
    });

    // Total revenue this month (confirmed payments)
    const revenueResult = await Payment.sum('value', {
      where: {
        status: {
          [Op.in]: ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']
        },
        payment_date: {
          [Op.between]: [startOfMonth, endOfMonth]
        }
      }
    });
    const totalRevenue = revenueResult || 0;

    // Pending revenue
    const pendingRevenueResult = await Payment.sum('value', {
      where: {
        status: 'PENDING'
      }
    });
    const pendingRevenue = pendingRevenueResult || 0;

    // Messages sent today
    const messagesSentToday = await MessageLog.count({
      where: {
        created_at: {
          [Op.gte]: moment().startOf('day').toDate()
        },
        status: {
          [Op.in]: ['sent', 'delivered']
        }
      }
    });

    // Messages failed today
    const messagesFailedToday = await MessageLog.count({
      where: {
        created_at: {
          [Op.gte]: moment().startOf('day').toDate()
        },
        status: {
          [Op.in]: ['failed', 'error']
        }
      }
    });

    // Last automation runs
    const lastAutomationRuns = await AutomationLog.findAll({
      limit: 5,
      order: [['created_at', 'DESC']],
      attributes: ['automation_type', 'status', 'messages_sent', 'created_at']
    });

    res.json({
      success: true,
      data: {
        clients: {
          total: totalClients
        },
        payments: {
          total_this_month: totalPaymentsThisMonth,
          pending: pendingPayments,
          overdue: overduePayments,
          due_today: paymentsDueToday
        },
        revenue: {
          total_this_month: parseFloat(totalRevenue),
          pending: parseFloat(pendingRevenue)
        },
        messages: {
          sent_today: messagesSentToday,
          failed_today: messagesFailedToday
        },
        automation: {
          last_runs: lastAutomationRuns
        }
      }
    });

  } catch (error) {
    logger.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar estatísticas do dashboard'
    });
  }
});

// Get payments chart data
router.get('/payments-chart', authMiddleware, async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);
    const startDate = moment().subtract(days, 'days').format('YYYY-MM-DD');

    const paymentsData = await Payment.findAll({
      where: {
        created_at: {
          [Op.gte]: startDate
        }
      },
      attributes: [
        [Payment.sequelize.fn('DATE', Payment.sequelize.col('created_at')), 'date'],
        [Payment.sequelize.fn('COUNT', Payment.sequelize.col('id')), 'count'],
        [Payment.sequelize.fn('SUM', Payment.sequelize.col('value')), 'total_value'],
        'status'
      ],
      group: [
        Payment.sequelize.fn('DATE', Payment.sequelize.col('created_at')),
        'status'
      ],
      order: [[Payment.sequelize.fn('DATE', Payment.sequelize.col('created_at')), 'ASC']]
    });

    res.json({
      success: true,
      data: paymentsData
    });

  } catch (error) {
    logger.error('Payments chart error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar dados do gráfico'
    });
  }
});

// Get recent activities
router.get('/recent-activities', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    // Recent message logs
    const recentMessages = await MessageLog.findAll({
      limit: limit,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['name', 'phone']
        },
        {
          model: Payment,
          as: 'payment',
          attributes: ['value', 'due_date']
        }
      ]
    });

    // Recent automation logs
    const recentAutomations = await AutomationLog.findAll({
      limit: 10,
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        messages: recentMessages,
        automations: recentAutomations
      }
    });

  } catch (error) {
    logger.error('Recent activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar atividades recentes'
    });
  }
});

module.exports = router;