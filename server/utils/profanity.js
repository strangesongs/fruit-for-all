// Basic profanity filter — checks notes text before saving.
// Add words to the list as needed.
const BLOCKED_WORDS = [
  'fuck', 'shit', 'cunt', 'cock', 'dick', 'pussy', 'ass', 'bitch', 'bastard',
  'whore', 'slut', 'fag', 'faggot', 'nigger', 'nigga', 'chink', 'spic',
  'kike', 'wetback', 'retard', 'tranny', 'dyke', 'piss', 'crap',
  'motherfucker', 'fucker', 'asshole', 'jackass', 'dumbass', 'bullshit',
  'goddamn', 'damn', 'prick', 'twat', 'wanker', 'bollocks'
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
