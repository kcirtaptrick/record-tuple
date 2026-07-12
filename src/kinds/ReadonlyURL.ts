import Canonical from "../Canonical.js";
import { ReadonlyURLSearchParams } from "./ReadonlyURLSearchParams.js";

// Private fields prevent native types from being assignable to the readonly
// types, storing private state externally.
const nativeUrls = new WeakMap<ReadonlyURL, URL>();

const urlOf = (readonly: ReadonlyURL): URL => nativeUrls.get(readonly)!;

namespace URLParts {
  export const assignable = [
    "href",
    "protocol",
    "username",
    "password",
    "host",
    "hostname",
    "port",
    "pathname",
    "search",
    "hash",
  ] as const;
  export const readonly = ["origin"] as const;
  export const all = [...assignable, ...readonly] as const;
}

export interface ReadonlyURL
  extends Readonly<Pick<URL, (typeof URLParts.all)[number]>> {}

export class ReadonlyURL {
  static with(
    url: string | ReadonlyURL,
    replace: { readonly [K in (typeof URLParts.assignable)[number]]?: string }
  ): ReadonlyURL {
    const draft = new URL(String(url));

    for (const part of URLParts.assignable) {
      const value = replace[part];
      if (value !== undefined) draft[part] = value;
    }

    return new ReadonlyURL(draft);
  }

  constructor(url: string | ReadonlyURL, base?: string | ReadonlyURL) {
    const native = new URL(
      String(url),
      base === undefined ? undefined : String(base)
    );

    return Canonical.Cache.ensure(
      "URL",
      Canonical.Hash.seal<ReadonlyURL & { readonly [Canonical.kind]: "URL" }>(
        Canonical.Hash.Segment.kind("URL", native.href)
      ),
      (): ReadonlyURL => {
        nativeUrls.set(this, native);
        return this;
      }
    );
  }

  get searchParams(): ReadonlyURLSearchParams {
    return new ReadonlyURLSearchParams(urlOf(this).search);
  }

  toString(): string {
    return urlOf(this).href;
  }
  toJSON(): string {
    return urlOf(this).href;
  }
}

for (const part of URLParts.all)
  Object.defineProperty(ReadonlyURL.prototype, part, {
    get(this: ReadonlyURL): string {
      return urlOf(this)[part];
    },
  });

// Cannot affect the structural type, must be runtime-only
Object.defineProperty(ReadonlyURL.prototype, Symbol.toStringTag, {
  value: "ReadonlyURL",
});
