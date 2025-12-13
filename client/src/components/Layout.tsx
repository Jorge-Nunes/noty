import React, { useState, useEffect, ReactNode } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery,
  Avatar,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  People,
  Payment,
  Settings,
  AutoMode,
  AccountCircle,
  Logout,
  ChevronLeft,
  ChevronRight,
  TrackChanges,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const drawerWidth = 240;
const collapsedDrawerWidth = 72;

interface LayoutProps {
  children: ReactNode;
}

const menuItems = [
  { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
  { text: 'Clientes', icon: <People />, path: '/clients' },
  { text: 'Cobranças', icon: <Payment />, path: '/payments' },
  { text: 'Automação', icon: <AutoMode />, path: '/automation' },
  { text: 'Configurações', icon: <Settings />, path: '/config' },
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [drawerCollapsed, setDrawerCollapsed] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  // Fetch company logo
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const response = await fetch('/api/config/company-logo');
        const data = await response.json();
        if (data.success && data.data?.value) {
          setCompanyLogo(data.data.value);
        }
      } catch (error) {
        console.error('Error fetching company logo:', error);
      }
    };
    fetchLogo();
  }, []);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDrawerCollapse = () => {
    setDrawerCollapsed(!drawerCollapsed);
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleProfileClick = () => {
    handleMenuClose();
    navigate('/profile');
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
    navigate('/login');
  };

  const drawer = (
    <Box>
      <Toolbar sx={{ justifyContent: drawerCollapsed && !isMobile ? 'center' : 'space-between' }}>
        {(!drawerCollapsed || isMobile) && (
          companyLogo ? (
            <Box
              component="img"
              src={companyLogo}
              alt="Logo"
              sx={{
                maxWidth: 120,
                maxHeight: 40,
                objectFit: 'contain',
              }}
            />
          ) : (
            <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 'bold' }}>
              NOTY
            </Typography>
          )
        )}

        {/* Botão de colapsar para desktop */}
        {!isMobile && (
          <IconButton
            onClick={handleDrawerCollapse}
            sx={{
              color: 'primary.main',
              '&:hover': { backgroundColor: 'primary.light' + '20' }
            }}
          >
            {drawerCollapsed ? <ChevronRight /> : <ChevronLeft />}
          </IconButton>
        )}

        {/* Botão de fechar para mobile */}
        {isMobile && (
          <IconButton
            color="inherit"
            aria-label="close drawer"
            edge="end"
            onClick={handleDrawerToggle}
            sx={{ ml: 'auto' }}
          >
            <ChevronLeft />
          </IconButton>
        )}
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem
            key={item.text}
            disablePadding
            sx={{
              display: 'block',
              px: drawerCollapsed && !isMobile ? 1 : 0
            }}
          >
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => {
                navigate(item.path);
                if (isMobile) {
                  setMobileOpen(false);
                }
              }}
              sx={{
                minHeight: 48,
                justifyContent: drawerCollapsed && !isMobile ? 'center' : 'initial',
                px: drawerCollapsed && !isMobile ? 0 : 2.5,
                '&.Mui-selected': {
                  backgroundColor: theme.palette.primary.main + '20',
                  '&:hover': {
                    backgroundColor: theme.palette.primary.main + '30',
                  },
                },
              }}
              title={drawerCollapsed && !isMobile ? item.text : ''}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: drawerCollapsed && !isMobile ? 0 : 3,
                  justifyContent: 'center',
                  color: location.pathname === item.path
                    ? theme.palette.primary.main
                    : 'inherit'
                }}
              >
                {item.icon}
              </ListItemIcon>

              {(!drawerCollapsed || isMobile) && (
                <ListItemText
                  primary={item.text}
                  sx={{
                    opacity: drawerCollapsed && !isMobile ? 0 : 1,
                    '& .MuiListItemText-primary': {
                      color: location.pathname === item.path
                        ? theme.palette.primary.main
                        : 'inherit',
                      fontWeight: location.pathname === item.path ? 600 : 400,
                    },
                  }}
                />
              )}
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  const currentDrawerWidth = drawerCollapsed ? collapsedDrawerWidth : drawerWidth;

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${currentDrawerWidth}px)` },
          ml: { md: `${currentDrawerWidth}px` },
          transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Sistema de Cobrança Automatizada
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography
              variant="body2"
              sx={{ mr: 1, display: { xs: 'none', sm: 'block' } }}
            >
              {user?.name}
            </Typography>
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenuClick}
              color="inherit"
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </Avatar>
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
            >
              <MenuItem onClick={handleProfileClick}>
                <ListItemIcon>
                  <AccountCircle fontSize="small" />
                </ListItemIcon>
                <ListItemText>Perfil</ListItemText>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <Logout fontSize="small" />
                </ListItemIcon>
                <ListItemText>Sair</ListItemText>
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{
          width: { md: currentDrawerWidth },
          flexShrink: { md: 0 },
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
        aria-label="mailbox folders"
      >
        {/* Mobile Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>

        {/* Desktop Drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: currentDrawerWidth,
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
              overflowX: 'hidden',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${currentDrawerWidth}px)` },
          mt: '64px',
          minHeight: 'calc(100vh - 64px)',
          backgroundColor: theme.palette.background.default,
          transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        {children}
      </Box>
    </Box>
  );
};