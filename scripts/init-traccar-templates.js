const { MessageTemplate } = require('../models');
const logger = require('../utils/logger');

async function initTraccarTemplates() {
  try {
    console.log('🔄 Inicializando templates do Traccar...');

    const traccarTemplates = {
      traccar_block: {
        name: 'Bloqueio Traccar',
        description: 'Mensagem enviada quando o rastreamento é bloqueado',
        template: `🚫 Olá {client_name}, aqui é da *{company_name}*.

Informamos que seu serviço de rastreamento foi temporariamente bloqueado devido à inadimplência.

📊 Informações:
• Valor em atraso: {overdue_amount}
• Quantidade de cobranças: {overdue_count}
• Dias em atraso: {overdue_days}

Para reativar seu rastreamento, regularize sua situação financeira o quanto antes.

📞 Entre em contato: {company_phone}
Estamos aqui para ajudar! 🤝`,
        variables: [
          'client_name',
          'company_name', 
          'overdue_amount',
          'overdue_count',
          'overdue_days',
          'company_phone'
        ]
      },

      traccar_unblock: {
        name: 'Desbloqueio Traccar',
        description: 'Mensagem enviada quando o rastreamento é desbloqueado',
        template: `✅ Ótima notícia, {client_name}!

Seu serviço de rastreamento foi reativado com sucesso! 🎉

🚗 Seu veículo já está sendo monitorado novamente.
🛡️ Sua proteção está ativa!

Acesse: {traccar_url}

Obrigado por manter sua conta em dia!
*{company_name}* agradece sua confiança! 🤝

📞 Dúvidas? Entre em contato: {company_phone}`,
        variables: [
          'client_name',
          'company_name',
          'traccar_url',
          'company_phone'
        ]
      },

      traccar_warning: {
        name: 'Aviso de Bloqueio Traccar',
        description: 'Aviso enviado antes do bloqueio automático',
        template: `⚠️ ATENÇÃO {client_name}!

Seu serviço de rastreamento será bloqueado em {days_until_block} dia(s) devido à inadimplência.

📊 Situação atual:
• Valor em atraso: {overdue_amount}
• Cobranças pendentes: {overdue_count}

🚨 Para evitar o bloqueio, regularize sua situação o quanto antes!

📞 Entre em contato urgente: {company_phone}
*{company_name}* - Estamos aqui para ajudar! 🤝`,
        variables: [
          'client_name',
          'company_name',
          'overdue_amount', 
          'overdue_count',
          'days_until_block',
          'company_phone'
        ]
      }
    };

    let templatesCreated = 0;
    let templatesExisting = 0;

    for (const [type, templateData] of Object.entries(traccarTemplates)) {
      try {
        const existingTemplate = await MessageTemplate.findOne({
          where: { type }
        });

        if (existingTemplate) {
          console.log(`⏭️  Template já existe: ${type}`);
          templatesExisting++;
        } else {
          await MessageTemplate.create({
            type,
            name: templateData.name,
            description: templateData.description,
            template: templateData.template,
            variables: templateData.variables,
            is_active: true
          });
          console.log(`✅ Template criado: ${type}`);
          templatesCreated++;
        }
      } catch (error) {
        console.error(`❌ Erro ao criar template ${type}:`, error.message);
      }
    }

    console.log('\n📊 Resultado:');
    console.log(`✅ Templates criados: ${templatesCreated}`);
    console.log(`⏭️  Templates existentes: ${templatesExisting}`);
    console.log('🎉 Inicialização dos templates Traccar concluída!');

    return {
      created: templatesCreated,
      existing: templatesExisting,
      total: templatesCreated + templatesExisting
    };

  } catch (error) {
    console.error('❌ Erro ao inicializar templates Traccar:', error);
    throw error;
  }
}

// Executa se for chamado diretamente
if (require.main === module) {
  initTraccarTemplates()
    .then((result) => {
      console.log('✅ Scripts executado com sucesso:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Falha na execução:', error);
      process.exit(1);
    });
}

module.exports = { initTraccarTemplates };