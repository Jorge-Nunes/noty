#!/bin/bash

# Health Check Script - Verifica se todos os serviços estão funcionando
# Pode ser usado para monitoramento automático

echo "🏥 NOTY System Health Check"
echo "=========================="
echo "Horário: $(date)"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para mostrar status
show_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

# Função para mostrar warning
show_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Contadores para relatório final
checks_total=0
checks_passed=0

# 1. Verificar PM2
echo "🔍 Verificando PM2..."
checks_total=$((checks_total + 1))
if pm2 list | grep -q "noty-backend" && pm2 list | grep -q "online"; then
    show_status 0 "PM2 - Aplicação rodando"
    checks_passed=$((checks_passed + 1))
else
    show_status 1 "PM2 - Aplicação não está rodando"
    echo "   Comando para corrigir: pm2 start ecosystem.config.js"
fi

# 2. Verificar Nginx
echo ""
echo "🔍 Verificando Nginx..."
checks_total=$((checks_total + 1))
if systemctl is-active --quiet nginx; then
    show_status 0 "Nginx - Serviço ativo"
    checks_passed=$((checks_passed + 1))
else
    show_status 1 "Nginx - Serviço inativo"
    echo "   Comando para corrigir: sudo systemctl start nginx"
fi

# 3. Verificar PostgreSQL
echo ""
echo "🔍 Verificando PostgreSQL..."
checks_total=$((checks_total + 1))
if systemctl is-active --quiet postgresql; then
    show_status 0 "PostgreSQL - Serviço ativo"
    checks_passed=$((checks_passed + 1))
else
    show_status 1 "PostgreSQL - Serviço inativo"
    echo "   Comando para corrigir: sudo systemctl start postgresql"
fi

# 4. Verificar conectividade da API
echo ""
echo "🔍 Verificando API..."
checks_total=$((checks_total + 1))
if curl -f -s http://localhost:5000/api/auth/health > /dev/null; then
    show_status 0 "API - Respondendo na porta 5000"
    checks_passed=$((checks_passed + 1))
else
    show_status 1 "API - Não está respondendo"
    echo "   Verifique os logs: pm2 logs noty-backend"
fi

# 5. Verificar conectividade com banco
echo ""
echo "🔍 Verificando banco de dados..."
checks_total=$((checks_total + 1))
if PGPASSWORD=senha_do_banco psql -h localhost -U noty_user -d noty_production -c "SELECT 1;" > /dev/null 2>&1; then
    show_status 0 "Banco - Conectividade OK"
    checks_passed=$((checks_passed + 1))
else
    show_status 1 "Banco - Problemas de conectividade"
    echo "   Verifique credenciais e permissões"
fi

# 6. Verificar certificado SSL (se aplicável)
echo ""
echo "🔍 Verificando SSL..."
if [ -f "/etc/letsencrypt/live/seu-dominio.com/fullchain.pem" ]; then
    checks_total=$((checks_total + 1))
    
    # Verificar expiração do certificado
    expiry_date=$(openssl x509 -enddate -noout -in /etc/letsencrypt/live/seu-dominio.com/fullchain.pem | cut -d= -f2)
    expiry_timestamp=$(date -d "$expiry_date" +%s)
    current_timestamp=$(date +%s)
    days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
    
    if [ $days_until_expiry -gt 7 ]; then
        show_status 0 "SSL - Certificado válido por mais $days_until_expiry dias"
        checks_passed=$((checks_passed + 1))
    elif [ $days_until_expiry -gt 0 ]; then
        show_warning "SSL - Certificado expira em $days_until_expiry dias (renovar em breve)"
        checks_passed=$((checks_passed + 1))
    else
        show_status 1 "SSL - Certificado expirado!"
        echo "   Comando para renovar: sudo certbot renew"
    fi
else
    show_warning "SSL - Certificado não encontrado ou não configurado"
fi

# 7. Verificar espaço em disco
echo ""
echo "🔍 Verificando espaço em disco..."
disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $disk_usage -lt 80 ]; then
    show_status 0 "Disco - ${disk_usage}% utilizado"
else
    show_warning "Disco - ${disk_usage}% utilizado (próximo do limite)"
fi

# 8. Verificar memória
echo ""
echo "🔍 Verificando memória..."
memory_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
if [ $memory_usage -lt 85 ]; then
    show_status 0 "Memória - ${memory_usage}% utilizada"
else
    show_warning "Memória - ${memory_usage}% utilizada (alta utilização)"
fi

# 9. Verificar logs de erro recentes
echo ""
echo "🔍 Verificando logs de erro..."
if pm2 logs noty-backend --lines 50 --nostream | grep -i "error" > /dev/null 2>&1; then
    show_warning "Logs - Erros encontrados nos logs recentes"
    echo "   Execute: pm2 logs noty-backend | grep -i error"
else
    show_status 0 "Logs - Nenhum erro recente encontrado"
fi

# 10. Verificar se o frontend está sendo servido
echo ""
echo "🔍 Verificando frontend..."
checks_total=$((checks_total + 1))
if [ -f "/var/www/noty/client/build/index.html" ]; then
    show_status 0 "Frontend - Build presente"
    checks_passed=$((checks_passed + 1))
else
    show_status 1 "Frontend - Build não encontrado"
    echo "   Execute: cd client && npm run build"
fi

# Relatório final
echo ""
echo "📊 RELATÓRIO FINAL"
echo "=================="
echo "Total de verificações: $checks_total"
echo "Verificações aprovadas: $checks_passed"
echo "Taxa de sucesso: $(( checks_passed * 100 / checks_total ))%"

if [ $checks_passed -eq $checks_total ]; then
    echo -e "${GREEN}"
    echo "🎉 SISTEMA SAUDÁVEL - Todos os checks passaram!"
    echo -e "${NC}"
    exit 0
elif [ $checks_passed -gt $(( checks_total * 2 / 3 )) ]; then
    echo -e "${YELLOW}"
    echo "⚠️  SISTEMA FUNCIONAL - Alguns warnings encontrados"
    echo -e "${NC}"
    exit 1
else
    echo -e "${RED}"
    echo "🚨 SISTEMA COM PROBLEMAS - Atenção necessária"
    echo -e "${NC}"
    exit 2
fi