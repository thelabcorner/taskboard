 import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDatabase } from './hooks/useDatabase';
import { Column } from './components/Column';
import { TaskCard } from './components/TaskCard';
import { TaskModal } from './components/TaskModal';
import { SearchBar } from './components/SearchBar';
import { BackupReminder } from './components/BackupReminder';
import { BackupControls } from './components/BackupControls';
import { RecoveryNotification } from './components/RecoveryNotification';
import { Task } from './types';
import { Plus, Layout } from 'lucide-react';
import { exportBoard } from './utils/BackupManager';

export function App() {
  const {
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
    addTag,
    importBoardState,
  } = useDatabase();

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [modalTask, setModalTask] = useState<Task | null>(null);
  const [exportTrigger, setExportTrigger] = useState(0);
  const [showRecoveryNotification, setShowRecoveryNotification] = useState(recoveryInfo.recovered);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = state.tasks.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTask = state.tasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    const overTask = state.tasks.find((t) => t.id === overId);
    const targetColumnId = overTask ? overTask.columnId : overId;

    const targetColumn = state.columns.find((c) => c.id === targetColumnId);
    if (!targetColumn) return;

    if (activeTask.columnId !== targetColumnId) {
      const targetTasks = state.tasks.filter((t) => t.columnId === targetColumnId);
      moveTask(activeId, targetColumnId, targetTasks.length);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeColumn = state.columns.find((c) => c.id === activeId);
    const overColumn = state.columns.find((c) => c.id === overId);

    if (activeColumn && overColumn) {
      const oldIndex = state.columns.findIndex((c) => c.id === activeId);
      const newIndex = state.columns.findIndex((c) => c.id === overId);
      
      if (oldIndex !== newIndex) {
        const newColumns = arrayMove(state.columns, oldIndex, newIndex).map(
          (col, index) => ({ ...col, order: index })
        );
        reorderColumns(newColumns);
      }
      return;
    }

    const activeTaskObj = state.tasks.find((t) => t.id === activeId);
    const overTask = state.tasks.find((t) => t.id === overId);

    if (activeTaskObj && overTask && activeTaskObj.columnId === overTask.columnId) {
      const columnTasks = state.tasks
        .filter((t) => t.columnId === activeTaskObj.columnId)
        .sort((a, b) => a.order - b.order);

      const oldIndex = columnTasks.findIndex((t) => t.id === activeId);
      const newIndex = columnTasks.findIndex((t) => t.id === overId);

      if (oldIndex !== newIndex) {
        moveTask(activeId, activeTaskObj.columnId, newIndex);
      }
    }
  };

  const handleAddColumn = () => {
    if (!newColumnTitle.trim()) return;
    addColumn(newColumnTitle.trim());
    setNewColumnTitle('');
    setIsAddingColumn(false);
  };

  const handleOpenTaskModal = (task: Task) => {
    setModalTask(task);
  };

  const handleCloseTaskModal = () => {
    setModalTask(null);
  };

  // Keep modal task in sync with state
  const currentModalTask = modalTask 
    ? state.tasks.find((t) => t.id === modalTask.id) || null 
    : null;

  const sortedColumns = [...state.columns].sort((a, b) => a.order - b.order);
  const columnIds = sortedColumns.map((c) => c.id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          <span className="text-sm">Loading your board...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Background Pattern */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-zinc-950 pointer-events-none" />
      <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyNzI3MmEiIGZpbGwtb3BhY2l0eT0iMC4yIj48Y2lyY2xlIGN4PSIxIiBjeT0iMSIgcj0iMSIvPjwvZz48L2c+PC9zdmc+')] opacity-50 pointer-events-none" />

      {/* Backup Reminder */}
      <BackupReminder onExport={() => setExportTrigger(prev => prev + 1)} />

      {/* Header */}
      <header className="relative z-20 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-md">
        <div className="px-6 py-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-zinc-800 rounded-lg">
                <Layout className="w-5 h-5 text-zinc-300" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">
                  Taskboard
                </h1>
                <p className="text-xs text-zinc-500 hidden sm:block">
                  Simple. Intuitive. No subscriptions.
                </p>
              </div>
            </div>

            <div className="flex-1 flex justify-center">
              <SearchBar
                tasks={state.tasks}
                columns={state.columns}
                tags={state.tags}
                onOpenTask={(taskId, _columnId) => {
                  const task = state.tasks.find(t => t.id === taskId);
                  if (task) handleOpenTaskModal(task);
                }}
                onCreateTask={(columnId, title) => {
                  addTask(columnId, title);
                }}
              />
            </div>

            <BackupControls
              state={state}
              onImport={importBoardState}
              onExportClick={() => setExportTrigger(prev => prev + 1)}
            />
          </div>
        </div>
      </header>

      {/* Board */}
      <main className="relative z-10 flex-1 overflow-x-auto">
        <div className="p-6 min-h-full">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex items-start gap-4">
              <SortableContext
                items={columnIds}
                strategy={horizontalListSortingStrategy}
              >
                {sortedColumns.map((column) => (
                  <Column
                    key={column.id}
                    column={column}
                    tasks={state.tasks.filter((t) => t.columnId === column.id)}
                    tags={state.tags}
                    onUpdateColumn={updateColumn}
                    onDeleteColumn={deleteColumn}
                    onAddTask={addTask}
                    onUpdateTask={updateTask}
                    onDeleteTask={deleteTask}
                    onSetColumnTasksStatus={setColumnTasksStatus}
                    onOpenTaskModal={handleOpenTaskModal}
                  />
                ))}
              </SortableContext>

              {/* Add Column */}
              <div className="flex-shrink-0 w-72">
                {isAddingColumn ? (
                  <div className="bg-zinc-900/50 backdrop-blur-md rounded-xl border border-zinc-800 p-3 space-y-3">
                    <input
                      type="text"
                      value={newColumnTitle}
                      onChange={(e) => setNewColumnTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddColumn();
                        if (e.key === 'Escape') {
                          setIsAddingColumn(false);
                          setNewColumnTitle('');
                        }
                      }}
                      placeholder="Column title..."
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAddColumn}
                        disabled={!newColumnTitle.trim()}
                        className="px-3 py-1.5 text-xs font-medium bg-zinc-100 text-zinc-900 rounded-md hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add column
                      </button>
                      <button
                        onClick={() => {
                          setIsAddingColumn(false);
                          setNewColumnTitle('');
                        }}
                        className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAddingColumn(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-900/30 hover:bg-zinc-900/50 border border-dashed border-zinc-800 hover:border-zinc-700 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Add column
                  </button>
                )}
              </div>
            </div>

            <DragOverlay>
              {activeTask && (
                <div className="w-72 opacity-90">
                  <TaskCard
                    task={activeTask}
                    tags={state.tags}
                    onUpdate={() => {}}
                    onDelete={() => {}}
                    onOpenModal={() => {}}
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-800/50 bg-zinc-950/80 backdrop-blur-md">
        <div className="px-6 py-3 flex items-center justify-between text-xs text-zinc-600">
          <span>All data stored locally in your browser</span>
          <span>{state.tasks.length} task{state.tasks.length !== 1 && 's'}</span>
        </div>
      </footer>

      {/* Task Modal */}
      {currentModalTask && (
        <TaskModal
          task={currentModalTask}
          tags={state.tags}
          onUpdate={updateTask}
          onClose={handleCloseTaskModal}
          onAddTag={addTag}
        />
      )}

      {/* Recovery Notification */}
      {showRecoveryNotification && recoveryInfo.recovered && recoveryInfo.source && (
        <RecoveryNotification
          source={recoveryInfo.source}
          onDismiss={() => setShowRecoveryNotification(false)}
        />
      )}
    </div>
  );
}
