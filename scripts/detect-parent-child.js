import { readFile, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const BASE_URL = 'http://0.0.0.0'
const LEGACY_DIR = new URL('../legacy', import.meta.url).pathname
const OUTPUT_PATH = new URL('../collections.json', import.meta.url).pathname
const MISMATCHES_PATH = new URL('../mismatches.json', import.meta.url).pathname
const MINOR_MISMATCHES_PATH = new URL('../mismatches-minor.json', import.meta.url).pathname
const SAMPLE_SIZE = 3
const DELAY_MS = 50

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchJSON(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' }
  })
  if (!response.ok) throw new Error(`${response.status} for ${url}`)
  return response.json()
}

// Phase 1 — Load all collections
async function loadCollections() {
  const index = JSON.parse(await readFile(join(LEGACY_DIR, 'collections.json'), 'utf8'))
  const symbolToName = new Map(index.map(entry => [entry.symbol, entry.name]))

  const files = await readdir(join(LEGACY_DIR, 'collections'))
  const collections = []

  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const symbol = file.replace('.json', '')
    const name = symbolToName.get(symbol) || symbol

    const items = JSON.parse(await readFile(join(LEGACY_DIR, 'collections', file), 'utf8'))
    const ids = items.map(item => item.id)

    collections.push({ symbol, name, ids })
  }

  console.log(`Loaded ${collections.length} collections`)
  return collections
}

// Phase 2 — Detect parent/child via sampling
async function detectParentChild(collections) {
  const detected = []
  let checked = 0

  for (const collection of collections) {
    checked++
    const sampleIds = pickRandom(collection.ids, SAMPLE_SIZE)
    const parentIds = new Set()
    const perInscriptionParents = []
    let isParentChild = false

    for (const id of sampleIds) {
      try {
        const data = await fetchJSON(`${BASE_URL}/inscription/${id}`)

        if (data.parents && data.parents.length > 0) {
          isParentChild = true
          perInscriptionParents.push(new Set(data.parents))
          for (const parentId of data.parents) parentIds.add(parentId)
        }
      } catch (error) {
        console.error(`  Error fetching ${id}: ${error.message}`)
      }

      await sleep(DELAY_MS)
    }

    if (isParentChild) {
      // Determine merge strategy: if all samples share the same parents, use intersect.
      // If samples have different parents, children are distributed → use union.
      const allSameParents = perInscriptionParents.length > 1 &&
        perInscriptionParents.every(set =>
          set.size === perInscriptionParents[0].size &&
          [...set].every(id => perInscriptionParents[0].has(id))
        )
      const mergeStrategy = parentIds.size > 1 && !allSameParents ? 'union' : 'intersect'

      console.log(`  [${checked}/${collections.length}] ${collection.name} — PARENT/CHILD (${parentIds.size} parent${parentIds.size > 1 ? 's' : ''}${mergeStrategy === 'union' ? ', distributed' : ''})`)
      detected.push({
        ...collection,
        parentIds: [...parentIds],
        mergeStrategy
      })
    } else {
      if (checked % 50 === 0) {
        console.log(`  [${checked}/${collections.length}] scanning...`)
      }
    }
  }

  console.log(`\nDetected ${detected.length} parent/child collections out of ${collections.length}`)
  return detected
}

function pickRandom(array, count) {
  const shuffled = [...array].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

// Phase 3 — Verify detected collections against API children
async function verifyCollections(detected) {
  const verified = []

  for (const collection of detected) {
    console.log(`\nVerifying: ${collection.name}`)

    const childSets = []

    for (const parentId of collection.parentIds) {
      const children = await fetchAllChildren(parentId)
      console.log(`  Parent ${parentId.slice(0, 12)}... has ${children.size} children`)
      childSets.push(children)
    }

    let apiChildren
    if (childSets.length === 1) {
      apiChildren = childSets[0]
    } else if (collection.mergeStrategy === 'union') {
      apiChildren = union(childSets)
      console.log(`  Unioned ${childSets.length} parent sets → ${apiChildren.size} total children`)
    } else {
      apiChildren = intersect(childSets)
      console.log(`  Intersected ${childSets.length} parent sets → ${apiChildren.size} shared children`)
    }

    const fileIds = new Set(collection.ids)
    const inFileNotApi = [...fileIds].filter(id => !apiChildren.has(id))
    const inApiNotFile = [...apiChildren].filter(id => !fileIds.has(id))

    if (inFileNotApi.length > 0) {
      console.log(`  MISMATCH: ${inFileNotApi.length} IDs in file but NOT in API children`)
      for (const id of inFileNotApi.slice(0, 5)) {
        console.log(`    - ${id}`)
      }
      if (inFileNotApi.length > 5) console.log(`    ... and ${inFileNotApi.length - 5} more`)
    }

    if (inApiNotFile.length > 0) {
      console.log(`  Note: ${inApiNotFile.length} IDs in API but not in file (expected)`)
    }

    if (inFileNotApi.length === 0) {
      console.log(`  OK — all ${fileIds.size} file IDs confirmed as children`)
    }

    verified.push({
      name: collection.name,
      type: 'parent',
      ids: collection.parentIds,
      slug: collection.symbol,
      mismatchCount: inFileNotApi.length,
      inFileNotApi,
      inApiNotFile
    })
  }

  return verified
}

async function fetchAllChildren(parentId) {
  const children = new Set()
  let page = 0
  let more = true

  while (more) {
    const data = await fetchJSON(`${BASE_URL}/children/${parentId}/${page}`)
    for (const id of data.ids) children.add(id)
    more = data.more
    page++
    await sleep(DELAY_MS)
  }

  return children
}

function intersect(sets) {
  if (sets.length === 0) return new Set()
  const result = new Set(sets[0])
  for (let i = 1; i < sets.length; i++) {
    for (const item of result) {
      if (!sets[i].has(item)) result.delete(item)
    }
  }
  return result
}

function union(sets) {
  const result = new Set()
  for (const set of sets) {
    for (const item of set) result.add(item)
  }
  return result
}

// Write output
async function writeOutput(verified) {
  const output = verified.map(({ name, type, ids, slug }) => ({
    name,
    type,
    ids,
    slug
  }))

  output.sort((a, b) => a.name.localeCompare(b.name))
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n')
  console.log(`\nWrote ${output.length} entries to collections.json`)

  const allMismatches = verified
    .filter(v => v.inFileNotApi.length > 0 || v.inApiNotFile.length > 0)
    .map(({ name, slug, ids, inFileNotApi, inApiNotFile }) => ({
      name,
      slug,
      parentIds: ids,
      inFileNotApi,
      inApiNotFile
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const minor = allMismatches.filter(m => m.inFileNotApi.length > 0 && m.inFileNotApi.length < 10)
  const rest = allMismatches.filter(m => m.inFileNotApi.length === 0 || m.inFileNotApi.length >= 10)

  await writeFile(MISMATCHES_PATH, JSON.stringify(rest, null, 2) + '\n')
  console.log(`Wrote ${rest.length} mismatch entries to mismatches.json`)

  await writeFile(MINOR_MISMATCHES_PATH, JSON.stringify(minor, null, 2) + '\n')
  console.log(`Wrote ${minor.length} minor mismatch entries to mismatches-minor.json`)
}

// Main
async function main() {
  console.log('Phase 1: Loading collections...')
  const collections = await loadCollections()

  console.log('\nPhase 2: Detecting parent/child collections...')
  const detected = await detectParentChild(collections)

  console.log('\nPhase 3: Verifying detected collections...')
  const verified = await verifyCollections(detected)

  await writeOutput(verified)

  const mismatches = verified.filter(v => v.mismatchCount > 0)
  if (mismatches.length > 0) {
    console.log(`\n=== MISMATCH SUMMARY ===`)
    for (const m of mismatches) {
      console.log(`  ${m.name}: ${m.mismatchCount} IDs in file but not in API children`)
    }
  } else {
    console.log('\nAll detected collections verified successfully!')
  }
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
