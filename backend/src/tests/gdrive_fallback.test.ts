/**
 * S3 key isolation and key-builder unit tests.
 *
 * These tests verify that:
 * 1. The key-builder generates distinct, non-overlapping S3 keys for different applications.
 * 2. Certificate keys follow the expected naming convention.
 * 3. Proof keys follow the expected naming convention.
 * 4. The LocalStorageProvider interface (used in CI) is fully compatible with IStorageProvider.
 */

import { describe, it, expect } from 'vitest';
import {
  buildCertificateKey,
  buildProofKey,
  slugify,
  splitKey,
} from '../services/storage/key-builder';
import { LocalStorageProvider } from '../services/storage/local.provider';

describe('key-builder: slugify', () => {
  it('lowercases and replaces non-alphanumeric chars with hyphens', () => {
    expect(slugify('Smart India Hackathon 2024!')).toBe('smart-india-hackathon-2024');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  --hello-- ')).toBe('hello');
  });

  it('handles already-clean slugs', () => {
    expect(slugify('ai-conference')).toBe('ai-conference');
  });
});

describe('key-builder: buildCertificateKey', () => {
  const base = {
    yearFolder: 'Third Year',
    section: 'A',
    studentId: '727624BAD117',
    categoryFolder: 'Cocurricular',
    subFolder: 'Hackathon',
    eventSlug: 'smart-india-hackathon',
    requirementId: 284n,
    version: 1,
  };

  it('generates the correct S3 key for a Cocurricular certificate', () => {
    const key = buildCertificateKey(base);
    expect(key).toBe(
      'Certificates/Third Year/A/727624BAD117/Cocurricular/Hackathon/smart-india-hackathon_req284_v1.pdf'
    );
  });

  it('increments version correctly', () => {
    const key = buildCertificateKey({ ...base, version: 2 });
    expect(key).toContain('_v2.pdf');
  });

  it('omits subFolder for "Others" category to avoid user-controlled path segments', () => {
    const key = buildCertificateKey({ ...base, categoryFolder: 'Others', subFolder: 'Misc' });
    expect(key).toBe(
      'Certificates/Third Year/A/727624BAD117/Others/smart-india-hackathon_req284_v1.pdf'
    );
    expect(key).not.toContain('Misc');
  });

  it('two different students generate non-overlapping keys', () => {
    const key1 = buildCertificateKey({ ...base, studentId: 'STUDENT_001', requirementId: 100n });
    const key2 = buildCertificateKey({ ...base, studentId: 'STUDENT_002', requirementId: 200n });
    expect(key1).not.toBe(key2);
  });

  it('two different events for the same student generate non-overlapping keys', () => {
    const key1 = buildCertificateKey({ ...base, requirementId: 100n });
    const key2 = buildCertificateKey({ ...base, requirementId: 101n });
    expect(key1).not.toBe(key2);
  });
});

describe('key-builder: buildProofKey', () => {
  const base = {
    yearFolder: 'Third Year',
    section: 'A',
    studentId: '727624BAD117',
    eventSlug: 'smart-india-hackathon',
    applicationId: 1234n,
    extension: 'pdf',
  };

  it('generates the correct S3 key for a proof file', () => {
    const key = buildProofKey(base);
    expect(key).toBe(
      'Proofs/Third Year/A/727624BAD117/smart-india-hackathon_app1234.pdf'
    );
  });

  it('sanitizes extension to prevent injection', () => {
    const key = buildProofKey({ ...base, extension: 'p../df' });
    expect(key).toMatch(/\.pdf$/);
  });

  it('two different applications generate non-overlapping proof keys', () => {
    const key1 = buildProofKey({ ...base, applicationId: 1n });
    const key2 = buildProofKey({ ...base, applicationId: 2n });
    expect(key1).not.toBe(key2);
  });
});

describe('key-builder: splitKey', () => {
  it('splits a full key into folderPath and fileName', () => {
    const { folderPath, fileName } = splitKey('Certificates/Third Year/A/SID/Cocurricular/Hackathon/event_req1_v1.pdf');
    expect(folderPath).toBe('Certificates/Third Year/A/SID/Cocurricular/Hackathon');
    expect(fileName).toBe('event_req1_v1.pdf');
  });

  it('handles a key with no path separator', () => {
    const { folderPath, fileName } = splitKey('standalone.pdf');
    expect(folderPath).toBe('');
    expect(fileName).toBe('standalone.pdf');
  });
});

describe('LocalStorageProvider: IStorageProvider compatibility', () => {
  it('uploadFile returns fileId, fileUrl and path', async () => {
    const provider = new LocalStorageProvider();
    const buffer = Buffer.from('test pdf content');
    const result = await provider.uploadFile({
      fileName: 's3_test_cert.pdf',
      folderPath: 'Certificates/Third Year/A/TEST123/Cocurricular/Hackathon',
      mimeType: 'application/pdf',
      buffer,
    });

    expect(result).toBeDefined();
    expect(result.fileId).toBeDefined();
    expect(result.fileUrl).toContain('/uploads/');
    expect(result.path).toBeDefined();

    // Cleanup
    await provider.deleteFile(result.fileId);
  });

  it('getDownloadUrl returns a path based URL', async () => {
    const provider = new LocalStorageProvider();
    const url = await provider.getDownloadUrl('some/relative/path.pdf');
    expect(url).toBe('/uploads/some/relative/path.pdf');
  });
});
