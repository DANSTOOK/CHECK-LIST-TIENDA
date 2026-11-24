// Módulos de Node/Next que no existen en el navegador (solo lo que usa el código compartido).
export const promises = { readFile: async () => { throw new Error('No disponible en demo'); } };
const join = (...p: string[]) => p.join('/');
export default { join, resolve: join, dirname: (p: string) => p.split('/').slice(0, -1).join('/') };
export { join };
export async function getToken() { return null; }
