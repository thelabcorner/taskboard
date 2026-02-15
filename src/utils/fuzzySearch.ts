// Fuzzy search utility with intelligent ranking

export interface SearchMatch {
  field: string;
  value: string;
  score: number;
  indices: [number, number][]; // Start and end indices of matches
}

export interface TaskSearchResult {
  taskId: string;
  columnId: string;
  task: any;
  matches: SearchMatch[];
  totalScore: number;
}

// Field weights for ranking (higher = more important)
const FIELD_WEIGHTS: Record<string, number> = {
  title: 10,
  description: 7,
  'tag': 8,
  'subtask': 6,
  'note': 5,
  'attachment': 4,
  status: 3,
  priority: 3,
};

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Calculate similarity score (0-1) between two strings
 */
function stringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Tokenize a string into searchable terms
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 0);
}

/**
 * Find matching indices in text for highlighting
 */
function findMatchIndices(text: string, query: string): [number, number][] {
  const indices: [number, number][] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  
  let pos = 0;
  while ((pos = lowerText.indexOf(lowerQuery, pos)) !== -1) {
    indices.push([pos, pos + lowerQuery.length]);
    pos += 1;
  }
  
  return indices;
}

/**
 * Calculate fuzzy match score for a single field value
 */
function fuzzyMatchField(
  fieldValue: string,
  queryTokens: string[],
  originalQuery: string
): { score: number; indices: [number, number][] } {
  if (!fieldValue || fieldValue.trim().length === 0) {
    return { score: 0, indices: [] };
  }
  
  const lowerValue = fieldValue.toLowerCase();
  const lowerQuery = originalQuery.toLowerCase();
  let totalScore = 0;
  const allIndices: [number, number][] = [];
  
  // Exact match bonus (highest priority)
  if (lowerValue === lowerQuery) {
    totalScore += 100;
    allIndices.push([0, fieldValue.length]);
    return { score: totalScore, indices: allIndices };
  }
  
  // Contains exact query (very high priority)
  if (lowerValue.includes(lowerQuery)) {
    totalScore += 80;
    const indices = findMatchIndices(fieldValue, originalQuery);
    allIndices.push(...indices);
  }
  
  // Starts with query (high priority)
  if (lowerValue.startsWith(lowerQuery)) {
    totalScore += 60;
  }
  
  // Word starts with query
  const words = lowerValue.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(lowerQuery)) {
      totalScore += 40;
      break;
    }
  }
  
  // Token-based matching
  const valueTokens = tokenize(fieldValue);
  
  for (const queryToken of queryTokens) {
    if (queryToken.length < 2) continue;
    
    for (const valueToken of valueTokens) {
      // Exact token match
      if (valueToken === queryToken) {
        totalScore += 30;
        const indices = findMatchIndices(fieldValue, queryToken);
        allIndices.push(...indices);
      }
      // Token starts with query token
      else if (valueToken.startsWith(queryToken)) {
        totalScore += 20;
        const indices = findMatchIndices(fieldValue, queryToken);
        allIndices.push(...indices);
      }
      // Token contains query token
      else if (valueToken.includes(queryToken)) {
        totalScore += 15;
        const indices = findMatchIndices(fieldValue, queryToken);
        allIndices.push(...indices);
      }
      // Fuzzy match with high similarity
      else {
        const similarity = stringSimilarity(valueToken, queryToken);
        if (similarity > 0.7) {
          totalScore += Math.floor(similarity * 15);
        }
      }
    }
  }
  
  // Acronym matching (e.g., "ui" matches "User Interface")
  if (queryTokens.length === 1 && queryTokens[0].length <= 5) {
    const acronym = words.map(w => w[0]).join('');
    if (acronym.includes(queryTokens[0])) {
      totalScore += 25;
    }
  }
  
  // Merge overlapping indices
  const mergedIndices = mergeIndices(allIndices);
  
  return { score: totalScore, indices: mergedIndices };
}

/**
 * Merge overlapping index ranges
 */
function mergeIndices(indices: [number, number][]): [number, number][] {
  if (indices.length === 0) return [];
  
  const sorted = [...indices].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];
    
    if (current[0] <= last[1]) {
      last[1] = Math.max(last[1], current[1]);
    } else {
      merged.push(current);
    }
  }
  
  return merged;
}

/**
 * Search a single task across all its fields
 */
export function searchTask(
  task: any,
  query: string,
  tags: any[]
): SearchMatch[] {
  const matches: SearchMatch[] = [];
  const queryTokens = tokenize(query);
  
  if (queryTokens.length === 0) return matches;
  
  // Search title
  const titleMatch = fuzzyMatchField(task.title || '', queryTokens, query);
  if (titleMatch.score > 0) {
    matches.push({
      field: 'title',
      value: task.title,
      score: titleMatch.score * FIELD_WEIGHTS.title,
      indices: titleMatch.indices,
    });
  }
  
  // Search description
  const descMatch = fuzzyMatchField(task.description || '', queryTokens, query);
  if (descMatch.score > 0) {
    matches.push({
      field: 'description',
      value: task.description,
      score: descMatch.score * FIELD_WEIGHTS.description,
      indices: descMatch.indices,
    });
  }
  
  // Search status
  const statusMatch = fuzzyMatchField(task.status || '', queryTokens, query);
  if (statusMatch.score > 0) {
    matches.push({
      field: 'status',
      value: task.status,
      score: statusMatch.score * FIELD_WEIGHTS.status,
      indices: statusMatch.indices,
    });
  }
  
  // Search priority
  const priorityMatch = fuzzyMatchField(task.priority || '', queryTokens, query);
  if (priorityMatch.score > 0) {
    matches.push({
      field: 'priority',
      value: task.priority,
      score: priorityMatch.score * FIELD_WEIGHTS.priority,
      indices: priorityMatch.indices,
    });
  }
  
  // Search tags
  if (task.tags && task.tags.length > 0) {
    for (const tagId of task.tags) {
      const tag = tags.find(t => t.id === tagId);
      if (tag) {
        const tagMatch = fuzzyMatchField(tag.name, queryTokens, query);
        if (tagMatch.score > 0) {
          matches.push({
            field: 'tag',
            value: tag.name,
            score: tagMatch.score * FIELD_WEIGHTS.tag,
            indices: tagMatch.indices,
          });
        }
      }
    }
  }
  
  // Search subtasks/checklist
  if (task.subtasks && task.subtasks.length > 0) {
    for (const subtask of task.subtasks) {
      const subtaskMatch = fuzzyMatchField(subtask.title || '', queryTokens, query);
      if (subtaskMatch.score > 0) {
        matches.push({
          field: 'subtask',
          value: subtask.title,
          score: subtaskMatch.score * FIELD_WEIGHTS.subtask,
          indices: subtaskMatch.indices,
        });
      }
    }
  }
  
  // Search notes
  if (task.notes && task.notes.length > 0) {
    for (const note of task.notes) {
      const noteMatch = fuzzyMatchField(note.content || '', queryTokens, query);
      if (noteMatch.score > 0) {
        matches.push({
          field: 'note',
          value: note.content,
          score: noteMatch.score * FIELD_WEIGHTS.note,
          indices: noteMatch.indices,
        });
      }
    }
  }
  
  // Search attachments (name and URL)
  if (task.attachments && task.attachments.length > 0) {
    for (const attachment of task.attachments) {
      const nameMatch = fuzzyMatchField(attachment.name || '', queryTokens, query);
      if (nameMatch.score > 0) {
        matches.push({
          field: 'attachment',
          value: attachment.name,
          score: nameMatch.score * FIELD_WEIGHTS.attachment,
          indices: nameMatch.indices,
        });
      }
      
      // Also search URL for links
      if (attachment.type === 'link') {
        const urlMatch = fuzzyMatchField(attachment.url || '', queryTokens, query);
        if (urlMatch.score > 0) {
          matches.push({
            field: 'attachment',
            value: attachment.url,
            score: urlMatch.score * (FIELD_WEIGHTS.attachment * 0.5),
            indices: urlMatch.indices,
          });
        }
      }
    }
  }
  
  return matches;
}

/**
 * Search all tasks across all columns
 */
export function fuzzySearchTasks(
  columns: any[],
  query: string,
  tags: any[]
): TaskSearchResult[] {
  const results: TaskSearchResult[] = [];
  
  if (!query || query.trim().length === 0) {
    return results;
  }
  
  for (const column of columns) {
    for (const task of column.tasks) {
      const matches = searchTask(task, query, tags);
      
      if (matches.length > 0) {
        const totalScore = matches.reduce((sum, m) => sum + m.score, 0);
        results.push({
          taskId: task.id,
          columnId: column.id,
          task,
          matches,
          totalScore,
        });
      }
    }
  }
  
  // Sort by total score (highest first)
  results.sort((a, b) => b.totalScore - a.totalScore);
  
  return results;
}

/**
 * Highlight text with match indices
 */
export function highlightMatches(
  text: string,
  indices: [number, number][]
): { text: string; highlight: boolean }[] {
  if (indices.length === 0) {
    return [{ text, highlight: false }];
  }
  
  const result: { text: string; highlight: boolean }[] = [];
  let lastEnd = 0;
  
  for (const [start, end] of indices) {
    if (start > lastEnd) {
      result.push({ text: text.slice(lastEnd, start), highlight: false });
    }
    result.push({ text: text.slice(start, end), highlight: true });
    lastEnd = end;
  }
  
  if (lastEnd < text.length) {
    result.push({ text: text.slice(lastEnd), highlight: false });
  }
  
  return result;
}

/**
 * Get a preview of matched content with context
 */
export function getMatchPreview(
  value: string,
  indices: [number, number][],
  maxLength: number = 60
): string {
  if (!value || indices.length === 0) return value?.slice(0, maxLength) || '';
  
  const firstMatch = indices[0];
  const matchStart = firstMatch[0];
  
  // Calculate context window around the match
  const contextBefore = 15;
  const start = Math.max(0, matchStart - contextBefore);
  const end = Math.min(value.length, start + maxLength);
  
  let preview = value.slice(start, end);
  
  if (start > 0) {
    preview = '...' + preview;
  }
  if (end < value.length) {
    preview = preview + '...';
  }
  
  return preview;
}
