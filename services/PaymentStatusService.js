const { Payment } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

/**
 * Serviço responsável pela atualização automática do status de cobranças
 */
class PaymentStatusService {
  /**
   * Atualiza cobranças vencidas de PENDING para OVERDUE
   */
  async updateOverduePayments() {
    try {
      const startTime = new Date();
      logger.info('🔄 Iniciando atualização de cobranças vencidas...');

      // Data/hora atual para comparação
      const now = new Date();
      now.setHours(23, 59, 59, 999); // Final do dia atual

      // Buscar cobranças que deveriam estar como OVERDUE
      const pendingOverduePayments = await Payment.findAll({
        where: {
          status: 'PENDING',
          due_date: { [Op.lt]: now }
        }
      });

      logger.info(`📊 Encontradas ${pendingOverduePayments.length} cobranças PENDING vencidas`);

      if (pendingOverduePayments.length === 0) {
        logger.info('✅ Nenhuma cobrança precisa ser atualizada');
        return {
          success: true,
          updated: 0,
          processed: 0,
          errors: 0,
          execution_time: new Date() - startTime
        };
      }

      // Atualizar em lote para melhor performance
      const [updatedCount] = await Payment.update(
        { 
          status: 'OVERDUE',
          updated_at: new Date()
        },
        {
          where: {
            status: 'PENDING',
            due_date: { [Op.lt]: now }
          }
        }
      );

      const executionTime = new Date() - startTime;

      logger.info(`✅ Atualização concluída:`);
      logger.info(`   - Cobranças processadas: ${pendingOverduePayments.length}`);
      logger.info(`   - Cobranças atualizadas: ${updatedCount}`);
      logger.info(`   - Tempo de execução: ${executionTime}ms`);

      // Log detalhado para auditoria
      if (process.env.NODE_ENV === 'development') {
        logger.debug('📋 Detalhes das cobranças atualizadas:');
        pendingOverduePayments.slice(0, 10).forEach(payment => {
          logger.debug(`   - ID: ${payment.id}, Valor: R$ ${payment.value}, Vencimento: ${payment.due_date.toLocaleDateString('pt-BR')}`);
        });
        if (pendingOverduePayments.length > 10) {
          logger.debug(`   ... e mais ${pendingOverduePayments.length - 10} cobranças`);
        }
      }

      return {
        success: true,
        updated: updatedCount,
        processed: pendingOverduePayments.length,
        errors: 0,
        execution_time: executionTime,
        payments_updated: pendingOverduePayments.map(p => ({
          id: p.id,
          value: p.value,
          due_date: p.due_date,
          client_id: p.client_id
        }))
      };

    } catch (error) {
      logger.error('❌ Erro ao atualizar cobranças vencidas:', error);
      
      return {
        success: false,
        updated: 0,
        processed: 0,
        errors: 1,
        error_message: error.message,
        execution_time: 0
      };
    }
  }

  /**
   * Atualiza cobranças que voltaram a estar no prazo (caso a data de vencimento seja alterada)
   */
  async updateNotOverduePayments() {
    try {
      logger.info('🔄 Verificando cobranças OVERDUE que voltaram a estar no prazo...');

      const now = new Date();

      // Buscar cobranças OVERDUE que não deveriam estar vencidas
      const [updatedCount] = await Payment.update(
        { 
          status: 'PENDING',
          updated_at: new Date()
        },
        {
          where: {
            status: 'OVERDUE',
            due_date: { [Op.gte]: now }
          }
        }
      );

      if (updatedCount > 0) {
        logger.info(`✅ ${updatedCount} cobrança(s) revertida(s) para PENDING (data de vencimento foi alterada)`);
      }

      return { updated: updatedCount };

    } catch (error) {
      logger.error('❌ Erro ao reverter cobranças não vencidas:', error);
      return { updated: 0, error: error.message };
    }
  }

  /**
   * Execução completa de atualização de status
   */
  async updatePaymentStatuses() {
    try {
      logger.info('🔄 Executando atualização completa de status de cobranças...');

      const startTime = new Date();

      // 1. Atualizar cobranças vencidas para OVERDUE
      const overdueResult = await this.updateOverduePayments();

      // 2. Reverter cobranças que não estão mais vencidas (opcional)
      const revertResult = await this.updateNotOverduePayments();

      const totalTime = new Date() - startTime;

      const result = {
        success: overdueResult.success,
        execution_time: totalTime,
        overdue_updated: overdueResult.updated,
        reverted_updated: revertResult.updated,
        total_processed: overdueResult.processed,
        errors: overdueResult.errors
      };

      logger.info(`🎯 Atualização completa finalizada em ${totalTime}ms`);

      return result;

    } catch (error) {
      logger.error('❌ Erro na atualização completa de status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verifica a saúde do sistema de cobranças
   */
  async getPaymentHealthStatus() {
    try {
      const now = new Date();

      const stats = {
        pending_total: await Payment.count({ where: { status: 'PENDING' } }),
        pending_overdue: await Payment.count({
          where: {
            status: 'PENDING',
            due_date: { [Op.lt]: now }
          }
        }),
        overdue_total: await Payment.count({ where: { status: 'OVERDUE' } }),
        paid_total: await Payment.count({ where: { status: 'PAID' } }),
        last_update: new Date()
      };

      stats.health_score = stats.pending_overdue === 0 ? 100 : 
                          Math.max(0, 100 - (stats.pending_overdue / stats.pending_total * 100));

      return {
        success: true,
        data: {
          stats,
          status: stats.pending_overdue === 0 ? 'HEALTHY' : 'NEEDS_UPDATE'
        }
      };

    } catch (error) {
      logger.error('❌ Erro ao verificar saúde das cobranças:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new PaymentStatusService();