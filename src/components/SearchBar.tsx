import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, X, FileText, CheckSquare, Tag, Paperclip, MessageSquare, ArrowRight } from 'lucide-react';
import { Column, Tag as TagType, Status, Task } from '../types';
import { fuzzySearchTasks, TaskSearchResult, highlightMatches, getMatchPreview } from '../utils/fuzzySearch';

interface SearchBarProps {
  tasks: Task[];
  columns: Column[];
  tags: TagType[];
  onOpenTask: (taskId: string, columnId: string) => void;
  onCreateTask: (columnId: string, title: string) => void;
}

const STATUS_ICONS: Record<Status, string> = {
  'not-started': '○',
  'in-progress': '◐',
  'paused': '❚❚',
  'done': '●',
};

const STATUS_COLORS: Record<Status, string> = {
  'not-started': 'text-zinc-500',
  'in-progress': 'text-blue-400',
  'paused': 'text-amber-400',
  'done': 'text-emerald-400',
};

const FIELD_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  title: { label: 'Title', icon: <FileText className="w-3 h-3" /> },
  description: { label: 'Description', icon: <FileText className="w-3 h-3" /> },
  tag: { label: 'Tag', icon: <Tag className="w-3 h-3" /> },
  subtask: { label: 'Checklist', icon: <CheckSquare className="w-3 h-3" /> },
  note: { label: 'Note', icon: <MessageSquare className="w-3 h-3" /> },
  attachment: { label: 'Attachment', icon: <Paperclip className="w-3 h-3" /> },
  status: { label: 'Status', icon: <ArrowRight className="w-3 h-3" /> },
  priority: { label: 'Priority', icon: <ArrowRight className="w-3 h-3" /> },
};

export const SearchBar: React.FC<SearchBarProps> = ({
  tasks,
  columns,
  tags,
  onOpenTask,
  onCreateTask,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Create columns with tasks for fuzzy search
  const columnsWithTasks = useMemo(() => {
    return columns.map(col => ({
      ...col,
      tasks: tasks.filter(t => t.columnId === col.id)
    }));
  }, [columns, tasks]);

  // Fuzzy search results
  const results = useMemo(() => {
    return fuzzySearchTasks(columnsWithTasks, query, tags);
  }, [columnsWithTasks, query, tags]);

  // Calculate dropdown position
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 480),
      });
    }
  }, [isOpen, query]);

  // Keyboard shortcut to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Calculate total items (results + create options)
  const createOptions = query.trim() ? columns : [];
  const totalItems = results.length + createOptions.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, totalItems - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && totalItems > 0) {
      e.preventDefault();
      if (selectedIndex < results.length) {
        const result = results[selectedIndex];
        onOpenTask(result.taskId, result.columnId);
        setQuery('');
        setIsOpen(false);
      } else {
        const createIndex = selectedIndex - results.length;
        onCreateTask(createOptions[createIndex].id, query.trim());
        setQuery('');
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleResultClick = (result: TaskSearchResult) => {
    onOpenTask(result.taskId, result.columnId);
    setQuery('');
    setIsOpen(false);
  };

  const handleCreateClick = (columnId: string) => {
    onCreateTask(columnId, query.trim());
    setQuery('');
    setIsOpen(false);
  };

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Group matches by field type for better display
  const getGroupedMatches = (result: TaskSearchResult) => {
    const grouped: Record<string, typeof result.matches> = {};
    for (const match of result.matches) {
      if (!grouped[match.field]) {
        grouped[match.field] = [];
      }
      grouped[match.field].push(match);
    }
    return grouped;
  };

  // Render highlighted text
  const renderHighlightedText = (text: string, indices: [number, number][]) => {
    const parts = highlightMatches(text, indices);
    return (
      <span>
        {parts.map((part, i) => (
          <span
            key={i}
            className={part.highlight ? 'bg-amber-500/30 text-amber-200 rounded px-0.5' : ''}
          >
            {part.text}
          </span>
        ))}
      </span>
    );
  };

  const showDropdown = isOpen && query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search tasks... (⌘K)"
          className="w-64 lg:w-80 pl-9 pr-8 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent transition-all"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-zinc-700 rounded"
          >
            <X className="w-3 h-3 text-zinc-500" />
          </button>
        )}
      </div>

      {showDropdown &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              zIndex: 10000,
            }}
            className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
          >
            {/* Results */}
            {results.length > 0 && (
              <div className="max-h-96 overflow-y-auto">
                <div className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                  {results.length} result{results.length !== 1 ? 's' : ''} found
                </div>
                {results.map((result, index) => {
                  const column = columns.find((c) => c.id === result.columnId);
                  const groupedMatches = getGroupedMatches(result);
                  const taskTags = result.task.tags
                    ?.map((tagId: string) => tags.find((t) => t.id === tagId))
                    .filter(Boolean);
                  const taskStatus = result.task.status as Status;

                  return (
                    <button
                      key={result.taskId}
                      onClick={() => handleResultClick(result)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full px-3 py-3 text-left transition-colors ${
                        selectedIndex === index ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                      }`}
                    >
                      {/* Task title and status */}
                      <div className="flex items-start gap-2">
                        <span className={`text-sm ${STATUS_COLORS[taskStatus]}`}>
                          {STATUS_ICONS[taskStatus]}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${
                              result.task.status === 'done' ? 'text-zinc-500 line-through' : 'text-zinc-200'
                            }`}>
                              {groupedMatches.title ? (
                                renderHighlightedText(
                                  result.task.title,
                                  groupedMatches.title[0].indices
                                )
                              ) : (
                                result.task.title
                              )}
                            </span>
                            {/* Priority indicator */}
                            <span className={`w-2 h-2 rounded-full ${
                              result.task.priority === 'urgent' ? 'bg-red-500' :
                              result.task.priority === 'high' ? 'bg-orange-500' :
                              result.task.priority === 'medium' ? 'bg-yellow-500' :
                              'bg-zinc-600'
                            }`} />
                          </div>
                          
                          {/* Column location */}
                          <div className="text-xs text-zinc-500 mt-0.5">
                            in <span className="text-zinc-400">{column?.title}</span>
                          </div>

                          {/* Tags */}
                          {taskTags && taskTags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {taskTags.slice(0, 4).map((tag: TagType) => {
                                const isTagMatch = groupedMatches.tag?.some(m => m.value === tag.name);
                                return (
                                  <span
                                    key={tag.id}
                                    className={`px-1.5 py-0.5 text-xs rounded ${
                                      isTagMatch 
                                        ? 'ring-1 ring-amber-500/50 bg-amber-500/20' 
                                        : ''
                                    }`}
                                    style={{ 
                                      backgroundColor: isTagMatch ? undefined : `${tag.color}20`,
                                      color: tag.color
                                    }}
                                  >
                                    {tag.name}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Match details */}
                          <div className="mt-2 space-y-1">
                            {Object.entries(groupedMatches)
                              .filter(([field]) => field !== 'title' && field !== 'tag')
                              .slice(0, 3)
                              .map(([field, matches]) => {
                                const fieldInfo = FIELD_LABELS[field] || { label: field, icon: null };
                                const match = matches[0];
                                const preview = getMatchPreview(match.value, match.indices, 80);
                                
                                return (
                                  <div
                                    key={`${field}-${match.value}`}
                                    className="flex items-start gap-1.5 text-xs"
                                  >
                                    <span className="flex items-center gap-1 text-zinc-500 shrink-0">
                                      {fieldInfo.icon}
                                      <span>{fieldInfo.label}:</span>
                                    </span>
                                    <span className="text-zinc-400 truncate">
                                      {preview}
                                    </span>
                                  </div>
                                );
                              })}
                          </div>

                          {/* Score indicator (subtle) */}
                          <div className="flex items-center gap-2 mt-2">
                            <div className="h-1 flex-1 bg-zinc-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-zinc-600 to-zinc-500 rounded-full"
                                style={{ width: `${Math.min(100, result.totalScore / 5)}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-zinc-600">{Math.round(result.totalScore)}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Create options */}
            {query.trim() && (
              <div className="border-t border-zinc-800">
                <div className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Create new task
                </div>
                {createOptions.map((column, index) => {
                  const itemIndex = results.length + index;
                  return (
                    <button
                      key={column.id}
                      onClick={() => handleCreateClick(column.id)}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                      className={`w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors ${
                        selectedIndex === itemIndex ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-md bg-emerald-500/20 flex items-center justify-center">
                        <Plus className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-zinc-300">
                          Create "<span className="text-white font-medium">{query.trim()}</span>"
                        </span>
                        <span className="text-xs text-zinc-500 ml-2">
                          in {column.title}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Empty state */}
            {results.length === 0 && query.trim() && (
              <div className="px-4 py-6 text-center">
                <Search className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No tasks found for "{query}"</p>
                <p className="text-xs text-zinc-600 mt-1">Try a different search or create a new task</p>
              </div>
            )}

            {/* Search tips */}
            <div className="px-3 py-2 bg-zinc-900/50 border-t border-zinc-800">
              <div className="flex items-center justify-between text-[10px] text-zinc-600">
                <span>Search by title, description, tags, notes, checklist items, attachments...</span>
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-zinc-800 rounded">↑↓</span>
                  <span>Navigate</span>
                  <span className="px-1.5 py-0.5 bg-zinc-800 rounded">↵</span>
                  <span>Select</span>
                  <span className="px-1.5 py-0.5 bg-zinc-800 rounded">Esc</span>
                  <span>Close</span>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
