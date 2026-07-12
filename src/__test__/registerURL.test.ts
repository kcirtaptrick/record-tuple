import { describe, expect, it } from "vitest";
import Canonical from "../Canonical";
import RecordTuple from "../RecordTuple";
import Tuple from "../Tuple";
import { ReadonlyURLSearchParams } from "../kinds/ReadonlyURLSearchParams";
import { ReadonlyURL } from "../kinds/ReadonlyURL";
import registerURL from "../kinds/url";

registerURL();

describe("registerURL", () => {
  it("containers key URLs by value and store the canonical copy", () => {
    const tuple = Tuple(new URL("https://example.com/a?b=1"));

    expect(tuple).toBe(Tuple(new URL("https://example.com/a?b=1")));
    expect(tuple[0]).toBeInstanceOf(ReadonlyURL);
    expect(Canonical.kindOf(tuple[0])).toBe("URL");
    expect(Tuple(new URL("https://example.com/a"))).not.toBe(
      Tuple(new URL("https://example.com/b"))
    );
    // the URL constructor normalizes, so equal hrefs collide
    expect(Tuple(new URL("HTTPS://EXAMPLE.com/a"))).toBe(
      Tuple(new URL("https://example.com/a"))
    );
  });

  it("canonicalizes to a frozen ReadonlyURL copy", () => {
    const mine = new URL("https://example.com/a");
    const canonical: any = RecordTuple.deep({ url: mine }).url;

    expect(canonical).not.toBe(mine);
    expect(canonical).toBeInstanceOf(ReadonlyURL);
    expect(Canonical.kindOf(canonical)).toBe("URL");
    expect(Object.isFrozen(canonical)).toBe(true);
    expect(canonical.href).toBe("https://example.com/a");

    // the caller's URL stays untouched and mutable
    expect(Canonical.kindOf(mine)).toBeUndefined();
    mine.hash = "#ok";
    expect(mine.hash).toBe("#ok");
  });

  it("ReadonlyURL has no mutation surface", () => {
    const url = new ReadonlyURL("https://example.com/a?b=1");

    expect(url.pathname).toBe("/a");
    expect(url.searchParams.get("b")).toBe("1");
    expect([...url.searchParams.entries()]).toEqual([["b", "1"]]);
    expect(() => {
      // @ts-expect-error href is readonly
      url.href = "https://example.com/x";
    }).toThrow(TypeError);
    // searchParams mutators do not exist, at either level
    expect(() => {
      // @ts-expect-error set does not exist on ReadonlyURLSearchParams
      url.searchParams.set("b", "2");
    }).toThrow(TypeError);
    expect(url.href).toBe("https://example.com/a?b=1");

    // not assignable to URL, so readonly cannot be laundered by an upcast
    // @ts-expect-error ReadonlyURL is not a URL
    const _mutable: URL = url;
    void _mutable;

    // the ReadonlyArray relationship: the mutable type satisfies the
    // readonly one
    const accepted: ReadonlyURL = new URL("https://example.com/");
    expect(accepted.href).toBe("https://example.com/");

    // the mutable-copy idiom
    const copy = new URL(url.href);
    copy.hash = "#ok";
    expect(copy.hash).toBe("#ok");
    expect(url.href).toBe("https://example.com/a?b=1");
  });

  it("Map lookups hit through equal URL keys", () => {
    const map = new RecordTuple.Map();
    map.set(new URL("https://example.com/a"), "value");

    expect(map.get(new URL("https://example.com/a"))).toBe("value");
    expect(map.get(new URL("https://example.com/b"))).toBeUndefined();
  });

  it("readonly classes intern on construction, like Tuple and Record", () => {
    const url = new ReadonlyURL("https://example.com/a");

    expect(url).toBe(new ReadonlyURL("https://example.com/a"));
    expect(Canonical.kindOf(url)).toBe("URL");
    expect(Object.isFrozen(url)).toBe(true);
    // identical params, identical instance, across accesses and sources
    expect(url.searchParams).toBe(url.searchParams);
    expect(new ReadonlyURLSearchParams("a=1")).toBe(
      new ReadonlyURLSearchParams("a=1")
    );
  });

  it("ReadonlyURL.with replaces components immutably", () => {
    const url = new ReadonlyURL("https://example.com/a?b=1");
    const moved = ReadonlyURL.with(url, { pathname: "/c", hash: "#h" });

    expect(moved.href).toBe("https://example.com/c?b=1#h");
    expect(url.href).toBe("https://example.com/a?b=1");
    // canonical: an empty replacement is the value itself
    expect(ReadonlyURL.with(url, {})).toBe(url);
    // accepts any URL flavor
    expect(ReadonlyURL.with(new URL("https://example.com/a?b=1"), {})).toBe(
      url
    );
    // specific parts win over the combined host
    expect(
      ReadonlyURL.with(url, { host: "a.com:81", port: "82" }).host
    ).toBe("a.com:82");
    // href is the most combined part: applied first, the rest win over it
    expect(
      ReadonlyURL.with(url, { href: "https://other.com/x?y=1", hash: "#h" })
        .href
    ).toBe("https://other.com/x?y=1#h");
  });

  it("ReadonlyURLSearchParams.with replaces entries immutably", () => {
    const params = new ReadonlyURLSearchParams("a=1&b=2&a=3");

    // string = native set: in place, first occurrence, removes the rest
    expect(ReadonlyURLSearchParams.with(params, { b: "9" }).toString()).toBe(
      "a=1&b=9&a=3"
    );
    expect(ReadonlyURLSearchParams.with(params, { a: "9" }).toString()).toBe(
      "a=9&b=2"
    );
    // array = delete + appends: all values, adjacent at the end
    expect(
      ReadonlyURLSearchParams.with(params, { a: ["8", "9"] }).toString()
    ).toBe("b=2&a=8&a=9");
    // null deletes, undefined skips
    expect(ReadonlyURLSearchParams.with(params, { a: null }).toString()).toBe(
      "b=2"
    );
    expect(ReadonlyURLSearchParams.with(params, { a: undefined })).toBe(params);
    // canonical: an empty replacement is the value itself
    expect(ReadonlyURLSearchParams.with(params, {})).toBe(params);
  });

  it("registers URLSearchParams alongside URL", () => {
    const tuple = Tuple(new URLSearchParams("a=1&b=2"));

    expect(tuple).toBe(Tuple(new URLSearchParams("a=1&b=2")));
    expect(tuple[0]).toBeInstanceOf(ReadonlyURLSearchParams);
    expect(Canonical.kindOf(tuple[0])).toBe("URLSearchParams");
    // insertion order is meaningful for search params
    expect(tuple).not.toBe(Tuple(new URLSearchParams("b=2&a=1")));
    // readonly and mutable forms share one identity
    const readonly = new ReadonlyURLSearchParams("a=1&b=2");
    expect(RecordTuple.deep({ q: readonly }).q).toBe(tuple[0]);
  });
});
