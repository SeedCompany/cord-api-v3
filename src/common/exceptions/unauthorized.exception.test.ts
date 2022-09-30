import { EnhancedResource } from '~/common';
import { TranslationProject } from '../../components/project/dto';
import { UnauthorizedException } from './unauthorized.exception';

const Project = EnhancedResource.of(TranslationProject);

describe('UnauthorizedException', () => {
  describe('fromPrivileges', () => {
    const m = UnauthorizedException.fromPrivileges;
    type In = Parameters<typeof m>;

    it.each([
      [
        ['create', {}, Project] as In,
        'You do not have the permission to create translation projects',
      ],
      [
        ['create', undefined, Project] as In,
        'You do not have the permission to create translation projects',
      ],
      [
        ['create', {}, Project, 'commentThreads'] as In,
        'You do not have the permission to create comment threads for this translation project',
      ],
      [
        ['create', undefined, Project, 'commentThreads'] as In,
        'You do not have the permission to create comment threads for any translation projects',
      ],

      [
        ['read', {}, Project] as In,
        'You do not have the permission to view this translation project',
      ],
      [
        ['read', undefined, Project] as In,
        'You do not have the permission to view any translation projects',
      ],
      [
        ['read', {}, Project, 'name'] as In,
        `You do not have the permission to view this translation project's name`,
      ],
      [
        ['read', undefined, Project, 'name'] as In,
        `You do not have the permission to view any translation project's names`,
      ],
      [
        ['delete', {}, Project, 'commentThreads'] as In,
        `You do not have the permission to delete this translation project's comment threads`,
      ],
      [
        ['delete', undefined, Project, 'commentThreads'] as In,
        `You do not have the permission to delete any translation project's comment threads`,
      ],
    ])('%#', (args: In, message: string) => {
      const ex = UnauthorizedException.fromPrivileges(...args);
      expect(ex.message).toEqual(message);
    });
  });
});
