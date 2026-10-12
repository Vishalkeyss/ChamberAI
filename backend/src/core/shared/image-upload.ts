import { AppError, ErrorCodes } from './errors';

// Image uploads: only raster formats, verified by magic bytes (never trust client MIME).
export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

export function detectImageType(bytes: ArrayBuffer | Uint8Array): { mime: string; ext: string } | null {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  return null;
}

export function validateImageUpload(fileBuffer: ArrayBuffer | Uint8Array, maxBytes: number): { mime: string; ext: string } {
  const size = fileBuffer.byteLength;
  if (!size) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Uploaded file is empty', 400);
  }
  if (size > maxBytes) {
    throw new AppError(
      ErrorCodes.BAD_REQUEST,
      `File too large. Maximum size is ${Math.round(maxBytes / (1024 * 1024))}MB`,
      400
    );
  }
  const detected = detectImageType(fileBuffer);
  if (!detected) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Only PNG, JPG or WEBP images are allowed', 400);
  }
  return detected;
}
