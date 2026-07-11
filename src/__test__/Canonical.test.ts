import { describe, expect, it } from "vitest";
import Canonical from "../Canonical";
import Record from "../Record";
import RecordTuple from "../RecordTuple";
import Tuple from "../Tuple";

class Box {
  #value: number;
  constructor(value: number) {
    this.#value = value;
  }
  get value() {
    return this.#value;
  }
}

Canonical.register("test.box", (value: Box) => new Box(value.value), {
  is: (value): value is Box => value instanceof Box,
  key: (value) => String(value.value),
});

describe("Canonical", () => {
  it("deep interns equal registered values to one canonical instance", () => {
    const a = RecordTuple.deep({ at: new Box(1) });
    const b = RecordTuple.deep({ at: new Box(1) });
    expect(a).toBe(b);
    expect(a.at).toBeInstanceOf(Box);
    expect(RecordTuple.deep({ at: new Box(2) })).not.toBe(a);
  });

  it("containers key registered values by value, not by reference", () => {
    expect(Tuple(1, new Box(5))).toBe(Tuple(1, new Box(5)));
    expect(Record({ at: new Box(5) })).toBe(Record({ at: new Box(5) }));
    expect(Tuple(new Box(5))).not.toBe(Tuple(new Box(6)));
    // unregistered objects keep reference identity
    const plain = { value: 1 };
    expect(Tuple(plain)).toBe(Tuple(plain));
    expect(Tuple({ value: 1 })).not.toBe(Tuple(plain));
  });

  it("Map lookups hit through equal-valued registered keys", () => {
    const map = new RecordTuple.Map();
    map.set(new Box(9), "value");
    expect(map.get(new Box(9))).toBe("value");
    expect(map.get(new Box(8))).toBeUndefined();
    map.set({ at: new Box(9) }, "nested");
    expect(map.get({ at: new Box(9) })).toBe("nested");
  });

  it("never adopts the caller's instance: the canonical copy is fresh, tagged, frozen", () => {
    const original: any = new Box(3);
    original.monkeyPatched = true; // must never leak into the shared canonical
    const canonical: any = RecordTuple.deep({ at: original }).at;

    expect(canonical).not.toBe(original);
    expect(canonical.monkeyPatched).toBeUndefined();
    expect(canonical[Canonical.kind]).toBe("test.box");
    expect(Object.isFrozen(canonical)).toBe(true);

    // the caller's instance stays theirs: untagged, unfrozen
    expect(original[Canonical.kind]).toBeUndefined();
    expect(Object.isFrozen(original)).toBe(false);

    expect(RecordTuple.deep({ at: new Box(3) }).at).toBe(canonical);
  });

  it("refuses a canonicalize that returns a non-extensible instance", () => {
    class Sealed {
      constructor(readonly n: number) {}
    }
    Canonical.register(
      "test.sealed",
      (value: Sealed) => Object.freeze(new Sealed(value.n)),
      {
        is: (value): value is Sealed => value instanceof Sealed,
        key: (value) => String(value.n),
      }
    );

    expect(() => RecordTuple.deep({ s: new Sealed(1) })).toThrow(
      /non-extensible object/
    );
  });

  it("re-registration is first-wins; built-in names are refused", () => {
    const conflicting = {
      is: (v: unknown): v is Box => v instanceof Box,
      key: () => "conflict",
    };
    // The registry is process-wide and shared across copies of the
    // library, so a second registration of the same name (a second copy
    // loading) is a no-op and the original keeps governing.
    expect(() =>
      Canonical.register("test.box", (v: Box) => v, conflicting)
    ).not.toThrow();
    expect(RecordTuple.deep({ b: new Box(5) }).b).toBe(
      RecordTuple.deep({ b: new Box(5) }).b
    );
    for (const name of ["tuple", "record"])
      expect(() =>
        Canonical.register(name, (v: Box) => v, conflicting)
      ).toThrow(/built-in/);
  });

  it("register detects by Symbol.toStringTag: the kind name by default, or given tags", () => {
    class Note {
      constructor(readonly text: string) {}
    }
    Object.defineProperty(Note.prototype, Symbol.toStringTag, {
      value: "test.note",
    });
    // is omitted: the kind name itself is the tag
    Canonical.register<Note>("test.note", (value) => new Note(value.text), {
      key: (value) => value.text,
    });
    const note = RecordTuple.deep({ n: new Note("a") }).n;
    expect(Canonical.kindOf(note)).toBe("test.note");
    expect(RecordTuple.deep({ n: new Note("a") }).n).toBe(note);

    // an array of tags: any of them matches
    class Label {
      constructor(readonly text: string) {}
    }
    Object.defineProperty(Label.prototype, Symbol.toStringTag, {
      value: "test.label.alias",
    });
    Canonical.register<Label>("test.label", (value) => new Label(value.text), {
      is: ["test.label", "test.label.alias"],
      key: (value) => value.text,
    });
    expect(Canonical.kindOf(RecordTuple.deep({ l: new Label("x") }).l)).toBe(
      "test.label"
    );
  });

  it("register accepts a constructor: kind name and type from Symbol.toStringTag", () => {
    class Badge {
      constructor(readonly id: number) {}
      get [Symbol.toStringTag]() {
        return "test.badge";
      }
    }
    Canonical.register(Badge, (value) => new Badge(value.id), {
      key: (value) => String(value.id),
    });
    const badge = RecordTuple.deep({ b: new Badge(1) }).b;
    expect(Canonical.kindOf(badge)).toBe("test.badge");
    expect(RecordTuple.deep({ b: new Badge(1) }).b).toBe(badge);

    class Untagged {}
    expect(() =>
      Canonical.register(Untagged, (value) => value, { key: () => "" })
    ).toThrow(/Symbol.toStringTag/);
  });

  it("built-ins carry their kind through the same tag", () => {
    expect(Tuple(1)[Canonical.kind]).toBe("tuple");
    expect(Record({ a: 1 })[Canonical.kind]).toBe("record");
  });

  it("hash encoding is a stable cross-copy protocol", () => {
    // Copies of the library share one cache (the globalThis state slot),
    // which makes this encoding a shared format: changing any of it
    // requires bumping the protocol constant in Canonical.ts, and a
    // mismatched copy then fails at load.
    const encode = Canonical.Hash.encode;
    expect(encode(undefined)).toBe("und");
    expect(encode(null)).toBe("nul");
    expect(encode(true)).toBe("tru");
    expect(encode(false)).toBe("fal");
    expect(encode(42)).toBe("num:42");
    expect(encode(-0)).toBe("num:0");
    expect(encode(BigInt(7))).toBe("bgi:7");
    expect(encode("a,b")).toBe("str:3:a,b");
    expect(encode(Symbol.for("k"))).toBe("sym:1:k");
    expect(encode({})).toMatch(/^ref:[0-9a-z]+$/);
    expect(Canonical.Hash.Segment.kind("name", "key")).toBe("knd:4:name3:key");
  });

  it("resolve: canonical values (any kind) resolve to themselves", () => {
    const tuple = Tuple(1, 2);
    expect(Canonical.resolve(tuple)).toBe(tuple);
    const record = Record({ a: 1 });
    expect(Canonical.resolve(record)).toBe(record);
    const box = RecordTuple.deep({ b: new Box(7) }).b;
    expect(Canonical.resolve(box)).toBe(box);
    // manually tagged values never entered the mint and cannot pass as canonical
    const forged = Object.freeze(
      Object.defineProperty([1, 2], Canonical.kind, { value: "tuple" })
    );
    expect(Canonical.resolve(forged)).toBeUndefined();
    // plain containers belong to Tuple/Record/deep, a layer above
    expect(Canonical.resolve({ a: 1 })).toBeUndefined();
    expect(Canonical.resolve([1, 2])).toBeUndefined();
  });
});
