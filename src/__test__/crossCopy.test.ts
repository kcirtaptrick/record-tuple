import { describe, expect, it, vi } from "vitest";

// Two copies of the library in one process (version skew in node_modules, or
// the cjs/esm dual package loading both formats) share their interning state
// through the globalThis slot, so structural identity holds across them.
// vi.resetModules() forces a second evaluation of the whole module graph.
const loadTwice = async () => {
  const a = await import("../index");
  vi.resetModules();
  const b = await import("../index");
  expect(b.Tuple).not.toBe(a.Tuple); // really two copies
  return [a, b] as const;
};

describe("cross-copy identity", () => {
  it("two copies share one canonical world", async () => {
    const [a, b] = await loadTwice();

    expect(a.Tuple(1, 2)).toBe(b.Tuple(1, 2));
    expect(a.Record({ x: 1 })).toBe(b.Record({ x: 1 }));
    expect(a.RecordTuple.deep({ q: [1, { r: 2 }] })).toBe(
      b.RecordTuple.deep({ q: [1, { r: 2 }] })
    );

    // each copy recognizes the other's canonicals
    expect(a.Tuple.isTuple(b.Tuple(1))).toBe(true);
    expect(a.Canonical.kindOf(b.Record({ x: 1 }))).toBe("record");
    expect(a.Canonical.resolve(b.Tuple(1))).toBe(b.Tuple(1));

    // nested values from either copy key the same, by shared reference ids
    expect(a.Tuple(1, b.Tuple(2))).toBe(b.Tuple(1, a.Tuple(2)));
  });

  it("kind registrations are shared and idempotent across copies", async () => {
    const [a, b] = await loadTwice();

    class Box {
      constructor(readonly n: number) {}
    }
    const canonicalize = (v: Box) => new Box(v.n);
    const registration = {
      is: (v: unknown): v is Box => v instanceof Box,
      key: (v: Box) => String(v.n),
    };
    a.Canonical.register("test.cross.box", canonicalize, registration);
    // the second copy auto-registering the same name is a no-op
    expect(() =>
      b.Canonical.register("test.cross.box", canonicalize, registration)
    ).not.toThrow();

    expect(a.RecordTuple.deep({ b: new Box(1) }).b).toBe(
      b.RecordTuple.deep({ b: new Box(1) }).b
    );
    expect(b.Canonical.kindOf(a.RecordTuple.deep({ b: new Box(2) }).b)).toBe(
      "test.cross.box"
    );
  });

  it("a Map from one copy serves keys built by the other", async () => {
    const [a, b] = await loadTwice();

    const map = new a.RecordTuple.Map();
    map.set({ k: [1, 2] }, "value");
    expect(map.get(b.RecordTuple.deep({ k: [1, 2] }))).toBe("value");
    expect(map.get(b.Tuple(1))).toBeUndefined();
  });

  it("a protocol mismatch fails at load instead of forking state", async () => {
    const slot = Symbol.for("record-tuple.state");
    const globals = globalThis as { [key: symbol]: unknown };
    const saved = globals[slot];

    globals[slot] = { protocol: 0 };
    vi.resetModules();
    await expect(import("../index")).rejects.toThrow(
      /protocol mismatch: expected 1, found 0/
    );

    globals[slot] = saved;
    vi.resetModules();
  });
});
