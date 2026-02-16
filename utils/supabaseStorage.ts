import { supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system';

const STORAGE_BUCKET = 'meal-photos';

/**
 * Upload an image file to Supabase Storage
 * @param localUri - Local file URI to upload
 * @param userId - User ID for organizing files
 * @returns Public URL of the uploaded image
 */
export async function uploadImageToSupabase(
  localUri: string,
  userId: string
): Promise<string> {
  try {
    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to blob
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });

    // Generate unique filename
    const filename = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filename, blob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.error('Error uploading image:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL');
    }

    console.log('Image uploaded successfully:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error in uploadImageToSupabase:', error);
    throw error;
  }
}

/**
 * Delete an image from Supabase Storage
 * @param imageUrl - Public URL of the image to delete
 */
export async function deleteImageFromSupabase(imageUrl: string): Promise<void> {
  try {
    // Extract path from URL
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split('/');
    const bucketIndex = pathParts.findIndex(part => part === STORAGE_BUCKET);
    
    if (bucketIndex === -1) {
      throw new Error('Invalid image URL');
    }

    const filePath = pathParts.slice(bucketIndex + 1).join('/');

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('Error deleting image:', error);
      throw new Error(`Failed to delete image: ${error.message}`);
    }

    console.log('Image deleted successfully:', filePath);
  } catch (error) {
    console.error('Error in deleteImageFromSupabase:', error);
    throw error;
  }
}

/**
 * Upload base64 image string to Supabase Storage
 * @param base64Image - Base64 encoded image string
 * @param userId - User ID for organizing files
 * @returns Public URL of the uploaded image
 */
export async function uploadBase64ImageToSupabase(
  base64Image: string,
  userId: string
): Promise<string> {
  try {
    // Remove data URL prefix if present
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    
    // Convert base64 to blob
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });

    // Generate unique filename
    const filename = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filename, blob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.error('Error uploading image:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL');
    }

    console.log('Image uploaded successfully:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error in uploadBase64ImageToSupabase:', error);
    throw error;
  }
}
