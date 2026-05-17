import assert from "node:assert/strict";
import test from "node:test";

const { sanitizeTaskDataForClient } = await import("../src/lib/task-data.ts");

test("data labeling task data strips correct_label before reaching clients", () => {
  const taskData = {
    type: "data_labeling",
    subtype: "sentiment",
    batch_size: 1,
    label_options: ["Positive", "Negative"],
    items: [
      {
        id: "item1",
        content: "Fast delivery.",
        content_type: "text",
        correct_label: "Positive",
      },
    ],
  };

  const sanitized = sanitizeTaskDataForClient(taskData);

  assert.equal(sanitized.items[0].correct_label, undefined);
  assert.deepEqual(Object.keys(sanitized.items[0]).sort(), ["content", "content_type", "id"]);
  assert.equal(taskData.items[0].correct_label, "Positive");
});
