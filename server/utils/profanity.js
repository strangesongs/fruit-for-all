// Basic profanity filter — checks notes text before saving.
// Add words to the list as needed.
const BLOCKED_WORDS = [
  // Core profanity
  'fuck', 'fucker', 'fucked', 'fucking', 'fucks', 'motherfucker', 'motherfucking',
  'shit', 'shits', 'shitting', 'shitty', 'bullshit',
  'ass', 'asshole', 'asses', 'jackass', 'dumbass', 'smartass', 'badass',
  'bitch', 'bitches', 'bitchy',
  'bastard', 'bastards',
  'damn', 'goddamn', 'dammit',
  'crap', 'crappy',
  'piss', 'pissed', 'pissing',
  'hell',

  // Genitalia / sexual
  'cock', 'cocks', 'cunt', 'cunts', 'dick', 'dicks', 'pussy', 'pussies',
  'prick', 'twat', 'twats', 'wanker', 'wankers', 'wank',
  'bollocks', 'balls', 'tits', 'titties', 'boobs',
  'penis', 'vagina', 'anus',
  'dildo', 'butt', 'butthole', 'rectum',
  'cumshot', 'cum', 'jizz', 'spunk', 'boner',
  'blowjob', 'handjob', 'fingering', 'rimjob',
  'horny', 'slutty', 'whore', 'whores', 'slut', 'sluts',
  'hoe', 'skank', 'skanky',
  'sex', 'sexy', 'sexting', 'nude', 'nudes', 'naked', 'porn', 'porno', 'pornography',
  'xxx', 'erotic', 'orgasm', 'masturbate', 'masturbation',

  // Slurs — racial / ethnic
  'nigger', 'niggers', 'nigga', 'niggas',
  'chink', 'chinks', 'gook', 'gooks',
  'spic', 'spics', 'wetback', 'wetbacks', 'beaner', 'beaners',
  'kike', 'kikes', 'hymie',
  'raghead', 'towelhead', 'sandnigger',
  'cracker', 'honky', 'whitey',
  'zipperhead', 'slant',

  // Slurs — homophobic / transphobic
  'fag', 'fags', 'faggot', 'faggots',
  'dyke', 'dykes', 'queer',
  'tranny', 'trannies', 'shemale',

  // Slurs — ableist
  'retard', 'retards', 'retarded', 'spaz', 'spastic',
  'idiot', 'moron', 'imbecile', 'cretin',

  // Violence / hate
  'murder', 'rape', 'rapist', 'molest', 'molester',
  'terrorist', 'jihad',
  'lynch', 'lynching',

  // Drug slang
  'cocaine', 'heroin', 'meth', 'coke', 'dope',
];

// Normalise for leet-speak and common substitutions: a→@, e→3, i→1, o→0, s→$
function normalise(text) {
  return text
    .toLowerCase()
    .replace(/@/g, 'a')
    .replace(/3/g, 'e')
    .replace(/1/g, 'i')
    .replace(/0/g, 'o')
    .replace(/\$/g, 's')
    .replace(/5/g, 's')
    .replace(/[^a-z\s]/g, ''); // strip remaining non-alpha
}

export function containsProfanity(text) {
  if (!text || typeof text !== 'string') return false;
  const normalised = normalise(text);
  // Split on whitespace and check each word
  const words = normalised.split(/\s+/);
  return words.some(word => BLOCKED_WORDS.includes(word));
}
