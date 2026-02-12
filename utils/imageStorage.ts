import * as FileSystem from 'expo-file-system';

type FileSystemDirectories = {
  documentDirectory?: string;
  cacheDirectory?: string;
};

const fileSystemDirs = FileSystem as unknown as FileSystemDirectories;
const baseDirectory = fileSystemDirs.documentDirectory ?? fileSystemDirs.cacheDirectory ?? 'file:///';
const IMAGES_DIR = `${baseDirectory}meal-photos/`;

async function ensureDirectoryExists() {
  const dirInfo = await FileSystem.getInfoAsync(IMAGES_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(IMAGES_DIR, { intermediates: true });
  }
}

export async function saveImagePermanently(tempUri: string): Promise<string> {
  try {
    await ensureDirectoryExists();
    
    const filename = `meal_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
    const permanentUri = IMAGES_DIR + filename;
    
    await FileSystem.copyAsync({
      from: tempUri,
      to: permanentUri,
    });
    
    console.log('Image saved permanently:', permanentUri);
    return permanentUri;
  } catch (error) {
    console.error('Error saving image permanently:', error);
    throw error;
  }
}

export async function deleteImage(uri: string): Promise<void> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(uri);
      console.log('Image deleted:', uri);
    }
  } catch (error) {
    console.error('Error deleting image:', error);
  }
}

export async function getAllStoredImages(): Promise<string[]> {
  try {
    await ensureDirectoryExists();
    const files = await FileSystem.readDirectoryAsync(IMAGES_DIR);
    return files.map(file => IMAGES_DIR + file);
  } catch (error) {
    console.error('Error reading stored images:', error);
    return [];
  }
}

export async function getImageSize(): Promise<number> {
  try {
    await ensureDirectoryExists();
    const files = await FileSystem.readDirectoryAsync(IMAGES_DIR);
    let totalSize = 0;
    
    for (const file of files) {
      const fileUri = IMAGES_DIR + file;
      const info = await FileSystem.getInfoAsync(fileUri);
      if (info.exists && 'size' in info) {
        totalSize += info.size;
      }
    }
    
    return totalSize;
  } catch (error) {
    console.error('Error calculating image size:', error);
    return 0;
  }
}
