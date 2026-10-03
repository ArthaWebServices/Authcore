import type { FastifyInstance, FastifyRequest, FastifyReply, FastifySchemaCompiler, FastifySchemaValidationError } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodType, ZodError, ZodSchema } from 'zod';

export interface ValidationSchemas {
  body?: ZodSchema;
  querystring?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
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
  fastify.setValidatorCompiler(({ schema }: any) => {
    return (data: unknown) => {
      if (schema && typeof (schema as any).safeParse === 'function') {
        const result = (schema as ZodSchema).safeParse(data);
        if (result.success) {
          return { value: result.data };
        }
        return {
          error: new Error(result.error.issues.map((i: any) => i.message).join(', ')),
        };
      }
      return { value: data };
    };
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
