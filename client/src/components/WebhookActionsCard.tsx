import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  FormControl,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Webhook,
  TrendingUp,
  Message,
  CheckCircle,
  AccessTime,
  Payment,
  Verified,
  Warning,
  Create,
  Update,
  Delete,
  Visibility,
  ErrorOutline,
} from '@mui/icons-material';
import { webhooksAPI } from '../services/api';
import { StatsCard } from './StatsCard';

interface WebhookStats {
  period: string;
  totalWebhooks: number;
  successfulWebhooks: number;
  successRate: string;
  messagesSent: number;
  uniqueClients: number;
  lastActivity: any;
  eventBreakdown: any[];
}

interface WebhookActivity {
  id: string;
  event_type: string;
  client_name: string;
  payment_value: number;
  status: string;
  message_sent: boolean;
  timeAgo: string;
  created_at: string;
}

const WebhookActionsCard: React.FC = () => {
  const [period, setPeriod] = useState('24h');
  const [showActivities, setShowActivities] = useState(false);

  const {
    data: statsData,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats
  } = useQuery(['webhook-stats', period], () => webhooksAPI.stats(period), {
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 5000, // Data considered fresh for 5 seconds
    cacheTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  const {
    data: activitiesData,
    isLoading: activitiesLoading,
    error: activitiesError
  } = useQuery(['webhook-activities'], () => webhooksAPI.activities(20), {
    staleTime: 5000, // Data considered fresh for 5 seconds
    cacheTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  const stats: WebhookStats | undefined = statsData?.data;
  const activities: WebhookActivity[] = activitiesData?.data?.activities || [];
  
  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'PAYMENT_RECEIVED':
        return <Payment color="success" />;
      case 'PAYMENT_CONFIRMED':
        return <Verified color="primary" />;
      case 'PAYMENT_OVERDUE':
        return <Warning color="error" />;
      case 'PAYMENT_CREATED':
        return <Create color="info" />;
      case 'PAYMENT_UPDATED':
        return <Update color="warning" />;
      case 'PAYMENT_DELETED':
        return <Delete color="error" />;
      default:
        return <Webhook />;
    }
  };

  const getEventColor = (eventType: string, status: string) => {
    if (status === 'error') return 'error';
    
    switch (eventType) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        return 'success';
      case 'PAYMENT_OVERDUE':
        return 'error';
      case 'PAYMENT_CREATED':
        return 'info';
      case 'PAYMENT_UPDATED':
        return 'warning';
      case 'PAYMENT_DELETED':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatEventName = (eventType: string) => {
    const names: Record<string, string> = {
      'PAYMENT_RECEIVED': 'Pagamento Recebido',
      'PAYMENT_CONFIRMED': 'Pagamento Confirmado',
      'PAYMENT_OVERDUE': 'Pagamento Vencido',
      'PAYMENT_CREATED': 'Pagamento Criado',
      'PAYMENT_UPDATED': 'Pagamento Atualizado',
      'PAYMENT_DELETED': 'Pagamento Cancelado'
    };
    return names[eventType] || eventType;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (statsError || activitiesError) {
    return (
      <Card sx={{ p: 3 }}>
        <Alert severity="error">
          Erro ao carregar dados do webhook. Tente novamente.
        </Alert>
      </Card>
    );
  }

  return (
    <>
      <Card sx={{ p: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center">
              <Webhook sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6">
                Webhook do Asaas
              </Typography>
            </Box>
            
            <Box display="flex" alignItems="center" gap={2}>
              <Chip 
                label={stats ? "Online" : "Carregando..."} 
                color={stats ? "success" : "default"}
                size="small" 
              />
              
              <FormControl size="small">
                <Select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  sx={{ minWidth: 80 }}
                >
                  <MenuItem value="24h">24h</MenuItem>
                  <MenuItem value="7d">7d</MenuItem>
                  <MenuItem value="30d">30d</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>

          {statsLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : stats ? (
            <>
              {/* Estatísticas Gerais */}
              <Grid container spacing={2} mb={3}>
                <Grid item xs={6} sm={3}>
                  <StatsCard
                    title="Webhooks"
                    value={stats.totalWebhooks}
                    icon={<TrendingUp />}
                    color="#1976d2"
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatsCard
                    title="Mensagens"
                    value={stats.messagesSent}
                    icon={<Message />}
                    color="#2e7d32"
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatsCard
                    title="Taxa Sucesso"
                    value={stats.successRate}
                    icon={<CheckCircle />}
                    color="#0288d1"
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatsCard
                    title="Clientes"
                    value={stats.uniqueClients}
                    icon={<AccessTime />}
                    color="#ed6c02"
                  />
                </Grid>
              </Grid>

              {/* Eventos por Tipo */}
              <Typography variant="subtitle2" gutterBottom>
                Eventos - {period === '24h' ? 'Últimas 24h' : period === '7d' ? 'Últimos 7 dias' : 'Últimos 30 dias'}
              </Typography>
              
              <List dense>
                {stats.eventBreakdown.map((event: any, index: number) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      {getEventIcon(event.event_type)}
                    </ListItemIcon>
                    <ListItemText 
                      primary={formatEventName(event.event_type)}
                      secondary={`${event.count} eventos - ${event.messages_sent} mensagens enviadas`}
                    />
                    <Chip 
                      label={event.count} 
                      size="small" 
                      color={getEventColor(event.event_type, 'success')} 
                    />
                  </ListItem>
                ))}
                
                {stats.eventBreakdown.length === 0 && (
                  <ListItem>
                    <ListItemText 
                      primary="Nenhum evento registrado"
                      secondary="Não há atividade de webhook no período selecionado"
                    />
                  </ListItem>
                )}
              </List>

              {/* Última Atividade */}
              {stats.lastActivity && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Última Atividade
                    </Typography>
                    <Box sx={{ 
                      p: 2, 
                      backgroundColor: 'grey.50', 
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <Box display="flex" alignItems="center">
                        {getEventIcon(stats.lastActivity.event_type)}
                        <Box ml={1}>
                          <Typography variant="body2" fontWeight="bold">
                            {formatEventName(stats.lastActivity.event_type)}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {stats.lastActivity.client_name}
                          </Typography>
                        </Box>
                      </Box>
                      <Typography variant="caption" color="textSecondary">
                        {new Date(stats.lastActivity.created_at).toLocaleString('pt-BR')}
                      </Typography>
                    </Box>
                  </Box>
                </>
              )}

              {/* Botão Ver Atividades */}
              <Box mt={3} textAlign="center">
                <Button 
                  variant="outlined" 
                  startIcon={<Visibility />}
                  onClick={() => setShowActivities(true)}
                  disabled={activitiesLoading}
                >
                  Ver Todas as Atividades
                </Button>
              </Box>
            </>
          ) : (
            <Alert severity="info">
              Nenhum dado disponível para o período selecionado.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Atividades */}
      <Dialog 
        open={showActivities} 
        onClose={() => setShowActivities(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <Webhook sx={{ mr: 1 }} />
            Atividades Recentes do Webhook
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {activitiesLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : (
            <List>
              {activities.map((activity, index) => (
                <Box key={activity.id}>
                  <ListItem alignItems="flex-start">
                    <ListItemIcon>
                      <Box 
                        sx={{ 
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          backgroundColor: `${getEventColor(activity.event_type, activity.status)}.light`
                        }}
                      >
                        {activity.status === 'error' ? (
                          <ErrorOutline fontSize="small" />
                        ) : (
                          getEventIcon(activity.event_type)
                        )}
                      </Box>
                    </ListItemIcon>
                    
                    <ListItemText
                      primary={
                        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                          <Box>
                            <Typography variant="subtitle2" fontWeight="bold">
                              {formatEventName(activity.event_type)}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                              {activity.client_name}
                              {activity.payment_value && ` - ${formatCurrency(activity.payment_value)}`}
                            </Typography>
                            <Box display="flex" gap={1} mt={0.5}>
                              <Chip 
                                label={activity.status === 'success' ? 'Sucesso' : 'Erro'} 
                                size="small"
                                color={activity.status === 'success' ? 'success' : 'error'}
                              />
                              {activity.message_sent && (
                                <Chip 
                                  label="Mensagem Enviada" 
                                  size="small"
                                  color="info"
                                />
                              )}
                            </Box>
                          </Box>
                          <Typography variant="caption" color="textSecondary">
                            {activity.timeAgo}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < activities.length - 1 && <Divider />}
                </Box>
              ))}
              
              {activities.length === 0 && (
                <ListItem>
                  <ListItemText 
                    primary="Nenhuma atividade encontrada"
                    secondary="Não há atividades de webhook para exibir"
                  />
                </ListItem>
              )}
            </List>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowActivities(false)}>
            Fechar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default WebhookActionsCard;