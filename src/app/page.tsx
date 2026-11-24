// Inicio: el checklist y la elección de la tienda a evaluar.
import { IS_DEMO } from '@/lib/base';
import DemoPage from '@/components/DemoPage';
import { loadInicio } from '@/lib/vistas/inicio';
import InicioView from './InicioView';

async function ServerPage() {
  const data = await loadInicio();
  return data ? <InicioView {...data} /> : null;
}
export default IS_DEMO ? function Demo() { return <DemoPage vista="inicio" View={InicioView} />; } : ServerPage;
