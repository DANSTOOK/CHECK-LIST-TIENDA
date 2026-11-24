'use client';
import { u } from '@/lib/base';
import { useState } from 'react';
import { api, Icon, useToast, useAppRouter } from '@/components/ui';

export default function StartButton({ tiendaId, borradorId }: { tiendaId: string; borradorId?: string }) {
  const router = useAppRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (borradorId) return router.push(`/evaluaciones/${borradorId}`);
    setBusy(true);
    try {
      const r = await api<{ id: string }>(u('/api/evaluaciones'), { body: { tiendaId } });
      router.push(`/evaluaciones/${r.id}`); router.refresh();
    } catch (e) { toast((e as Error).message, true); setBusy(false); }
  };
  return (
    <button className={`btn ${borradorId ? '' : 'btn-primary'}`} type="button" onClick={go} disabled={busy}>
      <Icon n={borradorId ? 'edit' : 'check'} />{busy ? 'Abriendo…' : borradorId ? 'Continuar checklist' : 'Iniciar checklist'}
    </button>
  );
}
