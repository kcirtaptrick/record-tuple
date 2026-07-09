import Canonical from "./Canonical.js";

export type Tupleable = readonly any[];

type Tuple<T extends Tupleable = Tupleable> = Tuple.Type<T>;

declare namespace Tuple {
  type Type<T extends Tupleable = Tupleable> = T & {
    readonly [Canonical.kind]: "tuple";
  };
}

function Tuple<T extends Tupleable>(...items: T) {
  return Tuple.from(items);
}

Tuple.from = <const T extends Tupleable>(items: T): Tuple.Type<T> => {
  const key = `tup:${items
    .map((item) => Canonical.Hash.encode(item))
    .join(",")}`;

  return Canonical.Cache.ensure(
    "tuple",
    Canonical.Hash.seal<Tuple.Type<T>>(key),
    () => [...items] as T
  );
};

Tuple.isTuple = (maybeTuple: any): maybeTuple is Tuple.Type =>
  Canonical.kindOf(maybeTuple) === "tuple";

export default Tuple;
