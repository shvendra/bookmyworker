// expo-document-picker mock. `getDocumentAsync` is a configurable jest mock so
// tests can simulate a successful pick, a cancellation, or a thrown error.
export const getDocumentAsync = jest.fn(async () => ({
  canceled: false,
  assets: [{ uri: 'file:///resume.pdf', name: 'resume.pdf' }],
}));
