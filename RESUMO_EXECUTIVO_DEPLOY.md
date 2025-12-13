# 📋 Resumo Executivo - Deploy NOTY System

## ⚡ **Quick Start (Para Administradores Experientes)**

### **🚀 Deploy Rápido (30 minutos)**

```bash
# 1. Preparar servidor (Ubuntu 20.04+)
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs postgresql postgresql-contrib nginx
sudo npm install -g pm2

# 2. Configurar PostgreSQL
sudo -u postgres psql
CREATE DATABASE noty_production;
CREATE USER noty_user WITH PASSWORD 'SENHA_SEGURA';
GRANT ALL PRIVILEGES ON DATABASE noty_production TO noty_user;
\q

# 3. Deploy da aplicação
cd /var/www
sudo git clone REPO_URL noty
sudo chown -R $USER:$USER /var/www/noty
cd noty

# 4. Configurar ambiente
cp .env.example .env
# Editar .env com suas configurações

# 5. Build e inicialização
npm install --production
cd client && npm install && npm run build && cd ..
node scripts/production-setup.js

# 6. Configurar PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# 7. Configurar Nginx (copiar config da documentação)
sudo nano /etc/nginx/sites-available/noty
sudo ln -s /etc/nginx/sites-available/noty /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# 8. SSL com Let's Encrypt
sudo snap install --classic certbot
sudo certbot --nginx -d seu-dominio.com

# 9. Verificação final
./scripts/health-check.sh
```

---

## 🎯 **Objetivos do Deploy**

### **Sistema Final Esperado:**
- ✅ **Aplicação Web**: Frontend React servido via Nginx
- ✅ **API Backend**: Node.js rodando via PM2 em cluster
- ✅ **Banco de Dados**: PostgreSQL com todas as tabelas
- ✅ **Proxy Reverso**: Nginx com SSL/HTTPS
- ✅ **Monitoramento**: PM2, logs estruturados
- ✅ **Segurança**: Firewall, Fail2ban, SSL
- ✅ **Backup**: Automático diário

---

## 📊 **Arquitetura de Produção**

```
Internet → Nginx (SSL) → Node.js (PM2) → PostgreSQL
    ↓
[Firewall] → [Fail2ban] → [Monitoring] → [Backup]
```

### **Portas Utilizadas:**
- **80/443**: Nginx (HTTP/HTTPS)
- **5000**: Node.js (interno, proxy via Nginx)
- **5432**: PostgreSQL (interno)
- **22**: SSH (restrito por IP)

---

## 🔐 **Configurações Críticas de Segurança**

### **Obrigatórias:**
- [ ] **JWT_SECRET**: 256 bits aleatórios
- [ ] **DB Password**: Senha forte do PostgreSQL
- [ ] **Firewall**: UFW ativo, apenas portas necessárias
- [ ] **SSL**: Certificado Let's Encrypt
- [ ] **SSH**: Chaves SSH, disable password auth
- [ ] **Updates**: Sistema sempre atualizado

### **Recomendadas:**
- [ ] **Fail2ban**: Proteção contra força bruta
- [ ] **Backup**: Diário automatizado
- [ ] **Monitoring**: Health checks regulares
- [ ] **Logs**: Rotação automática
- [ ] **IP Whitelist**: SSH apenas de IPs conhecidos

---

## ⚙️ **Variáveis de Ambiente Críticas**

### **`.env` de Produção:**
```env
NODE_ENV=production
PORT=5000

DB_HOST=localhost
DB_NAME=noty_production
DB_USER=noty_user
DB_PASSWORD=SENHA_MUITO_SEGURA

JWT_SECRET=CHAVE_256_BITS_ALEATORIA

ASAAS_API_URL=https://www.asaas.com/api/v3
ASAAS_ACCESS_TOKEN=SEU_TOKEN_PRODUCAO
ASAAS_WEBHOOK_SECRET=SECRET_WEBHOOK

EVOLUTION_API_URL=https://sua-evolution.com
EVOLUTION_API_KEY=SUA_CHAVE
EVOLUTION_INSTANCE=SUA_INSTANCIA

COMPANY_NAME=Sua Empresa

REACT_APP_API_URL=https://seu-dominio.com/api
```

---

## 📋 **Checklist Pré-Deploy**

### **Infraestrutura:**
- [ ] Servidor VPS/Dedicado configurado
- [ ] Domínio registrado e DNS configurado
- [ ] Acesso SSH configurado
- [ ] Node.js 18+ instalado
- [ ] PostgreSQL 13+ instalado
- [ ] Nginx instalado
- [ ] PM2 instalado globalmente

### **Configuração:**
- [ ] Repositório Git clonado
- [ ] Arquivo .env configurado
- [ ] Banco de dados criado
- [ ] Usuário do banco configurado
- [ ] Nginx configurado para o domínio
- [ ] SSL obtido e configurado

### **Aplicação:**
- [ ] Backend buildado e dependências instaladas
- [ ] Frontend buildado para produção
- [ ] Banco inicializado com tabelas
- [ ] PM2 configurado e rodando
- [ ] Health check passando

---

## 🚨 **Troubleshooting Rápido**

### **Problemas Comuns:**

#### **API não responde:**
```bash
pm2 logs noty-backend
pm2 restart noty-backend
curl http://localhost:5000/api/auth/health
```

#### **Frontend não carrega:**
```bash
sudo nginx -t
sudo systemctl reload nginx
ls -la /var/www/noty/client/build/
```

#### **Banco não conecta:**
```bash
sudo systemctl status postgresql
psql -h localhost -U noty_user -d noty_production
```

#### **SSL não funciona:**
```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

#### **PM2 não inicia:**
```bash
pm2 status
pm2 delete all
pm2 start ecosystem.config.js
```

---

## 📞 **Suporte e Manutenção**

### **Comandos Essenciais Diários:**
```bash
# Health check completo
./scripts/health-check.sh

# Ver logs da aplicação
pm2 logs noty-backend --lines 50

# Status dos serviços
sudo systemctl status nginx postgresql
pm2 status

# Espaço em disco
df -h

# Uso de memória
free -h

# Processos ativos
htop
```

### **Backups:**
```bash
# Backup manual
./scripts/backup.sh

# Verificar backups automáticos
ls -la /var/backups/noty/

# Restaurar backup (se necessário)
psql -h localhost -U noty_user noty_production < backup_file.sql
```

### **Updates:**
```bash
# Atualização completa (código + dependências)
./scripts/deploy-update.sh

# Apenas restart da aplicação
pm2 restart noty-backend

# Verificar após update
./scripts/health-check.sh
```

---

## 🎉 **Pós-Deploy**

### **Acesso Inicial:**
1. **URL**: https://seu-dominio.com
2. **Login**: admin@noty.com
3. **Senha**: admin123 (ALTERAR IMEDIATAMENTE)

### **Configurações Iniciais:**
1. **Alterar senha** do administrador
2. **Configurar APIs** Asaas e Evolution
3. **Importar dados** via sincronização
4. **Testar webhook** com evento real
5. **Configurar templates** personalizados
6. **Executar backup** manual

### **Monitoramento Contínuo:**
- **Daily**: Verificar logs e health check
- **Weekly**: Verificar backups e espaço em disco
- **Monthly**: Atualizar sistema e dependências
- **Quarterly**: Revisar certificados SSL

---

## 🏆 **Sistema de Produção Completo**

Com este deploy, você terá:

✅ **Alta Disponibilidade**: PM2 cluster + restart automático
✅ **Segurança Robusta**: HTTPS, Firewall, Fail2ban
✅ **Performance Otimizada**: Nginx proxy, cache, compressão
✅ **Backup Automatizado**: Banco + arquivos diários
✅ **Monitoramento Ativo**: Health checks + alertas
✅ **Manutenção Facilitada**: Scripts automatizados
✅ **Escalabilidade**: Preparado para crescimento

**🚀 NOTY System pronto para produção empresarial!**