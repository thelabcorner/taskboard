import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { useState, useEffect, useCallback } from 'react';
import { BoardState, Column, Task, Tag, Status, TAG_COLORS } from '../types';

interface TaskBoardDB extends DBSchema {
  board: {
    key: string;
    value: BoardState;
  };
}

const DB_NAME = 'taskboard-db';
const DB_VERSION = 1;

const defaultTags: Tag[] = [
  { id: 'tag-1', name: 'Bug', color: TAG_COLORS[0] },
  { id: 'tag-2', name: 'Feature', color: TAG_COLORS[4] },
  { id: 'tag-3', name: 'Urgent', color: TAG_COLORS[1] },
  { id: 'tag-4', name: 'Design', color: TAG_COLORS[6] },
];

const defaultState: BoardState = {
  columns: [
    { id: 'col-1', title: 'To Do', order: 0 },
    { id: 'col-2', title: 'In Progress', order: 1 },
    { id: 'col-3', title: 'Done', order: 2 },
  ],
  tasks: [],
  tags: defaultTags,
};

async function getDB(): Promise<IDBPDatabase<TaskBoardDB>> {
  return openDB<TaskBoardDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('board')) {
        db.createObjectStore('board');
      }
    },
  });
}

// Migration helper to add new fields to old tasks
function migrateState(state: BoardState): BoardState {
  const migratedTasks = state.tasks.map((task) => ({
    ...task,
    status: task.status || 'not-started',
    subtasks: task.subtasks || [],
    attachments: task.attachments || [],
    tags: task.tags || [],
  }));
  
  return {
    ...state,
    tasks: migratedTasks,
    tags: state.tags || defaultTags,
  };
}

export function useDatabase() {
  const [state, setState] = useState<BoardState>(defaultState);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const db = await getDB();
        const savedState = await db.get('board', 'state');
        if (savedState) {
          setState(migrateState(savedState));
        }
      } catch (error) {
        console.error('Failed to load from IndexedDB:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const saveState = useCallback(async (newState: BoardState) => {
    setState(newState);
    try {
      const db = await getDB();
      await db.put('board', newState, 'state');
    } catch (error) {
      console.error('Failed to save to IndexedDB:', error);
    }
  }, []);

  const addColumn = useCallback((title: string) => {
    const newColumn: Column = {
      id: `col-${Date.now()}`,
      title,
      order: state.columns.length,
    };
    saveState({ ...state, columns: [...state.columns, newColumn] });
  }, [state, saveState]);

  const updateColumn = useCallback((columnId: string, title: string) => {
    const updatedColumns = state.columns.map((col) =>
      col.id === columnId ? { ...col, title } : col
    );
    saveState({ ...state, columns: updatedColumns });
  }, [state, saveState]);

  const deleteColumn = useCallback((columnId: string) => {
    const updatedColumns = state.columns.filter((col) => col.id !== columnId);
    const updatedTasks = state.tasks.filter((task) => task.columnId !== columnId);
    saveState({ ...state, columns: updatedColumns, tasks: updatedTasks });
  }, [state, saveState]);

  const addTask = useCallback((columnId: string, title: string): Task => {
    const columnTasks = state.tasks.filter((t) => t.columnId === columnId);
    const newTask: Task = {
      id: `task-${Date.now()}`,
      title,
      priority: 'medium',
      status: 'not-started',
      notes: [],
      subtasks: [],
      attachments: [],
      tags: [],
      columnId,
      order: columnTasks.length,
      createdAt: Date.now(),
    };
    saveState({ ...state, tasks: [...state.tasks, newTask] });
    return newTask;
  }, [state, saveState]);

  const updateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    const updatedTasks = state.tasks.map((task) => {
      if (task.id === taskId) {
        const updated = { ...task, ...updates };
        // Set completedAt when status changes to done
        if (updates.status === 'done' && task.status !== 'done') {
          updated.completedAt = Date.now();
        } else if (updates.status && updates.status !== 'done') {
          updated.completedAt = undefined;
        }
        return updated;
      }
      return task;
    });
    saveState({ ...state, tasks: updatedTasks });
  }, [state, saveState]);

  const deleteTask = useCallback((taskId: string) => {
    const updatedTasks = state.tasks.filter((task) => task.id !== taskId);
    saveState({ ...state, tasks: updatedTasks });
  }, [state, saveState]);

  const moveTask = useCallback((taskId: string, newColumnId: string, newOrder: number) => {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;

    let updatedTasks = state.tasks.filter((t) => t.id !== taskId);
    
    const targetColumnTasks = updatedTasks
      .filter((t) => t.columnId === newColumnId)
      .sort((a, b) => a.order - b.order);
    
    targetColumnTasks.splice(newOrder, 0, { ...task, columnId: newColumnId });
    
    targetColumnTasks.forEach((t, index) => {
      t.order = index;
    });

    updatedTasks = updatedTasks.filter((t) => t.columnId !== newColumnId);
    updatedTasks = [...updatedTasks, ...targetColumnTasks];

    saveState({ ...state, tasks: updatedTasks });
  }, [state, saveState]);

  const reorderColumns = useCallback((columns: Column[]) => {
    saveState({ ...state, columns });
  }, [state, saveState]);

  const setColumnTasksStatus = useCallback((columnId: string, status: Status) => {
    const updatedTasks = state.tasks.map((task) => {
      if (task.columnId === columnId) {
        const updated = { ...task, status };
        if (status === 'done' && task.status !== 'done') {
          updated.completedAt = Date.now();
        } else if (status !== 'done') {
          updated.completedAt = undefined;
        }
        return updated;
      }
      return task;
    });
    saveState({ ...state, tasks: updatedTasks });
  }, [state, saveState]);

  const addTag = useCallback((name: string, color: string): Tag => {
    const newTag: Tag = {
      id: `tag-${Date.now()}`,
      name,
      color,
    };
    saveState({ ...state, tags: [...state.tags, newTag] });
    return newTag;
  }, [state, saveState]);

  const deleteTag = useCallback((tagId: string) => {
    const updatedTags = state.tags.filter((tag) => tag.id !== tagId);
    const updatedTasks = state.tasks.map((task) => ({
      ...task,
      tags: task.tags.filter((id) => id !== tagId),
    }));
    saveState({ ...state, tags: updatedTags, tasks: updatedTasks });
  }, [state, saveState]);

  const searchTasks = useCallback((query: string): Task[] => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return state.tasks.filter((task) => {
      // Search in title
      if (task.title.toLowerCase().includes(lowerQuery)) return true;
      // Search in description
      if (task.description?.toLowerCase().includes(lowerQuery)) return true;
      // Search in notes
      if (task.notes.some((note) => note.content.toLowerCase().includes(lowerQuery))) return true;
      // Search in subtasks
      if (task.subtasks.some((st) => st.title.toLowerCase().includes(lowerQuery))) return true;
      // Search in tags
      const taskTags = state.tags.filter((tag) => task.tags.includes(tag.id));
      if (taskTags.some((tag) => tag.name.toLowerCase().includes(lowerQuery))) return true;
      return false;
    });
  }, [state.tasks, state.tags]);

  return {
    state,
    isLoading,
    addColumn,
    updateColumn,
    deleteColumn,
    addTask,
    updateTask,
    deleteTask,
    moveTask,
    reorderColumns,
    setColumnTasksStatus,
    addTag,
    deleteTag,
    searchTasks,
  };
}
