import { expect, test } from "bun:test";
import { CATEGORIES, CONDITIONS } from "@/convex/lib/constants";
import { vCategory, vCondition } from "@/convex/schema";

const literals = (union: { members: { value: string }[] }) =>
  union.members.map((m) => m.value).sort();

test("UI labels cover exactly the schema's categories and conditions", () => {
  expect(Object.keys(CATEGORIES).sort()).toEqual(literals(vCategory));
  expect(Object.keys(CONDITIONS).sort()).toEqual(literals(vCondition));
});
