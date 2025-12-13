const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Payment = sequelize.define('payments', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  asaas_id: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: 'ID do pagamento no Asaas'
  },
  client_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'clients',
      key: 'id'
    }
  },
  invoice_url: {
    type: DataTypes.TEXT,
    comment: 'URL da fatura'
  },
  bank_slip_url: {
    type: DataTypes.TEXT,
    comment: 'URL do boleto'
  },
  value: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  net_value: {
    type: DataTypes.DECIMAL(10, 2)
  },
  original_value: {
    type: DataTypes.DECIMAL(10, 2)
  },
  interest_value: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  description: {
    type: DataTypes.TEXT
  },
  billing_type: {
    type: DataTypes.ENUM('BOLETO', 'CREDIT_CARD', 'PIX', 'UNDEFINED'),
    defaultValue: 'BOLETO'
  },
  status: {
    type: DataTypes.ENUM(
      'PENDING',
      'RECEIVED',
      'CONFIRMED',
      'OVERDUE',
      'REFUNDED',
      'RECEIVED_IN_CASH',
      'REFUND_REQUESTED',
      'REFUND_IN_PROGRESS',
      'CHARGEBACK_REQUESTED',
      'CHARGEBACK_DISPUTE',
      'AWAITING_CHARGEBACK_REVERSAL',
      'DUNNING_REQUESTED',
      'DUNNING_RECEIVED',
      'AWAITING_RISK_ANALYSIS'
    ),
    allowNull: false,
    defaultValue: 'PENDING'
  },
  due_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  original_due_date: {
    type: DataTypes.DATEONLY
  },
  payment_date: {
    type: DataTypes.DATE
  },
  client_payment_date: {
    type: DataTypes.DATE
  },
  installment: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  external_reference: {
    type: DataTypes.STRING(200)
  },
  notification_disabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  authorized_only: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  last_warning_sent: {
    type: DataTypes.DATE,
    comment: 'Data do último aviso enviado'
  },
  warning_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Quantidade de avisos enviados'
  },
  last_overdue_sent: {
    type: DataTypes.DATE,
    comment: 'Data do último aviso de vencido enviado'
  },
  overdue_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Quantidade de avisos de vencido enviados'
  },
  last_sync: {
    type: DataTypes.DATE,
    comment: 'Última sincronização com o Asaas'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

module.exports = Payment;