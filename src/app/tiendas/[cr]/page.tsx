import { notFound } from 'next/navigation';
import { IS_DEMO } from '@/lib/base';
import DemoPage from '@/components/DemoPage';
import { loadTienda } from '@/lib/vistas/tienda';
import TiendaView from '@/app/tiendas/[cr]/TiendaView';

// En el modo demo (GitHub Pages) se genera una sola página "_" que sirve para cualquier cr.
export async function generateStaticParams() { return IS_DEMO ? [{ cr: '_' }] : []; }

async function ServerPage({ params }: { params: Promise<{ cr: string }> }) {
  const data = await loadTienda((await params).cr);
  if (!data) notFound();
  return <TiendaView {...data} />;
}

export default IS_DEMO ? function Demo() { return <DemoPage vista="tienda" param="cr" View={TiendaView} />; } : ServerPage;
