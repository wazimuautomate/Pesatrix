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

test("verification task data strips expected answers before reaching clients", () => {
  const taskData = {
    type: "verification",
    verification_type: "text_only",
    requires_text_answer: true,
    requires_screenshot: false,
    requires_url: false,
    text_answer_label: "What price did you see?",
    expected_answer: "KSh 500",
    expected_answer_strict: true,
    answer_hint: "Enter the price",
    verification_url: "https://example.com",
  };

  const sanitized = sanitizeTaskDataForClient(taskData);

  assert.equal(sanitized.expected_answer, undefined);
  assert.equal(sanitized.expected_answer_strict, undefined);
  assert.equal(sanitized.text_answer_label, "What price did you see?");
  assert.equal(taskData.expected_answer, "KSh 500");
});
