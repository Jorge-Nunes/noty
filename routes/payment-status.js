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
      res.json({
        success: true,
        message: 'Atualização de cobranças vencidas executada com sucesso',
        data: {
          processed: result.processed,
          updated: result.updated,
          execution_time: result.execution_time,
          payments_updated: result.payments_updated || []
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
      res.json({
        success: true,
        message: 'Atualização completa de status executada com sucesso',
        data: {
          execution_time: result.execution_time,
          overdue_updated: result.overdue_updated,
          reverted_updated: result.reverted_updated,
          total_processed: result.total_processed,
          errors: result.errors
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