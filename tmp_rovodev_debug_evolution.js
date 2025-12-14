// Script para testar endpoints da Evolution API
// Execute: node tmp_rovodev_debug_evolution.js

const axios = require('axios');
require('dotenv').config();

async function testEvolutionEndpoints() {
  const baseURL = process.env.EVOLUTION_MANAGER_API_URL;
  const apiKey = process.env.EVOLUTION_MANAGER_API_KEY;
  
  if (!baseURL || !apiKey) {
    console.log('❌ EVOLUTION_MANAGER_API_URL ou EVOLUTION_MANAGER_API_KEY não configurados');
    return;
  }
  
  const client = axios.create({
    baseURL: baseURL.replace(/\/+$/, ''),
    headers: { apikey: apiKey },
    timeout: 10000
  });
  
  console.log(`🔍 Testando Evolution API: ${baseURL}`);
  console.log(`🔑 Com API Key: ${apiKey.substring(0, 10)}...`);
  
  // Test 1: List instances
  try {
    console.log('\n📋 Testando listagem de instâncias...');
    const response = await client.get('/instance/fetchInstances');
    const instances = response.data || [];
    console.log(`✅ Encontradas ${instances.length} instâncias:`);
    instances.forEach(inst => {
      const name = inst?.instance?.instanceName || inst?.instanceName || inst?.name;
      const state = inst?.instance?.state || inst?.state || 'unknown';
      console.log(`   - ${name} (${state})`);
    });
    
    // Test restart on first instance if any
    if (instances.length > 0) {
      const firstInstance = instances[0]?.instance?.instanceName || instances[0]?.instanceName || instances[0]?.name;
      console.log(`\n🔄 Testando restart na instância: ${firstInstance}`);
      
      try {
        const restartResponse = await client.put(`/instance/restart/${firstInstance}`);
        console.log(`✅ Restart funcionou!`, restartResponse.data);
      } catch (restartError) {
        console.log(`❌ Restart falhou:`, {
          status: restartError.response?.status,
          message: restartError.response?.data?.message,
          url: `/instance/restart/${firstInstance}`
        });
      }
    }
    
  } catch (error) {
    console.log(`❌ Erro na listagem:`, {
      status: error.response?.status,
      message: error.response?.data?.message || error.message
    });
  }
}

testEvolutionEndpoints();