import { describe, expect, it } from "vitest";
import Record from "../Record";
import Tuple from "../Tuple";
import Canonical from "../Canonical";
import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";

setFlagsFromString("--expose_gc");
const gc = runInNewContext("gc");

describe("Tuple", () => {
  it("Creates tuple as array", () => {
    expect(Tuple()).toEqual([]);
    expect(Tuple()).toBeInstanceOf(Array);
    expect(Tuple(1, 2, 3)).toEqual([1, 2, 3]);
    expect(Tuple(1, 2, 3)).toBeInstanceOf(Array);
  });

  it("Provides structural equality with primitive elements", () => {
    expect(Tuple()).toBe(Tuple());
    expect(Tuple.from([])).toBe(Tuple());
    expect(Tuple(1)).toBe(Tuple(1));
    expect(Tuple("a")).toBe(Tuple("a"));
    expect(Tuple(1)).not.toBe(Tuple(2));
    expect(Tuple(1, 2, 3)).toBe(Tuple(1, 2, 3));
    expect(Tuple.from([1, 2, 3])).toBe(Tuple(1, 2, 3));
    expect(Tuple(1, 2, 3)).not.toBe(Tuple(1, 2));
    expect(Tuple(1, 2, 3)).not.toBe(Tuple(1, 2, 4));

    const sym = Symbol();
    expect(Tuple(true, false, "string", sym, null, undefined)).toBe(
      Tuple(true, false, "string", sym, null, undefined)
    );
  });

  it("Tuple.isTuple", () => {
    expect(Tuple.isTuple(Tuple(1, 2, 3))).toBeTruthy();
    expect(Tuple.isTuple([1, 2, 3])).toBeFalsy();
    expect(
      Tuple.isTuple(Object.assign([1, 2, 3], { isTuple: true }))
    ).toBeFalsy();
    expect(Tuple.isTuple(Record({ a: "a" }))).toBeFalsy();

    expect(Tuple.isTuple(null)).toBeFalsy();
    expect(Tuple.isTuple(undefined)).toBeFalsy();
    expect(Tuple.isTuple(42)).toBeFalsy();
    expect(Tuple.isTuple("string")).toBeFalsy();
    expect(Tuple.isTuple({})).toBeFalsy();
  });

  it("Has Canonical.kind property", () => {
    const tuple = Tuple(1, 2, 3);
    expect(tuple[Canonical.kind]).toBe("tuple");
  });

  it("Provides nested structural equality", () => {
    expect(Tuple(Tuple(1, 2, 3), 4, Tuple(5, 6, 7))).toBe(
      Tuple(Tuple(1, 2, 3), 4, Tuple(5, 6, 7))
    );
    expect(Tuple(Tuple(1, 2, 3), 4, Tuple(5, 6, 7))).not.toBe(
      Tuple(Tuple(1, 2, 4), 4, Tuple(5, 6, 7))
    );
  });

  it("Creates frozen objects", () => {
    expect(Object.isFrozen(Tuple(1, 2, 3))).toBeTruthy();
    expect(Object.isFrozen(Tuple(Tuple(1, 2, 3), 2, 3)[0])).toBeTruthy();
  });

  it("Works with Records", () => {
    expect(Tuple(Record({}))).toBe(Tuple(Record({})));
    expect(Tuple(1, Record({ a: "a", b: "b" }), 2)).toBe(
      Tuple(1, Record({ a: "a", b: "b" }), 2)
    );
  });

  it("Works as a Map key", () => {
    const map = new Map();
    map.set(Tuple(1, 2, 3), "value");
    expect(map.get(Tuple(1, 2, 3))).toBe("value");
  });

  it("Works as a Set entry", () => {
    const set = new Set();
    set.add(Tuple(1, 2, 3));
    expect(set.has(Tuple(1, 2, 3))).toBe(true);
    expect(set.size).toBe(1);
  });

  it("Does not hold references", async () => {
    const ref = new WeakRef(Tuple(Symbol()));
    const dispose = FinalizationRegistry.disposerFor(ref.deref()!);

    expect(ref.deref() != null).toBeTruthy();

    await new Promise((resolve) => setTimeout(resolve));

    gc();
    dispose();

    expect(ref.deref() == null).toBeTruthy();
  });

  it("Finalizer works with cache already removed (Multiple call)", async () => {
    const ref = new WeakRef(Tuple(0, 1, 2, 3, 4, 5, 6, 7, 8, 9));
    const dispose = FinalizationRegistry.disposerFor(ref.deref()!);

    expect(ref.deref() != null).toBeTruthy();

    await new Promise((resolve) => setTimeout(resolve));

    gc();
    dispose();
    dispose();

    expect(ref.deref() == null).toBeTruthy();
  });

  it("Finalizer keeps a key re-interned before collection", async () => {
    const sym = Symbol(); // test-owned key component
    const dispose = (() => {
      const first = Tuple(sym, 1);
      return FinalizationRegistry.disposerFor(first);
    })();

    await new Promise((resolve) => setTimeout(resolve));
    gc(); // first is collected; its registration is now stale

    const second = Tuple(sym, 1); // re-interns the same key
    dispose(); // the stale finalizer fires

    expect(Tuple(sym, 1)).toBe(second);
  });
});
