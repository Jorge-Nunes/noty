const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WebhookLog = sequelize.define('webhook_logs', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  event_type: {
    type: DataTypes.ENUM(
      'PAYMENT_RECEIVED',
      'PAYMENT_CONFIRMED', 
      'PAYMENT_OVERDUE',
      'PAYMENT_CREATED',
      'PAYMENT_UPDATED',
      'PAYMENT_DELETED'
    ),
    allowNull: false
  },
  payment_id: {
    type: DataTypes.UUID,
    references: {
      model: 'payments',
      key: 'id'
    }
  },
  client_id: {
    type: DataTypes.UUID,
    references: {
      model: 'clients',
      key: 'id'
    }
  },
  client_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  asaas_payment_id: {
    type: DataTypes.STRING,
    allowNull: false
  },
  payment_value: {
    type: DataTypes.DECIMAL(10, 2)
  },
  processing_time: {
    type: DataTypes.INTEGER,
    comment: 'Tempo de processamento em milissegundos'
  },
  status: {
    type: DataTypes.ENUM('success', 'error', 'partial'),
    allowNull: false
  },
  message_sent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  message_type: {
    type: DataTypes.ENUM('payment_received', 'payment_confirmed', 'overdue', 'warning'),
    allowNull: true
  },
  webhook_payload: {
    type: DataTypes.JSONB,
    comment: 'Payload completo recebido do webhook'
  },
  error_details: {
    type: DataTypes.JSONB,
    comment: 'Detalhes do erro, se houver'
  },
  response_data: {
    type: DataTypes.JSONB,
    comment: 'Resposta da Evolution API'
  },
  ip_address: {
    type: DataTypes.INET,
    comment: 'IP que enviou o webhook'
  },
  user_agent: {
    type: DataTypes.TEXT,
    comment: 'User agent do request'
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

// Associações
WebhookLog.associate = (models) => {
  WebhookLog.belongsTo(models.Client, { foreignKey: 'client_id', as: 'client' });
  WebhookLog.belongsTo(models.Payment, { foreignKey: 'payment_id', as: 'payment' });
};

module.exports = WebhookLog;