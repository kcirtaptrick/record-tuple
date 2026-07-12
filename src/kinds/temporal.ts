import Canonical from "../Canonical.js";

const typeNames = [
  "Instant",
  "ZonedDateTime",
  "PlainDate",
  "PlainDateTime",
  "PlainTime",
  "PlainYearMonth",
  "PlainMonthDay",
] as const;

type TemporalShape = {
  [K in (typeof typeNames)[number]]: {
    from(value: any): { toString(): string };
  };
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
