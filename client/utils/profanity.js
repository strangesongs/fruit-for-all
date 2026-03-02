// Mirrors server/utils/profanity.js — keep both in sync when updating the list.
const BLOCKED_WORDS = [
  'fuck', 'shit', 'cunt', 'cock', 'dick', 'pussy', 'ass', 'bitch', 'bastard',
  'whore', 'slut', 'fag', 'faggot', 'nigger', 'nigga', 'chink', 'spic',
  'kike', 'wetback', 'retard', 'tranny', 'dyke', 'piss', 'crap',
  'motherfucker', 'fucker', 'asshole', 'jackass', 'dumbass', 'bullshit',
  'goddamn', 'damn', 'prick', 'twat', 'wanker', 'bollocks'
];

function normalise(text) {
  return text
    .toLowerCase()
    .replace(/@/g, 'a')
    .replace(/3/g, 'e')
    .replace(/1/g, 'i')
    .replace(/0/g, 'o')
    .replace(/\$/g, 's')
    .replace(/5/g, 's')
    .replace(/[^a-z\s]/g, '');
}

export function containsProfanity(text) {
  if (!text || typeof text !== 'string') return false;
  const words = normalise(text).split(/\s+/);
  return words.some(word => BLOCKED_WORDS.includes(word));
}
