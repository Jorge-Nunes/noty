import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, Dialog, DialogContent, DialogTitle, Grid, IconButton, List, ListItem, ListItemSecondaryAction, ListItemText, TextField, Tooltip, Typography, Alert, CircularProgress } from '@mui/material';
import { Add, Delete, QrCode, PlayArrow, RestartAlt, Logout, Star, StarBorder, CheckCircle, Cancel, Help, Key, ContentCopy } from '@mui/icons-material';
import { useMutation, useQuery } from 'react-query';
import { configAPI, evolutionAPI } from '../services/api';
import { useSnackbar } from 'notistack';

export const EvolutionManager: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [newName, setNewName] = useState('');
  const [qrOpen, setQrOpen] = useState(false);
  const [qrData, setQrData] = useState<any>(null);
  const [defaultInstance, setDefaultInstance] = useState<string | null>(null);

  const instancesQuery = useQuery(['evolution.instances'], evolutionAPI.listInstances);
  const configsQuery = useQuery(['config.evolution_instance'], () => configAPI.getByKey('evolution_instance'));

  useEffect(() => {
    const val = configsQuery.data?.data?.config?.value;
    if (val) setDefaultInstance(val);
  }, [configsQuery.data]);

  const instances = useMemo(() => (instancesQuery.data?.data?.instances || []), [instancesQuery.data]);

  const createMutation = useMutation<any, any, void>(
    () => evolutionAPI.createInstance(newName.trim()),
    {
      onSuccess: () => {
        enqueueSnackbar('Instância criada', { variant: 'success' });
        setNewName('');
        instancesQuery.refetch();
      },
      onError: (e: any) => {
        const attempts = e?.response?.data?.attempts;
        console.error('Erro ao criar instância Evolution:', attempts || e?.response?.data || e);
        const detail = attempts ? ` Detalhes: ${JSON.stringify(attempts).slice(0, 600)}` : '';
        enqueueSnackbar((e.response?.data?.message || 'Erro ao criar instância') + detail, { variant: 'error' });
      },
    }
  );

  const deleteMutation = useMutation<any, any, string>(
    (name: string) => evolutionAPI.deleteInstance(name),
    {
      onSuccess: () => { enqueueSnackbar('Instância removida', { variant: 'success' }); instancesQuery.refetch(); },
      onError: (e: any) => { enqueueSnackbar(e.response?.data?.message || 'Erro ao remover instância', { variant: 'error' }); },
    }
  );

  const actionMutation = useMutation<any, any, { name: string; action: 'start' | 'restart' | 'logout' | 'stop' }>(
    ({ name, action }) => evolutionAPI.action(name, action),
    {
      onSuccess: () => { enqueueSnackbar('Ação executada', { variant: 'success' }); instancesQuery.refetch(); },
      onError: (e: any) => {
        console.error('Action error:', e.response?.data || e);
        enqueueSnackbar(
          `${e.response?.data?.message || 'Erro ao executar ação'}. Detalhes: ${JSON.stringify(e.response?.data?.error || e.message).slice(0, 200)}`, 
          { variant: 'error' }
        );
      },
    }
  );

  const setDefaultMutation = useMutation<any, any, string>(
    (name: string) => evolutionAPI.setDefault(name),
    {
      onSuccess: (_data, variables) => {
        enqueueSnackbar('Instância padrão atualizada', { variant: 'success' });
        setDefaultInstance(variables);
        configsQuery.refetch();
      },
      onError: (e: any) => { enqueueSnackbar(e.response?.data?.message || 'Erro ao definir instância padrão', { variant: 'error' }); },
    }
  );

  const openQr = async (name: string) => {
    try {
      setQrOpen(true);
      setQrData({ loading: true });
      const response = await evolutionAPI.getQr(name);
      console.log('QR Response:', response); // Debug
      setQrData(response?.data);
    } catch (e: any) {
      console.error('QR Error:', e.response?.data || e); // Debug
      enqueueSnackbar(
        `Erro ao obter QRCode: ${e.response?.data?.message || e.message}. Verifique se a instância está desconectada.`, 
        { variant: 'error' }
      );
      setQrOpen(false);
    }
  };

  const getStatusInfo = (state: string) => {
    const normalizedState = state?.toLowerCase() || '';
    
    // Evolution API status mapping
    if (normalizedState === 'open' || normalizedState.includes('connected')) {
      return { icon: <CheckCircle sx={{ color: 'success.main' }} />, color: 'success.main', label: 'Conectado' };
    } else if (normalizedState === 'close' || normalizedState.includes('disconnect') || normalizedState.includes('closed')) {
      return { icon: <Cancel sx={{ color: 'error.main' }} />, color: 'error.main', label: 'Desconectado' };
    } else if (normalizedState === 'connecting' || normalizedState.includes('pairing')) {
      return { icon: <Help sx={{ color: 'info.main' }} />, color: 'info.main', label: 'Conectando' };
    } else {
      return { icon: <Help sx={{ color: 'warning.main' }} />, color: 'warning.main', label: `Desconhecido (${state})` };
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      enqueueSnackbar(`${label} copiada para a área de transferência!`, { variant: 'success' });
    }).catch(() => {
      enqueueSnackbar(`Erro ao copiar ${label}`, { variant: 'error' });
    });
  };

  const renderInstanceItem = (inst: any) => {
    // Evolution API fetchInstances response structure
    const name = inst?.instance?.instanceName || inst?.instanceName || inst?.name;
    const isDefault = defaultInstance === name;
    
    // Try multiple possible state fields from Evolution API
    const state = inst?.instance?.state || 
                  inst?.state || 
                  inst?.status || 
                  inst?.instance?.status ||
                  inst?.connectionStatus ||
                  inst?.instance?.connectionStatus ||
                  'Desconhecido';
    
    const integration = inst?.instance?.integration || inst?.integration || '';
    const apikey = inst?.instance?.token || inst?.token || inst?.apikey || inst?.instance?.apikey || 'N/A';
    const statusInfo = getStatusInfo(state);
    
    return (
      <ListItem key={name} divider>
        <ListItemText
          primary={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {statusInfo.icon}
              <span>{name}</span>
              {isDefault && <Star sx={{ color: 'warning.main', fontSize: 20 }} />}
            </div>
          }
          secondary={
            <div>
              <div style={{ color: statusInfo.color, fontWeight: 'bold' }}>
                Estado: {statusInfo.label} ({state})
              </div>
              {integration && <div>Integração: {integration}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <Key sx={{ fontSize: 16, color: 'text.secondary' }} />
                <span style={{ fontFamily: 'monospace', fontSize: '0.85em', background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>
                  {apikey !== 'N/A' ? `${apikey.substring(0, 20)}...` : 'API Key não disponível'}
                </span>
                {apikey !== 'N/A' && (
                  <Tooltip title="Copiar API Key completa">
                    <IconButton size="small" onClick={() => copyToClipboard(apikey, 'API Key')}>
                      <ContentCopy sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </div>
            </div>
          }
        />
        <ListItemSecondaryAction>
          <Tooltip title={isDefault ? 'Instância padrão' : 'Definir como padrão'}>
            <span>
              <IconButton onClick={() => setDefaultMutation.mutate(name)} disabled={setDefaultMutation.isLoading}>
                {isDefault ? <Star color="warning" /> : <StarBorder />}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Mostrar QRCode">
            <span>
              <IconButton onClick={() => openQr(name)}>
                <QrCode />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Reiniciar">
            <span>
              <IconButton onClick={() => actionMutation.mutate({ name, action: 'restart' })} disabled={actionMutation.isLoading}>
                <RestartAlt />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Desconectar">
            <span>
              <IconButton onClick={() => actionMutation.mutate({ name, action: 'logout' })} disabled={actionMutation.isLoading}>
                <Logout />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Excluir">
            <span>
              <IconButton onClick={() => deleteMutation.mutate(name)} disabled={deleteMutation.isLoading}>
                <Delete />
              </IconButton>
            </span>
          </Tooltip>
        </ListItemSecondaryAction>
      </ListItem>
    );
  };

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>Evolution Manager</Typography>

        <Alert severity="info" sx={{ mb: 2 }}>
          Gerencie as instâncias da Evolution API diretamente por aqui. A aplicação usará a instância marcada como padrão para enviar mensagens.
        </Alert>

        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              label="Nome da instância"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              startIcon={createMutation.isLoading ? <CircularProgress size={18} /> : <Add />}
              onClick={() => createMutation.mutate()}
              disabled={!newName.trim() || createMutation.isLoading}
            >
              Criar instância
            </Button>
            <Button
              variant="outlined"
              onClick={() => instancesQuery.refetch()}
              disabled={instancesQuery.isLoading}
            >
              🔄 Recarregar
            </Button>
          </Grid>
        </Grid>

        <Box sx={{ mt: 3 }}>
          {instancesQuery.isLoading ? (
            <CircularProgress />
          ) : instances.length === 0 ? (
            <Alert severity="warning">Nenhuma instância encontrada. Crie uma nova acima.</Alert>
          ) : (
            <div>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1">
                  Instâncias encontradas: {instances.length}
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', fontSize: '0.8em' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                    <span>Conectado</span>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Cancel sx={{ fontSize: 16, color: 'error.main' }} />
                    <span>Desconectado</span>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Help sx={{ fontSize: 16, color: 'warning.main' }} />
                    <span>Desconhecido</span>
                  </Box>
                </Box>
              </Box>
              
              {/* Debug: show raw data structure */}
              <details style={{ marginBottom: 16, fontSize: '0.8em', opacity: 0.7 }}>
                <summary>Debug: Dados do fetchInstances (clique para ver campos de status)</summary>
                <pre>{JSON.stringify(instances, null, 2)}</pre>
                <div style={{ marginTop: 8, padding: 8, backgroundColor: '#f5f5f5' }}>
                  <strong>Possíveis campos de status que estou verificando:</strong>
                  <ul>
                    <li><strong>Estado:</strong> inst?.instance?.state, inst?.state, inst?.status, etc.</li>
                    <li><strong>API Key:</strong> inst?.instance?.token, inst?.token, inst?.apikey, inst?.instance?.apikey</li>
                    <li><strong>Nome:</strong> inst?.instance?.instanceName, inst?.instanceName, inst?.name</li>
                  </ul>
                </div>
              </details>
              
              <List>
                {instances.map(renderInstanceItem)}
              </List>
            </div>
          )}
        </Box>

        <Dialog open={qrOpen} onClose={() => setQrOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>QRCode da Instância</DialogTitle>
          <DialogContent>
            {qrData?.loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                <CircularProgress />
              </Box>
            ) : qrData ? (
              <Box sx={{ textAlign: 'center' }}>
                {/* Debug info */}
                <details style={{ marginBottom: 16, fontSize: '0.8em', textAlign: 'left' }}>
                  <summary>Debug: Dados recebidos</summary>
                  <pre>{JSON.stringify(qrData, null, 2)}</pre>
                </details>
                
                {qrData?.base64 ? (
                  <img src={qrData.base64} alt="QR Code" style={{ width: '100%', maxWidth: 320 }} />
                ) : qrData?.qrcode ? (
                  <img src={qrData.qrcode} alt="QR Code" style={{ width: '100%', maxWidth: 320 }} />
                ) : qrData?.pairingCode ? (
                  <div>
                    <Typography>Código de pareamento:</Typography>
                    <Typography variant="h4" sx={{ fontFamily: 'monospace', my: 2 }}>{qrData.pairingCode}</Typography>
                  </div>
                ) : (
                  <div>
                    <Typography>QRCode não disponível no momento.</Typography>
                    <Typography variant="caption" color="text.secondary">
                      A instância pode já estar conectada. Tente fazer logout primeiro.
                    </Typography>
                  </div>
                )}
              </Box>
            ) : (
              <Typography>Sem dados do QRCode.</Typography>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default EvolutionManager;
