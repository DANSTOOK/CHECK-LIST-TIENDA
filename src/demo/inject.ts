// Globales de Node que usa el código compartido (Buffer, process.env).
export { Buffer } from 'buffer';
export const process = { env: {} as Record<string, string | undefined>, argv: [] as string[], cwd: () => '/' };
