const { sequelize } = require('../config/database');
const User = require('./User');
const Client = require('./Client');
const Payment = require('./Payment');
const Config = require('./Config');
const MessageLog = require('./MessageLog');
const AutomationLog = require('./AutomationLog');
const MessageTemplate = require('./MessageTemplate');
const WebhookLog = require('./WebhookLog');
const TraccarIntegration = require('./TraccarIntegration');

// Define associations
Client.hasMany(Payment, { foreignKey: 'client_id', as: 'payments' });
Payment.belongsTo(Client, { foreignKey: 'client_id', as: 'client' });

Client.hasMany(MessageLog, { foreignKey: 'client_id', as: 'messages' });
MessageLog.belongsTo(Client, { foreignKey: 'client_id', as: 'client' });

Payment.hasMany(MessageLog, { foreignKey: 'payment_id', as: 'messages' });
MessageLog.belongsTo(Payment, { foreignKey: 'payment_id', as: 'payment' });

User.hasMany(MessageLog, { foreignKey: 'user_id', as: 'sentMessages' });
MessageLog.belongsTo(User, { foreignKey: 'user_id', as: 'sentBy' });

User.hasMany(AutomationLog, { foreignKey: 'user_id', as: 'automationLogs' });
AutomationLog.belongsTo(User, { foreignKey: 'user_id', as: 'triggeredBy' });

Client.hasMany(WebhookLog, { foreignKey: 'client_id', as: 'webhookLogs' });
WebhookLog.belongsTo(Client, { foreignKey: 'client_id', as: 'client' });

Payment.hasMany(WebhookLog, { foreignKey: 'payment_id', as: 'webhookLogs' });
WebhookLog.belongsTo(Payment, { foreignKey: 'payment_id', as: 'payment' });

// TraccarIntegration associations
Client.hasOne(TraccarIntegration, { foreignKey: 'client_id', as: 'TraccarIntegration' });
TraccarIntegration.belongsTo(Client, { foreignKey: 'client_id', as: 'client' });

module.exports = {
  sequelize,
  User,
  Client,
  Payment,
  Config,
  MessageLog,
  AutomationLog,
  MessageTemplate,
  WebhookLog,
  TraccarIntegration
};