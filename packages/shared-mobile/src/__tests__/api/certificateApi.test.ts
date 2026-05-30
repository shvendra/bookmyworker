/**
 * Unit tests for certificateApi — getAll, upload (native + web paths), delete, labour licence.
 */
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../core/storage/authStorage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
  clearAuthSession: jest.fn(),
}));
jest.mock('../../state/auth/authEventBus', () => ({ emitForceSignOut: jest.fn() }));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  FileSystemUploadType: { MULTIPART: 'MULTIPART' },
  uploadAsync: jest.fn(),
}));
// react-native Platform is mocked to 'android' in reactNative.ts mock

import { apiClient } from '../../core/api/client';
import { certificateApi } from '../../core/api/endpoints/certificateApi';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FileSystem = require('expo-file-system') as { uploadAsync: jest.Mock; FileSystemUploadType: { MULTIPART: string } };

const mockUploadAsync = FileSystem.uploadAsync;

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mockUploadAsync.mockReset();
});
afterEach(() => { mock.restore(); jest.clearAllMocks(); });

const cert = {
  name: 'Electrical Safety',
  url: 'https://s3.example.com/cert-001.jpg',
  uploadedAt: '2024-01-01T00:00:00.000Z',
};

// ── getAll ────────────────────────────────────────────────────────────────────

describe('certificateApi.getAll', () => {
  it('returns certificates and labourLicenceUrl', async () => {
    mock.onGet('/api/v1/user/certificates').reply(200, {
      success: true,
      certificates: [cert],
      labourLicenceUrl: 'https://s3.example.com/licence.pdf',
    });
    const res = await certificateApi.getAll();
    expect(res.certificates).toHaveLength(1);
    expect(res.certificates[0].name).toBe('Electrical Safety');
    expect(res.labourLicenceUrl).toBe('https://s3.example.com/licence.pdf');
  });

  it('returns empty array and null licence when fields missing', async () => {
    mock.onGet('/api/v1/user/certificates').reply(200, { success: true });
    const res = await certificateApi.getAll();
    expect(res.certificates).toEqual([]);
    expect(res.labourLicenceUrl).toBeNull();
  });

  it('throws on server error', async () => {
    mock.onGet('/api/v1/user/certificates').reply(500, { message: 'Server error' });
    await expect(certificateApi.getAll()).rejects.toMatchObject({ statusCode: 500 });
  });
});

// ── uploadCertificate (native path: file://) ──────────────────────────────────

describe('certificateApi.uploadCertificate — native path', () => {
  it('uploads certificate via FileSystem.uploadAsync and returns Certificate', async () => {
    mockUploadAsync.mockResolvedValue({
      status: 200,
      body: JSON.stringify({ success: true, certificate: cert }),
    });
    const res = await certificateApi.uploadCertificate(
      'file:///tmp/cert.jpg',
      'cert.jpg',
      'image/jpeg',
      'Electrical Safety'
    );
    expect(res.name).toBe('Electrical Safety');
    expect(mockUploadAsync).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/user/upload-certificate'),
      'file:///tmp/cert.jpg',
      expect.objectContaining({
        fieldName: 'certificate',
        mimeType: 'image/jpeg',
        parameters: { certName: 'Electrical Safety' },
      })
    );
  });

  it('throws when status >= 400', async () => {
    mockUploadAsync.mockResolvedValue({
      status: 413,
      body: JSON.stringify({ message: 'File too large' }),
    });
    await expect(
      certificateApi.uploadCertificate('file:///big.jpg', 'big.jpg', 'image/jpeg', 'Cert')
    ).rejects.toThrow('File too large');
  });

  it('throws with default message when error body missing message', async () => {
    mockUploadAsync.mockResolvedValue({
      status: 500,
      body: JSON.stringify({}),
    });
    await expect(
      certificateApi.uploadCertificate('file:///x.jpg', 'x.jpg', 'image/jpeg', 'C')
    ).rejects.toThrow('Upload failed (500)');
  });

  it('throws when success is false in response', async () => {
    mockUploadAsync.mockResolvedValue({
      status: 200,
      body: JSON.stringify({ success: false, message: 'Invalid certificate' }),
    });
    await expect(
      certificateApi.uploadCertificate('file:///x.jpg', 'x.jpg', 'image/jpeg', 'C')
    ).rejects.toThrow('Invalid certificate');
  });

  it('throws with default upload failed when success=false and no message', async () => {
    mockUploadAsync.mockResolvedValue({
      status: 200,
      body: JSON.stringify({ success: false }),
    });
    await expect(
      certificateApi.uploadCertificate('file:///x.jpg', 'x.jpg', 'image/jpeg', 'C')
    ).rejects.toThrow('Upload failed');
  });
});

// ── deleteCertificate ─────────────────────────────────────────────────────────

describe('certificateApi.deleteCertificate', () => {
  it('deletes by index and returns updated certificates array', async () => {
    mock.onDelete('/api/v1/user/certificate/0').reply(200, {
      success: true,
      certificates: [],
    });
    const res = await certificateApi.deleteCertificate(0);
    expect(res).toEqual([]);
  });

  it('returns remaining certs after deletion', async () => {
    mock.onDelete('/api/v1/user/certificate/1').reply(200, {
      success: true,
      certificates: [cert],
    });
    const res = await certificateApi.deleteCertificate(1);
    expect(res).toHaveLength(1);
  });

  it('throws 404 when index out of range', async () => {
    mock.onDelete('/api/v1/user/certificate/99').reply(404, { message: 'Certificate not found' });
    await expect(certificateApi.deleteCertificate(99))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── uploadLabourLicence (native path) ─────────────────────────────────────────

describe('certificateApi.uploadLabourLicence — native path', () => {
  it('uploads licence and returns URL', async () => {
    mockUploadAsync.mockResolvedValue({
      status: 200,
      body: JSON.stringify({ success: true, labourLicenceUrl: 'https://s3.example.com/licence.pdf' }),
    });
    const url = await certificateApi.uploadLabourLicence(
      'file:///tmp/licence.pdf',
      'licence.pdf',
      'application/pdf'
    );
    expect(url).toBe('https://s3.example.com/licence.pdf');
    expect(mockUploadAsync).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/user/upload-labour-licence'),
      'file:///tmp/licence.pdf',
      expect.objectContaining({ fieldName: 'licence' })
    );
  });

  it('throws when upload fails (status >= 400)', async () => {
    mockUploadAsync.mockResolvedValue({
      status: 400,
      body: JSON.stringify({ message: 'Invalid file type' }),
    });
    await expect(
      certificateApi.uploadLabourLicence('file:///bad.exe', 'bad.exe', 'application/octet-stream')
    ).rejects.toThrow('Invalid file type');
  });

  it('throws when success is false', async () => {
    mockUploadAsync.mockResolvedValue({
      status: 200,
      body: JSON.stringify({ success: false, message: 'Processing failed' }),
    });
    await expect(
      certificateApi.uploadLabourLicence('file:///x.pdf', 'x.pdf', 'application/pdf')
    ).rejects.toThrow('Processing failed');
  });
});

// ── deleteLabourLicence ───────────────────────────────────────────────────────

describe('certificateApi.deleteLabourLicence', () => {
  it('deletes the labour licence and resolves void', async () => {
    mock.onDelete('/api/v1/user/labour-licence').reply(200, { success: true });
    await expect(certificateApi.deleteLabourLicence()).resolves.toBeUndefined();
  });

  it('throws when no licence exists', async () => {
    mock.onDelete('/api/v1/user/labour-licence').reply(404, { message: 'No licence found' });
    await expect(certificateApi.deleteLabourLicence()).rejects.toMatchObject({ statusCode: 404 });
  });
});
