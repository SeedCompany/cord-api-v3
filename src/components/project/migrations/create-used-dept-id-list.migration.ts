import { node } from 'cypher-query-builder';
import { readFile } from 'node:fs/promises';
import { BaseMigration, Migration } from '~/core/database';
import { apoc, variable } from '~/core/database/query';

interface ExternalDepartmentId {
  id: string;
  name?: string;
}

@Migration('2025-09-17T09:00:00')
export class CreateUsedDeptIdListMigration extends BaseMigration {
  async up() {
    const intaactFilePath = new URL(
      '../../../../../.vscode/localFiles/All-Department-Ids-From-Intaact.csv',
      import.meta.url,
    );
    const cordFilePath = new URL(
      '../../../../../.vscode/localFiles/prod_deptIds_ids_only.csv',
      import.meta.url,
    );

    const intaactFileContent = await readFile(intaactFilePath, 'utf-8');
    const cordFileContent = await readFile(cordFilePath, 'utf-8');

    const intaactRows = intaactFileContent.trim().split(/\r?\n/).slice(1); // Skip header
    const cordRows = cordFileContent.trim().split(/\r?\n/).slice(1); // Skip header

    const intaactList: ExternalDepartmentId[] = intaactRows.flatMap((row) => {
      const [id, name] = row.split(',');
      if (id) {
        return { id, name };
      }
      return [];
    });

    const prunedIntaactList = intaactList.flatMap((row) =>
      !cordRows.includes(row.id) ? row : [],
    );

    await this.db
      .query()
      .unwind(prunedIntaactList, 'dept')
      .create(node('blacklist', 'BlacklistDepartmentId'))
      .setValues({
        'blacklist.id': variable(apoc.create.uuid()),
        'blacklist.departmentId': variable('dept.id'),
        'blacklist.departmentName': variable('dept.name'),
        'blacklist.createdAt': Date.now(),
        'blacklist.createdBy': 'bulk_import',
      })
      .return('count(blacklist) as created')
      .executeAndLogStats();
  }
}
