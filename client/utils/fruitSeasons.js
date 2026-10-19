// USDA Hardiness Zone-based fruit seasons
// Months are 1-indexed (1 = January, 12 = December)
// Sources and verification status per entry: docs/season-sources.md

export const FRUIT_SEASONS = {
  // Stone Fruits
  loquat: {
    zones: {
      10: [3, 4, 5, 6],           // Southern California, South Florida
      9: [4, 5, 6, 7],            // Northern California, Gulf Coast
      8: [5, 6, 7],               // Pacific Northwest, Mid-Atlantic
      7: [5, 6],                  // Northern states
    },
    display: "Spring - Early Summer"
  },
  
  fig: {
    zones: {
      10: [6, 7, 8, 9, 10],       // Two crops in warm zones
      9: [7, 8, 9],               
      8: [7, 8, 9],
      7: [8, 9],
    },
    display: "Summer - Fall"
  },
  
  peach: {
    zones: {
      10: [5, 6, 7],
      9: [6, 7, 8],
      8: [7, 8],
      7: [7, 8],
      6: [7, 8],
    },
    display: "Summer"
  },
  
  plum: {
    zones: {
      10: [5, 6, 7],
      9: [6, 7, 8],
      8: [7, 8],
      7: [7, 8, 9],
      6: [8, 9],
    },
    display: "Summer"
  },
  
  cherry: {
    zones: {
      10: [5, 6],                 // Early in warm zones
      9: [5, 6, 7],
      8: [6, 7],
      7: [6, 7],
      6: [7],
      5: [6, 7],                 // Door County WI, Traverse City MI area
    },
    display: "Early Summer"
  },
  
  apricot: {
    zones: {
      10: [5, 6],
      9: [6, 7],
      8: [6, 7],
      7: [7],
    },
    display: "Early Summer"
  },
  
  // Citrus (mostly warm zones)
  orange: {
    zones: {
      10: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], // navels Jan–Apr, then Valencias
      9: [12, 1, 2, 3, 4],
      8: [1, 2, 3],               // Limited areas
    },
    display: "Winter - Fall (navels, then Valencias)"
  },
  
  lemon: {
    zones: {
      10: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],  // Year-round
      9: [1, 2, 3, 4, 10, 11, 12],
      8: [1, 2, 11, 12],
    },
    display: "Year-round (warm zones)"
  },
  
  grapefruit: {
    zones: {
      10: [12, 1, 2, 3, 4, 5, 6],
      9: [1, 2, 3, 4],
    },
    display: "Winter - Early Summer"
  },
  
  lime: {
    zones: {
      10: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],  // Year-round in tropics
      9: [1, 2, 3, 10, 11, 12],
    },
    display: "Year-round (warm zones)"
  },
  
  tangerine: {
    zones: {
      10: [11, 12, 1, 2],
      9: [12, 1, 2, 3],
    },
    display: "Winter"
  },
  
  kumquat: {
    zones: {
      10: [10, 11, 12, 1, 2, 3],
      9: [12, 1, 2, 3],
      8: [1, 2],
    },
    display: "Fall - Winter"
  },
  
  // Pome Fruits
  apple: {
    zones: {
      10: [7, 8, 9],              // Early varieties in warm zones
      9: [8, 9, 10],
      8: [9, 10],
      7: [9, 10],
      6: [9, 10],
      5: [9, 10],
    },
    display: "Late Summer - Fall"
  },
  
  pear: {
    zones: {
      10: [7, 8, 9],
      9: [8, 9, 10],
      8: [8, 9, 10],
      7: [9, 10],
      6: [9, 10],
      5: [9, 10],
    },
    display: "Late Summer - Fall"
  },
  
  // Berries
  blackberry: {
    zones: {
      10: [5, 6, 7],
      9: [6, 7, 8],
      8: [6, 7, 8],
      7: [7, 8],
      6: [7, 8],
      5: [7, 8],
    },
    display: "Summer"
  },
  
  raspberry: {
    zones: {
      10: [5, 6, 7],
      9: [6, 7, 8],
      8: [6, 7, 8],
      7: [7, 8],
      6: [7, 8],
      5: [7, 8],
    },
    display: "Summer"
  },
  
  strawberry: {
    zones: {
      10: [3, 4, 5, 6],           // Spring crop in warm zones
      9: [4, 5, 6],
      8: [5, 6, 7],
      7: [6, 7],
    },
    display: "Spring - Early Summer"
  },
  
  blueberry: {
    zones: {
      10: [5, 6, 7],
      9: [6, 7, 8],
      8: [6, 7, 8],
      7: [7, 8],
      6: [7, 8],
      5: [7, 8, 9],              // Michigan, Maine highbush blueberry
    },
    display: "Summer"
  },
  
  mulberry: {
    zones: {
      10: [4, 5, 6, 7],
      9: [5, 6, 7],
      8: [6, 7],
      7: [6, 7],
    },
    display: "Late Spring - Summer"
  },
  
  // Tropical/Subtropical
  avocado: {
    zones: {
      10: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // Hass Jan–Oct; Fuerte, Bacon, Zutano Nov–Mar
      9: [3, 4, 5, 6, 7, 8],
    },
    display: "Year-round (Hass Jan - Oct, others winter)"
  },
  
  guava: {
    zones: {
      10: [8, 9, 10, 11],
      9: [9, 10],
    },
    display: "Late Summer - Fall (tropical)"
  },
  
  mango: {
    zones: {
      10: [5, 6, 7, 8, 9, 10],           // Tropical zones only
    },
    display: "Summer (tropical only)"
  },
  
  pomegranate: {
    zones: {
      10: [9, 10, 11],
      9: [9, 10, 11],
      8: [9, 10],
    },
    display: "Fall"
  },
  
  persimmon: {
    zones: {
      10: [10, 11, 12],
      9: [10, 11, 12],
      8: [10, 11],
      7: [10, 11],
    },
    display: "Fall - Early Winter"
  },
  
  // Nuts
  walnut: {
    zones: {
      10: [9, 10],
      9: [9, 10, 11],
      8: [9, 10, 11],
      7: [10, 11],
    },
    display: "Fall"
  },
  
  almond: {
    zones: {
      10: [8, 9],
      9: [9, 10],
      8: [9, 10],
    },
    display: "Late Summer - Fall"
  },
  
  pecan: {
    zones: {
      10: [10, 11],
      9: [10, 11],
      8: [10, 11],
      7: [10, 11],
    },
    display: "Fall"
  },
  
  // Other
  grape: {
    zones: {
      10: [7, 8, 9],
      9: [8, 9, 10],
      8: [9, 10],
      7: [9, 10],
    },
    display: "Late Summer - Fall"
  },
  
  kiwi: {
    zones: {
      10: [10, 11],
      9: [10, 11],
      8: [10, 11],
      7: [10, 11],
    },
    display: "Fall"
  },
  
  'passion fruit': {
    zones: {
      10: [5, 6, 7, 8, 9, 10, 11, 12],
      9: [7, 8, 9],
    },
    display: "Summer - Fall (warm zones)"
  },

  // Tree fruit (extended)
  'asian pear': {
    zones: {
      10: [7, 8],
      9: [8, 9],
      8: [8, 9],
      7: [9, 10],
      6: [9, 10],
    },
    display: "Summer - Fall"
  },

  crabapple: {
    zones: {
      10: [8, 9],
      9: [9, 10],
      8: [9, 10],
      7: [9, 10],
      6: [9, 10],
    },
    display: "Fall"
  },

  medlar: {
    zones: {
      10: [10, 11],
      9: [10, 11],
      8: [10, 11],
      7: [10, 11],
    },
    display: "Fall - Early Winter"
  },

  nectarine: {
    zones: {
      10: [5, 6, 7],
      9: [6, 7, 8],
      8: [7, 8],
      7: [7, 8],
      6: [8],
    },
    display: "Summer"
  },

  pawpaw: {
    zones: {
      10: [9, 10],
      9: [9, 10],
      8: [9, 10],
      7: [9, 10],
      6: [9, 10],
    },
    display: "Fall"
  },

  pluot: {
    zones: {
      10: [6, 7, 8, 9],
      9: [6, 7, 8],
      8: [7, 8],
      7: [7, 8],
    },
    display: "Summer"
  },

  quince: {
    zones: {
      10: [9, 10],
      9: [10, 11],
      8: [10, 11],
      7: [10, 11],
    },
    display: "Fall"
  },

  serviceberry: {
    zones: {
      10: [5, 6],
      9: [5, 6],
      8: [6, 7],
      7: [6, 7],
      6: [6, 7],
    },
    display: "Early Summer"
  },

  'sour cherry': {
    zones: {
      10: [5, 6],
      9: [6, 7],
      8: [6, 7],
      7: [6, 7],
      6: [7],
      5: [7],                    // Traverse City MI, Wisconsin
    },
    display: "Early Summer"
  },

  // Citrus (extended)
  bergamot: {
    zones: {
      10: [12, 1, 2, 3],
      9: [1, 2, 3],
    },
    display: "Winter"
  },

  'blood orange': {
    zones: {
      10: [12, 1, 2, 3, 4],
      9: [1, 2, 3, 4],
      8: [2, 3],
    },
    display: "Winter - Early Spring"
  },

  calamansi: {
    zones: {
      10: [11, 12, 1, 2, 3, 4, 5],
      9: [12, 1, 2, 3],
    },
    display: "Winter - Spring (warm zones)"
  },

  citron: {
    zones: {
      10: [11, 12, 1, 2, 3],
      9: [12, 1, 2],
    },
    display: "Winter"
  },

  clementine: {
    zones: {
      10: [12, 1, 2],
      9: [12, 1, 2, 3],
    },
    display: "Winter"
  },

  mandarin: {
    zones: {
      10: [11, 12, 1, 2, 3, 4, 5],
      9: [12, 1, 2, 3],
      8: [1, 2],
    },
    display: "Late Fall - Spring"
  },

  pomelo: {
    zones: {
      10: [12, 1, 2, 3, 4],
      9: [1, 2, 3],
    },
    display: "Winter - Spring"
  },

  yuzu: {
    zones: {
      10: [11, 12, 1, 2],
      9: [11, 12, 1, 2],
      8: [12, 1],
    },
    display: "Winter"
  },

  // Tropical / subtropical (extended)
  banana: {
    zones: {
      10: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      9: [6, 7, 8, 9, 10],
    },
    display: "Year-round (tropical zones)"
  },

  breadfruit: {
    zones: {
      10: [7, 8, 9, 10],
    },
    display: "Summer - Fall (tropical only)"
  },

  cherimoya: {
    zones: {
      10: [10, 11, 12, 1, 2, 3, 4, 5],
      9: [12, 1, 2],
    },
    display: "Fall - Spring"
  },

  'dragon fruit': {
    zones: {
      10: [6, 7, 8, 9, 10, 11],
    },
    display: "Summer - Fall (tropical only)"
  },

  feijoa: {
    zones: {
      10: [10, 11, 12],
      9: [10, 11],
      8: [10, 11],
    },
    display: "Fall - Early Winter"
  },

  jackfruit: {
    zones: {
      10: [5, 6, 7, 8, 9, 10],
    },
    display: "Summer (tropical only)"
  },

  jaboticaba: {
    zones: {
      10: [3, 4, 5, 9, 10, 11],   // Two crops per year
    },
    display: "Spring & Fall (tropical only)"
  },

  longan: {
    zones: {
      10: [7, 8],
    },
    display: "Summer (tropical only)"
  },

  lychee: {
    zones: {
      10: [5, 6, 7],
    },
    display: "Early Summer (tropical only)"
  },

  papaya: {
    zones: {
      10: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    display: "Year-round (tropical only)"
  },

  rambutan: {
    zones: {
      10: [6, 7, 8, 9],
    },
    display: "Summer (tropical only)"
  },

  sapote: {
    zones: {
      10: [10, 11, 12, 1, 2, 3],
    },
    display: "Winter - Spring (tropical only)"
  },

  soursop: {
    zones: {
      10: [6, 7, 8, 9],
    },
    display: "Summer (tropical only)"
  },

  starfruit: {
    zones: {
      10: [6, 7, 8, 9, 10, 11, 12, 1, 2, 3],
    },
    display: "Most of the year (tropical only)"
  },

  'surinam cherry': {
    zones: {
      10: [3, 4, 5, 6, 9, 10, 11],       // Two crops per year
    },
    display: "Spring & Fall (tropical only)"
  },

  tamarind: {
    zones: {
      10: [12, 1, 2, 3, 4],
    },
    display: "Winter - Spring (tropical only)"
  },

  // Nuts (extended)
  chestnut: {
    zones: {
      10: [9, 10],
      9: [9, 10, 11],
      8: [10, 11],
      7: [10, 11],
    },
    display: "Fall"
  },

  hazelnut: {
    zones: {
      10: [9, 10],
      9: [9, 10],
      8: [9, 10],
      7: [9, 10],
      6: [9, 10],
    },
    display: "Fall"
  },

  macadamia: {
    zones: {
      10: [11, 12, 1, 2, 3, 4, 5],
    },
    display: "Late Fall - Spring"
  },

  'pine nut': {
    zones: {
      10: [9, 10],
      9: [9, 10],
      8: [10, 11],
      7: [10, 11],
    },
    display: "Fall"
  },

  pistachio: {
    zones: {
      10: [9, 10],
      9: [9, 10],
      8: [9, 10],
    },
    display: "Fall"
  },

  // Berries / vines (extended)
  boysenberry: {
    zones: {
      10: [5, 6, 7],
      9: [6, 7],
      8: [6, 7, 8],
      7: [7, 8],
    },
    display: "Early Summer"
  },

  cranberry: {
    zones: {
      10: [10, 11],
      9: [10, 11],
      8: [10, 11],
      7: [10, 11],
      6: [10],
    },
    display: "Fall"
  },

  currant: {
    zones: {
      10: [6, 7],
      9: [6, 7],
      8: [7, 8],
      7: [7, 8],
      6: [7, 8],
      5: [7, 8],
    },
    display: "Summer"
  },

  dewberry: {
    zones: {
      10: [4, 5, 6],
      9: [5, 6],
      8: [6, 7],
    },
    display: "Late Spring - Early Summer"
  },

  elderberry: {
    zones: {
      10: [8, 9],
      9: [8, 9],
      8: [8, 9],
      7: [8, 9],
      6: [8, 9],
    },
    display: "Late Summer"
  },

  gooseberry: {
    zones: {
      10: [6, 7],
      9: [6, 7],
      8: [7, 8],
      7: [7, 8],
      6: [7, 8],
      5: [7, 8],
    },
    display: "Summer"
  },

  huckleberry: {
    zones: {
      10: [7, 8],
      9: [7, 8],
      8: [7, 8],
      7: [8, 9],
    },
    display: "Summer"
  },

  loganberry: {
    zones: {
      10: [5, 6, 7],
      9: [6, 7],
      8: [7, 8],
    },
    display: "Early Summer"
  },

  // Other (extended)
  coconut: {
    zones: {
      10: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    display: "Year-round (tropical only)"
  },

  date: {
    zones: {
      10: [9, 10, 11],
    },
    display: "Fall"
  },

  jujube: {
    zones: {
      10: [9, 10],
      9: [9, 10],
      8: [9, 10],
      7: [10],
    },
    display: "Fall"
  },

  olive: {
    zones: {
      10: [9, 10, 11, 12, 1, 2],
      9: [9, 10, 11, 12, 1, 2],
      8: [10, 11],
    },
    display: "Fall (curing) - Winter (oil)"
  },

  'prickly pear': {
    zones: {
      10: [8, 9, 10],
      9: [9, 10],
      8: [9, 10],
    },
    display: "Late Summer - Fall"
  },

  // Mushrooms
  'black trumpet': {
    zones: {
      10: [6, 7, 8, 9],
      9: [6, 7, 8, 9],
      8: [7, 8, 9, 10],
      7: [7, 8, 9, 10],
      6: [7, 8, 9],
      5: [7, 8, 9],
    },
    display: "Summer - Fall"
  },

  chanterelle: {
    zones: {
      10: [6, 7, 8, 9, 10],
      9: [7, 8, 9, 10],
      8: [7, 8, 9, 10],
      7: [7, 8, 9],
      6: [7, 8, 9],
      5: [7, 8],
    },
    display: "Summer - Fall"
  },

  'chicken of the woods': {
    zones: {
      10: [7, 8, 9, 10],
      9: [7, 8, 9, 10],
      8: [8, 9, 10],
      7: [8, 9, 10],
      6: [8, 9, 10],
      5: [8, 9],
    },
    display: "Late Summer - Fall"
  },

  'hen of the woods': {
    zones: {
      10: [9, 10, 11],
      9: [9, 10, 11],
      8: [9, 10, 11],
      7: [9, 10],
      6: [9, 10],
      5: [9, 10],
    },
    display: "Fall"
  },

  'lion\'s mane': {
    zones: {
      10: [8, 9, 10, 11],
      9: [8, 9, 10, 11],
      8: [9, 10, 11],
      7: [9, 10, 11],
      6: [9, 10],
      5: [9, 10],
    },
    display: "Late Summer - Fall"
  },

  'lobster mushroom': {
    zones: {
      10: [7, 8, 9],
      9: [7, 8, 9],
      8: [7, 8, 9],
      7: [8, 9],
      6: [8, 9],
      5: [8, 9],
    },
    display: "Summer - Early Fall"
  },

  matsutake: {
    zones: {
      10: [9, 10, 11],
      9: [9, 10, 11],
      8: [9, 10, 11],
      7: [9, 10],
    },
    display: "Fall (Pacific NW & SE pine forests)"
  },

  morel: {
    zones: {
      10: [2, 3, 4],
      9: [3, 4],
      8: [3, 4, 5],
      7: [4, 5],
      6: [4, 5],
      5: [5, 6],
      4: [5, 6],
    },
    display: "Spring"
  },

  'oyster mushroom': {
    zones: {
      10: [3, 4, 5, 10, 11, 12],
      9: [3, 4, 5, 10, 11],
      8: [3, 4, 5, 10, 11],
      7: [4, 5, 9, 10, 11],
      6: [4, 5, 9, 10],
      5: [5, 9, 10],
    },
    display: "Spring & Fall"
  },

  porcini: {
    zones: {
      10: [6, 7, 8, 9],
      9: [7, 8, 9],
      8: [7, 8, 9],
      7: [7, 8, 9],
      6: [8, 9],
      5: [8, 9],
    },
    display: "Summer - Fall"
  },

  'shaggy mane': {
    zones: {
      10: [9, 10, 11],
      9: [9, 10, 11],
      8: [9, 10, 11],
      7: [9, 10],
      6: [9, 10],
      5: [9, 10],
      4: [9, 10],
    },
    display: "Fall"
  },

  'turkey tail': {
    zones: {
      10: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      9: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      8: [3, 4, 5, 9, 10, 11],
      7: [4, 5, 9, 10, 11],
      6: [4, 5, 9, 10],
      5: [5, 9, 10],
    },
    display: "Spring & Fall (year-round in warm zones)"
  },

  // Herbs
  chickweed: {
    zones: {
      10: [1, 2, 3, 4, 11, 12],
      9: [1, 2, 3, 4, 11, 12],
      8: [2, 3, 4, 11],
      7: [3, 4, 5],
      6: [3, 4, 5],
      5: [4, 5],
      4: [5],
    },
    display: "Early Spring (cool season)"
  },

  dandelion: {
    zones: {
      10: [2, 3, 4, 5],
      9: [2, 3, 4, 5, 6],
      8: [3, 4, 5, 6],
      7: [3, 4, 5, 6, 7],
      6: [4, 5, 6, 7],
      5: [4, 5, 6, 7, 8, 9],
    },
    display: "Spring - Summer"
  },

  'garlic mustard': {
    zones: {
      10: [2, 3, 4],
      9: [2, 3, 4],
      8: [3, 4, 5],
      7: [3, 4, 5],
      6: [4, 5, 6],
      5: [4, 5, 6],
      4: [5, 6],
    },
    display: "Spring"
  },

  lambsquarters: {
    zones: {
      10: [4, 5, 6, 7, 8, 9],
      9: [5, 6, 7, 8, 9],
      8: [5, 6, 7, 8],
      7: [5, 6, 7, 8],
      6: [6, 7, 8],
      5: [6, 7, 8],
    },
    display: "Spring - Summer"
  },

  'miner\'s lettuce': {
    zones: {
      10: [1, 2, 3, 4, 5],
      9: [2, 3, 4, 5],
      8: [3, 4, 5],
      7: [3, 4, 5],
    },
    display: "Winter - Spring (Pacific Coast & Southwest)"
  },

  nettles: {
    zones: {
      10: [1, 2, 3, 4],
      9: [2, 3, 4, 5],
      8: [3, 4, 5],
      7: [3, 4, 5],
      6: [4, 5, 6],
      5: [4, 5, 6],
      4: [5, 6],
    },
    display: "Early Spring"
  },

  purslane: {
    zones: {
      10: [5, 6, 7, 8, 9],
      9: [6, 7, 8, 9],
      8: [6, 7, 8],
      7: [6, 7, 8],
      6: [7, 8],
      5: [7, 8],
    },
    display: "Summer"
  },

  ramps: {
    zones: {
      10: [2, 3, 4],
      9: [2, 3, 4],
      8: [3, 4],
      7: [3, 4, 5],
      6: [4, 5],
      5: [4, 5],
      4: [5],
    },
    display: "Early Spring"
  },

  violet: {
    zones: {
      10: [1, 2, 3, 4],
      9: [2, 3, 4],
      8: [3, 4, 5],
      7: [3, 4, 5],
      6: [4, 5],
      5: [5, 6],
    },
    display: "Spring"
  },

  watercress: {
    zones: {
      10: [1, 2, 3, 4, 5, 10, 11, 12],
      9: [2, 3, 4, 5, 10, 11],
      8: [3, 4, 5, 9, 10],
      7: [4, 5, 9, 10],
      6: [4, 5, 6, 9],
      5: [5, 6, 9],
    },
    display: "Spring - Fall"
  },

  'wild bergamot': {
    zones: {
      10: [5, 6, 7, 8],
      9: [5, 6, 7, 8],
      8: [6, 7, 8],
      7: [6, 7, 8],
      6: [6, 7, 8],
      5: [7, 8],
    },
    display: "Summer"
  },

  'wild ginger': {
    zones: {
      10: [3, 4, 5],
      9: [3, 4, 5],
      8: [4, 5, 6],
      7: [4, 5, 6],
      6: [5, 6],
      5: [5, 6],
    },
    display: "Spring - Early Summer"
  },

  'wood sorrel': {
    zones: {
      10: [1, 2, 3, 4, 5],
      9: [3, 4, 5, 6],
      8: [4, 5, 6, 7],
      7: [4, 5, 6, 7],
      6: [5, 6, 7],
      5: [5, 6, 7],
    },
    display: "Spring - Summer"
  },

  yarrow: {
    zones: {
      10: [4, 5, 6, 7, 8],
      9: [5, 6, 7, 8],
      8: [5, 6, 7, 8],
      7: [6, 7, 8],
      6: [6, 7, 8],
      5: [6, 7, 8],
      4: [7, 8],
    },
    display: "Summer"
  },

  // Mushrooms (additional)
  'cauliflower mushroom': {
    zones: {
      9: [8, 9, 10],
      8: [8, 9, 10],
      7: [9, 10],
      6: [9, 10],
      5: [9, 10],
    },
    display: "Fall (conifer forests)"
  },

  'giant puffball': {
    zones: {
      10: [6, 7, 8, 9],
      9: [7, 8, 9],
      8: [7, 8, 9],
      7: [7, 8, 9],
      6: [8, 9],
      5: [8, 9],
      4: [8, 9],
      3: [8, 9],
    },
    display: "Summer - Fall"
  },

  'hedgehog mushroom': {
    zones: {
      10: [9, 10, 11, 12],
      9: [9, 10, 11],
      8: [9, 10, 11],
      7: [9, 10, 11],
      6: [9, 10],
      5: [9, 10],
    },
    display: "Fall"
  },

  'meadow mushroom': {
    zones: {
      10: [8, 9, 10],
      9: [8, 9, 10],
      8: [8, 9, 10],
      7: [8, 9, 10],
      6: [8, 9],
      5: [8, 9],
      4: [8, 9],
    },
    display: "Late Summer - Fall"
  },

  'wine cap': {
    zones: {
      10: [3, 4, 5, 10, 11],
      9: [4, 5, 9, 10],
      8: [4, 5, 9, 10],
      7: [4, 5, 9, 10],
      6: [5, 9, 10],
      5: [5, 9],
      4: [5, 9],
    },
    display: "Spring & Fall"
  },

  // Wild berries (additional)
  aronia: {
    zones: {
      9: [8, 9, 10],
      8: [8, 9, 10],
      7: [8, 9, 10],
      6: [9, 10],
      5: [9, 10],
      4: [9, 10],
      3: [9, 10],
    },
    display: "Late Summer - Fall"
  },

  'autumn olive': {
    zones: {
      9: [9, 10],
      8: [9, 10],
      7: [9, 10],
      6: [9, 10],
      5: [9, 10],
      4: [9, 10],
      3: [9, 10],
    },
    display: "Fall"
  },

  hawthorn: {
    zones: {
      9: [9, 10, 11],
      8: [9, 10, 11],
      7: [9, 10, 11],
      6: [10, 11],
      5: [10, 11],
      4: [10, 11],
      3: [10, 11],
    },
    display: "Fall"
  },

  'rose hip': {
    zones: {
      10: [8, 9, 10],
      9: [8, 9, 10],
      8: [8, 9, 10],
      7: [8, 9, 10],
      6: [9, 10],
      5: [9, 10],
      4: [9, 10],
      3: [9, 10],
    },
    display: "Late Summer - Fall"
  },

  wintergreen: {
    zones: {
      7: [9, 10, 11, 12, 1, 2],
      6: [9, 10, 11, 12, 1],
      5: [9, 10, 11, 12],
      4: [9, 10, 11],
      3: [9, 10, 11],
    },
    display: "Fall - Winter (northern forests)"
  },

  // Herbs & Wild Greens (additional)
  burdock: {
    zones: {
      10: [3, 4, 5, 10, 11],
      9: [3, 4, 5, 10, 11],
      8: [3, 4, 5, 9, 10],
      7: [4, 5, 9, 10],
      6: [4, 5, 9, 10],
      5: [5, 6, 9, 10],
      4: [5, 6, 9],
      3: [5, 6, 9],
    },
    display: "Spring & Fall"
  },

  cattail: {
    zones: {
      10: [2, 3, 4, 5, 6],
      9: [3, 4, 5, 6],
      8: [3, 4, 5, 6],
      7: [4, 5, 6],
      6: [4, 5, 6],
      5: [5, 6],
      4: [5, 6],
      3: [5, 6],
    },
    display: "Spring - Early Summer (shoots & pollen)"
  },

  chicory: {
    zones: {
      10: [2, 3, 4, 5, 9, 10, 11],
      9: [3, 4, 5, 6, 9, 10],
      8: [3, 4, 5, 6, 9, 10],
      7: [4, 5, 6, 7, 9, 10],
      6: [5, 6, 7, 8, 9],
      5: [5, 6, 7, 8, 9],
      4: [6, 7, 8, 9],
    },
    display: "Spring - Fall"
  },

  'fiddlehead fern': {
    zones: {
      8: [3, 4, 5],
      7: [4, 5],
      6: [4, 5],
      5: [4, 5],
      4: [5, 6],
      3: [5, 6],
    },
    display: "Early Spring"
  },

  'field garlic': {
    zones: {
      10: [2, 3, 4, 5],
      9: [2, 3, 4, 5, 6],
      8: [3, 4, 5, 6],
      7: [3, 4, 5, 6],
      6: [4, 5, 6],
      5: [4, 5, 6],
      4: [5, 6],
      3: [5, 6],
    },
    display: "Spring - Early Summer"
  },

  'jerusalem artichoke': {
    zones: {
      10: [9, 10, 11],
      9: [9, 10, 11],
      8: [10, 11],
      7: [10, 11],
      6: [10, 11],
      5: [10, 11],
      4: [10],
      3: [10],
    },
    display: "Fall"
  },

  mallow: {
    zones: {
      10: [4, 5, 6, 7, 8, 9, 10],
      9: [5, 6, 7, 8, 9],
      8: [5, 6, 7, 8, 9],
      7: [5, 6, 7, 8, 9],
      6: [6, 7, 8, 9],
      5: [6, 7, 8],
      4: [7, 8],
    },
    display: "Summer - Fall"
  },

  plantain: {
    zones: {
      10: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      9: [3, 4, 5, 6, 7, 8, 9, 10],
      8: [3, 4, 5, 6, 7, 8, 9, 10],
      7: [4, 5, 6, 7, 8, 9],
      6: [4, 5, 6, 7, 8, 9],
      5: [5, 6, 7, 8, 9],
      4: [5, 6, 7, 8],
      3: [6, 7, 8],
    },
    display: "Spring - Fall"
  },

  'sheep sorrel': {
    zones: {
      10: [2, 3, 4, 5],
      9: [3, 4, 5, 6],
      8: [4, 5, 6, 7],
      7: [4, 5, 6, 7],
      6: [5, 6, 7],
      5: [5, 6, 7],
      4: [6, 7],
      3: [6, 7],
    },
    display: "Spring - Summer"
  },

  spicebush: {
    zones: {
      9: [9, 10],
      8: [9, 10],
      7: [9, 10],
      6: [9, 10],
      5: [10],
      4: [10],
    },
    display: "Fall (eastern US)"
  },

  'wild mint': {
    zones: {
      10: [4, 5, 6, 7, 8, 9],
      9: [5, 6, 7, 8],
      8: [5, 6, 7, 8],
      7: [5, 6, 7, 8],
      6: [6, 7, 8],
      5: [6, 7, 8],
      4: [6, 7, 8],
      3: [7, 8],
    },
    display: "Summer"
  },

  'wild onion': {
    zones: {
      10: [2, 3, 4, 5],
      9: [3, 4, 5, 6],
      8: [3, 4, 5, 6],
      7: [4, 5, 6],
      6: [4, 5, 6],
      5: [5, 6],
      4: [5, 6],
      3: [5, 6],
    },
    display: "Spring - Early Summer"
  },

  // ── Medicinal plants: months are when the usual part (flower or leaf) is picked ──
  // Bloom months checked Oct 2026 against NC State Extension Plant Toolbox (zone 7–8),
  // NC Parks flora, RHS, UW–Madison Extension and Friends of Edgewood, then shifted
  // ~1 month per zone. Leaf-harvest plants (lemon balm, comfrey, mugwort, ginkgo,
  // gotu kola, aloe, horsetail, cleavers, marshmallow, chamomile, hibiscus, plantain,
  // yarrow) follow the growing season and are unverified.
  "aloe vera": {
    zones: {
      10: [1,  2,  3,  4,  5,  6,  7,  8,  9,  10,  11,  12],
      9: [1,  2,  3,  4,  5,  6,  7,  8,  9,  10,  11,  12],
    },
    display: "Year-round (leaf, frost-free only)"
  },

  calendula: {
    zones: {
      10: [1,  2,  3,  4,  5,  10,  11,  12],
      9: [3,  4,  5,  6,  10,  11],
      8: [5,  6,  7,  8,  9,  10],
      7: [6,  7,  8,  9],
      6: [6,  7,  8,  9],
      5: [7,  8,  9],
    },
    display: "Flowers, cool seasons"
  },

  "california poppy": {
    zones: {
      10: [2,  3,  4,  5],
      9: [3,  4,  5,  6],
      8: [4,  5,  6,  7],
      7: [5,  6,  7],
    },
    display: "Spring (flowering plant)"
  },

  catnip: {
    zones: {
      10: [4,  5,  6,  7,  8,  9],
      9: [5,  6,  7,  8,  9],
      8: [5,  6,  7,  8,  9],
      7: [5,  6,  7,  8,  9],
      6: [6,  7,  8],
      5: [6,  7,  8],
      4: [7,  8],
    },
    display: "Summer (leaf, flowering tops)"
  },

  chamomile: {
    zones: {
      10: [2,  3,  4,  5],
      9: [4,  5,  6],
      8: [5,  6,  7],
      7: [6,  7],
      6: [6,  7,  8],
      5: [6,  7,  8],
    },
    display: "Spring - Early Summer (flowers)"
  },

  cleavers: {
    zones: {
      10: [1,  2,  3],
      9: [2,  3,  4],
      8: [3,  4,  5],
      7: [4,  5],
      6: [4,  5,  6],
      5: [5,  6],
    },
    display: "Early Spring (young stems)"
  },

  comfrey: {
    zones: {
      10: [3,  4,  5,  6,  7,  8,  9,  10],
      9: [4,  5,  6,  7,  8,  9],
      8: [5,  6,  7,  8,  9],
      7: [5,  6,  7,  8],
      6: [5,  6,  7,  8],
      5: [6,  7,  8],
      4: [6,  7,  8],
    },
    display: "Spring - Fall (leaf, topical use)"
  },

  echinacea: {
    zones: {
      9: [5,  6,  7],
      8: [6,  7,  8],
      7: [6,  7,  8],
      6: [7,  8],
      5: [7,  8],
      4: [7,  8],
    },
    display: "Summer (flowers, leaves)"
  },

  elderflower: {
    zones: {
      10: [3,  4,  5],
      9: [4,  5,  6],
      8: [5,  6],
      7: [5,  6,  7],
      6: [6,  7],
      5: [6,  7],
      4: [7],
    },
    display: "Late Spring - Early Summer"
  },

  feverfew: {
    zones: {
      10: [4,  5,  6,  7,  8],
      9: [5,  6,  7,  8,  9],
      8: [6,  7,  8,  9],
      7: [6,  7,  8,  9],
      6: [7,  8],
      5: [7,  8],
    },
    display: "Summer (leaves, flowers)"
  },

  ginkgo: {
    zones: {
      10: [5,  6,  7,  8,  9],
      9: [5,  6,  7,  8,  9],
      8: [5,  6,  7,  8,  9],
      7: [5,  6,  7,  8,  9],
      6: [6,  7,  8,  9],
      5: [6,  7,  8],
      4: [6,  7,  8],
    },
    display: "Summer (green leaves; not the seeds)"
  },

  "gotu kola": {
    zones: {
      10: [1,  2,  3,  4,  5,  6,  7,  8,  9,  10,  11,  12],
      9: [4,  5,  6,  7,  8,  9,  10],
    },
    display: "Warm months (leaf)"
  },

  hibiscus: {
    zones: {
      10: [10,  11,  12,  1],
      9: [10,  11],
    },
    display: "Fall - Winter (calyces)"
  },

  horehound: {
    zones: {
      10: [3,  4,  5,  6,  7,  8,  9],
      9: [4,  5,  6,  7,  8,  9,  10],
      8: [5,  6,  7,  8,  9,  10],
      7: [6,  7,  8,  9],
      6: [6,  7,  8],
      5: [7,  8],
    },
    display: "Late Spring - Summer (leaf)"
  },

  horsetail: {
    zones: {
      10: [2,  3,  4],
      9: [3,  4,  5],
      8: [4,  5],
      7: [4,  5,  6],
      6: [5,  6],
      5: [5,  6],
      4: [6],
    },
    display: "Spring (young green stems)"
  },

  "lemon balm": {
    zones: {
      10: [3,  4,  5,  6,  7,  8,  9,  10],
      9: [4,  5,  6,  7,  8,  9],
      8: [5,  6,  7,  8,  9],
      7: [5,  6,  7,  8],
      6: [6,  7,  8],
      5: [6,  7,  8],
      4: [6,  7,  8],
    },
    display: "Spring - Fall (leaf)"
  },

  linden: {
    zones: {
      9: [5],
      8: [5,  6],
      7: [5,  6,  7],
      6: [6,  7],
      5: [6,  7],
      4: [7],
    },
    display: "Early Summer (flowers)"
  },

  marshmallow: {
    zones: {
      10: [4,  5,  6,  7,  8],
      9: [5,  6,  7,  8],
      8: [6,  7,  8],
      7: [6,  7,  8],
      6: [7,  8],
      5: [7,  8],
      4: [7,  8],
    },
    display: "Summer (leaf, flowers)"
  },

  motherwort: {
    zones: {
      9: [5,  6,  7],
      8: [5,  6,  7],
      7: [6,  7,  8],
      6: [6,  7,  8],
      5: [7,  8],
      4: [7,  8],
    },
    display: "Summer (flowering tops)"
  },

  mugwort: {
    zones: {
      10: [4,  5,  6,  7,  8],
      9: [5,  6,  7,  8],
      8: [6,  7,  8],
      7: [6,  7,  8],
      6: [7,  8],
      5: [7,  8],
      4: [7,  8],
    },
    display: "Summer (leaf)"
  },

  mullein: {
    zones: {
      10: [4,  5,  6,  7,  8],
      9: [5,  6,  7,  8,  9],
      8: [6,  7,  8,  9],
      7: [6,  7,  8,  9],
      6: [6,  7,  8],
      5: [7,  8],
      4: [7,  8],
    },
    display: "Summer (leaf, flowers)"
  },

  passionflower: {
    zones: {
      10: [4,  5,  6,  7,  8,  9],
      9: [5,  6,  7,  8,  9],
      8: [5,  6,  7],
      7: [6,  7,  8],
    },
    display: "Summer (leaf, flowers)"
  },

  "red clover": {
    zones: {
      10: [3,  4,  5,  6],
      9: [4,  5,  6,  7],
      8: [5,  6,  7,  8],
      7: [5,  6,  7,  8],
      6: [6,  7,  8],
      5: [6,  7,  8],
      4: [6,  7,  8],
    },
    display: "Late Spring - Summer (blossoms)"
  },

  "self-heal": {
    zones: {
      10: [4,  5,  6,  7],
      9: [5,  6,  7,  8],
      8: [6,  7,  8,  9],
      7: [6,  7,  8,  9],
      6: [6,  7,  8],
      5: [7,  8],
      4: [7,  8],
    },
    display: "Summer (flowering tops)"
  },

  skullcap: {
    zones: {
      9: [7,  8,  9,  10],
      8: [7,  8,  9,  10],
      7: [7,  8,  9],
      6: [7,  8,  9],
      5: [7,  8],
      4: [7,  8],
    },
    display: "Summer (flowering tops)"
  },

  "st. john's wort": {
    zones: {
      10: [5,  6],
      9: [5,  6,  7],
      8: [6,  7],
      7: [6,  7],
      6: [6,  7,  8],
      5: [7,  8],
      4: [7,  8],
    },
    display: "Around midsummer (flowering tops)"
  },

  valerian: {
    zones: {
      8: [6,  7],
      7: [6,  7,  8],
      6: [6,  7,  8],
      5: [6,  7,  8],
      4: [7],
    },
    display: "Early Summer (flowers)"
  },

  "yerba santa": {
    zones: {
      10: [4,  5,  6,  7],
      9: [4,  5,  6,  7],
    },
    display: "Spring - Summer (leaf)"
  },
};

/**
 * Get harvest season for a fruit type in a specific USDA zone
 * @param {string} fruitType - Name of fruit (lowercase)
 * @param {number} zone - USDA hardiness zone (1-13)
 * @returns {Array|null} Array of months when fruit is in season, or null if not available
 */
export function getSeasonForZone(fruitType, zone) {
  const fruit = FRUIT_SEASONS[fruitType.toLowerCase()];
  if (!fruit || !fruit.zones) return null;
  
  // Try exact zone match first
  if (fruit.zones[zone]) {
    return fruit.zones[zone];
  }
  
  // Try closest zone (fallback)
  const availableZones = Object.keys(fruit.zones).map(Number).sort((a, b) => a - b);
  const closestZone = availableZones.reduce((prev, curr) => {
    return Math.abs(curr - zone) < Math.abs(prev - zone) ? curr : prev;
  });
  
  return fruit.zones[closestZone] || null;
}

/**
 * Check if a fruit is currently in season
 * @param {string} fruitType - Name of fruit
 * @param {number} zone - USDA zone
 * @param {number} currentMonth - Current month (1-12), defaults to current month
 * @returns {boolean}
 */
export function isInSeason(fruitType, zone, currentMonth = new Date().getMonth() + 1) {
  const season = getSeasonForZone(fruitType, zone);
  if (!season) return false;
  return season.includes(currentMonth);
}

/**
 * Get display text for fruit season
 * @param {string} fruitType - Name of fruit
 * @returns {string}
 */
export function getSeasonDisplay(fruitType) {
  const fruit = FRUIT_SEASONS[fruitType.toLowerCase()];
  return fruit?.display || "Unknown season";
}

/**
 * Get a qualitative status label for a fruit's current position in its season.
 * Compares how many zones are producing this month vs. the surrounding months.
 * @param {string} fruitType
 * @param {number} month - 1-indexed current month
 * @returns {'peak'|'early'|'late'|'steady'}
 */
export function getSeasonStatus(fruitType, month) {
  const data = FRUIT_SEASONS[fruitType.toLowerCase()];
  if (!data) return 'steady';

  const zones = Object.values(data.zones || {});
  if (zones.length === 0) return 'steady';

  // Long or year-round season — no meaningful start/peak/end to call out
  const avgMonths = zones.reduce((sum, m) => sum + m.length, 0) / zones.length;
  if (avgMonths >= 7) return 'steady';

  const prev = month === 1 ? 12 : month - 1;
  const next = month === 12 ? 1 : month + 1;

  const currentCount = zones.filter(m => m.includes(month)).length;
  const prevCount    = zones.filter(m => m.includes(prev)).length;
  const nextCount    = zones.filter(m => m.includes(next)).length;

  // Season just opening — fewer zones were producing last month
  if (prevCount === 0 || prevCount < currentCount * 0.6) return 'early';
  // Season closing — fewer zones will produce next month
  if (nextCount === 0 || nextCount < currentCount * 0.6) return 'late';
  return 'peak';
}
