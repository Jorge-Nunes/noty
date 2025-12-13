import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Grid,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Security as SecurityIcon,
  Link as LinkIcon,
  PersonAdd as PersonAddIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import { traccarAPI } from '../services/api';

interface TraccarConfig {
  traccar_url: string;
  traccar_token: string;
  traccar_token_display?: string;
  traccar_enabled: boolean;
  auto_block_enabled: boolean;
  block_after_count: number;
  unblock_on_payment: boolean;
  traccar_notifications_enabled: boolean;
  whitelist_clients: string[];
}

interface ServiceStatus {
  status: string;
  message: string;
  server?: any;
}

interface SyncResult {
  total: number;
  mapped: number;
  unmapped: number;
  errors: number;
}

const TraccarConfig: React.FC = () => {
  const [config, setConfig] = useState<TraccarConfig>({
    traccar_url: '',
    traccar_token: '',
    traccar_enabled: false,
    auto_block_enabled: true,
    block_after_count: 3,
    unblock_on_payment: true,
    traccar_notifications_enabled: true,
    whitelist_clients: []
  });

  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    loadConfig();
    loadServiceStatus();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await traccarAPI.getConfig();
      if (response.success && response.config) {
        setConfig(response.config);
      }
    } catch (error: any) {
      console.error('Erro ao carregar configuração:', error);
      setMessage({
        type: 'error',
        text: 'Erro ao carregar configurações'
      });
    }
  };

  const loadServiceStatus = async () => {
    try {
      const response = await traccarAPI.getStatus();
      if (response.success && response.service) {
        setServiceStatus(response.service);
      }
    } catch (error: any) {
      console.error('Erro ao carregar status:', error);
    }
  };

  const handleSaveConfig = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const configToSave = {
        traccar_url: config.traccar_url,
        traccar_token: config.traccar_token,
        traccar_enabled: config.traccar_enabled,
        rules: {
          auto_block_enabled: config.auto_block_enabled,
          block_after_count: config.block_after_count,
          unblock_on_payment: config.unblock_on_payment,
          whitelist_clients: config.whitelist_clients,
          traccar_notifications_enabled: config.traccar_notifications_enabled
        }
      };

      const response = await traccarAPI.saveConfig(configToSave);
      
      if (response.success) {
        setMessage({
          type: 'success',
          text: 'Configurações salvas com sucesso!'
        });
        
        // Atualiza o display do token
        if (config.traccar_token) {
          const token = config.traccar_token;
          setConfig(prev => ({
            ...prev,
            traccar_token_display: token.length > 10 
              ? `${token.slice(0, 4)}...${token.slice(-4)}`
              : '****'
          }));
        }

        await loadServiceStatus();
      } else {
        setMessage({
          type: 'error',
          text: response.message || 'Erro ao salvar configurações'
        });
      }
    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Erro ao salvar configurações'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setMessage(null);

    try {
      const response = await traccarAPI.testConnection();
      
      if (response.success) {
        setMessage({
          type: 'success',
          text: 'Conexão estabelecida com sucesso!'
        });
        await loadServiceStatus();
      } else {
        setMessage({
          type: 'error',
          text: response.message || 'Falha na conexão'
        });
      }
    } catch (error: any) {
      console.error('Erro ao testar conexão:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Erro ao testar conexão'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSyncClients = async () => {
    setSyncing(true);
    setMessage(null);

    try {
      const response = await traccarAPI.syncClients();
      
      if (response.success && response.summary) {
        setSyncResult(response.summary);
        setMessage({
          type: 'success',
          text: 'Sincronização concluída com sucesso!'
        });
      } else {
        setMessage({
          type: 'error',
          text: response.message || 'Erro na sincronização'
        });
      }
    } catch (error: any) {
      console.error('Erro na sincronização:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Erro na sincronização'
      });
    } finally {
      setSyncing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircleIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'not_configured':
      case 'not_initialized':
        return <WarningIcon color="warning" />;
      case 'disabled':
        return <InfoIcon color="info" />;
      default:
        return <InfoIcon />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'error':
        return 'error';
      case 'not_configured':
      case 'not_initialized':
        return 'warning';
      case 'disabled':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        <SettingsIcon sx={{ mr: 2 }} />
        Configuração Traccar
      </Typography>
      
      <Typography variant="subtitle1" color="textSecondary" gutterBottom>
        Configure a integração com o sistema Traccar para automação de bloqueio/desbloqueio de usuários
      </Typography>

      {message && (
        <Alert 
          severity={message.type} 
          onClose={() => setMessage(null)}
          sx={{ mb: 3 }}
        >
          {message.text}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Status da Integração */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <AssessmentIcon sx={{ mr: 1 }} />
                Status da Integração
              </Typography>
              
              {serviceStatus && (
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  {getStatusIcon(serviceStatus.status)}
                  <Chip 
                    label={serviceStatus.message}
                    color={getStatusColor(serviceStatus.status) as any}
                    variant="outlined"
                  />
                </Box>
              )}

              {syncResult && (
                <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Última Sincronização:
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={3}>
                      <Typography variant="body2" color="textSecondary">Total</Typography>
                      <Typography variant="h6">{syncResult.total}</Typography>
                    </Grid>
                    <Grid item xs={3}>
                      <Typography variant="body2" color="textSecondary">Mapeados</Typography>
                      <Typography variant="h6" color="success.main">{syncResult.mapped}</Typography>
                    </Grid>
                    <Grid item xs={3}>
                      <Typography variant="body2" color="textSecondary">Não Mapeados</Typography>
                      <Typography variant="h6" color="warning.main">{syncResult.unmapped}</Typography>
                    </Grid>
                    <Grid item xs={3}>
                      <Typography variant="body2" color="textSecondary">Erros</Typography>
                      <Typography variant="h6" color="error.main">{syncResult.errors}</Typography>
                    </Grid>
                  </Grid>
                </Paper>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Configurações de Conexão */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <LinkIcon sx={{ mr: 1 }} />
                Configurações de Conexão
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="URL do Servidor Traccar"
                    placeholder="https://seu-servidor.traccar.org"
                    value={config.traccar_url}
                    onChange={(e) => setConfig({ ...config, traccar_url: e.target.value })}
                    helperText="URL completa do seu servidor Traccar (incluindo https://)"
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Token de API"
                    type="password"
                    placeholder="Seu token de autenticação"
                    value={config.traccar_token}
                    onChange={(e) => setConfig({ ...config, traccar_token: e.target.value })}
                    helperText="Token de API gerado no Traccar (Configurações > Tokens)"
                  />
                  {config.traccar_token_display && (
                    <Typography variant="caption" color="textSecondary">
                      Token atual: {config.traccar_token_display}
                    </Typography>
                  )}
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.traccar_enabled}
                        onChange={(e) => setConfig({ ...config, traccar_enabled: e.target.checked })}
                      />
                    }
                    label="Habilitar Integração com Traccar"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Box display="flex" gap={2}>
                    <Button
                      variant="contained"
                      onClick={handleSaveConfig}
                      disabled={loading || !config.traccar_url || !config.traccar_token}
                      startIcon={loading ? <CircularProgress size={20} /> : <SettingsIcon />}
                    >
                      {loading ? 'Salvando...' : 'Salvar Configurações'}
                    </Button>

                    <Button
                      variant="outlined"
                      onClick={handleTestConnection}
                      disabled={testingConnection || !config.traccar_url || !config.traccar_token}
                      startIcon={testingConnection ? <CircularProgress size={20} /> : <RefreshIcon />}
                    >
                      {testingConnection ? 'Testando...' : 'Testar Conexão'}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Ações Rápidas */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <PersonAddIcon sx={{ mr: 1 }} />
                Ações Rápidas
              </Typography>

              <List disablePadding>
                <ListItem disablePadding>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={handleSyncClients}
                    disabled={syncing || serviceStatus?.status !== 'active'}
                    startIcon={syncing ? <CircularProgress size={20} /> : <RefreshIcon />}
                    sx={{ mb: 1 }}
                  >
                    {syncing ? 'Sincronizando...' : 'Sincronizar Clientes'}
                  </Button>
                </ListItem>

                <ListItem disablePadding>
                  <Button
                    fullWidth
                    variant="text"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                  >
                    {showAdvanced ? 'Ocultar' : 'Mostrar'} Configurações Avançadas
                  </Button>
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Configurações Avançadas */}
        {showAdvanced && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <SecurityIcon sx={{ mr: 1 }} />
                  Regras de Bloqueio Automático
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={config.auto_block_enabled}
                          onChange={(e) => setConfig({ ...config, auto_block_enabled: e.target.checked })}
                        />
                      }
                      label="Habilitar Bloqueio Automático"
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Quantidade de Cobranças em Atraso"
                      value={config.block_after_count}
                      onChange={(e) => setConfig({ ...config, block_after_count: parseInt(e.target.value) || 0 })}
                      helperText="Bloquear automaticamente após X cobranças em atraso (independente de valor ou tempo)"
                      disabled={!config.auto_block_enabled}
                      inputProps={{ min: 1, max: 20 }}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                      <Typography variant="body2" color="info.dark">
                        📋 <strong>Lógica Simplificada</strong><br />
                        O bloqueio será acionado automaticamente quando o cliente tiver <strong>{config.block_after_count || 3} ou mais faturas em atraso</strong>, independentemente do valor ou tempo de vencimento.
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={config.unblock_on_payment}
                          onChange={(e) => setConfig({ ...config, unblock_on_payment: e.target.checked })}
                          disabled={!config.auto_block_enabled}
                        />
                      }
                      label="Desbloquear Automaticamente ao Receber Pagamento"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle1" gutterBottom>
                      📱 Notificações WhatsApp
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={config.traccar_notifications_enabled}
                          onChange={(e) => setConfig({ ...config, traccar_notifications_enabled: e.target.checked })}
                        />
                      }
                      label="Enviar Notificações de Bloqueio/Desbloqueio via WhatsApp"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default TraccarConfig;