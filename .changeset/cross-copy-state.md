---
"record-tuple": minor
---

Interning state is shared across copies of the library in one process (version skew in node_modules, or the cjs/esm dual package loading both formats), through a `globalThis` slot. Structural identity now holds across copies: `copyA.Tuple(1)` equals `copyB.Tuple(1)`, each copy recognizes the other's canonical values, and kind registrations are process-wide. `Canonical.register` is first-wins for an already-registered name, so a second copy auto-registering the same kinds is a no-op; built-in names still throw. The state records the interning protocol version (key encoding, tag vocabulary, mint ritual); a copy with a different protocol throws at load rather than silently minting duplicate canonicals beside the shared ones.
