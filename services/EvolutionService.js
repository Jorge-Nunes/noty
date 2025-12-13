const axios = require('axios');
const { Config } = require('../models');
const logger = require('../utils/logger');

class EvolutionService {
  constructor() {
    this.baseURL = null;
    this.apiKey = null;
    this.instance = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      const urlConfig = await Config.findOne({ where: { key: 'evolution_api_url' } });
      const keyConfig = await Config.findOne({ where: { key: 'evolution_api_key' } });
      const instanceConfig = await Config.findOne({ where: { key: 'evolution_instance' } });

      if (!urlConfig?.value || !keyConfig?.value || !instanceConfig?.value) {
        throw new Error('Configurações da Evolution API incompletas (URL, Key ou Instance vazios)');
      }

      this.baseURL = urlConfig.value;
      this.apiKey = keyConfig.value;
      this.instance = instanceConfig.value;
      this.initialized = true;
    } catch (error) {
      logger.error('EvolutionService initialization error:', error);
      throw error;
    }
  }

  async makeRequest(endpoint, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const config = {
        baseURL: this.baseURL,
        url: endpoint,
        headers: {
          'apikey': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000,
        ...options
      };

      const response = await axios(config);
      return { success: true, data: response.data };
    } catch (error) {
      logger.error(`Evolution API error on ${endpoint}:`, error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status
      };
    }
  }

  async sendMessage(phoneNumber, message, retries = 2) {
    // Format phone number (ensure it starts with 55 for Brazil)
    let formattedPhone = phoneNumber.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    if (!this.initialized) {
      await this.initialize();
    }

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        const result = await this.makeRequest(`/message/sendText/${this.instance}`, {
          method: 'POST',
          data: {
            number: formattedPhone,
            text: message
          }
        });

        if (result.success) {
          if (attempt > 1) {
            logger.info(`✅ Message sent successfully to ${formattedPhone} on attempt ${attempt}`);
          } else {
            logger.info(`Message sent successfully to ${formattedPhone}`);
          }
          return {
            success: true,
            data: result.data,
            phone_number: formattedPhone
          };
        } else {
          // Check if it's a retryable error
          const errorStr = typeof result.error === 'object' ? JSON.stringify(result.error) : String(result.error);
          const isRetryableError = !errorStr.includes('exists":false') &&
            !errorStr.includes('Bad Request') &&
            !errorStr.includes('instance does not exist');

          if (!isRetryableError || attempt > retries) {
            logger.error(`Failed to send message to ${formattedPhone}:`, result.error);
            return {
              success: false,
              error: result.error,
              phone_number: formattedPhone
            };
          }

          logger.warn(`❌ Attempt ${attempt} failed for ${formattedPhone}: ${result.error}`);
          if (attempt <= retries) {
            logger.info(`🔄 Retrying in 1 second... (${retries - attempt + 1} retries left)`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } catch (error) {
        logger.error(`Send message attempt ${attempt} error:`, error);

        if (attempt > retries) {
          return {
            success: false,
            error: error.message,
            phone_number: formattedPhone
          };
        }

        logger.info(`🔄 Retrying in 1 second... (${retries - attempt + 1} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async sendBulkMessages(messages) {
    const results = [];

    for (const messageData of messages) {
      const { phone_number, message } = messageData;

      const result = await this.sendMessage(phone_number, message);
      results.push({
        ...messageData,
        ...result
      });

      // Add delay between messages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return results;
  }

  async getInstanceStatus() {
    if (!this.initialized) {
      await this.initialize();
    }

    const result = await this.makeRequest(`/instance/connectionState/${this.instance}`, {
      method: 'GET'
    });

    if (result.success) {
      return result.data;
    } else {
      throw new Error(`Erro ao verificar status da instância: ${result.error}`);
    }
  }

  async getInstanceInfo() {
    if (!this.initialized) {
      await this.initialize();
    }

    const result = await this.makeRequest(`/instance/fetchInstances`, {
      method: 'GET'
    });

    if (result.success) {
      const instances = result.data;
      const currentInstance = instances.find(inst => inst.instance?.instanceName === this.instance);
      return currentInstance || null;
    } else {
      throw new Error(`Erro ao buscar informações da instância: ${result.error}`);
    }
  }

  formatMessage(template, data) {
    try {
      let message = template;

      // Replace placeholders with actual data
      const replacements = {
        '{{ $json.cliente.name }}': data.client?.name || '',
        '{{ $json.cliente.celular }}': data.client?.phone || data.client?.mobile_phone || '',
        '{{ $json.link_fatura }}': data.payment?.invoice_url || '',
        '{{ $json.link_boleto }}': data.payment?.bank_slip_url || '',
        '{{ $json.valor }}': data.payment?.value ? this.formatCurrency(data.payment.value) : '',
        '{{ $json.vencimento }}': data.payment?.due_date ? this.formatDate(data.payment.due_date) : '',
        '{{ $json.valor.toLocaleString(\'pt-BR\', { style: \'currency\', currency: \'BRL\' }) }}':
          data.payment?.value ? this.formatCurrency(data.payment.value) : ''
      };

      // Apply replacements
      for (const [placeholder, value] of Object.entries(replacements)) {
        message = message.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
      }

      return message;
    } catch (error) {
      logger.error('Format message error:', error);
      return template;
    }
  }

  formatCurrency(value) {
    return parseFloat(value).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  }

  formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('pt-BR');
  }

  // Get message template (deprecated - use TemplateService instead)
  getWarningTemplate(warningDays) {
    const TemplateService = require('./TemplateService');
    return TemplateService.getProcessedTemplate('warning', { warning_days: warningDays });
  }

  getDueTodayTemplate() {
    const TemplateService = require('./TemplateService');
    return TemplateService.getProcessedTemplate('due_today', {});
  }

  getOverdueTemplate() {
    const TemplateService = require('./TemplateService');
    return TemplateService.getProcessedTemplate('overdue', {});
  }
}

module.exports = new EvolutionService();