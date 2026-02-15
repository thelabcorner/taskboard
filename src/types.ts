export type Priority = 'urgent' | 'high' | 'medium' | 'low';
export type Status = 'not-started' | 'in-progress' | 'paused' | 'done';

export interface SubNote {
  id: string;
  content: string;
  createdAt: number;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
}

export interface Attachment {
  id: string;
  type: 'link' | 'image' | 'file';
  name: string;
  url: string; // Can be a URL or base64 data URL for uploaded files
  size?: number; // File size in bytes
  mimeType?: string;
  createdAt: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  status: Status;
  notes: SubNote[];
  subtasks: Subtask[];
  attachments: Attachment[];
  tags: string[]; // Tag IDs
  columnId: string;
  order: number;
  createdAt: number;
  completedAt?: number;
}

export interface Column {
  id: string;
  title: string;
  order: number;
}

export interface BoardState {
  columns: Column[];
  tasks: Task[];
  tags: Tag[];
}

// Predefined tag colors
export const TAG_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
];
