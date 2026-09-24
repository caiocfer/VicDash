import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import type { LucideIcon } from 'lucide-react';

export interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

/**
 * Simple placeholder surface for routes that are not yet implemented
 * (`/cpu`, `/gpu`, `/home-assistant`). Matches the Catppuccin Mocha card style.
 */
export default function PlaceholderPage({
  title,
  description,
  icon: Icon,
}: PlaceholderPageProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        px: 2,
      }}
    >
      <Card sx={{ maxWidth: 560, width: '100%', textAlign: 'center' }}>
        <CardContent sx={{ py: 6 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              mb: 2,
              color: 'surface.divide',
            }}
          >
            <Icon width={56} height={56} strokeWidth={1.25} />
          </Box>
          <Typography variant="h4" color="text.primary" gutterBottom>
            {title}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {description}
          </Typography>
          <Typography
            variant="caption"
            sx={{ display: 'block', mt: 2, color: 'surface.divide' }}
          >
            Phase 2
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
