/**
 * key-builder.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for generating S3 object keys.
 * Controllers, routes and business services must never construct S3 keys manually.
 */

/**
 * Slugify a title string for safe use inside S3 object keys.
 * Lowercases, replaces non-alphanumeric runs with hyphens, trims leading/trailing hyphens.
 */
export const slugify = (str: string): string =>
  str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// ─── Certificate Keys ─────────────────────────────────────────────────────────

export interface CertificateKeyParams {
  /** e.g. "Third Year" */
  yearFolder: string;
  /** e.g. "A" */
  section: string;
  /** e.g. "727624BAD117" */
  studentId: string;
  /** "Cocurricular" | "Extracurricular" | "Others" */
  categoryFolder: string;
  /**
   * Activity type subfolder (e.g. "Hackathon", "Sports").
   * Ignored when categoryFolder is "Others".
   */
  subFolder: string;
  /** Slugified event title, e.g. "smart-india-hackathon" */
  eventSlug: string;
  requirementId: bigint;
  version: number;
}

/**
 * Build the full S3 object key for a certificate file.
 *
 * Examples:
 *   Certificates/Third Year/A/727624BAD117/Cocurricular/Hackathon/smart-india-hackathon_req284_v1.pdf
 *   Certificates/Third Year/A/727624BAD117/Others/ai-conference_req188_v1.pdf
 */
export const buildCertificateKey = (p: CertificateKeyParams): string => {
  const filename = `${p.eventSlug}_req${p.requirementId}_v${p.version}.pdf`;
  const parts: string[] = ['Certificates', p.yearFolder, p.section, p.studentId, p.categoryFolder];
  // For "Others" we intentionally skip the subFolder to avoid user-controlled path segments
  if (p.categoryFolder !== 'Others' && p.subFolder) {
    parts.push(p.subFolder);
  }
  parts.push(filename);
  return parts.join('/');
};

// ─── Proof Keys ───────────────────────────────────────────────────────────────

export interface ProofKeyParams {
  /** e.g. "Third Year" */
  yearFolder: string;
  /** e.g. "A" */
  section: string;
  /** e.g. "727624BAD117" */
  studentId: string;
  /** Slugified event title */
  eventSlug: string;
  applicationId: bigint;
  /** File extension without dot, e.g. "pdf" | "jpg" | "png" */
  extension: string;
}

/**
 * Build the full S3 object key for a proof file.
 *
 * Example:
 *   Proofs/Third Year/A/727624BAD117/smart-india-hackathon_app1234.pdf
 */
export const buildProofKey = (p: ProofKeyParams): string => {
  const safeExt = p.extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'pdf';
  const filename = `${p.eventSlug}_app${p.applicationId}.${safeExt}`;
  return `Proofs/${p.yearFolder}/${p.section}/${p.studentId}/${filename}`;
};

/**
 * Split a full S3 key into { folderPath, fileName } so it can be passed
 * directly to IStorageProvider.uploadFile().
 */
export const splitKey = (key: string): { folderPath: string; fileName: string } => {
  const lastSlash = key.lastIndexOf('/');
  return lastSlash === -1
    ? { folderPath: '', fileName: key }
    : { folderPath: key.substring(0, lastSlash), fileName: key.substring(lastSlash + 1) };
};
