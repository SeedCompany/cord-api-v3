import * as Nest from '@nestjs/common/exceptions';
import { InputException, ServerException } from '~/common';
import { ConstraintError } from '../database';
import { ExceptionNormalizer } from './exception.normalizer';

describe('ExceptionNormalizer', () => {
  const sut = new ExceptionNormalizer();
  // Simulate over the wire.
  const orig = sut.normalize.bind(sut);
  sut.normalize = (...args) => JSON.parse(JSON.stringify(orig(...args)));

  describe('HttpException', () => {
    it('simple', () => {
      const ex = new Nest.NotFoundException();
      const res = sut.normalize(ex);
      expect(res.message).toEqual('Not Found');
      expect(res.code).toEqual('NotFound');
      expect(res.codes).toEqual(['NotFound', 'Client']);
    });

    it('custom message', () => {
      const ex = new Nest.NotFoundException('Could not find resource');
      const res = sut.normalize(ex);
      expect(res.message).toEqual('Could not find resource');
      expect(res.code).toEqual('NotFound');
      expect(res.codes).toEqual(['NotFound', 'Client']);
    });

    it('custom code', () => {
      const ex = new Nest.NotFoundException(
        'Could not find resource',
        'CustomNotFound',
      );
      const res = sut.normalize(ex);
      expect(res.message).toEqual('Could not find resource');
      expect(res.code).toEqual('CustomNotFound');
      expect(res.codes).toEqual(['CustomNotFound', 'NotFound', 'Client']);
    });

    it('custom error object with message', () => {
      const ex = new Nest.NotFoundException(
        { message: 'Could not find resource', foo: 'bar' },
        'Ignored',
      );
      const res = sut.normalize(ex);
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
      const res = sut.normalize(ex);
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
      const res = sut.normalize(ex);
      expect(res.message).toEqual('Not Found Exception');
      expect(res.code).toEqual('NotFound');
      expect(res.codes).toEqual(['NotFound', 'Client']);
      expect(res.description).toEqual('Could not find resource');
    });

    it('BadRequestException', () => {
      const ex = new Nest.BadRequestException('what happened');
      const res = sut.normalize(ex);
      expect(res.message).toEqual('what happened');
      expect(res.code).toEqual('Input');
      expect(res.codes).toEqual(['Input', 'Client']);
    });

    it('ForbiddenException', () => {
      const ex = new Nest.ForbiddenException();
      const res = sut.normalize(ex);
      expect(res.code).toEqual('Unauthorized');
      expect(res.codes).toEqual(['Unauthorized', 'Client']);
    });

    it('UnauthorizedException', () => {
      const ex = new Nest.UnauthorizedException();
      const res = sut.normalize(ex);
      expect(res.code).toEqual('Unauthenticated');
      expect(res.codes).toEqual(['Unauthenticated', 'Client']);
    });
  });

  it('ServerException', () => {
    const ex = new ServerException('what happened');
    const res = sut.normalize(ex);
    expect(res.message).toEqual('what happened');
    expect(res.code).toEqual('Server');
    expect(res.codes).toEqual(['Server']);
  });

  it('InputException', () => {
    const ex = new InputException('what happened', 'field.name');
    const res = sut.normalize(ex);
    expect(res.message).toEqual('what happened');
    expect(res.code).toEqual('Input');
    expect(res.codes).toEqual(['Input', 'Client']);
    expect(res.field).toEqual('field.name');
  });

  it('Generic Error', () => {
    const ex = new Error('what happened');
    const res = sut.normalize(ex);
    expect(res.message).toEqual('what happened');
    expect(res.code).toEqual('Server');
    expect(res.codes).toEqual(['Server']);
  });

  it('Unknown Error', () => {
    const ex = new ConstraintError('what happened');
    const res = sut.normalize(ex);
    expect(res.message).toEqual('what happened');
    expect(res.code).toEqual('Server');
    expect(res.codes).toEqual(['Server']);
  });
});
