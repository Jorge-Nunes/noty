const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MessageLog = sequelize.define('message_logs', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  client_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'clients',
      key: 'id'
    }
  },
  payment_id: {
    type: DataTypes.UUID,
    references: {
      model: 'payments',
      key: 'id'
    }
  },
  user_id: {
    type: DataTypes.UUID,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  phone_number: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  message_content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  message_type: {
    type: DataTypes.ENUM('warning', 'due_today', 'overdue', 'manual', 'payment_received', 'payment_confirmed', 'traccar_block', 'traccar_unblock', 'traccar_warning'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'sent', 'delivered', 'failed', 'error'),
    defaultValue: 'pending'
  },
  evolution_response: {
    type: DataTypes.JSONB,
    comment: 'Resposta da API Evolution'
  },
  error_message: {
    type: DataTypes.TEXT
  },
  sent_at: {
    type: DataTypes.DATE
  },
  delivered_at: {
    type: DataTypes.DATE
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

module.exports = MessageLog;