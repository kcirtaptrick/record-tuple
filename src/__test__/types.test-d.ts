// Compile-time assertions only. Run with `pnpm typecheck`; vitest does not
// pick this file up (its name does not match the default test glob).
import { Temporal } from "temporal-polyfill";
import { Canonical, RecordTuple, Record as RTRecord, Tuple } from "../index.js";
import type { TemporalKinds, URLKinds } from "../kinds/index.js";
import { ReadonlyURL } from "../kinds/ReadonlyURL.js";
import { ReadonlyURLSearchParams } from "../kinds/ReadonlyURLSearchParams.js";

class Money {
  constructor(readonly amount: number, readonly currency: string) {}
}

declare module "../index.js" {
  namespace Canonical {
    interface Kinds {
      Money: Money;
    }
  }
}

// `extends` is too permissive here: `URL extends ReadonlyURL` is true by
// design, so an extends-based check would pass assertions that should fail.
type Is<A, B> = (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B
  ? 1
  : 2
  ? true
  : false;
type Expect<T extends true> = T;

// shorthand entry: raw and canonical are the same type
type _Shorthand = Expect<
  Is<Canonical.Resolved<Money>, Money & { readonly [Canonical.kind]: "Money" }>
>;

// unregistered and unknown collapse to never, which is what lets `resolve`
// and `deep.Result` fall back to their existing behavior
type _Unregistered = Expect<Is<Canonical.Resolved<Date>, never>>;
type _Unknown = Expect<Is<Canonical.Resolved<unknown>, never>>;

// the brand distinguishes canonical from raw, like Record.Type / Tuple.Type
declare const rawMoney: Money;
// @ts-expect-error a raw instance is not a canonical one
const _rejected: Canonical.Resolved<Money> = rawMoney;

// ...but a canonical value still flows into ordinary APIs
declare const canonicalMoney: Canonical.Resolved<Money>;
const _accepted: Money = canonicalMoney;
const _brand: "Money" = canonicalMoney[Canonical.kind];

// reverse lookup
type _KeyFor = Expect<Is<Canonical.Kinds.KeyFor<URL>, "URL">>;

// The `Kind.Of` brand is what keeps the shorthand safe: a user type that
// happens to have `raw` and `canonical` members is a shorthand entry, not an
// entry object. Without the brand, `Normalize` would read this type's own
// members and resolve it to `string`.
class LooksLikeAnEntry {
  raw!: URL;
  canonical!: ReadonlyURL;
}
declare module "../index.js" {
  namespace Canonical {
    interface Kinds {
      "test.decoy": LooksLikeAnEntry;
    }
  }
}
type _BrandSafety = Expect<
  Is<
    Canonical.Resolved<LooksLikeAnEntry>,
    LooksLikeAnEntry & { readonly [Canonical.kind]: "test.decoy" }
  >
>;

// --- Task 2: typed resolve ---------------------------------------------------

declare const someUrl: URL;
declare const someDate: Date;
declare const someUnknown: unknown;

// A registered kind always produces a value, so no `| undefined` to narrow.
// This assumes the kind was registered at runtime too; declaring an entry
// without calling `register` is caller error, not something every correct
// caller should pay for.
type _ResolveRegistered = Expect<
  Is<
    ReturnType<typeof Canonical.resolve<URL>>,
    ReadonlyURL & { readonly [Canonical.kind]: "URL" }
  >
>;

// unregistered input keeps today's signature, which is what lets
// `Canonical.resolve(v) ?? v` in Record.fromEntries and Tuple.from keep working
type _ResolveUnregistered = Expect<
  Is<ReturnType<typeof Canonical.resolve<Date>>, object | undefined>
>;
type _ResolveUnknown = Expect<
  Is<ReturnType<typeof Canonical.resolve<unknown>>, object | undefined>
>;

// no cast and no narrowing at the call site for a registered kind
const _resolvedUrl: ReadonlyURL = Canonical.resolve(someUrl);
const _resolvedHref: string = Canonical.resolve(someUrl).href;
const _resolvedDate: object | undefined = Canonical.resolve(someDate);
const _resolvedUnknown: object | undefined = Canonical.resolve(someUnknown);
// @ts-expect-error an unregistered kind still has to be narrowed
const _unnarrowed: object = Canonical.resolve(someDate);

// `any` satisfies every branch of the registry scan, so without an explicit
// guard `Resolved<any>` is the union of every registered kind. That would make
// `resolve` claim a canonical type it cannot know, and would break member
// access off an `any` that worked before the registry existed. Both must fall
// back to the pre-registry behavior.
type _ResolvedAny = Expect<Is<Canonical.Resolved<any>, never>>;
type _KeyForAny = Expect<Is<Canonical.Kinds.KeyFor<any>, never>>;
type _ResolveAny = Expect<
  Is<ReturnType<typeof Canonical.resolve<any>>, object | undefined>
>;

// --- Task 3: shipped entries -------------------------------------------------

// Two group types combined with a comma, merged into the same interface as the
// local entries above via a second block -- both combining forms are supported.
declare module "../index.js" {
  namespace Canonical {
    interface Kinds extends TemporalKinds<typeof Temporal>, URLKinds {}
  }
}

// all eight Temporal kinds arrive from one clause, typed by the caller's impl
type _PlainDate = Expect<
  Is<
    Canonical.Resolved<Temporal.PlainDate>,
    Temporal.PlainDate & { readonly [Canonical.kind]: "Temporal.PlainDate" }
  >
>;
type _Duration = Expect<
  Is<
    Canonical.Resolved<Temporal.Duration>,
    Temporal.Duration & { readonly [Canonical.kind]: "Temporal.Duration" }
  >
>;

// Temporal kinds do not cross-match: each carries a literal toStringTag brand
type _NoCrossMatch = Expect<
  Is<
    Canonical.Resolved<Temporal.PlainDateTime>,
    Temporal.PlainDateTime & {
      readonly [Canonical.kind]: "Temporal.PlainDateTime";
    }
  >
>;

// shipped URL entries: both directions land on the readonly copy
type _Url = Expect<
  Is<Canonical.Resolved<URL>, ReadonlyURL & { readonly [Canonical.kind]: "URL" }>
>;
type _ReadonlyUrl = Expect<
  Is<
    Canonical.Resolved<ReadonlyURL>,
    ReadonlyURL & { readonly [Canonical.kind]: "URL" }
  >
>;
type _Params = Expect<
  Is<
    Canonical.Resolved<URLSearchParams>,
    ReadonlyURLSearchParams & { readonly [Canonical.kind]: "URLSearchParams" }
  >
>;
type _ReadonlyParams = Expect<
  Is<
    Canonical.Resolved<ReadonlyURLSearchParams>,
    ReadonlyURLSearchParams & { readonly [Canonical.kind]: "URLSearchParams" }
  >
>;

// --- Task 4: deep.Result ------------------------------------------------------

// Before the registry, both `Temporal.PlainDate` and `URL` satisfied
// `Recordable` (its index signature's value type is `any`), so `deep` typed
// them as a Record.Type of their members while returning the canonical
// instance at runtime. These assertions are the regression guard.
declare const plainDate: Temporal.PlainDate;
declare const url: URL;

const deepRecord = RecordTuple.deep({ at: plainDate, link: url, n: 1 });

type _DeepTemporal = Expect<
  Is<
    typeof deepRecord.at,
    Temporal.PlainDate & { readonly [Canonical.kind]: "Temporal.PlainDate" }
  >
>;
type _DeepUrl = Expect<
  Is<typeof deepRecord.link, ReadonlyURL & { readonly [Canonical.kind]: "URL" }>
>;
// non-object leaves are untouched
type _DeepPrimitive = Expect<Is<typeof deepRecord.n, number>>;

// arrays: registered kinds resolve elementwise
const deepTuple = RecordTuple.deep([plainDate, url] as const);
type _DeepTupleFirst = Expect<
  Is<
    (typeof deepTuple)[0],
    Temporal.PlainDate & { readonly [Canonical.kind]: "Temporal.PlainDate" }
  >
>;

// plain objects keep the existing recursion
const deepPlain = RecordTuple.deep({ a: { b: 1 } });
const _deepNested: RTRecord.Type<{ b: number }> = deepPlain.a;

// an already-canonical value is not re-resolved
const deepCanonical = RecordTuple.deep({ r: RTRecord({ x: 1 }) });
const _deepCanonicalUnchanged: RTRecord.Type<{ x: number }> = deepCanonical.r;

// --- Record.Type / Tuple.Type members -----------------------------------------

// Record.fromEntries and Tuple.from both resolve their members, so a container
// holds the canonical copy. For a companion-class kind that copy is a
// *different type* than the input: typing the member as the raw input claims
// mutators that the frozen readonly copy does not have.
const recordOfUrl = RTRecord({ link: url, on: plainDate, n: 1 });
type _RecordUrlMember = Expect<
  Is<
    typeof recordOfUrl.link,
    ReadonlyURL & { readonly [Canonical.kind]: "URL" }
  >
>;
type _RecordTemporalMember = Expect<
  Is<
    typeof recordOfUrl.on,
    Temporal.PlainDate & { readonly [Canonical.kind]: "Temporal.PlainDate" }
  >
>;
type _RecordPlainMember = Expect<Is<typeof recordOfUrl.n, number>>;

const tupleOfUrl = Tuple(url, plainDate, 1);
type _TupleUrlMember = Expect<
  Is<(typeof tupleOfUrl)[0], ReadonlyURL & { readonly [Canonical.kind]: "URL" }>
>;
type _TuplePlainMember = Expect<Is<(typeof tupleOfUrl)[2], number>>;
// tuple-ness survives the mapping
type _TupleLength = Expect<Is<(typeof tupleOfUrl)["length"], 3>>;

// Record is shallow -- a nested plain object stays a plain object by
// reference, unlike RecordTuple.deep
const shallow = RTRecord({ a: { b: 1 } });
const _shallowUnchanged: { b: number } = shallow.a;

// annotations still work for unregistered types, exactly as documented
const _annotated: RTRecord.Type<{ a: string }> = RTRecord({ a: "a" });
// @ts-expect-error a plain object is not a Record
const _notARecord: RTRecord.Type<{ a: string }> = { a: "a" };

// --- unions must not lose their unregistered arms -----------------------------

// Canonical.Resolved distributes and maps non-matching arms to `never`, which
// unions away. Every consumer of it therefore has to distribute *first* and
// judge each arm alone, or a nullable/mixed member silently loses the arms the
// container really can hold.
type _OrIdentityNullable = Expect<
  Is<
    Canonical.Resolved.OrIdentity<URL | null>,
    (ReadonlyURL & { readonly [Canonical.kind]: "URL" }) | null
  >
>;
type _OrIdentityMixed = Expect<
  Is<
    Canonical.Resolved.OrIdentity<string | URL>,
    string | (ReadonlyURL & { readonly [Canonical.kind]: "URL" })
  >
>;
type _OrIdentityUnregisteredOnly = Expect<Is<Canonical.Resolved.OrIdentity<string | Date>, string | Date>>;

declare const nullableUrl: URL | null;
const nullableRecord = RTRecord({ link: nullableUrl });
type _RecordKeepsNull = Expect<
  Is<
    typeof nullableRecord.link,
    (ReadonlyURL & { readonly [Canonical.kind]: "URL" }) | null
  >
>;
// @ts-expect-error the null is still in the type, so this must not compile
const _nullUnguarded: string = nullableRecord.link.href;

const nullableDeep = RecordTuple.deep({ link: nullableUrl });
type _DeepKeepsNull = Expect<
  Is<
    typeof nullableDeep.link,
    (ReadonlyURL & { readonly [Canonical.kind]: "URL" }) | null
  >
>;

// resolve keeps the fallback for arms that are not registered
type _ResolveMixedUnion = Expect<
  Is<
    ReturnType<typeof Canonical.resolve<URL | Date>>,
    (ReadonlyURL & { readonly [Canonical.kind]: "URL" }) | object | undefined
  >
>;

// --- deep() resolves its top-level argument, not just members -----------------

const deepTopLevel = RecordTuple.deep(url);
type _DeepTopLevel = Expect<
  Is<typeof deepTopLevel, ReadonlyURL & { readonly [Canonical.kind]: "URL" }>
>;
// a canonical URL is not a record, so this must not compile
// @ts-expect-error
const _notARecordType: RTRecord.Type = deepTopLevel;

// `register` returns void: an entry and its registration are related only by
// convention, and nothing checks that they agree.
type _RegisterReturnsVoid = Expect<
  Is<ReturnType<typeof Canonical.register>, void>
>;
