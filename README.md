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
    "name": "Dia De Pixales",
    "type": "parent",
    "ids": ["681b5373c03e3f819231afd9227f54101395299c9e58356bda278e2f32bef2cdi0"],
    "slug": "dia-de-pixales"
  },
  {
    "name": "The Wizards of Ord",
    "type": "gallery",
    "id": "aaaaaaaa...i0",
    "slug": "wizards-of-ord"
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
