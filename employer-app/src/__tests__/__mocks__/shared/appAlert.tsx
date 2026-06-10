import React from 'react';

export const showAlert = jest.fn();

export const AppAlertProvider = ({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode => children;
