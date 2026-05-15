import React from 'react';
import '../core/i18n';
import { AppNavigator } from './navigation/AppNavigator';
import { AppProviders } from './providers/AppProviders';

const App = (): React.JSX.Element => (
  <AppProviders>
    <AppNavigator />
  </AppProviders>
);

export default App;
