// USDA Hardiness Zone-based fruit seasons
// Months are 1-indexed (1 = January, 12 = December)

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
      6: [8],
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
      10: [11, 12, 1, 2, 3],      // Winter citrus
      9: [12, 1, 2, 3, 4],
      8: [1, 2, 3],               // Limited areas
    },
    display: "Winter - Early Spring"
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
      10: [12, 1, 2, 3, 4],
      9: [1, 2, 3, 4],
    },
    display: "Winter - Spring"
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
      10: [11, 12, 1, 2, 3],
      9: [12, 1, 2, 3],
      8: [1, 2],
    },
    display: "Winter"
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
    },
    display: "Summer"
  },
  
  mulberry: {
    zones: {
      10: [4, 5, 6],
      9: [5, 6, 7],
      8: [6, 7],
      7: [6, 7],
    },
    display: "Late Spring - Summer"
  },
  
  // Tropical/Subtropical
  avocado: {
    zones: {
      10: [2, 3, 4, 5, 6, 7, 8, 9], // Long season
      9: [3, 4, 5, 6, 7, 8],
    },
    display: "Spring - Fall (warm zones)"
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
      10: [6, 7, 8, 9],           // Tropical zones only
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
  
  passionfruit: {
    zones: {
      10: [6, 7, 8, 9, 10],
      9: [7, 8, 9],
    },
    display: "Summer - Fall (warm zones)"
  }
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
