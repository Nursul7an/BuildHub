import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Permission, Role } from '@build-hub/shared';

declare module 'fastify' {
  interface FastifyInstance {
    /** Проверяет токен и не пускает дальше смены пароля, пока пароль временный. */
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** Право из матрицы ролей — фильтр стоит на сервере, не в клиенте. */
    requirePermission: (
      permission: Permission,
    ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    currentUser: { id: string; role: Role; login: string; mustChangePassword: boolean };
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; role: Role; sid?: string };
    user: { sub: string; role: Role; sid?: string };
  }
}

export {};
