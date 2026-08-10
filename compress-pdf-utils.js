export const COMPRESSION_PRESETS = Object.freeze({
  high: Object.freeze({ scale: 2.1, jpegQuality: 0.86, maxDimension: 3200 }),
  balanced: Object.freeze({ scale: 1.75, jpegQuality: 0.78, maxDimension: 2800 }),
  small: Object.freeze({ scale: 1.2, jpegQuality: 0.62, maxDimension: 2000 }),
});

const HIGH_QUALITY_FALLBACKS = Object.freeze([
  COMPRESSION_PRESETS.high,
  Object.freeze({ scale: 1.95, jpegQuality: 0.81, maxDimension: 3000 }),
  COMPRESSION_PRESETS.balanced,
  Object.freeze({ scale: 1.5, jpegQuality: 0.7, maxDimension: 2400 }),
  COMPRESSION_PRESETS.small,
]);

const BALANCED_QUALITY_FALLBACKS = Object.freeze([
  COMPRESSION_PRESETS.balanced,
  Object.freeze({ scale: 1.5, jpegQuality: 0.72, maxDimension: 2400 }),
  Object.freeze({ scale: 1.35, jpegQuality: 0.67, maxDimension: 2200 }),
  COMPRESSION_PRESETS.small,
]);

const SMALL_FILE_ATTEMPTS = Object.freeze([COMPRESSION_PRESETS.small]);

export const getCompressionAttempts = (quality) => {
  if (quality === 'high') return HIGH_QUALITY_FALLBACKS;
  if (quality === 'small') return SMALL_FILE_ATTEMPTS;
  return BALANCED_QUALITY_FALLBACKS;
};

export const formatCompressedBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes >= 10 ? megabytes.toFixed(0) : megabytes.toFixed(1).replace('.', ',')} MB`;
};

export const normalizeCompressedName = (value) => {
  const withoutExtension = String(value || '')
    .trim()
    .replace(/\.pdf$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 76);
  return `${withoutExtension || 'documento-comprimido'}.pdf`;
};

const containsAsciiSequence = (bytes, sequence) => {
  const pattern = [...sequence].map((character) => character.charCodeAt(0));
  for (let offset = 0; offset <= bytes.length - pattern.length; offset += 1) {
    let matches = true;
    for (let index = 0; index < pattern.length; index += 1) {
      if (bytes[offset + index] !== pattern[index]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return false;
};

export const hasPdfDigitalSignature = (bytes) => {
  return containsAsciiSequence(bytes, '/ByteRange')
    || containsAsciiSequence(bytes, '/Type /Sig')
    || containsAsciiSequence(bytes, '/Type/Sig')
    || containsAsciiSequence(bytes, '/SubFilter /adbe.pkcs7')
    || containsAsciiSequence(bytes, '/SubFilter/adbe.pkcs7');
};

export const calculateCompressionSavings = (originalBytes, compressedBytes) => {
  if (!Number.isFinite(originalBytes) || originalBytes <= 0 || !Number.isFinite(compressedBytes)) return 0;
  return Math.max(0, Math.round((1 - (compressedBytes / originalBytes)) * 100));
};

export const getRenderScale = (pageWidth, pageHeight, preset) => {
  const desiredScale = preset?.scale || COMPRESSION_PRESETS.balanced.scale;
  const maxDimension = preset?.maxDimension || COMPRESSION_PRESETS.balanced.maxDimension;
  return Math.min(desiredScale, maxDimension / Math.max(pageWidth, pageHeight));
};
