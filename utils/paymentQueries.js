const { Op } = require('sequelize');

/**
 * Utilitário para consultas de pagamentos com condições padronizadas
 * Evita considerar pagamentos quitados como "em atraso"
 */
class PaymentQueries {
  
  /**
   * Condição para pagamentos realmente vencidos (não quitados e vencidos por data)
   * @returns {Object} Condição Sequelize para WHERE
   */
  static getOverdueCondition() {
    return {
      [Op.and]: [
        {
          // Não está quitado
          status: {
            [Op.notIn]: ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'REFUNDED']
          }
        },
        {
          // E venceu (due_date < hoje)
          due_date: {
            [Op.lt]: new Date().toISOString().split('T')[0]
          }
        }
      ]
    };
  }

  /**
   * Condição para pagamentos quitados (recebidos)
   * @returns {Object} Condição Sequelize para WHERE
   */
  static getPaidCondition() {
    return {
      status: {
        [Op.in]: ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']
      }
    };
  }

  /**
   * Condição para pagamentos pendentes (não vencidos ainda)
   * @returns {Object} Condição Sequelize para WHERE  
   */
  static getPendingCondition() {
    return {
      [Op.and]: [
        {
          status: {
            [Op.in]: ['PENDING']
          }
        },
        {
          due_date: {
            [Op.gte]: new Date().toISOString().split('T')[0]
          }
        }
      ]
    };
  }

  /**
   * Condição para pagamentos com status OVERDUE no banco (legacy)
   * Mantém compatibilidade com lógica existente
   * @returns {Object} Condição Sequelize para WHERE
   */
  static getStatusOverdueCondition() {
    return {
      status: 'OVERDUE'
    };
  }

  /**
   * Condição híbrida: pagamentos vencidos OU com status OVERDUE
   * Para casos onde é preciso capturar ambos os cenários
   * @returns {Object} Condição Sequelize para WHERE
   */
  static getAnyOverdueCondition() {
    return {
      [Op.or]: [
        this.getOverdueCondition(),
        this.getStatusOverdueCondition()
      ]
    };
  }
}

module.exports = PaymentQueries;