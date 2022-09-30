import { UnauthorizedException } from './unauthorized.exception';

describe('UnauthorizedException', () => {
  describe('fromPrivileges', () => {
    const m = UnauthorizedException.fromPrivileges;
    type In = Parameters<typeof m>;

    it.each([
      [
        ['create', {}, 'TranslationProject'] as In,
        'You do not have the permission to create translation project',
      ],
      [
        ['create', undefined, 'TranslationProject'] as In,
        'You do not have the permission to create translation project',
      ],
      [
        ['create', {}, 'TranslationProject', 'name'] as In,
        'You do not have the permission to create name for this translation project',
      ],
      [
        ['create', undefined, 'TranslationProject', 'name'] as In,
        'You do not have the permission to create name for any translation project',
      ],

      [
        ['read', {}, 'TranslationProject'] as In,
        'You do not have the permission to view this translation project',
      ],
      [
        ['read', undefined, 'TranslationProject'] as In,
        'You do not have the permission to view any translation project',
      ],
      [
        ['read', {}, 'TranslationProject', 'name'] as In,
        `You do not have the permission to view this translation project's name`,
      ],
      [
        ['read', undefined, 'TranslationProject', 'name'] as In,
        `You do not have the permission to view any translation project's name`,
      ],
    ])('%s', (args: In, message: string) => {
      const ex = UnauthorizedException.fromPrivileges(...args);
      expect(ex.message).toEqual(message);
    });
  });
});
