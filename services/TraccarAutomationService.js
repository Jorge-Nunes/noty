const { Client, Payment, Config, TraccarIntegration, AutomationLog } = require('../models');
const TraccarService = require('./TraccarService');
const TraccarNotificationService = require('./TraccarNotificationService');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

class TraccarAutomationService {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Executa o processo de automação de bloqueio/desbloqueio
   */
  async runAutomation() {
    const { sequelize } = require('../models');
    // Distributed lock to avoid concurrent runs across instances
    const lockKey = 'traccar_automation';
    const [[lockRow]] = await sequelize.query("SELECT pg_try_advisory_lock(hashtext(:key)) AS locked", { replacements: { key: lockKey } });
    if (!lockRow || lockRow.locked !== true) {
      logger.warn('Traccar automation skipped: another instance is running');
      return;
    }

    if (this.isRunning) {
      logger.warn('TraccarAutomationService já está em execução');
      return;
    }

    this.isRunning = true;
    logger.info('Iniciando automação Traccar');

    try {
      // Verifica se a integração está habilitada
      const isEnabled = await this.isAutomationEnabled();
      if (!isEnabled) {
        logger.info('Automação Traccar desabilitada');
        return;
      }

      // Inicializa o serviço Traccar
      const traccarInitialized = await TraccarService.initialize();
      if (!traccarInitialized) {
        logger.error('Falha ao inicializar TraccarService');
        return;
      }

      // Busca as regras de automação
      const rules = await this.getAutomationRules();

      // Executa verificações de bloqueio
      await this.processBlockingRules(rules);

      // Executa verificações de desbloqueio
      await this.processUnblockingRules(rules);

      logger.info('Automação Traccar concluída com sucesso');

    } catch (error) {
      logger.error('Erro na automação Traccar:', error);
    } finally {
      // Release distributed lock
      try {
        const { sequelize } = require('../models');
        await sequelize.query("SELECT pg_advisory_unlock(hashtext(:key))", { replacements: { key: 'traccar_automation' } });
      } catch (e) {
        logger.warn('Failed to release advisory lock for Traccar automation:', e.message);
      }

      this.isRunning = false;
    }
  }

  /**
   * Verifica se a automação está habilitada
   */
  async isAutomationEnabled() {
    try {
      const configs = await Config.findAll({
        where: {
          key: ['traccar_enabled', 'auto_block_enabled']
        }
      });

      const configObj = {};
      configs.forEach(config => {
        configObj[config.key] = config.value === 'true';
      });

      return configObj.traccar_enabled && configObj.auto_block_enabled;
    } catch (error) {
      logger.error('Erro ao verificar configurações:', error);
      return false;
    }
  }

  /**
   * Busca as regras de automação configuradas
   */
  async getAutomationRules() {
    try {
      const configs = await Config.findAll({
        where: {
          key: [
            'block_strategy',
            'block_after_count',
            'warn_after_days',
            'block_after_days',
            'unblock_on_payment',
            'whitelist_clients'
          ]
        }
      });

      const rules = {
        block_strategy: 'count',
        block_after_count: 3,
        warn_after_days: 5,
        block_after_days: 10,
        unblock_on_payment: true,
        whitelist_clients: []
      };

      configs.forEach(config => {
        let value = config.value;

        if (config.key === 'block_after_count') {
          value = parseInt(value) || 3;
        } else if (config.key === 'warn_after_days') {
          value = parseInt(value) || 5;
        } else if (config.key === 'block_after_days') {
          value = parseInt(value) || 10;
        } else if (config.key === 'unblock_on_payment') {
          value = value === 'true';
        } else if (config.key === 'whitelist_clients') {
          try {
            value = JSON.parse(value || '[]');
          } catch (e) {
            value = [];
          }
        } else if (config.key === 'block_strategy') {
          value = (value === 'days') ? 'days' : 'count';
        }

        rules[config.key] = value;
      });

      return rules;
    } catch (error) {
      logger.error('Erro ao buscar regras:', error);
      return null;
    }
  }

  /**
   * Processa as regras de bloqueio
   */
  async processBlockingRules(rules) {
    try {
      // Busca clientes que podem ser bloqueados
      const candidatesForBlocking = await this.findBlockingCandidates(rules);

      // Busca clientes que devem receber aviso antes do bloqueio  
      const candidatesForWarning = await this.findWarningCandidates(rules);

      logger.info(`Encontrados ${candidatesForBlocking.length} candidatos para bloqueio e ${candidatesForWarning.length} para aviso`);

      // Processa avisos primeiro
      for (const candidate of candidatesForWarning) {
        try {
          await this.sendWarning(candidate, rules);
        } catch (error) {
          logger.error(`Erro ao enviar aviso para cliente ${candidate.client.name}:`, error);
        }
      }

      // Processa bloqueios
      for (const candidate of candidatesForBlocking) {
        try {
          await this.blockClient(candidate, rules);
        } catch (error) {
          logger.error(`Erro ao bloquear cliente ${candidate.client.name}:`, error);
        }
      }

    } catch (error) {
      logger.error('Erro ao processar regras de bloqueio:', error);
    }
  }

  /**
   * Processa as regras de desbloqueio
   */
  async processUnblockingRules(rules) {
    try {
      if (!rules.unblock_on_payment) {
        return;
      }

      // Busca clientes bloqueados que podem ser desbloqueados
      const candidatesForUnblocking = await this.findUnblockingCandidates(rules);

      logger.info(`Encontrados ${candidatesForUnblocking.length} candidatos para desbloqueio`);

      for (const candidate of candidatesForUnblocking) {
        try {
          await this.unblockClient(candidate);
        } catch (error) {
          logger.error(`Erro ao desbloquear cliente ${candidate.client.name}:`, error);
        }
      }

    } catch (error) {
      logger.error('Erro ao processar regras de desbloqueio:', error);
    }
  }

  /**
   * Busca clientes candidatos ao bloqueio
   */
  async findBlockingCandidates(rules) {
    try {
      // Busca integrações de clientes não bloqueados e mapeados
      const integrations = await TraccarIntegration.findAll({
        where: {
          traccar_user_id: { [Op.ne]: null },
          is_blocked: false,
          auto_block_enabled: true,
          client_id: { [Op.notIn]: rules.whitelist_clients }
        },
        include: [{
          model: Client,
          as: 'client',
          include: [{
            model: Payment,
            as: 'payments',
            where: {
              status: 'OVERDUE'
            },
            required: true
          }]
        }]
      });

      // Filtra candidatos baseado apenas na quantidade de cobranças
      const candidates = [];

      for (const integration of integrations) {
        const client = integration.client;

        if (!client || !client.payments) {
          logger.warn(`Integração ${integration.id} não tem cliente ou pagamentos associados`);
          continue;
        }

        const overduePayments = client.payments;
        const overdueCount = overduePayments.length;
        const totalOverdueAmount = overduePayments.reduce((sum, payment) => sum + parseFloat(payment.value), 0);

        let shouldBlock = false;
        let oldestOverdueDays = 0;

        if (rules.block_strategy === 'days') {
          const now = new Date();
          const oldest = overduePayments.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];
          oldestOverdueDays = oldest ? Math.floor((now.getTime() - new Date(oldest.due_date).getTime()) / (1000 * 60 * 60 * 24)) : 0;
          shouldBlock = oldestOverdueDays >= (rules.block_after_days || 0);
        } else {
          // Default: count strategy
          shouldBlock = (overdueCount >= rules.block_after_count);
        }

        if (shouldBlock) {
          candidates.push({
            integration,
            client,
            overduePayments,
            overdueCount,
            totalOverdueAmount,
            oldestOverdueDays
          });
        }
      }

      return candidates;

    } catch (error) {
      logger.error('Erro ao buscar candidatos para bloqueio:', error);
      return [];
    }
  }

  /**
   * Busca clientes candidatos ao desbloqueio
   */
  async findUnblockingCandidates(rules) {
    try {
      // Busca integrações de clientes bloqueados
      const integrations = await TraccarIntegration.findAll({
        where: {
          traccar_user_id: { [Op.ne]: null },
          is_blocked: true
        },
        include: [{
          model: Client,
          as: 'client',
          include: [{
            model: Payment,
            as: 'payments',
            where: {
              status: 'OVERDUE'
            },
            required: false
          }]
        }]
      });

      // Filtra clientes que estão abaixo do limite de bloqueio
      const candidates = integrations.filter(integration => {
        const overduePayments = integration.client.payments || [];
        if (!overduePayments.length) return true; // sem atrasos -> desbloqueia

        if (rules.block_strategy === 'days') {
          const now = new Date();
          const oldest = overduePayments.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];
          const oldestDays = oldest ? Math.floor((now.getTime() - new Date(oldest.due_date).getTime()) / (1000 * 60 * 60 * 24)) : 0;
          return oldestDays < (rules.block_after_days || 0);
        } else {
          const overdueCount = overduePayments.length;
          return overdueCount < rules.block_after_count;
        }
      });

      return candidates.map(integration => ({
        integration,
        client: integration.client
      }));

    } catch (error) {
      logger.error('Erro ao buscar candidatos para desbloqueio:', error);
      return [];
    }
  }

  /**
   * Bloqueia um cliente no Traccar
   */
  async blockClient(candidate, rules) {
    const { integration, client, overdueCount, totalOverdueAmount } = candidate;

    const reason = `Bloqueio automático: ${overdueCount} cobrança(s) em atraso, total R$ ${totalOverdueAmount.toFixed(2)}`;

    try {
      // Bloqueia no Traccar
      await TraccarService.blockUser(integration.traccar_user_id, reason);

      // Atualiza a integração
      await integration.update({
        is_blocked: true,
        block_reason: reason,
        last_block_at: new Date(),
        last_sync_at: new Date()
      });

      // Envia notificação de bloqueio
      await TraccarNotificationService.initialize();
      const overduePayments = candidate.overduePayments || [];
      const oldestPayment = overduePayments.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];
      const overdueDays = oldestPayment ? Math.floor((new Date() - new Date(oldestPayment.due_date)) / (1000 * 60 * 60 * 24)) : 0;

      await TraccarNotificationService.sendBlockNotification(client.id, {
        reason,
        overdue_count: overdueCount,
        overdue_amount: totalOverdueAmount,
        overdue_days: overdueDays
      });



      logger.info(`Cliente ${client.name} bloqueado automaticamente no Traccar e notificado via WhatsApp`);

    } catch (error) {


      throw error;
    }
  }

  /**
   * Desbloqueia um cliente no Traccar
   */
  async unblockClient(candidate) {
    const { integration, client } = candidate;

    try {
      // Desbloqueia no Traccar
      await TraccarService.unblockUser(integration.traccar_user_id);

      // Atualiza a integração
      await integration.update({
        is_blocked: false,
        block_reason: null,
        last_unblock_at: new Date(),
        last_sync_at: new Date()
      });

      // Envia notificação de desbloqueio
      await TraccarNotificationService.initialize();
      await TraccarNotificationService.sendUnblockNotification(client.id);



      logger.info(`Cliente ${client.name} desbloqueado automaticamente no Traccar e notificado via WhatsApp`);

    } catch (error) {


      throw error;
    }
  }

  /**
   * Força a sincronização de um cliente específico
   */
  async syncClient(clientId) {
    try {
      const client = await Client.findByPk(clientId, {
        include: [{ model: TraccarIntegration, as: 'TraccarIntegration' }]
      });

      if (!client) {
        throw new Error('Cliente não encontrado');
      }

      let integration = client.TraccarIntegration;

      // Inicializa TraccarService se necessário
      await TraccarService.initialize();

      // Tenta mapear o cliente
      let traccarUser = null;
      let mappingMethod = 'NOT_MAPPED';

      if (client.email) {
        traccarUser = await TraccarService.findUserByEmail(client.email);
        if (traccarUser) {
          mappingMethod = 'EMAIL';
        }
      }

      if (!traccarUser && client.mobile_phone) {
        traccarUser = await TraccarService.findUserByPhone(client.mobile_phone);
        if (traccarUser) {
          mappingMethod = 'PHONE';
        }
      }

      // Cria ou atualiza a integração
      const integrationData = {
        client_id: client.id,
        traccar_user_id: traccarUser?.id || null,
        traccar_email: traccarUser?.email || null,
        traccar_phone: traccarUser?.phone || null,
        mapping_method: mappingMethod,
        last_sync_at: new Date(),
        traccar_user_data: traccarUser || null,
        sync_errors: null,
        // Verifica se está bloqueado no Traccar
        is_blocked: traccarUser ? await TraccarService.isUserBlocked(traccarUser.id) : false
      };

      if (integration) {
        await integration.update(integrationData);
      } else {
        integration = await TraccarIntegration.create(integrationData);
      }

      return {
        success: true,
        mapped: !!traccarUser,
        integration
      };

    } catch (error) {
      logger.error(`Erro ao sincronizar cliente ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Busca clientes candidatos ao aviso de bloqueio
   */
  async findWarningCandidates(rules) {
    try {
      // Busca integrações de clientes não bloqueados e mapeados
      const integrations = await TraccarIntegration.findAll({
        where: {
          traccar_user_id: { [Op.ne]: null },
          is_blocked: false,
          auto_block_enabled: true,
          client_id: { [Op.notIn]: rules.whitelist_clients }
        },
        include: [{
          model: Client,
          as: 'client',
          include: [{
            model: Payment,
            as: 'payments',
            where: {
              status: 'OVERDUE'
            },
            required: true
          }]
        }]
      });

      const candidates = [];

      for (const integration of integrations) {
        const client = integration.client;

        // Verifica se o cliente existe (pode ser null se foi deletado)
        if (!client || !client.payments) {
          logger.warn(`Integração ${integration.id} não tem cliente ou pagamentos associados (warning candidates)`);
          continue;
        }

        const overduePayments = client.payments;

        const overdueCount = overduePayments.length;
        const totalOverdueAmount = overduePayments.reduce((sum, payment) => sum + parseFloat(payment.value), 0);

        let shouldWarn = false;
        let daysUntilBlock = 0;
        let oldestOverdueDays = 0;

        if (rules.block_strategy === 'days') {
          const now = new Date();
          const oldest = overduePayments.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];
          oldestOverdueDays = oldest ? Math.floor((now.getTime() - new Date(oldest.due_date).getTime()) / (1000 * 60 * 60 * 24)) : 0;
          const warnThreshold = rules.warn_after_days || 0;
          const blockThreshold = rules.block_after_days || 0;
          shouldWarn = oldestOverdueDays >= warnThreshold && oldestOverdueDays < blockThreshold;
          daysUntilBlock = Math.max(0, blockThreshold - oldestOverdueDays);
        } else {
          // quantidade: avisa quando estiver exatamente no limiar (count = limit - 1)
          shouldWarn = (overdueCount === (rules.block_after_count - 1));
          daysUntilBlock = 0;
        }

        const shouldSendWarning = await TraccarNotificationService.shouldSendWarning(client.id);

        if (shouldWarn && shouldSendWarning) {
          candidates.push({
            integration,
            client,
            overduePayments,
            overdueCount,
            totalOverdueAmount,
            oldestOverdueDays,
            daysUntilBlock
          });
        }
      }

      return candidates;

    } catch (error) {
      logger.error('Erro ao buscar candidatos para aviso:', error);
      return [];
    }
  }

  /**
   * Envia aviso de bloqueio baseado no escalonamento por quantidade
   */
  async sendWarning(candidate, rules) {
    const { integration, client, overdueCount, totalOverdueAmount } = candidate;

    try {
      // Inicializa serviço de notificação
      await TraccarNotificationService.initialize();

      // Determina o tipo de aviso baseado na quantidade vs limite
      const remainingCount = rules.block_after_count - overdueCount;
      let warningType = 'traccar_warning_threshold';

      if (overdueCount === rules.block_after_count - 1) {
        // Está no limiar - próxima cobrança = bloqueio
        warningType = 'traccar_warning_threshold';
      } else if (overdueCount >= rules.block_after_count) {
        // Já atingiu o limite - aviso final (caso especial para reconciliação)
        warningType = 'traccar_warning_final';
      }

      // Envia aviso com tipo específico
      await TraccarNotificationService.sendWarningNotification(client.id, {
        overdue_count: overdueCount,
        overdue_amount: totalOverdueAmount,
        remaining_count: remainingCount,
        block_limit: rules.block_after_count,
        warning_type: warningType
      });

      logger.info(`Aviso "${warningType}" enviado para ${client.name} - ${overdueCount} de ${rules.block_after_count} cobranças em atraso`);

    } catch (error) {
      logger.error(`Erro ao enviar aviso para ${client.name}:`, error);
      throw error;
    }
  }
  /**
   * Reconcilia o status de bloqueio de um cliente em tempo real
   * Verifica se deve bloquear ou desbloquear baseado nas cobranças atuais
   */
  async reconcileClientBlockStatus(clientId) {
    try {
      // Verifica se automação está habilitada
      const isEnabled = await this.isAutomationEnabled();
      if (!isEnabled) {
        return { clientId, skipped: true, reason: 'Automação desabilitada' };
      }

      // Busca regras
      const rules = await this.getAutomationRules();
      if (!rules) {
        return { clientId, skipped: true, reason: 'Regras não encontradas' };
      }

      // Busca cliente com integração e pagamentos
      const client = await Client.findByPk(clientId, {
        include: [
          { 
            model: TraccarIntegration, 
            as: 'TraccarIntegration'
          },
          {
            model: Payment,
            as: 'payments',
            where: { status: 'OVERDUE' },
            required: false
          }
        ]
      });

      if (!client || !client.TraccarIntegration || !client.TraccarIntegration.traccar_user_id) {
        return { clientId, skipped: true, reason: 'Sem integração Traccar válida' };
      }

      const integration = client.TraccarIntegration;
      const overduePayments = client.payments || [];
      const overdueCount = overduePayments.length;
      const currentlyBlocked = integration.is_blocked;

      // Verifica se cliente está na whitelist
      if (rules.whitelist_clients.includes(clientId)) {
        return { clientId, skipped: true, reason: 'Cliente na whitelist' };
      }

      // Inicializa TraccarService se necessário
      await TraccarService.initialize();

      // Determina ação necessária
      let shouldBeBlocked = false;
      if (rules.block_strategy === 'days') {
        if (overduePayments.length === 0) {
          shouldBeBlocked = false;
        } else {
          const oldest = overduePayments.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];
          const oldestDays = oldest ? Math.floor((Date.now() - new Date(oldest.due_date).getTime()) / (1000 * 60 * 60 * 24)) : 0;
          shouldBeBlocked = oldestDays >= (rules.block_after_days || 0);
        }
      } else {
        shouldBeBlocked = overdueCount >= rules.block_after_count;
      }

      if (shouldBeBlocked && !currentlyBlocked) {
        // Deve bloquear
        const totalAmount = overduePayments.reduce((sum, p) => sum + parseFloat(p.value || 0), 0);
        
        await this.blockClient({
          integration,
          client,
          overduePayments,
          overdueCount,
          totalOverdueAmount: totalAmount
        }, rules);

        return { 
          clientId, 
          changed: true, 
          action: 'blocked',
          overdueCount,
          totalAmount: totalAmount.toFixed(2)
        };

      } else if (!shouldBeBlocked && currentlyBlocked && rules.unblock_on_payment) {
        // Deve desbloquear
        await this.unblockClient({
          integration,
          client
        });

        return { 
          clientId, 
          changed: true, 
          action: 'unblocked',
          overdueCount 
        };

      } else {
        // Não precisa alterar
        return { 
          clientId, 
          changed: false, 
          action: 'none',
          currentStatus: currentlyBlocked ? 'blocked' : 'active',
          overdueCount 
        };
      }

    } catch (error) {
      logger.error(`Erro na reconciliação em tempo real para cliente ${clientId}:`, error);
      return { clientId, error: true, message: error.message };
    }
  }

  /**
   * Reconcilia múltiplos clientes em batch (otimizado)
   */
  async reconcileMultipleClients(clientIds, maxConcurrency = 3) {
    if (!clientIds || clientIds.length === 0) return [];

    logger.info(`Reconciliando ${clientIds.length} clientes em tempo real...`);
    
    const results = [];
    const chunks = [];
    
    // Divide em chunks para evitar sobrecarga
    for (let i = 0; i < clientIds.length; i += maxConcurrency) {
      chunks.push(clientIds.slice(i, i + maxConcurrency));
    }

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(clientId => 
        this.reconcileClientBlockStatus(clientId).catch(error => ({
          clientId,
          error: true,
          message: error.message
        }))
      );
      
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    // Log do resultado
    const blocked = results.filter(r => r.action === 'blocked').length;
    const unblocked = results.filter(r => r.action === 'unblocked').length;
    const errors = results.filter(r => r.error).length;
    
    logger.info(`Reconciliação concluída: ${blocked} bloqueados, ${unblocked} desbloqueados, ${errors} erros`);

    return results;
  }

  /**
   * Verifica e desbloqueia um cliente específico se elegível
   * Usado principalmente por webhooks de pagamento
   */
  async checkAndUnblockClient(clientId) {
    try {
      // Verifica se automação está habilitada
      const isEnabled = await this.isAutomationEnabled();
      if (!isEnabled) return;

      // Busca regras
      const rules = await this.getAutomationRules();
      if (!rules || !rules.unblock_on_payment) return;

      // Busca integração do cliente se estiver bloqueada
      const integration = await TraccarIntegration.findOne({
        where: {
          client_id: clientId,
          is_blocked: true,
          traccar_user_id: { [Op.ne]: null }
        },
        include: [{
          model: Client,
          as: 'client'
        }]
      });

      if (!integration) return; // Cliente não está bloqueado ou sem integração

      // Verifica se ainda existem pagamentos vencidos
      const overduePayments = await Payment.findAll({
        where: {
          client_id: clientId,
          status: 'OVERDUE'
        },
        order: [['due_date', 'ASC']]
      });

      let canUnblock = false;
      if (rules.block_strategy === 'days') {
        if (overduePayments.length === 0) {
          canUnblock = true;
        } else {
          const oldest = overduePayments[0];
          const oldestDays = oldest ? Math.floor((Date.now() - new Date(oldest.due_date).getTime()) / (1000 * 60 * 60 * 24)) : 0;
          canUnblock = oldestDays < (rules.block_after_days || 0);
        }
      } else {
        const overdueCount = overduePayments.length;
        canUnblock = overdueCount < rules.block_after_count;
      }

      if (canUnblock) {
        logger.info(`Cliente ${integration.client.name} atende critérios para desbloqueio. Iniciando desbloqueio.`);

        // Inicializa TraccarService se necessário
        await TraccarService.initialize();

        await this.unblockClient({
          integration,
          client: integration.client
        });
      }

    } catch (error) {
      logger.error(`Erro ao verificar desbloqueio imediato para cliente ${clientId}:`, error);
    }
  }
}

module.exports = new TraccarAutomationService();
