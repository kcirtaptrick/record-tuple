import Canonical from "../Canonical.js";

// Private fields prevent native types from being assignable to the readonly
// types, storing private state externally.
const nativeParams = new WeakMap<ReadonlyURLSearchParams, URLSearchParams>();

const paramsOf = (readonly: ReadonlyURLSearchParams): URLSearchParams =>
  nativeParams.get(readonly)!;

const readMethods = [
  "get",
  "getAll",
  "has",
  "keys",
  "values",
  "entries",
  Symbol.iterator,
  "toString",
] as const;

export interface ReadonlyURLSearchParams
  extends Readonly<
    Pick<URLSearchParams & { toString(): string }, (typeof readMethods)[number]>
  > {}

export class ReadonlyURLSearchParams {
  static with(
    params: string | ReadonlyURLSearchParams,
    replace: {
      readonly [name: string]: string | readonly string[] | null | undefined;
    }
  ): ReadonlyURLSearchParams {
    const draft = new URLSearchParams(String(params));

    for (const [name, value] of Object.entries(replace)) {
      if (value === undefined) continue;

      if (typeof value === "string") draft.set(name, value);
      else {
        draft.delete(name);
        for (const each of value ?? []) draft.append(name, each);
      }
    }

    return new ReadonlyURLSearchParams(draft);
  }

  constructor(init?: string | ReadonlyURLSearchParams) {
    const native = new URLSearchParams(init?.toString());

    return Canonical.Cache.ensure(
      "URLSearchParams",
      Canonical.Hash.seal<
        ReadonlyURLSearchParams & {
          readonly [Canonical.kind]: "URLSearchParams";
        }
      >(Canonical.Hash.Segment.kind("URLSearchParams", native.toString())),
      (): ReadonlyURLSearchParams => {
        nativeParams.set(this, native);
        return this;
      }
    );
  }

  get size(): number {
    return paramsOf(this).size;
  }

  forEach(
    callback: (value: string, key: string, parent: ReadonlyURLSearchParams) => void
  ): void {
    for (const [key, value] of paramsOf(this)) callback(value, key, this);
  }
}

for (const method of readMethods)
  Object.defineProperty(ReadonlyURLSearchParams.prototype, method, {
    value(this: ReadonlyURLSearchParams, ...args: never[]) {
      const native = paramsOf(this);
      const fn: (...args: never[]) => unknown = native[method];
      return fn.apply(native, args);
    },
  });

// Cannot affect the structural type, must be runtime-only
Object.defineProperty(ReadonlyURLSearchParams.prototype, Symbol.toStringTag, {
  value: "ReadonlyURLSearchParams",
});
