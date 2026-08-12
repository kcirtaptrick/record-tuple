import Canonical from "./Canonical.js";

export type Tupleable = readonly any[];

type Tuple<T extends Tupleable = Tupleable> = Tuple.Type<T>;

declare namespace Tuple {
  type Type<T extends Tupleable = Tupleable> = Canonical.Resolved.Mapped<T> & {
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
    Canonical.Hash.seal<T & { readonly [Canonical.kind]: "tuple" }>(key),
    () => items.map((item) => Canonical.resolve(item) ?? item) as unknown as T
  ) as unknown as Tuple.Type<T>;
};

Tuple.isTuple = (maybeTuple: any): maybeTuple is Tuple.Type =>
  Canonical.kindOf(maybeTuple) === "tuple";

export default Tuple;
