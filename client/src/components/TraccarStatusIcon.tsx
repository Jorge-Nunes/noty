import React from 'react';
import { Tooltip, IconButton, Chip } from '@mui/material';
import {
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  QuestionMark as QuestionMarkIcon
} from '@mui/icons-material';

interface TraccarIntegration {
  traccar_user_id: number | null;
  mapping_method: 'EMAIL' | 'PHONE' | 'MANUAL' | 'NOT_MAPPED';
  is_blocked: boolean;
  last_sync_at: string | null;
  block_reason?: string | null;
}

interface TraccarStatusIconProps {
  integration?: TraccarIntegration | null;
  size?: 'small' | 'medium';
  variant?: 'icon' | 'chip';
}

const TraccarStatusIcon: React.FC<TraccarStatusIconProps> = ({
  integration,
  size = 'medium',
  variant = 'icon'
}) => {
  if (!integration) {
    // Cliente não mapeado
    const icon = <LinkOffIcon color="disabled" />;
    const tooltip = "Cliente não mapeado com Traccar";
    
    if (variant === 'chip') {
      return (
        <Tooltip title={tooltip}>
          <Chip
            icon={icon}
            label="Não Mapeado"
            size={size}
            color="default"
            variant="outlined"
          />
        </Tooltip>
      );
    }

    return (
      <Tooltip title={tooltip}>
        <IconButton size={size} disabled>
          {icon}
        </IconButton>
      </Tooltip>
    );
  }

  const { traccar_user_id, mapping_method, is_blocked, last_sync_at } = integration;

  // Determina o ícone e cor baseado no status
  let icon: React.ReactElement;
  let color: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning' = 'inherit';
  let tooltip: string;
  let chipLabel: string;

  if (!traccar_user_id || mapping_method === 'NOT_MAPPED') {
    // Não mapeado
    icon = <LinkOffIcon />;
    color = 'warning';
    tooltip = "Cliente não encontrado no Traccar";
    chipLabel = "Não Mapeado";
  } else if (is_blocked) {
    // Bloqueado
    icon = <LockIcon />;
    color = 'error';
    tooltip = "Cliente bloqueado no Traccar";
    chipLabel = "Bloqueado";
  } else {
    // Mapeado e ativo
    icon = <LockOpenIcon />;
    color = 'success';
    tooltip = `Mapeado via ${mapping_method.toLowerCase()}${last_sync_at ? ` - Sincronizado em ${new Date(last_sync_at).toLocaleString()}` : ''}`;
    chipLabel = "Ativo";
  }

  if (variant === 'chip') {
    return (
      <Tooltip title={tooltip}>
        <Chip
          icon={icon}
          label={chipLabel}
          size={size}
          color={color}
          variant={is_blocked ? 'filled' : 'outlined'}
        />
      </Tooltip>
    );
  }

  return (
    <Tooltip title={tooltip}>
      <IconButton size={size} color={color}>
        {icon}
      </IconButton>
    </Tooltip>
  );
};

export default TraccarStatusIcon;