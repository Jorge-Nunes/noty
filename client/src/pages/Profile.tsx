import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  Divider,
} from '@mui/material';
import { Save, Person } from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import { useSnackbar } from 'notistack';

interface ProfileForm {
  name: string;
  email: string;
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

const schema = yup.object({
  name: yup.string().required('Nome é obrigatório'),
  email: yup.string().email('Email inválido').required('Email é obrigatório'),
  currentPassword: yup.string().optional(),
  newPassword: yup.string().min(6, 'Nova senha deve ter pelo menos 6 caracteres').optional(),
  confirmPassword: yup.string().oneOf([yup.ref('newPassword')], 'Senhas não coincidem').optional(),
});

export const Profile: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<ProfileForm>({
    resolver: yupResolver(schema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const newPassword = watch('newPassword');

  const onSubmit = async (data: ProfileForm) => {
    try {
      const updateData: any = {
        name: data.name,
      };

      if (data.newPassword) {
        updateData.password = data.newPassword;
      }

      const response = await authAPI.updateProfile(updateData);
      
      if (response.success) {
        enqueueSnackbar('Perfil atualizado com sucesso!', { variant: 'success' });
        await refreshUser();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Erro ao atualizar perfil';
      enqueueSnackbar(errorMessage, { variant: 'error' });
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Meu Perfil
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Person sx={{ mr: 2, color: 'primary.main' }} />
                <Typography variant="h6">
                  Informações Pessoais
                </Typography>
              </Box>

              <Box component="form" onSubmit={handleSubmit(onSubmit)}>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      {...register('name')}
                      fullWidth
                      label="Nome"
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
                      disabled // Email cannot be changed
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h6" gutterBottom>
                      Alterar Senha
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      {...register('currentPassword')}
                      fullWidth
                      label="Senha Atual"
                      type="password"
                      error={!!errors.currentPassword}
                      helperText={errors.currentPassword?.message}
                      disabled={isSubmitting}
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      {...register('newPassword')}
                      fullWidth
                      label="Nova Senha"
                      type="password"
                      error={!!errors.newPassword}
                      helperText={errors.newPassword?.message}
                      disabled={isSubmitting}
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      {...register('confirmPassword')}
                      fullWidth
                      label="Confirmar Nova Senha"
                      type="password"
                      error={!!errors.confirmPassword}
                      helperText={errors.confirmPassword?.message}
                      disabled={isSubmitting || !newPassword}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button
                        type="submit"
                        variant="contained"
                        startIcon={<Save />}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Informações da Conta
              </Typography>
              
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Função
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {user?.role === 'admin' ? 'Administrador' : 
                   user?.role === 'operator' ? 'Operador' : 'Visualizador'}
                </Typography>

                <Typography variant="body2" color="textSecondary">
                  Último Login
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {user?.last_login 
                    ? new Date(user.last_login).toLocaleString('pt-BR')
                    : 'Nunca'
                  }
                </Typography>

                <Typography variant="body2" color="textSecondary">
                  Conta criada em
                </Typography>
                <Typography variant="body1">
                  {user?.created_at 
                    ? new Date(user.created_at).toLocaleDateString('pt-BR')
                    : '-'
                  }
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};