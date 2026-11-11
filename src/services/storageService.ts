import { validateStorageUploadFile } from '../lib/uploadValidation';
import { requireSupabaseClient } from '../lib/supabaseClient';

export { validateStorageUploadFile };
export type StorageBucketName = 'learning-resources' | 'certificates';

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export const storageService = {
  async uploadFile(
    bucket: StorageBucketName,
    folderPrefix: string,
    file: File
  ): Promise<{ storagePath: string; fileName: string; fileSizeBytes: number; mimeType: string }> {
    const client = requireSupabaseClient();
    const safeName = sanitizeFileName(file.name);
    const storagePath = `${folderPrefix}/${Date.now()}-${safeName}`;

    const { error } = await client.storage.from(bucket).upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    });

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    return {
      storagePath,
      fileName: file.name,
      fileSizeBytes: file.size,
      mimeType: file.type || 'application/octet-stream',
    };
  },

  async getSignedDownloadUrl(
    bucket: StorageBucketName,
    storagePath: string,
    expiresInSeconds = 120,
    options?: { downloadFileName?: string }
  ): Promise<string> {
    const client = requireSupabaseClient();
    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUrl(
        storagePath,
        expiresInSeconds,
        options?.downloadFileName ? { download: options.downloadFileName } : undefined
      );

    if (error || !data?.signedUrl) {
      throw new Error(error?.message ?? 'Unable to generate signed download URL.');
    }

    return data.signedUrl;
  },

  async removeFile(bucket: StorageBucketName, storagePath: string): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.storage.from(bucket).remove([storagePath]);
    if (error) {
      throw new Error(`Storage deletion failed: ${error.message}`);
    }
  },
};
