/**
 * Autenticación.
 * - Con AZURE_AD_* configurado: Microsoft Entra ID (next-auth). El usuario se crea
 *   solo en la tabla usuarios al primer acceso. El token de Graph (Mail.ReadWrite)
 *   se queda en el JWT del servidor y NO se expone al navegador.
 * - Sin configuración: "modo local" igual que el planificador: la persona elige su
 *   nombre y se guarda en una cookie. Útil para piloto y desarrollo.
 */
import type { NextAuthOptions } from 'next-auth';
import AzureADProvider from 'next-auth/providers/azure-ad';
import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';
import { db, newId, now } from './db';

export const entraEnabled = Boolean(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_TENANT_ID);
export const LOCAL_COOKIE = 'ckl-uid';

export const authOptions: NextAuthOptions = {
  providers: entraEnabled
    ? [
        AzureADProvider({
          clientId: process.env.AZURE_AD_CLIENT_ID!,
          clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
          tenantId: process.env.AZURE_AD_TENANT_ID!,
          // Mail.ReadWrite permite crear el borrador del correo en el buzón del usuario.
          authorization: { params: { scope: 'openid profile email offline_access User.Read Mail.ReadWrite' } },
        }),
      ]
    : [],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
        token.accessTokenExpires = (account.expires_at ?? 0) * 1000;
      }
      return token;
    },
  },
};

export type CurrentUser = { id: string; nombre: string; email: string | null; rol: string };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (entraEnabled) {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.toLowerCase();
    if (!email) return null;
    let u = await db.selectFrom('usuarios').selectAll().where('email', '=', email).executeTakeFirst();
    if (!u) {
      u = { id: newId(), nombre: session!.user!.name || email, email, rol: 'evaluador', activo: 1, created_at: now() };
      await db.insertInto('usuarios').values(u).execute();
    }
    return u.activo ? { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol } : null;
  }
  const id = (await cookies()).get(LOCAL_COOKIE)?.value;
  if (!id) return null;
  const u = await db.selectFrom('usuarios').select(['id', 'nombre', 'email', 'rol', 'activo']).where('id', '=', id).executeTakeFirst();
  return u && u.activo ? { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol } : null;
}
