const { MessageTemplate, Client, Config, MessageLog, TraccarIntegration } = require('../models');
const EvolutionService = require('./EvolutionService');
const logger = require('../utils/logger');

class TraccarNotificationService {
  constructor() {
    this.config = null;
  }

  /**
   * Inicializa o serviço com configurações
   */
  async initialize() {
    try {
      this.config = await this.getNotificationConfig();
      return true;
    } catch (error) {
      logger.error('Erro ao inicializar TraccarNotificationService:', error);
      return false;
    }
  }

  /**
   * Busca configurações de notificação
   */
  async getNotificationConfig() {
    const configs = await Config.findAll({
      where: {
        key: ['company_name', 'company_phone', 'traccar_url', 'traccar_notifications_enabled']
      }
    });

    const configObj = {};
    configs.forEach(config => {
      configObj[config.key] = config.value;
    });

    return {
      company_name: configObj.company_name || 'Sua Empresa',
      company_phone: configObj.company_phone || '(11) 99999-9999',
      traccar_url: configObj.traccar_url || '',
      notifications_enabled: configObj.traccar_notifications_enabled === 'true'
    };
  }

  /**
   * Envia notificação de bloqueio no Traccar
   */
  async sendBlockNotification(clientId, blockData) {
    try {
      if (!this.config?.notifications_enabled) {
        logger.info('Notificações Traccar desabilitadas');
        return { success: false, message: 'Notificações desabilitadas' };
      }

      const client = await Client.findByPk(clientId);
      if (!client || !client.mobile_phone) {
        logger.warn(`Cliente ${clientId} não encontrado ou sem telefone`);
        return { success: false, message: 'Cliente sem telefone' };
      }

      const template = await MessageTemplate.findOne({
        where: { type: 'traccar_block', is_active: true }
      });

      if (!template) {
        logger.error('Template traccar_block não encontrado');
        return { success: false, message: 'Template não encontrado' };
      }

      // Prepara variáveis para o template
      const variables = {
        client_name: client.name,
        overdue_amount: this.formatCurrency(blockData.overdue_amount || 0),
        overdue_count: blockData.overdue_count || 0,
        overdue_days: blockData.overdue_days || 0,
        company_name: this.config.company_name,
        company_phone: this.config.company_phone
      };

      // Processa o template
      const message = this.processTemplate(template.template, variables);

      // Envia mensagem via Evolution
      const result = await EvolutionService.sendMessage(client.mobile_phone, message);

      // Log da tentativa
      await MessageLog.create({
        client_id: clientId,
        message_type: 'traccar_block',
        phone_number: client.mobile_phone,
        message_content: message,
        status: result.success ? 'sent' : 'failed',
        error_message: result.success ? null : result.error
      });

      if (result.success) {
        logger.info(`Notificação de bloqueio enviada para ${client.name}`);
        return { success: true, message: 'Notificação enviada' };
      } else {
        logger.error(`Falha ao enviar notificação de bloqueio para ${client.name}:`, result.error);
        return { success: false, message: result.error };
      }

    } catch (error) {
      logger.error('Erro ao enviar notificação de bloqueio:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Envia notificação de desbloqueio no Traccar
   */
  async sendUnblockNotification(clientId) {
    try {
      if (!this.config?.notifications_enabled) {
        logger.info('Notificações Traccar desabilitadas');
        return { success: false, message: 'Notificações desabilitadas' };
      }

      const client = await Client.findByPk(clientId);
      if (!client || !client.mobile_phone) {
        logger.warn(`Cliente ${clientId} não encontrado ou sem telefone`);
        return { success: false, message: 'Cliente sem telefone' };
      }

      const template = await MessageTemplate.findOne({
        where: { type: 'traccar_unblock', is_active: true }
      });

      if (!template) {
        logger.error('Template traccar_unblock não encontrado');
        return { success: false, message: 'Template não encontrado' };
      }

      // Prepara variáveis para o template
      const variables = {
        client_name: client.name,
        traccar_url: this.config.traccar_url || 'seu sistema de rastreamento',
        company_name: this.config.company_name,
        company_phone: this.config.company_phone
      };

      // Processa o template
      const message = this.processTemplate(template.template, variables);

      // Envia mensagem via Evolution
      const result = await EvolutionService.sendMessage(client.mobile_phone, message);

      // Log da tentativa
      await MessageLog.create({
        client_id: clientId,
        message_type: 'traccar_unblock',
        phone_number: client.mobile_phone,
        message_content: message,
        status: result.success ? 'sent' : 'failed',
        error_message: result.success ? null : result.error
      });

      if (result.success) {
        logger.info(`Notificação de desbloqueio enviada para ${client.name}`);
        return { success: true, message: 'Notificação enviada' };
      } else {
        logger.error(`Falha ao enviar notificação de desbloqueio para ${client.name}:`, result.error);
        return { success: false, message: result.error };
      }

    } catch (error) {
      logger.error('Erro ao enviar notificação de desbloqueio:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Envia aviso antes do bloqueio
   */
  async sendWarningNotification(clientId, warningData) {
    try {
      if (!this.config?.notifications_enabled) {
        logger.info('Notificações Traccar desabilitadas');
        return { success: false, message: 'Notificações desabilitadas' };
      }

      const client = await Client.findByPk(clientId);
      if (!client || !client.mobile_phone) {
        logger.warn(`Cliente ${clientId} não encontrado ou sem telefone`);
        return { success: false, message: 'Cliente sem telefone' };
      }

      const template = await MessageTemplate.findOne({
        where: { type: 'traccar_warning', is_active: true }
      });

      if (!template) {
        logger.error('Template traccar_warning não encontrado');
        return { success: false, message: 'Template não encontrado' };
      }

      // Prepara variáveis para o template
      const variables = {
        client_name: client.name,
        overdue_amount: this.formatCurrency(warningData.overdue_amount || 0),
        overdue_count: warningData.overdue_count || 0,
        days_until_block: warningData.days_until_block || 0,
        company_name: this.config.company_name,
        company_phone: this.config.company_phone
      };

      // Processa o template
      const message = this.processTemplate(template.template, variables);

      // Envia mensagem via Evolution
      const result = await EvolutionService.sendMessage(client.mobile_phone, message);

      // Log da tentativa
      await MessageLog.create({
        client_id: clientId,
        message_type: 'traccar_warning',
        phone_number: client.mobile_phone,
        message_content: message,
        status: result.success ? 'sent' : 'failed',
        error_message: result.success ? null : result.error
      });

      if (result.success) {
        logger.info(`Aviso de bloqueio enviado para ${client.name}`);
        return { success: true, message: 'Aviso enviado' };
      } else {
        logger.error(`Falha ao enviar aviso para ${client.name}:`, result.error);
        return { success: false, message: result.error };
      }

    } catch (error) {
      logger.error('Erro ao enviar aviso de bloqueio:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Processa template substituindo variáveis
   */
  processTemplate(template, variables) {
    let processedTemplate = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{${key}}`, 'g');
      processedTemplate = processedTemplate.replace(regex, value);
    }
    
    return processedTemplate;
  }

  /**
   * Formata valor para moeda
   */
  formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  /**
   * Verifica se cliente deve receber aviso antes do bloqueio
   */
  async shouldSendWarning(clientId) {
    try {
      // Busca último aviso enviado
      const lastWarning = await MessageLog.findOne({
        where: {
          client_id: clientId,
          message_type: 'traccar_warning',
          status: 'sent'
        },
        order: [['created_at', 'DESC']]
      });

      // Se nunca enviou aviso ou último aviso foi há mais de 24h
      if (!lastWarning) {
        return true;
      }

      const hoursSinceLastWarning = (new Date() - new Date(lastWarning.created_at)) / (1000 * 60 * 60);
      return hoursSinceLastWarning >= 24; // Aviso máximo 1x por dia

    } catch (error) {
      logger.error('Erro ao verificar necessidade de aviso:', error);
      return false;
    }
  }

  /**
   * Busca estatísticas de notificações Traccar
   */
  async getNotificationStats(period = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - period);

      const stats = await MessageLog.findAll({
        where: {
          message_type: ['traccar_block', 'traccar_unblock', 'traccar_warning'],
          created_at: { [require('sequelize').Op.gte]: startDate }
        },
        attributes: [
          'message_type',
          'status',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        group: ['message_type', 'status']
      });

      const result = {
        total_notifications: 0,
        successful_notifications: 0,
        failed_notifications: 0,
        blocks_notified: 0,
        unblocks_notified: 0,
        warnings_sent: 0
      };

      stats.forEach(stat => {
        const count = parseInt(stat.getDataValue('count'));
        result.total_notifications += count;

        if (stat.status === 'sent') {
          result.successful_notifications += count;
          
          switch (stat.message_type) {
            case 'traccar_block':
              result.blocks_notified += count;
              break;
            case 'traccar_unblock':
              result.unblocks_notified += count;
              break;
            case 'traccar_warning':
              result.warnings_sent += count;
              break;
          }
        } else {
          result.failed_notifications += count;
        }
      });

      return result;

    } catch (error) {
      logger.error('Erro ao buscar estatísticas de notificações:', error);
      return null;
    }
  }
}

module.exports = new TraccarNotificationService();