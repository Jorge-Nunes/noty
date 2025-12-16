import React from 'react';
import { Box } from '@mui/material';
import { DataGrid, DataGridProps } from '@mui/x-data-grid';

interface ResponsiveDataGridProps extends Omit<DataGridProps, 'sx'> {
  minHeight?: number;
}

export const ResponsiveDataGrid: React.FC<ResponsiveDataGridProps> = ({ 
  minHeight = 400, 
  ...props 
}) => {
  return (
    <Box sx={{ 
      width: '100%', 
      overflow: 'hidden',
      minHeight: minHeight 
    }}>
      <DataGrid
        {...props}
        sx={{
          border: 'none',
          '& .MuiDataGrid-main': {
            overflow: 'visible'
          },
          '& .MuiDataGrid-virtualScroller': {
            overflow: 'visible'
          },
          '& .MuiDataGrid-columnHeaders': {
            overflow: 'visible',
            backgroundColor: 'background.paper'
          },
          '& .MuiDataGrid-row': {
            maxHeight: 'none !important'
          },
          '& .MuiDataGrid-cell': {
            maxHeight: 'none !important',
            overflow: 'visible',
            whiteSpace: 'normal',
            lineHeight: '1.2',
            padding: '8px',
            display: 'flex',
            alignItems: 'center'
          },
          '& .MuiDataGrid-actionsCell': {
            overflow: 'visible'
          },
          '& .MuiDataGrid-columnHeaderTitle': {
            fontWeight: 600
          },
          // Mobile responsiveness
          '@media (max-width: 900px)': {
            '& .MuiDataGrid-columnHeaders': {
              fontSize: '0.875rem'
            },
            '& .MuiDataGrid-cell': {
              fontSize: '0.875rem',
              padding: '6px'
            }
          },
          '@media (max-width: 600px)': {
            '& .MuiDataGrid-columnHeaders': {
              fontSize: '0.8rem'
            },
            '& .MuiDataGrid-cell': {
              fontSize: '0.8rem',
              padding: '4px'
            }
          }
        }}
      />
    </Box>
  );
};