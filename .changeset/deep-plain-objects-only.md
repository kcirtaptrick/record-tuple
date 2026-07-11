---
"record-tuple": major
---

`RecordTuple.deep` (and `RecordTuple.Map`/`Set` key and value resolution) now traverses only arrays and plain objects. Any other object keeps its state where `Object.entries` cannot see it (internal slots, private fields, prototype getters), so traversal previously interned it as an empty record, collapsing distinct values silently; every `Date` became the same `Record({})`, for example. Such values now throw a `TypeError` naming the type and pointing at `Canonical.register`, which is the supported way to intern them by value (or `registerTemporal` for Temporal types). The `foreign` option chooses the policy: `"throw"` (default), `"keep"` for leaf values keyed by reference, or `"traverse"` to intern their own enumerable entries like a plain object.
