import { Prompt } from '../../prompts/dto';

/**
 * Prompt text is deliberately the leader's own language, not Seed Company's —
 * these are answered by the Global Translation Leader, and the FY27 template
 * addresses them in the second person.
 *
 * Ids are stable nanoids; they are what `prompt_variant_responses.prompt`
 * stores, so changing one orphans existing responses. Reword freely, renumber
 * never.
 */
export const communityImpactPrompts = [
  Prompt.create({
    id: 'gtlCmtyImpct1',
    text: 'Please share a story, testimony, or incident related to Bible translation and your internship.',
    shortLabel: 'A story from this quarter',
  }),
  Prompt.create({
    id: 'gtlCmtyImpct2',
    text: 'Reflect on the impact your training and practicum have had on you personally, and on your family, your church, and the ministry team you serve with.',
    shortLabel: 'Personal and community impact',
  }),
];

export const praisePrompts = [
  Prompt.create({
    id: 'gtlPraise0001',
    text: 'What are you thankful for from the past three months?',
    shortLabel: 'Praises',
  }),
];

export const petitionPrompts = [
  Prompt.create({
    id: 'gtlPetition001',
    text: 'What needs do you have that we can join you in praying for?',
    shortLabel: 'Petitions',
  }),
];
