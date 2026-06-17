// Shapes returned by the tasks/labels/checklist endpoints.

export type ColumnRow = {
  id: string;
  name: string;
  position: number;
  isCompletedColumn: boolean;
  isPmGated: boolean;
};

export type AssigneeRow = {
  userId: string;
  name: string;
  email: string;
};

export type LabelRow = {
  id: string;
  name: string;
  color: string;
};

export type TaskRow = {
  id: string;
  projectId: string;
  columnId: string;
  title: string;
  description: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate: string | null;
  position: number;
  assignees: AssigneeRow[];
  labels: LabelRow[];
  checklistTotal: number;
  checklistDone: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type ChecklistItemRow = {
  id: string;
  text: string;
  isChecked: boolean;
  position: number;
};

export type CreateTaskInput = {
  title: string;
  description?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  dueDate?: string;
  assigneeIds?: string[];
};

export type UpdateTaskInput = Partial<Omit<CreateTaskInput, "assigneeIds">>;

export type MoveTaskInput = {
  columnId: string;
  position: number;
};

export type CreateLabelInput = { name: string; color: string };
export type UpdateLabelInput = Partial<CreateLabelInput>;
export type CreateChecklistItemInput = { text: string };
export type UpdateChecklistItemInput = { text?: string; isChecked?: boolean };
