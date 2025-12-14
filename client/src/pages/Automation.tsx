import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  PlayArrow,
  Sync,
  Schedule,
  Message,
  Warning,
  CheckCircle,
  Error,
  AutoMode,
  WhatsApp,
  Refresh,
  Send,
} from '@mui/icons-material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { automationAPI, clientsAPI } from '../services/api';
import { useSnackbar } from 'notistack';
import WebhookActionsCard from '../components/WebhookActionsCard';

export const Automation: React.FC = () => {
  const [manualMessageDialog, setManualMessageDialog] = useState(false);
  const [selectedClient, setSelectedClient] = useState('');
  const [manualMessage, setManualMessage] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  // Get automation status
  const {
    data: statusData,
    refetch: refetchStatus,
  } = useQuery(
    'automation-status',
    automationAPI.getStatus,
    { refetchInterval: 30000 }
  );

  // Get automation logs
  const {
    data: logsData,
    isLoading: logsLoading,
    refetch: refetchLogs,
  } = useQuery(
    'automation-logs',
    () => automationAPI.getLogs({ limit: 10 }),
    { refetchInterval: 10000 }
  );

  // Get clients for manual message
  const { data: clientsData } = useQuery(
    'clients-list',
    () => clientsAPI.getAll({ limit: 100 })
  );

  // Mutations
  const syncAsaasMutation = useMutation(automationAPI.syncAsaas, {
    onSuccess: () => {
      enqueueSnackbar('Sincronização iniciada com sucesso!', { variant: 'success' });
      refetchStatus();
      refetchLogs();
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.message || 'Erro ao iniciar sincronização', { variant: 'error' });
    },
  });

  const sendWarningsMutation = useMutation(automationAPI.sendWarnings, {
    onSuccess: () => {
      enqueueSnackbar('Envio de avisos iniciado!', { variant: 'success' });
      refetchStatus();
      refetchLogs();
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.message || 'Erro ao enviar avisos', { variant: 'error' });
    },
  });

  const sendOverdueMutation = useMutation(automationAPI.sendOverdue, {
    onSuccess: () => {
      enqueueSnackbar('Envio de cobranças vencidas iniciado!', { variant: 'success' });
      refetchStatus();
      refetchLogs();
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.message || 'Erro ao enviar cobranças', { variant: 'error' });
    },
  });

  const sendManualMessageMutation = useMutation(automationAPI.sendManualMessage, {
    onSuccess: () => {
      enqueueSnackbar('Mensagem enviada com sucesso!', { variant: 'success' });
      setManualMessageDialog(false);
      setManualMessage('');
      setSelectedClient('');
      setPhoneNumber('');
      queryClient.invalidateQueries('automation-messages');
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.message || 'Erro ao enviar mensagem', { variant: 'error' });
    },
  });

  const handleSendManualMessage = () => {
    if (!phoneNumber || !manualMessage) {
      enqueueSnackbar('Telefone e mensagem são obrigatórios', { variant: 'warning' });
      return;
    }

    sendManualMessageMutation.mutate({
      client_id: selectedClient,
      phone_number: phoneNumber,
      message: manualMessage,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'started':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      completed: 'Concluído',
      failed: 'Falhou',
      started: 'Em execução',
      partial: 'Parcial',
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getAutomationTypeLabel = (type: string) => {
    const labels = {
      warning_pending: 'Avisos Pendentes',
      overdue_notification: 'Cobranças Vencidas',
      manual_sync: 'Sincronização Manual',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const logsColumns: GridColDef[] = [
    {
      field: 'automation_type',
      headerName: 'Tipo',
      width: 150,
      renderCell: (params) => getAutomationTypeLabel(params.value),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={getStatusLabel(params.value)}
          color={getStatusColor(params.value)}
          size="small"
        />
      ),
    },
    {
      field: 'messages_sent',
      headerName: 'Enviadas',
      width: 100,
      renderCell: (params) => params.value || 0,
    },
    {
      field: 'messages_failed',
      headerName: 'Falharam',
      width: 100,
      renderCell: (params) => params.value || 0,
    },
    {
      field: 'started_at',
      headerName: 'Iniciado em',
      width: 160,
      renderCell: (params) => new Date(params.value).toLocaleString('pt-BR'),
    },
    {
      field: 'execution_time',
      headerName: 'Tempo (s)',
      width: 100,
      renderCell: (params) => params.value || '-',
    },
  ];

  const automationLogs = logsData?.data?.logs || [];
  const status = statusData?.data || {};

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Automação
      </Typography>

      {/* Webhook Actions Card */}
      <Box sx={{ mb: 3 }}>
        <WebhookActionsCard />
      </Box>

      {/* Control Panel and Stats */}
      <Grid container spacing={3} sx={{ mb: 3, alignItems: 'stretch' }}>
        <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
          <Card sx={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, height: '100%' }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <AutoMode sx={{ mr: 1 }} />
                Controle de Automações
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, flexGrow: 1 }}>
                <Button
                  variant="contained"
                  startIcon={syncAsaasMutation.isLoading ? <CircularProgress size={20} /> : <Sync />}
                  onClick={() => syncAsaasMutation.mutate()}
                  disabled={syncAsaasMutation.isLoading}
                  fullWidth
                  sx={{ py: 2, fontSize: '1rem' }}
                >
                  Sincronizar Asaas
                </Button>

                <Button
                  variant="contained"
                  color="warning"
                  startIcon={sendWarningsMutation.isLoading ? <CircularProgress size={20} /> : <Schedule />}
                  onClick={() => sendWarningsMutation.mutate()}
                  disabled={sendWarningsMutation.isLoading}
                  fullWidth
                  sx={{ py: 2, fontSize: '1rem' }}
                >
                  Enviar Avisos de Vencimento
                </Button>

                <Button
                  variant="contained"
                  color="error"
                  startIcon={sendOverdueMutation.isLoading ? <CircularProgress size={20} /> : <Warning />}
                  onClick={() => sendOverdueMutation.mutate()}
                  disabled={sendOverdueMutation.isLoading}
                  fullWidth
                  sx={{ py: 2, fontSize: '1rem' }}
                >
                  Enviar Cobranças Vencidas
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<WhatsApp />}
                  onClick={() => setManualMessageDialog(true)}
                  fullWidth
                  sx={{ py: 2, fontSize: '1rem', flexGrow: 1 }}
                >
                  Enviar Mensagem Manual
                </Button>

                {/* Today's Stats */}
                {status.today_stats && status.today_stats.length > 0 && (
                  <Box sx={{ mt: 'auto' }}>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
                      Estatísticas de Hoje
                    </Typography>
                    <Grid container spacing={2}>
                      {/* Mensagens Enviadas */}
                      <Grid item xs={6}>
                        <Card variant="outlined">
                          <CardContent sx={{ textAlign: 'center', py: 2 }}>
                            <Typography variant="h4" color="success.main">
                              {status.today_stats?.find((stat: any) => stat.status === 'sent')?.count || 
                               status.today_stats?.find((stat: any) => stat.status === 'completed')?.count || 
                               status.today_stats?.reduce((acc: number, stat: any) => acc + (stat.count || 0), 0) || 0}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                              Mensagens Enviadas
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>

                      {/* Mensagens Falharam */}
                      <Grid item xs={6}>
                        <Card variant="outlined">
                          <CardContent sx={{ textAlign: 'center', py: 2 }}>
                            <Typography variant="h4" color="error.main">
                              {status.today_stats?.find((stat: any) => stat.status === 'failed')?.count || 
                               status.messages_failed_today || 0}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                              Mensagens Falharam
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    </Grid>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <Schedule sx={{ mr: 1 }} />
                Status das Automações
                <Button size="small" onClick={() => refetchStatus()} sx={{ ml: 'auto' }}>
                  <Refresh />
                </Button>
              </Typography>

              {status.running_automations?.length > 0 && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Há {status.running_automations.length} automação(ões) em execução
                </Alert>
              )}

              <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                <List dense>
                  {status.last_runs?.map((run: any, index: number) => (
                    <React.Fragment key={index}>
                      <ListItem>
                        <ListItemIcon>
                          {run.status === 'completed' ? (
                            <CheckCircle color="success" />
                          ) : run.status === 'failed' ? (
                            <Error color="error" />
                          ) : (
                            <Schedule color="warning" />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={getAutomationTypeLabel(run.automation_type)}
                          secondary={`${new Date(run.created_at).toLocaleString('pt-BR')} - ${run.messages_sent || 0} mensagens`}
                        />
                      </ListItem>
                      {index < status.last_runs.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Automation Logs */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <Message sx={{ mr: 1 }} />
            Logs de Automação
            <Button size="small" onClick={() => refetchLogs()} sx={{ ml: 'auto' }}>
              <Refresh />
            </Button>
          </Typography>
          
          <DataGrid
            rows={automationLogs}
            columns={logsColumns}
            loading={logsLoading}
            autoHeight
            disableRowSelectionOnClick
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
            }}
            pageSizeOptions={[5, 10, 25]}
            sx={{ border: 'none' }}
          />
        </CardContent>
      </Card>

      {/* Manual Message Dialog */}
      <Dialog open={manualMessageDialog} onClose={() => setManualMessageDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Enviar Mensagem Manual</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Cliente (Opcional)</InputLabel>
              <Select
                value={selectedClient}
                onChange={(e) => {
                  setSelectedClient(e.target.value);
                  const client = clientsData?.data?.clients?.find((c: any) => c.id === e.target.value);
                  if (client) {
                    setPhoneNumber(client.mobile_phone || client.phone || '');
                  }
                }}
              >
                <MenuItem value="">Nenhum cliente selecionado</MenuItem>
                {clientsData?.data?.clients?.map((client: any) => (
                  <MenuItem key={client.id} value={client.id}>
                    {client.name} - {client.phone}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Número do WhatsApp"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Ex: 11999999999"
              required
            />

            <TextField
              fullWidth
              label="Mensagem"
              value={manualMessage}
              onChange={(e) => setManualMessage(e.target.value)}
              multiline
              rows={4}
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManualMessageDialog(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSendManualMessage}
            variant="contained"
            disabled={sendManualMessageMutation.isLoading}
            startIcon={sendManualMessageMutation.isLoading ? <CircularProgress size={20} /> : <Send />}
          >
            Enviar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};