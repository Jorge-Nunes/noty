import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { Box, Typography, useTheme } from '@mui/material';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PaymentData {
  date: string;
  count: number;
  total_value: number;
  status: string;
}

interface PaymentsChartProps {
  data: PaymentData[];
}

export const PaymentsChart: React.FC<PaymentsChartProps> = ({ data }) => {
  const theme = useTheme();

  // Process data for chart
  const processedData = React.useMemo(() => {
    const dateMap = new Map<string, any>();

    data.forEach((item) => {
      const date = item.date;
      if (!dateMap.has(date)) {
        dateMap.set(date, {
          date,
          pending: 0,
          overdue: 0,
          received: 0,
          total_value: 0,
          total_count: 0,
        });
      }

      const entry = dateMap.get(date);
      entry[item.status.toLowerCase()] = parseInt(item.count.toString());
      entry.total_value += parseFloat(item.total_value?.toString() || '0');
      entry.total_count += parseInt(item.count.toString());
    });

    return Array.from(dateMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [data]);

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'dd/MM', { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (!data || data.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="textSecondary">
          Nenhum dado disponível para exibir
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={processedData}>
          <defs>
            <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={theme.palette.warning.main} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={theme.palette.warning.main} stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorOverdue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={theme.palette.error.main} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={theme.palette.error.main} stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={theme.palette.success.main} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={theme.palette.success.main} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tickFormatter={formatDate}
            stroke={theme.palette.text.secondary}
          />
          <YAxis stroke={theme.palette.text.secondary} />
          <Tooltip
            labelFormatter={(label) => formatDate(label.toString())}
            formatter={(value, name) => {
              const displayName = {
                pending: 'Pendentes',
                overdue: 'Vencidos',
                received: 'Recebidos',
                total_value: 'Valor Total'
              }[name as string] || name;
              
              return [
                name === 'total_value' ? formatCurrency(Number(value)) : value,
                displayName
              ];
            }}
            contentStyle={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 8,
            }}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="pending"
            stackId="1"
            stroke={theme.palette.warning.main}
            fillOpacity={1}
            fill="url(#colorPending)"
            name="Pendentes"
          />
          <Area
            type="monotone"
            dataKey="overdue"
            stackId="1"
            stroke={theme.palette.error.main}
            fillOpacity={1}
            fill="url(#colorOverdue)"
            name="Vencidos"
          />
          <Area
            type="monotone"
            dataKey="received"
            stackId="1"
            stroke={theme.palette.success.main}
            fillOpacity={1}
            fill="url(#colorReceived)"
            name="Recebidos"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
};