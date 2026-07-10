import { describe, expect, expectTypeOf, it } from "vitest";
import Record from "../Record";
import RecordTuple from "../RecordTuple";
import Tuple from "../Tuple";

describe("RecordTuple", () => {
  it("Creates Record or Tuple", () => {
    expect(RecordTuple([])).toBe(Tuple());
    expect(RecordTuple({})).toBe(Record({}));
    expect(RecordTuple({})).toBe(RecordTuple({}));

    expect(RecordTuple([1, 2, 3])).toBe(Tuple(1, 2, 3));
    expect(RecordTuple({ a: "a", b: "b" })).toBe(Record({ a: "a", b: "b" }));
    expect(RecordTuple({ a: "a", b: "b" })).toBe(
      RecordTuple({ a: "a", b: "b" })
    );
  });

  it(".deep: Empty", () => {
    expect(RecordTuple.deep([])).toBe(Tuple());
    expect(RecordTuple.deep({})).toBe(Record({}));
  });

  it(".deep: Basic", () => {
    expect(RecordTuple.deep([])).toBe(Tuple());
    expect(RecordTuple.deep({})).toBe(Record({}));

    expect(RecordTuple.deep([1, 2, 3])).toBe(Tuple(1, 2, 3));
    expect(RecordTuple.deep({ a: "a", b: "b" })).toBe(
      Record({ a: "a", b: "b" })
    );
  });

  it(".deep: Tuple nesting", () => {
    expect(RecordTuple.deep([1, [2, 3], [4, [5, 6]]] as const)).toBe(
      Tuple(1, Tuple(2, 3), Tuple(4, Tuple(5, 6)))
    );
    expect(RecordTuple.deep([[[[[]]]]])).toBe(
      Tuple(Tuple(Tuple(Tuple(Tuple()))))
    );
    expect(RecordTuple.deep([[[]]])).not.toBe(Tuple(Tuple(Tuple(Tuple()))));
  });

  it(".deep: Record nesting", () => {
    expect(
      RecordTuple.deep({ a: { b: {} }, c: { d: { e: { f: "g" } } } })
    ).toBe(
      Record({
        a: Record({ b: Record({}) }),
        c: Record({ d: Record({ e: Record({ f: "g" }) }) }),
      })
    );
    expect(
      RecordTuple.deep({ a: { b: {} }, c: { d: { e: { f: "g" } } } })
    ).not.toBe(
      Record({
        a: Record({ b: Record({}) }),
        c: Record({ d: Record({ e: Record({ f: 1 }) }) }),
      })
    );
  });

  it(".deep: Mixed nesting", () => {
    expect(
      RecordTuple.deep({
        a: { b: [1, 2, 3] },
        c: { d: { e: { f: [1, [2, 3]] } } },
      })
    ).toBe(
      Record({
        a: Record({ b: Tuple(1, 2, 3) }),
        c: Record({ d: Record({ e: Record({ f: Tuple(1, Tuple(2, 3)) }) }) }),
      })
    );
    expect(
      RecordTuple.deep([
        { a: "a", b: "b" },
        { c: "c", d: "d" },
      ])
    ).toBe(Tuple(Record({ a: "a", b: "b" }), Record({ c: "c", d: "d" })));
  });

  it(".deep: Non-serializables", () => {
    const fn = () => {};
    const symbol = Symbol();

    expect(
      RecordTuple.deep({
        fn,
        symbol,
      })
    ).toBe(
      Record({
        fn,
        symbol,
      })
    );
  });

  it(".deep: Stops at record or tuple", () => {
    const shouldNotChangeReference = {
      some: { deep: { object: "value" } },
    };

    expect(
      RecordTuple.deep({
        record: Record({ prop: shouldNotChangeReference }),
        tuple: Tuple(shouldNotChangeReference),
      })
    ).toBe(
      Record({
        record: Record({ prop: shouldNotChangeReference }),
        tuple: Tuple(shouldNotChangeReference),
      })
    );
  });

  it(".deep: Throws TypeError for non-object input", () => {
    // @ts-expect-error
    expect(() => RecordTuple.deep(null)).toThrow(TypeError);
    // @ts-expect-error
    expect(() => RecordTuple.deep(42)).toThrow(TypeError);
    // @ts-expect-error
    expect(() => RecordTuple.deep("string")).toThrow(TypeError);
    // @ts-expect-error
    expect(() => RecordTuple.deep(undefined)).toThrow(TypeError);
  });

  it(".deep: Preserves falsy primitives", () => {
    expect(RecordTuple.deep([null, 0, false, ""])).toBe(
      Tuple(null, 0, false, "")
    );
    expect(RecordTuple.deep({ a: null, b: 0, c: false, d: "" })).toBe(
      Record({ a: null, b: 0, c: false, d: "" })
    );
  });

  it("CircularReferenceError is a TypeError with correct properties", () => {
    const error = new RecordTuple.CircularReferenceError();
    expect(error).toBeInstanceOf(TypeError);
    expect(error.name).toBe("CircularReferenceError");
    expect(error.message).toBe("Unexpected circular reference encountered.");
  });

  it(".deep: Circular reference", () => {
    {
      const circular: any = {};
      circular.self = circular;

      expect(() => RecordTuple.deep(circular)).toThrow(
        RecordTuple.CircularReferenceError
      );
    }
    {
      const circular: any = { a: { b: [{ c: [] }] } };
      circular.a.b[0].c.push(circular);

      expect(() => RecordTuple.deep(circular)).toThrow(
        RecordTuple.CircularReferenceError
      );
    }
  });

  it(".deep: Shared references are not circular", () => {
    {
      const shared = { a: "a" };
      expect(RecordTuple.deep({ x: shared, y: shared })).toBe(
        RecordTuple.deep({ x: { a: "a" }, y: { a: "a" } })
      );
    }
    {
      const leaf = [1, 2];
      expect(RecordTuple.deep([leaf, [leaf], { leaf }])).toBe(
        RecordTuple.deep([[1, 2], [[1, 2]], { leaf: [1, 2] }])
      );
    }
    {
      let node: any = { n: 0 };
      for (let i = 1; i <= 40; i++) node = { n: i, left: node, right: node };
      expect(RecordTuple.deep(node)).toBe(RecordTuple.deep(node));
    }
  });

  it(".deep: Sibling-shared values still detect true cycles", () => {
    const circular: any = { self: null };
    circular.self = circular;

    expect(() => RecordTuple.deep({ a: circular, b: circular })).toThrow(
      RecordTuple.CircularReferenceError
    );
  });

  it(".Map: Looks up structurally equal keys", () => {
    const map = new RecordTuple.Map();

    map.set({ a: 1 }, "object");
    map.set([1, 2, 3], "array");
    map.set({ a: [1, { b: 2 }] }, "mixed");

    expect(map.get({ a: 1 })).toBe("object");
    expect(map.get([1, 2, 3])).toBe("array");
    expect(map.get({ a: [1, { b: 2 }] })).toBe("mixed");

    expect(map.get(Record({ a: 1 }))).toBe("object");
    expect(map.get(Tuple(1, 2, 3))).toBe("array");

    expect(map.has({ a: 1 })).toBe(true);
    expect(map.has({ a: 2 })).toBe(false);
    expect(map.size).toBe(3);
  });

  it(".Map: Overwrites structurally equal keys", () => {
    const map = new RecordTuple.Map();

    map.set({ a: 1 }, "first");
    map.set(Record({ a: 1 }), "second");

    expect(map.size).toBe(1);
    expect(map.get({ a: 1 })).toBe("second");
  });

  it(".Map: Interns keys on construction", () => {
    const map = new RecordTuple.Map([
      [{ a: 1 }, "object"],
      [[1, 2], "array"],
    ]);

    expect(map.get({ a: 1 })).toBe("object");
    expect(map.get([1, 2])).toBe("array");
    expect([...map.keys()]).toEqual([Record({ a: 1 }), Tuple(1, 2)]);
    expect([...map.keys()][0]).toBe(Record({ a: 1 }));
    expect([...map.keys()][1]).toBe(Tuple(1, 2));
  });

  it(".Map: Deletes by structural key", () => {
    const map = new RecordTuple.Map<[{ a: number }, string]>([
      [{ a: 1 }, "value"],
    ]);

    expect(map.delete({ a: 2 })).toBe(false);
    expect(map.delete({ a: 1 })).toBe(true);
    expect(map.size).toBe(0);
  });

  it(".Map: Keys non-objects by identity", () => {
    const map = new RecordTuple.Map();
    const fn = () => {};

    map.set(1, "number");
    map.set("key", "string");
    map.set(null, "null");
    map.set(undefined, "undefined");
    map.set(fn, "function");

    expect(map.get(1)).toBe("number");
    expect(map.get("key")).toBe("string");
    expect(map.get(null)).toBe("null");
    expect(map.get(undefined)).toBe("undefined");
    expect(map.get(fn)).toBe("function");
    expect(map.get(() => {})).toBe(undefined);
  });

  it(".Map: Throws for circular keys", () => {
    const map = new RecordTuple.Map();
    const circular: any = {};
    circular.self = circular;

    expect(() => map.set(circular, "value")).toThrow(
      RecordTuple.CircularReferenceError
    );
  });

  it(".Map: Narrows value type by key", () => {
    const map = new RecordTuple.Map<
      [{ type: "a" }, number] | [{ type: "b" }, string]
    >([
      [{ type: "a" }, 1],
      [{ type: "b" }, "two"],
    ]);

    const a = map.get({ type: "a" });
    const b = map.get({ type: "b" });

    expectTypeOf(a).toEqualTypeOf<number | undefined>();
    expectTypeOf(b).toEqualTypeOf<string | undefined>();
    expect(a).toBe(1);
    expect(b).toBe("two");

    expectTypeOf(map.get(Record({ type: "a" }))).toEqualTypeOf<
      number | undefined
    >();
    expect(map.get(Record({ type: "a" }))).toBe(1);

    const wide = map.get({ type: "a" } as { type: "a" } | { type: "b" });
    expectTypeOf(wide).toEqualTypeOf<number | string | undefined>();

    map.set({ type: "a" }, 2);
    expect(map.get({ type: "a" })).toBe(2);

    // @ts-expect-error Wrong value type for key
    map.set({ type: "a" }, "one");
    // @ts-expect-error Key is not in the entry union
    map.get({ type: "c" });
  });

  it(".Map: Narrows entries on iteration", () => {
    const map = new RecordTuple.Map<["a", number] | ["b", string]>([
      ["a", 1],
      ["b", "two"],
    ]);

    for (const [key, value] of map) {
      if (key === "a") expectTypeOf(value).toEqualTypeOf<number>();
      if (key === "b") expectTypeOf(value).toEqualTypeOf<string>();
    }

    expect([...map.entries()]).toEqual([
      ["a", 1],
      ["b", "two"],
    ]);
  });

  it(".Map: Uniform value type with a single entry pair", () => {
    const map = new RecordTuple.Map<[{ kind: string; id: number }, string]>([
      [{ kind: "user", id: 1 }, "Ada"],
    ]);

    expect(map.get({ kind: "user", id: 1 })).toBe("Ada");
    expectTypeOf(map.get({ kind: "user", id: 1 })).toEqualTypeOf<
      string | undefined
    >();

    map.set({ kind: "user", id: 2 }, "Grace");
    expect(map.get({ kind: "user", id: 2 })).toBe("Grace");
    expect(map.has({ kind: "post", id: 1 })).toBe(false);

    // @ts-expect-error Value must be a string
    map.set({ kind: "user", id: 3 }, 3);
    // @ts-expect-error Key must have kind and id
    map.get({ kind: "user" });
  });

  it(".Map: Rejects a non-entries type argument", () => {
    // @ts-expect-error The type argument must be a union of entry pairs
    new RecordTuple.Map<{ a: number }>();
    // @ts-expect-error Every member of the union must be an entry pair
    new RecordTuple.Map<[{ a: number }, string] | { b: number }>();
  });

  it(".Map: Works in generic code", () => {
    function wrap<K, V>() {
      return new RecordTuple.Map<[K, V]>();
    }

    const map = wrap<{ a: number }, string>();
    map.set({ a: 1 }, "x");
    expect(map.get({ a: 1 })).toBe("x");
    expectTypeOf(map.get({ a: 1 })).toEqualTypeOf<string | undefined>();
  });

  it(".Map: Tuple keys", () => {
    const map = new RecordTuple.Map<[[number, number], string]>([
      [[1, 2], "point"],
    ]);

    expect(map.get([1, 2])).toBe("point");
    expectTypeOf(map.get([1, 2])).toEqualTypeOf<string | undefined>();
  });

  it(".Map: Infers literal entries from constructor", () => {
    const map = new RecordTuple.Map([
      [{ type: "a" }, 1],
      [{ type: "b" }, "two"],
    ]);

    expectTypeOf(map.get({ type: "a" })).toEqualTypeOf<1 | undefined>();
    expectTypeOf(map.get({ type: "b" })).toEqualTypeOf<"two" | undefined>();
    expect(map.get({ type: "a" })).toBe(1);
    expect(map.get({ type: "b" })).toBe("two");
  });

  it(".Set: Dedupes structurally equal values", () => {
    const set = new RecordTuple.Set();

    set.add({ a: 1 });
    set.add(Record({ a: 1 }));
    set.add([1, 2, 3]);
    set.add(Tuple(1, 2, 3));
    set.add({ a: [1, { b: 2 }] });
    set.add({ a: [1, { b: 2 }] });

    expect(set.size).toBe(3);
    expect(set.has({ a: 1 })).toBe(true);
    expect(set.has([1, 2, 3])).toBe(true);
    expect(set.has({ a: [1, { b: 2 }] })).toBe(true);
    expect(set.has({ a: 2 })).toBe(false);
  });

  it(".Set: Interns values on construction", () => {
    const set = new RecordTuple.Set([{ a: 1 }, [1, 2]]);

    expect([...set]).toEqual([Record({ a: 1 }), Tuple(1, 2)]);
    expect([...set][0]).toBe(Record({ a: 1 }));
    expect([...set][1]).toBe(Tuple(1, 2));
  });

  it(".Set: Deletes by structural value", () => {
    const set = new RecordTuple.Set<{ a: number }>([{ a: 1 }]);

    expect(set.delete({ a: 2 })).toBe(false);
    expect(set.delete({ a: 1 })).toBe(true);
    expect(set.size).toBe(0);
  });

  it(".Set: Holds non-objects by identity", () => {
    const fn = () => {};
    const set = new RecordTuple.Set([1, "value", null, undefined, fn] as const);

    expect(set.has(1)).toBe(true);
    expect(set.has("value")).toBe(true);
    expect(set.has(null)).toBe(true);
    expect(set.has(undefined)).toBe(true);
    expect(set.has(fn)).toBe(true);
    expect(set.size).toBe(5);
  });

  it(".Set: Throws for circular values", () => {
    const set = new RecordTuple.Set();
    const circular: any = {};
    circular.self = circular;

    expect(() => set.add(circular)).toThrow(RecordTuple.CircularReferenceError);
  });
});
