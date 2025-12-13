import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  useTheme,
} from '@mui/material';
import {
  People,
  Payment,
  Schedule,
  Warning,
  TrendingUp,
  AttachMoney,
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import { dashboardAPI } from '../services/api';
import { StatsCard } from '../components/StatsCard';
import { PaymentsChart } from '../components/PaymentsChart';
import { RecentActivities } from '../components/RecentActivities';

export const Dashboard: React.FC = () => {
  const theme = useTheme();

  const {
    data: statsData,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery('dashboard-stats', dashboardAPI.getStats, {
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const {
    data: chartData,
    isLoading: chartLoading,
  } = useQuery('payments-chart', () => dashboardAPI.getPaymentsChart('30'), {
    refetchInterval: 60000, // Refetch every minute
  });

  const {
    data: activitiesData,
    isLoading: activitiesLoading,
  } = useQuery('recent-activities', () => dashboardAPI.getRecentActivities(10), {
    refetchInterval: 30000,
  });

  if (statsLoading || chartLoading || activitiesLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (statsError) {
    return (
      <Box>
        <Typography color="error">
          Erro ao carregar dados do dashboard
        </Typography>
      </Box>
    );
  }

  const stats = statsData?.data || {};

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Dashboard
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="Total de Clientes"
            value={stats.clients?.total || 0}
            icon={<People />}
            color={theme.palette.primary.main}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="Pagamentos Pendentes"
            value={stats.payments?.pending || 0}
            icon={<Schedule />}
            color={theme.palette.warning.main}
            subtitle={`Vencem hoje: ${stats.payments?.due_today || 0}`}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="Pagamentos Vencidos"
            value={stats.payments?.overdue || 0}
            icon={<Warning />}
            color={theme.palette.error.main}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="Receita Pendente"
            value={`R$ ${(stats.revenue?.pending || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={<AttachMoney />}
            color={theme.palette.info.main}
            subtitle={`Este mês: R$ ${(stats.revenue?.total_this_month || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          />
        </Grid>
      </Grid>

      {/* Charts and Activities */}
      <Grid container spacing={3}>
        {/* Gráfico de Pagamentos - Ocupa mais espaço */}
        <Grid item xs={12} lg={9}>
          <Card sx={{ height: 400 }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" gutterBottom>
                Pagamentos dos Últimos 30 Dias
              </Typography>
              <Box sx={{ flex: 1, minHeight: 300 }}>
                <PaymentsChart data={chartData?.data || []} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Atividades Recentes - Mantém coluna lateral */}
        <Grid item xs={12} lg={3}>
          <Card sx={{ height: 400 }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" gutterBottom>
                Atividades Recentes
              </Typography>
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                <RecentActivities 
                  data={activitiesData?.data || { messages: [], automations: [] }} 
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Message Stats - Cards com mesma altura */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} sm={6}>
          <Card sx={{ height: 200 }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" gutterBottom>
                Mensagens Hoje
              </Typography>
              <Box sx={{ 
                flex: 1, 
                display: 'flex', 
                justifyContent: 'space-around', 
                alignItems: 'center',
                mt: 1 
              }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" color="success.main" fontWeight="bold">
                    {stats.messages?.sent_today || 0}
                  </Typography>
                  <Typography variant="body1" color="textSecondary" sx={{ mt: 1 }}>
                    Enviadas
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" color="error.main" fontWeight="bold">
                    {stats.messages?.failed_today || 0}
                  </Typography>
                  <Typography variant="body1" color="textSecondary" sx={{ mt: 1 }}>
                    Falharam
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Card sx={{ height: 200 }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" gutterBottom>
                Última Automação
              </Typography>
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                {stats.automation?.last_runs?.length > 0 ? (
                  <Box>
                    {stats.automation.last_runs.slice(0, 3).map((run: any, index: number) => (
                      <Box 
                        key={index} 
                        sx={{ 
                          mb: 1.5, 
                          p: 1.5, 
                          backgroundColor: 'grey.50', 
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'grey.200'
                        }}
                      >
                        <Typography variant="body2" fontWeight="bold" sx={{ mb: 0.5 }}>
                          {run.automation_type === 'warning_pending' ? 'Avisos Pendentes' :
                           run.automation_type === 'overdue_notification' ? 'Cobranças Vencidas' :
                           'Sincronização Manual'}
                        </Typography>
                        <Typography variant="caption" color="textSecondary" display="block">
                          {new Date(run.created_at).toLocaleString('pt-BR')}
                        </Typography>
                        <Typography variant="caption" color="primary.main" display="block">
                          {run.messages_sent || 0} mensagens enviadas
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    height: '100%' 
                  }}>
                    <Typography variant="body2" color="textSecondary" textAlign="center">
                      Nenhuma automação executada ainda
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};