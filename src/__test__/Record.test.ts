import { describe, expect, it } from "vitest";
import Record from "../Record";
import Canonical from "../Canonical";
import Tuple from "../Tuple";
import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";

setFlagsFromString("--expose_gc");
const gc = runInNewContext("gc");

describe("Record", () => {
  it("Creates record as object", () => {
    expect(Record({})).toEqual({});
    expect(Record({ a: "a", b: "b" })).toEqual({ a: "a", b: "b" });
  });

  it("Provides structural equality with primitive values", () => {
    expect(Record({})).toBe(Record({}));
    expect(Record({ a: "a", b: "b" })).toBe(Record({ a: "a", b: "b" }));
    expect(Record({ a: "a", b: "b" })).not.toBe(Record({ a: "a" }));
    expect(Record({ a: "a", b: "b" })).not.toBe(Record({ a: "a", b: "c" }));
    expect(Record({ a: "a", b: "b" })).not.toBe(Record({ a: "a", c: "b" }));

    const sym = Symbol();
    expect(
      Record({ a: true, b: false, c: 0, d: sym, e: null, f: undefined })
    ).toBe(Record({ a: true, b: false, c: 0, d: sym, e: null, f: undefined }));
  });

  it("Works with own type", () => {
    const record = Record({ a: "a", b: "b" });
    expect(record).toBe(Record(record));
  });

  it("Record.entries", () => {
    expect(Record.entries(Record({ a: "a", b: "b" }))).toBe(
      Tuple(Tuple("a", "a"), Tuple("b", "b"))
    );

    expect(() => {
      // @ts-expect-error
      Record.entries({});
    }).toThrow(TypeError);

    expect(() => {
      // @ts-expect-error
      Record.entries({});
    }).toThrow(/non-record/);
  });

  it("Record.fromEntries", () => {
    expect(
      Record.fromEntries([
        ["b", "b"],
        ["a", "a"],
      ])
    ).toBe(Record({ a: "a", b: "b" }));
  });

  it("Throws error with symbol key", () => {
    expect(() => Record({ [Symbol()]: null })).toThrow(TypeError);
    expect(() => Record({ [Symbol()]: null })).toThrow(/Symbol/);

    // @ts-expect-error
    expect(() => Record.fromEntries([[Symbol(), null]])).toThrow(TypeError);
    // @ts-expect-error
    expect(() => Record.fromEntries([[Symbol(), null]])).toThrow(/Symbol/);
  });

  it("Record.isRecord", () => {
    expect(Record.isRecord(Record({ a: "a", b: "b" }))).toBeTruthy();
    expect(Record.isRecord(Tuple(1, 2, 3))).toBeFalsy();
    expect(Record.isRecord(Record.entries(Record({ a: "a" })))).toBeFalsy();

    expect(Record.isRecord({})).toBeFalsy();
    expect(Record.isRecord(null)).toBeFalsy();
    expect(Record.isRecord(undefined)).toBeFalsy();
    expect(Record.isRecord(42)).toBeFalsy();
    expect(Record.isRecord("string")).toBeFalsy();
    expect(Record.isRecord([])).toBeFalsy();
  });

  it("Has Canonical.kind property", () => {
    const record = Record({ a: "a" });
    expect(record[Canonical.kind]).toBe("record");
  });

  it("Provides nested structural equality", () => {
    expect(Record({ a: Record({ a: "a", b: "b" }), b: 1 })).toBe(
      Record({ a: Record({ a: "a", b: "b" }), b: 1 })
    );
    expect(Record({ a: Record({ a: "a", b: "b" }), b: 1 })).not.toBe(
      Record({ a: Record({ a: "a", b: "c" }), b: 1 })
    );
  });

  it("Ignores property ordering", () => {
    expect(Record({ a: Record({ a: "a", b: "b" }), b: 1 })).toBe(
      Record({ a: Record({ b: "b", a: "a" }), b: 1 })
    );
  });

  it("Creates frozen objects", () => {
    expect(Object.isFrozen(Record({ a: "a", b: "b" }))).toBeTruthy();
    expect(
      Object.isFrozen(Record({ a: Record({ a: "a", b: "b" }) }).a)
    ).toBeTruthy();
  });

  it("Works with tuples", () => {
    expect(Record({ a: Tuple(1, 2, 3) })).toBe(Record({ a: Tuple(1, 2, 3) }));
    expect(Record({ a: Tuple(1, 2, 3) })).toBe(Record({ a: Tuple(1, 2, 3) }));
  });

  it("Record.fromEntries caches by tuple identity", () => {
    const entries = Record.entries(Record({ a: "a", b: "b" }));
    expect(Record.fromEntries(entries)).toBe(Record.fromEntries(entries));
  });

  it("Works as a Map key", () => {
    const map = new Map();
    map.set(Record({ a: "a" }), "value");
    expect(map.get(Record({ a: "a" }))).toBe("value");
  });

  it("Works as a Set entry", () => {
    const set = new Set();
    set.add(Record({ a: "a" }));
    expect(set.has(Record({ a: "a" }))).toBe(true);
    expect(set.size).toBe(1);
  });

  it("Does not hold references", async () => {
    const ref = new WeakRef(Record({ prop: Symbol() }));
    expect(ref.deref() != null).toBeTruthy();

    await new Promise((resolve) => setTimeout(resolve));

    gc();

    expect(ref.deref() == null).toBeTruthy();
  });
});
