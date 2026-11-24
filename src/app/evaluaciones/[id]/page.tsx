import { notFound } from 'next/navigation';
import { IS_DEMO } from '@/lib/base';
import DemoPage from '@/components/DemoPage';
import { loadEvaluacion } from '@/lib/vistas/evaluacion';
import EvaluacionView from './EvaluacionView';

// En el modo demo (GitHub Pages) se genera una sola página "_" que sirve para cualquier id.
export async function generateStaticParams() { return IS_DEMO ? [{ id: '_' }] : []; }

async function ServerPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await loadEvaluacion((await params).id);
  if (!data) notFound();
  return <EvaluacionView {...data} />;
}

export default IS_DEMO ? function Demo() { return <DemoPage vista="evaluacion" param="id" View={EvaluacionView} />; } : ServerPage;
