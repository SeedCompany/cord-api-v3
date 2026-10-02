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

/** The quarter's high points. Same id rule as above: reword freely, renumber never. */
export const highlightPrompts = [
  Prompt.create({
    id: 'gtlHighlight1',
    text: 'What was the most significant moment of your internship this quarter, and why did it stand out to you?',
    shortLabel: 'Most significant moment',
  }),
  Prompt.create({
    id: 'gtlHighlight2',
    text: 'What are you most thankful for from your training and practicum this quarter?',
    shortLabel: 'Most thankful for',
  }),
  Prompt.create({
    id: 'gtlHighlight3',
    text: 'Describe a challenge you faced this quarter and how you worked through it.',
    shortLabel: 'A challenge worked through',
  }),
];
