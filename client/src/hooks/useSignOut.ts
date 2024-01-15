import { useCallback, useContext } from 'react';
import { deleteAuthCookie } from '../utils';
import { githubLogout } from '../services/api';
import { UIContext } from '../context/uiContext';
import { DeviceContext } from '../context/deviceContext';

export const useSignOut = () => {
  const { isSelfServe } = useContext(DeviceContext);
  const { setShouldShowWelcome } = useContext(UIContext.Onboarding);
  const { setGithubConnected } = useContext(UIContext.GitHubConnected);

  const signOut = useCallback(() => {
    setShouldShowWelcome(true);
    deleteAuthCookie();
    setGithubConnected(false);
    if (!isSelfServe) {
      githubLogout();
    }
  }, []);

  return signOut;
};
