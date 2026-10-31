import { describe, expect, it } from "vitest";

import { en } from "./en";
import { ja } from "./ja";

type Leaf = { path: string; value: unknown };

/** Every leaf of a catalogue (a string or a function), by its dotted key. */
function leaves(node: unknown, path = ""): Leaf[] {
  if (typeof node === "object" && node !== null) {
    return Object.entries(node).flatMap(([key, value]) =>
      leaves(value, path ? `${path}.${key}` : key),
    );
  }
  return [{ path, value: node }];
}

/** A function message called with probe values, so its output can be checked too. */
function render(value: unknown): unknown {
  if (typeof value !== "function") {
    return value;
  }
  const probe = new Proxy(
    {},
    { get: (_target, key) => (key === Symbol.toPrimitive ? () => 2 : 2) },
  ) as Record<string, unknown>;
  return (value as (args: unknown) => unknown)(probe);
}

/** The text before or after a link may be empty where the language starts or ends with the link. */
const MAY_BE_EMPTY = /\.(before|after)$/u;

/** Entries with no words of their own (only values and punctuation). */
const NO_WORDS = new Set(["common.pageTitle"]);

const JAPANESE = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;

describe("message catalogues", () => {
  const jaLeaves = leaves(ja);
  const enLeaves = leaves(en);

  it("have the same keys in Japanese and English", () => {
    expect(enLeaves.map(({ path }) => path).toSorted()).toEqual(
      jaLeaves.map(({ path }) => path).toSorted(),
    );
  });

  it("give every key the same kind of value in both", () => {
    const kinds = new Map(enLeaves.map(({ path, value }) => [path, typeof value]));
    for (const { path, value } of jaLeaves) {
      expect({ path, kind: kinds.get(path) }).toEqual({ path, kind: typeof value });
    }
  });

  it("have no empty text", () => {
    for (const { path, value } of [...jaLeaves, ...enLeaves]) {
      if (MAY_BE_EMPTY.test(path)) {
        continue;
      }
      const text = render(value);
      expect({ path, text }).toEqual({ path, text: expect.stringMatching(/\S/) });
    }
  });

  it("leave no Japanese in the English text", () => {
    const leftovers = enLeaves
      .map(({ path, value }) => ({ path, text: String(render(value)) }))
      .filter(({ text }) => JAPANESE.test(text));
    expect(leftovers).toEqual([]);
  });

  it("write the Japanese text in Japanese", () => {
    const untranslated = jaLeaves
      .filter(({ path }) => !MAY_BE_EMPTY.test(path) && !NO_WORDS.has(path))
      .map(({ path, value }) => ({ path, text: String(render(value)) }))
      .filter(({ text }) => !JAPANESE.test(text));
    expect(untranslated).toEqual([]);
  });
});
