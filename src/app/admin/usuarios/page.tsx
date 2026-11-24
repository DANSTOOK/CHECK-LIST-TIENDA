import { IS_DEMO } from '@/lib/base';
import DemoPage from '@/components/DemoPage';
import { Empty } from '@/components/ui';
import { loadAdminUsuarios } from '@/lib/vistas/admin-usuarios';
import UsuariosAdmin from './UsuariosAdmin';

async function ServerPage() {
  const data = await loadAdminUsuarios();
  if (!data) return <div className="panel"><Empty icon="alert" title="Solo administradores" /></div>;
  return <UsuariosAdmin {...data} />;
}
export default IS_DEMO ? function Demo() { return <DemoPage vista="admin-usuarios" View={UsuariosAdmin} />; } : ServerPage;
