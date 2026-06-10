// expo-image-picker mock. `launchImageLibraryAsync` is a configurable jest mock
// so tests can simulate a successful pick, a cancellation, or a thrown error.
export const launchImageLibraryAsync = jest.fn(async () => ({
  canceled: false,
  assets: [{ uri: 'file:///id.jpg', mimeType: 'image/jpeg' }],
}));
