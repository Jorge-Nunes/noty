import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Alert,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  Settings,
  Api,
  WhatsApp,
  Schedule,
  Save,
  Science,
  CheckCircle,
  Error,
  TrackChanges,
  Message,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { configAPI } from '../services/api';
import TraccarConfig from './TraccarConfig';
import { useSnackbar } from 'notistack';
import { useAuth } from '../contexts/AuthContext';
import { TemplatesTab } from '../components/TemplatesTab';
import { LogoUploader } from '../components/LogoUploader';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

export const Config: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [configs, setConfigs] = useState<Record<string, any>>({});
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);

  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const {
    data: configsData,
    isLoading,
    refetch,
  } = useQuery('configs', () => configAPI.getAll());

  const updateConfigMutation = useMutation(
    (data: { configs: Array<{ key: string; value: string }> }) =>
      configAPI.bulkUpdate(data.configs),
    {
      onSuccess: () => {
        enqueueSnackbar('Configurações salvas com sucesso!', { variant: 'success' });
        refetch();
      },
      onError: (error: any) => {
        enqueueSnackbar(error.response?.data?.message || 'Erro ao salvar configurações', { variant: 'error' });
      },
    }
  );

  const testAsaasMutation = useMutation(configAPI.testAsaas, {
    onSuccess: (data) => {
      setTestResults(prev => ({ ...prev, asaas: { success: true, ...data.data } }));
      enqueueSnackbar('Conexão com Asaas testada com sucesso!', { variant: 'success' });
    },
    onError: (error: any) => {
      setTestResults(prev => ({ ...prev, asaas: { success: false, error: error.response?.data } }));
      enqueueSnackbar('Falha ao testar conexão com Asaas', { variant: 'error' });
    },
  });

  const testEvolutionMutation = useMutation(configAPI.testEvolution, {
    onSuccess: (data) => {
      setTestResults(prev => ({ ...prev, evolution: { success: true, ...data.data } }));
      enqueueSnackbar('Conexão com Evolution API testada com sucesso!', { variant: 'success' });
    },
    onError: (error: any) => {
      setTestResults(prev => ({ ...prev, evolution: { success: false, error: error.response?.data } }));
      enqueueSnackbar('Falha ao testar conexão com Evolution API', { variant: 'error' });
    },
  });

  useEffect(() => {
    if (configsData?.data?.configs) {
      const configsMap: Record<string, any> = {};
      Object.keys(configsData.data.configs).forEach(category => {
        configsData.data.configs[category].forEach((config: any) => {
          configsMap[config.key] = config.value;
          // Load company logo if exists
          if (config.key === 'company_logo') {
            setCompanyLogo(config.value || null);
          }
        });
      });
      setConfigs(configsMap);
    }
  }, [configsData]);

  const handleConfigChange = (key: string, value: string) => {
    setConfigs(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = (category: string) => {
    const categoryConfigs = configsData?.data?.configs?.[category] || [];
    const updatedConfigs = categoryConfigs.map((config: any) => ({
      key: config.key,
      value: configs[config.key] || config.value,
    }));

    updateConfigMutation.mutate({ configs: updatedConfigs });
  };

  const renderConfigField = (config: any) => {
    // Ocultar campos sem descrição
    if (!config.description || !config.description.trim()) {
      return null;
    }

    const label = config.description;
    const showHelper = false;

    switch (config.type) {
      case 'boolean':
        return (
          <FormControlLabel
            key={config.key}
            control={
              <Switch
                checked={configs[config.key] === 'true'}
                onChange={(e) => handleConfigChange(config.key, e.target.checked ? 'true' : 'false')}
              />
            }
            label={label}
          />
        );
      case 'number':
        return (
          <TextField
            key={config.key}
            fullWidth
            label={label}
            type="number"
            value={configs[config.key] || ''}
            onChange={(e) => handleConfigChange(config.key, e.target.value)}
            margin="normal"
            helperText={showHelper ? `Chave: ${config.key}` : undefined}
          />
        );
      default:
        return (
          <TextField
            key={config.key}
            fullWidth
            label={label}
            type={config.key.includes('password') || config.key.includes('token') || config.key.includes('key') ? 'password' : 'text'}
            value={configs[config.key] || ''}
            onChange={(e) => handleConfigChange(config.key, e.target.value)}
            margin="normal"
            multiline={config.key.includes('message')}
            rows={config.key.includes('message') ? 4 : 1}
            helperText={showHelper ? `Chave: ${config.key}` : undefined}
          />
        );
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (user?.role === 'viewer') {
    return (
      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          Configurações
        </Typography>
        <Alert severity="warning">
          Você não tem permissão para acessar as configurações do sistema.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Configurações
      </Typography>

      <Card>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab label="Asaas API" icon={<Api />} />
          <Tab label="Evolution API" icon={<WhatsApp />} />
          <Tab label="Automação" icon={<Schedule />} />
          <Tab label="Templates" icon={<Message />} />
          <Tab label="Traccar" icon={<TrackChanges />} />
          <Tab label="Geral" icon={<Settings />} />
        </Tabs>

        {/* Asaas API Tab */}
        <TabPanel value={activeTab} index={0}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <Api sx={{ mr: 1 }} />
              Configurações do Asaas
            </Typography>

            {configsData?.data?.configs?.asaas?.map(renderConfigField)}

            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={updateConfigMutation.isLoading ? <CircularProgress size={20} /> : <Save />}
                onClick={() => handleSave('asaas')}
                disabled={updateConfigMutation.isLoading}
              >
                Salvar
              </Button>

              <Button
                variant="outlined"
                startIcon={testAsaasMutation.isLoading ? <CircularProgress size={20} /> : <Science />}
                onClick={() => testAsaasMutation.mutate()}
                disabled={testAsaasMutation.isLoading}
              >
                Testar Conexão
              </Button>
            </Box>

            {testResults.asaas && (
              <Alert
                severity={testResults.asaas.success ? 'success' : 'error'}
                sx={{ mt: 2 }}
                icon={testResults.asaas.success ? <CheckCircle /> : <Error />}
              >
                {testResults.asaas.success
                  ? 'Conexão com Asaas estabelecida com sucesso!'
                  : `Erro na conexão: ${JSON.stringify(testResults.asaas.error)}`
                }
              </Alert>
            )}
          </CardContent>
        </TabPanel>

        {/* Evolution API Tab */}
        <TabPanel value={activeTab} index={1}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <WhatsApp sx={{ mr: 1 }} />
              Configurações da Evolution API
            </Typography>

            {/* Evolution Manager */}
            <Box sx={{ my: 2 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                Antes de enviar mensagens, crie e conecte uma instância da Evolution e defina-a como padrão.
              </Alert>
              {/* @ts-ignore - component default export usage */}
              {React.createElement(require('../components/EvolutionManager').default)}
            </Box>

            {configsData?.data?.configs?.evolution?.map(renderConfigField)}

            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={updateConfigMutation.isLoading ? <CircularProgress size={20} /> : <Save />}
                onClick={() => handleSave('evolution')}
                disabled={updateConfigMutation.isLoading}
              >
                Salvar
              </Button>

              <Button
                variant="outlined"
                startIcon={testEvolutionMutation.isLoading ? <CircularProgress size={20} /> : <Science />}
                onClick={() => testEvolutionMutation.mutate()}
                disabled={testEvolutionMutation.isLoading}
              >
                Testar Conexão
              </Button>
            </Box>

            {testResults.evolution && (
              <Alert
                severity={testResults.evolution.success ? 'success' : 'error'}
                sx={{ mt: 2 }}
                icon={testResults.evolution.success ? <CheckCircle /> : <Error />}
              >
                {testResults.evolution.success
                  ? 'Conexão com Evolution API estabelecida com sucesso!'
                  : `Erro na conexão: ${JSON.stringify(testResults.evolution.error)}`
                }
              </Alert>
            )}
          </CardContent>
        </TabPanel>

        {/* Automation Tab */}
        <TabPanel value={activeTab} index={2}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <Schedule sx={{ mr: 1 }} />
              Configurações de Automação
            </Typography>

            <Alert severity="info" sx={{ mb: 2 }}>
              Configure os horários e opções para as automações diárias do sistema.
              Use formato HH:MM para os horários (24h).
            </Alert>

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Horário dos Avisos (HH:MM)"
                  type="time"
                  value={configs['automation_time_pending'] || '09:00'}
                  onChange={(e) => handleConfigChange('automation_time_pending', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  helperText="Horário para envio de avisos de vencimento"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Horário das Cobranças Vencidas (HH:MM)"
                  type="time"
                  value={configs['automation_time_overdue'] || '11:00'}
                  onChange={(e) => handleConfigChange('automation_time_overdue', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  helperText="Horário para envio de notificações de vencidos"
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            {configsData?.data?.configs?.automation?.filter((config: any) => 
              !config.key.includes('automation_hour') && 
              !config.key.includes('automation_time')
            ).map(renderConfigField)}

            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                startIcon={updateConfigMutation.isLoading ? <CircularProgress size={20} /> : <Save />}
                onClick={() => handleSave('automation')}
                disabled={updateConfigMutation.isLoading}
              >
                Salvar
              </Button>
            </Box>
          </CardContent>
        </TabPanel>

        {/* Templates Tab */}
        <TabPanel value={activeTab} index={3}>
          <CardContent>
            <TemplatesTab />
          </CardContent>
        </TabPanel>

        {/* Traccar Tab */}
        <TabPanel value={activeTab} index={4}>
          <TraccarConfig />
        </TabPanel>

        {/* General Tab */}
        <TabPanel value={activeTab} index={5}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <Settings sx={{ mr: 1 }} />
              Configurações Gerais
            </Typography>

            {/* Logo Upload Section */}
            <LogoUploader
              value={companyLogo}
              onChange={(base64) => {
                setCompanyLogo(base64);
                handleConfigChange('company_logo', base64 || '');
              }}
              maxSizeKB={500}
              disabled={updateConfigMutation.isLoading}
            />

            <Divider sx={{ my: 3 }} />

            {configsData?.data?.configs?.general?.map(renderConfigField)}

            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                startIcon={updateConfigMutation.isLoading ? <CircularProgress size={20} /> : <Save />}
                onClick={() => {
                  // Include logo in save
                  const generalConfigs = configsData?.data?.configs?.general || [];
                  const updatedConfigs = generalConfigs.map((config: any) => ({
                    key: config.key,
                    value: configs[config.key] || config.value,
                  }));

                  // Add logo config
                  updatedConfigs.push({
                    key: 'company_logo',
                    value: companyLogo || '',
                  });

                  updateConfigMutation.mutate({ configs: updatedConfigs });
                }}
                disabled={updateConfigMutation.isLoading}
              >
                Salvar
              </Button>
            </Box>
          </CardContent>
        </TabPanel>
      </Card>
    </Box>
  );
};