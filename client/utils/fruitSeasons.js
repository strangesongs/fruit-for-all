// USDA Hardiness Zone-based fruit seasons
// Months are 1-indexed (1 = January, 12 = December)
// Sources and verification status per entry: docs/season-sources.md

export const FRUIT_SEASONS = {
  // Stone Fruits
  loquat: {
    zones: {
      11: [3, 4, 5, 6],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [3, 4, 5, 6],           // Southern California, South Florida
      9: [4, 5, 6, 7],            // Northern California, Gulf Coast
      8: [5, 6, 7],               // Pacific Northwest, Mid-Atlantic
      7: [5, 6],                  // Northern states
    }
  },
  
  fig: {
    zones: {
      11: [6, 7, 8, 9, 10],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [6, 7, 8, 9, 10],       // Two crops in warm zones
      9: [7, 8, 9],               
      8: [7, 8, 9],
      7: [8, 9],
    }
  },
  
  peach: {
    zones: {
      10: [5, 6, 7],
      9: [6, 7, 8],
      8: [7, 8],
      7: [7, 8],
      6: [7, 8],
    }
  },
  
  plum: {
    zones: {
      10: [5, 6, 7],
      9: [6, 7, 8],
      8: [7, 8],
      7: [7, 8, 9],
      6: [8, 9],
    }
  },
  
  cherry: {
    zones: {
      10: [5, 6],                 // Early in warm zones
      9: [5, 6, 7],
      8: [6, 7],
      7: [6, 7],
      6: [7],
      5: [6, 7],                 // Door County WI, Traverse City MI area
    }
  },
  
  apricot: {
    zones: {
      10: [5, 6],
      9: [6, 7],
      8: [6, 7],
      7: [7],
    }
  },
  
  // Citrus (mostly warm zones)
  orange: {
    zones: {
      11: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], // navels Jan–Apr, then Valencias
      9: [12, 1, 2, 3, 4],
      8: [1, 2, 3],               // Limited areas
    }
  },
  
  lemon: {
    zones: {
      11: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],  // Year-round
      9: [1, 2, 3, 4, 10, 11, 12],
      8: [1, 2, 11, 12],
    }
  },
  
  grapefruit: {
    zones: {
      11: [12, 1, 2, 3, 4, 5, 6],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [12, 1, 2, 3, 4, 5, 6],
      9: [1, 2, 3, 4],
    }
  },
  
  lime: {
    zones: {
      10: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],  // Year-round in tropics
      9: [1, 2, 3, 10, 11, 12],
    }
  },
  
  tangerine: {
    zones: {
      10: [11, 12, 1, 2],
      9: [12, 1, 2, 3],
    }
  },
  
  kumquat: {
    zones: {
      11: [10, 11, 12, 1, 2, 3],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [10, 11, 12, 1, 2, 3],
      9: [12, 1, 2, 3],
      8: [1, 2],
    }
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
    }
  },
  
  pear: {
    zones: {
      10: [7, 8, 9],
      9: [8, 9, 10],
      8: [8, 9, 10],
      7: [9, 10],
      6: [9, 10],
      5: [9, 10],
    }
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
    }
  },
  
  raspberry: {
    zones: {
      10: [5, 6, 7],
      9: [6, 7, 8],
      8: [6, 7, 8],
      7: [7, 8],
      6: [7, 8],
      5: [7, 8],
    }
  },
  
  strawberry: {
    zones: {
      10: [3, 4, 5, 6],           // Spring crop in warm zones
      9: [4, 5, 6],
      8: [5, 6, 7],
      7: [6, 7],
    }
  },
  
  blueberry: {
    zones: {
      10: [5, 6, 7],
      9: [6, 7, 8],
      8: [6, 7, 8],
      7: [7, 8],
      6: [7, 8],
      5: [7, 8, 9],              // Michigan, Maine highbush blueberry
    }
  },
  
  mulberry: {
    zones: {
      10: [4, 5, 6, 7],
      9: [5, 6, 7],
      8: [6, 7],
      7: [6, 7],
    }
  },
  
  // Tropical/Subtropical
  avocado: {
    zones: {
      11: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // Hass Jan–Oct; Fuerte, Bacon, Zutano Nov–Mar
      9: [3, 4, 5, 6, 7, 8],
    }
  },
  
  guava: {
    zones: {
      11: [8, 9, 10, 11],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [8, 9, 10, 11],
      9: [9, 10],
    }
  },
  
  mango: {
    zones: {
      11: [5, 6, 7, 8, 9, 10],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [5, 6, 7, 8, 9, 10],           // Tropical zones only
    }
  },
  
  pomegranate: {
    zones: {
      11: [9, 10, 11],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [9, 10, 11],
      9: [9, 10, 11],
      8: [9, 10],
    }
  },
  
  persimmon: {
    zones: {
      11: [10, 11, 12],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [10, 11, 12],
      9: [10, 11, 12],
      8: [10, 11],
      7: [10, 11],
    }
  },
  
  // Nuts
  walnut: {
    zones: {
      10: [9, 10],
      9: [9, 10, 11],
      8: [9, 10, 11],
      7: [10, 11],
    }
  },
  
  almond: {
    zones: {
      10: [8, 9],
      9: [9, 10],
      8: [9, 10],
    }
  },
  
  pecan: {
    zones: {
      10: [10, 11],
      9: [10, 11],
      8: [10, 11],
      7: [10, 11],
    }
  },
  
  // Other
  grape: {
    zones: {
      10: [7, 8, 9],
      9: [8, 9, 10],
      8: [9, 10],
      7: [9, 10],
    }
  },
  
  kiwi: {
    zones: {
      10: [10, 11],
      9: [10, 11],
      8: [10, 11],
      7: [10, 11],
    }
  },
  
  'passion fruit': {
    zones: {
      11: [5, 6, 7, 8, 9, 10, 11, 12],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [5, 6, 7, 8, 9, 10, 11, 12],
      9: [7, 8, 9],
    }
  },

  // Tree fruit (extended)
  'asian pear': {
    zones: {
      10: [7, 8],
      9: [8, 9],
      8: [8, 9],
      7: [9, 10],
      6: [9, 10],
    }
  },

  crabapple: {
    zones: {
      10: [8, 9],
      9: [9, 10],
      8: [9, 10],
      7: [9, 10],
      6: [9, 10],
    }
  },

  medlar: {
    zones: {
      10: [10, 11],
      9: [10, 11],
      8: [10, 11],
      7: [10, 11],
    }
  },

  nectarine: {
    zones: {
      10: [5, 6, 7],
      9: [6, 7, 8],
      8: [7, 8],
      7: [7, 8],
      6: [8],
    }
  },

  pawpaw: {
    zones: {
      10: [9, 10],
      9: [9, 10],
      8: [9, 10],
      7: [9, 10],
      6: [9, 10],
    }
  },

  pluot: {
    zones: {
      10: [6, 7, 8, 9],
      9: [6, 7, 8],
      8: [7, 8],
      7: [7, 8],
    }
  },

  quince: {
    zones: {
      10: [9, 10],
      9: [10, 11],
      8: [10, 11],
      7: [10, 11],
    }
  },

  serviceberry: {
    zones: {
      10: [5, 6],
      9: [5, 6],
      8: [6, 7],
      7: [6, 7],
      6: [6, 7],
    }
  },

  'sour cherry': {
    zones: {
      10: [5, 6],
      9: [6, 7],
      8: [6, 7],
      7: [6, 7],
      6: [7],
      5: [7],                    // Traverse City MI, Wisconsin
    }
  },

  // Citrus (extended)
  bergamot: {
    zones: {
      10: [12, 1, 2, 3],
      9: [1, 2, 3],
    }
  },

  'blood orange': {
    zones: {
      10: [12, 1, 2, 3, 4],
      9: [1, 2, 3, 4],
      8: [2, 3],
    }
  },

  calamansi: {
    zones: {
      10: [11, 12, 1, 2, 3, 4, 5],
      9: [12, 1, 2, 3],
    }
  },

  citron: {
    zones: {
      10: [11, 12, 1, 2, 3],
      9: [12, 1, 2],
    }
  },

  clementine: {
    zones: {
      11: [12, 1, 2],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [12, 1, 2],
      9: [12, 1, 2, 3],
    }
  },

  mandarin: {
    zones: {
      11: [11, 12, 1, 2, 3, 4, 5],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [11, 12, 1, 2, 3, 4, 5],
      9: [12, 1, 2, 3],
      8: [1, 2],
    }
  },

  pomelo: {
    zones: {
      10: [12, 1, 2, 3, 4],
      9: [1, 2, 3],
    }
  },

  yuzu: {
    zones: {
      10: [11, 12, 1, 2],
      9: [11, 12, 1, 2],
      8: [12, 1],
    }
  },

  // Tropical / subtropical (extended)
  banana: {
    zones: {
      11: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      9: [6, 7, 8, 9, 10],
    }
  },

  breadfruit: {
    zones: {
      10: [7, 8, 9, 10],
    }
  },

  cherimoya: {
    zones: {
      11: [10, 11, 12, 1, 2, 3, 4, 5],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [10, 11, 12, 1, 2, 3, 4, 5],
      9: [12, 1, 2],
    }
  },

  'dragon fruit': {
    zones: {
      11: [6, 7, 8, 9, 10, 11],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [6, 7, 8, 9, 10, 11],
    }
  },

  feijoa: {
    zones: {
      11: [10, 11, 12],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [10, 11, 12],
      9: [10, 11],
      8: [10, 11],
    }
  },

  jackfruit: {
    zones: {
      11: [5, 6, 7, 8, 9, 10],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [5, 6, 7, 8, 9, 10],
    }
  },

  jaboticaba: {
    zones: {
      10: [3, 4, 5, 9, 10, 11],   // Two crops per year
    }
  },

  longan: {
    zones: {
      11: [7, 8],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [7, 8],
    }
  },

  lychee: {
    zones: {
      11: [5, 6, 7],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [5, 6, 7],
    }
  },

  papaya: {
    zones: {
      11: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    }
  },

  rambutan: {
    zones: {
      10: [6, 7, 8, 9],
    }
  },

  sapote: {
    zones: {
      11: [10, 11, 12, 1, 2, 3],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [10, 11, 12, 1, 2, 3],
    }
  },

  soursop: {
    zones: {
      11: [6, 7, 8, 9],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [6, 7, 8, 9],
    }
  },

  starfruit: {
    zones: {
      11: [6, 7, 8, 9, 10, 11, 12, 1, 2, 3],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [6, 7, 8, 9, 10, 11, 12, 1, 2, 3],
    }
  },

  'surinam cherry': {
    zones: {
      11: [3, 4, 5, 6, 9, 10, 11],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [3, 4, 5, 6, 9, 10, 11],       // Two crops per year
    }
  },

  tamarind: {
    zones: {
      10: [12, 1, 2, 3, 4],
    }
  },

  // Nuts (extended)
  chestnut: {
    zones: {
      10: [9, 10],
      9: [9, 10, 11],
      8: [10, 11],
      7: [10, 11],
    }
  },

  hazelnut: {
    zones: {
      10: [9, 10],
      9: [9, 10],
      8: [9, 10],
      7: [9, 10],
      6: [9, 10],
    }
  },

  macadamia: {
    zones: {
      11: [11, 12, 1, 2, 3, 4, 5],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [11, 12, 1, 2, 3, 4, 5],
    }
  },

  'pine nut': {
    zones: {
      10: [9, 10],
      9: [9, 10],
      8: [10, 11],
      7: [10, 11],
    }
  },

  pistachio: {
    zones: {
      10: [9, 10],
      9: [9, 10],
      8: [9, 10],
    }
  },

  // Berries / vines (extended)
  boysenberry: {
    zones: {
      10: [5, 6, 7],
      9: [6, 7],
      8: [6, 7, 8],
      7: [7, 8],
    }
  },

  cranberry: {
    zones: {
      10: [10, 11],
      9: [10, 11],
      8: [10, 11],
      7: [10, 11],
      6: [10],
    }
  },

  currant: {
    zones: {
      10: [6, 7],
      9: [6, 7],
      8: [7, 8],
      7: [7, 8],
      6: [7, 8],
      5: [7, 8],
    }
  },

  dewberry: {
    zones: {
      10: [4, 5, 6],
      9: [5, 6],
      8: [6, 7],
    }
  },

  elderberry: {
    zones: {
      10: [8, 9],
      9: [8, 9],
      8: [8, 9],
      7: [8, 9],
      6: [8, 9],
    }
  },

  gooseberry: {
    zones: {
      10: [6, 7],
      9: [6, 7],
      8: [7, 8],
      7: [7, 8],
      6: [7, 8],
      5: [7, 8],
    }
  },

  huckleberry: {
    zones: {
      10: [7, 8],
      9: [7, 8],
      8: [7, 8],
      7: [8, 9],
    }
  },

  loganberry: {
    zones: {
      10: [5, 6, 7],
      9: [6, 7],
      8: [7, 8],
    }
  },

  // Other (extended)
  coconut: {
    zones: {
      11: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],  // = zone 10: its source covers 11a places (docs/season-sources.md, zone 11)
      10: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    }
  },

  date: {
    zones: {
      10: [9, 10, 11],
    }
  },

  jujube: {
    zones: {
      10: [9, 10],
      9: [9, 10],
      8: [9, 10],
      7: [10],
    }
  },

  olive: {
    zones: {
      10: [9, 10, 11, 12, 1, 2],
      9: [9, 10, 11, 12, 1, 2],
      8: [10, 11],
    }
  },

  'prickly pear': {
    zones: {
      10: [8, 9, 10],
      9: [9, 10],
      8: [9, 10],
    }
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
    }
  },

  chanterelle: {
    zones: {
      10: [6, 7, 8, 9, 10],
      9: [7, 8, 9, 10],
      8: [7, 8, 9, 10],
      7: [7, 8, 9],
      6: [7, 8, 9],
      5: [7, 8],
    }
  },

  'chicken of the woods': {
    zones: {
      10: [7, 8, 9, 10],
      9: [7, 8, 9, 10],
      8: [8, 9, 10],
      7: [8, 9, 10],
      6: [8, 9, 10],
      5: [8, 9],
    }
  },

  'hen of the woods': {
    zones: {
      10: [9, 10, 11],
      9: [9, 10, 11],
      8: [9, 10, 11],
      7: [9, 10],
      6: [9, 10],
      5: [9, 10],
    }
  },

  'lion\'s mane': {
    zones: {
      10: [8, 9, 10, 11],
      9: [8, 9, 10, 11],
      8: [9, 10, 11],
      7: [9, 10, 11],
      6: [9, 10],
      5: [9, 10],
    }
  },

  'lobster mushroom': {
    zones: {
      10: [7, 8, 9],
      9: [7, 8, 9],
      8: [7, 8, 9],
      7: [8, 9],
      6: [8, 9],
      5: [8, 9],
    }
  },

  matsutake: {
    zones: {
      10: [9, 10, 11],
      9: [9, 10, 11],
      8: [9, 10, 11],
      7: [9, 10],
    }
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
    }
  },

  'oyster mushroom': {
    zones: {
      10: [3, 4, 5, 10, 11, 12],
      9: [3, 4, 5, 10, 11],
      8: [3, 4, 5, 10, 11],
      7: [4, 5, 9, 10, 11],
      6: [4, 5, 9, 10],
      5: [5, 9, 10],
    }
  },

  porcini: {
    zones: {
      10: [6, 7, 8, 9],
      9: [7, 8, 9],
      8: [7, 8, 9],
      7: [7, 8, 9],
      6: [8, 9],
      5: [8, 9],
    }
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
    }
  },

  'turkey tail': {
    zones: {
      10: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      9: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      8: [3, 4, 5, 9, 10, 11],
      7: [4, 5, 9, 10, 11],
      6: [4, 5, 9, 10],
      5: [5, 9, 10],
    }
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
    }
  },

  dandelion: {
    zones: {
      10: [2, 3, 4, 5],
      9: [2, 3, 4, 5, 6],
      8: [3, 4, 5, 6],
      7: [3, 4, 5, 6, 7],
      6: [4, 5, 6, 7],
      5: [4, 5, 6, 7, 8, 9],
    }
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
    }
  },

  lambsquarters: {
    zones: {
      10: [4, 5, 6, 7, 8, 9],
      9: [5, 6, 7, 8, 9],
      8: [5, 6, 7, 8],
      7: [5, 6, 7, 8],
      6: [6, 7, 8],
      5: [6, 7, 8],
    }
  },

  'miner\'s lettuce': {
    zones: {
      10: [1, 2, 3, 4, 5],
      9: [2, 3, 4, 5],
      8: [3, 4, 5],
      7: [3, 4, 5],
    }
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
    }
  },

  purslane: {
    zones: {
      10: [5, 6, 7, 8, 9],
      9: [6, 7, 8, 9],
      8: [6, 7, 8],
      7: [6, 7, 8],
      6: [7, 8],
      5: [7, 8],
    }
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
    }
  },

  violet: {
    zones: {
      10: [1, 2, 3, 4],
      9: [2, 3, 4],
      8: [3, 4, 5],
      7: [3, 4, 5],
      6: [4, 5],
      5: [5, 6],
    }
  },

  watercress: {
    zones: {
      10: [1, 2, 3, 4, 5, 10, 11, 12],
      9: [2, 3, 4, 5, 10, 11],
      8: [3, 4, 5, 9, 10],
      7: [4, 5, 9, 10],
      6: [4, 5, 6, 9],
      5: [5, 6, 9],
    }
  },

  'wild bergamot': {
    zones: {
      10: [5, 6, 7, 8],
      9: [5, 6, 7, 8],
      8: [6, 7, 8],
      7: [6, 7, 8],
      6: [6, 7, 8],
      5: [7, 8],
    }
  },

  'wild ginger': {
    zones: {
      10: [3, 4, 5],
      9: [3, 4, 5],
      8: [4, 5, 6],
      7: [4, 5, 6],
      6: [5, 6],
      5: [5, 6],
    }
  },

  'wood sorrel': {
    zones: {
      10: [1, 2, 3, 4, 5],
      9: [3, 4, 5, 6],
      8: [4, 5, 6, 7],
      7: [4, 5, 6, 7],
      6: [5, 6, 7],
      5: [5, 6, 7],
    }
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
    }
  },

  // Mushrooms (additional)
  'cauliflower mushroom': {
    zones: {
      9: [8, 9, 10],
      8: [8, 9, 10],
      7: [9, 10],
      6: [9, 10],
      5: [9, 10],
    }
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
    }
  },

  'hedgehog mushroom': {
    zones: {
      10: [9, 10, 11, 12],
      9: [9, 10, 11],
      8: [9, 10, 11],
      7: [9, 10, 11],
      6: [9, 10],
      5: [9, 10],
    }
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
    }
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
    }
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
    }
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
    }
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
    }
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
    }
  },

  wintergreen: {
    zones: {
      7: [9, 10, 11, 12, 1, 2],
      6: [9, 10, 11, 12, 1],
      5: [9, 10, 11, 12],
      4: [9, 10, 11],
      3: [9, 10, 11],
    }
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
    }
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
    }
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
    }
  },

  'fiddlehead fern': {
    zones: {
      8: [3, 4, 5],
      7: [4, 5],
      6: [4, 5],
      5: [4, 5],
      4: [5, 6],
      3: [5, 6],
    }
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
    }
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
    }
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
    }
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
    }
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
    }
  },

  spicebush: {
    zones: {
      9: [9, 10],
      8: [9, 10],
      7: [9, 10],
      6: [9, 10],
      5: [10],
      4: [10],
    }
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
    }
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
    }
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
    }
  },

  calendula: {
    zones: {
      10: [1,  2,  3,  4,  5,  10,  11,  12],
      9: [3,  4,  5,  6,  10,  11],
      8: [5,  6,  7,  8,  9,  10],
      7: [6,  7,  8,  9],
      6: [6,  7,  8,  9],
      5: [7,  8,  9],
    }
  },

  "california poppy": {
    zones: {
      10: [2,  3,  4,  5],
      9: [3,  4,  5,  6],
      8: [4,  5,  6,  7],
      7: [5,  6,  7],
    }
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
    }
  },

  chamomile: {
    zones: {
      10: [2,  3,  4,  5],
      9: [4,  5,  6],
      8: [5,  6,  7],
      7: [6,  7],
      6: [6,  7,  8],
      5: [6,  7,  8],
    }
  },

  cleavers: {
    zones: {
      10: [1,  2,  3],
      9: [2,  3,  4],
      8: [3,  4,  5],
      7: [4,  5],
      6: [4,  5,  6],
      5: [5,  6],
    }
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
    }
  },

  echinacea: {
    zones: {
      9: [5,  6,  7],
      8: [6,  7,  8],
      7: [6,  7,  8],
      6: [7,  8],
      5: [7,  8],
      4: [7,  8],
    }
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
    }
  },

  feverfew: {
    zones: {
      10: [4,  5,  6,  7,  8],
      9: [5,  6,  7,  8,  9],
      8: [6,  7,  8,  9],
      7: [6,  7,  8,  9],
      6: [7,  8],
      5: [7,  8],
    }
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
    }
  },

  "gotu kola": {
    zones: {
      10: [1,  2,  3,  4,  5,  6,  7,  8,  9,  10,  11,  12],
      9: [4,  5,  6,  7,  8,  9,  10],
    }
  },

  hibiscus: {
    zones: {
      10: [10,  11,  12,  1],
      9: [10,  11],
    }
  },

  horehound: {
    zones: {
      10: [3,  4,  5,  6,  7,  8,  9],
      9: [4,  5,  6,  7,  8,  9,  10],
      8: [5,  6,  7,  8,  9,  10],
      7: [6,  7,  8,  9],
      6: [6,  7,  8],
      5: [7,  8],
    }
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
    }
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
    }
  },

  linden: {
    zones: {
      9: [5],
      8: [5,  6],
      7: [5,  6,  7],
      6: [6,  7],
      5: [6,  7],
      4: [7],
    }
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
    }
  },

  motherwort: {
    zones: {
      9: [5,  6,  7],
      8: [5,  6,  7],
      7: [6,  7,  8],
      6: [6,  7,  8],
      5: [7,  8],
      4: [7,  8],
    }
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
    }
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
    }
  },

  passionflower: {
    zones: {
      10: [4,  5,  6,  7,  8,  9],
      9: [5,  6,  7,  8,  9],
      8: [5,  6,  7],
      7: [6,  7,  8],
    }
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
    }
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
    }
  },

  skullcap: {
    zones: {
      9: [7,  8,  9,  10],
      8: [7,  8,  9,  10],
      7: [7,  8,  9],
      6: [7,  8,  9],
      5: [7,  8],
      4: [7,  8],
    }
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
    }
  },

  valerian: {
    zones: {
      8: [6,  7],
      7: [6,  7,  8],
      6: [6,  7,  8],
      5: [6,  7,  8],
      4: [7],
    }
  },

  "yerba santa": {
    zones: {
      10: [4,  5,  6,  7],
      9: [4,  5,  6,  7],
    }
  },
};

/** How far (in whole zones) a kind's months may be borrowed from a neighbouring zone. */
export const BORROW_LIMIT = 1;

/**
 * A kind's season in a USDA zone: { months, zone, borrowed }, or null.
 * `zone` is the zone the months are listed for. A zone the kind doesn't list
 * borrows the nearest listed zone's months when it's at most BORROW_LIMIT away
 * (`borrowed: true`); further than that the season isn't known (null), and the
 * popup says "season varies". Null too for a kind with no season data, or for
 * anything that isn't a kind name and a zone number.
 * @param {string} fruitType
 * @param {number} zone
 */
export function getSeason(fruitType, zone) {
  if (typeof fruitType !== 'string') return null;
  const z = Number(zone);
  if (zone == null || !Number.isFinite(z)) return null;
  const fruit = FRUIT_SEASONS[fruitType.toLowerCase()];
  if (!fruit || !fruit.zones) return null;
  if (fruit.zones[z]) return { months: fruit.zones[z], zone: z, borrowed: false };

  const listed = Object.keys(fruit.zones).map(Number);
  if (listed.length === 0) return null;
  const closest = listed.reduce((prev, curr) => (Math.abs(curr - z) < Math.abs(prev - z) ? curr : prev));
  if (Math.abs(closest - z) > BORROW_LIMIT) return null;
  return { months: fruit.zones[closest], zone: closest, borrowed: true };
}

/** Just the months of getSeason(), or null. */
export function getSeasonForZone(fruitType, zone) {
  const season = getSeason(fruitType, zone);
  return season ? season.months : null;
}
