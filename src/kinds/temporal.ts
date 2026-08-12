import { Temporal } from "temporal-polyfill";
import Canonical from "../Canonical.js";

const typeNames = [
  "Instant",
  "ZonedDateTime",
  "PlainDate",
  "PlainDateTime",
  "PlainTime",
  "PlainYearMonth",
  "PlainMonthDay",
  "Duration",
] as const satisfies readonly (keyof typeof Temporal)[];

type TypeName = (typeof typeNames)[number];

export type TemporalShape = {
  [K in TypeName]: {
    from(value: any): { toString(): string };
  };
};

/**
 * Register as:
 *
 *   declare module "record-tuple" {
 *     namespace Canonical {
 *       interface Kinds extends TemporalKinds<typeof Temporal> {}
 *     }
 *   }
 */
export type TemporalKinds<T extends TemporalShape> = {
  [K in TypeName as `Temporal.${K}`]: Canonical.Kind.Of<
    Extract<ReturnType<T[K]["from"]>, object>
  >;
};

export default function registerTemporal(temporal: TemporalShape): void {
  for (const name of typeNames) {
    const type = temporal[name];
    const kind = `Temporal.${name}`;

    Canonical.register(kind, (value) => type.from(value), {
      key: (value) => value.toString(),
    });
  }
}
