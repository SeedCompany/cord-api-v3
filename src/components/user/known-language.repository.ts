import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ID } from '~/common';
import { DtoRepository } from '~/core';
import { ACTIVE } from '~/core/database/query';
import { KnownLanguage, ModifyKnownLanguageArgs } from './dto';

@Injectable()
export class KnownLanguageRepository extends DtoRepository(KnownLanguage) {
  async create({
    userId,
    languageId,
    languageProficiency,
  }: ModifyKnownLanguageArgs) {
    await this.db
      .query()
      .matchNode('user', 'User', { id: userId })
      .matchNode('language', 'Language', { id: languageId })
      .create([
        node('user'),
        relation('out', '', 'knownLanguage', {
          active: true,
          createdAt: DateTime.local(),
          value: languageProficiency,
        }),
        node('language'),
      ])
      .run();
  }

  async delete({
    userId,
    languageId,
    languageProficiency,
  }: ModifyKnownLanguageArgs) {
    await this.db
      .query()
      .matchNode('user', 'User', { id: userId })
      .matchNode('language', 'Language', { id: languageId })
      .match([
        [
          node('user'),
          relation('out', 'rel', 'knownLanguage', {
            active: true,
            value: languageProficiency,
          }),
          node('language'),
        ],
      ])
      .setValues({
        'rel.active': false,
      })
      .run();
  }

  async list(userId: ID) {
    const results = await this.db
      .query()
      .match([
        node('node', 'Language'),
        relation('in', 'knownLanguageRel', 'knownLanguage', ACTIVE),
        node('user', 'User', { id: userId }),
      ])
      .with('collect(distinct user) as users, node, knownLanguageRel')
      .raw(`unwind users as user`)
      .return<KnownLanguage>([
        'knownLanguageRel.value as proficiency',
        'node.id as language',
      ])
      .run();
    return results;
  }
}
