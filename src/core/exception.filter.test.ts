import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InputException, ServerException } from '../common/exceptions';
import { ExceptionFilter } from './exception.filter';

describe('ExceptionFilter', () => {
  describe('HttpException', () => {
    it('simple', () => {
      const ex = new NotFoundException();
      const res = new ExceptionFilter().catchGql(ex);
      expect(res.message).toEqual('Not Found');
      expect(res.extensions.status).toEqual(404);
      expect(res.extensions.code).toEqual('NotFound');
    });

    it('custom message', () => {
      const ex = new NotFoundException('Could not find resource');
      const res = new ExceptionFilter().catchGql(ex);
      expect(res.message).toEqual('Could not find resource');
      expect(res.extensions.status).toEqual(404);
      expect(res.extensions.code).toEqual('NotFound');
    });

    it('custom code', () => {
      const ex = new NotFoundException(
        'Could not find resource',
        'CustomNotFound'
      );
      const res = new ExceptionFilter().catchGql(ex);
      expect(res.message).toEqual('Could not find resource');
      expect(res.extensions.status).toEqual(404);
      expect(res.extensions.code).toEqual('CustomNotFound');
    });

    it('custom error object with message', () => {
      const ex = new NotFoundException(
        { message: 'Could not find resource', foo: 'bar' },
        'Ignored'
      );
      const res = new ExceptionFilter().catchGql(ex);
      expect(res.message).toEqual('Could not find resource');
      expect(res.extensions.status).toEqual(404);
      expect(res.extensions.code).toEqual('NotFound');
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
      const res = new ExceptionFilter().catchGql(ex);
      expect(res.message).toEqual('Could not find resource');
      expect(res.extensions.status).toEqual(404);
      expect(res.extensions.code).toEqual('CustomNotFound');
      expect(res.extensions.foo).toEqual('bar');
    });

    it('custom error object without message', () => {
      const ex = new NotFoundException(
        { description: 'Could not find resource' },
        'Ignored'
      );
      const res = new ExceptionFilter().catchGql(ex);
      expect(res.message).toEqual('Not Found Exception');
      expect(res.extensions.status).toEqual(404);
      expect(res.extensions.code).toEqual('NotFound');
      expect(res.extensions.description).toEqual('Could not find resource');
    });

    it('BadRequestException', () => {
      const ex = new BadRequestException('what happened');
      const res = new ExceptionFilter().catchGql(ex);
      expect(res.message).toEqual('what happened');
      expect(res.extensions.status).toEqual(400);
      expect(res.extensions.code).toEqual('Input');
    });

    it('ForbiddenException', () => {
      const ex = new ForbiddenException();
      const res = new ExceptionFilter().catchGql(ex);
      expect(res.extensions.code).toEqual('Unauthorized');
    });

    it('UnauthorizedException', () => {
      const ex = new UnauthorizedException();
      const res = new ExceptionFilter().catchGql(ex);
      expect(res.extensions.code).toEqual('Unauthenticated');
    });
  });

  it('ServerException', () => {
    const ex = new ServerException('what happened');
    const res = new ExceptionFilter().catchGql(ex);
    expect(res.message).toEqual('what happened');
    expect(res.extensions.status).toEqual(500);
    expect(res.extensions.code).toEqual('Server');
  });

  it('InputException', () => {
    const ex = new InputException('what happened', 'field.name');
    const res = new ExceptionFilter().catchGql(ex);
    expect(res.message).toEqual('what happened');
    expect(res.extensions.status).toEqual(400);
    expect(res.extensions.code).toEqual('Input');
    expect(res.extensions.field).toEqual('field.name');
  });
});
