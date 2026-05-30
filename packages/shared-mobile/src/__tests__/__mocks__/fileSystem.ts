export const FileSystemUploadType = { MULTIPART: 'MULTIPART' };

export const uploadAsync = jest.fn(async (_url: string, _uri: string, _opts: unknown) => ({
  status: 200,
  body: JSON.stringify({ success: true, certificate: { name: 'cert', url: 'https://s3.example.com/cert.jpg' }, labourLicenceUrl: 'https://s3.example.com/licence.pdf' }),
}));
