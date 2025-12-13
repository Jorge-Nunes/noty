# 🚀 Guia Completo de Deploy em Produção - NOTY Sistema

## 📋 **Pré-requisitos**

### **Servidor/VPS:**
- Ubuntu 20.04+ ou CentOS 7+
- Mínimo 2GB RAM, 20GB SSD
- Node.js 18+ e npm
- PostgreSQL 13+
- Nginx (proxy reverso)
- PM2 (gerenciamento de processos)
- Git

### **Domínio e SSL:**
- Domínio configurado apontando para o servidor
- Certificado SSL (Let's Encrypt recomendado)

---

## 🌐 **ETAPA 0: Configuração de Domínio e DNS**

### **0.1 Registrar Domínio**
- Registre um domínio (ex: `seudominio.com`) em qualquer registrador
- Ou configure um subdomínio em domínio existente

### **0.2 Configurar DNS**
Configure os seguintes registros DNS:

```
# Tipo A - Aponta para o IP do seu servidor
@                  A       IP_DO_SERVIDOR
www               A       IP_DO_SERVIDOR

# Ou usando CNAME para subdomínio
noty              A       IP_DO_SERVIDOR
```

### **0.3 Verificar Propagação**
```bash
# Verificar se DNS está propagado
nslookup seu-dominio.com
dig seu-dominio.com

# Aguardar propagação (pode levar até 24h)
```

---

## 🔧 **ETAPA 1: Preparação do Servidor**

### **1.1 Atualização do Sistema**
```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y

# CentOS/RHEL
sudo yum update -y
```

### **1.2 Instalação do Node.js**
```bash
# Instalar Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalação
node --version
npm --version
```

### **1.3 Instalação do PostgreSQL**
```bash
# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib -y

# Iniciar e habilitar PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Configurar usuário postgres
sudo -u postgres psql
```

```sql
-- Dentro do PostgreSQL
CREATE DATABASE noty_production;
CREATE USER noty_user WITH PASSWORD 'SUA_SENHA_SEGURA_AQUI';
GRANT ALL PRIVILEGES ON DATABASE noty_production TO noty_user;
ALTER USER noty_user CREATEDB;
\q
```

### **1.4 Instalação do Nginx**
```bash
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

### **1.5 Instalação do PM2**
```bash
sudo npm install -g pm2
```

---

## 📦 **ETAPA 2: Deploy da Aplicação**

### **2.1 Clone do Repositório**
```bash
# Navegar para diretório de aplicações
cd /var/www

# Clonar repositório (substitua pela URL do seu repo)
sudo git clone https://github.com/SEU_USUARIO/noty-system.git
sudo mv noty-system noty
sudo chown -R $USER:$USER /var/www/noty

# Entrar no diretório
cd /var/www/noty
```

### **2.2 Configuração das Variáveis de Ambiente**
```bash
# Copiar arquivo de exemplo
cp .env.example .env

# Editar variáveis de produção
nano .env
```

**Arquivo `.env` de Produção:**
```env
# Ambiente
NODE_ENV=production
PORT=5000

# Banco de Dados PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=noty_production
DB_USER=noty_user
DB_PASSWORD=SUA_SENHA_SEGURA_AQUI
DB_DIALECT=postgres

# JWT
JWT_SECRET=SUA_CHAVE_JWT_MUITO_SEGURA_256_BITS_AQUI

# APIs Externas
ASAAS_API_URL=https://www.asaas.com/api/v3
ASAAS_ACCESS_TOKEN=SEU_TOKEN_ASAAS_PRODUCAO
ASAAS_WEBHOOK_SECRET=SEU_SECRET_WEBHOOK_ASAAS

EVOLUTION_API_URL=https://seu-evolution-api.com
EVOLUTION_API_KEY=SUA_CHAVE_EVOLUTION
EVOLUTION_INSTANCE=SUA_INSTANCIA

# Empresa
COMPANY_NAME=TEKSAT Rastreamento Veicular

# Logs
LOG_LEVEL=info
LOG_FILE_PATH=/var/www/noty/logs

# Frontend (para build)
REACT_APP_API_URL=https://seu-dominio.com/api
```

### **2.3 Instalação das Dependências Backend**
```bash
# Instalar dependências do backend
npm install --production

# Instalar dependências de desenvolvimento (para build)
npm install
```

### **2.4 Instalação e Build do Frontend**
```bash
# Entrar no diretório do cliente
cd client

# Instalar dependências
npm install

# Build para produção
npm run build

# Voltar para raiz
cd ..
```

---

## 🗄️ **ETAPA 3: Configuração do Banco de Dados**

### **3.1 Executar Script de Configuração Completa**
```bash
# Executar script completo de produção (recomendado)
node scripts/production-setup.js
```

**OU executar manualmente:**

```bash
# 1. Inicialização do banco
node scripts/init-database.js

# 2. Verificação da estrutura
node scripts/verify-database.js
```

### **3.2 Verificar Estrutura do Banco**
```bash
# Script automatizado de verificação
node scripts/verify-database.js
```

**Verificação manual (se necessário):**
```bash
# Conectar ao banco
psql -h localhost -U noty_user -d noty_production

# Listar todas as tabelas
\dt

# Verificar se TODAS as tabelas foram criadas:
# ✅ users - Usuários do sistema
# ✅ clients - Clientes/empresas  
# ✅ payments - Pagamentos/cobranças
# ✅ configs - Configurações do sistema
# ✅ message_logs - Log de mensagens enviadas
# ✅ automation_logs - Log de automações executadas
# ✅ message_templates - Templates de mensagens
# ✅ webhook_logs - Log de webhooks recebidos

# Verificar dados iniciais
SELECT COUNT(*) FROM users; -- Deve ter pelo menos 1 (admin)
SELECT COUNT(*) FROM configs; -- Deve ter cerca de 10 configurações
SELECT COUNT(*) FROM message_templates; -- Deve ter 5 templates

\q
```

### **3.3 Resolução de Problemas do Banco**
```bash
# Se alguma tabela estiver ausente:
node scripts/init-database.js

# Se houver erro de permissão:
sudo -u postgres psql
```

```sql
-- Dentro do PostgreSQL, conceder todas as permissões:
GRANT ALL PRIVILEGES ON DATABASE noty_production TO noty_user;
GRANT ALL ON SCHEMA public TO noty_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO noty_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO noty_user;
\q
```

---

## 🌐 **ETAPA 4: Configuração do Nginx**

### **4.1 Configuração do Virtual Host**
```bash
# Criar arquivo de configuração
sudo nano /etc/nginx/sites-available/noty
```

**Arquivo `/etc/nginx/sites-available/noty`:**
```nginx
server {
    listen 80;
    server_name seu-dominio.com www.seu-dominio.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name seu-dominio.com www.seu-dominio.com;
    
    # SSL Configuration (será configurado com certbot)
    ssl_certificate /etc/letsencrypt/live/seu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seu-dominio.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Logs
    access_log /var/log/nginx/noty_access.log;
    error_log /var/log/nginx/noty_error.log;
    
    # Frontend estático
    location / {
        root /var/www/noty/client/build;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }
    
    # API Backend
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Arquivos estáticos com cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /var/www/noty/client/build;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
```

### **4.2 Ativar Configuração**
```bash
# Criar link simbólico
sudo ln -s /etc/nginx/sites-available/noty /etc/nginx/sites-enabled/

# Remover configuração padrão
sudo rm /etc/nginx/sites-enabled/default

# Testar configuração
sudo nginx -t

# Recarregar nginx
sudo systemctl reload nginx
```

---

## 🔒 **ETAPA 5: Configuração SSL (Let's Encrypt)**

### **5.1 Instalação do Certbot**
```bash
sudo apt install snapd
sudo snap install core; sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
```

### **5.2 Obter Certificado SSL**
```bash
# Obter certificado (substitua pelo seu domínio)
sudo certbot --nginx -d seu-dominio.com -d www.seu-dominio.com

# Configurar renovação automática
sudo crontab -e
```

**Adicionar linha no crontab:**
```bash
0 12 * * * /usr/bin/certbot renew --quiet
```

---

## 🚦 **ETAPA 6: Configuração do PM2**

### **6.1 Arquivo de Configuração PM2**
```bash
# Criar arquivo de configuração
nano ecosystem.config.js
```

**Arquivo `ecosystem.config.js`:**
```javascript
module.exports = {
  apps: [{
    name: 'noty-backend',
    script: 'server.js',
    cwd: '/var/www/noty',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: '/var/www/noty/logs/pm2-error.log',
    out_file: '/var/www/noty/logs/pm2-out.log',
    log_file: '/var/www/noty/logs/pm2-combined.log',
    time: true,
    watch: false,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

### **6.2 Iniciar Aplicação com PM2**
```bash
# Criar diretório de logs
mkdir -p /var/www/noty/logs

# Iniciar aplicação
pm2 start ecosystem.config.js

# Salvar configuração do PM2
pm2 save

# Configurar PM2 para iniciar automaticamente
pm2 startup

# Verificar status
pm2 status
pm2 logs noty-backend
```

---

## 🔧 **ETAPA 7: Configurações Finais**

### **7.1 Configuração de Firewall**
```bash
# Ubuntu UFW - Configuração básica
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'

# Permitir apenas IPs específicos para SSH (recomendado)
# sudo ufw delete allow OpenSSH
# sudo ufw allow from SEU_IP_FIXO to any port 22

# Ativar firewall
sudo ufw --force enable

# Verificar status
sudo ufw status verbose
```

### **7.1.1 Configuração Avançada de Segurança**
```bash
# Fail2ban para proteção contra ataques de força bruta
sudo apt install fail2ban -y

# Configurar fail2ban
sudo nano /etc/fail2ban/jail.local
```

**Arquivo `/etc/fail2ban/jail.local`:**
```ini
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
ignoreip = 127.0.0.1/8 ::1

[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
```

```bash
# Iniciar fail2ban
sudo systemctl start fail2ban
sudo systemctl enable fail2ban
sudo fail2ban-client status
```

### **7.2 Otimizações do Sistema**
```bash
# Aumentar limites de arquivo
echo "* soft nofile 65535" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65535" | sudo tee -a /etc/security/limits.conf

# Configurar PostgreSQL para produção
sudo nano /etc/postgresql/13/main/postgresql.conf
```

**Otimizações PostgreSQL:**
```conf
# postgresql.conf
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
```

```bash
sudo systemctl restart postgresql
```

---

## 🏃 **ETAPA 8: Execução e Testes**

### **8.1 Verificar Serviços**
```bash
# Status dos serviços
sudo systemctl status nginx
sudo systemctl status postgresql
pm2 status

# Logs em tempo real
pm2 logs noty-backend --lines 50
```

### **8.2 Testes da Aplicação**
```bash
# Teste da API
curl https://seu-dominio.com/api/auth/health

# Teste do frontend
curl -I https://seu-dominio.com

# Teste de conectividade do banco
psql -h localhost -U noty_user -d noty_production -c "SELECT NOW();"
```

### **8.3 Acesso Inicial**
1. **Acesse**: https://seu-dominio.com
2. **Login inicial**: 
   - Email: `admin@noty.com`
   - Senha: `admin123`
3. **Primeira configuração**:
   - Altere senha do administrador
   - Configure APIs do Asaas e Evolution
   - Execute sincronização inicial

---

## 📊 **ETAPA 9: Monitoramento**

### **9.1 Scripts de Monitoramento**
```bash
# Criar script de backup
nano /var/www/noty/scripts/backup.sh
```

**Script de Backup:**
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/noty"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="noty_production"
DB_USER="noty_user"

mkdir -p $BACKUP_DIR

# Backup do banco de dados
pg_dump -h localhost -U $DB_USER $DB_NAME > $BACKUP_DIR/noty_backup_$DATE.sql

# Backup dos arquivos
tar -czf $BACKUP_DIR/noty_files_$DATE.tar.gz /var/www/noty --exclude=node_modules --exclude=.git

# Manter apenas últimos 7 backups
find $BACKUP_DIR -name "noty_*" -type f -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
# Tornar executável
chmod +x /var/www/noty/scripts/backup.sh

# Configurar cron para backup diário
sudo crontab -e
```

**Cron para backup:**
```bash
0 2 * * * /var/www/noty/scripts/backup.sh >> /var/log/noty-backup.log 2>&1
```

### **9.2 Monitoramento PM2**
```bash
# Instalar PM2 web monitor (opcional)
pm2 install pm2-server-monit
```

---

## 🔄 **ETAPA 10: Atualizações e Manutenção**

### **10.1 Scripts de Deploy e Manutenção**

#### **Script de Deploy/Atualização Automatizado:**
```bash
# Os scripts já estão incluídos no projeto
chmod +x /var/www/noty/scripts/deploy-update.sh
chmod +x /var/www/noty/scripts/health-check.sh

# Executar deploy/atualização
./scripts/deploy-update.sh

# Verificar saúde do sistema
./scripts/health-check.sh
```

#### **Configurar Atualizações Automáticas (opcional):**
```bash
# Editar crontab para deploy automático às 2h da madrugada
sudo crontab -e
```

```bash
# Deploy automático diário (opcional - apenas se tiver CI/CD)
0 2 * * * cd /var/www/noty && ./scripts/deploy-update.sh >> /var/log/noty-deploy.log 2>&1

# Health check a cada hora
0 * * * * cd /var/www/noty && ./scripts/health-check.sh >> /var/log/noty-health.log 2>&1
```

### **10.2 Logs e Troubleshooting**
```bash
# Logs da aplicação
pm2 logs noty-backend

# Logs do Nginx
sudo tail -f /var/log/nginx/noty_error.log

# Logs do PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-13-main.log

# Status geral do sistema
htop
df -h
free -h
```

---

## ⚠️ **CHECKLIST FINAL DE PRODUÇÃO**

### **✅ Segurança:**
- [ ] Senha forte do banco de dados
- [ ] JWT_SECRET com 256 bits
- [ ] Firewall configurado
- [ ] SSL ativo e funcionando
- [ ] Headers de segurança configurados
- [ ] Backup automático funcionando

### **✅ Performance:**
- [ ] PM2 rodando em cluster
- [ ] Nginx servindo arquivos estáticos
- [ ] PostgreSQL otimizado
- [ ] Cache configurado
- [ ] Compressão gzip ativa

### **✅ Monitoramento:**
- [ ] PM2 status ok
- [ ] Logs sendo gerados
- [ ] Backup diário configurado
- [ ] Monitoramento de recursos
- [ ] Script de deploy criado

### **✅ Funcionalidades:**
- [ ] Login funcionando
- [ ] APIs do Asaas configuradas
- [ ] Evolution API configurada
- [ ] Webhook recebendo eventos
- [ ] Templates de mensagem ativos
- [ ] Sincronização funcionando

---

## 🆘 **Resolução de Problemas Comuns**

### **Problema: Erro de conexão com banco**
```bash
# Verificar status PostgreSQL
sudo systemctl status postgresql

# Verificar logs
sudo tail -f /var/log/postgresql/postgresql-13-main.log

# Testar conexão manual
psql -h localhost -U noty_user -d noty_production
```

### **Problema: API não responde**
```bash
# Verificar PM2
pm2 status
pm2 logs noty-backend

# Verificar porta
sudo netstat -tulpn | grep :5000
```

### **Problema: Frontend não carrega**
```bash
# Verificar Nginx
sudo systemctl status nginx
sudo nginx -t

# Verificar arquivos build
ls -la /var/www/noty/client/build/
```

### **Problema: SSL não funciona**
```bash
# Verificar certificado
sudo certbot certificates

# Renovar manualmente
sudo certbot renew --dry-run
```

---

## 🎉 **Deploy Concluído!**

Sua aplicação NOTY está agora rodando em produção com:

- ✅ **Alta disponibilidade** com PM2 cluster
- ✅ **Segurança** com SSL e firewall
- ✅ **Performance** otimizada com Nginx
- ✅ **Backup** automático configurado
- ✅ **Monitoramento** ativo
- ✅ **Manutenção** facilitada

**🚀 Sistema pronto para uso em produção!**

---

## 📋 **RESUMO EXECUTIVO**

### **📁 Arquivos Importantes Criados:**
- **`DEPLOY_PRODUCTION.md`** - Documentação completa (este arquivo)
- **`RESUMO_EXECUTIVO_DEPLOY.md`** - Guia rápido para administradores
- **`scripts/production-setup.js`** - Setup automatizado completo
- **`scripts/init-database.js`** - Inicialização com todas as tabelas
- **`scripts/verify-database.js`** - Verificação da estrutura
- **`scripts/deploy-update.sh`** - Deploy/atualização automatizada
- **`scripts/health-check.sh`** - Monitoramento de saúde

### **⏱️ Tempo Estimado de Deploy:**
- **Deploy Básico**: 30-45 minutos
- **Deploy Completo**: 60-90 minutos
- **Configuração SSL**: 15-30 minutos
- **Testes e Ajustes**: 30-60 minutos

### **🎯 Resultado Final:**
Um sistema de produção completo com:
- ✅ **8 Tabelas** no banco de dados
- ✅ **Alta disponibilidade** com PM2 cluster  
- ✅ **Segurança avançada** com SSL + Firewall
- ✅ **Backup automatizado** diário
- ✅ **Monitoramento ativo** com health checks
- ✅ **Scripts de manutenção** automatizados

---

## 🆘 **Suporte Rápido**

### **Em caso de problemas:**
1. **Execute**: `./scripts/health-check.sh`
2. **Verifique logs**: `pm2 logs noty-backend`
3. **Status serviços**: `sudo systemctl status nginx postgresql`
4. **Teste conectividade**: `curl http://localhost:5000/api/auth/health`

### **Comandos de Emergência:**
```bash
# Restart completo
pm2 restart noty-backend
sudo systemctl restart nginx postgresql

# Backup antes de mudanças
./scripts/backup.sh

# Verificar saúde do sistema
./scripts/health-check.sh
```

### **Contatos de Suporte:**
- 📖 **Documentação**: Consulte este arquivo completo
- 🔧 **Troubleshooting**: Seção "Resolução de Problemas Comuns"
- 📊 **Monitoramento**: Use scripts de health check
- 💾 **Backup**: Backups automáticos em `/var/backups/noty/`

---

## 🎊 **Parabéns!**

Se você chegou até aqui, seu sistema NOTY está agora executando em produção com:
- **Sistema robusto** e preparado para escala
- **Segurança de nível empresarial**
- **Backup e monitoramento automatizados**
- **Manutenção facilitada** com scripts automatizados

**🚀 NOTY System: Pronto para transformar seu negócio!**

---

**📞 Em caso de dúvidas, consulte primeiro o `RESUMO_EXECUTIVO_DEPLOY.md` para soluções rápidas!**