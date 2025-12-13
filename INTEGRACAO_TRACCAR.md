# Integração Traccar - Sistema NOTY

## Visão Geral

A integração com o Traccar permite automação completa do controle de acesso baseado no status de pagamento dos clientes. O sistema monitora automaticamente as cobranças em atraso e bloqueia/desbloqueia o acesso dos usuários na plataforma Traccar.

## Funcionalidades Implementadas

### 🔧 Configuração da Integração

- **Página de Configuração**: `/traccar`
- **Autenticação**: Token-based authentication
- **Teste de Conectividade**: Verificação automática da conexão
- **Configurações de Segurança**: Credenciais criptografadas

### 🔗 Mapeamento de Clientes

- **Mapeamento por Email**: Busca automática por email
- **Mapeamento por Telefone**: Busca por número de telefone (com limpeza de caracteres)
- **Mapeamento Manual**: Possibilidade de vincular manualmente
- **Sincronização em Lote**: Sincronização de todos os clientes

### 🤖 Automação Inteligente

#### Regras de Bloqueio Configuráveis:
- **Dias em Atraso**: Bloqueia após X dias de atraso
- **Valor Mínimo**: Bloqueia apenas se valor total >= X
- **Quantidade de Cobranças**: Bloqueia após X cobranças em atraso
- **Lista Branca**: Clientes isentos do bloqueio automático

#### Desbloqueio Automático:
- **Pagamento Recebido**: Desbloqueia automaticamente ao receber pagamento
- **Verificação Periódica**: Executa a cada 2 horas
- **Log Completo**: Auditoria de todas as ações

### 🎛️ Interface de Gerenciamento

#### Na Listagem de Clientes:
- **Ícone de Status**: Indica se cliente está mapeado/bloqueado
  - 🔗 Verde: Mapeado e ativo
  - 🔒 Vermelho: Bloqueado
  - ⚠️ Amarelo: Não mapeado
- **Ações Traccar**: Menu de ações para bloqueio/desbloqueio manual
- **Sincronização**: Botão para tentar mapear clientes não encontrados

#### Dashboard de Status:
- **Estatísticas**: Total de clientes, mapeados, bloqueados
- **Percentual de Mapeamento**: Eficiência da integração
- **Status do Serviço**: Indicador da saúde da conexão

## Configuração Inicial

### 1. Pré-requisitos

- Servidor Traccar funcionando
- Token de API do Traccar
- URL do servidor Traccar acessível

### 2. Configuração no NOTY

1. Acesse `/traccar` no sistema
2. Configure:
   - **URL do Servidor**: `https://seu-servidor.traccar.org`
   - **Token de API**: Token gerado no Traccar
   - **Habilitar Integração**: Ative a funcionalidade

3. Teste a conexão
4. Configure as regras de bloqueio:
   - Dias em atraso (padrão: 7)
   - Valor mínimo (padrão: R$ 0)
   - Quantidade de cobranças (padrão: 3)

### 3. Sincronização Inicial

1. Clique em "Sincronizar Clientes"
2. Verifique os resultados no relatório
3. Configure clientes da lista branca se necessário

## Regras de Negócio

### Critérios de Bloqueio

Um cliente será bloqueado automaticamente quando **TODAS** as condições forem atendidas:

1. ✅ Cliente mapeado no Traccar
2. ✅ Bloqueio automático habilitado para o cliente
3. ✅ Cliente não está na lista branca
4. ✅ Possui cobranças vencidas há X dias
5. ✅ Quantidade de cobranças >= limite configurado
6. ✅ Valor total em atraso >= limite configurado (se > 0)

### Critérios de Desbloqueio

Um cliente será desbloqueado automaticamente quando:

1. ✅ Cliente está bloqueado no sistema
2. ✅ Desbloqueio automático habilitado
3. ✅ Não possui cobranças em atraso

## Estrutura Técnica

### Modelos de Dados

```javascript
TraccarIntegration {
  id: UUID,
  client_id: UUID (FK),
  traccar_user_id: INTEGER,
  traccar_email: STRING,
  traccar_phone: STRING,
  mapping_method: ENUM('EMAIL', 'PHONE', 'MANUAL', 'NOT_MAPPED'),
  is_blocked: BOOLEAN,
  block_reason: TEXT,
  auto_block_enabled: BOOLEAN,
  last_sync_at: DATE,
  last_block_at: DATE,
  last_unblock_at: DATE,
  sync_errors: TEXT,
  traccar_user_data: JSONB
}
```

### Serviços

- **TraccarService**: Comunicação com API do Traccar
- **TraccarAutomationService**: Lógica de automação
- **SchedulerService**: Execução periódica (a cada 2 horas)

### Endpoints da API

```javascript
GET    /api/traccar/config           // Configurações
POST   /api/traccar/config           // Salvar configurações
GET    /api/traccar/test-connection  // Testar conexão
GET    /api/traccar/users            // Listar usuários Traccar
POST   /api/traccar/sync-clients     // Sincronizar clientes
POST   /api/traccar/clients/:id/block    // Bloquear cliente
POST   /api/traccar/clients/:id/unblock  // Desbloquear cliente
GET    /api/traccar/status           // Status da integração
```

## Logs e Auditoria

### Tipos de Log

- **Bloqueio Automático**: Registra motivo, valor, quantidade de cobranças
- **Desbloqueio Automático**: Registra quando não há cobranças em atraso
- **Bloqueio Manual**: Registra usuário e motivo
- **Desbloqueio Manual**: Registra usuário responsável
- **Erros de Sincronização**: Falhas de comunicação ou mapeamento

### Tabela de Logs

```javascript
AutomationLog {
  client_id: UUID,
  action: 'TRACCAR_BLOCK' | 'TRACCAR_UNBLOCK',
  trigger: 'AUTOMATIC' | 'MANUAL',
  details: JSONB,
  success: BOOLEAN,
  error_message: TEXT,
  user_id: UUID (para ações manuais)
}
```

## Troubleshooting

### Problemas Comuns

#### 1. Cliente Não Encontrado no Traccar
**Sintomas**: Ícone amarelo na listagem, mapping_method = 'NOT_MAPPED'

**Soluções**:
- Verificar se email/telefone estão corretos
- Confirmar se usuário existe no Traccar
- Mapear manualmente se necessário

#### 2. Erro de Conexão
**Sintomas**: Status "error" na página de configuração

**Soluções**:
- Verificar URL do servidor
- Confirmar validade do token
- Testar conectividade de rede
- Verificar firewall/proxy

#### 3. Automação Não Funciona
**Sintomas**: Clientes não são bloqueados automaticamente

**Soluções**:
- Verificar se automação está habilitada
- Confirmar regras de bloqueio
- Verificar logs de automação
- Validar se cliente não está na lista branca

## Segurança

### Boas Práticas

- ✅ Token do Traccar armazenado criptografado
- ✅ Rate limiting nas chamadas API
- ✅ Log completo de todas as ações
- ✅ Validação de permissões
- ✅ Timeout configurado para requisições
- ✅ Retry automático em falhas temporárias

### Permissões Necessárias

O token do Traccar deve ter permissões para:
- Listar usuários
- Atualizar usuários (habilitar/desabilitar)
- Visualizar informações do servidor

## Monitoramento

### Métricas Importantes

- **Taxa de Mapeamento**: % de clientes mapeados com sucesso
- **Eficiência de Bloqueio**: % de bloqueios automáticos bem-sucedidos  
- **Tempo de Resposta**: Latência das chamadas API
- **Taxa de Erro**: Falhas de comunicação

### Alertas Recomendados

- Falha na conexão com Traccar > 5 minutos
- Taxa de erro > 10% em 1 hora
- Cliente VIP bloqueado automaticamente

## Roadmap

### Próximas Funcionalidades

- [ ] Dashboard específico da integração Traccar
- [ ] Relatórios de eficiência do bloqueio
- [ ] Integração com notificações WhatsApp antes do bloqueio
- [ ] Bloqueio progressivo (avisos antes do bloqueio total)
- [ ] API webhooks para eventos de bloqueio/desbloqueio
- [ ] Integração com múltiplas instâncias Traccar