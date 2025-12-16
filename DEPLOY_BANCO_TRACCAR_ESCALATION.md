# 🗄️ Deploy: Mudanças de Banco - Escalonamento Traccar

## 📊 **RESUMO DA ALTERAÇÃO**

**Feature**: Implementação de escalonamento inteligente de avisos Traccar  
**Data**: 16/12/2025  
**Tipo**: Adição de valores ENUM + dados iniciais  
**Criticidade**: **BAIXA** (apenas adição, sem remoção)

---

## 🔧 **MUDANÇAS NO SCHEMA**

### **Tabela Afetada**: `message_templates`
**Coluna**: `type` (ENUM)

#### **ANTES:**
```sql
type ENUM(
  'warning', 'due_today', 'overdue', 'payment_received', 'payment_confirmed', 
  'traccar_block', 'traccar_unblock', 'traccar_warning'
)
```

#### **DEPOIS:**
```sql
type ENUM(
  'warning', 'due_today', 'overdue', 'payment_received', 'payment_confirmed', 
  'traccar_block', 'traccar_unblock', 'traccar_warning',
  'traccar_warning_threshold',  -- NOVO
  'traccar_warning_final'       -- NOVO
)
```

---

## 🚀 **INSTRUÇÕES DE DEPLOY**

### **1. Backup (Obrigatório)**
```bash
pg_dump sua_base_producao > backup_$(date +%Y%m%d_%H%M%S)_pre_traccar_escalation.sql
```

### **2. Migration de Schema**
```sql
-- Adicionar novos valores ao ENUM
ALTER TYPE enum_message_templates_type ADD VALUE 'traccar_warning_threshold';
ALTER TYPE enum_message_templates_type ADD VALUE 'traccar_warning_final';
```

**Verificação:**
```sql
-- Confirmar que os novos valores foram adicionados
SELECT unnest(enum_range(NULL::enum_message_templates_type)) AS enum_values;
```

### **3. Dados Iniciais**
```bash
# Executar após migration de schema
node scripts/init-new-traccar-templates.js
```

### **4. Restart da Aplicação**
```bash
# PM2
pm2 restart all

# Systemd
sudo systemctl restart sua-app

# Docker
docker-compose restart
```

### **5. Verificação Pós-Deploy**
```bash
# Verificar logs
tail -f logs/app.log | grep -i template

# Testar templates na UI
curl -H "Authorization: Bearer TOKEN" http://localhost:5000/api/templates
```

---

## 📝 **NOVOS TEMPLATES CRIADOS**

### **1. `traccar_warning_threshold`**
- **Descrição**: Aviso no limiar de bloqueio (ex: 2 de 3 cobranças)
- **Uso**: Quando `overdueCount === (block_after_count - 1)`

### **2. `traccar_warning_final`**  
- **Descrição**: Último aviso antes do bloqueio automático
- **Uso**: Quando atinge exatamente o limite (caso especial)

---

## 🎯 **IMPACTO DA MUDANÇA**

### **✅ Funcionalidades Afetadas:**
- **Automação Traccar**: Lógica de avisos mais inteligente
- **Templates UI**: Novos tipos disponíveis para edição
- **Logs**: Melhor rastreabilidade dos tipos de aviso

### **✅ Compatibilidade:**
- **Backward Compatible**: Todos os templates existentes continuam funcionando
- **Zero Downtime**: Mudança não quebra funcionalidades existentes
- **Rollback Simples**: Apenas remoção de dados, ENUM fica compatível

### **⚠️ Dependências:**
- Scripts de inicialização devem rodar APÓS migration de schema
- Frontend deve ser atualizado junto (componente TemplatesTab)

---

## 🔄 **ROLLBACK (se necessário)**

### **Remoção de Dados:**
```sql
-- Remover templates criados (se necessário)
DELETE FROM message_templates WHERE type IN ('traccar_warning_threshold', 'traccar_warning_final');
```

### **ENUM não pode ser revertido facilmente:**
- Valores ENUM não podem ser removidos no PostgreSQL
- Se necessário, requer recriar o tipo ENUM inteiro
- **Recomendação**: Deixar valores ENUM e apenas desativar templates

---

## 📊 **VALIDAÇÃO PÓS-DEPLOY**

### **1. Verificar Templates:**
```sql
SELECT type, name, is_active 
FROM message_templates 
WHERE type LIKE 'traccar_warning_%' 
ORDER BY created_at;
```

### **2. Testar Automação:**
```bash
# Teste manual de reconciliação
curl -X POST http://localhost:5000/api/payments/reconcile-traccar \
  -H "Authorization: Bearer TOKEN" \
  -d '{"force_all": true}'
```

### **3. Monitorar Logs:**
```bash
# Acompanhar execução da automação
tail -f logs/app.log | grep -E "(traccar_warning_threshold|traccar_warning_final)"
```

---

## 📋 **CHECKLIST DE DEPLOY**

- [ ] Backup do banco realizado
- [ ] Migration de ENUM aplicada
- [ ] Script de templates executado  
- [ ] Aplicação reiniciada
- [ ] Novos templates visíveis na UI
- [ ] Logs não apresentam erros
- [ ] Teste de automação funcional

---

## 🎯 **BENEFÍCIOS APÓS DEPLOY**

### **Antes:**
- Avisos e bloqueios enviados simultaneamente
- Mensagens redundantes para clientes
- Lógica pouco estratégica

### **Depois:**
- Avisos estratégicos APENAS no limiar
- Bloqueios sem redundância  
- Templates específicos e editáveis
- Reconciliação em tempo real mantida

---

**📞 Suporte**: Em caso de problemas, verificar logs e executar rollback se necessário.  
**⏱️ Tempo estimado**: 5-10 minutos  
**🚨 Janela de manutenção**: Não necessária (compatível)

---

**✅ DEPLOY VALIDADO E PRONTO PARA PRODUÇÃO**