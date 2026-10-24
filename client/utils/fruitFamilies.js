// Kinds of find and their hand-cut marks. One mark per kind (not per fruit), so the
// ~190 entries in FRUIT_LIST need only 9 drawings + a fallback. The shape says what a
// find is; the pin's ring says whether it's in season (see map.jsx).
//
// Dependency-free so it can be unit-tested and shared like fruitList.js.

// Inner SVG markup for a 24×24 viewBox. Uses currentColor so callers pick the ink.
// These are constant strings (never user data), safe to inject as markup.
const MARKS = {
  tree:
    '<circle cx="12" cy="14.5" r="6.5"/><path d="M12 8 C12 6.3 12.6 4.6 13.6 3.6"/>' +
    '<path d="M13.2 5.2 C15.6 3.6 18.2 4 19.3 5.6 C17.2 7.2 14.6 7.1 13.2 5.2Z" fill="currentColor"/>',
  citrus:
    '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="6"/>' +
    '<path d="M12 6.5 V17.5 M6.5 12 H17.5 M8.1 8.1 L15.9 15.9 M15.9 8.1 L8.1 15.9"/>',
  tropical:
    '<path d="M12 3 C9 3 7.6 6 7.6 9 C7.6 11 6 12.6 6 15.4 C6 19 8.7 21 12 21 C15.3 21 18 19 18 15.4 C18 12.6 16.4 11 16.4 9 C16.4 6 15 3 12 3Z"/>' +
    '<circle cx="12" cy="15.4" r="2.7" fill="currentColor"/>',
  berries:
    '<circle cx="12" cy="7.5" r="2.6" fill="currentColor"/><circle cx="8.4" cy="11.6" r="2.6" fill="currentColor"/>' +
    '<circle cx="15.6" cy="11.6" r="2.6" fill="currentColor"/><circle cx="12" cy="15.6" r="2.6" fill="currentColor"/>' +
    '<circle cx="12" cy="11.6" r="2.6"/><path d="M12 4.9 V2.5 M12 3.2 L14.6 2.4"/>',
  nuts:
    '<path d="M5.6 10.2 C5.6 6.6 8.6 4.6 12 4.6 C15.4 4.6 18.4 6.6 18.4 10.2Z" fill="currentColor"/>' +
    '<path d="M7.2 10.2 C7.2 15 9.6 19.4 12 20.6 C14.4 19.4 16.8 15 16.8 10.2"/><path d="M12 4.6 V2.4"/>',
  mushrooms:
    '<path d="M3.4 12.2 C3.4 7.2 7.4 4.2 12 4.2 C16.6 4.2 20.6 7.2 20.6 12.2Z"/>' +
    '<path d="M9.6 12.2 L9.1 19.4 C9.1 20.3 9.8 21 10.6 21 H13.4 C14.2 21 14.9 20.3 14.9 19.4 L14.4 12.2"/>' +
    '<circle cx="8.4" cy="9" r="1.1" fill="currentColor"/><circle cx="12.6" cy="7" r="1.1" fill="currentColor"/>' +
    '<circle cx="16" cy="9.6" r="1.1" fill="currentColor"/>',
  herbs:
    '<path d="M12 21.5 V4"/>' +
    '<path d="M12 9 C9.4 9 7.3 7.4 6.8 5.2 C9.4 5.2 11.5 6.8 12 9Z" fill="currentColor"/>' +
    '<path d="M12 9 C14.6 9 16.7 7.4 17.2 5.2 C14.6 5.2 12.5 6.8 12 9Z" fill="currentColor"/>' +
    '<path d="M12 15 C9.2 15 6.9 13.3 6.3 10.9 C9.2 10.9 11.4 12.6 12 15Z"/>' +
    '<path d="M12 15 C14.8 15 17.1 13.3 17.7 10.9 C14.8 10.9 12.6 12.6 12 15Z"/>',
  greens:
    '<path d="M12 21 C6 17 5 10 9 5 C10.5 3.4 13.5 3.4 15 5 C19 10 18 17 12 21Z"/>' +
    '<path d="M12 21 V6.5 M12 11 L9 8.6 M12 11 L15 8.6 M12 15 L8.4 12.4 M12 15 L15.6 12.4"/>',
  medicinal:
    '<ellipse cx="12" cy="6.2" rx="2.3" ry="3.2"/>' +
    '<ellipse cx="12" cy="6.2" rx="2.3" ry="3.2" transform="rotate(72 12 12)"/>' +
    '<ellipse cx="12" cy="6.2" rx="2.3" ry="3.2" transform="rotate(144 12 12)"/>' +
    '<ellipse cx="12" cy="6.2" rx="2.3" ry="3.2" transform="rotate(216 12 12)"/>' +
    '<ellipse cx="12" cy="6.2" rx="2.3" ry="3.2" transform="rotate(288 12 12)"/>' +
    '<circle cx="12" cy="12" r="2.3" fill="currentColor"/>',
  seed:
    '<path d="M12 3.6 C16.2 7.8 16.2 16.2 12 20.4 C7.8 16.2 7.8 7.8 12 3.6Z"/><path d="M12 7 V17"/>',
};

// Block-print colour blocks (Oct 2026): each mark is printed as two blocks, a flat
// fruit-coloured shape under the ink linework, nudged slightly out of register.
// Colours are CSS custom properties from :root in sidebar.css, so the palette stays
// in one place (these strings only ever render inside the document, never in an <img>).
// Keep to the four block inks: persimmon, citron, fig, sage.
const BLOCKS = {
  tree: { ink: '--persimmon', shape: '<circle cx="12" cy="14.5" r="6.3"/>' },
  citrus: { ink: '--citron', shape: '<circle cx="12" cy="12" r="7.8"/>' },
  tropical: {
    ink: '--persimmon',
    shape: '<path d="M12 3 C9 3 7.6 6 7.6 9 C7.6 11 6 12.6 6 15.4 C6 19 8.7 21 12 21 C15.3 21 18 19 18 15.4 C18 12.6 16.4 11 16.4 9 C16.4 6 15 3 12 3Z"/>',
  },
  berries: {
    ink: '--fig',
    shape: '<circle cx="12" cy="7.5" r="2.8"/><circle cx="8.4" cy="11.6" r="2.8"/><circle cx="15.6" cy="11.6" r="2.8"/>' +
      '<circle cx="12" cy="15.6" r="2.8"/><circle cx="12" cy="11.6" r="2.8"/>',
  },
  nuts: { ink: '--citron', shape: '<path d="M7.2 10.2 C7.2 15 9.6 19.4 12 20.6 C14.4 19.4 16.8 15 16.8 10.2Z"/>' },
  mushrooms: { ink: '--persimmon', shape: '<path d="M3.4 12.2 C3.4 7.2 7.4 4.2 12 4.2 C16.6 4.2 20.6 7.2 20.6 12.2Z"/>' },
  herbs: {
    ink: '--sage',
    shape: '<path d="M12 9 C9.4 9 7.3 7.4 6.8 5.2 C9.4 5.2 11.5 6.8 12 9Z"/><path d="M12 9 C14.6 9 16.7 7.4 17.2 5.2 C14.6 5.2 12.5 6.8 12 9Z"/>' +
      '<path d="M12 15 C9.2 15 6.9 13.3 6.3 10.9 C9.2 10.9 11.4 12.6 12 15Z"/><path d="M12 15 C14.8 15 17.1 13.3 17.7 10.9 C14.8 10.9 12.6 12.6 12 15Z"/>',
  },
  greens: { ink: '--sage', shape: '<path d="M12 21 C6 17 5 10 9 5 C10.5 3.4 13.5 3.4 15 5 C19 10 18 17 12 21Z"/>' },
  medicinal: {
    ink: '--fig',
    shape: [0, 72, 144, 216, 288]
      .map((a) => `<ellipse cx="12" cy="6.2" rx="2.4" ry="3.3" transform="rotate(${a} 12 12)"/>`).join('') +
      '<circle cx="12" cy="12" r="2.4"/>',
  },
  seed: { ink: '--citron', shape: '<path d="M12 3.6 C16.2 7.8 16.2 16.2 12 20.4 C7.8 16.2 7.8 7.8 12 3.6Z"/>' },
};

// How far the colour block sits off the linework, in viewBox units (24 = the mark).
const REGISTER_OFFSET = 1.4;

const MEMBERS = {
  tree: [
    'apple', 'apricot', 'asian pear', 'cherry', 'crabapple', 'fig', 'loquat', 'medlar', 'nectarine',
    'pawpaw', 'peach', 'pear', 'persimmon', 'plum', 'pluot', 'quince', 'sour cherry',
    'date', 'jujube', 'olive', 'pomegranate', 'beach plum', 'carob', 'cherry plum', 'chokecherry', 'cornelian cherry', 'mayhaw', 'sloe', 'strawberry tree', 'tejocote',
  ],
  citrus: [
    'bergamot', 'blood orange', 'calamansi', 'citron', 'clementine', 'grapefruit', 'kumquat', 'lemon',
    'lime', 'mandarin', 'orange', 'pomelo', 'tangerine', 'yuzu', 'finger lime', 'makrut lime', 'sour orange', 'trifoliate orange',
  ],
  tropical: [
    'avocado', 'banana', 'breadfruit', 'cherimoya', 'dragon fruit', 'feijoa', 'guava', 'jackfruit',
    'jaboticaba', 'longan', 'lychee', 'mango', 'papaya', 'passion fruit', 'rambutan', 'sapote', 'soursop',
    'starfruit', 'surinam cherry', 'tamarind', 'prickly pear', 'acerola', 'black sapote', 'canistel', 'ice cream bean', 'mamey sapote', 'natal plum', 'sea grape', 'strawberry guava', 'wax apple', 'white sapote',
  ],
  berries: [
    'aronia', 'autumn olive', 'blackberry', 'blueberry', 'boysenberry', 'cranberry', 'currant', 'dewberry',
    'elderberry', 'gooseberry', 'grape', 'hawthorn', 'huckleberry', 'kiwi', 'loganberry', 'raspberry',
    'rose hip', 'strawberry', 'wintergreen', 'mulberry', 'serviceberry', 'goji', 'goumi', 'haskap', 'lingonberry', 'manzanita', 'muscadine', 'oregon grape', 'salal', 'salmonberry', 'sea buckthorn', 'thimbleberry', 'wineberry',
  ],
  nuts: ['almond', 'chestnut', 'hazelnut', 'macadamia', 'pecan', 'pine nut', 'pistachio', 'walnut', 'coconut',
    'acorn', 'beechnut', 'black walnut', 'butternut', 'hickory'],
  mushrooms: [
    'black trumpet', 'cauliflower mushroom', 'chanterelle', 'chicken of the woods', 'giant puffball',
    'hedgehog mushroom', 'hen of the woods', "lion's mane", 'lobster mushroom', 'matsutake',
    'meadow mushroom', 'morel', 'oyster mushroom', 'porcini', 'shaggy mane', 'turkey tail', 'wine cap',
  ],
  herbs: [
    'basil', 'bay laurel', 'borage', 'chervil', 'chives', 'cilantro', 'curry leaf', 'dill',
    'epazote', 'fennel', 'holy basil', 'hyssop', 'lavender', 'lemon verbena', 'lovage', 'marjoram', 'mint',
    'oregano', 'parsley', 'perilla', 'rosemary', 'rue', 'sage', 'shiso', 'sorrel', 'summer savory',
    'stevia', 'tarragon', 'thyme', 'vietnamese coriander', 'winter savory', 'lemongrass', 'pineapple sage',
  ],
  greens: [
    'anise hyssop', 'burdock', 'cattail', 'chickweed', 'chicory', 'dandelion',
    'fiddlehead fern', 'field garlic', 'garlic mustard', 'ground ivy', 'jerusalem artichoke',
    'lambsquarters', 'mallow', "miner's lettuce", 'nettles', 'purslane',
    'ramps', 'sheep sorrel', 'spicebush', 'sweet cicely', 'violet', 'watercress', 'wild bergamot',
    'wild ginger', 'wild mint', 'wild onion', 'wood nettle', 'wood sorrel', 'amaranth', 'curly dock', 'nasturtium', 'new zealand spinach', 'nopales', 'sow thistle', 'wild asparagus', 'wild mustard', 'wild radish',
  ],
  medicinal: [
    'aloe vera',
    'calendula',
    'california poppy',
    'catnip',
    'chamomile',
    'cleavers',
    'comfrey',
    'echinacea',
    'elderflower',
    'feverfew',
    'ginkgo',
    'gotu kola',
    'hibiscus',
    'horehound',
    'horsetail',
    'lemon balm',
    'linden',
    'marshmallow',
    'motherwort',
    'mugwort',
    'mullein',
    'passionflower',
    'plantain',
    'red clover',
    'self-heal',
    'skullcap',
    "st. john's wort",
    'valerian',
    'yarrow',
    'yerba santa',
  ],
};

export const FAMILIES = [
  { id: 'tree', label: 'tree fruit' },
  { id: 'citrus', label: 'citrus' },
  { id: 'tropical', label: 'tropical' },
  { id: 'berries', label: 'berries & vines' },
  { id: 'nuts', label: 'nuts' },
  { id: 'mushrooms', label: 'mushrooms' },
  { id: 'herbs', label: 'herbs' },
  { id: 'greens', label: 'wild greens' },
  { id: 'medicinal', label: 'medicinal' },
];

export const FALLBACK_FAMILY = { id: 'seed', label: 'find' };

const BY_FRUIT = new Map();
for (const [family, names] of Object.entries(MEMBERS)) {
  for (const name of names) BY_FRUIT.set(name, family);
}
const LABELS = Object.fromEntries([...FAMILIES, FALLBACK_FAMILY].map((f) => [f.id, f.label]));

/** Family id ('tree', 'citrus', … or 'seed') for a fruit type, case-insensitive. */
export function familyOf(fruitType) {
  if (typeof fruitType !== 'string') return FALLBACK_FAMILY.id;
  return BY_FRUIT.get(fruitType.trim().toLowerCase()) || FALLBACK_FAMILY.id;
}

export function familyLabel(familyId) {
  return LABELS[familyId] || FALLBACK_FAMILY.label;
}

/** Inner SVG markup (24×24 viewBox, currentColor) for a family's mark. */
export function markInner(familyId) {
  return MARKS[familyId] || MARKS.seed;
}

/** CSS custom property (e.g. '--persimmon') for a family's colour block. */
export function blockInk(familyId) {
  return (BLOCKS[familyId] || BLOCKS.seed).ink;
}

/** Colour-block markup for a family: the flat shape, offset, filled with its ink. */
export function blockInner(familyId) {
  const b = BLOCKS[familyId] || BLOCKS.seed;
  return (
    `<g transform="translate(${REGISTER_OFFSET} ${REGISTER_OFFSET})" stroke="none" ` +
    `style="fill:var(${b.ink})">${b.shape}</g>`
  );
}

/**
 * Complete <svg> string for a family's mark — for Leaflet DivIcons and inline use.
 * `block: true` prints the colour block under the linework (in-season pins, popups).
 * `color` may be a hex or a CSS var() expression; it's only used inside the document.
 */
export function markSvg(familyId, { size = 20, color = 'var(--text)', strokeWidth = 1.7, block = false } = {}) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" ` +
    `fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" ` +
    `stroke-linejoin="round" style="color:${color}" aria-hidden="true">` +
    `${block ? blockInner(familyId) : ''}${markInner(familyId)}</svg>`
  );
}

// Exposed for tests.
export const _members = MEMBERS;
export const _blocks = BLOCKS;
