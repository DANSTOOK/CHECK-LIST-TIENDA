import { IS_DEMO } from '@/lib/base';
import DemoPage from '@/components/DemoPage';
import { loadTiendas } from '@/lib/vistas/tiendas';
import TiendasView from './TiendasView';

async function ServerPage() {
  const data = await loadTiendas();
  return data ? <TiendasView {...data} /> : null;
}
export default IS_DEMO ? function Demo() { return <DemoPage vista="tiendas" View={TiendasView} />; } : ServerPage;
