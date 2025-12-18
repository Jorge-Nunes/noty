import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Divider,
} from '@mui/material';
import {
  Message,
  Edit,
  Save,
  Visibility,
  ExpandMore,
  Preview,
  Help,
  Phone,
  WhatsApp,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { templatesAPI } from '../services/api';
import { useSnackbar } from 'notistack';

const templateTypes = [
  { 
    type: 'warning', 
    name: 'Aviso de Vencimento', 
    description: 'Mensagem enviada X dias antes do vencimento',
    color: 'warning' as const
  },
  { 
    type: 'due_today', 
    name: 'Vencimento Hoje', 
    description: 'Mensagem enviada no dia do vencimento',
    color: 'info' as const
  },
  { 
    type: 'overdue', 
    name: 'Pagamento Vencido', 
    description: 'Mensagem enviada para pagamentos vencidos',
    color: 'error' as const
  },
  { 
    type: 'payment_confirmed', 
    name: 'Pagamento Confirmado', 
    description: 'Mensagem enviada quando o pagamento é confirmado',
    color: 'primary' as const
  },
  { 
    type: 'traccar_warning_threshold', 
    name: 'Aviso Limiar Traccar', 
    description: 'Aviso enviado quando está no limiar de bloqueio (ex: 2 de 3 cobranças)',
    color: 'warning' as const
  },
  { 
    type: 'traccar_warning_final', 
    name: 'Aviso Final Traccar', 
    description: 'Último aviso antes do bloqueio automático (quando atinge o limite)',
    color: 'error' as const
  },
  { 
    type: 'traccar_block', 
    name: 'Bloqueio Traccar', 
    description: 'Notificação de bloqueio no sistema Traccar por inadimplência',
    color: 'error' as const
  },
  { 
    type: 'traccar_unblock', 
    name: 'Desbloqueio Traccar', 
    description: 'Notificação de reativação do acesso no Traccar',
    color: 'success' as const
  },
];

const availableVariables = [
  { var: '{{cliente.name}}', desc: 'Nome do cliente' },
  { var: '{{cliente.phone}}', desc: 'Telefone do cliente' },
  { var: '{{cliente.email}}', desc: 'Email do cliente' },
  { var: '{{payment.value_formatted}}', desc: 'Valor formatado (R$ 150,00)' },
  { var: '{{payment.due_date_formatted}}', desc: 'Data de vencimento (07/12/2025)' },
  { var: '{{payment.payment_date_formatted}}', desc: 'Data do pagamento' },
  { var: '{{payment.invoice_url}}', desc: 'Link da fatura' },
  { var: '{{payment.bank_slip_url}}', desc: 'Link do boleto' },
  { var: '{{payment.asaas_id}}', desc: 'ID do pagamento no Asaas' },
  { var: '{{company.name}}', desc: 'Nome da empresa' },
  { var: '{{warning_days}}', desc: 'Dias de antecedência (apenas avisos)' },
  // Variáveis específicas do Traccar
  { var: '{client_name}', desc: 'Nome do cliente (Traccar)' },
  { var: '{overdue_amount}', desc: 'Valor em atraso formatado (Traccar)' },
  { var: '{overdue_count}', desc: 'Quantidade de cobranças em atraso (Traccar)' },
  { var: '{overdue_days}', desc: 'Dias em atraso (Traccar)' },
  { var: '{days_until_block}', desc: 'Dias até bloqueio (Traccar)' },
  { var: '{company_name}', desc: 'Nome da empresa (Traccar)' },
  { var: '{company_phone}', desc: 'Telefone da empresa (Traccar)' },
  { var: '{traccar_url}', desc: 'URL do sistema Traccar' },
];

export const TemplatesTab: React.FC = () => {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [editDialog, setEditDialog] = useState(false);
  const [previewDialog, setPreviewDialog] = useState(false);
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    template: '',
  });

  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const {
    data: templatesData,
    isLoading,
    refetch,
  } = useQuery('templates', templatesAPI.getAll);

  // Filter only active templates for cleaner interface
  const activeTemplates = templatesData?.data?.templates?.filter((template: any) => template.is_active) || [];

  const saveTemplateMutation = useMutation(
    ({ type, data }: { type: string; data: any }) => templatesAPI.save(type, data),
    {
      onSuccess: () => {
        enqueueSnackbar('Template salvo com sucesso!', { variant: 'success' });
        refetch();
        setEditDialog(false);
      },
      onError: (error: any) => {
        enqueueSnackbar(error.response?.data?.message || 'Erro ao salvar template', { variant: 'error' });
      },
    }
  );

  const previewTemplateMutation = useMutation(templatesAPI.test, {
    onSuccess: (data) => {
      setPreviewResult(data.data);
      setPreviewDialog(true);
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.message || 'Erro ao visualizar template', { variant: 'error' });
    },
  });

  const handleEditTemplate = (type: string) => {
    const template = templatesData?.data?.templates?.find((t: any) => t.type === type);
    const typeConfig = templateTypes.find(t => t.type === type);
    
    if (template) {
      setFormData({
        name: template.name,
        description: template.description,
        template: template.template,
      });
    } else {
      setFormData({
        name: typeConfig?.name || '',
        description: typeConfig?.description || '',
        template: '',
      });
    }
    
    setSelectedType(type);
    setEditDialog(true);
  };

  const handleSaveTemplate = () => {
    if (!selectedType) return;

    // Enviar apenas o campo necessário para a API
    saveTemplateMutation.mutate({
      type: selectedType,
      data: { template: formData.template }
    });
  };

  const handlePreviewTemplate = (type: string) => {
    previewTemplateMutation.mutate(type);
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('template-textarea') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formData.template;
      const newText = text.substring(0, start) + variable + text.substring(end);
      setFormData({ ...formData, template: newText });
      
      // Restore cursor position
      setTimeout(() => {
        textarea.setSelectionRange(start + variable.length, start + variable.length);
        textarea.focus();
      }, 0);
    }
  };

  const getTemplateByType = (type: string) => {
    return templatesData?.data?.templates?.find((t: any) => t.type === type);
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
        <Message sx={{ mr: 1 }} />
        Templates de Mensagens
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Configure os templates de mensagens que serão enviadas automaticamente via WhatsApp.
        Use as variáveis disponíveis para personalizar as mensagens.
      </Alert>

      <List>
        {templateTypes.filter((typeConfig) => {
          const template = getTemplateByType(typeConfig.type);
          return !template || template.is_active !== false;
        }).map((typeConfig) => {
          const template = getTemplateByType(typeConfig.type);
          const isConfigured = !!template;

          return (
            <Card key={typeConfig.type} sx={{ mb: 2 }}>
              <ListItem>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="h6">{typeConfig.name}</Typography>
                      <Chip 
                        label={isConfigured ? 'Configurado' : 'Não Configurado'} 
                        color={isConfigured ? 'success' : 'default'}
                        size="small" 
                      />
                    </Box>
                  }
                  secondary={typeConfig.description}
                />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<Edit />}
                    onClick={() => handleEditTemplate(typeConfig.type)}
                  >
                    Editar
                  </Button>
                  {isConfigured && (
                    <Button
                      variant="outlined"
                      startIcon={<Visibility />}
                      onClick={() => handlePreviewTemplate(typeConfig.type)}
                      disabled={previewTemplateMutation.isLoading}
                    >
                      Visualizar
                    </Button>
                  )}
                </Box>
              </ListItem>
            </Card>
          );
        })}
      </List>

      {/* Edit Template Dialog */}
      <Dialog 
        open={editDialog} 
        onClose={() => setEditDialog(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          Editar Template: {templateTypes.find(t => t.type === selectedType)?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Nome do Template"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              sx={{ mb: 2 }}
            />
            
            <TextField
              fullWidth
              label="Descrição"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              sx={{ mb: 2 }}
            />

            <Typography variant="subtitle1" gutterBottom>
              Template da Mensagem:
            </Typography>
            
            <TextField
              id="template-textarea"
              fullWidth
              multiline
              rows={8}
              value={formData.template}
              onChange={(e) => setFormData({ ...formData, template: e.target.value })}
              placeholder="Digite o template da mensagem aqui..."
              sx={{ mb: 2 }}
            />

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle2">Variáveis Disponíveis</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                  Clique em uma variável para inserir no template:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {availableVariables.map((variable) => (
                    <Chip
                      key={variable.var}
                      label={variable.var}
                      onClick={() => insertVariable(variable.var)}
                      clickable
                      size="small"
                      title={variable.desc}
                    />
                  ))}
                </Box>
              </AccordionDetails>
            </Accordion>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSaveTemplate}
            variant="contained"
            disabled={saveTemplateMutation.isLoading || !formData.template.trim()}
            startIcon={saveTemplateMutation.isLoading ? <CircularProgress size={20} /> : <Save />}
          >
            Salvar Template
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mobile Preview Dialog */}
      <Dialog 
        open={previewDialog} 
        onClose={() => setPreviewDialog(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: { 
            maxWidth: '400px',
            minHeight: '600px',
            borderRadius: '20px',
            overflow: 'hidden'
          }
        }}
      >
        <Box sx={{ 
          background: 'linear-gradient(135deg, #075E54 0%, #128C7E 100%)', 
          p: 2, 
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <Phone sx={{ fontSize: 20 }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            WhatsApp Preview
          </Typography>
          <WhatsApp sx={{ ml: 'auto' }} />
        </Box>
        
        <Box sx={{ 
          flex: 1,
          background: '#ECE5DD', // WhatsApp chat background color
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.05' fill-rule='evenodd'%3E%3Cpath d='m0 40l40-40h-40v40zm40 0v-40h-40l40 40z'/%3E%3C/g%3E%3C/svg%3E")`,
          p: 2,
          minHeight: '500px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end'
        }}>
          {/* Contact Header */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1, 
              mb: 1,
              p: 1,
              backgroundColor: 'rgba(255,255,255,0.3)',
              borderRadius: '8px',
              fontSize: '0.875rem'
            }}>
              <Box sx={{ 
                width: 32, 
                height: 32, 
                borderRadius: '50%', 
                backgroundColor: '#25D366',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '14px',
                fontWeight: 'bold'
              }}>
                JS
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#128C7E', fontWeight: 'bold' }}>
                  João Silva
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', color: '#075E54', fontSize: '0.75rem' }}>
                  +55 11 99999-9999
                </Typography>
              </Box>
            </Box>
          </Box>

          {previewResult && (
            <Box>
              {/* Message Bubble */}
              <Box sx={{ 
                backgroundColor: '#DCF8C6', // WhatsApp sent message color
                padding: '12px 16px',
                borderRadius: '18px 18px 4px 18px',
                maxWidth: '85%',
                marginLeft: 'auto',
                marginBottom: '8px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                position: 'relative',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  bottom: 0,
                  right: '-8px',
                  width: 0,
                  height: 0,
                  borderLeft: '8px solid #DCF8C6',
                  borderBottom: '8px solid transparent',
                }
              }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: '#303030',
                    lineHeight: 1.4,
                    fontSize: '14px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                >
                  {previewResult.processed}
                </Typography>
                
                {/* Message timestamp */}
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: '#999999',
                    fontSize: '11px',
                    display: 'block',
                    textAlign: 'right',
                    mt: 0.5,
                    lineHeight: 1
                  }}
                >
                  {new Date().toLocaleTimeString('pt-BR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })} ✓✓
                </Typography>
              </Box>
              
              {/* System message */}
              <Box sx={{ 
                textAlign: 'center',
                mb: 1
              }}>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: '#8696a0',
                    fontSize: '12px',
                    backgroundColor: 'rgba(255,255,255,0.8)',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    display: 'inline-block'
                  }}
                >
                  📱 Mensagem automática da TEKSAT
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
        
        <DialogActions sx={{ 
          p: 2, 
          background: 'linear-gradient(135deg, #075E54 0%, #128C7E 100%)'
        }}>
          <Button 
            onClick={() => setPreviewDialog(false)}
            sx={{ color: 'white', fontWeight: 'bold' }}
          >
            Fechar Preview
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};