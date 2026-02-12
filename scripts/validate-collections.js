import { readFile } from 'node:fs/promises'

const VALID_TYPES = ['parent', 'gallery']
const INSCRIPTION_ID_RE = /^[a-f0-9]{64}i\d+$/

let errors = 0

function error(message) {
  console.error(`ERROR: ${message}`)
  errors++
}

const raw = await readFile(new URL('../collections.json', import.meta.url), 'utf8')

let collections
try {
  collections = JSON.parse(raw)
} catch (e) {
  error(`Invalid JSON: ${e.message}`)
  process.exit(1)
}

if (!Array.isArray(collections)) {
  error('Root must be an array')
  process.exit(1)
}

// Check alpha sort
for (let i = 1; i < collections.length; i++) {
  if (collections[i].name.localeCompare(collections[i - 1].name) < 0) {
    error(`Not sorted: "${collections[i].name}" comes after "${collections[i - 1].name}"`)
  }
}

// Check for duplicate slugs
const slugs = new Set()
for (const entry of collections) {
  if (slugs.has(entry.slug)) {
    error(`Duplicate slug: "${entry.slug}"`)
  }
  slugs.add(entry.slug)
}

// Validate each entry
for (const entry of collections) {
  const label = entry.slug || entry.name || '(unknown)'

  if (typeof entry.name !== 'string' || !entry.name.trim()) {
    error(`[${label}] missing or empty name`)
  }

  if (!VALID_TYPES.includes(entry.type)) {
    error(`[${label}] invalid type "${entry.type}", must be: ${VALID_TYPES.join(', ')}`)
  }

  if (typeof entry.slug !== 'string' || !entry.slug.trim()) {
    error(`[${label}] missing or empty slug`)
  }

  if (entry.type === 'parent') {
    if (!Array.isArray(entry.ids) || entry.ids.length === 0) {
      error(`[${label}] parent type must have non-empty ids array`)
    } else {
      for (const id of entry.ids) {
        if (!INSCRIPTION_ID_RE.test(id)) {
          error(`[${label}] invalid inscription ID: "${id}"`)
        }
      }
    }
  }

  if (entry.type === 'gallery') {
    if (typeof entry.id !== 'string' || !INSCRIPTION_ID_RE.test(entry.id)) {
      error(`[${label}] gallery type must have valid id string`)
    }
  }
}

if (errors > 0) {
  console.error(`\n${errors} error(s) found`)
  process.exit(1)
}

console.log(`OK — ${collections.length} entries validated`)
