import { createNavigationContainerRef } from '@react-navigation/native';

// Navigation ref used for imperative navigation from outside components
export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}

export default navigationRef;
