---
"record-tuple": minor
---

`Canonical.register(kind, canonicalize, { is, key })` adds structural identity for types whose state lives in internal slots, where `Object.entries` reads nothing. Temporal types are the motivating case.

- `kind` is a constructor or a kind name. The constructor form reads the name from the prototype's `Symbol.toStringTag` and infers the value type from the construct signature, so `Canonical.register(Money, (value) => new Money(value.cents), { key })` needs no explicit type argument; a missing or non-string tag throws. The string form remains for registrations with no constructor to read a tag from, like the Temporal registrations.
- Detection defaults to `Symbol.toStringTag`: pass one tag string or an array of them as `is`, or omit it to match the kind name itself. Predicates remain available for anything richer.
- `canonicalize` produces the copy that is cached, tagged with its kind, and frozen. The caller's instance is never adopted, so monkey patches stay local. It may return a companion class of the registered type (the `ReadonlyURL` pattern), inferred as a second type parameter on `Kind.Registration`. `key` runs on canonical copies as well as raw values, so it should read only what the two share.
- Containers store the canonical copy of registered members and key them by value, so `Tuple(1, instant)` equals a tuple built from an equal instant.
- `RecordTuple.deep` and `RecordTuple.Map` keys canonicalize registered values instead of traversing them.
- `Canonical.resolve(value)` returns already-canonical values of any kind as themselves and resolves registered-kind values to their canonical instance.
