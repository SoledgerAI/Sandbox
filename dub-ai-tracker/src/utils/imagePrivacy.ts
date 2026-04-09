// Image privacy utilities — EXIF stripping for food scan photos
// Security audit: EXIF metadata contains GPS coordinates, device info,
// timestamps that must be stripped before sending to Anthropic API
// or storing locally.

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * Strip EXIF metadata from an image by re-encoding it.
 * Re-encoding through expo-image-manipulator discards all EXIF data
 * (GPS, camera model, timestamps) while preserving the image content.
 *
 * @param uri - Local file URI of the image
 * @param quality - JPEG compression quality (0-1), default 0.8
 * @returns URI of the stripped image (new file in cache)
 */
export async function stripExifMetadata(
  uri: string,
  quality: number = 0.8,
): Promise<string> {
  const result = await manipulateAsync(uri, [], {
    compress: quality,
    format: SaveFormat.JPEG,
  });
  return result.uri;
}
