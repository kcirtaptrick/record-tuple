import { describe, expect, it } from "vitest";
import { Temporal } from "temporal-polyfill";
import Canonical from "../Canonical";
import RecordTuple from "../RecordTuple";
import Tuple from "../Tuple";
import registerTemporal from "../kinds/temporal";

registerTemporal(Temporal);

describe("registerTemporal", () => {
  it("containers key Temporal values by value", () => {
    expect(Tuple(1, Temporal.Instant.from("2026-01-01T00:00:00Z"))).toBe(
      Tuple(1, Temporal.Instant.from("2026-01-01T00:00:00Z"))
    );
    expect(Tuple(Temporal.PlainDate.from("2026-01-01"))).not.toBe(
      Tuple(Temporal.PlainDate.from("2026-01-02"))
    );
  });

  it("deep canonicalizes to one tagged, frozen copy", () => {
    const original = Temporal.Instant.from("2026-01-01T00:00:00Z");
    const canonical: any = RecordTuple.deep({ at: original }).at;

    // from() copies, so the caller's instance stays untouched
    expect(canonical).not.toBe(original);
    expect(Canonical.kindOf(canonical)).toBe("Temporal.Instant");
    expect(Object.isFrozen(canonical)).toBe(true);
    expect(Canonical.kindOf(original)).toBeUndefined();
    expect(canonical.toString()).toBe("2026-01-01T00:00:00Z");

    expect(
      RecordTuple.deep({ at: Temporal.Instant.from("2026-01-01T00:00:00Z") }).at
    ).toBe(canonical);
  });

  it("Map lookups hit through equal Temporal keys", () => {
    const map = new RecordTuple.Map();
    map.set(Temporal.PlainDate.from("2026-01-01"), "value");

    expect(map.get(Temporal.PlainDate.from("2026-01-01"))).toBe("value");
    expect(map.get(Temporal.PlainDate.from("2026-01-02"))).toBeUndefined();
  });

  it("distinguishes the same instant in different zones", () => {
    const utc = Temporal.ZonedDateTime.from("2026-01-01T00:00:00+00:00[UTC]");
    const tokyo = utc.withTimeZone("Asia/Tokyo");

    expect(utc.equals(tokyo)).toBe(false);
    expect(Tuple(utc)).not.toBe(Tuple(tokyo));
  });
});
