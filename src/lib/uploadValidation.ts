import { LearningMaterialType } from '../types/competency';

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_CERTIFICATE_BYTES = 10 * 1024 * 1024;

export function validateStorageUploadFile(
  file: { name: string; size: number; type: string },
  kind: LearningMaterialType | 'certificate'
): { valid: boolean; error?: string } {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (file.size <= 0) {
    return { valid: false, error: 'Selected file is empty (0 bytes).' };
  }

  if (kind === 'Video Lecture') {
    const allowedExts = ['mp4', 'webm', 'mov'];
    const allowedMime = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!allowedExts.includes(ext) && !allowedMime.includes(file.type)) {
      return {
        valid: false,
        error: 'Video Lectures must be .mp4, .webm, or .mov video files.',
      };
    }
    if (file.size > MAX_VIDEO_BYTES) {
      return {
        valid: false,
        error: 'Video file exceeds the 100 MB Supabase Storage bucket limit.',
      };
    }
    return { valid: true };
  }

  if (kind === 'Slide Deck') {
    const allowedExts = ['pdf', 'ppt', 'pptx', 'odp', 'key'];
    if (!allowedExts.includes(ext)) {
      return {
        valid: false,
        error: 'Slide Decks must be .pdf, .ppt, .pptx, .odp, or .key presentations.',
      };
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      return {
        valid: false,
        error: 'Slide Deck exceeds the 25 MB document limit.',
      };
    }
    return { valid: true };
  }

  if (kind === 'certificate') {
    const allowedExts = ['pdf', 'png', 'jpg', 'jpeg'];
    if (!allowedExts.includes(ext)) {
      return {
        valid: false,
        error: 'Certificate attachments must be .pdf, .png, .jpg, or .jpeg files.',
      };
    }
    if (file.size > MAX_CERTIFICATE_BYTES) {
      return {
        valid: false,
        error: 'Certificate file exceeds the 10 MB limit.',
      };
    }
    return { valid: true };
  }

  const allowedDocExts = ['pdf', 'doc', 'docx', 'csv', 'txt', 'xlsx', 'md'];
  if (!allowedDocExts.includes(ext)) {
    return {
      valid: false,
      error: `${kind} files must be .pdf, .doc, .docx, .csv, .txt, .xlsx, or .md.`,
    };
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return {
      valid: false,
      error: 'Uploaded resource exceeds the 25 MB document limit.',
    };
  }

  return { valid: true };
}
