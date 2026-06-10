// expo-notifications mock. Captures the response listener so tests can drive the
// notification deep-link branches in AppNavigator.
export const __notif: {
  responseCb: ((response: unknown) => void) | null;
  remove: jest.Mock;
} = {
  responseCb: null,
  remove: jest.fn(),
};

export const setNotificationHandler = jest.fn();

export const addNotificationResponseReceivedListener = jest.fn(
  (cb: (response: unknown) => void) => {
    __notif.responseCb = cb;
    return { remove: __notif.remove };
  },
);
