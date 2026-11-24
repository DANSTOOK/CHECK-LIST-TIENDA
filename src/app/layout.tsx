import type { Metadata, Viewport } from 'next';
import './base.css';
import './ckl.css';
import './mobile.css';
import './effects.css';
import { ToastProvider } from '@/components/ui';
import { DemoShell, Shell } from '@/components/Shell';
import { IS_DEMO } from '@/lib/base';
import { loadShell } from '@/lib/vistas/shell';

export const metadata: Metadata = { title: 'Checklist Operativo | Evaluación de tiendas', description: 'Checklist operativo de tiendas con evidencias, historial y dashboard.' };
// Siempre en modo claro (data-theme="light" desactiva el tema oscuro de base.css).
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', colorScheme: 'light', themeColor: '#f6f5f2' };


export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const shell = IS_DEMO ? null : await loadShell();
  return (
    <html lang="es" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ToastProvider>
          {shell ? <Shell {...shell}>{children}</Shell> : <DemoShell>{children}</DemoShell>}
        </ToastProvider>
      </body>
    </html>
  );
}
