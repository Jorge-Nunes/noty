const cron = require('node-cron');
const { Config, AutomationLog } = require('../models');
const AsaasService = require('./AsaasService');
const AutomationService = require('./AutomationService');
const TraccarAutomationService = require('./TraccarAutomationService');
const PaymentStatusService = require('./PaymentStatusService');
const logger = require('../utils/logger');

class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.initialized = false;
    this.runningTypes = new Set();
  }

  async initialize() {
    try {
      logger.info('Initializing scheduler service...');

      // Get automation schedule from config
      const pendingHourConfig = await Config.findOne({ where: { key: 'automation_hour_pending' } });
      const overdueHourConfig = await Config.findOne({ where: { key: 'automation_hour_overdue' } });

      const pendingHour = pendingHourConfig ? parseInt(pendingHourConfig.value) : 9;
      const overdueHour = overdueHourConfig ? parseInt(overdueHourConfig.value) : 11;

      // Schedule warning and due today notifications (default: 9 AM)
      this.scheduleJob('warning_and_due_today', `0 ${pendingHour} * * *`, async () => {
        await this.executeAutomation('warning_pending', async () => {
          return await AutomationService.runDailyWarningsAndDueToday();
        });
      });

      // Schedule overdue notifications (default: 11 AM)
      this.scheduleJob('overdue_notifications', `0 ${overdueHour} * * *`, async () => {
        await this.executeAutomation('overdue_notification', async () => {
          return await AutomationService.sendOverdueNotifications();
        });
      });

      // Schedule daily Asaas sync (midnight)
      this.scheduleJob('daily_asaas_sync', '5 0 * * *', async () => {
        await this.executeAutomation('asaas_daily_sync', async () => {
          return await AsaasService.syncAllData();
        });
      });

      // Schedule payment status update (daily at 00:01 - before Traccar automation)
      this.scheduleJob('payment_status_update', '1 0 * * *', async () => {
        await this.executeAutomation('payment_status_update', async () => {
          const result = await PaymentStatusService.updatePaymentStatuses();
          return {
            message: 'Atualização de status de cobranças executada',
            clientsProcessed: 0,
            paymentsProcessed: result.total_processed || 0,
            overdueUpdated: result.overdue_updated || 0,
            revertedUpdated: result.reverted_updated || 0,
            executionTime: result.execution_time || 0
          };
        });
      });

      // Schedule hourly pending payments sync
      this.scheduleJob('hourly_payments_sync', '0 * * * *', async () => {
        await this.executeAutomation('payments_hourly_sync', async () => {
          const pendingResult = await AsaasService.syncPayments('PENDING');
          const overdueResult = await AsaasService.syncPayments('OVERDUE');

          return {
            pending_payments: pendingResult,
            overdue_payments: overdueResult,
            paymentsCount: pendingResult.total + overdueResult.total
          };
        });
      });

      // Schedule Traccar automation (every 2 hours)
      this.scheduleJob('traccar_automation', '0 */2 * * *', async () => {
        await this.executeAutomation('traccar_automation', async () => {
          await TraccarAutomationService.runAutomation();
          return {
            message: 'Automação Traccar executada',
            clientsProcessed: 0,
            paymentsProcessed: 0
          };
        });
      });

      this.initialized = true;
      logger.info('Scheduler service initialized successfully');

    } catch (error) {
      logger.error('Scheduler initialization error:', error);
      throw error;
    }
  }

  scheduleJob(name, cronExpression, handler) {
    try {
      // Stop existing job if it exists
      if (this.jobs.has(name)) {
        this.jobs.get(name).stop();
      }

      // Create new job
      const job = cron.schedule(cronExpression, handler, {
        scheduled: false,
        timezone: 'America/Sao_Paulo'
      });

      this.jobs.set(name, job);
      job.start();

      logger.info(`Scheduled job '${name}' with cron expression '${cronExpression}'`);
    } catch (error) {
      logger.error(`Error scheduling job '${name}':`, error);
    }
  }

  async executeAutomation(type, handler) {
    // Concurrency guard (in-memory) to prevent reentrancy per type
    if (this.runningTypes.has(type)) {
      logger.warn(`Skipping automation ${type} because a previous execution is still running`);
      return;
    }
    this.runningTypes.add(type);

    const automationLog = await AutomationLog.create({
      automation_type: type,
      status: 'started',
      started_at: new Date()
    });

    try {
      logger.info(`Starting scheduled automation: ${type}`);

      const results = await handler();

      await automationLog.update({
        status: 'completed',
        clients_processed: results.clientsProcessed || results.clients?.total || 0,
        payments_processed: results.paymentsProcessed || results.paymentsCount || 0,
        messages_sent: results.messagesSent || results.totalMessagesSent || 0,
        messages_failed: results.messagesFailed || results.totalMessagesFailed || 0,
        execution_time: Math.floor((new Date() - automationLog.started_at) / 1000),
        summary: results,
        completed_at: new Date()
      });

      logger.info(`Scheduled automation ${type} completed successfully:`, {
        clients: results.clientsProcessed || results.clients?.total || 0,
        payments: results.paymentsProcessed || results.paymentsCount || 0,
        messages_sent: results.messagesSent || results.totalMessagesSent || 0,
        messages_failed: results.messagesFailed || results.totalMessagesFailed || 0
      });

      // Clear running flag for this type after success
      this.runningTypes.delete(type);

    } catch (error) {
      logger.error(`Scheduled automation ${type} failed:`, error);

      await automationLog.update({
        status: 'failed',
        error_details: {
          message: error.message,
          stack: error.stack
        },
        execution_time: Math.floor((new Date() - automationLog.started_at) / 1000),
        completed_at: new Date()
      });
    } finally {
      // Ensure running flag is cleared on failure too
      this.runningTypes.delete(type);
    }
  }

  stopJob(name) {
    if (this.jobs.has(name)) {
      this.jobs.get(name).stop();
      this.jobs.delete(name);
      logger.info(`Stopped job '${name}'`);
    }
  }

  stopAllJobs() {
    for (const [name, job] of this.jobs) {
      job.stop();
      logger.info(`Stopped job '${name}'`);
    }
    this.jobs.clear();
    logger.info('All scheduled jobs stopped');
  }

  getJobStatus(name) {
    return this.jobs.has(name) ? 'running' : 'stopped';
  }

  getAllJobsStatus() {
    const status = {};
    for (const [name] of this.jobs) {
      status[name] = 'running';
    }
    return status;
  }

  async updateSchedules() {
    try {
      logger.info('Updating schedules from database...');

      // Get updated schedule from config
      const pendingHourConfig = await Config.findOne({ where: { key: 'automation_hour_pending' } });
      const overdueHourConfig = await Config.findOne({ where: { key: 'automation_hour_overdue' } });

      const pendingHour = pendingHourConfig ? parseInt(pendingHourConfig.value) : 9;
      const overdueHour = overdueHourConfig ? parseInt(overdueHourConfig.value) : 11;

      // Reschedule jobs with new times
      this.scheduleJob('warning_and_due_today', `0 ${pendingHour} * * *`, async () => {
        await this.executeAutomation('warning_pending', async () => {
          return await AutomationService.runDailyWarningsAndDueToday();
        });
      });

      this.scheduleJob('overdue_notifications', `0 ${overdueHour} * * *`, async () => {
        await this.executeAutomation('overdue_notification', async () => {
          return await AutomationService.sendOverdueNotifications();
        });
      });

      logger.info(`Schedules updated - Pending: ${pendingHour}h, Overdue: ${overdueHour}h`);

    } catch (error) {
      logger.error('Update schedules error:', error);
    }
  }
}

module.exports = new SchedulerService();