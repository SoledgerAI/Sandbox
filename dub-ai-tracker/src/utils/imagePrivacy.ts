// Image privacy utilities — EXIF stripping for food scan photos
// Security audit: EXIF metadata contains GPS coordinates, device info,
// timestamps that must be stripped before sending to Anthropic API
// or storing locally.

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// Bug #11: Anthropic API rejects images >5MB base64-encoded. Raw iPhone
// photos at 4032x3024 can hit that ceiling even after re-compression.
// 1568px on the long edge is Anthropic's recommended size for vision —
// keeps quality high while well under the size limit.
const MAX_DIMENSION = 1568;

/**
 * Strip EXIF metadata from an image by re-encoding it AND resize so the
 * longer edge is at most MAX_DIMENSION. Re-encoding through
 * expo-image-manipulator discards all EXIF data (GPS, camera model,
 * timestamps) while preserving the image content.
 *
 * @param uri - Local file URI of the image
 * @param quality - JPEG compression quality (0-1), default 0.8
 * @returns URI of the stripped+resized image (new file in cache)
 */
export async function stripExifMetadata(
  uri: string,
  quality: number = 0.8,
): Promise<string> {
  // Cheap initial pass to read original dimensions
  const info = await manipulateAsync(uri, [], { format: SaveFormat.JPEG });

  const longEdge = Math.max(info.width, info.height);
  const actions =
    longEdge > MAX_DIMENSION
      ? [
          {
            resize:
              info.height >= info.width
                ? { height: MAX_DIMENSION }
                : { width: MAX_DIMENSION },
          },
        ]
      : [];

  const result = await manipulateAsync(info.uri, actions, {
    compress: quality,
    format: SaveFormat.JPEG,
  });
  return result.uri;
}
