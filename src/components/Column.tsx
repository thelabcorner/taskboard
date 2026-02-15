import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { Column as ColumnType, Task, Tag, Status } from '../types';
import { TaskCard } from './TaskCard';
import { cn } from '../utils/cn';
import { 
  Plus, 
  MoreHorizontal, 
  Trash2, 
  GripVertical,
  Circle,
  Clock,
  Pause,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';

interface ColumnProps {
  column: ColumnType;
  tasks: Task[];
  tags: Tag[];
  onUpdateColumn: (columnId: string, title: string) => void;
  onDeleteColumn: (columnId: string) => void;
  onAddTask: (columnId: string, title: string) => Task;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onSetColumnTasksStatus: (columnId: string, status: Status) => void;
  onOpenTaskModal: (task: Task) => void;
}

const statusConfig: Record<Status, { label: string; color: string; icon: React.ReactNode }> = {
  'not-started': { label: 'Not Started', color: 'text-zinc-400', icon: <Circle className="w-3.5 h-3.5" /> },
  'in-progress': { label: 'In Progress', color: 'text-blue-400', icon: <Clock className="w-3.5 h-3.5" /> },
  'paused': { label: 'Paused', color: 'text-amber-400', icon: <Pause className="w-3.5 h-3.5" /> },
  'done': { label: 'Done', color: 'text-green-400', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
};

interface DropdownPosition {
  top: number;
  left: number;
}

function calculateDropdownPosition(
  triggerRect: DOMRect,
  dropdownWidth: number,
  dropdownHeight: number,
  padding: number = 8,
  preferLeft: boolean = false
): DropdownPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  let top: number;
  let left: number;
  
  // Vertical positioning - prefer below, but go above if not enough space
  const spaceBelow = viewportHeight - triggerRect.bottom - padding;
  const spaceAbove = triggerRect.top - padding;
  
  if (spaceBelow >= dropdownHeight || spaceBelow >= spaceAbove) {
    top = triggerRect.bottom + 4;
  } else {
    top = triggerRect.top - dropdownHeight - 4;
  }
  
  // Horizontal positioning
  if (preferLeft) {
    // Position to the left of trigger (for submenus that would overflow right)
    left = triggerRect.left - dropdownWidth - 4;
    if (left < padding) {
      left = triggerRect.right + 4;
    }
  } else {
    // Default: align with right edge of trigger
    left = triggerRect.right - dropdownWidth;
    if (left < padding) {
      left = triggerRect.left;
    }
  }
  
  // Final boundary checks
  left = Math.max(padding, Math.min(left, viewportWidth - dropdownWidth - padding));
  top = Math.max(padding, Math.min(top, viewportHeight - dropdownHeight - padding));
  
  return { top, left };
}

function calculateSubmenuPosition(
  parentRect: DOMRect,
  submenuWidth: number,
  submenuHeight: number,
  padding: number = 8
): DropdownPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  let top = parentRect.top;
  let left = parentRect.right + 4;
  
  // Check if submenu would overflow right - if so, position to the left
  if (left + submenuWidth > viewportWidth - padding) {
    left = parentRect.left - submenuWidth - 4;
  }
  
  // If still overflowing left, just position at left edge
  if (left < padding) {
    left = padding;
  }
  
  // Vertical positioning - keep aligned with parent item, but ensure visibility
  if (top + submenuHeight > viewportHeight - padding) {
    top = viewportHeight - submenuHeight - padding;
  }
  top = Math.max(padding, top);
  
  return { top, left };
}

interface PortalDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  children: React.ReactNode;
  width?: number;
  estimatedHeight?: number;
}

function PortalDropdown({ isOpen, onClose, triggerRef, children, width = 180, estimatedHeight = 100 }: PortalDropdownProps) {
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !isOpen) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const pos = calculateDropdownPosition(triggerRect, width, estimatedHeight);
    setPosition(pos);
  }, [triggerRef, isOpen, width, estimatedHeight]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScrollOrResize = () => updatePosition();
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        onClose();
      }
    };
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, triggerRef]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !position) return null;

  return createPortal(
    <div
      ref={dropdownRef}
      className="fixed bg-zinc-800 border border-zinc-700 rounded-lg shadow-2xl shadow-black/50 py-1 animate-in fade-in-0 zoom-in-95 duration-100"
      style={{
        top: position.top,
        left: position.left,
        minWidth: width,
        zIndex: 9999,
      }}
    >
      {children}
    </div>,
    document.body
  );
}

// Submenu component that positions itself relative to parent item
interface StatusSubmenuProps {
  isOpen: boolean;
  onClose: () => void;
  parentRef: React.RefObject<HTMLButtonElement | null>;
  onSelectStatus: (status: Status) => void;
}

function StatusSubmenu({ isOpen, onClose, parentRef, onSelectStatus }: StatusSubmenuProps) {
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  const submenuRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!parentRef.current || !isOpen) return;
    const parentRect = parentRef.current.getBoundingClientRect();
    const pos = calculateSubmenuPosition(parentRect, 140, 145);
    setPosition(pos);
  }, [parentRef, isOpen]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScrollOrResize = () => updatePosition();
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        submenuRef.current && 
        !submenuRef.current.contains(target) &&
        parentRef.current &&
        !parentRef.current.contains(target)
      ) {
        onClose();
      }
    };
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, parentRef]);

  if (!isOpen || !position) return null;

  return createPortal(
    <div
      ref={submenuRef}
      className="fixed bg-zinc-800 border border-zinc-700 rounded-lg shadow-2xl shadow-black/50 py-1 animate-in fade-in-0 zoom-in-95 duration-100"
      style={{
        top: position.top,
        left: position.left,
        minWidth: 140,
        zIndex: 10000,
      }}
    >
      {(Object.keys(statusConfig) as Status[]).map((status) => (
        <button
          key={status}
          onClick={(e) => {
            e.stopPropagation();
            onSelectStatus(status);
          }}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-zinc-700 transition-colors',
            statusConfig[status].color
          )}
        >
          {statusConfig[status].icon}
          {statusConfig[status].label}
        </button>
      ))}
    </div>,
    document.body
  );
}

export function Column({
  column,
  tasks,
  tags,
  onUpdateColumn,
  onDeleteColumn,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onSetColumnTasksStatus,
  onOpenTaskModal,
}: ColumnProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(column.title);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showStatusSubmenu, setShowStatusSubmenu] = useState(false);

  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const statusBtnRef = useRef<HTMLButtonElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const { setNodeRef: setDroppableRef } = useDroppable({
    id: column.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleTitleSave = () => {
    if (editTitle.trim()) {
      onUpdateColumn(column.id, editTitle.trim());
    } else {
      setEditTitle(column.title);
    }
    setIsEditing(false);
  };

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    onAddTask(column.id, newTaskTitle.trim());
    setNewTaskTitle('');
    setIsAddingTask(false);
  };

  const handleCloseMenu = () => {
    setShowMenu(false);
    setShowStatusSubmenu(false);
  };

  const handleSelectStatus = (status: Status) => {
    onSetColumnTasksStatus(column.id, status);
    handleCloseMenu();
  };

  const sortedTasks = [...tasks].sort((a, b) => a.order - b.order);
  const taskIds = sortedTasks.map((t) => t.id);
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'done').length;

  return (
    <div
      ref={setSortableRef}
      style={style}
      className={cn(
        'flex-shrink-0 w-72 flex flex-col max-h-full',
        isDragging && 'opacity-50'
      )}
    >
      <div className="bg-zinc-900/50 backdrop-blur-md rounded-xl border border-zinc-800/80 flex flex-col max-h-full">
        {/* Column Header */}
        <div className="p-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <GripVertical className="w-4 h-4" />
            </button>

            {isEditing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSave();
                  if (e.key === 'Escape') {
                    setEditTitle(column.title);
                    setIsEditing(false);
                  }
                }}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm font-medium text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                autoFocus
              />
            ) : (
              <h3
                onClick={() => setIsEditing(true)}
                className="flex-1 text-sm font-semibold text-zinc-200 cursor-text"
              >
                {column.title}
              </h3>
            )}

            <div className="flex items-center gap-1.5">
              {totalTasks > 0 && (
                <span className="text-[10px] text-zinc-500 font-medium tabular-nums bg-zinc-800 px-1.5 py-0.5 rounded">
                  {doneTasks}/{totalTasks}
                </span>
              )}

              <button
                ref={menuBtnRef}
                onClick={() => {
                  setShowMenu(!showMenu);
                  setShowStatusSubmenu(false);
                }}
                className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors rounded hover:bg-zinc-800"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              <PortalDropdown
                isOpen={showMenu}
                onClose={handleCloseMenu}
                triggerRef={menuBtnRef}
                width={180}
                estimatedHeight={80}
              >
                {/* Mark all as status submenu trigger */}
                <button
                  ref={statusBtnRef}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowStatusSubmenu(!showStatusSubmenu);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  <span>Mark all tasks as...</span>
                  <ChevronRight className="w-3 h-3 text-zinc-500" />
                </button>

                <div className="h-px bg-zinc-700 my-1" />

                <button
                  onClick={() => {
                    onDeleteColumn(column.id);
                    handleCloseMenu();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-zinc-700 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete column
                </button>
              </PortalDropdown>

              <StatusSubmenu
                isOpen={showStatusSubmenu}
                onClose={() => setShowStatusSubmenu(false)}
                parentRef={statusBtnRef}
                onSelectStatus={handleSelectStatus}
              />
            </div>
          </div>
        </div>

        {/* Tasks */}
        <div
          ref={setDroppableRef}
          className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px]"
        >
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {sortedTasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                tags={tags}
                onUpdate={onUpdateTask}
                onDelete={onDeleteTask}
                onOpenModal={onOpenTaskModal}
                zIndex={sortedTasks.length - index}
              />
            ))}
          </SortableContext>

          {sortedTasks.length === 0 && !isAddingTask && (
            <div className="py-8 text-center text-xs text-zinc-600">
              No tasks yet
            </div>
          )}
        </div>

        {/* Add Task */}
        <div className="p-2 border-t border-zinc-800/80">
          {isAddingTask ? (
            <div className="space-y-2">
              <textarea
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddTask();
                  }
                  if (e.key === 'Escape') {
                    setIsAddingTask(false);
                    setNewTaskTitle('');
                  }
                }}
                placeholder="What needs to be done?"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600 resize-none"
                rows={2}
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddTask}
                  disabled={!newTaskTitle.trim()}
                  className="px-3 py-1.5 text-xs font-medium bg-zinc-100 text-zinc-900 rounded-md hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add task
                </button>
                <button
                  onClick={() => {
                    setIsAddingTask(false);
                    setNewTaskTitle('');
                  }}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingTask(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add task
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
