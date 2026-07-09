namespace Canonical {
  export const kind: unique symbol = Symbol.for("record-tuple.canonicalKind");

  /**
   * @internal
   */
  export const supportsWeak = typeof WeakRef !== "undefined";

  namespace Ref {
    let nextId = 0;

    // Some engines don't support symbols as weak keys, so we need to use a strong map for them.
    const strongSymbolIds = (() => {
      try {
        new WeakMap().set(Symbol(), 0);
      } catch {
        return new Map<symbol, number>();
      }
    })();

    const weakIds = new WeakMap<WeakKey, number>();

    export function id(value: WeakKey): number {
      const ids = (typeof value === "symbol" && strongSymbolIds) || weakIds;

      const existing = ids.get(value);
      if (existing !== undefined) return existing;

      const id = ++nextId;
      ids.set(value, id);
      return id;
    }
  }

  declare const hash: unique symbol;
  export type Hash<T = unknown> = string & { [hash]: T };
  export namespace Hash {
    export const seal = <T>(key: string): Hash<T> => key as Hash<T>;

    export const encode = <T = unknown>(value: T): Hash<T> => seal(raw(value));

    const raw = (value: unknown): string => {
      switch (typeof value) {
        case "undefined":
          return "und";
        case "boolean":
          return value ? "tru" : "fal";
        case "number":
          return `num:${value}`;
        case "bigint":
          return `bgi:${value}`;
        case "string":
          return `str:${Segment.text(value)}`;
        case "symbol":
          return Hash.Segment.symbol(value);
        default: {
          assert(typeof value === "object" || typeof value === "function");
          if (value === null) return "nul";

          return `ref:${Ref.id(value).toString(36)}`;
        }
      }
    };

    export namespace Segment {
      export const text = (value: string): string =>
        // Freeform strings can contain delimiter characters, the length prefix
        // keeps the full key unique
        `${value.length.toString(36)}:${value}`;

      export const symbol = (value: symbol): Hash<symbol> => {
        const key = Symbol.keyFor(value);
        return seal(
          key ? `sym:${text(key)}` : `ref:${Ref.id(value).toString(36)}`
        );
      };
    }
  }

  export const kindOf = (value: unknown): string | undefined =>
    typeof value === "object" && value !== null && Cache.has(value)
      ? (value as { readonly [kind]: string })[kind]
      : undefined;

  export namespace Cache {
    const cache = new Map<string, WeakRef<object>>();

    const minted = supportsWeak ? new WeakSet<object>() : new Set<object>();

    /** Whether the value is a canonical instance (of any kind). */
    export const has = (value: object): boolean => minted.has(value);

    const finalizer = supportsWeak
      ? new FinalizationRegistry<string>((key) => {
          const ref = cache.get(key);
          if (ref && !ref.deref()) cache.delete(key);
        })
      : undefined;

    export const ensure = <K extends string, T extends object>(
      kind: K,
      key: Hash<T & { readonly [Canonical.kind]: K }>,
      create: () => T
    ): T & { readonly [Canonical.kind]: K } => {
      const existing = cache.get(key);
      if (existing) {
        const value = existing.deref();
        if (value) return value as never;
      }

      const ref = create();
      if (!Object.isExtensible(ref))
        throw new TypeError(
          `Received a non-extensible object for kind "${kind}".`
        );

      Object.defineProperty(ref, Canonical.kind, { value: kind });

      const value = Object.freeze(ref) as T & { readonly [Canonical.kind]: K };
      minted.add(value);
      cache.set(
        key,
        supportsWeak ? new WeakRef(value) : ({ deref: () => value } as never)
      );
      finalizer?.register(value, key);

      return value;
    };
  }
}

export default Canonical;

function assert(value: any, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
