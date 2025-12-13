const axios = require('axios');
const { Client, Payment, Config } = require('../models');
const logger = require('../utils/logger');

class AsaasService {
  constructor() {
    this.baseURL = null;
    this.accessToken = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      const urlConfig = await Config.findOne({ where: { key: 'asaas_api_url' } });
      const tokenConfig = await Config.findOne({ where: { key: 'asaas_access_token' } });

      if (!urlConfig || !tokenConfig) {
        throw new Error('Configurações do Asaas não encontradas');
      }

      this.baseURL = urlConfig.value;
      this.accessToken = tokenConfig.value;
      this.initialized = true;
    } catch (error) {
      logger.error('AsaasService initialization error:', error);
      throw error;
    }
  }

  async makeRequest(endpoint, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const config = {
        baseURL: this.baseURL,
        url: endpoint,
        headers: {
          'access_token': this.accessToken,
          'accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 30000,
        ...options
      };

      const response = await axios(config);
      return { success: true, data: response.data };
    } catch (error) {
      logger.error(`Asaas API error on ${endpoint}:`, error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data || error.message,
        status: error.response?.status 
      };
    }
  }

  async getAllCustomers() {
    let allCustomers = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const result = await this.makeRequest('/customers', {
        method: 'GET',
        params: { limit, offset }
      });

      if (!result.success) {
        throw new Error(`Erro ao buscar clientes: ${result.error}`);
      }

      const customers = result.data.data || [];
      allCustomers = allCustomers.concat(customers);

      hasMore = result.data.hasMore;
      offset += limit;

      // Add delay to respect rate limits
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    logger.info(`Fetched ${allCustomers.length} customers from Asaas`);
    return allCustomers;
  }

  async getAllPayments(status = null) {
    let allPayments = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const params = { limit, offset };
      if (status) {
        params.status = status;
      }

      const result = await this.makeRequest('/payments', {
        method: 'GET',
        params
      });

      if (!result.success) {
        throw new Error(`Erro ao buscar pagamentos: ${result.error}`);
      }

      const payments = result.data.data || [];
      allPayments = allPayments.concat(payments);

      hasMore = result.data.hasMore;
      offset += limit;

      // Add delay to respect rate limits
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    logger.info(`Fetched ${allPayments.length} payments from Asaas (status: ${status || 'all'})`);
    return allPayments;
  }

  async syncCustomers() {
    try {
      const asaasCustomers = await this.getAllCustomers();
      let created = 0, updated = 0;

      for (const asaasCustomer of asaasCustomers) {
        const clientData = {
          asaas_id: asaasCustomer.id,
          name: asaasCustomer.name,
          email: asaasCustomer.email || null,
          phone: asaasCustomer.phone || asaasCustomer.mobilePhone,
          mobile_phone: asaasCustomer.mobilePhone,
          cpf_cnpj: asaasCustomer.cpfCnpj,
          company: asaasCustomer.company,
          address: asaasCustomer.address,
          address_number: asaasCustomer.addressNumber,
          complement: asaasCustomer.complement,
          province: asaasCustomer.province,
          city: asaasCustomer.city,
          state: asaasCustomer.state,
          postal_code: asaasCustomer.postalCode,
          observations: asaasCustomer.observations,
          last_sync: new Date()
        };

        const [client, wasCreated] = await Client.upsert(clientData, {
          conflictFields: ['asaas_id']
        });

        if (wasCreated) {
          created++;
        } else {
          updated++;
        }
      }

      logger.info(`Customers sync completed: ${created} created, ${updated} updated`);
      return { created, updated, total: asaasCustomers.length };

    } catch (error) {
      logger.error('Customer sync error:', error);
      throw error;
    }
  }

  async syncPayments(status = null) {
    try {
      const asaasPayments = await this.getAllPayments(status);
      let created = 0, updated = 0, clientNotFound = 0;

      for (const asaasPayment of asaasPayments) {
        // Find client by Asaas ID
        const client = await Client.findOne({
          where: { asaas_id: asaasPayment.customer }
        });

        if (!client) {
          clientNotFound++;
          logger.warn(`Client not found for payment ${asaasPayment.id}, customer: ${asaasPayment.customer}`);
          continue;
        }

        const paymentData = {
          asaas_id: asaasPayment.id,
          client_id: client.id,
          invoice_url: asaasPayment.invoiceUrl,
          bank_slip_url: asaasPayment.bankSlipUrl,
          value: parseFloat(asaasPayment.value),
          net_value: parseFloat(asaasPayment.netValue || asaasPayment.value),
          original_value: parseFloat(asaasPayment.originalValue || asaasPayment.value),
          interest_value: parseFloat(asaasPayment.interestValue || 0),
          description: asaasPayment.description,
          billing_type: asaasPayment.billingType || 'BOLETO',
          status: asaasPayment.status || 'PENDING',
          due_date: asaasPayment.dueDate,
          original_due_date: asaasPayment.originalDueDate,
          payment_date: asaasPayment.paymentDate,
          client_payment_date: asaasPayment.clientPaymentDate,
          installment: asaasPayment.installment || 1,
          external_reference: asaasPayment.externalReference,
          notification_disabled: asaasPayment.notificationDisabled || false,
          authorized_only: asaasPayment.authorizedOnly || false,
          last_sync: new Date()
        };

        const [payment, wasCreated] = await Payment.upsert(paymentData, {
          conflictFields: ['asaas_id']
        });

        if (wasCreated) {
          created++;
        } else {
          updated++;
        }
      }

      logger.info(`Payments sync completed: ${created} created, ${updated} updated, ${clientNotFound} clients not found`);
      return { created, updated, total: asaasPayments.length, clientNotFound };

    } catch (error) {
      logger.error('Payments sync error:', error);
      throw error;
    }
  }

  async syncAllData() {
    try {
      logger.info('Starting full Asaas sync...');

      // Sync customers first
      const customersResult = await this.syncCustomers();

      // Sync pending payments
      const pendingPaymentsResult = await this.syncPayments('PENDING');

      // Sync overdue payments
      const overduePaymentsResult = await this.syncPayments('OVERDUE');

      // Sync received payments (last 30 days)
      const receivedPaymentsResult = await this.syncPayments('RECEIVED');

      const summary = {
        customers: customersResult,
        pending_payments: pendingPaymentsResult,
        overdue_payments: overduePaymentsResult,
        received_payments: receivedPaymentsResult,
        clientsCount: customersResult.total,
        paymentsCount: pendingPaymentsResult.total + overduePaymentsResult.total + receivedPaymentsResult.total
      };

      logger.info('Full Asaas sync completed:', summary);
      return summary;

    } catch (error) {
      logger.error('Full sync error:', error);
      throw error;
    }
  }

  async getCustomerById(asaasCustomerId) {
    const result = await this.makeRequest(`/customers/${asaasCustomerId}`, {
      method: 'GET'
    });

    if (result.success) {
      return result.data;
    } else {
      throw new Error(`Erro ao buscar cliente ${asaasCustomerId}: ${result.error}`);
    }
  }

  async getPaymentById(asaasPaymentId) {
    const result = await this.makeRequest(`/payments/${asaasPaymentId}`, {
      method: 'GET'
    });

    if (result.success) {
      return result.data;
    } else {
      throw new Error(`Erro ao buscar pagamento ${asaasPaymentId}: ${result.error}`);
    }
  }
}

module.exports = new AsaasService();