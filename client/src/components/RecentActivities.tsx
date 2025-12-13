import React from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  Chip,
  Avatar,
} from '@mui/material';
import {
  Message,
  AutoMode,
  CheckCircle,
  Error,
  Schedule,
  Person,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MessageActivity {
  id: string;
  message_type: 'warning' | 'due_today' | 'overdue' | 'manual';
  status: 'sent' | 'failed' | 'pending';
  client: {
    name: string;
    phone: string;
  };
  payment?: {
    value: number;
    due_date: string;
  };
  created_at: string;
}

interface AutomationActivity {
  id: string;
  automation_type: 'warning_pending' | 'overdue_notification' | 'manual_sync';
  status: 'completed' | 'failed' | 'started';
  messages_sent: number;
  created_at: string;
}

interface RecentActivitiesProps {
  data: {
    messages: MessageActivity[];
    automations: AutomationActivity[];
  };
}

export const RecentActivities: React.FC<RecentActivitiesProps> = ({ data }) => {
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM HH:mm', { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const getMessageTypeLabel = (type: string) => {
    const labels = {
      warning: 'Aviso',
      due_today: 'Vence Hoje',
      overdue: 'Vencido',
      manual: 'Manual',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getAutomationTypeLabel = (type: string) => {
    const labels = {
      warning_pending: 'Avisos Pendentes',
      overdue_notification: 'Cobranças Vencidas',
      manual_sync: 'Sincronização Manual',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
      case 'completed':
        return 'success';
      case 'failed':
      case 'error':
        return 'error';
      case 'pending':
      case 'started':
        return 'warning';
      default:
        return 'default';
    }
  };

  // Combine and sort activities by date
  const allActivities = [
    ...data.messages.map(msg => ({
      ...msg,
      type: 'message' as const,
      title: `Mensagem para ${msg.client.name}`,
      subtitle: getMessageTypeLabel(msg.message_type),
    })),
    ...data.automations.map(auto => ({
      ...auto,
      type: 'automation' as const,
      title: getAutomationTypeLabel(auto.automation_type),
      subtitle: `${auto.messages_sent || 0} mensagens`,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (allActivities.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography color="textSecondary">
          Nenhuma atividade recente
        </Typography>
      </Box>
    );
  }

  return (
    <List sx={{ py: 0 }}>
      {allActivities.slice(0, 10).map((activity, index) => (
        <ListItem key={`${activity.type}-${activity.id}-${index}`} sx={{ px: 0 }}>
          <ListItemIcon>
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: activity.type === 'message' ? 'primary.main' : 'secondary.main',
              }}
            >
              {activity.type === 'message' ? (
                <Message fontSize="small" />
              ) : (
                <AutoMode fontSize="small" />
              )}
            </Avatar>
          </ListItemIcon>
          
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" noWrap sx={{ flexGrow: 1 }}>
                  {activity.title}
                </Typography>
                <Chip
                  size="small"
                  label={activity.status === 'sent' ? 'Enviado' : 
                        activity.status === 'failed' ? 'Falhou' :
                        activity.status === 'completed' ? 'Concluído' :
                        activity.status === 'pending' ? 'Pendente' : 
                        activity.status}
                  color={getStatusColor(activity.status)}
                  variant="outlined"
                />
              </Box>
            }
            secondary={
              <Box>
                <Typography variant="caption" color="textSecondary">
                  {activity.subtitle}
                </Typography>
                <br />
                <Typography variant="caption" color="textSecondary">
                  {formatDate(activity.created_at)}
                </Typography>
              </Box>
            }
          />
        </ListItem>
      ))}
    </List>
  );
};