// expo-notifications mock. Captures both listeners so AppNavigator tests can
// drive the foreground + response (deep-link) branches.
export const __notif: {
  responseCb: ((response: unknown) => void) | null;
  receivedCb: ((notification: unknown) => void) | null;
  removeResponse: jest.Mock;
  removeReceived: jest.Mock;
} = {
  responseCb: null,
  receivedCb: null,
  removeResponse: jest.fn(),
  removeReceived: jest.fn(),
};

export const setNotificationHandler = jest.fn();

export const addNotificationReceivedListener = jest.fn(
  (cb: (notification: unknown) => void) => {
    __notif.receivedCb = cb;
    return { remove: __notif.removeReceived };
  },
);

export const addNotificationResponseReceivedListener = jest.fn(
  (cb: (response: unknown) => void) => {
    __notif.responseCb = cb;
    return { remove: __notif.removeResponse };
  },
);

export type EventSubscription = { remove: () => void };
