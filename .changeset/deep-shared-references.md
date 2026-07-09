---
"record-tuple": minor
---

`RecordTuple.deep` no longer throws `CircularReferenceError` for shared, non-circular references. Cycle detection tracks the traversal path only, so an object reachable along several paths interns normally, and only an ancestor reappearing beneath itself is treated as circular. A duplicate-reference cache keeps chains of shared subtrees linear instead of exponential.
