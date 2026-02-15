import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { useState, useEffect, useCallback } from 'react';
import pako from 'pako';
import { BoardState, Column, Task, Tag, Status, Priority, TAG_COLORS } from '../types';
import { attemptRecovery, createRecoveryBackup } from '../utils/RecoveryManager';

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

// Compress board state for storage
function compressState(state: BoardState): string {
  try {
    const json = JSON.stringify(state);
    const compressed = pako.gzip(json);
    // Convert to base64 for storage in IndexedDB
    return btoa(String.fromCharCode.apply(null, Array.from(compressed) as any));
  } catch (error) {
    console.error('Failed to compress state:', error);
    // Fallback to uncompressed if compression fails
    return JSON.stringify(state);
  }
}

// Decompress board state from storage
function decompressState(data: string | BoardState): BoardState {
  try {
    // If already a BoardState object, return it (handles old uncompressed data)
    if (typeof data === 'object') {
      return data as BoardState;
    }

    // Try to decompress as base64-encoded gzip
    const binaryString = atob(data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const decompressed = pako.ungzip(bytes);
    const json = new TextDecoder().decode(decompressed);
    return JSON.parse(json) as BoardState;
  } catch (error) {
    console.error('Failed to decompress state:', error);
    // Fallback: try to parse as plain JSON (for backward compatibility)
    try {
      if (typeof data === 'string') {
        return JSON.parse(data);
      }
    } catch (_) {
      // Silent fail
    }
    return defaultState;
  }
}

export function useDatabase() {
  const [state, setState] = useState<BoardState>(defaultState);
  const [isLoading, setIsLoading] = useState(true);
  const [recoveryInfo, setRecoveryInfo] = useState<{
    recovered: boolean;
    source: 'indexeddb' | 'localstorage' | 'cookies' | null;
  }>({ recovered: false, source: null });

  useEffect(() => {
    async function loadData() {
      try {
        const db = await getDB();
        let savedState = await db.get('board', 'state');

        // Decompress if necessary (handles both old uncompressed and new compressed data)
        if (savedState) {
          savedState = decompressState(savedState);
        }

        // If no saved state, attempt recovery
        if (!savedState) {
          const recovery = await attemptRecovery();
          if (recovery.recovered && recovery.state) {
            savedState = recovery.state;
            setRecoveryInfo({
              recovered: true,
              source: recovery.source,
            });
            // Save the recovered state to the main database (compressed)
            await db.put('board', compressState(savedState), 'state');
          }
        }

        if (savedState) {
          const migratedState = migrateState(savedState);
          setState(migratedState);
          // Create a recovery backup immediately
          await createRecoveryBackup(migratedState);
        }
      } catch (error) {
        console.error('Failed to load from IndexedDB:', error);
        // Attempt recovery even if there's an error
        const recovery = await attemptRecovery();
        if (recovery.recovered && recovery.state) {
          setState(migrateState(recovery.state));
          setRecoveryInfo({
            recovered: true,
            source: recovery.source,
          });
        }
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
      // Compress state before saving
      const compressedState = compressState(newState);
      await db.put('board', compressedState, 'state');
      // Create recovery backups after saving
      await createRecoveryBackup(newState);
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

  const setColumnTasksPriority = useCallback((columnId: string, priority: Priority) => {
    console.log('[DEBUG] setColumnTasksPriority called:', columnId, priority);
    const updatedTasks = state.tasks.map((task) => {
      if (task.columnId === columnId) {
        console.log('[DEBUG] updating task:', task.id, 'from', task.priority, 'to', priority);
        return { ...task, priority };
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

  const importBoardState = useCallback((newState: BoardState) => {
    saveState(newState);
  }, [saveState]);

  return {
    state,
    isLoading,
    recoveryInfo,
    addColumn,
    updateColumn,
    deleteColumn,
    addTask,
    updateTask,
    deleteTask,
    moveTask,
    reorderColumns,
    setColumnTasksStatus,
    setColumnTasksPriority,
    addTag,
    deleteTag,
    searchTasks,
    importBoardState,
  };
}
