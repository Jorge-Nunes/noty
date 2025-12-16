const { MessageTemplate } = require('../models');
const logger = require('../utils/logger');

async function initNewTraccarTemplates() {
  try {
    logger.info('🔧 Inicializando novos templates Traccar...');

    const newTemplates = [
      {
        type: 'traccar_warning_threshold',
        name: 'Aviso Limiar Traccar',
        description: 'Aviso enviado quando está no limiar de bloqueio (ex: 2 de 3 cobranças)',
        template: `⚠️ *ATENÇÃO {client_name}*

Você tem *{overdue_count} cobrança(s) vencida(s)* no valor de *{overdue_amount}*.

🚨 *PRÓXIMA COBRANÇA EM ATRASO = BLOQUEIO AUTOMÁTICO*

Limite: {overdue_count}/{block_limit} cobranças
Restante: {remaining_count} cobrança até o bloqueio

Para evitar a suspensão do rastreamento, regularize sua situação o quanto antes.

📞 Dúvidas: {company_phone}
_{company_name}_`,
        variables: [
          'client_name', 'overdue_count', 'overdue_amount', 'remaining_count', 
          'block_limit', 'company_name', 'company_phone'
        ],
        is_active: true
      },
      {
        type: 'traccar_warning_final',
        name: 'Aviso Final Traccar',
        description: 'Último aviso antes do bloqueio automático (quando atinge o limite)',
        template: `🚨 *BLOQUEIO IMINENTE - {client_name}*

⛔ Limite atingido: *{overdue_count}/{block_limit} cobranças vencidas*
💰 Valor total: *{overdue_amount}*

*SEU RASTREAMENTO SERÁ BLOQUEADO AUTOMATICAMENTE*

Este é o último aviso antes da suspensão do serviço. Regularize IMEDIATAMENTE para evitar o bloqueio.

📞 Urgente: {company_phone}
_{company_name}_`,
        variables: [
          'client_name', 'overdue_count', 'overdue_amount', 'block_limit',
          'company_name', 'company_phone'
        ],
        is_active: true
      }
    ];

    for (const templateData of newTemplates) {
      const [template, created] = await MessageTemplate.findOrCreate({
        where: { type: templateData.type },
        defaults: templateData
      });

      if (created) {
        logger.info(`✅ Template ${templateData.type} criado`);
      } else {
        // Atualiza template existente se necessário
        await template.update({
          name: templateData.name,
          description: templateData.description,
          template: templateData.template,
          variables: templateData.variables,
          is_active: templateData.is_active
        });
        logger.info(`🔄 Template ${templateData.type} atualizado`);
      }
    }

    logger.info('✅ Novos templates Traccar inicializados com sucesso!');

  } catch (error) {
    logger.error('❌ Erro ao inicializar templates:', error);
    process.exit(1);
  }
}

// Executa se chamado diretamente
if (require.main === module) {
  initNewTraccarTemplates()
    .then(() => {
      logger.info('🎯 Inicialização concluída!');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Falha na inicialização:', error);
      process.exit(1);
    });
}

module.exports = initNewTraccarTemplates;