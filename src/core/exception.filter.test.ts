import { NotFoundException } from '@nestjs/common';
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
  });
});
