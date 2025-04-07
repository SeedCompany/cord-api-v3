// eslint-disable-next-line no-restricted-imports,@seedcompany/no-restricted-imports
import * as Nest from '@nestjs/common';
import * as Fastify from 'fastify';
import { Neo4jError } from 'neo4j-driver';
import { InputException, ServerException } from '~/common';
import * as Neo from '../database/errors';
import { ExceptionNormalizer } from './exception.normalizer';

describe('ExceptionNormalizer', () => {
  const sut = new ExceptionNormalizer();
  // Simulate over the wire.
  const orig = sut.normalize.bind(sut);
  sut.normalize = (...args) => JSON.parse(JSON.stringify(orig(...args)));

  describe('Fastify', () => {
    it('Client', () => {
      const ex = new Fastify.errorCodes.FST_ERR_CTP_BODY_TOO_LARGE();
      const res = sut.normalize({ ex });
      expect(res.message).toEqual('Request body is too large');
      expect(res.code).toEqual('FST_ERR_CTP_BODY_TOO_LARGE');
      expect(res.codes).toEqual(['FST_ERR_CTP_BODY_TOO_LARGE', 'Client']);
    });
    it('Server', () => {
      const ex = new Fastify.errorCodes.FST_ERR_HOOK_INVALID_TYPE();
      const res = sut.normalize({ ex });
      expect(res.message).toEqual('The hook name must be a string');
      expect(res.code).toEqual('FST_ERR_HOOK_INVALID_TYPE');
      expect(res.codes).toEqual(['FST_ERR_HOOK_INVALID_TYPE', 'Server']);
    });
  });

  describe('HttpException', () => {
    it('simple', () => {
      const ex = new Nest.NotFoundException();
      const res = sut.normalize({ ex });
      expect(res.message).toEqual('Not Found');
      expect(res.code).toEqual('NotFound');
      expect(res.codes).toEqual(['NotFound', 'Client']);
    });

    it('custom message', () => {
      const ex = new Nest.NotFoundException('Could not find resource');
      const res = sut.normalize({ ex });
      expect(res.message).toEqual('Could not find resource');
      expect(res.code).toEqual('NotFound');
      expect(res.codes).toEqual(['NotFound', 'Client']);
    });

    it('custom code', () => {
      const ex = new Nest.NotFoundException(
        'Could not find resource',
        'CustomNotFound',
      );
      const res = sut.normalize({ ex });
      expect(res.message).toEqual('Could not find resource');
      expect(res.code).toEqual('CustomNotFound');
      expect(res.codes).toEqual(['CustomNotFound', 'NotFound', 'Client']);
    });

    it('custom error object with message', () => {
      const ex = new Nest.NotFoundException(
        { message: 'Could not find resource', foo: 'bar' },
        'Ignored',
      );
      const res = sut.normalize({ ex });
      expect(res.message).toEqual('Could not find resource');
      expect(res.code).toEqual('NotFound');
      expect(res.codes).toEqual(['NotFound', 'Client']);
      expect(res.foo).toEqual('bar');
    });

    it('custom error object with message & code', () => {
      const ex = new Nest.NotFoundException(
        {
          message: 'Could not find resource',
          code: 'CustomNotFound',
          foo: 'bar',
        },
        'Ignored',
      );
      const res = sut.normalize({ ex });
      expect(res.message).toEqual('Could not find resource');
      expect(res.code).toEqual('CustomNotFound');
      expect(res.codes).toEqual(['CustomNotFound', 'NotFound', 'Client']);
      expect(res.foo).toEqual('bar');
    });

    it('custom error object without message', () => {
      const ex = new Nest.NotFoundException(
        { description: 'Could not find resource' },
        'Ignored',
      );
      const res = sut.normalize({ ex });
      expect(res.message).toEqual('Not Found Exception');
      expect(res.code).toEqual('NotFound');
      expect(res.codes).toEqual(['NotFound', 'Client']);
      expect(res.description).toEqual('Could not find resource');
    });

    it('BadRequestException', () => {
      const ex = new Nest.BadRequestException('what happened');
      const res = sut.normalize({ ex });
      expect(res.message).toEqual('what happened');
      expect(res.code).toEqual('Input');
      expect(res.codes).toEqual(['Input', 'Client']);
    });

    it('ForbiddenException', () => {
      const ex = new Nest.ForbiddenException();
      const res = sut.normalize({ ex });
      expect(res.code).toEqual('Unauthorized');
      expect(res.codes).toEqual(['Unauthorized', 'Client']);
    });

    it('UnauthorizedException', () => {
      const ex = new Nest.UnauthorizedException();
      const res = sut.normalize({ ex });
      expect(res.code).toEqual('Unauthenticated');
      expect(res.codes).toEqual(['Unauthenticated', 'Client']);
    });
  });

  it('ServerException', () => {
    const ex = new ServerException('what happened');
    const res = sut.normalize({ ex });
    expect(res.message).toEqual('what happened');
    expect(res.code).toEqual('Server');
    expect(res.codes).toEqual(['Server']);
  });

  it('InputException', () => {
    const ex = new InputException('what happened', 'field.name');
    const res = sut.normalize({ ex });
    expect(res.message).toEqual('what happened');
    expect(res.code).toEqual('Input');
    expect(res.codes).toEqual(['Input', 'Client']);
    expect(res.field).toEqual('field.name');
  });

  it('Generic Error', () => {
    const ex = new Error('what happened');
    const res = sut.normalize({ ex });
    expect(res.message).toEqual('what happened');
    expect(res.code).toEqual('Server');
    expect(res.codes).toEqual(['Server']);
  });

  describe('Neo4j', () => {
    it('Syntax Error', () => {
      const ex = new Neo4jError('Bad syntax', Neo.SyntaxError.code, '', '');
      const res = sut.normalize({ ex });
      expect(res.message).toEqual('Failed');
      expect(res.code).toEqual('Syntax');
      expect(res.codes).toEqual(['Syntax', 'Database', 'Server']);
    });

    it('Constraint Error', () => {
      const ex = new Neo4jError('Bad syntax', Neo.ConstraintError.code, '', '');
      const res = sut.normalize({ ex });
      expect(res.message).toEqual('Failed');
      expect(res.code).toEqual('ConstraintValidation');
      expect(res.codes).toEqual(['ConstraintValidation', 'Database', 'Server']);
    });

    it('Unknown Error', () => {
      const ex = new Neo4jError('what happened', 'N/A', '', '');
      const res = sut.normalize({ ex });
      expect(res.message).toEqual('Failed');
      expect(res.code).toEqual('Database');
      expect(res.codes).toEqual(['Database', 'Server']);
    });
  });

  it('Unknown Error', () => {
    const ex = new Error('what happened');
    const res = sut.normalize({ ex });
    expect(res.message).toEqual('what happened');
    expect(res.code).toEqual('Server');
    expect(res.codes).toEqual(['Server']);
  });
});
