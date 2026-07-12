import Canonical from "../Canonical.js";
import { ReadonlyURLSearchParams } from "./ReadonlyURLSearchParams.js";
import { ReadonlyURL } from "./ReadonlyURL.js";

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
