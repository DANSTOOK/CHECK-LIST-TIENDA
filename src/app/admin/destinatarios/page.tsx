import { IS_DEMO } from '@/lib/base';
import DemoPage from '@/components/DemoPage';
import { Empty } from '@/components/ui';
import { loadAdminDestinatarios } from '@/lib/vistas/admin-destinatarios';
import DestinatariosAdmin from './DestinatariosAdmin';

async function ServerPage() {
  const data = await loadAdminDestinatarios();
  if (!data) return <div className="panel"><Empty icon="alert" title="Solo administradores" /></div>;
  return <DestinatariosAdmin {...data} />;
}
export default IS_DEMO ? function Demo() { return <DemoPage vista="admin-destinatarios" View={DestinatariosAdmin} />; } : ServerPage;
