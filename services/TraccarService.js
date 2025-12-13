const axios = require('axios');
const logger = require('../utils/logger');
const { Config } = require('../models');

class TraccarService {
  constructor() {
    this.apiClient = null;
    this.config = null;
  }

  /**
   * Inicializa o serviço com as configurações do Traccar
   */
  async initialize() {
    try {
      this.config = await this.getTraccarConfig();
      
      if (!this.config.url || !this.config.token) {
        logger.warn('Configuração do Traccar incompleta');
        return false;
      }

      this.apiClient = axios.create({
        baseURL: `${this.config.url}/api`,
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      // Teste de conectividade
      await this.testConnection();
      logger.info('TraccarService inicializado com sucesso');
      return true;
    } catch (error) {
      logger.error('Erro ao inicializar TraccarService:', error.message);
      return false;
    }
  }

  /**
   * Busca as configurações do Traccar no banco
   */
  async getTraccarConfig() {
    const configs = await Config.findAll({
      where: {
        key: ['traccar_url', 'traccar_token', 'traccar_enabled']
      }
    });

    const configObj = {};
    configs.forEach(config => {
      const key = config.key.replace('traccar_', '');
      configObj[key] = config.value;
    });

    return {
      url: configObj.url?.replace(/\/$/, ''), // Remove trailing slash
      token: configObj.token,
      enabled: configObj.enabled === 'true'
    };
  }

  /**
   * Testa a conexão com o Traccar
   */
  async testConnection() {
    if (!this.apiClient) {
      throw new Error('Cliente API não inicializado');
    }

    try {
      const response = await this.apiClient.get('/server');
      logger.info('Conexão com Traccar testada com sucesso');
      return {
        success: true,
        server: response.data
      };
    } catch (error) {
      logger.error('Erro ao testar conexão com Traccar:', error.message);
      throw new Error(`Falha na conexão: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Busca usuário no Traccar por email
   */
  async findUserByEmail(email) {
    if (!this.apiClient || !email) return null;

    try {
      const response = await this.apiClient.get('/users');
      const users = response.data;
      
      const user = users.find(u => 
        u.email && u.email.toLowerCase() === email.toLowerCase()
      );

      return user || null;
    } catch (error) {
      logger.error(`Erro ao buscar usuário por email ${email}:`, error.message);
      return null;
    }
  }

  /**
   * Busca usuário no Traccar por telefone
   */
  async findUserByPhone(phone) {
    if (!this.apiClient || !phone) return null;

    try {
      const response = await this.apiClient.get('/users');
      const users = response.data;
      
      // Limpa o telefone para comparação
      const cleanPhone = phone.replace(/\D/g, '');
      
      const user = users.find(u => {
        if (!u.phone) return false;
        const userCleanPhone = u.phone.replace(/\D/g, '');
        return userCleanPhone === cleanPhone || userCleanPhone.endsWith(cleanPhone.slice(-8));
      });

      return user || null;
    } catch (error) {
      logger.error(`Erro ao buscar usuário por telefone ${phone}:`, error.message);
      return null;
    }
  }

  /**
   * Busca usuário no Traccar por ID
   */
  async getUserById(userId) {
    if (!this.apiClient || !userId) return null;

    try {
      const response = await this.apiClient.get(`/users/${userId}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error(`Erro ao buscar usuário por ID ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Lista todos os usuários do Traccar
   */
  async getAllUsers() {
    if (!this.apiClient) return [];

    try {
      const response = await this.apiClient.get('/users');
      return response.data || [];
    } catch (error) {
      logger.error('Erro ao listar usuários do Traccar:', error.message);
      return [];
    }
  }

  /**
   * Bloqueia usuário no Traccar (desabilita)
   */
  async blockUser(userId, reason = null) {
    if (!this.apiClient || !userId) {
      throw new Error('Cliente API não inicializado ou ID do usuário não fornecido');
    }

    try {
      // Primeiro busca o usuário atual
      const currentUser = await this.getUserById(userId);
      if (!currentUser) {
        throw new Error('Usuário não encontrado no Traccar');
      }

      // Atualiza o usuário para disabled
      const updatedUser = {
        ...currentUser,
        disabled: true
      };

      const response = await this.apiClient.put(`/users/${userId}`, updatedUser);
      
      logger.info(`Usuário ${userId} bloqueado no Traccar. Motivo: ${reason || 'Não especificado'}`);
      
      return {
        success: true,
        user: response.data,
        reason
      };
    } catch (error) {
      logger.error(`Erro ao bloquear usuário ${userId}:`, error.message);
      throw new Error(`Falha ao bloquear usuário: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Desbloqueia usuário no Traccar (habilita)
   */
  async unblockUser(userId) {
    if (!this.apiClient || !userId) {
      throw new Error('Cliente API não inicializado ou ID do usuário não fornecido');
    }

    try {
      // Primeiro busca o usuário atual
      const currentUser = await this.getUserById(userId);
      if (!currentUser) {
        throw new Error('Usuário não encontrado no Traccar');
      }

      // Atualiza o usuário para enabled
      const updatedUser = {
        ...currentUser,
        disabled: false
      };

      const response = await this.apiClient.put(`/users/${userId}`, updatedUser);
      
      logger.info(`Usuário ${userId} desbloqueado no Traccar`);
      
      return {
        success: true,
        user: response.data
      };
    } catch (error) {
      logger.error(`Erro ao desbloquear usuário ${userId}:`, error.message);
      throw new Error(`Falha ao desbloquear usuário: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Verifica se o usuário está bloqueado no Traccar
   */
  async isUserBlocked(userId) {
    try {
      const user = await this.getUserById(userId);
      return user ? user.disabled === true : null;
    } catch (error) {
      logger.error(`Erro ao verificar status do usuário ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Sincroniza dados do usuário com o Traccar
   */
  async syncUserData(userId) {
    try {
      const user = await this.getUserById(userId);
      return user;
    } catch (error) {
      logger.error(`Erro ao sincronizar dados do usuário ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Busca dispositivos do usuário no Traccar
   */
  async getUserDevices(userId) {
    if (!this.apiClient || !userId) return [];

    try {
      const response = await this.apiClient.get('/devices', {
        params: { userId }
      });
      return response.data || [];
    } catch (error) {
      logger.error(`Erro ao buscar dispositivos do usuário ${userId}:`, error.message);
      return [];
    }
  }

  /**
   * Verifica o status do serviço
   */
  async getServiceStatus() {
    try {
      const config = await this.getTraccarConfig();
      
      if (!config.enabled) {
        return {
          status: 'disabled',
          message: 'Integração com Traccar desabilitada'
        };
      }

      if (!config.url || !config.token) {
        return {
          status: 'not_configured',
          message: 'Configuração do Traccar incompleta'
        };
      }

      if (!this.apiClient) {
        return {
          status: 'not_initialized',
          message: 'Serviço não inicializado'
        };
      }

      const testResult = await this.testConnection();
      
      return {
        status: 'active',
        message: 'Integração ativa e funcionando',
        server: testResult.server
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message
      };
    }
  }
}

module.exports = new TraccarService();