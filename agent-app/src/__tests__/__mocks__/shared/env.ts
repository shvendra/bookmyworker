export const ENV = {
  API_BASE_URL: 'https://test.api',
};

export const S3_BASE = 'https://s3.test';
export const buildPhotoUrl = (path?: string | null): string | undefined =>
  path ? `${S3_BASE}/${path}` : undefined;
