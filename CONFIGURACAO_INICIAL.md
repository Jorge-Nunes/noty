# 🔧 Configuração Inicial do Sistema NOTY

## ⚠️ **IMPORTANTE: Configuração Obrigatória**

O sistema precisa ser configurado antes da primeira sincronização com o Asaas.

---

## 📋 **Passo a Passo da Configuração**

### 1. **Acesse o Sistema**
```
URL: http://localhost:3000
Login: admin@noty.com
Senha: admin123
```

### 2. **Configure as APIs**

#### 🔹 **Asaas API (Obrigatório)**
1. Vá em **Configurações** → **Aba "Asaas API"**
2. Configure:
   - **URL da API**: 
     - Sandbox: `https://api-sandbox.asaas.com/v3`
     - Produção: `https://api.asaas.com/v3`
   - **Token de Acesso**: Seu token do Asaas
3. Clique em **"Testar Conexão"** para verificar
4. Clique em **"Salvar"**

#### 🔹 **Evolution API (Para WhatsApp)**
1. Vá em **Configurações** → **Aba "Evolution API"**
2. Configure:
   - **URL da API**: URL da sua instância Evolution
   - **Chave de Acesso**: API Key da Evolution
   - **Nome da Instância**: Nome da sua instância
3. Clique em **"Testar Conexão"** para verificar
4. Clique em **"Salvar"**

### 3. **Execute a Primeira Sincronização**
1. Vá em **Automação**
2. Clique em **"Sincronizar Asaas"**
3. Aguarde a importação dos dados

---

## 🚨 **Problema Atual Detectado**

**Status**: As configurações do Asaas estão vazias, causando erro 404.

**Solução**: Configure o token do Asaas conforme instruções acima.

---

## 🔑 **Como Obter o Token do Asaas**

1. Acesse sua conta no [Asaas](https://www.asaas.com)
2. Vá em **Configurações** → **Integrações** → **API**
3. Copie o **Token de Produção** ou **Token de Sandbox**
4. Cole no sistema NOTY

---

## ✅ **Verificação da Configuração**

Após configurar, você deve ver:
- ✅ Teste de conexão Asaas: **Sucesso**
- ✅ Sincronização: **Clientes e pagamentos importados**
- ✅ Dashboard: **Dados aparecendo**

---

## 🛠️ **Resolução de Problemas**

### **Erro 404 - Asaas**
- Verifique se o token está correto
- Confirme se a URL está certa (sandbox vs produção)
- Teste a conexão antes de sincronizar

### **Erro de Conexão - Evolution**
- Verifique se a instância está online
- Confirme a URL e API Key
- Teste se o WhatsApp está conectado na instância

### **Sem Dados no Dashboard**
- Execute a sincronização manual primeiro
- Aguarde alguns minutos para processamento
- Verifique os logs de automação

---

## 📞 **Próximos Passos Após Configuração**

1. ✅ **Configure as APIs**
2. ✅ **Execute sincronização**
3. ✅ **Verifique dados importados**
4. ✅ **Teste envio de WhatsApp**
5. ✅ **Configure horários de automação**
6. ✅ **Sistema pronto para uso!**