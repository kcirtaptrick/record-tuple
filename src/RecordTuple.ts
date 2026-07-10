import Canonical from "./Canonical.js";
import Record, { Recordable } from "./Record.js";
import Tuple, { Tupleable } from "./Tuple.js";

namespace RecordTuple {
  export type Input = Recordable | Tupleable;
  export type Result<T extends Input> = T extends any[]
    ? Tuple.Type<T>
    : Record.Type<T>;
}

function RecordTuple<T extends RecordTuple.Input>(input: T) {
  return (
    Array.isArray(input) ? Tuple.from(input) : Record(input)
  ) as RecordTuple.Result<T>;
}

namespace RecordTuple {
  export namespace deep {
    type DeepMap<T extends Tupleable> = T extends Tuple.Type
      ? T
      : T extends readonly [infer Item, ...infer Rest]
      ? [Item extends Input ? Result<Item> : Item, ...DeepMap<Rest>]
      : T[number] extends never
      ? T
      : T[number] extends Input
      ? Result<T[number]>[]
      : T;
    type DeepRecord<T extends Recordable> = T extends Record.Type
      ? T
      : Record.Type<{
          [Key in keyof T]: T[Key] extends Input ? Result<T[Key]> : T[Key];
        }>;
    export type Result<T extends Input> = T extends Tupleable
      ? Tuple.Type<DeepMap<T>>
      : DeepRecord<T>;
  }

  export function deep<T extends RecordTuple.Input>(
    input: T
  ): RecordTuple.deep.Result<T> {
    if (!input || typeof input !== "object")
      throw new TypeError(
        `Expected input to be an object or array, got \`${input}\``
      );

    const path = new globalThis.Set();
    // Non-circular duplicate reference cache
    const refCache = new globalThis.Map();

    return (function next(value = input): any {
      if (path.has(value)) throw new RecordTuple.CircularReferenceError();

      const resolved = refCache.get(value) || Canonical.resolve(value);
      if (resolved) return resolved;

      path.add(value);

      const result = Array.isArray(value)
        ? Tuple.from(
            value.map(
              (item) => item && (typeof item === "object" ? next(item) : item)
            )
          )
        : Record.fromEntries(
            Object.entries(value).map(([k, v]) => [
              k,
              v && (typeof v === "object" ? next(v) : v),
            ])
          );

      path.delete(value);
      refCache.set(value, result);

      return result;
    })();
  }

  export class CircularReferenceError extends TypeError {
    name = "CircularReferenceError";

    constructor(message = "Unexpected circular reference encountered.") {
      super(message);
    }
  }

  export class Map<
    const E extends Map.Entry = Map.Entry
  > extends globalThis.Map<E[0], E[1]> {
    constructor(entries?: Iterable<E> | null) {
      super();
      if (entries)
        for (const [key, value] of entries) this.set(key, value as never);
    }

    private resolveKey(key: unknown): any {
      return key && typeof key === "object" ? deep(key as Input) : key;
    }

    get<Key extends E[0]>(key: Key): Map.Value<E, Key> | undefined {
      return super.get(this.resolveKey(key)) as Map.Value<E, Key> | undefined;
    }

    set<Key extends E[0]>(key: Key, value: Map.Value<E, Key>): this {
      return super.set(this.resolveKey(key), value);
    }

    has(key: E[0]): boolean {
      return super.has(this.resolveKey(key));
    }

    delete(key: E[0]): boolean {
      return super.delete(this.resolveKey(key));
    }

    entries() {
      return super.entries() as MapIterator<Map.Pair<E>>;
    }

    [Symbol.iterator]() {
      return super[Symbol.iterator]() as MapIterator<Map.Pair<E>>;
    }
  }

  export namespace Map {
    export type Entry = readonly [unknown, unknown];

    export type Value<E extends Entry, Key> = E extends unknown
      ? Key extends E[0]
        ? E[1]
        : E[0] extends Key
        ? E[1]
        : never
      : never;

    export type Pair<E extends Entry> = E extends unknown
      ? [E[0], E[1]]
      : never;
  }

  export class Set<const T = unknown> extends globalThis.Set<T> {
    constructor(values?: Iterable<T> | null) {
      super();
      if (values) for (const value of values) this.add(value);
    }

    private resolveValue(value: unknown): any {
      return value && typeof value === "object" ? deep(value as Input) : value;
    }

    add(value: T): this {
      return super.add(this.resolveValue(value));
    }

    has(value: T): boolean {
      return super.has(this.resolveValue(value));
    }

    delete(value: T): boolean {
      return super.delete(this.resolveValue(value));
    }
  }
}

export default RecordTuple;
