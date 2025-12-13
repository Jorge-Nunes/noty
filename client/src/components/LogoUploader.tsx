import React, { useRef, useState } from 'react';
import {
    Box,
    Button,
    Typography,
    IconButton,
    Paper,
    Alert,
    CircularProgress,
} from '@mui/material';
import {
    CloudUpload,
    Delete,
    Image as ImageIcon,
} from '@mui/icons-material';

interface LogoUploaderProps {
    value: string | null;
    onChange: (base64: string | null) => void;
    maxSizeKB?: number;
    disabled?: boolean;
}

export const LogoUploader: React.FC<LogoUploaderProps> = ({
    value,
    onChange,
    maxSizeKB = 500,
    disabled = false,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];

    const handleFileSelect = async (file: File) => {
        setError(null);
        setIsLoading(true);

        try {
            // Validate file type
            if (!allowedTypes.includes(file.type)) {
                setError('Tipo de arquivo não permitido. Use PNG, JPG, SVG ou WebP.');
                setIsLoading(false);
                return;
            }

            // Validate file size
            const fileSizeKB = file.size / 1024;
            if (fileSizeKB > maxSizeKB) {
                setError(`Arquivo muito grande. Tamanho máximo: ${maxSizeKB}KB`);
                setIsLoading(false);
                return;
            }

            // Convert to Base64
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target?.result as string;
                onChange(base64);
                setIsLoading(false);
            };
            reader.onerror = () => {
                setError('Erro ao ler o arquivo');
                setIsLoading(false);
            };
            reader.readAsDataURL(file);
        } catch (err) {
            setError('Erro ao processar a imagem');
            setIsLoading(false);
        }
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    const handleDragOver = (event: React.DragEvent) => {
        event.preventDefault();
        if (!disabled) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (event: React.DragEvent) => {
        event.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (event: React.DragEvent) => {
        event.preventDefault();
        setIsDragging(false);

        if (disabled) return;

        const file = event.dataTransfer.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    const handleRemove = () => {
        onChange(null);
        setError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleClick = () => {
        if (!disabled) {
            fileInputRef.current?.click();
        }
    };

    return (
        <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 500 }}>
                Logo da Empresa
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Faça upload de uma imagem para exibir na tela de login. Formatos: PNG, JPG, SVG, WebP. Tamanho máximo: {maxSizeKB}KB.
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.svg,.webp"
                onChange={handleInputChange}
                style={{ display: 'none' }}
                disabled={disabled}
            />

            {value ? (
                <Paper
                    sx={{
                        p: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: 'grey.50',
                        border: '1px solid',
                        borderColor: 'grey.200',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box
                            component="img"
                            src={value}
                            alt="Logo preview"
                            sx={{
                                maxWidth: 150,
                                maxHeight: 60,
                                objectFit: 'contain',
                            }}
                        />
                        <Typography variant="body2" color="textSecondary">
                            Logo carregada
                        </Typography>
                    </Box>
                    <Box>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={handleClick}
                            disabled={disabled}
                            sx={{ mr: 1 }}
                        >
                            Alterar
                        </Button>
                        <IconButton
                            color="error"
                            onClick={handleRemove}
                            disabled={disabled}
                            size="small"
                        >
                            <Delete />
                        </IconButton>
                    </Box>
                </Paper>
            ) : (
                <Paper
                    onClick={handleClick}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    sx={{
                        p: 4,
                        textAlign: 'center',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        border: '2px dashed',
                        borderColor: isDragging ? 'primary.main' : 'grey.300',
                        backgroundColor: isDragging ? 'primary.50' : 'grey.50',
                        transition: 'all 0.2s ease',
                        '&:hover': !disabled ? {
                            borderColor: 'primary.main',
                            backgroundColor: 'primary.50',
                        } : {},
                    }}
                >
                    {isLoading ? (
                        <CircularProgress size={40} />
                    ) : (
                        <>
                            <CloudUpload sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                            <Typography variant="body1" color="textSecondary">
                                Clique ou arraste uma imagem aqui
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                                PNG, JPG, SVG ou WebP (máx. {maxSizeKB}KB)
                            </Typography>
                        </>
                    )}
                </Paper>
            )}
        </Box>
    );
};
