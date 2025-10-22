import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    user: {
      id: string;
      roles: string[];
      tenantId: string;
    };
  }
}

// This is the shape of the JWT payload we expect.
interface JwtPayload {
  sub: string;
  roles: string[];
  tenant_id: string;
}

export default fp(async (fastify) => {
  fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'a-very-secret-key-that-should-be-in-env',
  });

  // This decorator can be used for route-specific authentication if needed,
  // but we will use a global hook in server.ts for this project.
  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
        const payload = request.user as unknown as JwtPayload;
        // Remap the raw JWT payload to our desired request.user structure
        request.user = {
          id: payload.sub,
          roles: payload.roles,
          tenantId: payload.tenant_id,
        };
      } catch (err) {
        reply
          .code(401)
          .send({ code: 'UNAUTHORIZED', message: 'Invalid or missing token.' });
      }
    },
  );
});