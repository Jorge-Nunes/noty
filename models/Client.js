const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Client = sequelize.define('clients', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  asaas_id: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: 'ID do cliente no Asaas'
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(150),
    validate: {
      isEmail: true
    }
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  mobile_phone: {
    type: DataTypes.STRING(20)
  },
  cpf_cnpj: {
    type: DataTypes.STRING(20),
    unique: true
  },
  company: {
    type: DataTypes.STRING(200)
  },
  address: {
    type: DataTypes.TEXT
  },
  address_number: {
    type: DataTypes.STRING(20)
  },
  complement: {
    type: DataTypes.STRING(100)
  },
  province: {
    type: DataTypes.STRING(100)
  },
  city: {
    type: DataTypes.STRING(100)
  },
  state: {
    type: DataTypes.STRING(2)
  },
  postal_code: {
    type: DataTypes.STRING(10)
  },
  observations: {
    type: DataTypes.TEXT
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  notifications_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Se as notificações estão habilitadas para este cliente'
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

module.exports = Client;