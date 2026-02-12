### Ordinals Collections

Curated on-chain data of Ordinals collections.

### Data Format

Each entry includes:

- **name**: collection name
- **type**: `gallery` or `parent/child`
- **id** or **ids**: gallery uses a single `id`, parent/child uses an `ids` array
- **slug**: URL-friendly identifier for the collection

**Example**

```json
[
  {
    "name": "Quantum Cats",
    "type": "parent",
    "ids": ["0e383b8af3e7f8767bc9ec0a48fbf837d82b0d537f4dbc7a8853e6828112ea41i0"],
    "slug": "quantum_cats"
  },
  {
    "name": "The Wizards of Ord",
    "type": "gallery",
    "id": "b8a6c9e946f0beaa9cbb4d6cc9f9388ae71d0f93c0215b8a85595db69949e64ci0",
    "slug": "wizards"
  }
]
```

### How to Create Galleries

- [ord/ord](https://github.com/ordinals/ord)
Ordinals reference client
- [The Wizards of Ord Inscriber](https://inscribe.dev)
Supports creating galleries from the common marketplace collection JSON file

### Inclusion Criteria

- **Galleries**: The list of Inscription IDs must exactly match the collection data on the most popular ordinals marketplace at the time.
- **Parent(s)/child**: All children must share the same parent(s).
- **Traits**: If included, they should closely resemble the marketplace trait data.  

### Updates

All updates must be requested through a PR.

### Credits

Joint initiative by **The Wizards of Ord**
