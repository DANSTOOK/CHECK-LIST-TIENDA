import { getCurrentUser, type CurrentUser } from './auth';

export const ok = (data: unknown, status = 200) => Response.json(data, { status });
export const fail = (message: string, status = 400) => Response.json({ error: message }, { status });

/** Envuelve un handler: exige sesión (y rol admin si se pide) y convierte errores en JSON. */
export function handler<C>(fn: (req: Request, ctx: C, user: CurrentUser) => Promise<Response>, opts: { admin?: boolean } = {}) {
  return async (req: Request, ctx: C) => {
    try {
      const user = await getCurrentUser();
      if (!user) return fail('Inicia sesión para continuar', 401);
      if (opts.admin && user.rol !== 'admin') return fail('Solo un administrador puede hacer esto', 403);
      return await fn(req, ctx, user);
    } catch (e) {
      console.error(e);
      return fail(e instanceof Error ? e.message : 'Error inesperado', 500);
    }
  };
}

export const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
