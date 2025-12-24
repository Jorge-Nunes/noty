const moment = require('moment');
const { randomUUID } = require('crypto');
const { Op } = require('sequelize');
const { sequelize, Client, Payment, MessageLog, Config } = require('../models');
const EvolutionService = require('./EvolutionService');
const TemplateService = require('./TemplateService');
const AsaasService = require('./AsaasService');
const PaymentQueries = require('../utils/paymentQueries');
const logger = require('../utils/logger');

class AutomationService {
  async getCompanyName() {
    try {
      const config = await Config.findOne({
        where: { 
          category: 'general',
          key: 'company_name'
        }
      });
      
      return config?.value || process.env.COMPANY_NAME || 'TEKSAT Rastreamento Veicular';
    } catch (error) {
      logger.error('Error getting company name:', error);
      return process.env.COMPANY_NAME || 'TEKSAT Rastreamento Veicular';
    }
  }

  async getWarningDays() {
    try {
      const config = await Config.findOne({ where: { key: 'warning_days' } });
      return config ? parseInt(config.value) : 2;
    } catch (error) {
      logger.error('Error getting warning days:', error);
      return 2; // default
    }
  }

  async syncPaymentsBeforeAutomation(automationType) {
    try {
      logger.info(`Syncing payments with Asaas before ${automationType} automation...`);
      
      // Sync pending, overdue, received and confirmed payments to ensure data is up-to-date
      const pendingResult = await AsaasService.syncPayments('PENDING');
      const overdueResult = await AsaasService.syncPayments('OVERDUE');
      const receivedResult = await AsaasService.syncPayments('RECEIVED');
      const confirmedResult = await AsaasService.syncPayments('CONFIRMED');
      
      logger.info(`Sync completed for ${automationType}: PENDING=${pendingResult.total}, OVERDUE=${overdueResult.total}, RECEIVED=${receivedResult.total}, CONFIRMED=${confirmedResult.total}`);
      return { pending: pendingResult, overdue: overdueResult, received: receivedResult, confirmed: confirmedResult };
    } catch (error) {
      logger.error(`Error syncing payments before ${automationType}:`, error);
      // Don't throw error - continue with existing data but log the issue
      return { error: error.message };
    }
  }

  async sendWarningNotifications() {
    try {
      logger.info('Starting warning notifications process...');

      // Sync payments with Asaas before processing
      await this.syncPaymentsBeforeAutomation('warning notifications');

      const warningDays = await this.getWarningDays();
      const warningDate = moment().add(warningDays, 'days').format('YYYY-MM-DD');

      // Get payments due on warning date
      const payments = await Payment.findAll({
        where: {
          due_date: warningDate,
          status: 'PENDING'
        },
        include: [{
          model: Client,
          as: 'client',
          where: {
            is_active: true,
            notifications_enabled: true
          }
        }]
      });

      if (payments.length === 0) {
        logger.info('No payments found for warning notifications');
        return {
          paymentsProcessed: 0,
          clientsProcessed: 0,
          messagesSent: 0,
          messagesFailed: 0,
          warningDays,
          warningDate
        };
      }

      // OTIMIZAÇÃO: Verificar mensagens existentes em lote
      const todayStart = moment().startOf('day').toDate();
      const existingMessages = await MessageLog.findAll({
        where: {
          payment_id: { [Op.in]: payments.map(p => p.id) },
          message_type: 'warning',
          created_at: { [Op.gte]: todayStart }
        }
      });

      // Criar um Set para consulta rápida
      const existingMessagesByPayment = new Set(
        existingMessages.map(msg => msg.payment_id)
      );

      let messagesSent = 0;
      let messagesFailed = 0;
      const clientsProcessed = new Set();
      const messagesToCreate = [];
      const paymentsToUpdate = [];

      for (const payment of payments) {
        try {
          const client = payment.client;
          clientsProcessed.add(client.id);

          // OTIMIZAÇÃO: Verificação rápida usando Set
          if (existingMessagesByPayment.has(payment.id)) {
            logger.info(`Warning already sent today for payment ${payment.asaas_id}`);
            continue;
          }

          // Get phone number (prefer mobile, fallback to phone)
          const phoneNumber = client.mobile_phone || client.phone;
          if (!phoneNumber) {
            logger.warn(`No phone number for client ${client.name}`);
            continue;
          }

          // Format message using TemplateService
          const message = await TemplateService.getProcessedTemplate('warning', {
            client: client,
            payment: payment,
            company: { name: await this.getCompanyName() },
            warning_days: warningDays
          });

          // OTIMIZAÇÃO: Preparar dados para inserção em lote
          const messageLogData = {
            id: randomUUID(),
            client_id: client.id,
            payment_id: payment.id,
            phone_number: phoneNumber,
            message_content: message,
            message_type: 'warning',
            status: 'pending',
            created_at: new Date(),
            updated_at: new Date()
          };

          // Send message
          const result = await EvolutionService.sendMessage(phoneNumber, message);

          if (result.success) {
            messageLogData.status = 'sent';
            messageLogData.evolution_response = result.data;
            messageLogData.sent_at = new Date();
            messageLogData.updated_at = new Date();

            // Preparar dados para update em lote
            paymentsToUpdate.push({
              id: payment.id,
              last_warning_sent: new Date(),
              warning_count: payment.warning_count + 1,
              updated_at: new Date()
            });

            messagesSent++;
            logger.info(`Warning sent to ${client.name} (${phoneNumber}) for payment ${payment.asaas_id}`);
          } else {
            messageLogData.status = 'failed';
            messageLogData.error_message = typeof result.error === 'object' ? JSON.stringify(result.error) : result.error;
            messageLogData.evolution_response = result.data;

            messagesFailed++;
            logger.error(`Failed to send warning to ${client.name}: ${result.error}`);
          }

          messagesToCreate.push(messageLogData);

          // Add delay between messages (reduzido para 1.5s)
          await new Promise(resolve => setTimeout(resolve, 1500));

        } catch (error) {
          messagesFailed++;
          logger.error(`Error processing warning for payment ${payment.id}:`, error);
        }
      }

      // OTIMIZAÇÃO: Inserções e updates em lote usando transação
      if (messagesToCreate.length > 0) {
        await sequelize.transaction(async (transaction) => {
          // Bulk insert de message logs
          await MessageLog.bulkCreate(messagesToCreate, { transaction });

          // Bulk update de payments
          for (const paymentUpdate of paymentsToUpdate) {
            await Payment.update({
              last_warning_sent: paymentUpdate.last_warning_sent,
              warning_count: paymentUpdate.warning_count,
              updated_at: paymentUpdate.updated_at
            }, {
              where: { id: paymentUpdate.id },
              transaction
            });
          }
        });
      }

      const summary = {
        paymentsProcessed: payments.length,
        clientsProcessed: clientsProcessed.size,
        messagesSent,
        messagesFailed,
        warningDays,
        warningDate
      };

      logger.info('Warning notifications completed:', summary);
      return summary;

    } catch (error) {
      logger.error('Warning notifications process error:', error);
      throw error;
    }
  }

  async sendDueTodayNotifications() {
    try {
      logger.info('Starting due today notifications process...');

      // Sync payments with Asaas before processing
      await this.syncPaymentsBeforeAutomation('due today notifications');

      const today = moment().format('YYYY-MM-DD');

      // Get payments due today
      const payments = await Payment.findAll({
        where: {
          due_date: today,
          status: 'PENDING'
        },
        include: [{
          model: Client,
          as: 'client',
          where: {
            is_active: true,
            notifications_enabled: true
          }
        }]
      });

      if (payments.length === 0) {
        logger.info('No payments due today');
        return {
          paymentsProcessed: 0,
          clientsProcessed: 0,
          messagesSent: 0,
          messagesFailed: 0,
          dueDate: today
        };
      }

      // OTIMIZAÇÃO: Verificar mensagens existentes em lote
      const todayStart = moment().startOf('day').toDate();
      const existingMessages = await MessageLog.findAll({
        where: {
          payment_id: { [Op.in]: payments.map(p => p.id) },
          message_type: 'due_today',
          created_at: { [Op.gte]: todayStart }
        }
      });

      // Criar um Set para consulta rápida
      const existingMessagesByPayment = new Set(
        existingMessages.map(msg => msg.payment_id)
      );

      let messagesSent = 0;
      let messagesFailed = 0;
      const clientsProcessed = new Set();
      const messagesToCreate = [];

      for (const payment of payments) {
        try {
          const client = payment.client;
          clientsProcessed.add(client.id);

          // OTIMIZAÇÃO: Verificação rápida usando Set
          if (existingMessagesByPayment.has(payment.id)) {
            logger.info(`Due today message already sent for payment ${payment.asaas_id}`);
            continue;
          }

          // Get phone number
          const phoneNumber = client.mobile_phone || client.phone;
          if (!phoneNumber) {
            logger.warn(`No phone number for client ${client.name}`);
            continue;
          }

          // Format message using TemplateService
          const message = await TemplateService.getProcessedTemplate('due_today', {
            client: client,
            payment: payment,
            company: { name: await this.getCompanyName() }
          });

          // OTIMIZAÇÃO: Preparar dados para inserção em lote
          const messageLogData = {
            id: randomUUID(),
            client_id: client.id,
            payment_id: payment.id,
            phone_number: phoneNumber,
            message_content: message,
            message_type: 'due_today',
            status: 'pending',
            created_at: new Date(),
            updated_at: new Date()
          };

          // Send message
          const result = await EvolutionService.sendMessage(phoneNumber, message);

          if (result.success) {
            messageLogData.status = 'sent';
            messageLogData.evolution_response = result.data;
            messageLogData.sent_at = new Date();
            messageLogData.updated_at = new Date();

            messagesSent++;
            logger.info(`Due today notification sent to ${client.name} (${phoneNumber}) for payment ${payment.asaas_id}`);
          } else {
            messageLogData.status = 'failed';
            messageLogData.error_message = typeof result.error === 'object' ? JSON.stringify(result.error) : result.error;
            messageLogData.evolution_response = result.data;

            messagesFailed++;
            logger.error(`Failed to send due today notification to ${client.name}: ${result.error}`);
          }

          messagesToCreate.push(messageLogData);

          // Add delay between messages (reduzido para 1.5s)
          await new Promise(resolve => setTimeout(resolve, 1500));

        } catch (error) {
          messagesFailed++;
          logger.error(`Error processing due today notification for payment ${payment.id}:`, error);
        }
      }

      // OTIMIZAÇÃO: Inserção em lote usando transação
      if (messagesToCreate.length > 0) {
        await sequelize.transaction(async (transaction) => {
          await MessageLog.bulkCreate(messagesToCreate, { transaction });
        });
      }

      const summary = {
        paymentsProcessed: payments.length,
        clientsProcessed: clientsProcessed.size,
        messagesSent,
        messagesFailed,
        dueDate: today
      };

      logger.info('Due today notifications completed:', summary);
      return summary;

    } catch (error) {
      logger.error('Due today notifications process error:', error);
      throw error;
    }
  }

  async sendOverdueNotifications() {
    try {
      logger.info('Starting overdue notifications process...');

      // Sync payments with Asaas before processing
      await this.syncPaymentsBeforeAutomation('overdue notifications');

      // Get overdue payments (excludes RECEIVED_IN_CASH and other paid statuses)
      const payments = await Payment.findAll({
        where: PaymentQueries.getOverdueCondition(),
        include: [{
          model: Client,
          as: 'client',
          where: {
            is_active: true,
            notifications_enabled: true
          }
        }]
      });

      if (payments.length === 0) {
        logger.info('No overdue payments found');
        return {
          paymentsProcessed: 0,
          clientsProcessed: 0,
          messagesSent: 0,
          messagesFailed: 0
        };
      }

      // OTIMIZAÇÃO: Verificar mensagens existentes em lote
      const todayStart = moment().startOf('day').toDate();
      const existingMessages = await MessageLog.findAll({
        where: {
          payment_id: { [Op.in]: payments.map(p => p.id) },
          message_type: 'overdue',
          created_at: { [Op.gte]: todayStart }
        }
      });

      // Criar um Set para consulta rápida
      const existingMessagesByPayment = new Set(
        existingMessages.map(msg => msg.payment_id)
      );

      let messagesSent = 0;
      let messagesFailed = 0;
      const clientsProcessed = new Set();
      const messagesToCreate = [];
      const paymentsToUpdate = [];

      for (const payment of payments) {
        try {
          const client = payment.client;
          clientsProcessed.add(client.id);

          // OTIMIZAÇÃO: Verificação rápida usando Set
          if (existingMessagesByPayment.has(payment.id)) {
            logger.info(`Overdue message already sent today for payment ${payment.asaas_id}`);
            continue;
          }

          // Get phone number
          const phoneNumber = client.mobile_phone || client.phone;
          if (!phoneNumber) {
            logger.warn(`No phone number for client ${client.name}`);
            continue;
          }

          // Format message using TemplateService
          const message = await TemplateService.getProcessedTemplate('overdue', {
            client: client,
            payment: payment,
            company: { name: await this.getCompanyName() }
          });

          // OTIMIZAÇÃO: Preparar dados para inserção em lote
          const messageLogData = {
            id: randomUUID(),
            client_id: client.id,
            payment_id: payment.id,
            phone_number: phoneNumber,
            message_content: message,
            message_type: 'overdue',
            status: 'pending',
            created_at: new Date(),
            updated_at: new Date()
          };

          // Send message
          const result = await EvolutionService.sendMessage(phoneNumber, message);

          if (result.success) {
            messageLogData.status = 'sent';
            messageLogData.evolution_response = result.data;
            messageLogData.sent_at = new Date();
            messageLogData.updated_at = new Date();

            // Preparar dados para update em lote
            paymentsToUpdate.push({
              id: payment.id,
              last_overdue_sent: new Date(),
              overdue_count: payment.overdue_count + 1,
              updated_at: new Date()
            });

            messagesSent++;
            logger.info(`Overdue notification sent to ${client.name} (${phoneNumber}) for payment ${payment.asaas_id}`);
          } else {
            messageLogData.status = 'failed';
            messageLogData.error_message = typeof result.error === 'object' ? JSON.stringify(result.error) : result.error;
            messageLogData.evolution_response = result.data;

            messagesFailed++;
            logger.error(`Failed to send overdue notification to ${client.name}: ${result.error}`);
          }

          messagesToCreate.push(messageLogData);

          // Add delay between messages (reduzido para 1.5s)
          await new Promise(resolve => setTimeout(resolve, 1500));

        } catch (error) {
          messagesFailed++;
          logger.error(`Error processing overdue notification for payment ${payment.id}:`, error);
        }
      }

      // OTIMIZAÇÃO: Inserções e updates em lote usando transação
      if (messagesToCreate.length > 0) {
        await sequelize.transaction(async (transaction) => {
          // Bulk insert de message logs
          await MessageLog.bulkCreate(messagesToCreate, { transaction });

          // Bulk update de payments
          for (const paymentUpdate of paymentsToUpdate) {
            await Payment.update({
              last_overdue_sent: paymentUpdate.last_overdue_sent,
              overdue_count: paymentUpdate.overdue_count,
              updated_at: paymentUpdate.updated_at
            }, {
              where: { id: paymentUpdate.id },
              transaction
            });
          }
        });
      }

      const summary = {
        paymentsProcessed: payments.length,
        clientsProcessed: clientsProcessed.size,
        messagesSent,
        messagesFailed
      };

      logger.info('Overdue notifications completed:', summary);
      return summary;

    } catch (error) {
      logger.error('Overdue notifications process error:', error);
      throw error;
    }
  }

  async runDailyWarningsAndDueToday() {
    try {
      logger.info('Starting daily warnings and due today automation...');

      // Sync payments with Asaas before processing
      await this.syncPaymentsBeforeAutomation('daily warnings and due today');

      const warningResults = await this.sendWarningNotifications();
      const dueTodayResults = await this.sendDueTodayNotifications();

      const summary = {
        warnings: warningResults,
        dueToday: dueTodayResults,
        totalMessagesSent: warningResults.messagesSent + dueTodayResults.messagesSent,
        totalMessagesFailed: warningResults.messagesFailed + dueTodayResults.messagesFailed
      };

      logger.info('Daily automation completed:', summary);
      return summary;

    } catch (error) {
      logger.error('Daily automation error:', error);
      throw error;
    }
  }
}

module.exports = new AutomationService();