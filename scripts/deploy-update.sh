#!/bin/bash

# Script de Deploy/Atualização para Produção
# Executa backup, atualiza código, rebuilda frontend e reinicia serviços

set -e  # Exit on any error

APP_DIR="/var/www/noty"
BACKUP_DIR="/var/backups/noty"
DATE=$(date +%Y%m%d_%H%M%S)

echo "🚀 Iniciando deploy/atualização..."
echo "Horário: $(date)"
echo "Diretório: $APP_DIR"
echo "========================================="

# Verificar se estamos no diretório correto
if [ ! -f "$APP_DIR/package.json" ]; then
    echo "❌ Erro: Não foi possível encontrar package.json em $APP_DIR"
    echo "Verifique se o diretório da aplicação está correto."
    exit 1
fi

cd $APP_DIR

echo "📦 Verificando dependências..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale Node.js primeiro."
    exit 1
fi

if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 não encontrado. Instale PM2: npm install -g pm2"
    exit 1
fi

echo "💾 Realizando backup antes da atualização..."
mkdir -p $BACKUP_DIR

# Backup do banco de dados
if command -v pg_dump &> /dev/null; then
    echo "📊 Backup do banco de dados..."
    pg_dump -h localhost -U noty_user noty_production > $BACKUP_DIR/noty_backup_$DATE.sql
    echo "✅ Backup do banco salvo em: $BACKUP_DIR/noty_backup_$DATE.sql"
else
    echo "⚠️  pg_dump não encontrado. Pulando backup do banco."
fi

# Backup dos arquivos de configuração
echo "📁 Backup dos arquivos de configuração..."
cp .env $BACKUP_DIR/env_backup_$DATE || echo "⚠️  Arquivo .env não encontrado"
tar -czf $BACKUP_DIR/noty_config_$DATE.tar.gz .env ecosystem.config.js --ignore-failed-read

echo "🔄 Atualizando código fonte..."
git fetch origin
git pull origin main

echo "📦 Instalando dependências do backend..."
npm install --production

echo "🔨 Compilando frontend..."
cd client

# Instalar dependências do frontend
echo "📦 Instalando dependências do frontend..."
npm install

# Build para produção
echo "🏗️  Buildando frontend para produção..."
npm run build

if [ ! -d "build" ]; then
    echo "❌ Erro: Diretório build não foi criado!"
    exit 1
fi

echo "✅ Frontend buildado com sucesso"

# Voltar para raiz
cd ..

echo "🗄️  Verificando e atualizando banco de dados..."
node scripts/init-database.js

echo "🔄 Reiniciando aplicação..."
if pm2 list | grep -q "noty-backend"; then
    echo "♻️  Reiniciando PM2..."
    pm2 restart noty-backend
    pm2 save
else
    echo "🚀 Iniciando aplicação pela primeira vez..."
    pm2 start ecosystem.config.js
    pm2 save
fi

echo "🧹 Limpando backups antigos (mantendo últimos 7)..."
find $BACKUP_DIR -name "noty_*" -type f -mtime +7 -delete

echo "🔍 Verificando status dos serviços..."
echo ""
echo "📊 Status PM2:"
pm2 status

echo ""
echo "🌐 Status Nginx:"
sudo systemctl status nginx --no-pager -l

echo ""
echo "🗄️  Status PostgreSQL:"
sudo systemctl status postgresql --no-pager -l

echo ""
echo "✅ Deploy concluído com sucesso!"
echo "🕐 Finalizado em: $(date)"
echo "📋 Backup salvo em: $BACKUP_DIR"
echo ""
echo "🔗 Aplicação disponível em: https://seu-dominio.com"
echo ""
echo "📝 Próximos passos:"
echo "1. Teste a aplicação no navegador"
echo "2. Verifique os logs: pm2 logs noty-backend"
echo "3. Monitore por alguns minutos: pm2 monit"

# Teste básico de conectividade
echo ""
echo "🧪 Testando conectividade básica..."
sleep 5

if curl -f http://localhost:5000/api/auth/health > /dev/null 2>&1; then
    echo "✅ API respondendo corretamente"
else
    echo "⚠️  API não está respondendo. Verifique os logs:"
    echo "   pm2 logs noty-backend"
fi