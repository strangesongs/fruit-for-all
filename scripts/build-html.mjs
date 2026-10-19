// Post-build: point dist/index.html at the content-hashed entry files.
// The service worker caches .js/.css cache-first, so entry names must change
// whenever their contents do or returning users never receive updates.
import fs from 'node:fs';
import path from 'node:path';

const DIST = 'dist';
const META = path.join(DIST, '.meta.json');
const TEMPLATE = 'client/map-index.html';

const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
const outputs = Object.entries(meta.outputs || {});

const entry = outputs.find(([, o]) => o.entryPoint && o.entryPoint.replace(/\\/g, '/').endsWith('client/index.js'));
if (!entry) throw new Error('build-html: no output for client/index.js in metafile');
const jsFile = path.basename(entry[0]);

let cssFile = entry[1].cssBundle ? path.basename(entry[1].cssBundle) : null;
if (!cssFile) {
  const css = outputs.map(([k]) => path.basename(k)).find((k) => /^index-[A-Z0-9]+\.css$/i.test(k));
  cssFile = css || null;
}
if (!cssFile) throw new Error('build-html: no CSS bundle found for client/index.js');

let html = fs.readFileSync(TEMPLATE, 'utf8');
const before = html;
html = html.replace(/href="\/?index\.css"/, `href="/${cssFile}"`).replace(/src="\/?index\.js"/, `src="/${jsFile}"`);
if (html === before || !html.includes(jsFile) || !html.includes(cssFile)) {
  throw new Error('build-html: could not rewrite index.css / index.js references in the template');
}
fs.writeFileSync(path.join(DIST, 'index.html'), html);
fs.rmSync(META); // build metadata is not for serving
console.log(`build-html: index.html → /${jsFile}, /${cssFile}`);
