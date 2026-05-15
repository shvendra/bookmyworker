import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';
import type { RootStackParamList } from '../../app/navigation/types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Force-navigate to Welcome screen, wiping the entire stack. Safe to call from anywhere. */
export const resetToWelcome = (): void => {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'Welcome' }] })
    );
  }
};
