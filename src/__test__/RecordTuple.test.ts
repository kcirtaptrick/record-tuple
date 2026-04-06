import { describe, expect, it } from "vitest";
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
    expect(error.message).toBe(
      "Unexpected circular reference encountered."
    );
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
});
