import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, Priority, Status, Tag } from '../types';
import { cn } from '../utils/cn';
import {
  GripVertical,
  ChevronDown,
  Circle,
  Clock,
  Pause,
  CheckCircle2,
  AlertCircle,
  Maximize2,
  CheckSquare,
  MessageSquare,
  Paperclip,
} from 'lucide-react';

interface TaskCardProps {
  task: Task;
  tags: Tag[];
  onUpdate: (taskId: string, updates: Partial<Task>) => void;
  onDelete: (taskId: string) => void;
  onOpenModal: (task: Task) => void;
  zIndex?: number;
}

interface DropdownPosition {
  top: number;
  left: number;
  placement: 'bottom' | 'top';
  alignment: 'left' | 'right';
}

const priorityConfig: Record<Priority, { label: string; color: string; bg: string; border: string }> = {
  urgent: { label: 'U', color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-l-red-500' },
  high: { label: 'H', color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-l-orange-500' },
  medium: { label: 'M', color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-l-yellow-500' },
  low: { label: 'L', color: 'text-zinc-400', bg: 'bg-zinc-500/20', border: 'border-l-zinc-500' },
};

const statusConfig: Record<Status, { label: string; color: string; icon: React.ReactNode }> = {
  'not-started': { label: 'Not Started', color: 'text-zinc-500', icon: <Circle className="w-3.5 h-3.5" /> },
  'in-progress': { label: 'In Progress', color: 'text-blue-400', icon: <Clock className="w-3.5 h-3.5" /> },
  'paused': { label: 'Paused', color: 'text-amber-400', icon: <Pause className="w-3.5 h-3.5" /> },
  'done': { label: 'Done', color: 'text-green-400', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
};

// Smart dropdown positioning that avoids viewport overflow
function calculateDropdownPosition(
  triggerRect: DOMRect,
  dropdownWidth: number,
  dropdownHeight: number,
  padding: number = 8
): DropdownPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Start with default: below trigger, aligned left
  let placement: 'bottom' | 'top' = 'bottom';
  let alignment: 'left' | 'right' = 'left';
  
  // Check if dropdown would overflow bottom
  const spaceBelow = viewportHeight - triggerRect.bottom - padding;
  const spaceAbove = triggerRect.top - padding;
  
  if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
    placement = 'top';
  }
  
  // Check if dropdown would overflow right
  const spaceRight = viewportWidth - triggerRect.left - padding;
  const spaceLeft = triggerRect.right - padding;
  
  if (spaceRight < dropdownWidth && spaceLeft > spaceRight) {
    alignment = 'right';
  }
  
  // Calculate final coordinates
  let top: number;
  let left: number;
  
  if (placement === 'bottom') {
    top = triggerRect.bottom + 4;
  } else {
    top = triggerRect.top - dropdownHeight - 4;
  }
  
  if (alignment === 'left') {
    left = triggerRect.left;
  } else {
    left = triggerRect.right - dropdownWidth;
  }
  
  // Final boundary checks - ensure we don't go off screen
  left = Math.max(padding, Math.min(left, viewportWidth - dropdownWidth - padding));
  top = Math.max(padding, Math.min(top, viewportHeight - dropdownHeight - padding));
  
  return { top, left, placement, alignment };
}

interface PortalDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  children: React.ReactNode;
  width?: number;
  estimatedHeight?: number;
}

function PortalDropdown({ isOpen, onClose, triggerRef, children, width = 120, estimatedHeight = 140 }: PortalDropdownProps) {
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
      
      // Recalculate on scroll or resize
      const handleScrollOrResize = () => updatePosition();
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      
      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [isOpen, updatePosition]);

  // Close on click outside
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
    
    // Small delay to prevent immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, triggerRef]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
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

export function TaskCard({ task, tags, onUpdate, onOpenModal, zIndex = 1 }: TaskCardProps) {
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  
  const priorityBtnRef = useRef<HTMLButtonElement>(null);
  const statusBtnRef = useRef<HTMLButtonElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : zIndex,
  };

  const handlePriorityChange = (priority: Priority) => {
    onUpdate(task.id, { priority });
    setShowPriorityMenu(false);
  };

  const handleStatusChange = (status: Status) => {
    onUpdate(task.id, { status });
    setShowStatusMenu(false);
  };

  const priority = priorityConfig[task.priority];
  const status = statusConfig[task.status];
  const taskTags = tags.filter((tag) => task.tags.includes(tag.id));
  const completedSubtasks = task.subtasks.filter((st) => st.completed).length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onDoubleClick={() => onOpenModal(task)}
      className={cn(
        'group relative rounded-lg border-l-2 border border-zinc-800 bg-zinc-900/80 backdrop-blur-sm',
        priority.border,
        'transition-all duration-200',
        isDragging && 'opacity-50 shadow-2xl shadow-zinc-950 scale-105',
        !isDragging && 'hover:border-zinc-700 hover:bg-zinc-900',
        task.status === 'done' && 'opacity-60',
        'cursor-default select-none'
      )}
    >
      <div className="p-3">
        {/* Header Row */}
        <div className="flex items-start gap-2">
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 flex-shrink-0 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-zinc-400"
          >
            <GripVertical className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0">
            {/* Tags */}
            {taskTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5">
                {taskTags.slice(0, 3).map((tag) => (
                  <span
                    key={tag.id}
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                    style={{ backgroundColor: `${tag.color}25`, color: tag.color }}
                  >
                    {tag.name}
                  </span>
                ))}
                {taskTags.length > 3 && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-zinc-500 bg-zinc-800">
                    +{taskTags.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Title */}
            <p
              className={cn(
                'text-sm text-zinc-200 leading-relaxed cursor-pointer hover:text-white transition-colors',
                task.status === 'done' && 'line-through text-zinc-400'
              )}
              onClick={() => onOpenModal(task)}
            >
              {task.title}
            </p>
          </div>

          {/* Open Modal Button */}
          <button
            onClick={() => onOpenModal(task)}
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-zinc-300 p-1 hover:bg-zinc-800 rounded"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Meta Info Row */}
        <div className="flex items-center gap-2 mt-2.5 text-[10px] text-zinc-500">
          {task.subtasks.length > 0 && (
            <div className={cn(
              'flex items-center gap-1',
              completedSubtasks === task.subtasks.length && 'text-green-500'
            )}>
              <CheckSquare className="w-3 h-3" />
              <span>{completedSubtasks}/{task.subtasks.length}</span>
            </div>
          )}
          {task.notes.length > 0 && (
            <div className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              <span>{task.notes.length}</span>
            </div>
          )}
          {task.attachments.length > 0 && (
            <div className="flex items-center gap-1">
              <Paperclip className="w-3 h-3" />
              <span>{task.attachments.length}</span>
            </div>
          )}
        </div>

        {/* Controls Row */}
        <div className="flex items-center gap-1.5 mt-2.5">
          {/* Status Dropdown */}
          <div className="relative">
            <button
              ref={statusBtnRef}
              onClick={(e) => {
                e.stopPropagation();
                setShowStatusMenu(!showStatusMenu);
                setShowPriorityMenu(false);
              }}
              className={cn(
                'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors hover:bg-zinc-800',
                status.color
              )}
            >
              {status.icon}
              <ChevronDown className="w-2.5 h-2.5 opacity-60" />
            </button>

            <PortalDropdown
              isOpen={showStatusMenu}
              onClose={() => setShowStatusMenu(false)}
              triggerRef={statusBtnRef}
              width={130}
              estimatedHeight={136}
            >
              {(Object.keys(statusConfig) as Status[]).map((s) => (
                <button
                  key={s}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusChange(s);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-zinc-700 transition-colors',
                    statusConfig[s].color,
                    task.status === s && 'bg-zinc-700/50'
                  )}
                >
                  {statusConfig[s].icon}
                  {statusConfig[s].label}
                </button>
              ))}
            </PortalDropdown>
          </div>

          {/* Priority Dropdown */}
          <div className="relative">
            <button
              ref={priorityBtnRef}
              onClick={(e) => {
                e.stopPropagation();
                setShowPriorityMenu(!showPriorityMenu);
                setShowStatusMenu(false);
              }}
              className={cn(
                'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors',
                priority.bg,
                priority.color
              )}
            >
              {task.priority === 'urgent' ? (
                <AlertCircle className="w-3 h-3" />
              ) : (
                <Circle className="w-2.5 h-2.5 fill-current" />
              )}
              {priority.label}
              <ChevronDown className="w-2.5 h-2.5 opacity-60" />
            </button>

            <PortalDropdown
              isOpen={showPriorityMenu}
              onClose={() => setShowPriorityMenu(false)}
              triggerRef={priorityBtnRef}
              width={110}
              estimatedHeight={136}
            >
              {(Object.keys(priorityConfig) as Priority[]).map((p) => (
                <button
                  key={p}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePriorityChange(p);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-zinc-700 transition-colors',
                    priorityConfig[p].color,
                    task.priority === p && 'bg-zinc-700/50'
                  )}
                >
                  {p === 'urgent' ? (
                    <AlertCircle className="w-3 h-3" />
                  ) : (
                    <Circle className="w-2.5 h-2.5 fill-current" />
                  )}
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </PortalDropdown>
          </div>
        </div>
      </div>
    </div>
  );
}
