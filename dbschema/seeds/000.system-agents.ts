import type { SeedFn } from '~/core/edgedb/seeds.run';

const agents = [
  { name: 'Ghost' },
  { name: 'Anonymous' },
  { name: 'External Mailing Group', roles: ['Leadership'] },
];

export default (async function ({ runAndPrint }) {
  await runAndPrint(
    `
      with
      agentsJson := json_array_unpack(<json>$agentsJson),
      newAgents := (select agentsJson filter <str>agentsJson['name'] not in SystemAgent.name),
      added := (
        for entry in newAgents union (
        insert SystemAgent {
          name := <str>entry['name'],
          roles := <str>json_array_unpack(json_get(entry, 'roles'))
        })
      )
      select { \`Added System Agents\` := added.name }
      filter count(added) > 0;
    `,
    { agentsJson: agents },
  );
} satisfies SeedFn);
