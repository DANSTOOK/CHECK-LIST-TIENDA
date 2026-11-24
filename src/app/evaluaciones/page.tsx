import { notFound } from 'next/navigation';
import { IS_DEMO } from '@/lib/base';
import DemoPage from '@/components/DemoPage';
import { loadHistorial } from '@/lib/vistas/historial';
import HistorialView from '@/app/evaluaciones/HistorialView';

async function ServerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const data = await loadHistorial(await searchParams);
  void notFound;
  return <HistorialView {...data} />;
}

export default IS_DEMO ? function Demo() { return <DemoPage vista="historial" View={HistorialView} />; } : ServerPage;
