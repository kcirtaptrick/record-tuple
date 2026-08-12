import Canonical from "../Canonical.js";
import { ReadonlyURLSearchParams } from "./ReadonlyURLSearchParams.js";
import { ReadonlyURL } from "./ReadonlyURL.js";
/**
 * Register as:
 *
 *   declare module "record-tuple" {
 *     namespace Canonical {
 *       interface Kinds extends URLKinds {}
 *     }
 *   }
 */
export type URLKinds = {
  URL: Canonical.Kind.Of<URL | ReadonlyURL, ReadonlyURL>;
  URLSearchParams: Canonical.Kind.Of<
    URLSearchParams | ReadonlyURLSearchParams,
    ReadonlyURLSearchParams
  >;
};

export default function registerURL(): void {
  Canonical.register(URL, (value) => new ReadonlyURL(value.href), {
    is: ["URL", "ReadonlyURL"],
    key: (value) => value.href,
  });

  Canonical.register(
    URLSearchParams,
    (value) => new ReadonlyURLSearchParams(value.toString()),
    {
      is: ["URLSearchParams", "ReadonlyURLSearchParams"],
      key: (value) => value.toString(),
    }
  );
}
