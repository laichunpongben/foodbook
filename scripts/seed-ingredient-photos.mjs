#!/usr/bin/env node
/**
 * seed-ingredient-photos.mjs — one-shot tool to add Wikimedia `heroUrl`
 * entries to recipe ingredients that don't already have one.
 *
 * Resolves each ingredient name to a Wikipedia article via the curated
 * INGREDIENT_TO_WIKI_TITLE map below, fetches the lead-image URL from
 * `/api/rest_v1/page/summary/<title>`, and rewrites the MDX in place to
 * insert `heroUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/..."`
 * directly under the `text:` line.
 *
 * Names mapped to `null` are intentionally skipped (vague, generic, or
 * non-photographable — e.g. "Stock", "Cold water", "Pinch of salt").
 *
 * Run from repo root: `node scripts/seed-ingredient-photos.mjs`.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RECIPES_DIR = 'src/content/recipes';

const INGREDIENT_TO_WIKI_TITLE = {
  // alliums
  'garlic': 'Garlic',
  'yellow onion': 'Onion',
  'white onion': 'Onion',
  'red onion': 'Onion',
  'pearl onions': 'Onion',
  'shallot': 'Shallot',
  'shallots': 'Shallot',
  'scallions': 'Scallion',
  'spring onions': 'Scallion',
  'leek': 'Leek',
  'garlic chives': 'Allium_tuberosum',
  'chinese chives': 'Allium_tuberosum',

  // herbs
  'basil': 'Basil',
  'thai basil': 'Thai_basil',
  'cilantro': 'Coriander',
  'coriander': 'Coriander',
  'flat-leaf parsley': 'Parsley',
  'parsley': 'Parsley',
  'fresh mint': 'Mentha',
  'mint': 'Mentha',
  'fresh dill': 'Dill',
  'more dill': 'Dill',
  'thyme': 'Thyme',
  'rosemary': 'Rosemary',
  'bay leaves': 'Bay_leaf',
  'shiso leaves': 'Perilla_frutescens',
  'lemongrass': 'Lemongrass',
  'kaffir lime leaves': 'Kaffir_lime',

  // spices
  'black pepper': 'Black_pepper',
  'white pepper': 'Black_pepper',
  'sichuan peppercorns': 'Sichuan_pepper',
  'cumin': 'Cumin',
  'ground cumin': 'Cumin',
  'cumin seeds': 'Cumin',
  'coriander seed': 'Coriander',
  'coriander seeds': 'Coriander',
  'ground coriander': 'Coriander',
  'turmeric': 'Turmeric',
  'paprika': 'Paprika',
  'pimentón dulce': 'Paprika',
  'cayenne': 'Cayenne_pepper',
  'cinnamon stick': 'Cinnamon',
  'cardamom': 'Cardamom',
  'nutmeg': 'Nutmeg',
  'allspice': 'Allspice',
  'saffron': 'Saffron',
  'juniper berries': 'Juniper_berry',
  'anise seeds': 'Anise',
  'star anise': 'Illicium_verum',
  'whole cloves': 'Clove',
  'five-spice': 'Five-spice_powder',
  'whole spices': 'Spice',
  'garam masala': 'Garam_masala',
  'red chili powder': 'Chili_powder',
  'kashmiri chili powder': 'Chili_powder',
  'chili flakes': 'Crushed_red_pepper',
  'chili powder': 'Chili_powder',
  'kasuri methi': 'Fenugreek',

  // chilies
  'ancho chiles': 'Ancho',
  'mulato chiles': 'Mulato_pepper',
  'pasilla chiles': 'Pasilla',
  'guajillo chiles': 'Guajillo_chili',
  'chipotle chile': 'Chipotle',
  'bird\'s eye chiles': 'Bird\'s_eye_chili',
  'serrano chiles': 'Serrano_pepper',
  'dried red chiles': 'Chili_pepper',
  'red chiles': 'Chili_pepper',
  'green chiles': 'Chili_pepper',

  // salt + sugars
  'sea salt': 'Sea_salt',
  'salt': 'Salt',
  'coarse salt': 'Salt',
  'pinch of salt': 'Salt',
  'sugar': 'Sugar',
  'brown sugar': 'Brown_sugar',
  'caster sugar': 'Sugar',
  'demerara sugar': 'Demerara_sugar',
  'palm sugar': 'Palm_sugar',
  'maltose syrup': 'Maltose',
  'honey': 'Honey',

  // dairy + eggs
  'butter': 'Butter',
  'cold butter': 'Butter',
  'ghee': 'Ghee',
  'heavy cream': 'Cream',
  'whole milk': 'Milk',
  'besciamella milk': 'Milk',
  'greek yogurt': 'Strained_yogurt',
  'mascarpone': 'Mascarpone',
  'parmigiano reggiano': 'Parmigiano_Reggiano',
  'paneer': 'Paneer',
  'fior di latte': 'Mozzarella',
  'silken tofu': 'Tofu',
  'pressed tofu': 'Tofu',
  'egg': 'Egg_as_food',
  'eggs': 'Egg_as_food',
  'egg yolk': 'Yolk',
  'egg yolks': 'Yolk',
  'egg whites': 'Egg_white',

  // oils + vinegars + condiments
  'olive oil': 'Olive_oil',
  'neutral oil': 'Vegetable_oil',
  'toasted sesame oil': 'Sesame_oil',
  'mustard oil': 'Mustard_oil',
  'chili oil': 'Chili_oil',
  'lard': 'Lard',
  'rice vinegar': 'Rice_vinegar',
  'black vinegar': 'Black_vinegar',
  'chinkiang black vinegar': 'Black_vinegar',
  'sherry vinegar': 'Sherry_vinegar',
  'soy sauce': 'Soy_sauce',
  'light soy sauce': 'Soy_sauce',
  'dark soy sauce': 'Soy_sauce',
  'fish sauce': 'Fish_sauce',
  'hoisin sauce': 'Hoisin_sauce',
  'mustard': 'Mustard_(condiment)',
  'dijon mustard': 'Mustard_(condiment)',
  'tamarind paste': 'Tamarind',
  'achiote paste': 'Annatto',
  'douchi': 'Douchi',
  'pixian doubanjiang': 'Doubanjiang',
  'nam prik pao': 'Nam_phrik',
  'green curry paste': 'Green_curry',
  'preserved radish': 'Daikon',
  'lingonberry jam': 'Lingonberry',
  'baking soda': 'Sodium_bicarbonate',

  // wines + spirits
  'dry white wine': 'White_wine',
  'red wine': 'Wine',
  'burgundy red wine': 'Burgundy_wine',
  'marsala': 'Marsala_wine',
  'sake': 'Sake_(beverage)',
  'mirin': 'Mirin',
  'shaoxing wine': 'Shaoxing_wine',
  'cognac': 'Cognac',
  'aquavit': 'Akvavit',
  'pastis': 'Pastis',
  'mandarin pancakes': 'Peking_duck',
  'white vinegar': 'Vinegar',

  // grains + flours + starches
  'plain flour': 'Flour',
  'bread flour': 'Flour',
  'flour': 'Flour',
  'tempura flour': 'Flour',
  'cornstarch': 'Corn_starch',
  'fine bulgur': 'Bulgur',
  'basmati rice': 'Basmati',
  'bomba rice': 'Bomba_rice',
  'carnaroli rice': 'Carnaroli',
  'sushi rice': 'Japonica_rice',
  'day-old jasmine rice': 'Jasmine_rice',
  'rice noodles': 'Rice_noodles',
  'fresh ramen noodles': 'Ramen',
  'spinach lasagne sheets': 'Lasagne',
  'corn tortillas': 'Corn_tortilla',
  'savoiardi': 'Ladyfinger_(biscuit)',
  'crustless bread': 'Bread',
  'crusty baguette': 'Baguette',
  'stale bread': 'Bread',
  'stale breadcrumbs': 'Breadcrumb',
  'rye bread': 'Rye_bread',
  'fresh yeast': 'Baker\'s_yeast',

  // proteins
  'beef chuck': 'Chuck_steak',
  'ground beef': 'Ground_beef',
  'beef bone marrow': 'Bone_marrow_(food)',
  'pork belly': 'Pork_belly',
  'pork shoulder': 'Boston_butt',
  'ground pork': 'Ground_meat',
  'pancetta': 'Pancetta',
  'lardons': 'Lardon',
  'smoked lardons': 'Lardon',
  'pork femur bones': 'Bone_marrow_(food)',
  'char siu pork': 'Char_siu',
  'chicken': 'Chicken_(food)',
  'chicken thigh': 'Chicken_(food)',
  'chicken legs': 'Chicken_(food)',
  'chicken feet': 'Chicken_feet',
  'chicken stock': 'Stock_(food)',
  'beef stock': 'Stock_(food)',
  'stock': 'Stock_(food)',
  'turkey': 'Turkey_meat',
  'rabbit': 'Rabbit_meat',
  'whole duck': 'Peking_duck',
  'bone-in mutton': 'Mutton',
  'salmon side': 'Salmon_as_food',
  'sushi-grade salmon': 'Salmon_as_food',
  'sushi-grade tuna': 'Tuna',
  'sushi-grade hamachi': 'Japanese_amberjack',
  'mixed firm white fish': 'Whitefish_(fisheries_term)',
  'mediterranean prawns': 'Prawn',
  'large head-on prawns': 'Prawn',
  'large prawns': 'Prawn',
  'small shrimp': 'Shrimp',
  'shrimp': 'Shrimp',
  'dried shrimp': 'Dried_shrimp',
  'mussels': 'Mussel',

  // vegetables + fruit
  'cherry tomatoes': 'Cherry_tomato',
  'plum tomatoes': 'Plum_tomato',
  'ripe tomatoes': 'Tomato',
  'very ripe tomatoes': 'Tomato',
  'tomato passata': 'Passata',
  'tomato paste': 'Tomato_paste',
  'tomatillos': 'Tomatillo',
  'carrot': 'Carrot',
  'carrots': 'Carrot',
  'cucumber': 'Cucumber',
  'eggplant': 'Eggplant',
  'thai eggplant': 'Solanum_melongena',
  'zucchini': 'Zucchini',
  'red bell pepper': 'Bell_pepper',
  'red bell peppers': 'Bell_pepper',
  'fennel bulb': 'Fennel',
  'kabocha squash': 'Kabocha',
  'sweet potato': 'Sweet_potato',
  'ripe plantain': 'Cooking_banana',
  'pineapple': 'Pineapple',
  'pineapple juice': 'Pineapple',
  'mustard greens': 'Brassica_juncea',
  'fresh spinach': 'Spinach',
  'napa cabbage': 'Napa_cabbage',
  'bamboo shoots': 'Bamboo_shoot',
  'bean sprouts': 'Bean_sprout',
  'shiitake mushrooms': 'Shiitake',
  'cremini mushrooms': 'Agaricus_bisporus',
  'straw mushrooms': 'Volvariella_volvacea',
  'waxy potatoes': 'Potato',
  'potatoes': 'Potato',
  'frozen peas': 'Pea',
  'garrofó beans': 'Lima_bean',
  'ferraúra beans': 'Green_bean',
  'whole chickpeas': 'Chickpea',
  'dried chickpeas': 'Chickpea',
  'lemon juice': 'Lemon',
  'lime juice': 'Lime_(fruit)',
  'lime': 'Lime_(fruit)',
  'lime wedges': 'Lime_(fruit)',
  'orange juice': 'Orange_(fruit)',
  'orange peel': 'Orange_(fruit)',
  'grated daikon': 'Daikon',

  // nuts + seeds + grains-ish
  'almonds': 'Almond',
  'cashews': 'Cashew',
  'peanuts': 'Peanut',
  'roasted peanuts': 'Peanut',
  'sesame seeds': 'Sesame',
  'more sesame seeds': 'Sesame',
  'pumpkin seeds': 'Pepita',
  'pine nuts': 'Pine_nut',

  // misc
  'soffritto': 'Soffritto',
  'bouquet garni': 'Bouquet_garni',
  'cocoa powder': 'Cocoa_solids',
  'mexican chocolate': 'Mexican_cuisine',
  'mexican oregano': 'Lippia_graveolens',
  'raisins': 'Raisin',
  'strong espresso': 'Espresso',
  'vanilla bean': 'Vanilla',
  'wasabi': 'Wasabi',
  'gari': 'Gari_(ginger)',
  'galangal': 'Galangal',
  'ginger': 'Ginger',
  'grated ginger': 'Ginger',
  'ginger-garlic paste': 'Ginger',
  'tahini': 'Tahini',
  'coconut milk': 'Coconut_milk',
  'coconut cream': 'Coconut_milk',
  'crispy fried onions': 'Fried_onion',
  'dashi': 'Dashi',
  'red chili powder': 'Chili_powder',

  'cold water': 'Water',
  'boiling water': 'Water',
  'ice water': 'Water',
  'water': 'Water',
  'rice water': 'Water',
  'pita and pickles': 'Pita',
  'garnish vegetables': 'Vegetable',
};

function slugifyName(name) {
  return name.toLowerCase().trim();
}

function pageTitleFor(name) {
  const key = slugifyName(name);
  if (key in INGREDIENT_TO_WIKI_TITLE) return INGREDIENT_TO_WIKI_TITLE[key];
  // fallback: replace spaces with underscores, capitalize first letter
  return name.replace(/\s+/g, '_').replace(/^./, (c) => c.toUpperCase());
}

async function fetchLeadImageFilename(title, attempt = 1) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'foodbook/seed-ingredient-photos (https://github.com/laichunpongben/foodbook)' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.status === 429 || res.status >= 500) {
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
        return fetchLeadImageFilename(title, attempt + 1);
      }
      return null;
    }
    if (!res.ok) return null;
    const json = await res.json();
    const src = json.originalimage?.source || json.thumbnail?.source;
    if (!src) return null;
    const m = src.match(/\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?]+)/);
    if (!m) return null;
    return decodeURIComponent(m[1]);
  } catch {
    clearTimeout(timer);
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      return fetchLeadImageFilename(title, attempt + 1);
    }
    return null;
  }
}

function toFilePathUrl(filename) {
  // Special:FilePath accepts the filename without URL-encoding spaces/commas
  // but parens and other punctuation need to be percent-encoded.
  const encoded = encodeURIComponent(filename).replace(/%2F/g, '/');
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=1280`;
}

async function buildCatalog(names) {
  const catalog = new Map();
  const failures = [];
  const skipped = [];
  const titles = new Map(); // dedupe by wiki title
  for (const name of names) {
    const title = pageTitleFor(name);
    if (title === null) { skipped.push(name); continue; }
    if (!titles.has(title)) titles.set(title, []);
    titles.get(title).push(name);
  }
  // Sequential fetch with a short per-request delay — Wikipedia's REST
  // API gets cranky on parallel bursts and silently throttles.
  for (const t of titles.keys()) {
    const fn = await fetchLeadImageFilename(t);
    if (fn) {
      const url = toFilePathUrl(fn);
      for (const name of titles.get(t)) catalog.set(name, url);
      process.stdout.write('.');
    } else {
      for (const name of titles.get(t)) failures.push(`${name} → ${t}`);
      process.stdout.write('x');
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return { catalog, failures, skipped };
}

function patchRecipe(path, catalog) {
  const txt = readFileSync(path, 'utf8');
  const lines = txt.split('\n');
  let inIng = false;
  let lastNameIdx = -1;
  let lastName = null;
  let hasHero = false;
  const insertions = []; // [afterIdx, indent, url]
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === 'ingredients:') { inIng = true; continue; }
    if (inIng && (line.startsWith('steps:') || line.startsWith('notes:') || line.startsWith('revisions:') || line === '---')) {
      if (lastName !== null && !hasHero) {
        const url = catalog.get(lastName);
        if (url) insertions.push([lastNameIdx + 1, '    ', url]);
      }
      inIng = false; lastName = null; lastNameIdx = -1; hasHero = false;
      continue;
    }
    if (!inIng) continue;
    const m = line.match(/^  - name: "(.+)"$/);
    if (m) {
      if (lastName !== null && !hasHero) {
        const url = catalog.get(lastName);
        if (url) insertions.push([lastNameIdx + 1, '    ', url]);
      }
      lastName = m[1];
      lastNameIdx = i;
      hasHero = false;
      // find the text: line right after
      for (let j = i + 1; j < lines.length; j++) {
        if (/^    text:/.test(lines[j])) { lastNameIdx = j; break; }
        if (/^  - name:/.test(lines[j]) || /^[a-z]/.test(lines[j])) break;
      }
    } else if (/^    heroUrl:/.test(line)) {
      hasHero = true;
    }
  }
  if (insertions.length === 0) return 0;
  // Apply insertions back-to-front to keep indices valid
  insertions.sort((a, b) => b[0] - a[0]);
  for (const [idx, indent, url] of insertions) {
    lines.splice(idx, 0, `${indent}heroUrl: "${url}"`);
  }
  writeFileSync(path, lines.join('\n'));
  return insertions.length;
}

async function main() {
  // 1) collect unique names lacking heroUrl
  const files = readdirSync(RECIPES_DIR).filter((f) => f.endsWith('.mdx'));
  const names = new Set();
  for (const f of files) {
    const txt = readFileSync(join(RECIPES_DIR, f), 'utf8');
    let inIng = false, currentName = null, hasHero = false;
    for (const line of txt.split('\n')) {
      if (line === 'ingredients:') { inIng = true; continue; }
      if (inIng && (line.startsWith('steps:') || line.startsWith('notes:') || line.startsWith('revisions:') || line === '---')) {
        if (currentName && !hasHero) names.add(currentName);
        inIng = false; currentName = null; hasHero = false; continue;
      }
      if (!inIng) continue;
      const m = line.match(/^  - name: "(.+)"$/);
      if (m) {
        if (currentName && !hasHero) names.add(currentName);
        currentName = m[1]; hasHero = false;
      } else if (/^    heroUrl:/.test(line)) hasHero = true;
    }
  }
  console.log(`Found ${names.size} unique ingredient names lacking heroUrl`);
  process.stdout.write('Fetching');

  // 2) build URL catalog
  const { catalog, failures, skipped } = await buildCatalog([...names]);
  process.stdout.write('\n');
  console.log(`Resolved ${catalog.size} → URL · ${skipped.length} skipped · ${failures.length} failed`);
  if (failures.length) {
    console.log('Failures:');
    for (const f of failures) console.log('  ' + f);
  }

  // 3) patch each recipe
  let totalAdds = 0;
  let touchedFiles = 0;
  for (const f of files) {
    const adds = patchRecipe(join(RECIPES_DIR, f), catalog);
    if (adds > 0) { touchedFiles++; totalAdds += adds; }
  }
  console.log(`Inserted ${totalAdds} heroUrl entries across ${touchedFiles} recipes`);
}

main().catch((e) => { console.error(e); process.exit(1); });
