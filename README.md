# Record & Tuple

[Lightweight](https://bundlephobia.com/package/record-tuple), typed implementation of the [Records and Tuples proposal](https://github.com/tc39/proposal-record-tuple). A superset of the proposal's standard library, covering everything the proposal specifies plus structural `Map`/`Set` collections, deep conversion, and canonical kinds, which let class instances like `Temporal` and `URL` compare by value.

- [Installation](#installation)
- [Basic Usage](#basic-usage)
  - [Why Tuple/Record.Type?](#why-tuplerecordtype)
- [RecordTuple](#recordtuple)
  - [RecordTuple.Map](#recordtuplemap)
  - [RecordTuple.Set](#recordtupleset)
  - [Foreign objects](#foreign-objects)
- [Canonical kinds](#canonical-kinds)
  - [Temporal](#temporal)
  - [URL](#url)
  - [ReadonlyURL and ReadonlyURLSearchParams](#readonlyurl-and-readonlyurlsearchparams)
- [Custom kinds](#custom-kinds)
  - [Typing resolved values](#typing-resolved-values)
  - [Mutable types](#mutable-types)
  - [Self-interning classes](#self-interning-classes)
- [Memory](#memory)
- [Version compatibility](#version-compatibility)

## Installation

```
npm install record-tuple
```

## Basic Usage

```ts
import { Tuple, Record } from "record-tuple";

// Returns native data structures
JSON.stringify(Tuple(1, 2, 3)); // "[1, 2, 3]"
JSON.stringify(Record({ a: "a", b: "b" })); // '{"a":"a","b":"b"}'

// Structural equality
Tuple(1, 2, 3) === Tuple(1, 2, 3); // true
Record({ a: "a", b: "b" }) === Record({ a: "a", b: "b" }); // true

// Records ignore property order
Record({ a: "a", b: "b" }) === Record({ b: "b", a: "a" }); // true
JSON.stringify(Record({ b: "b", a: "a" })); // '{"a":"a","b":"b"}'

// As Map/Set keys
const map = new Map();

map.set(Tuple(1, 2, 3), "value 1");
map.set(Record({ a: "a" }), "value 2");

map.get(Tuple(1, 2, 3)); // "value 1"
map.get(Record({ a: "a" })); // "value 2"

// Types
const tuple: Tuple.Type<[number, number]> = Tuple(1, 2);
// @ts-expect-error
const tuple: Tuple.Type<[number, number]> = [1, 2];
// @ts-expect-error
const tuple: Tuple.Type<[number, number]> = Tuple(1, 2, 3);

const record: Record.Type<{ a: string }> = Record({ a: "a" });
// @ts-expect-error
const record: Record.Type<{ a: string }> = { a: "a" };
// @ts-expect-error
const record: Record.Type<{ a: string }> = Record({ b: "b" });
```

### Why Tuple/Record.Type?

We want to avoid overriding Typescript's first-party `Record` type. We use `Tuple.Type` for consistency, but will continue to provide a `Tuple<...>` alias for convenience.

## RecordTuple

`RecordTuple` allows for generic immutable data structure creation.\
`RecordTuple.deep` does the same, but deeply.

```ts
import { RecordTuple, Tuple, Record } from "record-tuple";

RecordTuple([1, 2, 3]) === Tuple(1, 2, 3);
RecordTuple({ a: "a", b: "b" }) === Record({ a: "a", b: "b" });

RecordTuple.deep([
  { a: "a", b: "b" },
  { c: "c", d: "d" },
]) === Tuple(Record({ a: "a", b: "b" }), Record({ c: "c", d: "d" }));
```

Cycles throw `RecordTuple.CircularReferenceError`.

`deep` converts arrays and plain objects only. Anything else (a `Date`, a
class instance) throws by default rather than convert incorrectly. See
[Foreign objects](#foreign-objects) for why and the opt-in policies.

### RecordTuple.Map

A `Map` with structural keys, so any structurally equal key finds the same
entry.
Keys are converted with `RecordTuple.deep`. Non-object keys behave like they
do in a native `Map`.

```ts
import { RecordTuple, Record } from "record-tuple";

const map = new RecordTuple.Map();

map.set({ a: 1 }, "value");

map.get({ a: 1 }); // "value"
map.get(Record({ a: 1 })); // "value"
```

The type argument is a union of `[Key, Value]` entry pairs. One pair types a
uniform map:

```ts
const scores = new RecordTuple.Map<[{ id: number }, number]>();

scores.set({ id: 1 }, 100);
scores.get({ id: 1 }); // number | undefined
```

With multiple pairs, `get` narrows the value type by key:

```ts
const map = new RecordTuple.Map<
  [{ type: "a" }, number] | [{ type: "b" }, string]
>();

map.get({ type: "a" }); // number | undefined
map.get({ type: "b" }); // string | undefined
```

Constructor entries are inferred with literal types, so lookup tables narrow
without annotations:

```ts
const statuses = new RecordTuple.Map([
  [{ code: 200 }, "ok"],
  [{ code: 404 }, "not found"],
]);

statuses.get({ code: 200 }); // "ok" | undefined
```

### RecordTuple.Set

The `Set` counterpart, where structurally equal values count as one member.

```ts
const set = new RecordTuple.Set();

set.add({ a: 1 });

set.has({ a: 1 }); // true
set.has(Record({ a: 1 })); // true
set.size; // 1
```

### Foreign objects

`deep` converts arrays and plain objects. Many other objects keep their state
where `Object.entries` cannot see it: a `Date` stores its timestamp
internally, a class instance may use private fields or getters. Converting
them property by property would silently collapse distinct values into the
same empty record. Every `Date` would become `Record({})` and distinct times
would compare equal. By default `deep` throws instead.

A type that represents a value (a `Temporal` type, a `URL`, a class of your
own) is best registered as a [canonical kind](#canonical-kinds), since
registered instances convert by value and never reach this policy. For
everything else, the `foreign` option decides what `deep` does:

```ts
// throw (default)
RecordTuple.deep({ at: new Date(0) });
// TypeError: deep() traverses only arrays and plain objects by default; ...

// keep: foreign objects stay as leaf values, compared by reference
RecordTuple.deep({ at: new Date(0) }, { foreign: "keep" });

// traverse: own enumerable entries convert like a plain object
class Point {
  constructor(public x: number, public y: number) {}
}
RecordTuple.deep({ p: new Point(1, 2) }, { foreign: "traverse" }).p ===
  Record({ x: 1, y: 2 }); // true
```

`RecordTuple.Map` and `Set` resolve keys with the default policy.

## Canonical kinds

Canonical kinds extend value identity to class instances. A registration
tells the internals which instances of a type count as equal, and those
instances then behave the way Tuples and Records do: containers holding equal instances
are identical, `RecordTuple.Map` and `Set` treat them as one key, and `deep`
converts them rather than throwing. Registrations for `Temporal` and `URL`
ship in the `record-tuple/kinds` entry point, kept out of the core bundle.

### Temporal

```ts
import { registerTemporal } from "record-tuple/kinds";
import { Temporal } from "temporal-polyfill"; // or the built-in global

registerTemporal(Temporal);

Record({ on: Temporal.PlainDate.from("2026-07-12") }) ===
  Record({ on: Temporal.PlainDate.from("2026-07-12") }); // true
```

Call it once at startup with whichever implementation the application uses.
The parameter is structurally typed, so the library has no Temporal
dependency. It registers `Instant`, `ZonedDateTime`, `PlainDate`,
`PlainDateTime`, `PlainTime`, `PlainYearMonth`, and `PlainMonthDay`, with
identity following each type's `toString()`, which agrees with its `equals()`.
`Duration` is excluded because it has no `equals()` without a `relativeTo`.

### URL

```ts
import { registerURL, ReadonlyURL } from "record-tuple/kinds";

registerURL();

Tuple(new URL("https://example.com/a?b=1")) ===
  Tuple(new URL("https://example.com/a?b=1")); // true
```

A URL's identity is its `href`, already normalized by the `URL` constructor.
Search params take theirs from their serialized string, where insertion order
matters, so `a=1&b=2` and `b=2&a=1` stay distinct. Stored members
are readonly copies (`ReadonlyURL`, `ReadonlyURLSearchParams`), because equal
URLs share a single instance and that instance must be immutable. The `URL`
you passed in stays untouched and mutable.

### ReadonlyURL and ReadonlyURLSearchParams

Both classes stand on their own as immutable counterparts of `URL` and
`URLSearchParams`. Construction automatically returns canonical references, as
with `Tuple` and `Record`, so equal inputs produce the same instance.

```ts
import { ReadonlyURL, ReadonlyURLSearchParams } from "record-tuple/kinds";

const url = new ReadonlyURL("https://example.com/a?b=1");

url === new ReadonlyURL("https://example.com/a?b=1"); // true
url.pathname; // "/a"
url.searchParams.get("b"); // "1"

// @ts-expect-error href is readonly (and the instance is frozen)
url.href = "https://example.com/x";
```

The relationship mirrors `Array` and `ReadonlyArray`. A `URL` is assignable
to `ReadonlyURL`, while `ReadonlyURL` is not assignable back, so the readonly
guarantee cannot be cast away. The mutators do not
exist, in the types or at runtime.

Immutable updates go through the static `with`:

```ts
ReadonlyURL.with(url, { pathname: "/c", hash: "#h" });
// "https://example.com/c?b=1#h"

// a string or array replaces all of the name's values,
// null deletes the name, undefined leaves it unchanged
const params = new ReadonlyURLSearchParams("page=1&tag=a&tag=b&draft=1");
ReadonlyURLSearchParams.with(params, {
  page: "2",
  tag: ["c", "d"],
  draft: null,
});
// "page=2&tag=c&tag=d"
```

Use `new URL(readonly.href)` to make a mutable copy.

## Custom kinds

`Canonical.register` accepts new kinds. A registration has three parts: how to
produce the canonical copy (`canonicalize`, 2nd argument), how to recognize a
raw instance (`is`), the string key that serves as its identity (`key`).

```ts
import { Canonical, Tuple } from "record-tuple";

class Money {
  constructor(readonly amount: number, readonly currency: string) {}
  get [Symbol.toStringTag]() {
    return "Money";
  }
}

Canonical.register(Money, (value) => new Money(value.amount, value.currency), {
  key: (value) => `${value.currency}:${value.amount}`,
});

Tuple(new Money(5, "USD")) === Tuple(new Money(5, "USD")); // true
```

Passing the constructor reads the kind name from the prototype's
`Symbol.toStringTag` (the example's getter) and infers the value type. Make
sure the tag is defined and choose it deliberately. It becomes the kind name,
the default detection tag, and the value's `Object.prototype.toString` output,
so it should name your type unambiguously. The string form,
`Canonical.register("Money", ...)`, remains for registrations with no
constructor to read from, like the Temporal registrations
(`"Temporal.PlainDate"`, ...).

Recognition (`is`) defaults to matching `Symbol.toStringTag` against the kind
name, which the example's getter provides. An explicit tag, an array of tags
(`is: ["URL", "ReadonlyURL"]`), and a predicate
(`is: (value) => value instanceof Money`) are also accepted. Tag detection keeps working across
copies of the library and across realms (iframes, workers, vm contexts),
where `instanceof` breaks.

The contracts:

- `key` returns exactly one string per distinct value. Equal keys mean the
  same canonical instance.
- `canonicalize` returns a fresh copy, never the caller's instance, so monkey
  patches and later mutations stay with the caller. The copy is tagged with
  its kind and frozen, and a non-extensible return is refused.

`Canonical.kindOf` reports the verified kind of a canonical value (the tag
property can be faked, so `kindOf` also checks that the value was created by the
library). `Canonical.resolve` maps a raw registered instance to its canonical
copy:

```ts
Canonical.kindOf(Tuple(1)); // "tuple"
Canonical.kindOf(new Money(5, "USD")); // undefined (raw, not canonical)

const canonical = Canonical.resolve(new Money(5, "USD"));
Canonical.kindOf(canonical); // "Money"
```

### Typing resolved values

Registering a kind happens at runtime, so type registration must happen separately.
Augment `Canonical.Kinds` with an entry per kind, mapping its name to the type
it interns:

```ts
declare module "record-tuple" {
  namespace Canonical {
    interface Kinds {
      Money: Money;
    }
  }
}

// all four below are now Money & { [Canonical.kind]: "Money" }
Canonical.resolve(new Money(5, "USD"));
RecordTuple.deep({ price: new Money(5, "USD") }).price;
Record({ price: new Money(5, "USD") }).price;
Tuple(new Money(5, "USD"))[0];
```

The built-in kinds ship preset groups. Combine them with a comma:

```ts
import { registerTemporal, registerURL } from "record-tuple/kinds";
import type { TemporalKinds, URLKinds } from "record-tuple/kinds";
import { Temporal } from "temporal-polyfill";

registerTemporal(Temporal);
registerURL();

declare module "record-tuple" {
  namespace Canonical {
    interface Kinds extends URLKinds, TemporalKinds<typeof Temporal> {}
  }
}
```

When multiple types resolve to one canonical type:

```ts
interface Kinds {
  URL: Canonical.Kind.Of<URL | ReadonlyURL, ReadonlyURL>;
}
```

### Mutable types

Freezing the canonical copy is only enough when the type's state lives in own
properties. A type like `URL` keeps its state internal and its mutators
(`url.href = ...`, `params.set(...)`) on the prototype, so even a frozen
instance can still change, and a cached value that changes no longer matches
its key. Canonicalize such a type into a readonly companion class instead, one
that exposes the readers and nothing else. Register the native constructor and
list both tags in `is`, so raw and readonly instances intern to the same
value:

```ts
Canonical.register(URL, (value) => new ReadonlyURL(value.href), {
  is: ["URL", "ReadonlyURL"],
  key: (value) => value.href,
});
```

The copy type is inferred from `canonicalize`'s return, which is why it is its
own argument ahead of the rest. Once the copy type is known, `key`'s value is
typed to accept raw natives and canonical copies alike. The typing reflects
the contract that `key` runs on both, so it should only read what the two
share, which is exactly what the companion class exposes.

This is `registerURL()` verbatim. `ReadonlyURL` and `ReadonlyURLSearchParams` in
`record-tuple/kinds` are the reference implementations of the companion-class
pattern.

### Self-interning classes

A class can make `new` return the canonical instance by returning
`Canonical.Cache.ensure` from its constructor, the way `ReadonlyURL` and
`ReadonlyURLSearchParams` do (a constructor that returns an object overrides
`this`). On a cache hit the half-built `this` is discarded in favor of the
existing instance; on a miss `this` is tagged, frozen, and cached:

```ts
class Money {
  constructor(readonly amount: number, readonly currency: string) {
    return Canonical.Cache.ensure(
      "Money",
      Canonical.Hash.seal<Money & { readonly [Canonical.kind]: "Money" }>(
        Canonical.Hash.Segment.kind("Money", `${currency}:${amount}`)
      ),
      (): Money => this
    );
  }
}

new Money(5, "USD") === new Money(5, "USD"); // true
```

A registration's `canonicalize` can construct such a class. `ensure` notices
the result is already canonical and returns it as is. Keep the constructor's
key and the registration's `key` in sync so the two never disagree.

## Memory

Interning deduplicates. Equal values share one instance, so repetitive data
often costs less than its plain-object equivalent. Each distinct value costs
its frozen instance plus one cache entry, an encoded key string and a
`WeakRef`.

The cache purges unreferenced values. A canonical value the program no longer
references is garbage collected like any other object, and a
`FinalizationRegistry` then removes its cache entry. Cleanup runs after
collection rather than immediately, so entries for dead values can linger
briefly, and creating many short-lived values is fine.

On engines without `WeakRef` and `FinalizationRegistry`, the cache falls back
to strong references and interned values live for the lifetime of the
process.

## Version compatibility

Starting with 3.0.0, all interning state lives in a `globalThis` slot, so
multiple copies of the
library in one process (version skew in node_modules, the cjs and esm builds
loading side by side) share it. `copyA.Tuple(1) === copyB.Tuple(1)`, every
copy recognizes the others' canonical values, and kind registrations are
process-wide, first-wins for duplicate names. The state records an interning
protocol version, and a copy that has an incompatible protocol throws at
load rather than silently creating duplicate canonical values beside the
shared ones.
