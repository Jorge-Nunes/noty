import React, { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Sync as SyncIcon,
  Link as LinkIcon
} from '@mui/icons-material';
import { traccarAPI } from '../services/api';

interface TraccarIntegration {
  traccar_user_id: number | null;
  mapping_method: 'EMAIL' | 'PHONE' | 'MANUAL' | 'NOT_MAPPED';
  is_blocked: boolean;
  last_sync_at: string | null;
  block_reason?: string | null;
}

interface Client {
  id: string;
  name: string;
  email?: string;
  mobile_phone?: string;
  TraccarIntegration?: TraccarIntegration | null;
}

interface TraccarActionsProps {
  client: Client;
  onActionComplete?: () => void;
}

const TraccarActions: React.FC<TraccarActionsProps> = ({
  client,
  onActionComplete
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [unblockDialogOpen, setUnblockDialogOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const integration = client.TraccarIntegration;
  const isMapped = integration?.traccar_user_id && integration.mapping_method !== 'NOT_MAPPED';
  const isBlocked = integration?.is_blocked || false;

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleBlockClient = async () => {
    if (!blockReason.trim()) {
      setMessage({ type: 'error', text: 'Motivo do bloqueio é obrigatório' });
      return;
    }

    setLoading(true);
    try {
      const response = await traccarAPI.blockClient(client.id, blockReason);

      if (response.success) {
        setMessage({ type: 'success', text: 'Cliente bloqueado com sucesso' });
        setBlockDialogOpen(false);
        setBlockReason('');
        onActionComplete?.();
      } else {
        setMessage({ type: 'error', text: response.message });
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Erro ao bloquear cliente'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnblockClient = async () => {
    setLoading(true);
    try {
      const response = await traccarAPI.unblockClient(client.id);

      if (response.success) {
        setMessage({ type: 'success', text: 'Cliente desbloqueado com sucesso' });
        setUnblockDialogOpen(false);
        onActionComplete?.();
      } else {
        setMessage({ type: 'error', text: response.message });
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Erro ao desbloquear cliente'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncClient = async () => {
    setLoading(true);
    try {
      const response = await traccarAPI.syncClients();

      if (response.success) {
        setMessage({ type: 'success', text: 'Sincronização concluída' });
        onActionComplete?.();
      } else {
        setMessage({ type: 'error', text: response.message });
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Erro na sincronização'
      });
    } finally {
      setLoading(false);
      handleMenuClose();
    }
  };

  if (!isMapped) {
    return (
      <>
        <IconButton
          size="small"
          onClick={handleSyncClient}
          disabled={loading}
          title="Tentar mapear com Traccar"
        >
          {loading ? <CircularProgress size={16} /> : <SyncIcon />}
        </IconButton>
        
        {message && (
          <Dialog open={!!message} onClose={() => setMessage(null)} maxWidth="sm" fullWidth>
            <DialogContent>
              <Alert severity={message.type} onClose={() => setMessage(null)}>
                {message.text}
              </Alert>
            </DialogContent>
          </Dialog>
        )}
      </>
    );
  }

  return (
    <>
      <IconButton size="small" onClick={handleMenuOpen}>
        <MoreVertIcon />
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {isBlocked ? (
          <MenuItem onClick={() => { setUnblockDialogOpen(true); handleMenuClose(); }}>
            <ListItemIcon>
              <LockOpenIcon color="success" />
            </ListItemIcon>
            <ListItemText primary="Desbloquear no Traccar" />
          </MenuItem>
        ) : (
          <MenuItem onClick={() => { setBlockDialogOpen(true); handleMenuClose(); }}>
            <ListItemIcon>
              <LockIcon color="error" />
            </ListItemIcon>
            <ListItemText primary="Bloquear no Traccar" />
          </MenuItem>
        )}

        <MenuItem onClick={handleSyncClient} disabled={loading}>
          <ListItemIcon>
            {loading ? <CircularProgress size={20} /> : <SyncIcon />}
          </ListItemIcon>
          <ListItemText primary="Sincronizar" />
        </MenuItem>
      </Menu>

      {/* Dialog de Bloqueio */}
      <Dialog open={blockDialogOpen} onClose={() => setBlockDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Bloquear Cliente no Traccar</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" paragraph>
            Tem certeza que deseja bloquear o acesso do cliente <strong>{client.name}</strong> no sistema Traccar?
          </Typography>
          
          <TextField
            fullWidth
            label="Motivo do bloqueio"
            multiline
            rows={3}
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="Digite o motivo do bloqueio (obrigatório)"
            margin="normal"
          />

          {message && (
            <Alert severity={message.type} sx={{ mt: 2 }}>
              {message.text}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBlockDialogOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleBlockClient}
            color="error"
            variant="contained"
            disabled={loading || !blockReason.trim()}
            startIcon={loading ? <CircularProgress size={16} /> : <LockIcon />}
          >
            {loading ? 'Bloqueando...' : 'Bloquear'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de Desbloqueio */}
      <Dialog open={unblockDialogOpen} onClose={() => setUnblockDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Desbloquear Cliente no Traccar</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" paragraph>
            Tem certeza que deseja desbloquear o acesso do cliente <strong>{client.name}</strong> no sistema Traccar?
          </Typography>
          
          {integration?.block_reason && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <strong>Motivo do bloqueio:</strong> {integration.block_reason}
            </Alert>
          )}

          {message && (
            <Alert severity={message.type} sx={{ mt: 2 }}>
              {message.text}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUnblockDialogOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleUnblockClient}
            color="success"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <LockOpenIcon />}
          >
            {loading ? 'Desbloqueando...' : 'Desbloquear'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TraccarActions;