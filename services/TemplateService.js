const { MessageTemplate, Config } = require('../models');
const logger = require('../utils/logger');

class TemplateService {
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

  constructor() {
    this.defaultTemplates = {
      warning: {
        name: 'Aviso de Vencimento',
        description: 'Mensagem enviada X dias antes do vencimento',
        template: `🔔 Olá {{cliente.name}}, tudo bem? Somos da *{{company.name}}*.
Faltam apenas {{warning_days}} dia(s) para o vencimento da sua fatura 🗓️.
Evite a suspensão do serviço e mantenha sua proteção ativa! 🛡️

🔗 Link da fatura: {{payment.invoice_url}}
🔗 Link do boleto: {{payment.bank_slip_url}}
💰 Valor: {{payment.value_formatted}}
🗓️ Vencimento: {{payment.due_date_formatted}}

Estamos aqui para ajudar no que precisar! 🤝`,
        variables: ['cliente.name', 'company.name', 'warning_days', 'payment.invoice_url', 'payment.bank_slip_url', 'payment.value_formatted', 'payment.due_date_formatted']
      },
      
      due_today: {
        name: 'Vencimento Hoje',
        description: 'Mensagem enviada no dia do vencimento',
        template: `🚗💨 Olá {{cliente.name}}, aqui é da *{{company.name}}*!
Notamos que sua fatura vence *hoje* 📅.
Para evitar juros e manter seu rastreamento ativo, faça o pagamento o quanto antes.

🔗 Link da fatura: {{payment.invoice_url}}
🔗 Link do boleto: {{payment.bank_slip_url}}
💰 Valor: {{payment.value_formatted}}
📆 Vencimento: {{payment.due_date_formatted}}

Qualquer dúvida, nossa equipe está à disposição! 🤝`,
        variables: ['cliente.name', 'company.name', 'payment.invoice_url', 'payment.bank_slip_url', 'payment.value_formatted', 'payment.due_date_formatted']
      },
      
      overdue: {
        name: 'Pagamento Vencido',
        description: 'Mensagem enviada para pagamentos vencidos',
        template: `⚠️ Olá {{cliente.name}}, somos da *{{company.name}}*.
Identificamos que sua fatura está *vencida* ⏳.

🗓️ Vencimento: {{payment.due_date_formatted}}
💰 Valor: {{payment.value_formatted}}
🔗 Link da fatura: {{payment.invoice_url}}

Pedimos que regularize o pagamento para evitar interrupção no rastreamento 🚗📡.
Se já tiver efetuado o pagamento, por favor desconsidere esta mensagem.
Conte conosco para qualquer dúvida! 🤝`,
        variables: ['cliente.name', 'company.name', 'payment.due_date_formatted', 'payment.value_formatted', 'payment.invoice_url']
      },
      
      payment_received: {
        name: 'Pagamento Recebido',
        description: 'Mensagem de agradecimento quando o pagamento é recebido',
        template: `✅ Olá {{cliente.name}}!
Recebemos seu pagamento com sucesso! 🎉

💰 Valor: {{payment.value_formatted}}
📅 Data do pagamento: {{payment.payment_date_formatted}}
🔖 Referência: {{payment.asaas_id}}

Obrigado por manter sua conta em dia! Seu rastreamento continua ativo e protegido.
{{company.name}} agradece sua confiança! 🚗🛡️`,
        variables: ['cliente.name', 'payment.value_formatted', 'payment.payment_date_formatted', 'payment.asaas_id', 'company.name']
      },
      
      payment_confirmed: {
        name: 'Pagamento Confirmado',
        description: 'Mensagem enviada quando o pagamento é confirmado',
        template: `🎉 Excelente notícia, {{cliente.name}}!
Seu pagamento foi confirmado com sucesso! ✅

💰 Valor: {{payment.value_formatted}}
📅 Confirmado em: {{payment.payment_date_formatted}}
🔖 Comprovante: {{payment.asaas_id}}

Sua proteção veicular está garantida! 🚗🛡️
Obrigado por escolher a {{company.name}}! 🤝`,
        variables: ['cliente.name', 'payment.value_formatted', 'payment.payment_date_formatted', 'payment.asaas_id', 'company.name']
      }
    };
  }

  async initializeDefaultTemplates() {
    try {
      for (const [type, templateData] of Object.entries(this.defaultTemplates)) {
        const existing = await MessageTemplate.findOne({ where: { type } });
        if (!existing) {
          await MessageTemplate.create({
            type,
            ...templateData
          });
          logger.info(`Default template created: ${type}`);
        }
      }
    } catch (error) {
      logger.error('Error initializing default templates:', error);
    }
  }

  async getTemplate(type) {
    try {
      return await MessageTemplate.findOne({
        where: { type, is_active: true }
      });
    } catch (error) {
      logger.error('Error getting template:', error);
      return null;
    }
  }

  async getProcessedTemplate(type, data) {
    try {
      const template = await this.getTemplate(type);
      if (!template) {
        logger.warn(`Template not found: ${type}`);
        return null;
      }

      // Ensure company name is from database config
      const enhancedData = {
        ...data,
        company: {
          ...data.company,
          name: await this.getCompanyName()
        }
      };

      return this.processTemplate(template.template, enhancedData);
    } catch (error) {
      logger.error('Error processing template:', error);
      return null;
    }
  }

  processTemplate(template, data) {
    try {
      let processedTemplate = template;

      // Process client data
      if (data.client) {
        processedTemplate = processedTemplate.replace(/{{client\.name}}/g, data.client.name || '');
        processedTemplate = processedTemplate.replace(/{{cliente\.name}}/g, data.client.name || '');
        processedTemplate = processedTemplate.replace(/{{client\.phone}}/g, data.client.phone || '');
        processedTemplate = processedTemplate.replace(/{{cliente\.phone}}/g, data.client.phone || '');
        processedTemplate = processedTemplate.replace(/{{client\.email}}/g, data.client.email || '');
        processedTemplate = processedTemplate.replace(/{{cliente\.email}}/g, data.client.email || '');
      }

      // Process payment data
      if (data.payment) {
        processedTemplate = processedTemplate.replace(/{{payment\.value_formatted}}/g, 
          this.formatCurrency(data.payment.value));
        processedTemplate = processedTemplate.replace(/{{payment\.due_date_formatted}}/g, 
          this.formatDate(data.payment.due_date));
        processedTemplate = processedTemplate.replace(/{{payment\.payment_date_formatted}}/g, 
          this.formatDate(data.payment.payment_date));
        processedTemplate = processedTemplate.replace(/{{payment\.invoice_url}}/g, 
          data.payment.invoice_url || 'Não disponível');
        processedTemplate = processedTemplate.replace(/{{payment\.bank_slip_url}}/g, 
          data.payment.bank_slip_url || 'Não disponível');
        processedTemplate = processedTemplate.replace(/{{payment\.asaas_id}}/g, 
          data.payment.asaas_id || '');
      }

      // Process company data
      if (data.company) {
        processedTemplate = processedTemplate.replace(/{{company\.name}}/g, data.company.name || '');
      }

      // Process warning days
      if (data.warning_days !== undefined) {
        processedTemplate = processedTemplate.replace(/{{warning_days}}/g, data.warning_days);
      }

      return processedTemplate;

    } catch (error) {
      logger.error('Error processing template:', error);
      return template; // Return original template if processing fails
    }
  }

  formatCurrency(value) {
    try {
      return parseFloat(value || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      });
    } catch (error) {
      return `R$ ${value || 0}`;
    }
  }

  formatDate(date) {
    try {
      if (!date) return 'Data não disponível';
      
      // Handle date string format YYYY-MM-DD
      if (typeof date === 'string' && date.includes('-')) {
        const [year, month, day] = date.split('-').map(Number);
        return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
      }
      
      return new Date(date).toLocaleDateString('pt-BR');
    } catch (error) {
      return 'Data não disponível';
    }
  }

  // Get available variables for a template type
  getAvailableVariables(type) {
    if (this.defaultTemplates[type]) {
      return this.defaultTemplates[type].variables;
    }
    
    return [
      'cliente.name',
      'cliente.phone',
      'cliente.email',
      'payment.value_formatted',
      'payment.due_date_formatted',
      'payment.payment_date_formatted',
      'payment.invoice_url',
      'payment.bank_slip_url',
      'payment.asaas_id',
      'company.name',
      'warning_days'
    ];
  }
}

module.exports = new TemplateService();