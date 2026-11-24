import { notFound } from 'next/navigation';
import { IS_DEMO } from '@/lib/base';
import DemoPage from '@/components/DemoPage';
import { loadDashboard } from '@/lib/vistas/dashboard';
import DashboardView from './DashboardView';

async function ServerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const data = await loadDashboard(await searchParams);
  void notFound;
  return <DashboardView {...data} />;
}

export default IS_DEMO ? function Demo() { return <DemoPage vista="dashboard" View={DashboardView} />; } : ServerPage;
