const { User } = require('../models');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');

async function updateAdminCredentials() {
  try {
    console.log('🔄 Conectando ao banco de dados...');
    await sequelize.authenticate();
    
    console.log('🔍 Procurando usuário admin...');
    const adminUser = await User.findOne({
      where: { email: 'admin@noty.com' }
    });

    if (!adminUser) {
      console.log('❌ Usuário admin não encontrado!');
      return;
    }

    console.log('🔧 Atualizando credenciais do admin...');
    
    // Hash da nova senha
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash('admin123', saltRounds);

    // Atualizar email e senha
    await adminUser.update({
      email: 'admin@admin.com',
      password: hashedPassword
    });

    console.log('✅ Credenciais atualizadas com sucesso!');
    console.log('📧 Novo email: admin@admin.com');
    console.log('🔑 Nova senha: admin123');
    console.log('');
    console.log('🎯 Agora você pode fazer login com:');
    console.log('   Email: admin@admin.com');
    console.log('   Senha: admin123');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erro ao atualizar credenciais:', error);
    process.exit(1);
  }
}

// Executar se este arquivo for chamado diretamente
if (require.main === module) {
  updateAdminCredentials();
}

module.exports = { updateAdminCredentials };