const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { sequelize, Config, Client, Payment, TraccarIntegration } = require('../models');
const TraccarAutomationService = require('../services/TraccarAutomationService');
const AutomationService = require('../services/AutomationService');
const logger = require('../utils/logger');

async function debug() {
    try {
        console.log('🔍 Iniciando diagnóstico...');

        // 1. Verificar Configurações
        console.log('\n1. Verificando Configurações:');
        const configs = await Config.findAll({
            where: {
                key: ['traccar_enabled', 'auto_block_enabled', 'traccar_url', 'traccar_token', 'block_after_count']
            }
        });

        configs.forEach(c => console.log(`   - ${c.key}: ${c.value}`));

        // 2. Verificar Cliente Jorge
        console.log('\n2. Verificando Cliente (Jorge):');
        const client = await Client.findOne({
            where: { name: { [require('sequelize').Op.like]: '%Jorge%' } },
            include: [
                { model: Payment, as: 'payments', where: { status: 'OVERDUE' }, required: false },
                { model: TraccarIntegration, as: 'TraccarIntegration' }
            ]
        });

        if (!client) {
            console.log('   ❌ Cliente Jorge não encontrado!');
        } else {
            console.log(`   - ID: ${client.id}`);
            console.log(`   - Nome: ${client.name}`);
            console.log(`   - Email: ${client.email}`);
            console.log(`   - Telefone: ${client.mobile_phone || client.phone}`);
            console.log(`   - Pagamentos Vencidos: ${client.payments.length}`);

            if (client.TraccarIntegration) {
                console.log(`   - Integração Traccar:`);
                console.log(`     - Traccar User ID: ${client.TraccarIntegration.traccar_user_id}`);
                console.log(`     - Bloqueado: ${client.TraccarIntegration.is_blocked}`);
                console.log(`     - Auto Block Enabled: ${client.TraccarIntegration.auto_block_enabled}`);
            } else {
                console.log('   ❌ Sem integração Traccar vinculada!');
            }
        }

        // 3. Simular Execução da Automação
        console.log('\n3. Executando Automação Traccar (Simulação):');

        // Forçar logs para o console
        const originalInfo = logger.info;
        const originalWarn = logger.warn;
        const originalError = logger.error;

        logger.info = (msg, ...args) => console.log(`   [INFO] ${msg}`, ...args);
        logger.warn = (msg, ...args) => console.log(`   [WARN] ${msg}`, ...args);
        logger.error = (msg, ...args) => console.log(`   [ERROR] ${msg}`, ...args);

        await TraccarAutomationService.runAutomation();

        // 4. Simular Notificações de Vencidos
        console.log('\n4. Executando Notificações de Vencidos (Simulação):');
        await AutomationService.sendOverdueNotifications();

        // Restaurar logs
        logger.info = originalInfo;
        logger.warn = originalWarn;
        logger.error = originalError;

    } catch (error) {
        console.error('❌ Erro fatal no diagnóstico:', error);
    } finally {
        process.exit();
    }
}

debug();
