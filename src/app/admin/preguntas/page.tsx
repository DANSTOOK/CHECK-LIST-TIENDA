import { IS_DEMO } from '@/lib/base';
import DemoPage from '@/components/DemoPage';
import { Empty } from '@/components/ui';
import { loadAdminPreguntas } from '@/lib/vistas/admin-preguntas';
import PreguntasAdmin from './PreguntasAdmin';

async function ServerPage() {
  const data = await loadAdminPreguntas();
  if (!data) return <div className="panel"><Empty icon="alert" title="Solo administradores" /></div>;
  return <PreguntasAdmin {...data} />;
}
export default IS_DEMO ? function Demo() { return <DemoPage vista="admin-preguntas" View={PreguntasAdmin} />; } : ServerPage;
