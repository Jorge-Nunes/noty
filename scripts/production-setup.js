/**
 * Production Setup Script
 * Executa todos os passos necessários para configurar o ambiente de produção
 */

const { initializeDatabase } = require('./init-database');
const { verifyDatabase } = require('./verify-database');

async function productionSetup() {
  try {
    console.log('🚀 Iniciando configuração de produção...');
    console.log('==========================================\n');
    
    // Step 1: Initialize database
    console.log('ETAPA 1: Inicialização do banco de dados');
    console.log('------------------------------------------');
    await initializeDatabase();
    
    console.log('\n');
    
    // Step 2: Verify database
    console.log('ETAPA 2: Verificação da estrutura do banco');
    console.log('-------------------------------------------');
    await verifyDatabase();
    
    console.log('\n');
    console.log('🎉 CONFIGURAÇÃO DE PRODUÇÃO CONCLUÍDA!');
    console.log('=====================================\n');
    
    console.log('📋 Próximos passos manuais:');
    console.log('1. Configure as variáveis de ambiente (.env)');
    console.log('2. Configure o Nginx como proxy reverso');
    console.log('3. Configure SSL com Let\'s Encrypt');
    console.log('4. Inicie a aplicação com PM2');
    console.log('5. Acesse o sistema e configure as APIs');
    console.log('\n📖 Consulte DEPLOY_PRODUCTION.md para instruções detalhadas');
    
  } catch (error) {
    console.error('\n❌ Erro na configuração de produção:', error);
    console.log('\n🔧 Soluções possíveis:');
    console.log('1. Verifique se o PostgreSQL está rodando');
    console.log('2. Verifique as credenciais do banco de dados');
    console.log('3. Verifique se o usuário tem permissões no banco');
    console.log('4. Execute: sudo systemctl status postgresql');
    
    throw error;
  }
}

// Execute if this file is run directly
if (require.main === module) {
  productionSetup()
    .then(() => {
      console.log('\n✅ Setup de produção finalizado com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Falha no setup de produção:', error.message);
      process.exit(1);
    });
}

module.exports = { productionSetup };