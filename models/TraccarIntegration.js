const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TraccarIntegration = sequelize.define('TraccarIntegration', {
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
  traccar_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'ID do usuário no Traccar'
  },
  traccar_email: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Email usado para mapeamento com Traccar'
  },
  traccar_phone: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Telefone usado para mapeamento com Traccar'
  },
  mapping_method: {
    type: DataTypes.ENUM('EMAIL', 'PHONE', 'MANUAL', 'NOT_MAPPED'),
    defaultValue: 'NOT_MAPPED',
    comment: 'Método usado para mapear o cliente'
  },
  is_blocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Status de bloqueio no Traccar'
  },
  block_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Motivo do bloqueio'
  },
  auto_block_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Se o bloqueio automático está habilitado para este cliente'
  },
  last_sync_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Última sincronização com Traccar'
  },
  last_block_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data do último bloqueio'
  },
  last_unblock_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data do último desbloqueio'
  },
  sync_errors: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Últimos erros de sincronização'
  },
  traccar_user_data: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Cache dos dados do usuário no Traccar'
  }
}, {
  tableName: 'traccar_integrations',
  timestamps: true,
  indexes: [
    {
      fields: ['client_id'],
      unique: true
    },
    {
      fields: ['traccar_user_id']
    },
    {
      fields: ['mapping_method']
    },
    {
      fields: ['is_blocked']
    }
  ]
});

module.exports = TraccarIntegration;