import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Tooltip,
  Grid,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import {
  Search,
  Refresh,
  Visibility,
  WhatsApp,
  Download,
  Payment as PaymentIcon,
  Warning,
  Schedule,
  CheckCircle,
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridActionsCellItem } from '@mui/x-data-grid';
import { useQuery, useMutation } from 'react-query';
import { paymentsAPI, automationAPI, configAPI } from '../services/api';
import { useSnackbar } from 'notistack';

export const Payments: React.FC = () => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  
  // Dialog states
  const [whatsappDialog, setWhatsappDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [companyName, setCompanyName] = useState('Sua Empresa');
  
  const { enqueueSnackbar } = useSnackbar();

  // Load company name
  useEffect(() => {
    const loadCompanyName = async () => {
      try {
        // Use public endpoint that doesn't require authentication
        const response = await fetch('/api/config/company-name');
        const data = await response.json();
        if (data.success && data.data) {
          setCompanyName(data.data.value || 'Sua Empresa');
        }
      } catch (error) {
        console.error('Error loading company name:', error);
        setCompanyName('Sua Empresa');
      }
    };
    
    loadCompanyName();
  }, []);

  // Mutation for sending WhatsApp message
  const sendWhatsAppMutation = useMutation(automationAPI.sendManualMessage, {
    onSuccess: () => {
      enqueueSnackbar('Mensagem enviada com sucesso!', { variant: 'success' });
      setWhatsappDialog(false);
      setSelectedPayment(null);
      setCustomMessage('');
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.message || 'Erro ao enviar mensagem', { variant: 'error' });
    },
  });

  const {
    data: paymentsData,
    isLoading,
    refetch,
    error,
  } = useQuery(
    ['payments', { page: page + 1, limit: pageSize, search, status, dateFrom, dateTo }],
    () => {
      const params: any = { 
        page: page + 1, 
        limit: pageSize,
        sortBy: 'due_date',
        sortOrder: 'ASC' // Mostrar vencimentos mais próximos primeiro
      };
      
      if (search) params.search = search;
      if (status !== 'all') params.status = status;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      
      console.log('Fetching payments with params:', params);
      return paymentsAPI.getAll(params);
    },
    { 
      keepPreviousData: true,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      staleTime: 0, // Force fresh data
      onError: (error) => {
        console.error('Error fetching payments:', error);
        enqueueSnackbar('Erro ao carregar cobranças', { variant: 'error' });
      },
      onSuccess: (data) => {
        console.log('Payments data received:', data);
      }
    }
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (date: string) => {
    // Corrige problema de fuso horário ao trabalhar com datas no formato YYYY-MM-DD
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RECEIVED':
      case 'CONFIRMED':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'OVERDUE':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      PENDING: 'Pendente',
      RECEIVED: 'Recebido',
      CONFIRMED: 'Confirmado', 
      OVERDUE: 'Vencido',
      REFUNDED: 'Reembolsado',
      RECEIVED_IN_CASH: 'Recebido em Dinheiro',
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getBillingTypeLabel = (type: string) => {
    const labels = {
      BOLETO: 'Boleto',
      CREDIT_CARD: 'Cartão',
      PIX: 'PIX',
      UNDEFINED: 'Indefinido',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const handleSendWhatsApp = (payment: any) => {
    setSelectedPayment(payment);
    
    // Generate automatic message based on payment status
    const defaultMessage = generatePaymentMessage(payment, companyName);
    setCustomMessage(defaultMessage);
    
    setWhatsappDialog(true);
  };

  const generatePaymentMessage = (payment: any, companyName: string) => {
    const client = payment.client;
    const dueDate = formatDate(payment.due_date); // Usa nossa função corrigida
    const value = formatCurrency(payment.value);
    const today = new Date().toISOString().split('T')[0];
    const paymentDueDate = payment.due_date;
    
    if (payment.status === 'OVERDUE') {
      return `⚠️ Olá ${client?.name || 'cliente'}, somos da *${companyName}*.
Identificamos que sua fatura está *vencida* ⏳.

🗓️ Vencimento: ${dueDate}
💰 Valor: ${value}
${payment.invoice_url ? `🔗 Link da fatura: ${payment.invoice_url}` : ''}

Pedimos que regularize o pagamento para evitar interrupção no rastreamento 🚗📡.
Se já tiver efetuado o pagamento, por favor desconsidere esta mensagem.
Conte conosco para qualquer dúvida! 🤝`;
    } else if (paymentDueDate === today) {
      return `🚗💨 Olá ${client?.name || 'cliente'}, aqui é da *${companyName}*!
Notamos que sua fatura vence *hoje* 📅.
Para evitar juros e manter seu rastreamento ativo, faça o pagamento o quanto antes.

🔗 Link da fatura: ${payment.invoice_url || 'Não disponível'}
${payment.bank_slip_url ? `🔗 Link do boleto: ${payment.bank_slip_url}` : ''}
💰 Valor: ${value}
📆 Vencimento: ${dueDate}

Qualquer dúvida, nossa equipe está à disposição! 🤝`;
    } else {
      return `🔔 Olá ${client?.name || 'cliente'}, tudo bem? Somos da *${companyName}*.
Sua fatura está próxima do vencimento 🗓️.
Evite a suspensão do serviço e mantenha sua proteção ativa! 🛡️

🔗 Link da fatura: ${payment.invoice_url || 'Não disponível'}
${payment.bank_slip_url ? `🔗 Link do boleto: ${payment.bank_slip_url}` : ''}
💰 Valor: ${value}
🗓️ Vencimento: ${dueDate}

Estamos aqui para ajudar no que precisar! 🤝`;
    }
  };

  const handleSendMessage = () => {
    if (!selectedPayment || !customMessage) {
      enqueueSnackbar('Selecione um pagamento e escreva a mensagem', { variant: 'warning' });
      return;
    }

    const phoneNumber = selectedPayment.client?.mobile_phone || selectedPayment.client?.phone;
    
    if (!phoneNumber) {
      enqueueSnackbar('Cliente não possui número de telefone cadastrado', { variant: 'error' });
      return;
    }

    sendWhatsAppMutation.mutate({
      client_id: selectedPayment.client?.id,
      payment_id: selectedPayment.id,
      phone_number: phoneNumber,
      message: customMessage,
    });
  };

  const columns: GridColDef[] = [
    {
      field: 'client',
      headerName: 'Cliente',
      flex: 1,
      minWidth: 200,
      renderCell: (params) => params.value?.name || 'N/A',
    },
    {
      field: 'value',
      headerName: 'Valor',
      width: 120,
      renderCell: (params) => formatCurrency(params.value),
    },
    {
      field: 'due_date',
      headerName: 'Vencimento',
      width: 120,
      renderCell: (params) => formatDate(params.value),
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
      field: 'billing_type',
      headerName: 'Tipo',
      width: 100,
      renderCell: (params) => getBillingTypeLabel(params.value),
    },
    {
      field: 'description',
      headerName: 'Descrição',
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'warning_count',
      headerName: 'Avisos',
      width: 80,
      renderCell: (params) => params.value || 0,
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Ações',
      width: 150,
      getActions: (params) => [
        <GridActionsCellItem
          icon={<Visibility />}
          label="Visualizar"
          onClick={() => {
            if (params.row.invoice_url) {
              window.open(params.row.invoice_url, '_blank');
            } else {
              enqueueSnackbar('URL da fatura não disponível', { variant: 'warning' });
            }
          }}
        />,
        <GridActionsCellItem
          icon={<Download />}
          label="Boleto"
          onClick={() => {
            if (params.row.bank_slip_url) {
              window.open(params.row.bank_slip_url, '_blank');
            } else {
              enqueueSnackbar('Boleto não disponível', { variant: 'warning' });
            }
          }}
        />,
        <GridActionsCellItem
          icon={<WhatsApp />}
          label="Enviar WhatsApp"
          onClick={() => handleSendWhatsApp(params.row)}
        />,
      ],
    },
  ];

  const payments = paymentsData?.data?.payments || [];
  const pagination = paymentsData?.data?.pagination || {};

  // Debug info
  console.log('Payments component render:', {
    isLoading,
    error,
    paymentsData,
    paymentsCount: payments.length,
    today: new Date().toISOString().split('T')[0],
    paymentsDueToday: payments.filter((p: any) => {
      const today = new Date().toISOString().split('T')[0];
      return p.due_date === today && p.status === 'PENDING';
    }),
    allPayments: payments.map((p: any) => ({ id: p.id, due_date: p.due_date, client: p.client?.name }))
  });

  if (error) {
    return (
      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          Cobranças
        </Typography>
        <Alert severity="error">
          Erro ao carregar cobranças: {(error as any)?.message || 'Erro desconhecido'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Cobranças
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={() => refetch()}
        >
          Atualizar
        </Button>
      </Box>

      {/* Quick Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <PaymentIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h6">
                {payments.filter((p: any) => p.status === 'PENDING').length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Pendentes
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Warning color="error" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h6">
                {payments.filter((p: any) => p.status === 'OVERDUE').length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Vencidos
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Schedule color="warning" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h6">
                {payments.filter((p: any) => {
                  const today = new Date().toISOString().split('T')[0];
                  return p.due_date === today && p.status === 'PENDING';
                }).length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Vencem Hoje
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <CheckCircle color="success" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h6" color="success.main">
                {formatCurrency(
                  payments
                    .filter((p: any) => ['RECEIVED', 'CONFIRMED'].includes(p.status))
                    .reduce((sum: number, p: any) => sum + parseFloat(p.value || 0), 0)
                )}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Recebido
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                placeholder="Pesquisar cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'action.active' }} />,
                }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={status}
                  label="Status"
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <MenuItem value="all">Todos</MenuItem>
                  <MenuItem value="PENDING">Pendente</MenuItem>
                  <MenuItem value="OVERDUE">Vencido</MenuItem>
                  <MenuItem value="RECEIVED">Recebido</MenuItem>
                  <MenuItem value="CONFIRMED">Confirmado</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                type="date"
                label="Data Início"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                type="date"
                label="Data Fim"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={1}>
              <Tooltip title="Atualizar">
                <IconButton onClick={() => refetch()}>
                  <Refresh />
                </IconButton>
              </Tooltip>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Data Grid */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <DataGrid
            rows={payments}
            columns={columns}
            loading={isLoading}
            paginationMode="server"
            rowCount={pagination.total_items || 0}
            paginationModel={{ page, pageSize }}
            onPaginationModelChange={(model) => {
              setPage(model.page);
              setPageSize(model.pageSize);
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            disableRowSelectionOnClick
            autoHeight
            sx={{ border: 'none' }}
          />
        </CardContent>
      </Card>

      {/* WhatsApp Dialog */}
      <Dialog 
        open={whatsappDialog} 
        onClose={() => setWhatsappDialog(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          Enviar Cobrança por WhatsApp
        </DialogTitle>
        <DialogContent>
          {selectedPayment && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                <strong>Cliente:</strong> {selectedPayment.client?.name}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                <strong>Telefone:</strong> {selectedPayment.client?.mobile_phone || selectedPayment.client?.phone || 'Não informado'}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                <strong>Valor:</strong> {formatCurrency(selectedPayment.value)}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                <strong>Vencimento:</strong> {formatDate(selectedPayment.due_date)}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                <strong>Status:</strong> 
                <Chip 
                  label={getStatusLabel(selectedPayment.status)} 
                  color={getStatusColor(selectedPayment.status)} 
                  size="small" 
                  sx={{ ml: 1 }}
                />
              </Typography>
            </Box>
          )}
          
          <TextField
            fullWidth
            label="Mensagem"
            multiline
            rows={12}
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Digite sua mensagem personalizada ou use a mensagem automática gerada..."
            sx={{ mt: 2 }}
          />
          
          <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
            💡 A mensagem foi gerada automaticamente baseada no status do pagamento. Você pode editá-la antes de enviar.
          </Typography>
        </DialogContent>
        
        <DialogActions>
          <Button 
            onClick={() => setWhatsappDialog(false)}
            disabled={sendWhatsAppMutation.isLoading}
          >
            Cancelar
          </Button>
          
          <Button
            variant="contained"
            onClick={handleSendMessage}
            disabled={sendWhatsAppMutation.isLoading || !customMessage.trim()}
            startIcon={sendWhatsAppMutation.isLoading ? <CircularProgress size={20} /> : <WhatsApp />}
          >
            {sendWhatsAppMutation.isLoading ? 'Enviando...' : 'Enviar WhatsApp'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};