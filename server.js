const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { sequelize } = require('./config/database');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const clientsRoutes = require('./routes/clients');
const paymentsRoutes = require('./routes/payments');
const configRoutes = require('./routes/config');
const automationRoutes = require('./routes/automation');
const templatesRoutes = require('./routes/templates');
const webhooksRoutes = require('./routes/webhooks');
const traccarRoutes = require('./routes/traccar');
const paymentStatusRoutes = require('./routes/payment-status');

const logger = require('./utils/logger');
const SchedulerService = require('./services/SchedulerService');
const EvolutionService = require('./services/EvolutionService');
const TraccarService = require('./services/TraccarService');
const TraccarNotificationService = require('./services/TraccarNotificationService');
const { initializeDatabase } = require('./scripts/init-database');

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting (disabled for development)
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per windowMs
//   message: 'Muitas tentativas de acesso. Tente novamente em 15 minutos.'
// });
// app.use('/api', limiter);

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/config', configRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/traccar', traccarRoutes);
app.use('/api/payment-status', paymentStatusRoutes);

// Serve static files from React build
if (process.env.NODE_ENV === 'production' || true) {
  app.use(express.static(path.join(__dirname, 'client/build')));
  
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, 'client/build/index.html'));
    }
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Erro interno do servidor'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada'
  });
});

const PORT = process.env.PORT || 5000;

// Database connection and server start
async function startServer() {
  try {
    // Connect to database
    await sequelize.authenticate();
    logger.info('Conexão com banco de dados estabelecida com sucesso');
    
    // Sync database
    await sequelize.sync();
    logger.info('Modelos sincronizados com o banco de dados');
    
    // Initialize database with default data if needed
    try {
      await initializeDatabase();
    } catch (error) {
      logger.warn('Database initialization skipped (already initialized)');
    }
    
    // Initialize Evolution API
    try {
      await EvolutionService.initialize();
      logger.info('Evolution API inicializada com sucesso');
    } catch (error) {
      logger.warn('Evolution API initialization failed:', error.message);
      logger.warn('Mensagens poderão falhar até a configuração ser ajustada');
    }
    
    // Initialize Traccar Service
    try {
      await TraccarService.initialize();
      logger.info('TraccarService inicializado com sucesso');
    } catch (error) {
      logger.warn('TraccarService initialization failed:', error.message);
      logger.warn('Integração Traccar poderá falhar até a configuração ser ajustada');
    }
    
    // Initialize Traccar Notification Service
    try {
      await TraccarNotificationService.initialize();
      logger.info('TraccarNotificationService inicializado com sucesso');
    } catch (error) {
      logger.warn('TraccarNotificationService initialization failed:', error.message);
      logger.warn('Notificações Traccar poderão falhar até a configuração ser ajustada');
    }
    
    // Initialize scheduler
    await SchedulerService.initialize();
    logger.info('Serviço de agendamento inicializado');
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`Servidor NOTY rodando na porta ${PORT}`);
      console.log(`🚀 NOTY Server running on port ${PORT}`);
      console.log(`📊 Dashboard: http://localhost:${PORT}`);
      console.log(`🔧 API: http://localhost:${PORT}/api`);
    });
    
  } catch (error) {
    logger.error('Erro ao inicializar servidor:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  SchedulerService.stopAllJobs();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  SchedulerService.stopAllJobs();
  process.exit(0);
});

startServer();

module.exports = app;