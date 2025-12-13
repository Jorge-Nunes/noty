const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AutomationLog = sequelize.define('automation_logs', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  automation_type: {
    type: DataTypes.ENUM('warning_pending', 'overdue_notification', 'manual_sync'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('started', 'completed', 'failed', 'partial'),
    allowNull: false
  },
  clients_processed: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  payments_processed: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  messages_sent: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  messages_failed: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  execution_time: {
    type: DataTypes.INTEGER,
    comment: 'Tempo de execução em segundos'
  },
  error_details: {
    type: DataTypes.JSONB
  },
  summary: {
    type: DataTypes.JSONB,
    comment: 'Resumo da execução da automação'
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  completed_at: {
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

module.exports = AutomationLog;