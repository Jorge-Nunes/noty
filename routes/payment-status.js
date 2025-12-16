const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const PaymentStatusService = require('../services/PaymentStatusService');
const logger = require('../utils/logger');

/**
 * @route GET /api/payment-status/health
 * @desc Verifica a saúde do sistema de cobranças
 */
router.get('/health', authMiddleware, async (req, res) => {
  try {
    const health = await PaymentStatusService.getPaymentHealthStatus();
    res.json(health);
  } catch (error) {
    logger.error('Erro ao verificar saúde das cobranças:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route POST /api/payment-status/update-overdue
 * @desc Execução manual da atualização de cobranças vencidas
 */
router.post('/update-overdue', authMiddleware, async (req, res) => {
  try {
    logger.info(`Execução manual de atualização de cobranças solicitada pelo usuário`);
    
    const result = await PaymentStatusService.updateOverduePayments();
    
    if (result.success) {
      // Log da reconciliação Traccar se houver
      if (result.traccar_reconciliation && result.traccar_reconciliation.length > 0) {
        const blocked = result.traccar_reconciliation.filter(r => r.action === 'blocked').length;
        const unblocked = result.traccar_reconciliation.filter(r => r.action === 'unblocked').length;
        logger.info(`🔄 Reconciliação Traccar: ${blocked} bloqueados, ${unblocked} desbloqueados`);
      }
      
      res.json({
        success: true,
        message: 'Atualização de cobranças vencidas executada com sucesso',
        data: {
          processed: result.processed,
          updated: result.updated,
          execution_time: result.execution_time,
          payments_updated: result.payments_updated || [],
          affected_clients: result.affected_clients || [],
          traccar_integration: result.traccar_reconciliation ? {
            processed: result.traccar_reconciliation.length,
            blocked: result.traccar_reconciliation.filter(r => r.action === 'blocked').length,
            unblocked: result.traccar_reconciliation.filter(r => r.action === 'unblocked').length,
            details: result.traccar_reconciliation
          } : null
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Erro na atualização de cobranças vencidas',
        error: result.error_message
      });
    }
  } catch (error) {
    logger.error('Erro na execução manual de atualização de cobranças:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route POST /api/payment-status/update-all
 * @desc Execução manual da atualização completa de status
 */
router.post('/update-all', authMiddleware, async (req, res) => {
  try {
    logger.info(`Execução manual de atualização completa solicitada pelo usuário`);
    
    const result = await PaymentStatusService.updatePaymentStatuses();
    
    if (result.success) {
      // Log consolidado da reconciliação Traccar
      let totalTraccarProcessed = 0, totalBlocked = 0, totalUnblocked = 0;
      
      if (result.overdue_result?.traccar_reconciliation) {
        const overdueTraccar = result.overdue_result.traccar_reconciliation;
        totalTraccarProcessed += overdueTraccar.length;
        totalBlocked += overdueTraccar.filter(r => r.action === 'blocked').length;
        totalUnblocked += overdueTraccar.filter(r => r.action === 'unblocked').length;
      }
      
      if (result.revert_result?.traccar_reconciliation) {
        const revertTraccar = result.revert_result.traccar_reconciliation;
        totalTraccarProcessed += revertTraccar.length;
        totalBlocked += revertTraccar.filter(r => r.action === 'blocked').length;
        totalUnblocked += revertTraccar.filter(r => r.action === 'unblocked').length;
      }
      
      if (totalTraccarProcessed > 0) {
        logger.info(`🔄 Reconciliação Traccar completa: ${totalBlocked} bloqueados, ${totalUnblocked} desbloqueados`);
      }
      
      res.json({
        success: true,
        message: 'Atualização completa de status executada com sucesso',
        data: {
          execution_time: result.execution_time,
          overdue_updated: result.overdue_updated,
          reverted_updated: result.reverted_updated,
          total_processed: result.total_processed,
          errors: result.errors,
          traccar_integration: {
            total_processed: totalTraccarProcessed,
            total_blocked: totalBlocked,
            total_unblocked: totalUnblocked
          }
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Erro na atualização completa de status',
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Erro na execução manual de atualização completa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

module.exports = router;