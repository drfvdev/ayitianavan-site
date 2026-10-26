// Builds the search index for the "Rechercher" page (Pagefind).
import * as pagefind from 'pagefind';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const { index, errors } = await pagefind.createIndex({ forceLanguage: 'fr' });
if (!index) throw new Error(errors.join('\n'));
const added = await index.addDirectory({ path: DIST });
if (added.errors.length) console.warn(added.errors);
const written = await index.writeFiles({ outputPath: path.join(DIST, 'pagefind') });
if (written.errors.length) throw new Error(written.errors.join('\n'));
await pagefind.close();
console.log(`Search index: ${added.page_count} pages`);
