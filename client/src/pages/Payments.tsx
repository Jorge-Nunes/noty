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
  Edit,
  DeleteOutline,
} from '@mui/icons-material';
import { GridColDef, GridActionsCellItem } from '@mui/x-data-grid';
import { ResponsiveDataGrid } from '../components/ResponsiveDataGrid';
import { useQuery, useMutation } from 'react-query';
import { paymentsAPI, automationAPI, configAPI } from '../services/api';
import { useSnackbar } from 'notistack';

export const Payments: React.FC = () => {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
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
  const [editDialog, setEditDialog] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  
  const { enqueueSnackbar } = useSnackbar();

  // Debounce search input
  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(h);
  }, [search]);

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

  const [sortModel, setSortModel] = useState([{ field: 'due_date', sort: 'asc' as const }]);

 const {
    data: paymentsData,
    isLoading,
    refetch,
    error,
  } = useQuery(
    ['payments', { page: page + 1, limit: pageSize, search: debouncedSearch, status, dateFrom, dateTo, sortBy: sortModel[0]?.field, sortOrder: (sortModel[0]?.sort || 'asc').toUpperCase() }],
    () => {
      const params: any = { 
        page: page + 1, 
        limit: pageSize,
        sortBy: sortModel[0]?.field || 'due_date',
        sortOrder: (sortModel[0]?.sort || 'asc').toUpperCase()
      };
      
      if (debouncedSearch) params.search = debouncedSearch;
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
      case 'RECEIVED_IN_CASH':
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
      minWidth: 180,
      renderCell: (params) => (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          height: '100%',
          py: 1
        }}>
          {params.value?.name || 'N/A'}
        </Box>
      ),
    },
    {
      field: 'value',
      headerName: 'Valor',
      width: 130,
      minWidth: 120,
      renderCell: (params) => (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          height: '100%',
          fontWeight: 'medium'
        }}>
          {formatCurrency(params.value)}
        </Box>
      ),
    },
    {
      field: 'due_date',
      headerName: 'Vencimento',
      width: 130,
      minWidth: 120,
      renderCell: (params) => (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          height: '100%'
        }}>
          {formatDate(params.value)}
        </Box>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 170,
      minWidth: 160,
      renderCell: (params) => (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          height: '100%'
        }}>
          <Chip
            label={getStatusLabel(params.value)}
            color={getStatusColor(params.value)}
            size="small"
          />
        </Box>
      ),
    },
    {
      field: 'billing_type',
      headerName: 'Tipo',
      width: 110,
      minWidth: 100,
      renderCell: (params) => (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          height: '100%'
        }}>
          {getBillingTypeLabel(params.value)}
        </Box>
      ),
    },
    {
      field: 'description',
      headerName: 'Descrição',
      flex: 1,
      minWidth: 150,
      renderCell: (params) => (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          height: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {params.value || '-'}
        </Box>
      ),
    },
    {
      field: 'warning_count',
      headerName: 'Avisos',
      width: 90,
      minWidth: 80,
      renderCell: (params) => (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          height: '100%'
        }}>
          {params.value || 0}
        </Box>
      ),
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Ações',
      width: 200,
      minWidth: 180,
      sortable: false,
      filterable: false,
      hideable: false,
      getActions: (params) => [
        <GridActionsCellItem
          icon={<Edit />}
          label="Editar"
          onClick={() => {
            setSelectedPayment(params.row);
            setEditData({
              value: params.row.value,
              due_date: params.row.due_date,
              status: params.row.status,
              description: params.row.description || '',
              billing_type: params.row.billing_type,
              invoice_url: params.row.invoice_url || '',
              bank_slip_url: params.row.bank_slip_url || '',
            });
            setEditDialog(true);
          }}
        />, 
        <GridActionsCellItem
          icon={<DeleteOutline />}
          label="Excluir"
          onClick={() => {
            setSelectedPayment(params.row);
            setDeleteConfirm(true);
          }}
        />,
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
  const totalsByStatus = paymentsData?.data?.totalsByStatus || {};
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
            <CardContent sx={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => setStatus('PENDING')}>
              <PaymentIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h6">
                {totalsByStatus['PENDING'] ?? payments.filter((p: any) => p.status === 'PENDING').length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Pendentes
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => setStatus('OVERDUE')}>
              <Warning color="error" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h6">
                {totalsByStatus['OVERDUE'] ?? payments.filter((p: any) => p.status === 'OVERDUE').length}
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
                {(() => {
                  // Mantemos o valor da página atual por enquanto; a API atual não retorna soma por status.
                  return formatCurrency(
                    payments
                      .filter((p: any) => ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status))
                      .reduce((sum: number, p: any) => sum + parseFloat(p.value || 0), 0)
                  );
                })()}
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
            <Grid item xs={12} sm={6} md={4} lg={3}>
              <TextField
                fullWidth
                placeholder="Pesquisar cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'action.active' }} />,
                }}
                size="small"
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={3} lg={2}>
              <FormControl fullWidth size="small">
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
                  <MenuItem value="RECEIVED_IN_CASH">Recebido em Dinheiro</MenuItem>
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
                size="small"
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
                size="small"
              />
            </Grid>

            <Grid item xs={12} sm={12} md={1} sx={{ 
              display: 'flex', 
              justifyContent: { xs: 'flex-start', md: 'center' },
              alignItems: 'center'
            }}>
              <Tooltip title="Atualizar">
                <IconButton onClick={() => refetch()} size="large">
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
         <ResponsiveDataGrid
            rows={payments}
            columns={columns}
            loading={isLoading}
            paginationMode="server"
            sortingMode="server"
            sortModel={sortModel}
            onSortModelChange={(model) => { setSortModel(model as any); setPage(0); }}
            rowCount={pagination.total_items || 0}
            paginationModel={{ page, pageSize }}
            onPaginationModelChange={(model) => {
              setPage(model.page);
              setPageSize(model.pageSize);
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            disableRowSelectionOnClick
            autoHeight
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

      {/* Edit Dialog */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Editar Cobrança</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Valor"
                type="number"
                value={editData.value || ''}
                onChange={(e) => setEditData({ ...editData, value: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Vencimento"
                type="date"
                value={editData.due_date || ''}
                onChange={(e) => setEditData({ ...editData, due_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={editData.status || 'PENDING'}
                  onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                >
                  <MenuItem value="PENDING">Pendente</MenuItem>
                  <MenuItem value="OVERDUE">Vencido</MenuItem>
                  <MenuItem value="RECEIVED">Recebido</MenuItem>
                  <MenuItem value="CONFIRMED">Confirmado</MenuItem>
                  <MenuItem value="RECEIVED_IN_CASH">Recebido em Dinheiro</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Tipo</InputLabel>
                <Select
                  label="Tipo"
                  value={editData.billing_type || 'BOLETO'}
                  onChange={(e) => setEditData({ ...editData, billing_type: e.target.value })}
                >
                  <MenuItem value="BOLETO">Boleto</MenuItem>
                  <MenuItem value="PIX">PIX</MenuItem>
                  <MenuItem value="CREDIT_CARD">Cartão</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Descrição"
                value={editData.description || ''}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                multiline
                rows={3}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="URL Fatura"
                value={editData.invoice_url || ''}
                onChange={(e) => setEditData({ ...editData, invoice_url: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="URL Boleto"
                value={editData.bank_slip_url || ''}
                onChange={(e) => setEditData({ ...editData, bank_slip_url: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>Cancelar</Button>
          <Button variant="contained" onClick={async () => {
            if (!selectedPayment) return;
            try {
              const payload = { ...editData };
              const res = await paymentsAPI.update(selectedPayment.id, payload);
              if (res.success) {
                enqueueSnackbar('Cobrança atualizada com sucesso', { variant: 'success' });
                setEditDialog(false);
                refetch();
              } else {
                enqueueSnackbar(res.message || 'Falha ao atualizar cobrança', { variant: 'error' });
              }
            } catch (err: any) {
              enqueueSnackbar(err.response?.data?.message || 'Erro ao atualizar cobrança', { variant: 'error' });
            }
          }}>Salvar</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteConfirm} onClose={() => setDeleteConfirm(false)}>
        <DialogTitle>Excluir Cobrança</DialogTitle>
        <DialogContent>
          Tem certeza que deseja excluir esta cobrança? Esta ação não pode ser desfeita.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(false)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={async () => {
            if (!selectedPayment) return;
            try {
              const res = await paymentsAPI.delete(selectedPayment.id);
              if (res.success) {
                enqueueSnackbar('Cobrança excluída com sucesso', { variant: 'success' });
                setDeleteConfirm(false);
                refetch();
              } else {
                enqueueSnackbar(res.message || 'Falha ao excluir cobrança', { variant: 'error' });
              }
            } catch (err: any) {
              enqueueSnackbar(err.response?.data?.message || 'Erro ao excluir cobrança', { variant: 'error' });
            }
          }}>Excluir</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};