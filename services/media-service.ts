import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';

/**
 * Optimized Media Service for Expo 54
 * Uses the legacy API to avoid deprecation warnings while ensuring offline availability.
 */
export class MediaService {
  private static readonly CACHE_FOLDER = 'card_images';

  private static getFolderUri() {
    return `${FileSystem.documentDirectory}${this.CACHE_FOLDER}/`;
  }

  private static async ensureDirExists() {
    const folderUri = this.getFolderUri();
    try {
      const dirInfo = await FileSystem.getInfoAsync(folderUri);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(folderUri, { intermediates: true });
      }
    } catch (e) {
      // Fallback for directory creation
      try {
        await FileSystem.makeDirectoryAsync(folderUri, { intermediates: true });
      } catch (inner) {}
    }
  }

  static async downloadImage(remoteUrl: string): Promise<string | null> {
    if (!remoteUrl || !remoteUrl.startsWith('http')) return remoteUrl;

    try {
      await this.ensureDirExists();
      
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        remoteUrl
      );
      const extension = remoteUrl.split('.').pop()?.split('?')[0] || 'jpg';
      const localUri = `${this.getFolderUri()}${hash}.${extension}`;

      // Check if already downloaded
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (fileInfo.exists) return localUri;

      console.log(`📡 [MediaService] Downloading: ${remoteUrl}`);
      const downloadResult = await FileSystem.downloadAsync(remoteUrl, localUri);
      
      return downloadResult.status === 200 ? downloadResult.uri : remoteUrl;
    } catch (error) {
      console.warn('⚠️ [MediaService] Image download failed, using remote fallback');
      return remoteUrl; // Fallback to web URL
    }
  }

  /**
   * Downloads multiple images in parallel
   */
  static async downloadImages(urls: string[]): Promise<string[]> {
    if (!urls || urls.length === 0) return [];
    try {
      const results = await Promise.all(urls.map(url => this.downloadImage(url)));
      return results.filter((res): res is string => res !== null);
    } catch (e) {
      return urls;
    }
  }

  /**
   * Clears all cached images
   */
  static async clearCache() {
    try {
      const folderUri = this.getFolderUri();
      await FileSystem.deleteAsync(folderUri, { idempotent: true });
    } catch (e) {
      console.error('❌ [MediaService] Clear cache failed:', e);
    }
  }
}
