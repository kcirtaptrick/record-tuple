---
"record-tuple": minor
---

`RecordTuple.Set` is the Set counterpart of `RecordTuple.Map`. Values intern structurally on the way in, so plain shapes, `Record` and `Tuple` instances, and registered canonical kinds all deduplicate and look up interchangeably, while primitives and functions keep native identity semantics.
