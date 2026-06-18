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

  /**
   * Generates a stable hash for a URL by ignoring query parameters
   */
  private static getStableUrl(url: string): string {
    try {
      // Remove query string and hash fragments for consistent caching
      return url.split('?')[0].split('#')[0];
    } catch (e) {
      return url;
    }
  }

  static async downloadImage(remoteUrl: string): Promise<string | null> {
    if (!remoteUrl || !remoteUrl.startsWith('http')) return remoteUrl;

    try {
      await this.ensureDirExists();
      
      const stableUrl = this.getStableUrl(remoteUrl);
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        stableUrl
      );
      
      const extension = stableUrl.split('.').pop() || 'jpg';
      const localUri = `${this.getFolderUri()}${hash}.${extension}`;

      // Check if already downloaded
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (fileInfo.exists) return localUri;

      console.log(`📡 [MediaService] Downloading: ${remoteUrl}`);
      const downloadResult = await FileSystem.downloadAsync(remoteUrl, localUri);
      
      return downloadResult.status === 200 ? downloadResult.uri : remoteUrl;
    } catch (error) {
      console.warn('⚠️ [MediaService] Image download failed, using remote fallback:', error);
      return remoteUrl; // Fallback to web URL
    }
  }

  /**
   * Downloads multiple images in parallel with controlled concurrency
   */
  static async downloadImages(urls: string[]): Promise<string[]> {
    if (!urls || urls.length === 0) return [];
    try {
      const results: string[] = [];
      // Simple chunking (3 at a time) to avoid overloading the network
      for (let i = 0; i < urls.length; i += 3) {
        const chunk = urls.slice(i, i + 3);
        const chunkResults = await Promise.all(chunk.map(url => this.downloadImage(url)));
        results.push(...chunkResults.filter((res): res is string => res !== null));
      }
      return results;
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

