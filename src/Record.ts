import Tuple from "./Tuple.js";
import Canonical from "./Canonical.js";

export type Recordable = {
  readonly [key: keyof any]: any;
};

const symbolKeyError = "A Symbol cannot be used as a property key in a Record.";

declare namespace Record {
  type Type<T extends Recordable = Recordable> = T & {
    readonly [Canonical.kind]: "record";
  };
}

function Record<T extends Recordable>(obj: T): Record.Type<T> {
  if (Record.isRecord(obj)) return obj;

  if (Object.getOwnPropertySymbols(obj).length > 0)
    throw new TypeError(symbolKeyError);

  return Record.fromEntries(Object.entries(obj)) as Record.Type<T>;
}

type KeysOfUnion<T> = T extends T ? keyof T : never;

type EntriesOf<T> = {
  [Key in Exclude<KeysOfUnion<T>, typeof Canonical.kind>]: Tuple.Type<
    [Key, Extract<T, { [k in Key]?: any }>[Key]]
  >;
}[Exclude<KeysOfUnion<T>, typeof Canonical.kind>][];

Record.entries = <R extends Record.Type>(
  record: R
): Tuple.Type<EntriesOf<R>> => {
  if (!Record.isRecord(record))
    throw new TypeError("Record.entries unexpectedly received a non-record.");

  return Tuple.from(
    Object.entries(record)
      .sort(([a], [b]) => a.localeCompare(b))
      .map((entry) => Tuple.from(entry))
  ) as any;
};

type FromEntries<Entries extends readonly [string, any][]> = {
  [Key in Entries[number][0]]: Extract<Entries[number], [Key, any]>[1];
};

Record.fromEntries = <Entries extends readonly [string, any][]>(
  entries: Entries
): Record.Type<FromEntries<Entries>> => {
  for (const entry of entries)
    if (typeof entry[0] === "symbol") throw new TypeError(symbolKeyError);

  const sorted = [...entries].sort(([a], [b]) => a.localeCompare(b));
  const deduped = sorted.filter(
    (entry, index) =>
      index === sorted.length - 1 || sorted[index + 1]![0] !== entry[0]
  );

  const key = `rec:${deduped
    .map(
      ([k, v]) =>
        `${Canonical.Hash.Segment.text(k)}=${Canonical.Hash.encode(v)}`
    )
    .join(",")}`;

  return Canonical.Cache.ensure(
    "record",
    Canonical.Hash.seal<Record.Type<FromEntries<Entries>>>(key),
    () => Object.fromEntries(deduped) as FromEntries<Entries>
  );
};

Record.isRecord = (maybeRecord: any): maybeRecord is Record.Type =>
  Canonical.kindOf(maybeRecord) === "record";

export default Record;
