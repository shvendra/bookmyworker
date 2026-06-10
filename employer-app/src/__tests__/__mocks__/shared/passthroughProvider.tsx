// Generic passthrough provider — used for ToastProvider (and any provider whose
// runtime behaviour is irrelevant to the employer-app units under test).
import React from 'react';

export const ToastProvider = ({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode => children;

export default ToastProvider;
