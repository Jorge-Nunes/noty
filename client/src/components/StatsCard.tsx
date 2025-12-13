import React, { ReactElement } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  useTheme,
} from '@mui/material';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactElement;
  color: string;
  subtitle?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  color,
  subtitle,
}) => {
  const theme = useTheme();

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box
            sx={{
              p: 1,
              borderRadius: '50%',
              backgroundColor: color + '20',
              color: color,
              mr: 2,
            }}
          >
            {React.cloneElement(icon, { fontSize: 'medium' })}
          </Box>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {title}
          </Typography>
        </Box>

        <Typography
          variant="h3"
          component="div"
          sx={{
            fontWeight: 'bold',
            color: color,
            mb: subtitle ? 1 : 0,
          }}
        >
          {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
        </Typography>

        {subtitle && (
          <Typography variant="body2" color="textSecondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};