const express = require('express');
const axios = require('axios');
const { Config } = require('../models');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');
const EvolutionService = require('../services/EvolutionService');

const router = express.Router();

async function getEvolutionBaseConfig() {
  const urlConfig = await Config.findOne({ where: { key: 'evolution_api_url' } });
  const keyConfig = await Config.findOne({ where: { key: 'evolution_api_key' } });
  return {
    baseURL: urlConfig?.value,
    apiKey: keyConfig?.value,
  };
}

async function getEvolutionManagerConfig() {
  // Use environment variables for Manager API (more secure)
  return {
    baseURL: process.env.EVOLUTION_MANAGER_API_URL || null,
    apiKey: process.env.EVOLUTION_MANAGER_API_KEY || null,
  };
}

function buildAxios({ baseURL, apiKey }) {
  if (!baseURL || !apiKey) {
    throw new Error('Evolution API URL ou API Key não configurados');
  }
  const normalized = String(baseURL).replace(/\/+$/, '');
  return axios.create({
    baseURL: normalized,
    timeout: 30000,
    headers: { apikey: apiKey, 'Content-Type': 'application/json' },
  });
}

// Listar instâncias
router.get('/instances', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    // Try manager API first for consistency with create, then fallback
    let cfg = await getEvolutionManagerConfig();
    if (!cfg.baseURL || !cfg.apiKey) {
      cfg = await getEvolutionBaseConfig();
    }
    const client = buildAxios(cfg);
    
    // Try multiple list endpoints
    const listAttempts = [
      { url: '/instance/fetchInstances' },
      { url: '/instances' },
      { url: '/instance' },
    ];
    
    let lastError = null;
    for (const attempt of listAttempts) {
      try {
        const response = await client.get(attempt.url);
        return res.json({ 
          success: true, 
          data: { instances: response.data || [] }, 
          endpoint: attempt.url,
          apiUsed: cfg.baseURL 
        });
      } catch (err) {
        lastError = err;
        logger.warn(`List attempt failed for ${attempt.url}:`, err.response?.status);
      }
    }
    
    logger.error('Erro ao listar instâncias Evolution (todas as tentativas falharam):', lastError?.response?.data || lastError?.message);
    res.status(500).json({ success: false, message: 'Erro ao listar instâncias', error: lastError?.response?.data || lastError?.message });
  } catch (error) {
    logger.error('Erro ao listar instâncias Evolution:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Erro ao listar instâncias', error: error.response?.data || error.message });
  }
});

// Endpoint auxiliar para testar Manager API
router.get('/manager/status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const cfg = await getEvolutionManagerConfig();
    if (!cfg.baseURL || !cfg.apiKey) {
      return res.json({ success: true, data: { configured: false } });
    }
    const client = buildAxios(cfg);
    const response = await client.get('/');
    res.json({ success: true, data: { configured: true, status: response.status } });
  } catch (error) {
    logger.error('Erro ao testar Evolution Manager API:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Erro ao testar Evolution Manager API', error: error.response?.data || error.message });
  }
});

// Criar instância
router.post('/instances', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { instanceName, additionalConfig } = req.body || {};
    if (!instanceName) {
      return res.status(400).json({ success: false, message: 'instanceName é obrigatório' });
    }
    // Prefer manager API if configured (global admin), otherwise fallback to base API
    let cfg = await getEvolutionManagerConfig();
    if (!cfg.baseURL || !cfg.apiKey) {
      cfg = await getEvolutionBaseConfig();
    }
    const client = buildAxios(cfg);

    // Official Evolution API v2 create endpoint (from docs: https://doc.evolution-api.com/v2/api-reference/instance-controller/create-instance-basic)
    const attempts = [
      // Official v2 create endpoint - basic instance
      { 
        method: 'post', 
        url: `/instance/create`, 
        data: { 
          instanceName,
          integration: 'WHATSAPP-BAILEYS',  // or 'WHATSAPP-BUSINESS' for business
          qrcode: true,
          webhookUrl: additionalConfig?.webhookUrl || '',
          ...additionalConfig 
        } 
      },
      // Fallback patterns (in case API differs from docs)
      { method: 'post', url: `/instance/create/${encodeURIComponent(instanceName)}`, data: { integration: 'WHATSAPP-BAILEYS', qrcode: true, ...additionalConfig } },
      { method: 'post', url: `/instances/create`, data: { instanceName, integration: 'WHATSAPP-BAILEYS', qrcode: true, ...additionalConfig } },
      { method: 'post', url: `/instance/${encodeURIComponent(instanceName)}/create`, data: { integration: 'WHATSAPP-BAILEYS', qrcode: true, ...additionalConfig } },
    ];

    const errors = [];
    let lastError = null;
    for (const attempt of attempts) {
      try {
        const response = await client.request({ method: attempt.method, url: attempt.url, data: attempt.data });
        return res.status(201).json({ success: true, message: 'Instância criada com sucesso', data: response.data, attempt: attempt.url });
      } catch (err) {
        lastError = err;
        errors.push({
          url: attempt.url,
          status: err?.response?.status,
          error: err?.response?.data || err?.message,
        });
        // continue to next attempt
      }
    }

    logger.error('Erro ao criar instância Evolution (todas as tentativas falharam):', errors);
    res.status(500).json({ success: false, message: 'Erro ao criar instância (verifique URL da Evolution API e permissões)', attempts: errors });
  } catch (error) {
    logger.error('Erro ao criar instância Evolution:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Erro ao criar instância', error: error.response?.data || error.message });
  }
});

// Deletar instância
router.delete('/instances/:name', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name } = req.params;
    
    // Use manager API for delete operations
    let cfg = await getEvolutionManagerConfig();
    if (!cfg.baseURL || !cfg.apiKey) {
      cfg = await getEvolutionBaseConfig();
    }
    const client = buildAxios(cfg);
    
    // Try multiple delete endpoints
    const deleteAttempts = [
      { method: 'delete', url: `/instance/delete/${encodeURIComponent(name)}` },
      { method: 'delete', url: `/instances/${encodeURIComponent(name)}` },
      { method: 'delete', url: `/instance/${encodeURIComponent(name)}` },
      { method: 'post', url: `/instance/delete/${encodeURIComponent(name)}` }, // Some APIs use POST for delete
    ];
    
    let lastError = null;
    for (const attempt of deleteAttempts) {
      try {
        const response = await client.request({ method: attempt.method, url: attempt.url });
        return res.json({ success: true, message: 'Instância removida com sucesso', data: response.data, endpoint: attempt.url });
      } catch (err) {
        lastError = err;
        logger.warn(`Delete attempt failed for ${attempt.url}:`, err.response?.status);
      }
    }
    
    logger.error('Erro ao remover instância Evolution (todas as tentativas falharam):', lastError?.response?.data || lastError?.message);
    res.status(500).json({ success: false, message: 'Erro ao remover instância', error: lastError?.response?.data || lastError?.message });
  } catch (error) {
    logger.error('Erro ao remover instância Evolution:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Erro ao remover instância', error: error.response?.data || error.message });
  }
});

// Status da instância
router.get('/instances/:name/status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name } = req.params;
    
    // Try manager API first, then fallback
    let cfg = await getEvolutionManagerConfig();
    if (!cfg.baseURL || !cfg.apiKey) {
      cfg = await getEvolutionBaseConfig();
    }
    const client = buildAxios(cfg);
    
    // Try multiple status endpoints
    const statusAttempts = [
      { url: `/instance/connectionState/${encodeURIComponent(name)}` },
      { url: `/instance/${encodeURIComponent(name)}/connectionState` },
      { url: `/instances/${encodeURIComponent(name)}/status` },
      { url: `/instance/${encodeURIComponent(name)}/status` },
    ];
    
    let lastError = null;
    for (const attempt of statusAttempts) {
      try {
        const response = await client.get(attempt.url);
        return res.json({ success: true, data: response.data, endpoint: attempt.url });
      } catch (err) {
        lastError = err;
        logger.warn(`Status attempt failed for ${attempt.url}:`, err.response?.status);
      }
    }
    
    logger.error('Erro ao obter status da instância Evolution (todas as tentativas falharam):', lastError?.response?.data || lastError?.message);
    res.status(500).json({ success: false, message: 'Erro ao obter status da instância', error: lastError?.response?.data || lastError?.message });
  } catch (error) {
    logger.error('Erro ao obter status da instância Evolution:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Erro ao obter status da instância', error: error.response?.data || error.message });
  }
});

// QR Code da instância
router.get('/instances/:name/qr', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name } = req.params;
    
    // Try manager API first, then fallback to base API
    let cfg = await getEvolutionManagerConfig();
    if (!cfg.baseURL || !cfg.apiKey) {
      cfg = await getEvolutionBaseConfig();
    }
    const client = buildAxios(cfg);

    // Try multiple QR endpoint patterns
    const qrAttempts = [
      { url: `/instance/connect/${encodeURIComponent(name)}` }, // Evolution v2
      { url: `/instance/qr/${encodeURIComponent(name)}` },      // Common pattern
      { url: `/instance/${encodeURIComponent(name)}/qr` },     // Alternative
      { url: `/instances/${encodeURIComponent(name)}/qr` },    // Alternative
    ];

    let lastError = null;
    for (const attempt of qrAttempts) {
      try {
        const response = await client.get(attempt.url);
        return res.json({ success: true, data: response.data, endpoint: attempt.url });
      } catch (err) {
        lastError = err;
        logger.warn(`QR attempt failed for ${attempt.url}:`, err.response?.status);
      }
    }

    logger.error('Erro ao obter QRCode da instância Evolution (todas as tentativas falharam):', lastError?.response?.data || lastError?.message);
    res.status(500).json({ success: false, message: 'Erro ao obter QRCode - verifique se a instância existe e está desconectada', error: lastError?.response?.data || lastError?.message });
  } catch (error) {
    logger.error('Erro ao obter QRCode da instância Evolution:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Erro ao obter QRCode', error: error.response?.data || error.message });
  }
});

// Comandos da instância: start, restart, logout
router.post('/instances/:name/:action', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, action } = req.params;
    
    if (!['restart', 'logout', 'disconnect', 'stop'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Ação inválida' });
    }
    
    // Map logout to disconnect for Evolution API
    const actualAction = action === 'logout' ? 'disconnect' : action;
    
    // Try manager API first, then fallback to base API if instance not found
    let cfg = await getEvolutionManagerConfig();
    let usingManagerAPI = true;
    
    if (!cfg.baseURL || !cfg.apiKey) {
      cfg = await getEvolutionBaseConfig();
      usingManagerAPI = false;
      if (!cfg.baseURL || !cfg.apiKey) {
        return res.status(400).json({ 
          success: false, 
          message: 'Neither Evolution Manager API nor Base API configured properly' 
        });
      }
    }
    const client = buildAxios(cfg);
    
    // Try multiple action endpoint patterns for each action
    const actionAttempts = {
      restart: [
        // Evolution API may not have direct restart - try alternatives
        { url: `/instance/restart/${encodeURIComponent(name)}` },
        { url: `/instance/connect/${encodeURIComponent(name)}` }, // Some APIs use connect for restart
      ],
      logout: [
        { url: `/instance/logout/${encodeURIComponent(name)}` }, // Official: DELETE /instance/logout/{instance}
      ],
      disconnect: [
        { url: `/instance/logout/${encodeURIComponent(name)}` }, // Evolution uses logout endpoint
        { url: `/instance/disconnect/${encodeURIComponent(name)}` },
        { url: `/instance/${encodeURIComponent(name)}/disconnect` },
      ],
      stop: [
        { url: `/instance/stop/${encodeURIComponent(name)}` }, // Presumed: POST /instance/stop/{instance}
      ]
    };
    
    const attempts = actionAttempts[actualAction] || actionAttempts[action] || [];
    let lastError = null;
    
    for (const attempt of attempts) {
      try {
        // Use correct HTTP method for each action based on Evolution API docs
        let method = 'post'; // default
        if (actualAction === 'disconnect' || action === 'logout') {
          method = 'delete';
        } else if (action === 'start') {
          method = 'put';
        } else if (action === 'restart') {
          // For restart, try both PUT and GET (connect endpoints often use GET)
          method = attempt.url.includes('connect') ? 'get' : 'put';
        }
        
        const response = await client.request({ method, url: attempt.url });
        return res.json({ 
          success: true, 
          message: `Ação ${action} executada com sucesso`, 
          data: response.data, 
          endpoint: attempt.url, 
          method,
          apiUsed: cfg.baseURL 
        });
      } catch (err) {
        lastError = err;
        logger.warn(`${action} attempt failed for ${attempt.url} (${err.response?.status}):`, err.response?.data?.message || err.message);
      }
    }
    
    // If 404 and we were using Manager API, try Base API
    if (lastError?.response?.status === 404 && usingManagerAPI) {
      logger.warn(`Instance ${name} not found in Manager API, trying Base API...`);
      
      try {
        const baseCfg = await getEvolutionBaseConfig();
        if (baseCfg.baseURL && baseCfg.apiKey) {
          const baseClient = buildAxios(baseCfg);
          const attempts = actionAttempts[actualAction] || actionAttempts[action] || [];
          
          for (const attempt of attempts) {
            try {
              let method = 'post';
              if (actualAction === 'disconnect' || action === 'logout') {
                method = 'delete';
              } else if (action === 'restart') {
                method = attempt.url.includes('connect') ? 'get' : 'put';
              }
              
              const response = await baseClient.request({ method, url: attempt.url });
              return res.json({ 
                success: true, 
                message: `Ação ${action} executada com sucesso (via Base API)`, 
                data: response.data, 
                endpoint: attempt.url, 
                method,
                apiUsed: `${baseCfg.baseURL} (Base API fallback)` 
              });
            } catch (baseErr) {
              // Continue trying other endpoints
            }
          }
        }
      } catch (baseApiError) {
        // Base API also failed
      }
      
      return res.status(404).json({ 
        success: false, 
        message: `Instância "${name}" não encontrada em nenhuma API (Manager ou Base).`,
        suggestion: 'Verifique se a instância realmente existe.'
      });
    }
    
    logger.error(`Erro ao executar ${action} na instância Evolution (todas as tentativas falharam):`, lastError?.response?.data || lastError?.message);
    res.status(500).json({ 
      success: false, 
      message: `Erro ao executar ${action}. Endpoint pode não existir na sua versão da Evolution API.`, 
      error: lastError?.response?.data || lastError?.message,
      instance: name,
      triedEndpoint: `/instance/${action}/${name}`,
      apiUsed: cfg.baseURL
    });
  } catch (error) {
    logger.error('Erro ao executar ação na instância Evolution:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Erro ao executar ação', error: error.response?.data || error.message });
  }
});

// Definir instância padrão para envio de mensagens
router.post('/default', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { instanceName } = req.body || {};
    if (!instanceName) {
      return res.status(400).json({ success: false, message: 'instanceName é obrigatório' });
    }

    // valida se a instância existe no Evolution (try both Manager and Base APIs)
    let exists = false;
    
    // Try Manager API first
    try {
      const managerCfg = await getEvolutionManagerConfig();
      if (managerCfg.baseURL && managerCfg.apiKey) {
        const managerClient = buildAxios(managerCfg);
        const managerResp = await managerClient.get('/instance/fetchInstances');
        exists = (managerResp.data || []).some((inst) => {
          const name = inst?.instance?.instanceName || inst?.instanceName || inst?.name;
          return name === instanceName;
        });
      }
    } catch (managerError) {
      logger.warn('Manager API not available for validation, trying Base API');
    }
    
    // If not found in Manager API, try Base API
    if (!exists) {
      try {
        const baseCfg = await getEvolutionBaseConfig();
        const baseClient = buildAxios(baseCfg);
        const baseResp = await baseClient.get('/instance/fetchInstances');
        exists = (baseResp.data || []).some((inst) => {
          const name = inst?.instance?.instanceName || inst?.instanceName || inst?.name;
          return name === instanceName;
        });
      } catch (baseError) {
        logger.error('Both Manager and Base APIs failed for instance validation');
      }
    }

    if (!exists) {
      return res.status(400).json({ success: false, message: 'Instância informada não existe em nenhuma Evolution API (Manager ou Base)' });
    }

    // upsert config evolution_instance
    const [config, created] = await Config.findOrCreate({
      where: { key: 'evolution_instance' },
      defaults: {
        key: 'evolution_instance',
        value: instanceName,
        description: 'Instância padrão do Evolution para envio de mensagens',
        type: 'string',
        category: 'evolution',
        is_active: true,
      },
    });
    if (!created) {
      await config.update({ value: instanceName });
    }

    // Invalida EvolutionService para refletir instantaneamente a nova instância
    try {
      const EvolutionService = require('../services/EvolutionService');
      EvolutionService.invalidate();
      await EvolutionService.initialize(); // opcionalmente já inicializa para validar
      logger.info('EvolutionService invalidated and reinitialized after instance update');
    } catch (error) {
      logger.error('Erro ao reinicializar EvolutionService após update de instância:', error);
    }

    res.json({ success: true, message: 'Instância padrão atualizada', data: { instanceName } });
  } catch (error) {
    logger.error('Erro ao definir instância padrão Evolution:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Erro ao definir instância padrão', error: error.response?.data || error.message });
  }
});

module.exports = router;
