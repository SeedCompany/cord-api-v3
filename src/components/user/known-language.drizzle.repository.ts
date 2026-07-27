import { Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { type ID } from '~/common';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { knownLanguages } from '~/core/drizzle/schema';
import { type KnownLanguage, type ModifyKnownLanguageArgs } from './dto';

@Injectable()
export class KnownLanguageDrizzleRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  protected get db() {
    return this.drizzle.client;
  }

  async create({
    user,
    language,
    languageProficiency,
  }: ModifyKnownLanguageArgs): Promise<void> {
    // Idempotent: the Neo4j flow replaces the exact (user, language,
    // proficiency) edge, so a re-create is a no-op.
    await this.db
      .insert(knownLanguages)
      .values({
        userId: user,
        languageId: language,
        proficiency: languageProficiency,
      })
      .onConflictDoNothing();
  }

  async delete({
    user,
    language,
    languageProficiency,
  }: ModifyKnownLanguageArgs): Promise<void> {
    await this.db
      .delete(knownLanguages)
      .where(
        and(
          eq(knownLanguages.userId, user),
          eq(knownLanguages.languageId, language),
          eq(knownLanguages.proficiency, languageProficiency),
        ),
      );
  }

  async list(userId: ID): Promise<KnownLanguage[]> {
    const rows = await this.db
      .select({
        language: knownLanguages.languageId,
        proficiency: knownLanguages.proficiency,
      })
      .from(knownLanguages)
      .where(eq(knownLanguages.userId, userId as ID<'User'>))
      .orderBy(asc(knownLanguages.createdAt));
    return rows.map((row) => ({
      language: row.language,
      proficiency: row.proficiency,
    }));
  }
}
