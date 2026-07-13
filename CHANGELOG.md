# record-tuple

## 3.0.0

### Major Changes

- 850e558: `RecordTuple.deep` (and `RecordTuple.Map`/`Set` key and value resolution) now traverses only arrays and plain objects. Any other object keeps its state where `Object.entries` cannot see it (internal slots, private fields, prototype getters), so traversal previously interned it as an empty record, collapsing distinct values silently; every `Date` became the same `Record({})`, for example. Such values now throw a `TypeError` naming the type and pointing at `Canonical.register`, which is the supported way to intern them by value (or `registerTemporal` for Temporal types). The `foreign` option chooses the policy: `"throw"` (default), `"keep"` for leaf values keyed by reference, or `"traverse"` to intern their own enumerable entries like a plain object.
- c6aefe9: Rewrite interning as a flat hash-consed cache, replacing the per-element trie.

  - Interning a value now costs one cache entry, one key string, and one WeakRef, with no interior trie nodes. Measured on 100k unique nested records, retained memory drops from about 534MB to 174MB and construction time from about 1457ms to 540ms.
  - Finalizers hold only the cache key string, never a copy of the items. A liveness check on cleanup replaces the trie's generation counters.
  - Breaking: `Symbol.isTuple` and `Symbol.isRecord` are removed. Canonical values carry one shared tag, `Canonical.kind` (registered via `Symbol.for`), whose value is the kind name, `"tuple"` or `"record"`. `Tuple.isTuple` and `Record.isRecord` are unchanged and remain the supported checks, and `Canonical.kindOf(value)` returns the verified kind of any canonical value.
  - Breaking behavior fix: `Record.fromEntries` with duplicated keys now upholds structural equality. `Record.fromEntries([["a", 1], ["a", 2]])` equals `Record({ a: 2 })`, with the last occurrence winning as in `Object.fromEntries`. Previously it minted a distinct record keyed by the raw entry list.

### Minor Changes

- 1230d91: `Canonical.register(kind, canonicalize, { is, key })` adds structural identity for types whose state lives in internal slots, where `Object.entries` reads nothing. Temporal types are the motivating case.

  - `kind` is a constructor or a kind name. The constructor form reads the name from the prototype's `Symbol.toStringTag` and infers the value type from the construct signature, so `Canonical.register(Money, (value) => new Money(value.cents), { key })` needs no explicit type argument; a missing or non-string tag throws. The string form remains for registrations with no constructor to read a tag from, like the Temporal registrations.
  - Detection defaults to `Symbol.toStringTag`: pass one tag string or an array of them as `is`, or omit it to match the kind name itself. Predicates remain available for anything richer.
  - `canonicalize` produces the copy that is cached, tagged with its kind, and frozen. The caller's instance is never adopted, so monkey patches stay local. It may return a companion class of the registered type (the `ReadonlyURL` pattern), inferred as a second type parameter on `Kind.Registration`. `key` runs on canonical copies as well as raw values, so it should read only what the two share.
  - Containers store the canonical copy of registered members and key them by value, so `Tuple(1, instant)` equals a tuple built from an equal instant.
  - `RecordTuple.deep` and `RecordTuple.Map` keys canonicalize registered values instead of traversing them.
  - `Canonical.resolve(value)` returns already-canonical values of any kind as themselves and resolves registered-kind values to their canonical instance.

- 9cefe0a: Interning state is shared across copies of the library in one process (version skew in node_modules, or the cjs/esm dual package loading both formats), through a `globalThis` slot. Structural identity now holds across copies: `copyA.Tuple(1)` equals `copyB.Tuple(1)`, each copy recognizes the other's canonical values, and kind registrations are process-wide. `Canonical.register` is first-wins for an already-registered name, so a second copy auto-registering the same kinds is a no-op; built-in names still throw. The state records the interning protocol version (key encoding, tag vocabulary, mint ritual); a copy with a different protocol throws at load rather than silently minting duplicate canonicals beside the shared ones.
- b598ff2: `RecordTuple.deep` no longer throws `CircularReferenceError` for shared, non-circular references. Cycle detection tracks the traversal path only, so an object reachable along several paths interns normally, and only an ancestor reappearing beneath itself is treated as circular. A duplicate-reference cache keeps chains of shared subtrees linear instead of exponential.
- 77d589b: New `record-tuple/kinds` entry point with opt-in canonical-kind registrations, kept out of the core export:

  - `registerTemporal(Temporal)` registers Instant, ZonedDateTime, PlainDate, PlainDateTime, PlainTime, PlainYearMonth, and PlainMonthDay. Call it once with whichever implementation the application uses; detection is by Symbol.toStringTag, and identity follows each type's toString(), which agrees with its equals(). Duration is excluded because it has no equals() without a relativeTo.
  - `registerURL()` registers URL and URLSearchParams. URLs key by href; search params key by their serialized string, where insertion order is meaningful. The canonical copies are `ReadonlyURL` and `ReadonlyURLSearchParams`, so the shared canonical values cannot drift from their cache keys the way the mutable originals could.
  - `ReadonlyURL` is also usable directly, an immutable URL built by composition rather than subclassing. The relationship mirrors `Array` and `ReadonlyArray`. A `URL` is assignable to `ReadonlyURL`, while `ReadonlyURL` is not assignable to `URL`, so the readonly guarantee cannot be cast away, and the mutators do not exist at the type level or at runtime. searchParams returns a `ReadonlyURLSearchParams` (reads only), and `new URL(readonly.href)` makes a mutable copy. Both readonly classes intern on construction, like Tuple and Record: `new ReadonlyURL(x) === new ReadonlyURL(x)`. `ReadonlyURL.with(url, { pathname, hash, ... })` returns a copy with the given components replaced; it is a static rather than an instance method so `URL` stays assignable to `ReadonlyURL`. `ReadonlyURLSearchParams.with(params, { page: "2", filter: null })` does the same for entries: a string or array replaces all of the name's values, null deletes the name, and undefined leaves it unchanged.
  - Self-interning constructors have core support any class can use: `Canonical.Cache.ensure` adopts an already-canonical instance returned from its create callback, which is what lets a constructor intern the object it is constructing. The README's Self-interning classes section shows the pattern.

- bfdb2fe: `RecordTuple.Set` is the Set counterpart of `RecordTuple.Map`. Values intern structurally on the way in, so plain shapes, `Record` and `Tuple` instances, and registered canonical kinds all deduplicate and look up interchangeably, while primitives and functions keep native identity semantics.

## 2.2.0

### Minor Changes

- 38a9e37: RecordTuple.Map

## 2.1.0

### Minor Changes

- 7d5f84d: Extract from kcirtaptrick/js-packages
- acfe66f: Migrate to vitest and tsdown

## 2.0.1

### Patch Changes

- 90c08fdf: Tuple.from const type argument

## 2.0.0

### Major Changes

- c1a301f1: Change `Record` type to `Record.Type` to avoid overriding first-party `Record`

### Minor Changes

- fea11bc4: Circular reference detection

### Patch Changes

- 664cc929: Construct errors at failure site

## 1.3.6

### Patch Changes

- fcf3ac9c: Fix target references

## 1.3.5

### Patch Changes

- d71249f8: Support CommonJS, bundle with Rollup

## 1.3.4

### Patch Changes

- 83b072ee: Fix exports field

## 1.3.3

### Patch Changes

- f890600e: Add exports field

## 1.3.2

### Patch Changes

- 7d1b650: Iterative tuple resolution

## 1.3.1

### Patch Changes

- ccccf78: Remove ??= syntax

## 1.3.0

### Minor Changes

- d0036f8: RecordTuple.deep stops at record or tuple
  isTuple and isRecord symbols were unset, this is no longer the case

## 1.2.0

### Minor Changes

- 0b1ad53: Use symbols instead of type branding

### Patch Changes

- be13075: Finalizer tests

## 1.1.1

### Patch Changes

- d1d2b3e: Improved types for Record.entries and Record.fromEntries

## 1.1.0

### Minor Changes

- 913f864: Tuple.from, Record.entries, Record.fromEntries

### Patch Changes

- 913f864: Add Record return type
- 913f864: No longer expose caches
- 913f864: Record creation with symbol key throws

## 1.0.2

### Patch Changes

- Fix finalizer generation logic

## 1.0.1

### Patch Changes

- Fix imports

## 1.0.0

### Major Changes

- 4dbc80c: Allow for garbage collection

### Minor Changes

- 7277b9d: Added RecordTuple: Generic immutable data structure factory
