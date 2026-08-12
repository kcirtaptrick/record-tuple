---
"record-tuple": minor
---

Custom canonical kind type registry

`Canonical.resolve` returned `object | undefined`, and `RecordTuple.deep` typed
a registered instance as a `Record.Type` of its members while returning the
canonical instance at runtime — both `Temporal.PlainDate` and `URL` satisfy
`Recordable`, so they took the wrong branch. `Record.Type` and `Tuple.Type` had
a related gap: both resolve their members as they build, so a `Record` holding a
`URL` actually holds a frozen `ReadonlyURL`, but the type reported the mutable
`URL` and so claimed mutators that are not there.

Augmenting the new `Canonical.Kinds` interface tells TypeScript which kinds
exist, and all of them now report the canonical type:

```ts
import type { URLKinds, TemporalKinds } from "record-tuple/kinds";

declare module "record-tuple" {
  namespace Canonical {
    interface Kinds extends URLKinds, TemporalKinds<typeof Temporal> {
      Money: Money;
    }
  }
}
```

New: `Canonical.Kinds`, `Canonical.Kind.Of`, `Canonical.Resolved`,
`Canonical.Resolved.OrIdentity`, `Canonical.Resolved.Mapped`,
`Canonical.Kinds.KeyFor`, and the `URLKinds` / `TemporalKinds` group types from
`record-tuple/kinds`.

Entirely opt-in and additive: with no augmentation the registry is empty, every
type falls back to its previous form, and runtime behavior is unchanged
throughout. Code that already handled the canonical copy correctly keeps
compiling; code that relied on the old, inaccurate member types for a
companion-class kind — treating `Record({ link: url }).link` as a mutable
`URL` — will now fail to compile, which is the point.
