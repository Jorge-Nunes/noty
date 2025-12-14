import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
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
        <BarChart data={processedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
          <Bar
            dataKey="received"
            stackId="a"
            fill={theme.palette.success.main}
            name="Recebidos"
          />
          <Bar
            dataKey="pending"
            stackId="a"
            fill={theme.palette.warning.main}
            name="Pendentes"
          />
          <Bar
            dataKey="overdue"
            stackId="a"
            fill={theme.palette.error.main}
            name="Vencidos"
          />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};