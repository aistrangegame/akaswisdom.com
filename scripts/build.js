/**
 * build.js
 * ------------------------------------------------------------------
 * Pulls rows from an Airtable table and renders each one into a
 * static HTML page using a template file, then writes the result
 * into /public. GitHub Actions runs this on every push to main and
 * uploads /public to SiteGround via SFTP (see deploy.yml).
 *
 * Local usage:
 *   AIRTABLE_API_KEY=xxx AIRTABLE_BASE_ID=xxx AIRTABLE_TABLE_NAME=Pages node scripts/build.js
 * ------------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Pages';

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const OUTPUT_DIR = path.join(__dirname, '..', 'public');

if (!API_KEY || !BASE_ID) {
  console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID env vars.');
  process.exit(1);
}

// ---- 1. Fetch all records from Airtable (handles pagination) ----
async function fetchAllRecords() {
  let records = [];
  let offset;

  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`);
    if (offset) url.searchParams.set('offset', offset);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    if (!res.ok) {
      throw new Error(`Airtable fetch failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    records = records.concat(data.records);
    offset = data.offset;
  } while (offset);

  return records;
}

// ---- 2. Very small {{field}} templating ----
function render(templateStr, fields) {
  return templateStr.replace(/\{\{\s*([\w. ]+)\s*\}\}/g, (_, key) => {
    const value = fields[key.trim()];
    return value === undefined || value === null ? '' : String(value);
  });
}

// ---- 3. Slugify a fallback if a record has no explicit Slug field ----
function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function main() {
  console.log(`Fetching records from "${TABLE_NAME}"...`);
  const records = await fetchAllRecords();
  console.log(`Fetched ${records.length} records.`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const record of records) {
    const fields = record.fields;

    // Skip anything not marked ready to publish, if you use a Status field.
    if (fields.Status && fields.Status !== 'Live') continue;

    // Which template file this record renders through — defaults to
    // "default.html" in /templates. Lets different rows use different layouts.
    const templateName = fields.Template || 'default.html';
    const templatePath = path.join(TEMPLATES_DIR, templateName);

    if (!fs.existsSync(templatePath)) {
      console.warn(`Template "${templateName}" not found for record ${record.id} — skipping.`);
      continue;
    }

    const templateStr = fs.readFileSync(templatePath, 'utf8');
    const html = render(templateStr, fields);

    const slug = fields.Slug || slugify(fields.Title || record.id);
    // Nested folder + index.html gives clean URLs: akaswisdom.com/slug/
    const outDir = path.join(OUTPUT_DIR, slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');

    console.log(`Built /${slug}/index.html from "${fields.Title || record.id}"`);
  }

  console.log('Build complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
