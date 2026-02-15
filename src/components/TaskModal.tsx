import { useState, useRef, useEffect } from 'react';
import {
  X,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Pause,
  Plus,
  Trash2,
  Link2,
  Image,
  FileText,
  Tag as TagIcon,
  ChevronDown,
  ExternalLink,
  Check,
  AlertCircle,
  Upload,
} from 'lucide-react';
import { Task, Priority, Status, SubNote, Subtask, Attachment, Tag, TAG_COLORS } from '../types';
import { cn } from '../utils/cn';

interface TaskModalProps {
  task: Task;
  tags: Tag[];
  onUpdate: (taskId: string, updates: Partial<Task>) => void;
  onClose: () => void;
  onAddTag: (name: string, color: string) => Tag;
}

const priorityConfig: Record<Priority, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  urgent: { label: 'Urgent', color: 'text-red-400', bg: 'bg-red-500/20', icon: <AlertCircle className="w-3.5 h-3.5" /> },
  high: { label: 'High', color: 'text-orange-400', bg: 'bg-orange-500/20', icon: <Circle className="w-3.5 h-3.5 fill-current" /> },
  medium: { label: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: <Circle className="w-3.5 h-3.5 fill-current" /> },
  low: { label: 'Low', color: 'text-zinc-400', bg: 'bg-zinc-500/20', icon: <Circle className="w-3.5 h-3.5 fill-current" /> },
};

const statusConfig: Record<Status, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  'not-started': { label: 'Not Started', color: 'text-zinc-400', bg: 'bg-zinc-500/20', icon: <Circle className="w-3.5 h-3.5" /> },
  'in-progress': { label: 'In Progress', color: 'text-blue-400', bg: 'bg-blue-500/20', icon: <Clock className="w-3.5 h-3.5" /> },
  'paused': { label: 'Paused', color: 'text-amber-400', bg: 'bg-amber-500/20', icon: <Pause className="w-3.5 h-3.5" /> },
  'done': { label: 'Done', color: 'text-green-400', bg: 'bg-green-500/20', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function TaskModal({ task, tags, onUpdate, onClose, onAddTag }: TaskModalProps) {
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description || '');
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [newSubtask, setNewSubtask] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [attachmentType, setAttachmentType] = useState<'link' | 'image' | 'file'>('link');
  const [showAttachmentForm, setShowAttachmentForm] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleTitleBlur = () => {
    if (editTitle.trim() && editTitle !== task.title) {
      onUpdate(task.id, { title: editTitle.trim() });
    }
  };

  const handleDescriptionBlur = () => {
    if (editDescription !== (task.description || '')) {
      onUpdate(task.id, { description: editDescription });
    }
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    const subtask: Subtask = {
      id: `subtask-${Date.now()}`,
      title: newSubtask.trim(),
      completed: false,
      createdAt: Date.now(),
    };
    onUpdate(task.id, { subtasks: [...task.subtasks, subtask] });
    setNewSubtask('');
  };

  const handleToggleSubtask = (subtaskId: string) => {
    const updatedSubtasks = task.subtasks.map((st) =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    onUpdate(task.id, { subtasks: updatedSubtasks });
  };

  const handleDeleteSubtask = (subtaskId: string) => {
    onUpdate(task.id, { subtasks: task.subtasks.filter((st) => st.id !== subtaskId) });
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const note: SubNote = {
      id: `note-${Date.now()}`,
      content: newNote.trim(),
      createdAt: Date.now(),
    };
    onUpdate(task.id, { notes: [...task.notes, note] });
    setNewNote('');
  };

  const handleDeleteNote = (noteId: string) => {
    onUpdate(task.id, { notes: task.notes.filter((n) => n.id !== noteId) });
  };

  const handleAddAttachment = () => {
    if (!newAttachmentUrl.trim() || !newAttachmentName.trim()) return;
    const attachment: Attachment = {
      id: `attachment-${Date.now()}`,
      type: attachmentType,
      name: newAttachmentName.trim(),
      url: newAttachmentUrl.trim(),
      createdAt: Date.now(),
    };
    onUpdate(task.id, { attachments: [...task.attachments, attachment] });
    setNewAttachmentUrl('');
    setNewAttachmentName('');
    setShowAttachmentForm(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Max 5MB for IndexedDB storage
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadError('File size must be less than 5MB');
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      const reader = new FileReader();
      
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      const isImage = file.type.startsWith('image/');
      const attachment: Attachment = {
        id: `attachment-${Date.now()}`,
        type: isImage ? 'image' : 'file',
        name: file.name,
        url: dataUrl,
        size: file.size,
        mimeType: file.type,
        createdAt: Date.now(),
      };

      onUpdate(task.id, { attachments: [...task.attachments, attachment] });
      setShowAttachmentForm(false);
    } catch (err) {
      setUploadError('Failed to upload file');
      console.error(err);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteAttachment = (attachmentId: string) => {
    onUpdate(task.id, { attachments: task.attachments.filter((a) => a.id !== attachmentId) });
  };

  const handleToggleTag = (tagId: string) => {
    const hasTag = task.tags.includes(tagId);
    const newTags = hasTag
      ? task.tags.filter((id) => id !== tagId)
      : [...task.tags, tagId];
    onUpdate(task.id, { tags: newTags });
  };

  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    const tag = onAddTag(newTagName.trim(), newTagColor);
    onUpdate(task.id, { tags: [...task.tags, tag.id] });
    setNewTagName('');
    setNewTagColor(TAG_COLORS[0]);
  };

  const completedSubtasks = task.subtasks.filter((st) => st.completed).length;
  const taskTags = tags.filter((tag) => task.tags.includes(tag.id));

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleTitleBlur}
              className="flex-1 text-lg font-semibold text-zinc-100 bg-transparent border-none outline-none focus:ring-0 placeholder:text-zinc-500"
              placeholder="Task title..."
            />
            <button
              onClick={onClose}
              className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {taskTags.map((tag) => (
              <span
                key={tag.id}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: `${tag.color}25`, color: tag.color }}
              >
                {tag.name}
                <button
                  onClick={() => handleToggleTag(tag.id)}
                  className="ml-0.5 opacity-60 hover:opacity-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <div className="relative">
              <button
                onClick={() => setShowTagMenu(!showTagMenu)}
                className="flex items-center gap-1 px-2 py-0.5 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-full transition-colors"
              >
                <TagIcon className="w-3 h-3" />
                Add tag
              </button>
              {showTagMenu && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowTagMenu(false)} />
                  <div className="absolute top-full left-0 mt-1 z-30 w-56 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl p-2">
                    <div className="max-h-32 overflow-y-auto space-y-0.5 mb-2">
                      {tags.map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => handleToggleTag(tag.id)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-700 transition-colors"
                        >
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="flex-1 text-xs text-zinc-300 text-left">{tag.name}</span>
                          {task.tags.includes(tag.id) && (
                            <Check className="w-3 h-3 text-green-400" />
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-zinc-700 pt-2">
                      <input
                        type="text"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newTagName.trim()) {
                            handleCreateTag();
                          }
                        }}
                        placeholder="New tag name..."
                        className="w-full text-xs bg-zinc-700 rounded px-2 py-1.5 text-zinc-200 placeholder:text-zinc-500 focus:outline-none mb-2"
                      />
                      <div className="flex items-center gap-1 mb-2">
                        {TAG_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setNewTagColor(color)}
                            className={cn(
                              'w-5 h-5 rounded-full transition-transform',
                              newTagColor === color && 'ring-2 ring-white ring-offset-1 ring-offset-zinc-800 scale-110'
                            )}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <button
                        onClick={handleCreateTag}
                        disabled={!newTagName.trim()}
                        className="w-full text-xs bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed rounded py-1.5 text-zinc-200 transition-colors"
                      >
                        Create tag
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status & Priority Row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Status */}
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  statusConfig[task.status].bg,
                  statusConfig[task.status].color
                )}
              >
                {statusConfig[task.status].icon}
                {statusConfig[task.status].label}
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </button>
              {showStatusMenu && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowStatusMenu(false)} />
                  <div className="absolute top-full left-0 mt-1 z-30 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[140px]">
                    {(Object.keys(statusConfig) as Status[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          onUpdate(task.id, { status: s });
                          setShowStatusMenu(false);
                        }}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-700 transition-colors',
                          statusConfig[s].color
                        )}
                      >
                        {statusConfig[s].icon}
                        {statusConfig[s].label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Priority */}
            <div className="relative">
              <button
                onClick={() => setShowPriorityMenu(!showPriorityMenu)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  priorityConfig[task.priority].bg,
                  priorityConfig[task.priority].color
                )}
              >
                {priorityConfig[task.priority].icon}
                {priorityConfig[task.priority].label}
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </button>
              {showPriorityMenu && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowPriorityMenu(false)} />
                  <div className="absolute top-full left-0 mt-1 z-30 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[120px]">
                    {(Object.keys(priorityConfig) as Priority[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => {
                          onUpdate(task.id, { priority: p });
                          setShowPriorityMenu(false);
                        }}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-700 transition-colors',
                          priorityConfig[p].color
                        )}
                      >
                        {priorityConfig[p].icon}
                        {priorityConfig[p].label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="flex items-center gap-6 text-xs text-zinc-500">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" />
              <span>Created {formatDate(task.createdAt)}</span>
            </div>
            {task.completedAt && (
              <div className="flex items-center gap-2 text-green-500">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Completed {formatDate(task.completedAt)}</span>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
              Description
            </label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              placeholder="Add a description..."
              className="w-full mt-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 resize-none min-h-[80px]"
            />
          </div>

          {/* Subtasks / Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Checklist
              </label>
              {task.subtasks.length > 0 && (
                <span className="text-xs text-zinc-500">
                  {completedSubtasks}/{task.subtasks.length}
                </span>
              )}
            </div>
            {task.subtasks.length > 0 && (
              <div className="mb-3 h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${(completedSubtasks / task.subtasks.length) * 100}%` }}
                />
              </div>
            )}
            <div className="space-y-1.5">
              {task.subtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  className="group flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-800/50 transition-colors"
                >
                  <button
                    onClick={() => handleToggleSubtask(subtask.id)}
                    className={cn(
                      'flex-shrink-0 transition-colors',
                      subtask.completed ? 'text-green-500' : 'text-zinc-600 hover:text-zinc-400'
                    )}
                  >
                    {subtask.completed ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Circle className="w-4 h-4" />
                    )}
                  </button>
                  <span
                    className={cn(
                      'flex-1 text-sm transition-colors',
                      subtask.completed ? 'text-zinc-500 line-through' : 'text-zinc-300'
                    )}
                  >
                    {subtask.title}
                  </span>
                  <button
                    onClick={() => handleDeleteSubtask(subtask.id)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                placeholder="Add checklist item..."
                className="flex-1 text-sm bg-transparent border-b border-zinc-700 focus:border-zinc-500 py-1.5 text-zinc-300 placeholder:text-zinc-600 focus:outline-none transition-colors"
              />
              {newSubtask && (
                <button
                  onClick={handleAddSubtask}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
              Notes
            </label>
            <div className="mt-2 space-y-2">
              {task.notes.map((note) => (
                <div
                  key={note.id}
                  className="group flex items-start gap-2 p-2 bg-zinc-800/50 rounded-lg"
                >
                  <span className="flex-1 text-sm text-zinc-300">{note.content}</span>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                placeholder="Add a note..."
                className="flex-1 text-sm bg-transparent border-b border-zinc-700 focus:border-zinc-500 py-1.5 text-zinc-300 placeholder:text-zinc-600 focus:outline-none transition-colors"
              />
              {newNote && (
                <button
                  onClick={handleAddNote}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Attachments */}
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
              Attachments
            </label>
            <div className="mt-2 space-y-2">
              {task.attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="group flex items-center gap-3 p-2 bg-zinc-800/50 rounded-lg"
                >
                  {/* Image preview */}
                  {attachment.type === 'image' && attachment.url.startsWith('data:') ? (
                    <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-zinc-700">
                      <img 
                        src={attachment.url} 
                        alt={attachment.name} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className={cn(
                      'p-1.5 rounded flex-shrink-0',
                      attachment.type === 'link' && 'bg-blue-500/20 text-blue-400',
                      attachment.type === 'image' && 'bg-purple-500/20 text-purple-400',
                      attachment.type === 'file' && 'bg-zinc-500/20 text-zinc-400'
                    )}>
                      {attachment.type === 'link' && <Link2 className="w-4 h-4" />}
                      {attachment.type === 'image' && <Image className="w-4 h-4" />}
                      {attachment.type === 'file' && <FileText className="w-4 h-4" />}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-300 truncate">{attachment.name}</p>
                    <p className="text-xs text-zinc-600 truncate">
                      {attachment.size ? formatFileSize(attachment.size) : attachment.url.slice(0, 40)}
                    </p>
                  </div>
                  {attachment.url.startsWith('data:') ? (
                    <a
                      href={attachment.url}
                      download={attachment.name}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors"
                      title="Download"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : (
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={() => handleDeleteAttachment(attachment.id)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {showAttachmentForm ? (
              <div className="mt-3 p-3 bg-zinc-800/30 rounded-lg border border-zinc-700/50 space-y-3">
                <div className="flex items-center gap-2">
                  {(['link', 'image', 'file'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setAttachmentType(type)}
                      className={cn(
                        'px-3 py-1 text-xs rounded-md transition-colors',
                        attachmentType === type
                          ? 'bg-zinc-700 text-zinc-200'
                          : 'text-zinc-500 hover:text-zinc-300'
                      )}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>

                {attachmentType === 'link' ? (
                  <>
                    <input
                      type="text"
                      value={newAttachmentName}
                      onChange={(e) => setNewAttachmentName(e.target.value)}
                      placeholder="Name..."
                      className="w-full text-sm bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
                    />
                    <input
                      type="text"
                      value={newAttachmentUrl}
                      onChange={(e) => setNewAttachmentUrl(e.target.value)}
                      placeholder="URL..."
                      className="w-full text-sm bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAddAttachment}
                        disabled={!newAttachmentName.trim() || !newAttachmentUrl.trim()}
                        className="px-3 py-1.5 text-xs font-medium bg-zinc-100 text-zinc-900 rounded-md hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setShowAttachmentForm(false);
                          setNewAttachmentName('');
                          setNewAttachmentUrl('');
                        }}
                        className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* File upload */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileUpload}
                      accept={attachmentType === 'image' ? 'image/*' : '*'}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-full flex items-center justify-center gap-2 py-6 border-2 border-dashed border-zinc-700 hover:border-zinc-600 rounded-lg text-sm text-zinc-500 hover:text-zinc-400 transition-colors disabled:opacity-50"
                    >
                      {isUploading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Click to upload {attachmentType === 'image' ? 'an image' : 'a file'}
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-zinc-600 text-center">
                      Max file size: 5MB. Files are stored locally in your browser.
                    </p>
                    {uploadError && (
                      <p className="text-xs text-red-400 text-center">{uploadError}</p>
                    )}
                    <div className="flex justify-center">
                      <button
                        onClick={() => {
                          setShowAttachmentForm(false);
                          setUploadError(null);
                        }}
                        className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowAttachmentForm(true)}
                className="mt-2 flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add attachment
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
