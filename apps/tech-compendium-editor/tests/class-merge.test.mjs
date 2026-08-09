import assert from "node:assert/strict";
import test from "node:test";

import { mergeClasses, newestClasses } from "../app/class-merge.mjs";

const classItem = (id, name = id) => ({ id, name });

test("keeps shared classes that are absent from a friend's local upload", () => {
  const shared = [classItem("diver"), classItem("charger")];
  const result = mergeClasses(shared, [classItem("diver", "Diver updated")]);

  assert.deepEqual(result, [classItem("diver", "Diver updated"), classItem("charger")]);
});

test("uses the last copy of a class in the newest class update", () => {
  const result = mergeClasses(
    [classItem("diver", "Old")],
    [classItem("diver", "First"), classItem("diver", "Newest")],
  );

  assert.deepEqual(result, [classItem("diver", "Newest")]);
});

test("adds new classes without disturbing existing shared class positions", () => {
  const result = mergeClasses(
    [classItem("diver"), classItem("charger")],
    [classItem("spirit")],
  );

  assert.deepEqual(result.map((item) => item.id), ["diver", "charger", "spirit"]);
});

test("applies deliberate reordering while retaining classes unknown to that editor", () => {
  const result = mergeClasses(
    [classItem("diver"), classItem("friend-class"), classItem("charger")],
    [classItem("charger", "Charger updated")],
    ["charger", "diver"],
  );

  assert.deepEqual(result.map((item) => item.id), ["charger", "diver", "friend-class"]);
});

test("does not resurrect explicitly deleted class IDs from stale drafts", () => {
  const result = mergeClasses(
    [classItem("diver")],
    [classItem("deleted-class"), classItem("charger")],
    undefined,
    ["deleted-class"],
  );

  assert.deepEqual(result.map((item) => item.id), ["diver", "charger"]);
});

test("keeps the newest received update when an older conflicting request retries", () => {
  const shared = [{ ...classItem("diver", "Newest"), updatedAt: "2026-08-09T12:00:02.000Z" }];
  const retryingOlderRequest = [{ ...classItem("diver", "Older"), updatedAt: "2026-08-09T12:00:01.000Z" }];
  const laterRequest = [{ ...classItem("diver", "Later still"), updatedAt: "2026-08-09T12:00:03.000Z" }];

  assert.deepEqual(newestClasses(shared, retryingOlderRequest), []);
  assert.deepEqual(newestClasses(shared, laterRequest), laterRequest);
});
