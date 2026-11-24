import type { Metadata, Viewport } from 'next';
import './base.css';
import './ckl.css';
import { ToastProvider } from '@/components/ui';
import { DemoShell, Shell } from '@/components/Shell';
import { IS_DEMO } from '@/lib/base';
import { loadShell } from '@/lib/vistas/shell';

export const metadata: Metadata = { title: 'Checklist Operativo | Evaluación de tiendas', description: 'Checklist operativo de tiendas con evidencias, historial y dashboard.' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, colorScheme: 'light dark' };

// Aplica el tema guardado antes de pintar (evita parpadeo), igual que el planificador.
const themeScript = `try{const t=localStorage.getItem('ckl-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const shell = IS_DEMO ? null : await loadShell();
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
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
