export type DataLabelingContentType = "text" | "image_url" | "image";

export type DataLabelingItem = {
  id: string;
  content: string;
  content_type: DataLabelingContentType;
  correct_label?: string;
};

export type DataLabelingTaskData = {
  type: "data_labeling";
  subtype?: string;
  batch_size?: number;
  label_options?: string[];
  items?: DataLabelingItem[];
};

export function sanitizeTaskDataForClient(taskData: unknown): unknown {
  if (!isRecord(taskData) || taskData.type !== "data_labeling") {
    return taskData;
  }

  const cloned = structuredClone(taskData) as DataLabelingTaskData;
  cloned.items = (cloned.items ?? []).map((item) => {
    const { correct_label: _correctLabel, ...safeItem } = item;
    return {
      ...safeItem,
      content_type: safeItem.content_type === "image" ? "image_url" : safeItem.content_type,
    };
  });

  return cloned;
}

export function sanitizeTaskForClient<T extends { task_data?: unknown }>(task: T): T {
  return {
    ...task,
    task_data: sanitizeTaskDataForClient(task.task_data),
  };
}

export function isDataLabelingTaskData(value: unknown): value is DataLabelingTaskData {
  return isRecord(value) && value.type === "data_labeling";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
