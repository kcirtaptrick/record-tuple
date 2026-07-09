---
"record-tuple": major
---

Rewrite interning as a flat hash-consed cache, replacing the per-element trie.

- Interning a value now costs one cache entry, one key string, and one WeakRef, with no interior trie nodes. Measured on 100k unique nested records, retained memory drops from about 534MB to 174MB and construction time from about 1457ms to 540ms.
- Finalizers hold only the cache key string, never a copy of the items. A liveness check on cleanup replaces the trie's generation counters.
- Breaking: `Symbol.isTuple` and `Symbol.isRecord` are removed. Canonical values carry one shared tag, `Canonical.kind` (registered via `Symbol.for`), whose value is the kind name, `"tuple"` or `"record"`. `Tuple.isTuple` and `Record.isRecord` are unchanged and remain the supported checks, and `Canonical.kindOf(value)` returns the verified kind of any canonical value.
- Breaking behavior fix: `Record.fromEntries` with duplicated keys now upholds structural equality. `Record.fromEntries([["a", 1], ["a", 2]])` equals `Record({ a: 2 })`, with the last occurrence winning as in `Object.fromEntries`. Previously it minted a distinct record keyed by the raw entry list.
