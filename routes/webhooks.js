const express = require('express');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { Payment, Client, MessageLog, WebhookLog, Config } = require('../models');
const EvolutionService = require('../services/EvolutionService');
const TemplateService = require('../services/TemplateService');
const TraccarAutomationService = require('../services/TraccarAutomationService');
const { authMiddleware } = require('../middleware/auth');
// Allow public access to webhook stats/activities when enabled via env
const requireWebhookAuth = process.env.WEBHOOKS_STATS_PUBLIC === 'true'
  ? (req, res, next) => next()
  : authMiddleware;
const logger = require('../utils/logger');

const router = express.Router();

// Middleware to verify Asaas webhook signature
const verifyAsaasSignature = (req, res, next) => {
  try {
    const signature = req.headers['asaas-signature'];
    const payload = JSON.stringify(req.body);

    // For development, skip signature verification if not configured
    if (!process.env.ASAAS_WEBHOOK_SECRET) {
      logger.warn('Webhook signature verification skipped - ASAAS_WEBHOOK_SECRET not configured');
      return next();
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.ASAAS_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    if (!signature || signature !== expectedSignature) {
      logger.warn('Invalid webhook signature:', { signature, expectedSignature });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    next();
  } catch (error) {
    logger.error('Webhook signature verification error:', error);
    res.status(500).json({ error: 'Signature verification failed' });
  }
};

// ROTA ANTIGA COMENTADA - Substituída pela implementação com reconciliação em tempo real (linha ~547)
/*
// Asaas webhook endpoint
router.post('/asaas', verifyAsaasSignature, async (req, res) => {
  const startTime = Date.now();
  let webhookLog = null;

  try {
    const { event, payment } = req.body;

    logger.info('Received Asaas webhook:', { event, paymentId: payment?.id });

    if (!event || !payment) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    // Find the payment in our database
    const dbPayment = await Payment.findOne({
      where: { asaas_id: payment.id },
      include: [{
        model: Client,
        as: 'client',
        where: {
          is_active: true,
          notifications_enabled: true
        }
      }]
    });

    // Create webhook log entry
    if (dbPayment) {
      webhookLog = await WebhookLog.create({
        event_type: event,
        payment_id: dbPayment.id,
        client_id: dbPayment.client_id,
        client_name: dbPayment.client.name,
        asaas_payment_id: payment.id,
        payment_value: payment.value,
        status: 'success',
        webhook_payload: req.body,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
    }

    if (!dbPayment) {
      logger.warn('Payment not found or client notifications disabled:', payment.id);

      // Log webhook even if payment not found
      await WebhookLog.create({
        event_type: event,
        asaas_payment_id: payment.id,
        client_name: payment.customer || 'Unknown',
        payment_value: payment.value,
        status: 'error',
        webhook_payload: req.body,
        error_details: { error: 'Payment not found or notifications disabled' },
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });

      return res.json({ success: true, message: 'Payment not found or notifications disabled' });
    }

    // Update payment status
    await dbPayment.update({
      status: payment.status,
      payment_date: payment.paymentDate || null,
      last_sync: new Date()
    });

    // Handle different events
    switch (event) {
      case 'PAYMENT_RECEIVED':
        // Check if should send payment received message (configurable)
        const sendReceivedConfig = await Config.findOne({ where: { key: 'send_payment_received_msg' } });
        const shouldSendReceived = sendReceivedConfig?.value === 'true';
        
        if (shouldSendReceived) {
          await handlePaymentReceived(dbPayment, 'payment_received');
          logger.info(`Payment received message sent for client ${client.name}: ${payment.value}`);
        } else {
          // Only log the received event, don't send message (avoiding redundancy)
          logger.info(`Payment received for client ${client.name}: ${payment.value} - Waiting for confirmation`);
        }
        break;

      case 'PAYMENT_CONFIRMED':
        // Send only the confirmation message (more professional for PIX)
        await handlePaymentReceived(dbPayment, 'payment_confirmed');
        break;

      case 'PAYMENT_OVERDUE':
        await handlePaymentOverdue(dbPayment);
        break;

      case 'PAYMENT_DELETED':
        await handlePaymentDeleted(dbPayment);
        break;

      case 'PAYMENT_CREATED':
        await handlePaymentCreated(dbPayment);
        break;

      case 'PAYMENT_UPDATED':
        await handlePaymentUpdated(dbPayment);
        break;

      default:
        logger.info('Unhandled webhook event:', event);
    }

    // Update webhook log with processing time
    if (webhookLog) {
      const processingTime = Date.now() - startTime;
      await webhookLog.update({ processing_time: processingTime });
    }

    res.json({ success: true, message: 'Webhook processed successfully' });

  } catch (error) {
    logger.error('Webhook processing error:', error);

    // Update webhook log with error
    if (webhookLog) {
      const processingTime = Date.now() - startTime;
      await webhookLog.update({
        status: 'error',
        processing_time: processingTime,
        error_details: { error: error.message, stack: error.stack }
      });
    }

    res.status(500).json({ error: 'Webhook processing failed' });
  }
});
*/

async function handlePaymentReceived(payment, templateType) {
  let messageSent = false;
  let messageType = templateType;

  try {
    const client = payment.client;
    const phoneNumber = client.mobile_phone || client.phone;

    if (!phoneNumber) {
      logger.warn('No phone number for payment received notification:', payment.asaas_id);
      return;
    }

    // Check if we already sent this type of payment message
    const existingMessage = await MessageLog.findOne({
      where: {
        payment_id: payment.id,
        message_type: templateType
      }
    });

    if (existingMessage) {
      logger.info(`${templateType} message already sent:`, payment.asaas_id);
      return;
    }

    // Get template and send message
    const message = await TemplateService.getProcessedTemplate(templateType, {
      client: client,
      payment: payment,
      company: {
        name: '' // Will be filled by TemplateService.getCompanyName()
      }
    });

    if (!message) {
      logger.warn('No template found for payment notification:', templateType);
      return;
    }

    // Create message log
    const messageLog = await MessageLog.create({
      client_id: client.id,
      payment_id: payment.id,
      phone_number: phoneNumber,
      message_content: message,
      message_type: templateType,
      status: 'pending'
    });

    // Send message
    const result = await EvolutionService.sendMessage(phoneNumber, message);

    if (result.success) {
      await messageLog.update({
        status: 'sent',
        evolution_response: result.data,
        sent_at: new Date()
      });

      messageSent = true;
      logger.info(`${templateType} notification sent to ${client.name} (${phoneNumber}) for payment ${payment.asaas_id}`);
    } else {
      await messageLog.update({
        status: 'failed',
        error_message: result.error,
        evolution_response: result.data
      });

      logger.error(`Failed to send ${templateType} notification to ${client.name}: ${result.error}`);
    }

    // Update webhook log with message info
    const webhookLog = await WebhookLog.findOne({
      where: {
        payment_id: payment.id,
        event_type: templateType === 'payment_received' ? 'PAYMENT_RECEIVED' : 'PAYMENT_CONFIRMED'
      },
      order: [['created_at', 'DESC']]
    });

    if (webhookLog) {
      await webhookLog.update({
        message_sent: messageSent,
        message_type: messageType,
        response_data: result.data
      });
    }

    // Trigger immediate unblock check
    if (templateType === 'payment_confirmed' || templateType === 'payment_received') {
      // Run in background to not block response
      TraccarAutomationService.checkAndUnblockClient(client.id).catch(err =>
        logger.error('Error in immediate unblock check:', err)
      );
    }

  } catch (error) {
    logger.error(`Error handling ${templateType}:`, error);
  }
}

async function handlePaymentOverdue(payment) {
  try {
    // Não sobrescrever pagamentos já quitados
    const paidStatuses = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'REFUNDED'];
    if (paidStatuses.includes(payment.status)) {
      logger.info(`Ignorando PAYMENT_OVERDUE para pagamento já quitado: ${payment.asaas_id} (status atual: ${payment.status})`);
      return;
    }

    // Atualizar para OVERDUE somente se não quitado
    await payment.update({ status: 'OVERDUE' });
    logger.info('Payment marked as overdue:', payment.asaas_id);
  } catch (error) {
    logger.error('Error handling payment overdue:', error);
  }
}

async function handlePaymentDeleted(payment) {
  try {
    // Mark as inactive instead of deleting
    await payment.update({
      is_active: false,
      last_sync: new Date()
    });
    logger.info('Payment marked as deleted:', payment.asaas_id);
  } catch (error) {
    logger.error('Error handling payment deleted:', error);
  }
}

async function handlePaymentCreated(payment) {
  try {
    logger.info('Payment created webhook received:', payment.asaas_id);
    // Log payment creation, no message needed typically
  } catch (error) {
    logger.error('Error handling payment created:', error);
  }
}

async function handlePaymentUpdated(payment) {
  try {
    logger.info('Payment updated webhook received:', payment.asaas_id);
    // Log payment update, handle any status changes if needed
  } catch (error) {
    logger.error('Error handling payment updated:', error);
  }
}

// Webhook statistics endpoint
router.get('/stats', requireWebhookAuth, async (req, res) => {
  // Extra logs to help diagnose frontend visibility issues
  try {
    const hasAuth = !!req.user;
    const authHeader = req.headers['authorization'] ? 'present' : 'missing';
    logger.info('GET /webhooks/stats request', { authHeader, hasAuth });
  } catch (e) {
    logger.warn('GET /webhooks/stats logging error:', e.message);
  }
  try {
    const { period = '24h' } = req.query;

    let dateFilter;
    const now = new Date();

    switch (period) {
      case '24h':
        dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Get general statistics
    const stats = await WebhookLog.findAll({
      where: {
        created_at: {
          [Op.gte]: dateFilter
        }
      },
      attributes: [
        'status',
        'event_type',
        'message_sent',
        [sequelize.fn('COUNT', '*'), 'count'],
        [sequelize.fn('AVG', sequelize.col('processing_time')), 'avg_processing_time'],
        [sequelize.fn('SUM', sequelize.col('payment_value')), 'total_value']
      ],
      group: ['status', 'event_type', 'message_sent'],
      raw: true
    });

    // Get success rate
    const totalWebhooks = await WebhookLog.count({
      where: {
        created_at: {
          [Op.gte]: dateFilter
        }
      }
    });

    const successfulWebhooks = await WebhookLog.count({
      where: {
        created_at: {
          [Op.gte]: dateFilter
        },
        status: 'success'
      }
    });

    const successRate = totalWebhooks > 0 ? (successfulWebhooks / totalWebhooks * 100).toFixed(1) : 0;

    // Get messages sent
    const messagesSent = await WebhookLog.count({
      where: {
        created_at: {
          [Op.gte]: dateFilter
        },
        message_sent: true
      }
    });

    // Get unique clients notified
    const uniqueClients = await WebhookLog.count({
      where: {
        created_at: {
          [Op.gte]: dateFilter
        },
        message_sent: true
      },
      distinct: true,
      col: 'client_id'
    });

    // Get last activity
    const lastActivity = await WebhookLog.findOne({
      order: [['created_at', 'DESC']],
      attributes: ['created_at', 'event_type', 'client_name']
    });

    // Get event type breakdown
    const eventBreakdown = await WebhookLog.findAll({
      where: {
        created_at: {
          [Op.gte]: dateFilter
        }
      },
      attributes: [
        'event_type',
        [sequelize.fn('COUNT', '*'), 'count'],
        [sequelize.fn('COUNT', sequelize.literal('CASE WHEN message_sent = true THEN 1 END')), 'messages_sent']
      ],
      group: ['event_type'],
      raw: true
    });

    res.json({
      success: true,
      data: {
        period,
        totalWebhooks,
        successfulWebhooks,
        successRate: `${successRate}%`,
        messagesSent,
        uniqueClients,
        lastActivity,
        eventBreakdown,
        detailedStats: stats
      }
    });

  } catch (error) {
    logger.error('Get webhook stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estatísticas do webhook'
    });
  }
});

// Webhook recent activities endpoint
router.get('/activities', requireWebhookAuth, async (req, res) => {
  // Extra logs to help diagnose frontend visibility issues
  try {
    const hasAuth = !!req.user;
    const authHeader = req.headers['authorization'] ? 'present' : 'missing';
    logger.info('GET /webhooks/activities request', { authHeader, hasAuth });
  } catch (e) {
    logger.warn('GET /webhooks/activities logging error:', e.message);
  }
  try {
    const { limit = 10 } = req.query;

    const activities = await WebhookLog.findAll({
      limit: parseInt(limit),
      order: [['created_at', 'DESC']],
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['name', 'phone'],
          required: false
        },
        {
          model: Payment,
          as: 'payment',
          attributes: ['value', 'due_date', 'status'],
          required: false
        }
      ]
    });

    const formattedActivities = activities.map(activity => {
      const timeDiff = new Date() - new Date(activity.created_at);
      let timeAgo;

      if (timeDiff < 60000) {
        timeAgo = 'há poucos segundos';
      } else if (timeDiff < 3600000) {
        timeAgo = `há ${Math.floor(timeDiff / 60000)} minutos`;
      } else if (timeDiff < 86400000) {
        timeAgo = `há ${Math.floor(timeDiff / 3600000)} horas`;
      } else {
        timeAgo = `há ${Math.floor(timeDiff / 86400000)} dias`;
      }

      return {
        id: activity.id,
        event_type: activity.event_type,
        client_name: activity.client_name,
        payment_value: activity.payment_value,
        status: activity.status,
        message_sent: activity.message_sent,
        processing_time: activity.processing_time,
        created_at: activity.created_at,
        timeAgo,
        client: activity.client,
        payment: activity.payment
      };
    });

    res.json({
      success: true,
      data: { activities: formattedActivities }
    });

  } catch (error) {
    logger.error('Get webhook activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar atividades do webhook'
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'noty-webhooks'
  });
});

// Webhook do Asaas para reconciliação em tempo real
router.post('/asaas', async (req, res) => {
  const logger = require('../utils/logger');
  const { Payment, Client, WebhookLog } = require('../models');
  const TraccarAutomationService = require('../services/TraccarAutomationService');

  try {
    // 1) Validação básica do payload
    const body = req.body;
    const event = body.event || body.type || '';
    
    // Log do webhook recebido
    logger.info(`🔔 Webhook Asaas recebido: ${event}`);
    
    if (!['PAYMENT_CREATED', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE'].includes(event)) {
      logger.info(`ℹ️ Evento ${event} ignorado (não relevante para reconciliação)`);
      return res.status(200).json({ success: true, ignored: true, reason: 'Evento não monitorado' });
    }

    const paymentData = body.payment || body;
    if (!paymentData || !paymentData.id || !paymentData.customer) {
      logger.warn('⚠️ Webhook sem payment.id ou customer');
      return res.status(200).json({ success: true, ignored: true, reason: 'Payload inválido' });
    }

    // 2) Resolver o cliente
    let client = await Client.findOne({ where: { asaas_id: paymentData.customer } });
    if (!client) {
      logger.warn(`⚠️ Cliente não encontrado para asaas_id=${paymentData.customer}`);
      // Política: logar e continuar (não bloqueia o webhook)
      await WebhookLog.create({
        event_type: event,
        client_name: paymentData.customer || 'Desconhecido',
        asaas_payment_id: paymentData.id,
        payment_value: paymentData.value || 0,
        status: 'error',
        webhook_payload: body,
        error_details: { message: `Cliente não encontrado: ${paymentData.customer}` },
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        message_sent: false
      });
      return res.status(200).json({ success: true, ignored: true, reason: 'Cliente não encontrado' });
    }

    // 3) Upsert de Payment (idempotente)
    const [payment, created] = await Payment.findOrCreate({
      where: { asaas_id: paymentData.id },
      defaults: {
        asaas_id: paymentData.id,
        client_id: client.id,
        value: paymentData.value ?? 0,
        net_value: paymentData.netValue ?? null,
        original_value: paymentData.originalValue ?? null,
        interest_value: paymentData.interestValue ?? 0,
        billing_type: paymentData.billingType || 'BOLETO',
        status: paymentData.status || 'PENDING',
        due_date: paymentData.dueDate,
        original_due_date: paymentData.originalDueDate ?? null,
        invoice_url: paymentData.invoiceUrl ?? null,
        bank_slip_url: paymentData.bankSlipUrl ?? null,
        description: paymentData.description ?? null,
        external_reference: paymentData.externalReference ?? null,
        notification_disabled: !!paymentData.notificationDisabled,
        authorized_only: !!paymentData.authorizedOnly,
        installment: paymentData.installment ?? 1,
        last_sync: new Date()
      }
    });

    if (!created) {
      // Atualização não destrutiva
      const updates = {
        client_id: client.id,
        value: paymentData.value ?? payment.value,
        net_value: paymentData.netValue ?? payment.net_value,
        original_value: paymentData.originalValue ?? payment.original_value,
        interest_value: paymentData.interestValue ?? payment.interest_value,
        billing_type: paymentData.billingType || payment.billing_type,
        status: paymentData.status || payment.status,
        due_date: paymentData.dueDate || payment.due_date,
        original_due_date: paymentData.originalDueDate ?? payment.original_due_date,
        invoice_url: paymentData.invoiceUrl ?? payment.invoice_url,
        bank_slip_url: paymentData.bankSlipUrl ?? payment.bank_slip_url,
        description: paymentData.description ?? payment.description,
        external_reference: paymentData.externalReference ?? payment.external_reference,
        notification_disabled: paymentData.notificationDisabled ?? payment.notification_disabled,
        authorized_only: paymentData.authorizedOnly ?? payment.authorized_only,
        installment: paymentData.installment ?? payment.installment,
        last_sync: new Date()
      };
      await payment.update(updates);
    }

    // 4) Log de webhook
    await WebhookLog.create({
      event_type: event,
      client_id: client.id,
      payment_id: payment.id,
      client_name: client.name,
      asaas_payment_id: paymentData.id,
      payment_value: paymentData.value || 0,
      status: 'success',
      webhook_payload: body,
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      message_sent: false
    });

    // 5) ⚡ RECONCILIAÇÃO EM TEMPO REAL ⚡
    let reconciliationResult = null;
    
    // Eventos que podem alterar o status de bloqueio
    if (['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE'].includes(event)) {
      try {
        logger.info(`🔄 Iniciando reconciliação em tempo real para cliente ${client.name} (evento: ${event})`);
        reconciliationResult = await TraccarAutomationService.reconcileClientBlockStatus(client.id);
        
        if (reconciliationResult.changed) {
          logger.info(`✅ Cliente ${client.name} ${reconciliationResult.action} automaticamente via webhook`);
        }
      } catch (reconciliationError) {
        logger.error(`❌ Erro na reconciliação em tempo real para cliente ${client.id}:`, reconciliationError.message);
        // Não falha o webhook por causa da reconciliação
      }
    }

    return res.status(200).json({ 
      success: true, 
      created, 
      payment_id: payment.id,
      client_id: client.id,
      event,
      reconciliation: reconciliationResult
    });

  } catch (err) {
    logger.error('❌ Erro no webhook ASAAS:', err);
    
    try {
      const { WebhookLog } = require('../models');
      await WebhookLog.create({
        event_type: req.body?.event || 'PAYMENT_OVERDUE',
        client_name: req.body?.payment?.customer || 'Erro',
        asaas_payment_id: req.body?.payment?.id || 'unknown',
        payment_value: req.body?.payment?.value || 0,
        status: 'error',
        webhook_payload: req.body,
        error_details: { message: err.message, stack: err.stack },
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        message_sent: false
      });
    } catch (logError) {
      logger.error('❌ Erro ao salvar log de webhook com erro:', logError);
    }
    
    // Retorna 200 para evitar retry desnecessário do Asaas
    return res.status(200).json({ success: false, message: 'Erro processado e logado' });
  }
});

module.exports = router;