/**
 * Upload Service - Firebase Storage
 * 
 * Handles file uploads to Firebase Storage for multimodal chat
 * Supports: Images, PDFs, Audio files
 */

import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { Attachment } from '@/types/chat';
import { logger } from '@/lib/utils/logger';

// Supported file types
const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const SUPPORTED_PDF_TYPES = ['application/pdf'];
const SUPPORTED_AUDIO_TYPES = ['audio/wav', 'audio/mp3', 'audio/mpeg'];
const SUPPORTED_DOCUMENT_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'text/plain', // TXT
];

const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB

export interface UploadResult {
  success: boolean;
  attachment?: Attachment;
  error?: string;
}

export interface ProfilePhotoUploadResult {
  url: string;
  storagePath: string;
}

/**
 * Validate file type and size
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  const fileType = file.type;
  const fileSize = file.size;

  // Check file type
  const isImage = SUPPORTED_IMAGE_TYPES.includes(fileType);
  const isPDF = SUPPORTED_PDF_TYPES.includes(fileType);
  const isAudio = SUPPORTED_AUDIO_TYPES.includes(fileType);
  const isDocument = SUPPORTED_DOCUMENT_TYPES.includes(fileType);

  if (!isImage && !isPDF && !isAudio && !isDocument) {
    return {
      valid: false,
      error: 'Tipo de arquivo não suportado. Use: imagens (PNG, JPEG, WebP, GIF), PDFs, documentos (DOCX, TXT) ou áudios (WAV, MP3)',
    };
  }

  // Check file size
  if (isImage && fileSize > MAX_IMAGE_SIZE) {
    return { valid: false, error: 'Imagem muito grande. Máximo: 20MB' };
  }
  if (isPDF && fileSize > MAX_PDF_SIZE) {
    return { valid: false, error: 'PDF muito grande. Máximo: 50MB' };
  }
  if (isAudio && fileSize > MAX_AUDIO_SIZE) {
    return { valid: false, error: 'Áudio muito grande. Máximo: 25MB' };
  }
  if (isDocument && fileSize > MAX_DOCUMENT_SIZE) {
    return { valid: false, error: 'Documento muito grande. Máximo: 10MB' };
  }

  return { valid: true };
}

/**
 * Convert file to base64 (for audio files)
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1]; // Remove data:audio/...;base64,
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Upload file to Firebase Storage
 */
export async function uploadFile(
  file: File,
  userId: string,
  chatId: string
): Promise<UploadResult> {
  try {
    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const isAudio = SUPPORTED_AUDIO_TYPES.includes(file.type);
    const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageRefPath = `users/${userId}/chats/${chatId}/attachments/${fileId}_${sanitizedFileName}`;

    // Upload to Firebase Storage
    const storageReference = ref(storage, storageRefPath);
    await uploadBytes(storageReference, file);
    const downloadURL = await getDownloadURL(storageReference);

    // Create attachment object
    const attachment: Attachment = {
      id: fileId,
      name: file.name,
      type: file.type,
      size: file.size,
      url: downloadURL,
      storageRef: storageRefPath,
      isActive: true, // Default: attachment is active in context
    };

    // For audio files, also include base64 (required by OpenRouter)
    if (isAudio) {
      const base64Data = await fileToBase64(file);
      attachment.base64 = base64Data;
    }

    // For images, create preview
    if (SUPPORTED_IMAGE_TYPES.includes(file.type)) {
      attachment.preview = URL.createObjectURL(file);
    }

    logger.log('File uploaded successfully:', storageRefPath);
    return { success: true, attachment };
  } catch (error) {
    logger.error('Error uploading file:', error);
    return {
      success: false,
      error: 'Erro ao fazer upload do arquivo. Tente novamente.',
    };
  }
}

/**
 * Upload multiple files
 */
export async function uploadFiles(
  files: File[],
  userId: string,
  chatId: string,
  onProgress?: (current: number, total: number) => void
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const result = await uploadFile(files[i], userId, chatId);
    results.push(result);

    if (onProgress) {
      onProgress(i + 1, files.length);
    }
  }

  return results;
}

/**
 * Delete file from Firebase Storage
 */
export async function deleteFile(storageRefPath: string): Promise<boolean> {
  try {
    const storageReference = ref(storage, storageRefPath);
    await deleteObject(storageReference);
    logger.log('File deleted successfully:', storageRefPath);
    return true;
  } catch (error) {
    logger.error('Error deleting file:', error);
    return false;
  }
}

/**
 * Delete a specific attachment from storage
 * Used when removing a single attachment from a message
 */
export async function deleteAttachment(storageRefPath: string): Promise<void> {
  try {
    const storageReference = ref(storage, storageRefPath);
    await deleteObject(storageReference);
    logger.log('Attachment deleted successfully:', storageRefPath);
  } catch (error) {
    logger.error('Error deleting attachment:', error);
    throw new Error('Erro ao excluir anexo do storage.');
  }
}

/**
 * Delete all attachments from a chat (includes both regular attachments and generated images)
 */
export async function deleteAllChatAttachments(
  userId: string,
  chatId: string
): Promise<void> {
  try {
    // Delete regular attachments folder
    const attachmentsPath = `users/${userId}/chats/${chatId}/attachments`;
    const attachmentsRef = ref(storage, attachmentsPath);
    
    // List all files in the attachments folder
    const listResult = await listAll(attachmentsRef);
    
    // Delete all files
    const deletePromises = listResult.items.map((itemRef) => deleteObject(itemRef));
    await Promise.all(deletePromises);
    
    logger.log(`Deleted ${listResult.items.length} attachments for chat ${chatId}`);
  } catch (error) {
    // Ignore if folder doesn't exist
    const storageError = error as { code?: string };
    if (storageError.code !== 'storage/object-not-found') {
      logger.error('Error deleting chat attachments:', error);
      throw error;
    }
  }

  try {
    // Delete generated images folder
    const generatedPath = `users/${userId}/chats/${chatId}/generated`;
    const generatedRef = ref(storage, generatedPath);
    
    // List all files in the generated folder
    const generatedListResult = await listAll(generatedRef);
    
    // Delete all generated images
    const deleteGeneratedPromises = generatedListResult.items.map((itemRef) => deleteObject(itemRef));
    await Promise.all(deleteGeneratedPromises);
    
    logger.log(`Deleted ${generatedListResult.items.length} generated images for chat ${chatId}`);
  } catch (error) {
    // Ignore if folder doesn't exist
    const storageError = error as { code?: string };
    if (storageError.code !== 'storage/object-not-found') {
      logger.error('Error deleting generated images:', error);
      throw error;
    }
  }
}

/**
 * Get file type category
 */
export function getFileCategory(mimeType: string): 'image' | 'pdf' | 'audio' | 'docx' | 'txt' | 'unknown' {
  if (SUPPORTED_IMAGE_TYPES.includes(mimeType)) return 'image';
  if (SUPPORTED_PDF_TYPES.includes(mimeType)) return 'pdf';
  if (SUPPORTED_AUDIO_TYPES.includes(mimeType)) return 'audio';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (mimeType === 'text/plain') return 'txt';
  return 'unknown';
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Upload profile photo for a user and optionally replace the previous one
 */
export async function uploadProfilePhoto(
  file: File,
  userId: string,
  previousStoragePath?: string
): Promise<ProfilePhotoUploadResult> {
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Selecione uma imagem válida (PNG, JPG, JPEG, WEBP ou GIF).');
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error('Imagem muito grande. Máximo: 20MB');
  }

  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `users/${userId}/profile/${Date.now()}_${sanitizedName}`;

  try {
    const storageReference = ref(storage, storagePath);
    await uploadBytes(storageReference, file);
    const downloadURL = await getDownloadURL(storageReference);

    if (previousStoragePath && previousStoragePath !== storagePath) {
      try {
        await deleteObject(ref(storage, previousStoragePath));
      } catch (deleteError) {
        logger.warn('Não foi possível remover foto anterior:', deleteError);
      }
    }

    logger.log('Profile photo uploaded successfully:', storagePath);

    return {
      url: downloadURL,
      storagePath,
    };
  } catch (error) {
    logger.error('Error uploading profile photo:', error);
    throw new Error('Erro ao fazer upload da foto de perfil. Tente novamente.');
  }
}

/**
 * Upload chat background image for a user and optionally replace the previous one
 */
export async function uploadChatBackground(
  file: File,
  userId: string,
  previousStoragePath?: string
): Promise<ProfilePhotoUploadResult> {
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Selecione uma imagem válida (PNG, JPG, JPEG, WEBP ou GIF).');
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error('Imagem muito grande. Máximo: 20MB');
  }

  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `users/${userId}/backgrounds/${Date.now()}_${sanitizedName}`;

  try {
    const storageReference = ref(storage, storagePath);
    await uploadBytes(storageReference, file);
    const downloadURL = await getDownloadURL(storageReference);

    if (previousStoragePath && previousStoragePath !== storagePath) {
      try {
        await deleteObject(ref(storage, previousStoragePath));
      } catch (deleteError) {
        logger.warn('Não foi possível remover background anterior:', deleteError);
      }
    }

    logger.log('Chat background uploaded successfully:', storagePath);

    return {
      url: downloadURL,
      storagePath,
    };
  } catch (error) {
    logger.error('Error uploading chat background:', error);
    throw new Error('Erro ao fazer upload do background. Tente novamente.');
  }
}

/**
 * Upload a base64 image to Firebase Storage (for AI-generated images)
 * @param base64Data - Base64 data URL (e.g., data:image/png;base64,...)
 * @param userId - User ID
 * @param chatId - Chat ID
 * @param imageId - Unique image ID
 * @returns Storage URL and path
 */
export async function uploadBase64Image(
  base64Data: string,
  userId: string,
  chatId: string,
  imageId: string
): Promise<{ url: string; storagePath: string; size: number }> {
  try {
    // Extract base64 data and mime type
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid base64 data URL');
    }

    const mimeType = matches[1];
    const base64String = matches[2];
    
    // Validate size (base64 is ~33% larger than binary)
    const estimatedSize = (base64String.length * 3) / 4;
    const MAX_GENERATED_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
    
    if (estimatedSize > MAX_GENERATED_IMAGE_SIZE) {
      throw new Error('Generated image too large. Maximum: 10MB');
    }

    // Convert base64 to blob
    const byteCharacters = atob(base64String);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    // Determine file extension from mime type
    const extension = mimeType.split('/')[1] || 'png';
    const fileName = `generated_${imageId}.${extension}`;
    const storagePath = `users/${userId}/chats/${chatId}/generated/${fileName}`;

    // Upload to Storage
    const storageReference = ref(storage, storagePath);
    await uploadBytes(storageReference, blob);
    const downloadURL = await getDownloadURL(storageReference);

    logger.log('Generated image uploaded successfully:', storagePath);

    return {
      url: downloadURL,
      storagePath,
      size: blob.size,
    };
  } catch (error) {
    logger.error('Error uploading generated image:', error);
    throw new Error('Erro ao fazer upload da imagem gerada.');
  }
}
