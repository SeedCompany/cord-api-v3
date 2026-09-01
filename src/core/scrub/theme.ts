/**
 * The themed replacement pools — a REVIEW ARTIFACT, deliberately boring code.
 *
 * Every name a scrubbed copy can ever show comes from the lists in this file, so
 * reviewing this file IS reviewing the fake data. To veto an entry, delete its
 * line; nothing references entries by position, and no other file needs touching.
 *
 * ## Why themed names at all
 *
 * Not decoration. The old fakes had two problems that cost real coverage:
 *
 *  - `faker.person.fullName()` produces things like "Jennifer Martinez" —
 *    indistinguishable from unscrubbed data, and able to collide with a real
 *    person by chance. "Samus Aran" cannot be mistaken for either. Unmistakably
 *    fictional data is the same intent the `languageName` strategy already had.
 *  - Faker names never form prefix families, and real names do constantly
 *    (Ann/Anna, Jon/Jonathan). That gap HID A REAL BUG: 0 of 2,376 users moved
 *    under the `fullName` concatenation fix on scrubbed data, because nothing in
 *    the pool could exercise it. Neo4j sorts on first+last concatenated while
 *    Postgres sorts two columns, so the engines disagree exactly when one given
 *    name is a prefix of another — which is why {@link GIVEN_NAMES} carries
 *    deliberate families, and why they matter more there than in surnames.
 *
 * ## Faith-appropriateness is enforced by what is ABSENT
 *
 * Rob's constraint: nothing profane or demonic. Applied by choosing sources
 * rather than filtering names — the pools draw on Animal Crossing, Zelda,
 * Fire Emblem, Stardew Valley, Pokémon, Ace Attorney, Final Fantasy and similar.
 * Deliberately NOT used, however innocuous an individual name would look:
 * Shin Megami Tensei / Persona, Doom, Diablo, Devil May Cry, Bayonetta,
 * Resident Evil and other horror, and characters who are gods or demons in their
 * own fiction. If a name here still reads wrong to a reviewer, deleting the line
 * is the whole fix.
 *
 * ## Three properties that are test coverage, asserted in `fake.spec.ts`
 *
 *  - **Prefix families** — 45 of them, measured rather than assumed. Eight are
 *    deliberate (Ann/Anna, Lyn/Lyndis, Sam/Samus, Kai/Kairi, Peach/Peaches,
 *    Elli/Ellie, Yuna/Yunalesca, Max/Maxwell) and twelve fell out of the cast
 *    lists on their own (Erik/Erika, Norma/Norman, Fi/Fiora, Mist/Misty,
 *    Ashe/Ashei, Jas/Jasmine, Celes/Celeste, Bea/Beau, Toad/Toadette, Ken/Kent,
 *    Ori/Orville, Ly/Lyn). ⚠ Near-misses are NOT families and were counted as
 *    such on the first pass: Ana is not a prefix of Anna, and Flora is not a
 *    prefix of Florina. The test measures this; do not hand-maintain the list.
 *  - **Diacritics** — 19 entries: Lúcio, Torbjörn, Éclair, Naminé, Mòrag, plus
 *    every surname composed from the Fódlan root. Name columns use a custom
 *    `display_order` collation and Neo4j-vs-Postgres sort parity is actively
 *    measured; an all-ASCII pool silently deletes that coverage.
 *  - **A wide length spread** — 2 to 16 characters. Fi and Ly at one end,
 *    Gainsborough and the longer composed surnames at the other, so column
 *    sizing and truncation still surface.
 *
 * ## Two things to know before editing
 *
 * ⚠ **Editing a pool reshuffles who gets which name.** A fake is
 * `hash(original) % pool.length`, so adding or removing one entry moves nearly
 * every assignment. Determinism only promises the same name across refreshes of
 * the SAME pool, so batch pool edits, and expect a copy scrubbed before an edit
 * not to match one scrubbed after.
 *
 * ⚠ **Pool edits do not change `classificationHash()`**, which hashes
 * classification decisions rather than these lists — so the scrub marker cannot
 * tell you a name was vetoed after the fact. The verify pass covers that gap
 * instead: it counts name values that are no longer in the pool, so a vetoed
 * entry still present in a copy shows up as a violation.
 *
 * No entry may contain whitespace — these fill single-name fields, and a full
 * name in `realLastName` is the exact defect these pools replace. None may
 * contain quotes or backslashes either, because the verify probe passes the
 * pools to Cypher as a parameter list.
 */

/**
 * Given names — one name each, never "First Last".
 *
 * 863 entries against 2,664 surnames is 2.3 MILLION combinations, so no
 * uniqueness suffix is needed here: person names carry no uniqueness constraint,
 * and the scrub deliberately allows the collisions real data has.
 *
 * Sized against a measurement, not a guess. The real population holds **1,539
 * distinct first names** across 2,376 users, so a smaller pool forces distinct
 * people onto one name. Two separate effects, and they need different fixes:
 *  - **Invented duplicate FULL names** fall as `5.4M / (given x surnames)`, so
 *    they are a function of the PRODUCT — the composed surnames did that work.
 *  - **Visual repetition** (five Abigails on one alphabetical page) is a
 *    function of this pool alone: 480 names meant ~5 people each, 863 means
 *    ~2.8. That is why this list grew even though duplicates were already
 *    handled by the surname side.
 */
export const GIVEN_NAMES: readonly string[] = [
  // ── Deliberate prefix families ────────────────────────────────────────────
  // Both halves of each pair are real characters from the sources below; they
  // are listed together here so a reviewer can see the families at a glance,
  // and so nobody deletes one half without noticing what it was for.
  'Ann', // Harvest Moon
  'Anna', // Harvest Moon / Fire Emblem
  'Ana', // Overwatch — near-miss, NOT a prefix of Anna. Kept as a name.
  'Lyn', // Fire Emblem
  'Lyndis', // Fire Emblem — Lyn's full name
  'Sam', // Stardew Valley
  'Samus', // Metroid
  'Kai', // Harvest Moon
  'Kairi', // Kingdom Hearts
  'Peach', // Super Mario
  'Peaches', // Animal Crossing
  'Flora', // Animal Crossing / Professor Layton
  'Florina', // Fire Emblem — near-miss on Flora, not a prefix of it
  'Elli', // Harvest Moon
  'Ellie', // Animal Crossing
  'Yuna', // Final Fantasy X
  'Yunalesca', // Final Fantasy X
  'Max', // Life is Strange
  'Maxwell', // Scribblenauts

  // ── Diacritics ────────────────────────────────────────────────────────────
  'Lúcio', // Overwatch
  'Torbjörn', // Overwatch
  'Éclair', // Final Fantasy XIII — Lightning's given name
  'Naminé', // Kingdom Hearts
  'Mòrag', // Xenoblade Chronicles 2

  // ── Animal Crossing — villagers and townsfolk ─────────────────────────────
  // The wholesome bulk of the pool, and single names by design.
  'Isabelle',
  'Celeste',
  'Sable',
  'Mabel',
  'Label',
  'Blathers',
  'Flick',
  'Cyrus',
  'Reese',
  'Kicks',
  'Harvey',
  'Leif',
  'Wilbur',
  'Orville',
  'Rover',
  'Gulliver',
  'Pascal',
  'Saharah',
  'Digby',
  'Copper',
  'Booker',
  'Pelly',
  'Phyllis',
  'Lottie',
  'Wardell',
  'Niko',
  'Tortimer',
  'Marshal',
  'Raymond',
  'Audie',
  'Sherb',
  'Fauna',
  'Diana',
  'Judy',
  'Beau',
  'Stitches',
  'Rosie',
  'Whitney',
  'Lolly',
  'Merengue',
  'Cherry',
  'Bunnie',
  'Chief',
  'Coco',
  'Deirdre',
  'Dom',
  'Erik',
  'Gayle',
  'Goldie',
  'Hazel',
  'Henry',
  'Jeremiah',
  'Julian',
  'Kiki',
  'Kody',
  'Maple',
  'Marina',
  'Melba',
  'Molly',
  'Muffy',
  'Nan',
  'Norma',
  'Olivia',
  'Papi',
  'Pekoe',
  'Phoebe',
  'Piper',
  'Poppy',
  'Punchy',
  'Reneigh',
  'Rodney',
  'Ruby',
  'Sandy',
  'Savannah',
  'Shep',
  'Sprinkle',
  'Static',
  'Sydney',
  'Tammy',
  'Tangy',
  'Teddy',
  'Tia',
  'Tucker',
  'Vesta',
  'Walker',
  'Wendy',
  'Willow',
  'Winnie',
  'Zell',
  'Zucker',

  // ── The Legend of Zelda ───────────────────────────────────────────────────
  'Link',
  'Zelda',
  'Impa',
  'Saria',
  'Malon',
  'Talon',
  'Ruto',
  'Darunia',
  'Nabooru',
  'Rauru',
  'Tetra',
  'Medli',
  'Makar',
  'Linebeck',
  'Ilia',
  'Ashei',
  'Auru',
  'Renado',
  'Telma',
  'Groose',
  'Karane',
  'Pipit',
  'Fi', // shortest entry in the pool, deliberately kept
  'Paya',
  'Purah',
  'Robbie',
  'Riju',
  'Sidon',
  'Yunobo',
  'Teba',
  'Kass',
  'Urbosa',
  'Mipha',
  'Daruk',
  'Revali',
  'Hestu',
  'Bolson',
  'Hudson',
  'Rhondson',
  'Tulin',
  'Josha',
  'Beedle',
  'Cremia',
  'Romani',
  'Anju',
  'Kafei',

  // ── Fire Emblem ───────────────────────────────────────────────────────────
  'Marth',
  'Caeda',
  'Roy',
  'Lilina',
  'Eliwood',
  'Hector',
  'Serra',
  'Rath',
  'Priscilla',
  'Ninian',
  'Eirika',
  'Ephraim',
  'Seth',
  'Tana',
  'Innes',
  'Ike',
  'Soren',
  'Titania',
  'Mist',
  'Elincia',
  'Micaiah',
  'Sothe',
  'Chrom',
  'Lissa',
  'Frederick',
  'Sumia',
  'Cordelia',
  'Cherche',
  'Lucina',
  'Owain',
  'Severa',
  'Corrin',
  'Azura',
  'Sakura',
  'Hinoka',
  'Takumi',
  'Ryoma',
  'Xander',
  'Camilla',
  'Elise',
  'Byleth',
  'Edelgard',
  'Dimitri',
  'Mercedes',
  'Annette',
  'Ashe',
  'Ingrid',
  'Sylvain',
  'Felix',
  'Dedue',
  'Marianne',
  'Lysithea',
  'Hilda',
  'Raphael',
  'Ignatz',
  'Leonie',
  'Petra',
  'Dorothea',
  'Bernadetta',
  'Caspar',
  'Linhardt',
  'Ferdinand',

  // ── Stardew Valley ────────────────────────────────────────────────────────
  'Abigail',
  'Alex',
  'Caroline',
  'Clint',
  'Demetrius',
  'Elliott',
  'Emily',
  'Evelyn',
  'George',
  'Gus',
  'Haley',
  'Jas',
  'Jodi',
  'Kent',
  'Leah',
  'Lewis',
  'Linus',
  'Marnie',
  'Maru',
  'Pam',
  'Penny',
  'Pierre',
  'Robin',
  'Sebastian',
  'Shane',
  'Vincent',
  'Willy',
  'Marlon',

  // ── Final Fantasy ─────────────────────────────────────────────────────────
  'Cloud',
  'Tifa',
  'Aerith',
  'Barret',
  'Cid',
  'Yuffie',
  'Zack',
  'Squall',
  'Rinoa',
  'Quistis',
  'Selphie',
  'Irvine',
  'Tidus',
  'Wakka',
  'Lulu',
  'Rikku',
  'Terra',
  'Celes',
  'Locke',
  'Edgar',
  'Sabin',
  'Serah',
  'Sazh',
  'Vanille',
  'Fang',
  'Snow',

  // ── Kingdom Hearts ────────────────────────────────────────────────────────
  'Sora',
  'Riku',
  'Roxas',
  'Aqua',
  'Ventus',

  // ── Xenoblade Chronicles ──────────────────────────────────────────────────
  'Shulk',
  'Fiora',
  'Reyn',
  'Sharla',
  'Riki',
  'Dunban',
  'Melia',
  'Rex',
  'Nia',
  'Tora',
  'Zeke',
  'Noah',
  'Mio',
  'Eunie',
  'Taion',
  'Lanz',
  'Sena',
  'Ethel',

  // ── Pokémon — gym leaders, professors and rivals ──────────────────────────
  'Brock',
  'Misty',
  'Erika',
  'Blaine',
  'Falkner',
  'Bugsy',
  'Jasmine',
  'Chuck',
  'Pryce',
  'Clair',
  'Roxanne',
  'Brawly',
  'Flannery',
  'Norman',
  'Winona',
  'Wallace',
  'Steven',
  'Roark',
  'Gardenia',
  'Maylene',
  'Byron',
  'Candice',
  'Volkner',
  'Cheren',
  'Bianca',
  'Hilbert',
  'Iris',
  'Skyla',
  'Clay',
  'Burgh',
  'Cilan',
  'Viola',
  'Grant',
  'Korrina',
  'Ramos',
  'Clemont',
  'Valerie',
  'Wulfric',
  'Hala',
  'Mallow',
  'Lana',
  'Kiawe',
  'Ilima',
  'Milo',
  'Nessa',
  'Kabu',
  'Bea',
  'Opal',
  'Gordie',
  'Melony',
  'Raihan',
  'Hop',
  'Sonia',

  // ── Ace Attorney ──────────────────────────────────────────────────────────
  'Phoenix',
  'Maya',
  'Mia',
  'Miles',
  'Franziska',
  'Apollo',
  'Athena',
  'Trucy',
  'Ema',
  'Klavier',
  'Pearl',
  'Kay',
  'Simon',

  // ── Harvest Moon and Rune Factory ─────────────────────────────────────────
  'Karen',
  'Popuri',
  'Mary',
  'Cliff',
  'Gray',
  'Rick',
  'Doug',
  'Barley',
  'Frey',
  'Lest',
  'Forte',
  'Margaret',
  'Dylas',
  'Amber',
  'Clorica',
  'Vishnal',
  'Kiel',

  // ── Octopath Traveler ─────────────────────────────────────────────────────
  'Olberic',
  'Primrose',
  'Alfyn',
  'Tressa',
  'Ophilia',
  'Hannit',

  // ── Chrono Trigger and Golden Sun ─────────────────────────────────────────
  'Crono',
  'Marle',
  'Lucca',
  'Ayla',
  'Schala',
  'Glenn',
  'Isaac',
  'Garet',
  'Ivan',
  'Jenna',
  'Sheba',
  'Piers',

  // ── Super Mario, Kirby, Star Fox, Pikmin, Splatoon ────────────────────────
  'Mario',
  'Luigi',
  'Daisy',
  'Toad',
  'Toadette',
  'Yoshi',
  'Rosalina',
  'Pauline',
  'Kirby',
  'Adeleine',
  'Ribbon',
  'Elline',
  'Susie',
  'Fox',
  'Falco',
  'Slippy',
  'Peppy',
  'Krystal',
  'Olimar',
  'Louie',
  'Alph',
  'Brittany',
  'Callie',
  'Marie',
  'Shiver',

  // ── Overwatch — the non-combat-focused cast ───────────────────────────────
  'Mei',
  'Brigitte',
  'Reinhardt',
  'Angela',
  'Winston',
  'Orisa',
  'Efi',
  'Zarya',
  'Fareeha',
  'Baptiste',

  // ── Street Fighter ────────────────────────────────────────────────────────
  'Ryu',
  'Ken',
  'Cammy',
  'Guile',
  'Zangief',
  'Makoto',
  'Ibuki',
  'Elena',
  'Luke',
  'Kimberly',

  // ── Platformers and indies ────────────────────────────────────────────────
  'Madeline',
  'Theo',
  'Ori',
  'Naru',
  'Sein',
  'Alba',
  'Quill',
  'Stella',
  'Astro',
  'Banjo',
  'Kazooie',
  'Tooty',
  'Rayman',
  'Globox',
  'Ly', // joint-shortest entry, deliberately kept
  'Ratchet',
  'Clank',
  'Jak',
  'Daxter',
  'Spyro',
  'Sparx',
  'Sonic',
  'Tails',
  'Amy',
  'Cream',
  'Blaze',
  'Knuckles',
  'Shantae',
  'Bolo',
  'Curly',
  'Quote',
  'Ico',
  'Yorda',
  'Emmy',
  'Hershel',

  // ── Grown 480 → ~760 on 2026-09-01, for the VISUAL repetition ─────────────
  // A separate problem from duplicate full names. 480 given names over 2,375
  // users is ~5 people per first name, so an alphabetical page shows five
  // Abigails in a row with different surnames — which reads as duplication even
  // though the full names differ. Pool size is the only lever: at ~760 it is
  // ~3 per name. The real population holds 1,539 distinct first names, so that
  // is the ceiling worth aiming at over time.
  //
  // ⚠ Stopped where confidence in the attributions stopped rather than padding
  // to a round number. Every entry below is a character I can place in its
  // franchise; inventing plausible-looking names would defeat the point of a
  // list a person can review and veto.

  // Animal Crossing — villagers
  'Antonio',
  'Bangle',
  'Bertha',
  'Biskit',
  'Bluebear',
  'Bonbon',
  'Boomer',
  'Broccolo',
  'Bruce',
  'Butch',
  'Camofrog',
  'Canberra',
  'Chadder',
  'Chevre',
  'Chrissy',
  'Cleo',
  'Clyde',
  'Cobb',
  'Colton',
  'Cousteau',
  'Curlos',
  'Curt',
  'Cyd',
  'Deli',
  'Derwin',
  'Dobie',
  'Dotty',
  'Drago',
  'Egbert',
  'Elmer',
  'Eloise',
  'Elvis',
  'Eugene',
  'Filbert',
  'Flip',
  'Flurry',
  'Francine',
  'Frank',
  'Freckles',
  'Freya',
  'Gabi',
  'Gaston',
  'Genji',
  'Gladys',
  'Gloria',
  'Gonzo',
  'Grizzly',
  'Gwen',
  'Hamlet',
  'Hamphrey',
  'Harry',
  'Hippeux',
  'Hopper',
  'Hornsby',
  'Jacques',
  'Jambette',
  'Jay',
  'Jitters',
  'Joey',
  'Kid',
  'Kitt',
  'Klaus',
  'Knox',
  'Kyle',
  'Leonardo',
  'Lily',
  'Lionel',
  'Lopez',
  'Lucha',
  'Mac',
  'Maddie',
  'Marcel',
  'Margie',
  'Marcie',
  'Mathilda',
  'Megan',
  'Mint',
  'Mitzi',
  'Monique',
  'Moose',
  'Mott',
  'Nana',
  'Nate',
  'Nibbles',
  'Octavian',
  'Pancetti',
  'Pango',
  'Pate',
  'Patty',
  'Paula',
  'Peanut',
  'Peck',
  'Pierce',
  'Pinky',
  'Plucky',
  'Pompom',
  'Portia',
  'Prince',
  'Puddles',
  'Purrl',
  'Queenie',
  'Quillson',
  'Renee',
  'Rhonda',
  'Ribbot',
  'Ricky',
  'Roald',
  'Rocco',
  'Rolf',
  'Rooney',
  'Roscoe',
  'Sally',
  'Samson',
  'Scoot',
  'Sheldon',
  'Shino',
  'Sly',
  'Snake',
  'Soleil',
  'Spike',
  'Sprocket',
  'Sterling',
  'Sylvana',
  'Tabby',
  'Tank',
  'Tasha',
  'Tex',
  'Tiffany',
  'Timbra',
  'Tipper',
  'Tybalt',
  'Velma',
  'Vic',
  'Vivian',
  'Wade',
  'Wart',
  'Wolfgang',
  'Yuka',
  'Zoe',

  // Fire Emblem — further casts
  'Alm',
  'Celica',
  'Clive',
  'Forsyth',
  'Python',
  'Lukas',
  'Silque',
  'Faye',
  'Tobin',
  'Kliff',
  'Genny',
  'Sonya',
  'Deen',
  'Palla',
  'Catria',
  'Est',
  'Abel',
  'Cain',
  'Draug',
  'Gordin',
  'Wrys',
  'Merric',
  'Elice',
  'Nyna',
  'Minerva',
  'Maria',
  'Lena',
  'Navarre',
  'Ogma',
  'Barst',
  'Bord',
  'Cord',
  'Castor',
  'Darros',
  'Hardin',
  'Wolf',
  'Sedgar',
  'Vyland',
  'Roshea',
  'Ryan',
  'Arran',
  'Samto',
  'Etzel',
  'Rickard',
  'Sirius',
  'Norne',
  'Horace',
  'Boah',
  'Malliesia',
  'Yubello',
  'Yumina',
  'Dolph',
  'Macellan',
  'Tomas',
  'Beck',
  'Jake',
  'Nagi',
  'Xane',
  'Lorenz',
  'Hubert',
  'Ashen',
  'Balthus',
  'Constance',
  'Hapi',
  'Yuri',
  'Seteth',
  'Flayn',
  'Manuela',
  'Hanneman',
  'Alois',
  'Gilbert',
  'Catherine',
  'Shamir',
  'Cyril',

  // Pokémon — further trainers, leaders and champions
  'Lance',
  'Bruno',
  'Agatha',
  'Will',
  'Koga',
  'Janine',
  'Sidney',
  'Glacia',
  'Aaron',
  'Flint',
  'Lucian',
  'Cynthia',
  'Shauntal',
  'Grimsley',
  'Caitlin',
  'Alder',
  'Malva',
  'Siebold',
  'Wikstrom',
  'Drasna',
  'Diantha',
  'Acerola',
  'Kahili',
  'Molayne',
  'Hapu',
  'Nanu',
  'Rita',
  'Klara',
  'Avery',
  'Peony',
  'Peonia',
  'Rei',
  'Akari',
  'Adaman',
  'Irida',
  'Volo',
  'Cogita',
  'Nemona',
  'Arven',
  'Clavell',
  'Brassius',
  'Iono',
  'Larry',
  'Ryme',
  'Tulip',
  'Grusha',
  'Rika',
  'Hassel',
  'Geeta',

  // Stardew Valley, Rune Factory, Story of Seasons
  'Krobus',
  'Dwarf',
  'Bouquet',
  'Morgan',
  'Claire',
  'Ludus',
  'Murakumo',
  'Blaise',
  'Illuminata',
  'Candy',
  'Barrett',
  'Volkanon',
  'Xiao',
  'Leon',
  'Arthur',
  'Nancy',
  'Jones',
  'Lin',
  'Fuuka',
  'Terry',

  // Xenoblade, Kirby, Metroid, Splatoon, Star Fox
  'Nikol',
  'Panacea',
  'Manana',
  'Ashera',
  'Linka',
  'Alexandria',
  'Isurd',
  'Monica',
  'Segiri',
  'Ghondor',
  'Fiona',
  'Miyabi',
  'Ashley',
  'Marx',
  'Taranza',
  'Claycia',
  'Bandana',
  'Sirica',
  'Anthony',
  'Frye',
  'Shelly',

  // Assorted wholesome casts — Professor Layton, Ace Attorney, Golden Sun,
  // Chrono, Tales, Trails, Atelier, Octopath, indies
  'Descole',
  'Randall',
  'Aurora',
  'Bostro',
  'Ridelle',
  'Sammy',
  'Godot',
  'Angel',
  'Lotta',
  'Adrian',
  'Regina',
  'Matt',
  'Vera',
  'Lamiroir',
  'Kraden',
  'Hama',
  'Karis',
  'Tyrell',
  'Amiti',
  'Rief',
  'Himi',
  'Eoleo',
  'Robo',
  'Serge',
  'Leena',
  'Norris',
  'Colette',
  'Genis',
  'Raine',
  'Presea',
  'Regal',
  'Zelos',
  'Sheena',
  'Estelle',
  'Joshua',
  'Renne',
  'Tita',
  'Agate',
  'Schera',
  'Kloe',
  'Olivier',
  'Julia',
  'Mueller',
  'Rean',
  'Alisa',
  'Elliot',
  'Laura',
  'Machias',
  'Emma',
  'Fie',
  'Jusis',
  'Gaius',
  'Millium',
  'Sara',
  'Towa',
  'Angelica',
  'Ryza',
  'Klaudia',
  'Tao',
  'Lent',
  'Empel',
  'Lila',
  'Sophie',
  'Plachta',
  'Firis',
  'Lydie',
  'Suelle',
  'Totori',
  'Meruru',
  'Rorona',
  'Therion',
  'Agnea',
  'Partitio',
  'Osvald',
  'Castti',
  'Temenos',
  'Throne',
  'Hikari',
  'Nomi',
  'Junia',
];

/**
 * Family names taken verbatim from a game's cast — 242 entries.
 *
 * These read the most naturally, so they stay a hand-written list. The pool the
 * scrub actually uses is {@link SURNAMES}, which adds a much larger COMPOSED set
 * below; see that comment for why size matters here.
 *
 * Two internal rules worth keeping if you extend this: the Pokémon professors
 * are all named after plants, and the Fire Emblem entries are noble houses or
 * the territories they are named for. Both give a reviewer a quick way to
 * sanity-check an addition.
 */
const CURATED_SURNAMES: readonly string[] = [
  // ── The one deliberate prefix family in this pool ─────────────────────────
  // Fewer families here than in the given names, and that is fine: the engine
  // disagreement these exist to expose is on first+last CONCATENATION, so it is
  // prefix relationships among GIVEN names that flip the sort order.
  'Oak', // Pokémon professor
  'Oakley', // Pokémon

  // ── Ace Attorney ──────────────────────────────────────────────────────────
  'Wright',
  'Fey',
  'Edgeworth',
  'Gumshoe',
  'Skye',
  'Justice',
  'Cykes',
  'Blackquill',
  'Payne',
  'Grossberg',
  'Hawthorne',
  'Starr',

  // ── Pokémon professors — named after trees ────────────────────────────────
  'Elm',
  'Birch',
  'Rowan',
  'Juniper',
  'Sycamore',
  'Magnolia',
  'Kukui',
  'Cerise',
  'Ketchum',

  // ── Final Fantasy ─────────────────────────────────────────────────────────
  'Strife',
  'Lockhart',
  'Gainsborough', // joint-longest entry, deliberately kept
  // Barret Wallace's surname is deliberately absent: Wallace is a Pokémon
  // champion in GIVEN_NAMES, and the two pools have to stay disjoint so a value
  // alone says which field it belongs to.
  'Highwind',
  'Kisaragi',
  'Valentine',
  'Fair',
  'Leonhart',
  'Heartilly',
  'Trepe',
  'Tilmitt',
  'Kinneas',
  'Branford',
  'Cole',
  'Figaro',
  'Garamonde',
  'Farron',
  'Estheim',
  'Katzroy',
  'Villiers',
  'Bunansa',
  'Beoulve',
  'Dia',

  // ── Fire Emblem — the noble houses of Fódlan ──────────────────────────────
  'Blaiddyd',
  'Riegan',
  'Goneril',
  'Gautier',
  'Fraldarius',
  'Gloucester',
  'Ordelia',
  'Daphnel',
  'Charon',
  'Nuvelle',
  'Bergliez',
  'Hevring',
  'Varley',
  'Molinaro',
  'Casagranda',
  'Eisner',
  'Rowe',
  'Gaspard',

  // ── Star Fox ──────────────────────────────────────────────────────────────
  'McCloud',
  'Lombardi',
  'Hare',

  // ── Overwatch ─────────────────────────────────────────────────────────────
  'Oxton',
  'Amari',
  'Ziegler',
  'Lindholm',
  'Wilhelm',
  'Zaryanova',
  'Vaswani',
  'Correia',
  'Santos',
  'Song',
  'Rutledge',

  // ── Tales series ──────────────────────────────────────────────────────────
  'Irving',
  'Aurion',
  'Sage',
  'Brunel',
  'Wilder',
  'Lowell',
  'Bryant',

  // ── Professor Layton ──────────────────────────────────────────────────────
  'Layton',
  'Triton',
  'Reinhold',
  'Ascot',
  'Altava',
  'Whistler',

  // ── Octopath Traveler ─────────────────────────────────────────────────────
  'Eisenberg',
  'Azelhart',
  'Greengrass',
  'Colzione',
  'Albright',
  'Clement',

  // ── Trails, Star Ocean, Ys, Valkyria Chronicles ───────────────────────────
  'Bright',
  'Reinford',
  'Schwarzer',
  'Leingod',
  'Kenny',
  'Christin',
  'Gunther',
  'Melchiott',

  // ── Adventure and shooter leads ───────────────────────────────────────────
  'Croft',
  'Drake',
  'Sullivan',
  'Fisher',
  'Shepard',
  'Lawson',
  'Alenko',
  'Williams',
  'Hawke',
  'Amell',
  'Cousland',
  'Trevelyan',
  'Lavellan',
  'Freeman',
  'Vance',
  'Calhoun',
  'Keyes',
  'Johnson',
  'Caulfield',
  'Price',
  'Diaz',
  'Bartlett',
  'Nagase',
  'Grimm',

  // ── Nintendo odds and ends ────────────────────────────────────────────────
  'Hyrule',
  'Nohansen', // Zelda's full name is Zelda Nohansen Hyrule
  'Toadstool',
  'Aran',
  'Higgs',
  'Prower', // Tails' surname is Miles Prower
  'Light', // Mega Man's Dr. Light
  'Cossack',
  'Masters',
  'Kasugano',
  'White',
  'Nook',
  'Slider',
  'Sanderson',
  'Andonuts',
  'Minch',
  'Mullner',
  'Ashtear',
  'LeBeau',
  'Cuttlefish',

  // ── Grown 150 → 243 on 2026-09-01, to cut introduced duplicate names ──────
  // Measured cause: 150 surnames over 2,375 users is ~16 people per surname, so
  // 140 full names ended up shared. ⚠ **About 68 of those are FAITHFUL** — the
  // same population showed 68 shared names under the old near-unique faker
  // names, so production genuinely has them and the scrub must keep them. Pool
  // growth can only shrink the ~72 introduced ones, and 68 is the floor. Do NOT
  // "fix" the remainder with a uniqueness registry: for people that would erase
  // a real production characteristic. (A registry IS right for projects, whose
  // names carry a unique constraint.)

  // Ace Attorney
  'Powers',
  'Hart',
  'Marshall',
  'Faraday',
  'Lang',
  'Mikotoba',
  'Asogi',
  'Naruhodo',

  // Final Fantasy
  'Kramer',
  'Almasy',
  'Loire',
  'Tribal',
  'Amicitia',
  'Scientia',
  'Argentum',

  // Fire Emblem — more houses of Fódlan
  'Aegir',
  'Vestra',
  'Hresvelg',
  'Dominic',
  'Martritz',
  'Galatea',

  // Fire Emblem — the houses of Jugdral
  'Chalphy',
  'Nordion',
  'Yngvi',
  'Velthomer',
  'Freege',
  'Dozel',
  'Edda',
  'Lenster',

  // Fire Emblem — territories used as house names in Elibe and Magvel, the
  // same convention as Fódlan above
  'Ostia',
  'Pherae',
  'Caelin',
  'Etruria',
  'Renais',
  'Frelia',
  'Jehanna',
  'Rausten',
  'Greil',

  // Xenoblade Chronicles
  'Ladair',
  'Genbu',

  // Pokémon — professors, keeping the named-after-plants rule
  'Laventon',
  'Burnet',
  'Jacq',
  'Amanita',
  'Fennel',

  // Atelier — alchemy-and-crafting cast, a deliberately wholesome source
  'Altugle',
  'Malier',
  'Fiscario',
  'Neuenmuller',
  'Mistlud',
  'Marlen',
  'Stout',
  'Valentz',
  'Helmold',
  'Mongarten',
  'Marslink',
  'Vollmer',
  'Decyrus',

  // Trails, Tales, Valkyria Chronicles, Skies of Arcadia, F-Zero
  'Osborne',
  'Arseid',
  'Lenheim',
  'Diphda',
  'Randgriz',
  'Dyne',
  'Summer',
  'Stewart',

  // Metroid, Street Fighter, Hotel Dusk, Another Code
  'Malkovich',
  'Kanzuki',
  'Hyde',
  'Robbins',

  // Mass Effect
  'Taylor',
  'Traynor',
  'Adams',
  'Cortez',
  'Moreau',
  'Chakwas',

  // Dragon Age
  'Surana',
  'Mahariel',
  'Pentaghast',
  'Rutherford',
  'Tethras',
  'Cadash',
  'Adaar',
  'Aeducan',
  'Brosca',

  // Halo, Half-Life, Uncharted
  'Halsey',
  'Mendez',
  'Palmer',
  'Lasky',
  'Kleiner',
  'Magnusson',
  'Mossman',
  'Cutter',
];

/**
 * Places from games, used as the first half of a composed surname.
 *
 * ⚠ No root may END with one of the {@link SURNAME_SUFFIXES} — "Dewford" plus
 * "ford" reads as a typo. Pokémon's Dewford and Golden Sun's Vale were dropped
 * for exactly that.
 */
const PLACE_ROOTS: readonly string[] = [
  // The Legend of Zelda
  'Hyrule',
  'Eldin',
  'Faron',
  'Lanayru',
  'Necluda',
  'Hebra',
  'Akkala',
  'Termina',
  'Gerudo',
  'Kakariko',
  'Hateno',
  'Lurelin',
  'Zonai',
  'Kokiri',
  'Ordon',
  'Skyloft',
  'Windfall',
  'Outset',
  'Holodrum',
  'Labrynna',
  'Tabantha',

  // Pokémon — regions and towns
  'Kanto',
  'Johto',
  'Hoenn',
  'Sinnoh',
  'Unova',
  'Kalos',
  'Alola',
  'Galar',
  'Paldea',
  'Viridian',
  'Cerulean',
  'Celadon',
  'Saffron',
  'Azalea',
  'Goldenrod',
  'Olivine',
  'Blackthorn',
  'Littleroot',
  'Petalburg',
  'Rustboro',
  'Slateport',
  'Mauville',
  'Fortree',
  'Lilycove',
  'Mossdeep',
  'Twinleaf',
  'Floaroma',
  'Eterna',
  'Hearthome',
  'Solaceon',
  'Canalave',
  'Snowpoint',
  'Sunyshore',

  // Fire Emblem — continents and territories
  'Fódlan',
  'Faerghus',
  'Adrestia',
  'Leicester',
  'Jugdral',
  'Elibe',
  'Magvel',
  'Tellius',
  'Ylisse',
  'Valm',
  'Hoshido',
  'Nohr',
  'Askr',
  'Sacae',
  'Lycia',

  // Xenoblade Chronicles
  'Bionis',
  'Mechonis',
  'Alrest',
  'Gormott',
  'Uraya',
  'Ardain',
  'Leftheria',
  'Tantal',
  'Indol',
  'Aionios',
  'Keves',
  'Agnus',

  // Final Fantasy
  'Midgar',
  'Kalm',
  'Junon',
  'Gongaga',
  'Wutai',
  'Balamb',
  'Galbadia',
  'Trabia',
  'Esthar',
  'Dollet',
  'Besaid',
  'Kilika',
  'Djose',
  'Bevelle',
  'Zanarkand',
  'Spira',
  'Ivalice',
  'Rabanastre',
  'Dalmasca',
  'Bhujerba',
  'Lindblum',
  'Burmecia',
  'Treno',
  'Cleyra',
  'Narshe',
  'Kohlingen',
  'Jidoor',
  'Thamasa',
  'Maranda',
  'Doma',

  // Star Fox
  'Corneria',
  'Katina',
  'Fichina',
  'Sauria',
  'Papetoon',
  'Zoness',
  'Aquas',
  'Fortuna',

  // Metroid
  'Zebes',
  'Tallon',
  'Aether',
  'Bryyo',
  'Elysia',
  'Norion',

  // Golden Sun
  'Vault',
  'Bilibin',
  'Kolima',
  'Imil',
  'Tolbi',
  'Madra',
  'Garoh',
  'Kibombo',
  'Yallam',
  'Contigo',

  // Trails
  'Colseit',
  'Zeiss',
  'Bose',
  'Ruan',
  'Grancel',
  'Crossbell',
  'Heimdallr',
  'Trista',
  'Celdic',
  'Ordis',

  // Tales
  'Iselia',
  'Triet',
  'Palmacosta',
  'Luin',
  'Hima',
  'Tethealla',
  'Sylvarant',
  'Meltokio',
  'Flanoir',
  'Altamira',

  // Chrono Trigger
  'Truce',
  'Porre',
  'Choras',
  'Guardia',
  'Zenan',

  // Kirby, Super Mario, Pikmin, Stardew Valley
  'Popstar',
  'Halcandra',
  'Floria',
  'Sarasaland',
  'Rogueport',
  'Delfino',
  'Sprixie',
  'Hocotate',
  'Koppai',
  'Pelican',
  'Zuzu',
  'Calico',
  'Stardew',
];

/**
 * Geographic qualifiers, so a project title reads like the real ones do — a
 * place plus a descriptor, the shape "Mudi Cluster" already has.
 */
const PROJECT_DESCRIPTORS: readonly string[] = [
  'Highlands',
  'Lowlands',
  'Coastal',
  'Interior',
  'Basin',
  'Valley',
  'Delta',
  'Plains',
  'Uplands',
  'Reach',
  'Marches',
  'Expanse',
  'Frontier',
  'Heartland',
  'Borderlands',
  'Foothills',
  'Steppe',
  'Savanna',
  'Woodlands',
  'Wetlands',
  'Drylands',
  'Isles',
  'Archipelago',
  'Peninsula',
  'Cape',
  'Sound',
  'Straits',
  'Narrows',
  'Bay',
  'Gulf',
  'Ridge',
  'Escarpment',
  'Plateau',
  'Highroad',
  'Crossing',
  'Junction',
  'Corridor',
  'Watershed',
  'Headwaters',
  'Confluence',
];

/**
 * Titles a project's name BASE can be replaced with — 173 bare place roots plus
 * every root crossed with a descriptor, so 7,093 in total.
 *
 * **Sized to make exhaustion impossible, not merely unlikely.** The registry in
 * `project-name.ts` assigns each distinct base a DISTINCT title, because
 * `projects.name` is UNIQUE and a collision aborts the load. There are 5,284
 * projects, so 5,284 is the hard ceiling on distinct bases and 7,093 clears it
 * with room to spare — no census needed to size this safely, and the registry
 * throws loudly rather than silently suffixing if that ever stops being true.
 *
 * ⚠ Order is load-bearing here as it is for the other pools: bare roots first,
 * then the cross product in this order, or every assignment shifts.
 */
export const PROJECT_TITLES: readonly string[] = [
  ...PLACE_ROOTS,
  ...PLACE_ROOTS.flatMap((root) =>
    PROJECT_DESCRIPTORS.map((descriptor) => `${root} ${descriptor}`),
  ),
];

/** Ordinary English surname endings, so a composed name reads as a surname. */
const SURNAME_SUFFIXES: readonly string[] = [
  'vale',
  'ford',
  'wood',
  'heim',
  'gard',
  'crest',
  'field',
  'brook',
  'ridge',
  'mont',
  'stead',
  'haven',
  'moor',
  'hollow',
];

/**
 * The surname pool the scrub uses: the curated list, plus every place root
 * crossed with every suffix — "Eldinvale", "Faronford", "Akkalacrest".
 *
 * ## Why composed rather than hand-listed
 *
 * **Pool SIZE is what controls invented duplicates, and the required size is
 * measured, not guessed.** The real population holds **1,539 distinct first
 * names and 1,870 distinct last names** across 2,376 users (measured from
 * `cord_cutover_r4`, which carries names from a scrub of real data). A pool
 * smaller than that must map several distinct real people onto one fake name.
 *
 * At 242 surnames the copy showed **116 duplicate full names** where production
 * has **68** — and production's 68 are FAITHFUL and must survive. Invented
 * duplicates fall roughly as 5.4M / (givenNames x surnames), so the fix is
 * combinations, and composition buys them without a 2,000-line list nobody can
 * review: {@link PLACE_ROOTS} x {@link SURNAME_SUFFIXES} is two short lists and
 * one rule, and vetoing a root removes fourteen names at once.
 *
 * ⚠ A registry would drive invented duplicates to exactly zero, and it is NOT
 * worth it here: keyed on the value it would preserve the faithful 68 correctly,
 * but at this pool size plain hashing already lands within a few of that floor,
 * so the stateful pre-pass buys almost nothing. (Projects are the opposite case
 * — their names carry a UNIQUE constraint, so that increment does need one.)
 *
 * ⚠ Order is load-bearing. A fake is `hash(original) % pool.length`, so the
 * curated entries must stay FIRST and the cross product must stay in this
 * order, or every assignment shifts.
 */
export const SURNAMES: readonly string[] = [
  ...CURATED_SURNAMES,
  ...PLACE_ROOTS.flatMap((root) =>
    SURNAME_SUFFIXES.map((suffix) => root + suffix),
  ),
];
