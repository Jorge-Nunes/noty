# NOTY - Sistema de Cobrança Automatizada

Sistema completo de cobrança automatizada baseado na automação TEKSAT, integrando APIs do Asaas (gateway de pagamento) e Evolution (WhatsApp) para envio automatizado de notificações de cobrança.

## 🚀 Funcionalidades

### ✨ Principais Características
- **Dashboard Analítico**: Visualização completa de métricas, gráficos e atividades
- **Gestão de Clientes**: CRUD completo com sincronização automática do Asaas
- **Gestão de Cobranças**: Controle total dos pagamentos e status
- **Automação Inteligente**: Sistema de notificações automáticas baseado em regras
- **Configuração Flexível**: Painel para configurar APIs e parâmetros do sistema
- **Interface Responsiva**: Compatível com dispositivos móveis

### 🤖 Automações Disponíveis
- **Avisos de Vencimento**: Notificações X dias antes do vencimento
- **Vencimento Hoje**: Alertas para faturas que vencem no dia
- **Cobranças Vencidas**: Notificações para pagamentos em atraso
- **Sincronização Automática**: Atualização periódica dos dados do Asaas

### 📱 Integrações
- **Asaas API**: Gestão de clientes, pagamentos e faturas
- **Evolution API**: Envio de mensagens WhatsApp automatizadas
- **Banco PostgreSQL**: Armazenamento robusto e confiável

## 🛠️ Tecnologias

### Backend
- **Node.js** com Express.js
- **PostgreSQL** com Sequelize ORM
- **JWT** para autenticação
- **Node-cron** para agendamentos
- **Winston** para logs
- **Axios** para integrações APIs

### Frontend
- **React** com TypeScript
- **Material-UI (MUI)** para componentes
- **React Query** para gerenciamento de estado
- **React Hook Form** para formulários
- **Recharts** para gráficos
- **React Router** para navegação

## 📦 Instalação

### Pré-requisitos
- Node.js 16+ 
- PostgreSQL 12+
- npm ou yarn

### 1. Clone o repositório
```bash
git clone <repository-url>
cd noty-app
```

### 2. Instale as dependências do backend
```bash
npm install
```

### 3. Instale as dependências do frontend
```bash
cd client
npm install
cd ..
```

### 4. Configure o banco de dados
```bash
# Crie um banco de dados PostgreSQL
createdb noty_db

# Configure as variáveis de ambiente
cp .env.example .env
```

### 5. Configure as variáveis de ambiente
Edite o arquivo `.env` com suas configurações:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=noty_db
DB_USER=admin
DB_PASSWORD=admin

# JWT
JWT_SECRET=your-super-secure-jwt-secret

# APIs
ASAAS_ACCESS_TOKEN=your-asaas-token
EVOLUTION_API_URL=your-evolution-api-url
EVOLUTION_API_KEY=your-evolution-api-key
EVOLUTION_INSTANCE_NAME=your-instance-name
```

### 6. Inicialize o banco de dados
```bash
npm run init-db
```

### 7. Execute a aplicação

#### Desenvolvimento
```bash
# Terminal 1 - Backend
npm run dev

# Terminal 2 - Frontend
npm run client
```

#### Produção
```bash
# Build do frontend
npm run build

# Inicie o servidor
npm start
```

## 🔧 Configuração

### Primeira Configuração

1. **Acesse o sistema**: `http://localhost:3000`
2. **Login padrão**:
   - Email: `admin@noty.com`
   - Senha: `admin123`

3. **Configure as APIs**:
   - Vá em **Configurações**
   - Configure credenciais do **Asaas**
   - Configure credenciais da **Evolution API**
   - Teste as conexões

4. **Execute sincronização inicial**:
   - Vá em **Automação**
   - Execute **Sincronização Manual**
   - Aguarde importação dos dados

### Configurações Importantes

#### Asaas API
- **URL**: https://api.asaas.com/v3 (produção) ou https://api-sandbox.asaas.com/v3 (sandbox)
- **Token**: Obtido no painel do Asaas

#### Evolution API
- **URL**: URL da sua instância Evolution
- **API Key**: Chave de acesso da Evolution
- **Instância**: Nome da instância configurada

#### Automação
- **Dias de Aviso**: Quantos dias antes do vencimento enviar avisos
- **Horário Avisos**: Hora para executar avisos e vencimentos (padrão: 9h)
- **Horário Vencidos**: Hora para executar cobranças vencidas (padrão: 11h)

## 📋 Uso do Sistema

### Dashboard
- Visualize métricas em tempo real
- Acompanhe gráficos de pagamentos
- Monitor atividades recentes

### Clientes
- Visualize todos os clientes
- Sincronize com Asaas
- Configure notificações por cliente
- Ative/desative clientes

### Cobranças
- Visualize pagamentos pendentes
- Acompanhe vencimentos
- Monitor status dos pagamentos

### Automação
- Execute sincronizações manuais
- Envie notificações específicas
- Visualize logs de execução
- Monitor status das automações

### Configurações
- Configure APIs externas
- Ajuste parâmetros de automação
- Gerencie usuários (admin)
- Teste conexões

## 🔒 Segurança

- **Autenticação JWT** com expiração
- **Rate limiting** para proteção de APIs
- **Validação de dados** com Joi
- **Logs de auditoria** completos
- **Controle de acesso** por perfis

### Perfis de Usuário
- **Admin**: Acesso total ao sistema
- **Operador**: Operações diárias (sem configurações)
- **Visualizador**: Apenas leitura

## 📊 Monitoramento

### Logs
Os logs são armazenados em:
- `logs/combined.log` - Log geral
- `logs/error.log` - Log de erros
- `logs/automation.log` - Log das automações

### Métricas Disponíveis
- Total de clientes ativos
- Pagamentos pendentes/vencidos
- Receita mensal
- Mensagens enviadas/falharam
- Status das automações

## 🔄 Automações

### Fluxo das Automações

1. **Sincronização** (Diária - 00:00)
   - Importa clientes do Asaas
   - Atualiza status dos pagamentos
   - Sincroniza dados

2. **Avisos e Vencimentos** (Configurável - padrão 09:00)
   - Identifica pagamentos que vencem em X dias
   - Identifica pagamentos que vencem hoje
   - Envia notificações WhatsApp

3. **Cobranças Vencidas** (Configurável - padrão 11:00)
   - Identifica pagamentos vencidos
   - Envia notificações de cobrança
   - Registra tentativas

### Mensagens Personalizadas
As mensagens seguem os templates da automação TEKSAT original:

**Aviso de Vencimento:**
```
🔔 Olá, tudo bem? Somos da *EMPRESA*.
Faltam apenas X dia(s) para o vencimento da sua fatura 🗓️.
Evite a suspensão do serviço e mantenha sua proteção ativa! 🛡️
```

**Vencimento Hoje:**
```
🚗💨 Olá, aqui é da *EMPRESA*!
Notamos que sua fatura vence *hoje* 📅.
Para evitar juros, faça o pagamento o quanto antes.
```

**Pagamento Vencido:**
```
⚠️ Olá, somos da *EMPRESA*.
Identificamos que sua fatura está *vencida* ⏳.
Pedimos que regularize o pagamento para evitar interrupção.
```

## 🚨 Troubleshooting

### Problemas Comuns

**Erro de conexão com banco:**
- Verifique se PostgreSQL está rodando
- Confirme credenciais no `.env`
- Teste conexão manualmente

**APIs não funcionam:**
- Verifique tokens e URLs nas configurações
- Use a função "Testar Conexão"
- Verifique logs de erro

**Automações não executam:**
- Verifique logs em `/automation/status`
- Confirme horários configurados
- Verifique se scheduler está ativo

**Mensagens não são enviadas:**
- Teste conexão Evolution API
- Verifique se instância está ativa
- Confirme números de telefone

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja `LICENSE` para mais detalhes.

## 📞 Suporte

Para suporte, abra uma issue no GitHub ou entre em contato com a equipe de desenvolvimento.

---

**NOTY** - Sistema de Cobrança Automatizada
Baseado na automação TEKSAT com interface web moderna e recursos avançados.