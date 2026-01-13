import { create } from 'zustand';
import { getApiBaseUrl } from '@/lib/config';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

// File size limits matching backend multerConfig.ts
const FILE_SIZE_LIMITS = {
  document: 750 * 1024 * 1024,   // 750 MB for documents (PDF, DOCX, TXT, etc.)
  image: 750 * 1024 * 1024,      // 750 MB for images
  video: 750 * 1024 * 1024,      // 750 MB for video files
  audio: 750 * 1024 * 1024,      // 750 MB for audio files
  default: 750 * 1024 * 1024,    // 750 MB default
};

// Get file type category from MIME type or extension
const getFileCategory = (file: File): keyof typeof FILE_SIZE_LIMITS => {
  const mimeType = file.type.toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (mimeType.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'm4v', 'flv', 'wmv', 'mpeg', 'mpg', 'webm'].includes(ext)) {
    return 'video';
  }
  if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'].includes(ext)) {
    return 'audio';
  }
  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif'].includes(ext)) {
    return 'image';
  }
  return 'document';
};

// Format bytes to human readable
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

// Calculate processing delay based on file size (larger files need more time)
const getProcessingDelay = (fileSize: number): number => {
  const sizeMB = fileSize / (1024 * 1024);
  // Base delay + additional time based on size
  // Small files (<10MB): 2 seconds
  // Medium files (10-100MB): 5-15 seconds
  // Large files (>100MB): 15-30 seconds
  if (sizeMB < 10) return 2000;
  if (sizeMB < 50) return 5000;
  if (sizeMB < 100) return 10000;
  if (sizeMB < 200) return 15000;
  return 20000; // 20 seconds for very large files
};

// Delay helper
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// Retry configuration
const UPLOAD_CONFIG = {
  maxRetries: 3,
  initialRetryDelay: 3000,  // 3 seconds
  maxRetryDelay: 30000,     // 30 seconds max
  backoffMultiplier: 2,     // Double delay on each retry
};

// Validate file size against limits
const validateFileSize = (file: File): { valid: boolean; maxSize: number; category: string } => {
  const category = getFileCategory(file);
  const maxSize = FILE_SIZE_LIMITS[category];
  return {
    valid: file.size <= maxSize,
    maxSize,
    category,
  };
};

export interface FileNode {
  _id: string;
  name: string;
  type: 'file' | 'folder';
  parentId?: string | null;
  children?: FileNode[];
  size?: number;
  mimeType?: string;
  uploadTimestamp?: string;
  path?: string;
  s3Key?: string;
  isExpanded?: boolean;
  knowledgeBaseId?: string;
  permissions?: {
    type: 'all' | 'admin' | 'specific-users';
    allowedUsers?: string[];
  };
}

export interface KnowledgeBase {
  _id: string;
  name: string;
  description?: string;
  documentCount?: number;
}

interface FileTreeState {
  // Tree structure
  fileTree: FileNode[];
  expandedFolders: Set<string>;
  selectedItems: Set<string>;

  // Knowledge bases
  knowledgeBases: KnowledgeBase[];
  selectedKnowledgeBase: string | null;

  // UI state
  viewMode: 'tree' | 'grid' | 'list';
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  mode: 'user' | 'system';

  // Actions
  setFileTree: (tree: FileNode[]) => void;
  toggleFolder: (folderId: string) => void;
  selectItem: (itemId: string, multiSelect?: boolean) => void;
  clearSelection: () => void;
  setViewMode: (mode: 'tree' | 'grid' | 'list') => void;
  setSearchQuery: (query: string) => void;
  setSelectedKnowledgeBase: (kbId: string | null) => void;
  setMode: (mode: 'user' | 'system') => void;

  // API actions
  fetchFileTree: (kbId?: string) => Promise<void>;
  createFolder: (name: string, parentId?: string | null) => Promise<void>;
  deleteItems: (itemIds: string[]) => Promise<void>;
  moveItems: (itemIds: string[], targetFolderId: string | null) => Promise<void>;
  renameItem: (itemId: string, newName: string) => Promise<void>;
  uploadFiles: (files: FileList, folderId?: string | null) => Promise<{
    success: boolean;
    uploadedDocuments?: any[];
    skippedDocuments?: any[];
    errors?: any[];
  } | undefined>;
  fetchKnowledgeBases: () => Promise<void>;
}

const useFileTreeStore = create<FileTreeState>((set, get) => ({
  // Initial state
  fileTree: [],
  expandedFolders: new Set<string>(),
  selectedItems: new Set<string>(),
  knowledgeBases: [],
  selectedKnowledgeBase: null,
  viewMode: 'tree',
  isLoading: false,
  error: null,
  searchQuery: '',
  mode: 'system', // Default to system mode

  // Basic actions
  setFileTree: (tree) => set({ fileTree: tree }),
  setMode: (mode) => set({ mode }),
  
  toggleFolder: (folderId) => set((state) => {
    const newExpanded = new Set(state.expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    return { expandedFolders: newExpanded };
  }),
  
  selectItem: (itemId, multiSelect = false) => set((state) => {
    const newSelection = multiSelect ? new Set(state.selectedItems) : new Set<string>();
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    return { selectedItems: newSelection };
  }),
  
  clearSelection: () => set({ selectedItems: new Set<string>() }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedKnowledgeBase: (kbId) => set({ selectedKnowledgeBase: kbId }),

  // API actions
  fetchFileTree: async (kbId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const mode = get().mode;
      const kb = kbId || get().selectedKnowledgeBase;

      // Build endpoint based on mode
      let endpoint: string;

      if (mode === 'system') {
        // For system mode, use system folders endpoint
        endpoint = '/api/admin/system-folders/tree';
        if (kb) {
          endpoint += `?knowledgeBase=${kb}`;
        }
      } else {
        // For user mode, use user folders endpoint
        endpoint = '/api/folders/tree?sourceType=user';
      }

      console.log('[FileTreeStore] Fetching tree from:', endpoint, 'mode:', mode);
      const response = await fetchWithAuth(endpoint, {
        method: 'GET',
      });
      
      if (!response.ok) {
        console.error('[FileTreeStore] Response not OK:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('[FileTreeStore] Error response:', errorText);
        throw new Error(`Failed to fetch file tree: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('[FileTreeStore] fetchFileTree response:', data);
      console.log('[FileTreeStore] Tree data type:', typeof data.tree);
      console.log('[FileTreeStore] Tree is array?:', Array.isArray(data.tree));
      console.log('[FileTreeStore] Tree length:', data.tree?.length);
      
      if (data.tree && data.tree.length > 0) {
        console.log('[FileTreeStore] First 3 items:', data.tree.slice(0, 3).map((item: any) => ({
          name: item.name,
          type: item.type,
          hasChildren: item.children ? item.children.length : 0
        })));
        console.log('[FileTreeStore] All item names:', data.tree.map((item: any) => item.name));
      }
      
      // Check what we're about to set
      const treeToSet = data.tree || [];
      console.log('[FileTreeStore] About to set fileTree with', treeToSet.length, 'items');
      console.log('[FileTreeStore] Tree to set:', treeToSet);
      
      // Try setting with a callback to ensure we're not having state issues
      set((state) => {
        console.log('[FileTreeStore] Current state before set:', state.fileTree.length);
        console.log('[FileTreeStore] Setting new tree with:', treeToSet.length);
        return { ...state, fileTree: treeToSet };
      });
    } catch (error: any) {
      set({ error: error.message });
      console.error('[FileTreeStore] Failed to fetch file tree:', error);
      console.error('[FileTreeStore] Error details:', {
        message: error.message,
        stack: error.stack
      });
    } finally {
      set({ isLoading: false });
    }
  },

  createFolder: async (name: string, parentId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      const mode = get().mode;

      // Use the correct endpoint based on mode
      const endpoint = mode === 'system'
        ? '/api/admin/system-folders'
        : '/api/folders';

      console.log('[FileTreeStore] Creating folder in mode:', mode, 'endpoint:', endpoint);

      const response = await fetchWithAuth(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          name,
          parentId,
          knowledgeBaseId: get().selectedKnowledgeBase
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[FileTreeStore] Create folder failed:', response.status, errorText);
        throw new Error(`Failed to create folder: ${response.statusText}`);
      }

      const newFolder = await response.json();
      console.log('[FileTreeStore] Folder created successfully:', newFolder);

      // Store current expanded folders before refresh
      const currentExpanded = new Set(get().expandedFolders);

      // If created inside a folder, ensure parent is expanded
      if (parentId) {
        currentExpanded.add(parentId);
      }

      // Refresh the tree
      await get().fetchFileTree();

      // Restore expanded folders state
      set({ expandedFolders: currentExpanded });

      return newFolder;
    } catch (error: any) {
      set({ error: error.message });
      console.error('Failed to create folder:', error);
      throw error; // Re-throw so UI can show error
    } finally {
      set({ isLoading: false });
    }
  },

  deleteItems: async (itemIds: string[]) => {
    set({ isLoading: true, error: null });
    try {
      const mode = get().mode;

      // Use the correct endpoint based on mode
      const endpoint = mode === 'system'
        ? '/api/admin/system-folders/delete'
        : '/api/folders/delete';

      console.log('[FileTreeStore] Deleting items in mode:', mode, 'endpoint:', endpoint);

      const response = await fetchWithAuth(endpoint, {
        method: 'POST',
        body: JSON.stringify({ itemIds })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[FileTreeStore] Delete failed:', response.status, errorText);
        throw new Error(`Failed to delete items: ${response.statusText}`);
      }

      // Clear selection and refresh
      set({ selectedItems: new Set<string>() });
      await get().fetchFileTree();
    } catch (error: any) {
      set({ error: error.message });
      console.error('Failed to delete items:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  moveItems: async (itemIds: string[], targetFolderId: string | null) => {
    set({ isLoading: true, error: null });
    try {
      const mode = get().mode;

      // Use the correct endpoint based on mode
      const endpoint = mode === 'system'
        ? '/api/admin/system-folders/move'
        : '/api/folders/move';

      console.log('[FileTreeStore] Moving items in mode:', mode, 'endpoint:', endpoint);

      const response = await fetchWithAuth(endpoint, {
        method: 'POST',
        body: JSON.stringify({ itemIds, targetFolderId })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[FileTreeStore] Move failed:', response.status, errorText);
        throw new Error(`Failed to move items: ${response.statusText}`);
      }

      // Store current expanded folders before refresh
      const currentExpanded = new Set(get().expandedFolders);

      // If moving to a folder, ensure it's expanded to show the moved items
      if (targetFolderId) {
        currentExpanded.add(targetFolderId);
      }

      // Clear selection and refresh
      set({ selectedItems: new Set<string>() });
      await get().fetchFileTree();

      // Restore expanded folders state
      set({ expandedFolders: currentExpanded });
    } catch (error: any) {
      set({ error: error.message });
      console.error('Failed to move items:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  renameItem: async (itemId: string, newName: string) => {
    set({ isLoading: true, error: null });
    try {
      const mode = get().mode;

      // Use the correct endpoint based on mode
      const endpoint = mode === 'system'
        ? `/api/admin/system-folders/${itemId}/rename`
        : `/api/folders/${itemId}/rename`;

      console.log('[FileTreeStore] Renaming item in mode:', mode, 'endpoint:', endpoint);

      const response = await fetchWithAuth(endpoint, {
        method: 'PATCH',
        body: JSON.stringify({ name: newName })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[FileTreeStore] Rename failed:', response.status, errorText);
        throw new Error(`Failed to rename item: ${response.statusText}`);
      }

      await get().fetchFileTree();
    } catch (error: any) {
      set({ error: error.message });
      console.error('Failed to rename item:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  uploadFiles: async (files: FileList, folderId?: string | null) => {
    set({ isLoading: true, error: null });
    console.log('[FileTreeStore] uploadFiles called with folderId:', folderId, 'mode:', get().mode);

    // Batch size limit for system mode (multer configured for max 10 files per request)
    const BATCH_SIZE = 10;

    try {
      const mode = get().mode;
      const filesArray = Array.from(files);

      // PRE-VALIDATE: Check file sizes before uploading
      const validFiles: File[] = [];
      const oversizedFiles: { file: File; maxSize: number; category: string }[] = [];

      filesArray.forEach(file => {
        const validation = validateFileSize(file);
        if (validation.valid) {
          validFiles.push(file);
        } else {
          oversizedFiles.push({
            file,
            maxSize: validation.maxSize,
            category: validation.category,
          });
          console.log(`[FileTreeStore] REJECTED (too large): ${file.name} - ${formatFileSize(file.size)} exceeds ${formatFileSize(validation.maxSize)} limit for ${validation.category} files`);
        }
      });

      // Aggregate results across all batches
      const aggregatedResult = {
        success: true,
        uploadedDocuments: [] as any[],
        skippedDocuments: [] as any[],
        errors: [] as any[],
      };

      // Add oversized files to errors immediately with detailed message
      oversizedFiles.forEach(({ file, maxSize, category }) => {
        aggregatedResult.errors.push({
          filename: file.name,
          error: `File too large: ${formatFileSize(file.size)} exceeds ${formatFileSize(maxSize)} limit for ${category} files`,
          size: file.size,
          maxSize,
          category,
        });
      });

      if (oversizedFiles.length > 0) {
        console.log(`[FileTreeStore] ${oversizedFiles.length} file(s) rejected for being too large`);
      }

      // If no valid files, return early with errors
      if (validFiles.length === 0) {
        console.log('[FileTreeStore] No valid files to upload after size check');
        set({ isLoading: false });
        return aggregatedResult;
      }

      const totalFiles = validFiles.length;
      console.log(`[FileTreeStore] ${mode.toUpperCase()} MODE UPLOAD - Valid files: ${totalFiles}, Rejected: ${oversizedFiles.length}`);

      // USER MODE: Use presigned URL flow (direct to S3, bypasses proxy timeout)
      // With retry logic and delays between files to prevent backend overload
      if (mode === 'user') {
        console.log('[FileTreeStore] Using PRESIGNED URL upload flow for user documents');
        console.log(`[FileTreeStore] Upload config: maxRetries=${UPLOAD_CONFIG.maxRetries}, initialDelay=${UPLOAD_CONFIG.initialRetryDelay}ms`);

        for (let i = 0; i < validFiles.length; i++) {
          const file = validFiles[i];
          const fileNum = i + 1;
          console.log(`\n[FileTreeStore] ========== FILE ${fileNum}/${totalFiles} ==========`);
          console.log(`[FileTreeStore] Processing: ${file.name} (${formatFileSize(file.size)})`);

          let uploadSuccess = false;
          let lastError: Error | null = null;
          let retryDelay = UPLOAD_CONFIG.initialRetryDelay;

          // Retry loop for each file
          for (let attempt = 1; attempt <= UPLOAD_CONFIG.maxRetries && !uploadSuccess; attempt++) {
            try {
              if (attempt > 1) {
                console.log(`[FileTreeStore] Retry attempt ${attempt}/${UPLOAD_CONFIG.maxRetries} for ${file.name} after ${retryDelay}ms delay`);
                await delay(retryDelay);
                retryDelay = Math.min(retryDelay * UPLOAD_CONFIG.backoffMultiplier, UPLOAD_CONFIG.maxRetryDelay);
              }

              // Step 1: Get presigned URL from backend
              console.log(`[FileTreeStore] [${fileNum}/${totalFiles}] Step 1: Requesting presigned URL`);
              const presignedResponse = await fetchWithAuth('/api/documents/get-presigned-url', {
                method: 'POST',
                body: JSON.stringify({
                  fileName: file.name,
                  fileType: file.type || 'application/octet-stream',
                  fileSize: file.size,
                }),
              });

              // Check for backend overload (502/503/504)
              if (presignedResponse.status >= 500) {
                throw new Error(`Backend unavailable (${presignedResponse.status}). Server may be overloaded.`);
              }

              if (!presignedResponse.ok) {
                const errorData = await presignedResponse.json().catch(() => ({ message: 'Failed to get upload URL' }));
                throw new Error(errorData.message || `Failed to get presigned URL: ${presignedResponse.status}`);
              }

              const { presignedUrl, s3Key, expiresIn } = await presignedResponse.json();
              console.log(`[FileTreeStore] [${fileNum}/${totalFiles}] Got presigned URL, s3Key: ${s3Key}`);

              // Handle relative URLs for local storage mode
              let uploadUrl = presignedUrl;
              if (presignedUrl.startsWith('/')) {
                const apiBaseUrl = getApiBaseUrl();
                uploadUrl = `${apiBaseUrl}${presignedUrl}`;
              }

              // Step 2: Upload directly to S3 using presigned URL
              console.log(`[FileTreeStore] [${fileNum}/${totalFiles}] Step 2: Uploading to S3...`);
              const contentType = file.type || 'application/octet-stream';

              const s3Response = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                  'Content-Type': contentType,
                },
                body: file,
                mode: 'cors',
                credentials: uploadUrl.includes('localhost') || uploadUrl.includes('/api/files/local/') ? 'include' : 'omit',
                cache: 'no-cache',
              });

              if (!s3Response.ok) {
                let errorText = 'S3 upload failed';
                try {
                  errorText = await s3Response.text();
                } catch { /* ignore */ }
                throw new Error(`S3 upload failed: ${s3Response.status} - ${errorText}`);
              }

              console.log(`[FileTreeStore] [${fileNum}/${totalFiles}] S3 upload complete`);

              // Step 3: Notify backend to process the uploaded file
              console.log(`[FileTreeStore] [${fileNum}/${totalFiles}] Step 3: Notifying backend for processing...`);
              const processResponse = await fetchWithAuth('/api/documents/process-uploaded-file', {
                method: 'POST',
                body: JSON.stringify({
                  s3Key,
                  originalFileName: file.name,
                  fileSize: file.size,
                  fileType: file.type || 'application/octet-stream',
                  folderId: folderId || undefined,
                }),
              });

              // Check for backend overload (502/503/504)
              if (processResponse.status >= 500) {
                throw new Error(`Backend unavailable during processing (${processResponse.status}). Server may be overloaded.`);
              }

              if (!processResponse.ok) {
                const errorData = await processResponse.json().catch(() => ({ message: 'Failed to process file' }));
                throw new Error(errorData.message || `Failed to process uploaded file: ${processResponse.status}`);
              }

              const processResult = await processResponse.json();
              console.log(`[FileTreeStore] [${fileNum}/${totalFiles}] Processing initiated successfully`);

              aggregatedResult.uploadedDocuments.push({
                filename: file.name,
                documentId: processResult.document?._id,
                message: processResult.message || 'Processing started',
              });

              uploadSuccess = true;

            } catch (attemptError: any) {
              lastError = attemptError;
              console.error(`[FileTreeStore] [${fileNum}/${totalFiles}] Attempt ${attempt} failed:`, attemptError.message);

              // If it's a 5xx error (backend overload), increase retry delay significantly
              if (attemptError.message?.includes('50') || attemptError.message?.includes('Backend unavailable')) {
                retryDelay = Math.min(retryDelay * 3, UPLOAD_CONFIG.maxRetryDelay); // Triple delay on server errors
                console.log(`[FileTreeStore] Backend overload detected, increased retry delay to ${retryDelay}ms`);
              }
            }
          }

          // After all retries, record result
          if (!uploadSuccess) {
            console.error(`[FileTreeStore] [${fileNum}/${totalFiles}] FAILED after ${UPLOAD_CONFIG.maxRetries} attempts: ${file.name}`);
            aggregatedResult.errors.push({
              filename: file.name,
              error: lastError?.message || 'Upload failed after all retries',
            });
            aggregatedResult.success = false;
          }

          // CRITICAL: Wait between files to let backend process before next upload
          // This prevents concurrent processing overload
          if (i < validFiles.length - 1) {
            const processingDelay = getProcessingDelay(file.size);
            console.log(`[FileTreeStore] Waiting ${processingDelay}ms for backend to process before next file...`);
            await delay(processingDelay);
          }
        }

        console.log(`\n[FileTreeStore] ========== UPLOAD COMPLETE ==========`);
        console.log(`[FileTreeStore] Uploaded: ${aggregatedResult.uploadedDocuments.length}/${totalFiles}`);
        console.log(`[FileTreeStore] Failed: ${aggregatedResult.errors.length}`);
      } else {
        // SYSTEM MODE: Use direct upload to admin endpoint (batched)
        console.log('[FileTreeStore] Using DIRECT upload flow for system KB');
        const totalBatches = Math.ceil(totalFiles / BATCH_SIZE);

        const apiUrl = getApiBaseUrl();
        const token = localStorage.getItem('accessToken');
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        // Process files in batches of BATCH_SIZE
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const startIdx = batchIndex * BATCH_SIZE;
          const endIdx = Math.min(startIdx + BATCH_SIZE, totalFiles);
          const batchFiles = validFiles.slice(startIdx, endIdx);

          console.log(`[FileTreeStore] Processing batch ${batchIndex + 1}/${totalBatches} (files ${startIdx + 1}-${endIdx} of ${totalFiles})`);

          const formData = new FormData();
          batchFiles.forEach((file, index) => {
            console.log(`[FileTreeStore] Batch ${batchIndex + 1}: Adding file ${index + 1}/${batchFiles.length}: ${file.name}`);
            formData.append('files', file);
          });

          if (folderId) {
            formData.append('folderId', folderId);
          }

          if (get().selectedKnowledgeBase) {
            formData.append('knowledgeBaseId', get().selectedKnowledgeBase!);
          }

          try {
            const response = await fetch(`${apiUrl}/api/admin/system-kb/upload`, {
              method: 'POST',
              headers,
              credentials: 'include',
              body: formData,
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`[FileTreeStore] Batch ${batchIndex + 1} failed:`, response.status, errorText);
              batchFiles.forEach(file => {
                aggregatedResult.errors.push({
                  filename: file.name,
                  error: `Upload failed: ${response.statusText}`
                });
              });
              aggregatedResult.success = false;
              continue;
            }

            const batchResult = await response.json();
            console.log(`[FileTreeStore] Batch ${batchIndex + 1} result:`, batchResult);

            if (batchResult.uploadedDocuments) {
              aggregatedResult.uploadedDocuments.push(...batchResult.uploadedDocuments);
            }
            if (batchResult.skippedDocuments) {
              aggregatedResult.skippedDocuments.push(...batchResult.skippedDocuments);
            }
            if (batchResult.errors) {
              aggregatedResult.errors.push(...batchResult.errors);
            }
            if (batchResult.rejectedFiles) {
              batchResult.rejectedFiles.forEach((rejected: any) => {
                aggregatedResult.errors.push({
                  filename: rejected.filename,
                  error: rejected.reason || 'Invalid file type'
                });
              });
            }
            if (batchResult.success === false) {
              aggregatedResult.success = false;
            }
          } catch (batchError: any) {
            console.error(`[FileTreeStore] Batch ${batchIndex + 1} exception:`, batchError);
            batchFiles.forEach(file => {
              aggregatedResult.errors.push({
                filename: file.name,
                error: batchError.message
              });
            });
            aggregatedResult.success = false;
          }
        }
      }

      console.log('[FileTreeStore] All uploads complete. Aggregated result:', {
        uploaded: aggregatedResult.uploadedDocuments.length,
        skipped: aggregatedResult.skippedDocuments.length,
        errors: aggregatedResult.errors.length,
      });

      // Wait a bit for backend processing then refresh
      console.log('[FileTreeStore] Refreshing tree after upload...');
      setTimeout(async () => {
        await get().fetchFileTree();
      }, 500);

      return aggregatedResult;
    } catch (error: any) {
      set({ error: error.message });
      console.error('Failed to upload files:', error);
      throw error; // Re-throw so FileTreeManager can show toast
    } finally {
      set({ isLoading: false });
    }
  },

  fetchKnowledgeBases: async () => {
    try {
      const response = await fetchWithAuth('/api/admin/tenant-kb', {
        method: 'GET',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch knowledge bases: ${response.statusText}`);
      }
      
      const data = await response.json();
      set({ knowledgeBases: data.knowledgeBases || [] });
      
      // Don't auto-select KB for system admin view
      // This was causing filtered results to overwrite the full tree
      // if (!get().selectedKnowledgeBase && data.knowledgeBases?.length > 0) {
      //   set({ selectedKnowledgeBase: data.knowledgeBases[0]._id });
      // }
    } catch (error: any) {
      console.error('Failed to fetch knowledge bases:', error);
    }
  }
}));

export default useFileTreeStore;