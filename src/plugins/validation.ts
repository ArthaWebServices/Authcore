import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodType, ZodError } from 'zod';
import { logger } from '@shared/logger';

export interface ValidationSchemas {
  body?: ZodType;
  querystring?: ZodType;
  params?: ZodType;
  headers?: ZodType;
}

declare module 'fastify' {
  interface FastifyRequest {
    validatedBody?: unknown;
    validatedQuerystring?: unknown;
    validatedParams?: unknown;
    validatedHeaders?: unknown;
  }
}

function parseZodError(error: ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || 'root';
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(issue.message);
  }
  return errors;
}

export async function validationPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.setValidatorCompiler(({ schema }) => {
    if (schema && typeof schema === 'object' && 'validate' in schema) {
      return ({ data }) => {
        try {
          const result = (schema.validate as ZodType<unknown>).safeParse(data);
          if (result.success) {
            return { value: result.data };
          }
          return {
            error: {
              message: 'Validation failed',
              issues: result.error.issues,
            },
          };
        } catch {
          return {
            error: {
              message: 'Validation error',
              issues: [],
            },
          };
        }
      };
    }
    return ({ data }) => ({ value: data });
  });

  fastify.setSchemaController((schemas, _router, setErrorHandler) => {
    setErrorHandler((_request, reply, error) => {
      if (error.validation) {
        const validationErrors: Record<string, string[]> = {};
        for (const err of error.validation) {
          const path = err.instancePath?.replace(/^\//, '') || err.params?.missingProperty || 'unknown';
          if (!validationErrors[path]) {
            validationErrors[path] = [];
          }
          validationErrors[path].push(err.message || 'Invalid value');
        }
        return reply.status(400).send({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validationErrors,
        });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    });
  });
}

export function createValidatorHook(schemas: ValidationSchemas) {
  return async function validatorHook(
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    if (schemas.body) {
      const result = schemas.body.safeParse(request.body);
      if (result.success) {
        request.validatedBody = result.data;
      } else {
        request.log.warn({ errors: parseZodError(result.error) }, 'Body validation failed');
        throw { validation: parseZodError(result.error) };
      }
    }
    if (schemas.querystring) {
      const result = schemas.querystring.safeParse(request.query);
      if (result.success) {
        request.validatedQuerystring = result.data;
      } else {
        request.log.warn({ errors: parseZodError(result.error) }, 'Querystring validation failed');
        throw { validation: parseZodError(result.error) };
      }
    }
    if (schemas.params) {
      const result = schemas.params.safeParse(request.params);
      if (result.success) {
        request.validatedParams = result.data;
      } else {
        request.log.warn({ errors: parseZodError(result.error) }, 'Params validation failed');
        throw { validation: parseZodError(result.error) };
      }
    }
  };
}
