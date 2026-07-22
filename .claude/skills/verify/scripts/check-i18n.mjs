// Verify es.json and en.json share the exact same set of key paths.
// A key present in one locale but not the other makes t() render the raw key
// string on screen. Exits 1 (with the offending keys) on any mismatch.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// Walk up from this script until we find src/locales/es.json (robust to cwd).
function findLocalesDir(start) {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, 'src/locales/es.json');
    try {
      readFileSync(candidate);
      return resolve(dir, 'src/locales');
    } catch {
      dir = resolve(dir, '..');
    }
  }
  throw new Error('src/locales/es.json not found walking up from ' + start);
}

// Flatten a nested locale object into a set of dot-separated leaf paths.
function flatten(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out.add(key);
  }
  return out;
}

const localesDir = findLocalesDir(here);
const es = JSON.parse(readFileSync(resolve(localesDir, 'es.json'), 'utf8'));
const en = JSON.parse(readFileSync(resolve(localesDir, 'en.json'), 'utf8'));

const esKeys = flatten(es);
const enKeys = flatten(en);
const missingInEn = [...esKeys].filter((k) => !enKeys.has(k)).sort();
const missingInEs = [...enKeys].filter((k) => !esKeys.has(k)).sort();

if (missingInEn.length === 0 && missingInEs.length === 0) {
  console.log(`✓ i18n OK — ${esKeys.size} keys match in es.json and en.json`);
  process.exit(0);
}
if (missingInEn.length) console.error(`✗ Missing in en.json (${missingInEn.length}):\n  ` + missingInEn.join('\n  '));
if (missingInEs.length) console.error(`✗ Missing in es.json (${missingInEs.length}):\n  ` + missingInEs.join('\n  '));
process.exit(1);
