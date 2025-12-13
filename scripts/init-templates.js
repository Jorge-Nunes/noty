const { MessageTemplate } = require('../models');
const logger = require('../utils/logger');

const defaultTemplates = [
  {
    type: 'warning',
    name: 'Aviso de Vencimento',
    description: 'Mensagem enviada dias antes do vencimento',
    template: `Olá {{client.name}}! 📅

Sua mensalidade da {{company.name}} vence em {{warning_days}} dias.

💰 Valor: {{payment.value_formatted}}
📅 Vencimento: {{payment.due_date_formatted}}

Para evitar interrupção do serviço, realize o pagamento até a data de vencimento.

🔗 Fatura: {{payment.invoice_url}}
🎫 Boleto: {{payment.bank_slip_url}}

Dúvidas? Entre em contato conosco!`,
    variables: ['client.name', 'company.name', 'warning_days', 'payment.value_formatted', 'payment.due_date_formatted', 'payment.invoice_url', 'payment.bank_slip_url'],
    is_active: true
  },
  {
    type: 'due_today',
    name: 'Vencimento Hoje',
    description: 'Mensagem enviada no dia do vencimento',
    template: `Olá {{client.name}}! ⏰

Sua mensalidade da {{company.name}} vence HOJE!

💰 Valor: {{payment.value_formatted}}
📅 Vencimento: {{payment.due_date_formatted}}

⚠️ Para evitar a interrupção do serviço, realize o pagamento hoje mesmo.

🔗 Fatura: {{payment.invoice_url}}
🎫 Boleto: {{payment.bank_slip_url}}

Precisa de ajuda? Estamos aqui para você!`,
    variables: ['client.name', 'company.name', 'payment.value_formatted', 'payment.due_date_formatted', 'payment.invoice_url', 'payment.bank_slip_url'],
    is_active: true
  },
  {
    type: 'overdue',
    name: 'Pagamento Vencido',
    description: 'Mensagem enviada para pagamentos vencidos',
    template: `Olá {{client.name}}! ⚠️

Sua mensalidade da {{company.name}} está VENCIDA!

💰 Valor: {{payment.value_formatted}}
📅 Venceu em: {{payment.due_date_formatted}}

🚨 Seu serviço pode ser suspenso a qualquer momento. Regularize sua situação o quanto antes.

🔗 Fatura: {{payment.invoice_url}}
🎫 Boleto: {{payment.bank_slip_url}}

Entre em contato conosco para negociar!`,
    variables: ['client.name', 'company.name', 'payment.value_formatted', 'payment.due_date_formatted', 'payment.invoice_url', 'payment.bank_slip_url'],
    is_active: true
  },
  {
    type: 'payment_received',
    name: 'Pagamento Recebido',
    description: 'Mensagem de agradecimento quando o pagamento é recebido',
    template: `Olá {{client.name}}! ✅

Recebemos seu pagamento da {{company.name}}!

💰 Valor: {{payment.value_formatted}}
📅 Pago em: {{payment.payment_date_formatted}}
🆔 Comprovante: {{payment.asaas_id}}

🎉 Obrigado por manter sua conta em dia! Seu serviço está garantido.

Precisando de algo? Estamos sempre à disposição!`,
    variables: ['client.name', 'company.name', 'payment.value_formatted', 'payment.payment_date_formatted', 'payment.asaas_id'],
    is_active: true
  },
  {
    type: 'payment_confirmed',
    name: 'Pagamento Confirmado',
    description: 'Mensagem enviada quando o pagamento é confirmado pelo banco',
    template: `Olá {{client.name}}! ✅ CONFIRMADO

Seu pagamento da {{company.name}} foi CONFIRMADO pelo banco!

💰 Valor: {{payment.value_formatted}}
📅 Confirmado em: {{payment.payment_date_formatted}}
🆔 Comprovante: {{payment.asaas_id}}

✨ Pagamento processado com sucesso! Muito obrigado pela pontualidade.

Continue conosco e tenha sempre o melhor serviço!`,
    variables: ['client.name', 'company.name', 'payment.value_formatted', 'payment.payment_date_formatted', 'payment.asaas_id'],
    is_active: true
  }
];

async function initTemplates() {
  try {
    console.log('🔧 Inicializando templates de mensagens...');
    
    for (const templateData of defaultTemplates) {
      try {
        const [template, created] = await MessageTemplate.upsert(templateData, {
          returning: true
        });
        
        if (created) {
          console.log(`✅ Template criado: ${template.name} (${template.type})`);
        } else {
          console.log(`🔄 Template atualizado: ${template.name} (${template.type})`);
        }
        
      } catch (error) {
        console.error(`❌ Erro ao processar template ${templateData.type}:`, error.message);
      }
    }
    
    console.log('🎉 Templates inicializados com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao inicializar templates:', error);
    throw error;
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  initTemplates()
    .then(() => {
      console.log('Script finalizado com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Erro no script:', error);
      process.exit(1);
    });
}

module.exports = { initTemplates };