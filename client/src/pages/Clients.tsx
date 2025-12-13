import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Add,
  Search,
  FilterList,
  Refresh,
  Edit,
  Visibility,
  NotificationsOff,
  NotificationsActive,
  PersonOff,
  Person,
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridActionsCellItem } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { clientsAPI } from '../services/api';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useSnackbar } from 'notistack';
import TraccarStatusIcon from '../components/TraccarStatusIcon';
import TraccarActions from '../components/TraccarActions';

// Validation schema
const clientSchema = yup.object({
  name: yup.string().required('Nome é obrigatório').min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: yup.string().email('Email inválido').optional(),
  phone: yup.string().required('Telefone é obrigatório').min(10, 'Telefone deve ter pelo menos 10 dígitos'),
  mobile_phone: yup.string().optional(),
  cpf_cnpj: yup.string().optional(),
  company: yup.string().optional(),
  address: yup.string().optional(),
  address_number: yup.string().optional(),
  complement: yup.string().optional(),
  province: yup.string().optional(),
  city: yup.string().optional(),
  state: yup.string().max(2, 'Estado deve ter 2 caracteres').optional(),
  postal_code: yup.string().optional(),
  observations: yup.string().optional(),
  notifications_enabled: yup.boolean().optional(),
});

export const Clients: React.FC = () => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  
  // Dialog states
  const [viewDialog, setViewDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [addDialog, setAddDialog] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  // Form for add/edit
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm({
    resolver: yupResolver(clientSchema),
  });

  // Mutations
  const updateClientMutation = useMutation(
    ({ id, data }: { id: string; data: any }) => clientsAPI.update(id, data),
    {
      onSuccess: () => {
        enqueueSnackbar('Cliente atualizado com sucesso!', { variant: 'success' });
        refetch();
        setEditDialog(false);
        reset();
      },
      onError: (error: any) => {
        enqueueSnackbar(error.response?.data?.message || 'Erro ao atualizar cliente', { variant: 'error' });
      },
    }
  );

  const createClientMutation = useMutation(clientsAPI.create, {
    onSuccess: () => {
      enqueueSnackbar('Cliente criado com sucesso!', { variant: 'success' });
      refetch();
      setAddDialog(false);
      reset();
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.message || 'Erro ao criar cliente', { variant: 'error' });
    },
  });

  const toggleStatusMutation = useMutation(clientsAPI.toggleStatus, {
    onSuccess: (response) => {
      enqueueSnackbar(response.message, { variant: 'success' });
      refetch();
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.message || 'Erro ao alterar status', { variant: 'error' });
    },
  });

  const toggleNotificationsMutation = useMutation(clientsAPI.toggleNotifications, {
    onSuccess: (response) => {
      enqueueSnackbar(response.message, { variant: 'success' });
      refetch();
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.message || 'Erro ao alterar notificações', { variant: 'error' });
    },
  });

  const {
    data: clientsData,
    isLoading,
    refetch,
  } = useQuery(
    ['clients', { page: page + 1, limit: pageSize, search, status }],
    () => clientsAPI.getAll({ page: page + 1, limit: pageSize, search, status }),
    { keepPreviousData: true }
  );


  // Dialog handlers
  const handleViewClient = (client: any) => {
    setSelectedClient(client);
    setViewDialog(true);
  };

  const handleEditClient = (client: any) => {
    setSelectedClient(client);
    
    // Pre-fill form with client data
    Object.keys(client).forEach((key) => {
      setValue(key as any, client[key] || '');
    });
    
    setEditDialog(true);
  };

  const handleAddClient = () => {
    setSelectedClient(null);
    reset(); // Clear form
    setAddDialog(true);
  };

  const handleToggleStatus = (id: string) => {
    toggleStatusMutation.mutate(id);
  };

  const handleToggleNotifications = (id: string) => {
    toggleNotificationsMutation.mutate(id);
  };

  const handleSubmitForm = (data: any) => {
    if (selectedClient) {
      // Update existing client
      updateClientMutation.mutate({ id: selectedClient.id, data });
    } else {
      // Create new client
      createClientMutation.mutate(data);
    }
  };

  const handleCloseDialogs = () => {
    setViewDialog(false);
    setEditDialog(false);
    setAddDialog(false);
    setSelectedClient(null);
    reset();
  };

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Nome',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'email',
      headerName: 'Email',
      flex: 1,
      minWidth: 200,
      renderCell: (params) => params.value || '-',
    },
    {
      field: 'phone',
      headerName: 'Telefone',
      width: 150,
      renderCell: (params) => params.value || params.row.mobile_phone || '-',
    },
    {
      field: 'cpf_cnpj',
      headerName: 'CPF/CNPJ',
      width: 150,
      renderCell: (params) => params.value || '-',
    },
    {
      field: 'is_active',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Ativo' : 'Inativo'}
          color={params.value ? 'success' : 'error'}
          size="small"
        />
      ),
    },
    {
      field: 'notifications_enabled',
      headerName: 'Notificações',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Habilitadas' : 'Desabilitadas'}
          color={params.value ? 'primary' : 'default'}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: 'payments',
      headerName: 'Pagamentos',
      width: 120,
      renderCell: (params) => params.value?.length || 0,
    },
    {
      field: 'traccar_status',
      headerName: 'Traccar',
      width: 120,
      renderCell: (params) => (
        <TraccarStatusIcon 
          integration={params.row.TraccarIntegration} 
          variant="chip" 
          size="small"
        />
      ),
    },
    {
      field: 'traccar_actions',
      headerName: 'Traccar Ações',
      width: 80,
      renderCell: (params) => (
        <TraccarActions 
          client={params.row} 
          onActionComplete={() => queryClient.invalidateQueries('clients')}
        />
      ),
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
          onClick={() => handleViewClient(params.row)}
        />,
        <GridActionsCellItem
          icon={<Edit />}
          label="Editar"
          onClick={() => handleEditClient(params.row)}
        />,
        <GridActionsCellItem
          icon={params.row.is_active ? <PersonOff /> : <Person />}
          label={params.row.is_active ? 'Desativar' : 'Ativar'}
          onClick={() => handleToggleStatus(params.row.id)}
        />,
        <GridActionsCellItem
          icon={params.row.notifications_enabled ? <NotificationsOff /> : <NotificationsActive />}
          label={params.row.notifications_enabled ? 'Desabilitar Notificações' : 'Habilitar Notificações'}
          onClick={() => handleToggleNotifications(params.row.id)}
        />,
      ],
    },
  ];

  const clients = clientsData?.data?.clients || [];
  const pagination = clientsData?.data?.pagination || {};

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Clientes
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleAddClient}
        >
          Adicionar Cliente
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              placeholder="Pesquisar clientes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'action.active' }} />,
              }}
              sx={{ minWidth: 300 }}
            />
            
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={status}
                label="Status"
                onChange={(e) => setStatus(e.target.value)}
              >
                <MenuItem value="all">Todos</MenuItem>
                <MenuItem value="active">Ativos</MenuItem>
                <MenuItem value="inactive">Inativos</MenuItem>
              </Select>
            </FormControl>

            <Tooltip title="Atualizar">
              <IconButton onClick={() => refetch()}>
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>

      {/* Data Grid */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <DataGrid
            rows={clients}
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

      {/* View Client Dialog */}
      <Dialog open={viewDialog} onClose={handleCloseDialogs} maxWidth="md" fullWidth>
        <DialogTitle>
          Detalhes do Cliente
        </DialogTitle>
        <DialogContent>
          {selectedClient && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">Nome</Typography>
                <Typography variant="body1">{selectedClient.name}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">Email</Typography>
                <Typography variant="body1">{selectedClient.email || 'Não informado'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">Telefone</Typography>
                <Typography variant="body1">{selectedClient.phone}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">Celular</Typography>
                <Typography variant="body1">{selectedClient.mobile_phone || 'Não informado'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">CPF/CNPJ</Typography>
                <Typography variant="body1">{selectedClient.cpf_cnpj || 'Não informado'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">Empresa</Typography>
                <Typography variant="body1">{selectedClient.company || 'Não informado'}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary">Endereço</Typography>
                <Typography variant="body1">
                  {selectedClient.address ? 
                    `${selectedClient.address}${selectedClient.address_number ? `, ${selectedClient.address_number}` : ''}${selectedClient.complement ? ` - ${selectedClient.complement}` : ''}` : 
                    'Não informado'
                  }
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="subtitle2" color="textSecondary">Bairro</Typography>
                <Typography variant="body1">{selectedClient.province || 'Não informado'}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="subtitle2" color="textSecondary">Cidade</Typography>
                <Typography variant="body1">{selectedClient.city || 'Não informado'}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="subtitle2" color="textSecondary">Estado</Typography>
                <Typography variant="body1">{selectedClient.state || 'Não informado'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">CEP</Typography>
                <Typography variant="body1">{selectedClient.postal_code || 'Não informado'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">Status</Typography>
                <Chip 
                  label={selectedClient.is_active ? 'Ativo' : 'Inativo'} 
                  color={selectedClient.is_active ? 'success' : 'error'} 
                  size="small" 
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary">Notificações</Typography>
                <Chip 
                  label={selectedClient.notifications_enabled ? 'Habilitadas' : 'Desabilitadas'} 
                  color={selectedClient.notifications_enabled ? 'primary' : 'default'} 
                  size="small" 
                  variant="outlined"
                />
              </Grid>
              {selectedClient.observations && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">Observações</Typography>
                  <Typography variant="body1">{selectedClient.observations}</Typography>
                </Grid>
              )}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" color="textSecondary">Pagamentos</Typography>
                <Typography variant="body1">
                  Total de pagamentos: {selectedClient.payments?.length || 0}
                </Typography>
                {selectedClient.payments && selectedClient.payments.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    {selectedClient.payments.slice(0, 3).map((payment: any, index: number) => (
                      <Box key={index} sx={{ mb: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="body2">
                          Valor: R$ {payment.value} - Vencimento: {new Date(payment.due_date).toLocaleDateString('pt-BR')} - Status: {payment.status}
                        </Typography>
                      </Box>
                    ))}
                    {selectedClient.payments.length > 3 && (
                      <Typography variant="caption" color="textSecondary">
                        ... e mais {selectedClient.payments.length - 3} pagamentos
                      </Typography>
                    )}
                  </Box>
                )}
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialogs}>Fechar</Button>
          <Button variant="contained" onClick={() => {
            handleCloseDialogs();
            if (selectedClient) handleEditClient(selectedClient);
          }}>
            Editar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add/Edit Client Dialog */}
      <Dialog open={editDialog || addDialog} onClose={handleCloseDialogs} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedClient ? 'Editar Cliente' : 'Adicionar Cliente'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleSubmit(handleSubmitForm)} sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  {...register('name')}
                  fullWidth
                  label="Nome *"
                  error={!!errors.name}
                  helperText={errors.name?.message}
                  disabled={isSubmitting}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  {...register('email')}
                  fullWidth
                  label="Email"
                  type="email"
                  error={!!errors.email}
                  helperText={errors.email?.message}
                  disabled={isSubmitting}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  {...register('phone')}
                  fullWidth
                  label="Telefone *"
                  error={!!errors.phone}
                  helperText={errors.phone?.message}
                  disabled={isSubmitting}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  {...register('mobile_phone')}
                  fullWidth
                  label="Celular"
                  error={!!errors.mobile_phone}
                  helperText={errors.mobile_phone?.message}
                  disabled={isSubmitting}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  {...register('cpf_cnpj')}
                  fullWidth
                  label="CPF/CNPJ"
                  error={!!errors.cpf_cnpj}
                  helperText={errors.cpf_cnpj?.message}
                  disabled={isSubmitting}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  {...register('company')}
                  fullWidth
                  label="Empresa"
                  error={!!errors.company}
                  helperText={errors.company?.message}
                  disabled={isSubmitting}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>Endereço</Typography>
              </Grid>
              
              <Grid item xs={12} sm={8}>
                <TextField
                  {...register('address')}
                  fullWidth
                  label="Logradouro"
                  error={!!errors.address}
                  helperText={errors.address?.message}
                  disabled={isSubmitting}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  {...register('address_number')}
                  fullWidth
                  label="Número"
                  error={!!errors.address_number}
                  helperText={errors.address_number?.message}
                  disabled={isSubmitting}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  {...register('complement')}
                  fullWidth
                  label="Complemento"
                  error={!!errors.complement}
                  helperText={errors.complement?.message}
                  disabled={isSubmitting}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  {...register('province')}
                  fullWidth
                  label="Bairro"
                  error={!!errors.province}
                  helperText={errors.province?.message}
                  disabled={isSubmitting}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  {...register('city')}
                  fullWidth
                  label="Cidade"
                  error={!!errors.city}
                  helperText={errors.city?.message}
                  disabled={isSubmitting}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  {...register('state')}
                  fullWidth
                  label="Estado"
                  inputProps={{ maxLength: 2 }}
                  placeholder="Ex: SP"
                  error={!!errors.state}
                  helperText={errors.state?.message}
                  disabled={isSubmitting}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  {...register('postal_code')}
                  fullWidth
                  label="CEP"
                  error={!!errors.postal_code}
                  helperText={errors.postal_code?.message}
                  disabled={isSubmitting}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  {...register('observations')}
                  fullWidth
                  label="Observações"
                  multiline
                  rows={3}
                  error={!!errors.observations}
                  helperText={errors.observations?.message}
                  disabled={isSubmitting}
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      {...register('notifications_enabled')}
                      defaultChecked={selectedClient?.notifications_enabled ?? true}
                    />
                  }
                  label="Habilitar notificações por WhatsApp"
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialogs} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit(handleSubmitForm)}
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
          >
            {isSubmitting ? 'Salvando...' : selectedClient ? 'Atualizar' : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};