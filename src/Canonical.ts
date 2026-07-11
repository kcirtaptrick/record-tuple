namespace Canonical {
  export const kind: unique symbol = Symbol.for("record-tuple.canonicalKind");

  /**
   * @internal
   */
  export const supportsWeak = typeof WeakRef !== "undefined";

  // Error on incompatible state protocols
  const protocol = 1;

  type State = {
    protocol: number;
    nextId: number;
    refIds: WeakMap<WeakKey, number>;
    // Fallback for engines that reject symbols as weak keys
    symbolIds: Map<symbol, number> | undefined;
    kinds: Map<string, Kind.Registration>;
    cache: Map<string, WeakRef<object>>;
    minted: WeakSet<object> | Set<object>;
  };

  // Shared state for cross-version compaibility
  const state: State = (() => {
    const globals = globalThis as { [key: symbol]: State | undefined };
    const slot = Symbol.for("record-tuple.state");

    const existing = globals[slot];
    if (existing) {
      if (existing.protocol !== protocol)
        throw new TypeError(
          `record-tuple protocol mismatch: expected ${protocol}, found ${existing.protocol}. Ensure all record-tuple copies in this process are compatible versions.`
        );
      return existing;
    }

    return (globals[slot] = {
      protocol,
      nextId: 0,
      refIds: new WeakMap(),
      symbolIds: (() => {
        try {
          new WeakMap().set(Symbol(), 0);
          return undefined;
        } catch {
          return new Map<symbol, number>();
        }
      })(),
      kinds: new Map(),
      cache: new Map(),
      minted: supportsWeak ? new WeakSet<object>() : new Set<object>(),
    });
  })();

  export namespace Kind {
    export interface Registration<
      T extends object = object,
      Copy extends object = T
    > {
      is(value: unknown): value is T;
      /**
       * The kind-specific identity of a value. A key should correspond to
       * exactly one shape. Runs on both raw values and canonical copies, so it
       * should read only what the two share.
       */
      key(value: T | Copy): string;
      /**
       * Return a copy of the value to prevent caching monkey patches and
       * prevent input mutation. It is tagged with its kind and frozen, must be
       * extensible.
       */
      canonicalize(value: T): Copy;
    }

    export namespace Registration {
      export const find = (
        value: object
      ): readonly [string, Kind.Registration] | undefined => {
        const tag = (value as { [kind]?: unknown })[kind];
        if (typeof tag === "string" && builtIn.includes(tag)) return;
        for (const kind of state.kinds) if (kind[1].is(value)) return kind;
      };
    }
  }

  const tagOf = (value: unknown) =>
    (value as { [Symbol.toStringTag]?: unknown })?.[Symbol.toStringTag];

  const builtIn = ["tuple", "record"];

  export function register<T extends object, Copy extends object = T>(
    kind: string | (abstract new (...args: never[]) => T),
    canonicalize: (value: T) => Copy,
    registration: {
      // Strings represent string tags
      is?: string | readonly string[] | Kind.Registration<T>["is"];
      key(value: T | Copy): string;
    }
  ): void {
    const name = typeof kind === "string" ? kind : tagOf(kind.prototype);

    if (typeof name !== "string")
      throw new TypeError(
        "Cannot derive a kind name: the constructor's prototype has no string Symbol.toStringTag. Define one or pass the kind name explicitly."
      );

    if (builtIn.includes(name))
      throw new TypeError(
        `"${name}" is a built-in canonical kind and cannot be re-registered.`
      );

    if (state.kinds.has(name)) return;

    const is = registration.is ?? name;

    const tags = [is].flat();
    state.kinds.set(name, {
      ...registration,
      canonicalize,
      is:
        typeof is === "function"
          ? is
          : (value): value is T => tags.includes(tagOf(value) as string),
    });
  }

  namespace Ref {
    export function id(value: WeakKey): number {
      const ids =
        (typeof value === "symbol" && state.symbolIds) || state.refIds;

      const existing = ids.get(value);
      if (existing !== undefined) return existing;

      const id = ++state.nextId;
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

          const found = Kind.Registration.find(value);
          if (!found) return `ref:${Ref.id(value).toString(36)}`;

          const [name, registration] = found;
          return Segment.kind(name, registration.key(value));
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

      export const kind = (
        name: string,
        key: string
      ): Hash<object & { readonly [Canonical.kind]: string }> =>
        seal(`knd:${text(name)}${text(key)}`);
    }
  }

  export const kindOf = (value: unknown): string | undefined =>
    typeof value === "object" && value !== null && Cache.has(value)
      ? (value as { readonly [kind]: string })[kind]
      : undefined;

  export const resolve = (value: unknown): object | undefined => {
    if (!value || (typeof value !== "object" && typeof value !== "function"))
      return;

    if (Cache.has(value)) return value;

    const found = Kind.Registration.find(value);
    if (!found) return;

    const [name, of] = found;

    return Cache.ensure(name, Hash.Segment.kind(name, of.key(value)), () =>
      of.canonicalize(value)
    );
  };

  export namespace Cache {
    export const has = (value: object): boolean => state.minted.has(value);

    const finalizer = supportsWeak
      ? new FinalizationRegistry<string>((key) => {
          const ref = state.cache.get(key);
          if (ref && !ref.deref()) state.cache.delete(key);
        })
      : undefined;

    export const ensure = <K extends string, T extends object>(
      kind: K,
      key: Hash<T & { readonly [Canonical.kind]: K }>,
      create: () => T
    ): T & { readonly [Canonical.kind]: K } => {
      const existing = state.cache.get(key);
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
      state.minted.add(value);
      state.cache.set(
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
