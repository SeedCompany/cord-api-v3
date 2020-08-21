/* eslint-disable no-restricted-imports */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
/* eslint-enable no-restricted-imports */
import { InputException, ServerException } from '../common/exceptions';
import { ConstraintError } from './database';
import { ExceptionFilter } from './exception.filter';

describe('ExceptionFilter', () => {
  const filter = new ExceptionFilter();

  describe('HttpException', () => {
    it('simple', () => {
      const ex = new NotFoundException();
      const res = filter.catchGql(ex);
      expect(res.message).toEqual('Not Found');
      expect(res.extensions.status).toEqual(404);
      expect(res.extensions.code).toEqual('NotFound');
      expect(res.extensions.codes).toEqual(['NotFound', 'Client']);
    });

    it('custom message', () => {
      const ex = new NotFoundException('Could not find resource');
      const res = filter.catchGql(ex);
      expect(res.message).toEqual('Could not find resource');
      expect(res.extensions.status).toEqual(404);
      expect(res.extensions.code).toEqual('NotFound');
      expect(res.extensions.codes).toEqual(['NotFound', 'Client']);
    });

    it('custom code', () => {
      const ex = new NotFoundException(
        'Could not find resource',
        'CustomNotFound'
      );
      const res = filter.catchGql(ex);
      expect(res.message).toEqual('Could not find resource');
      expect(res.extensions.status).toEqual(404);
      expect(res.extensions.code).toEqual('CustomNotFound');
      expect(res.extensions.codes).toEqual([
        'CustomNotFound',
        'NotFound',
        'Client',
      ]);
    });

    it('custom error object with message', () => {
      const ex = new NotFoundException(
        { message: 'Could not find resource', foo: 'bar' },
        'Ignored'
      );
      const res = filter.catchGql(ex);
      expect(res.message).toEqual('Could not find resource');
      expect(res.extensions.status).toEqual(404);
      expect(res.extensions.code).toEqual('NotFound');
      expect(res.extensions.codes).toEqual(['NotFound', 'Client']);
      expect(res.extensions.foo).toEqual('bar');
    });

    it('custom error object with message & code', () => {
      const ex = new NotFoundException(
        {
          message: 'Could not find resource',
          code: 'CustomNotFound',
          foo: 'bar',
        },
        'Ignored'
      );
      const res = filter.catchGql(ex);
      expect(res.message).toEqual('Could not find resource');
      expect(res.extensions.status).toEqual(404);
      expect(res.extensions.code).toEqual('CustomNotFound');
      expect(res.extensions.codes).toEqual([
        'CustomNotFound',
        'NotFound',
        'Client',
      ]);
      expect(res.extensions.foo).toEqual('bar');
    });

    it('custom error object without message', () => {
      const ex = new NotFoundException(
        { description: 'Could not find resource' },
        'Ignored'
      );
      const res = filter.catchGql(ex);
      expect(res.message).toEqual('Not Found Exception');
      expect(res.extensions.status).toEqual(404);
      expect(res.extensions.code).toEqual('NotFound');
      expect(res.extensions.codes).toEqual(['NotFound', 'Client']);
      expect(res.extensions.description).toEqual('Could not find resource');
    });

    it('BadRequestException', () => {
      const ex = new BadRequestException('what happened');
      const res = filter.catchGql(ex);
      expect(res.message).toEqual('what happened');
      expect(res.extensions.status).toEqual(400);
      expect(res.extensions.code).toEqual('Input');
      expect(res.extensions.codes).toEqual(['Input', 'Client']);
    });

    it('ForbiddenException', () => {
      const ex = new ForbiddenException();
      const res = filter.catchGql(ex);
      expect(res.extensions.code).toEqual('Unauthorized');
      expect(res.extensions.codes).toEqual(['Unauthorized', 'Client']);
    });

    it('UnauthorizedException', () => {
      const ex = new UnauthorizedException();
      const res = filter.catchGql(ex);
      expect(res.extensions.code).toEqual('Unauthenticated');
      expect(res.extensions.codes).toEqual(['Unauthenticated', 'Client']);
    });
  });

  it('ServerException', () => {
    const ex = new ServerException('what happened');
    const res = filter.catchGql(ex);
    expect(res.message).toEqual('what happened');
    expect(res.extensions.status).toEqual(500);
    expect(res.extensions.code).toEqual('Server');
    expect(res.extensions.codes).toEqual(['Server']);
  });

  it('InputException', () => {
    const ex = new InputException('what happened', 'field.name');
    const res = filter.catchGql(ex);
    expect(res.message).toEqual('what happened');
    expect(res.extensions.status).toEqual(400);
    expect(res.extensions.code).toEqual('Input');
    expect(res.extensions.codes).toEqual(['Input', 'Client']);
    expect(res.extensions.field).toEqual('field.name');
  });

  it('Generic Error', () => {
    const ex = new Error('what happened');
    const res = filter.catchGql(ex);
    expect(res.message).toEqual('what happened');
    expect(res.extensions.status).toEqual(500);
    expect(res.extensions.code).toEqual('InternalServerError');
    expect(res.extensions.codes).toEqual(['InternalServerError']);
  });

  it('Unknown Error', () => {
    const ex = new ConstraintError('what happened');
    const res = filter.catchGql(ex);
    expect(res.message).toEqual('what happened');
    expect(res.extensions.status).toEqual(500);
    expect(res.extensions.code).toEqual('InternalServerError');
    expect(res.extensions.codes).toEqual(['InternalServerError']);
  });
});
