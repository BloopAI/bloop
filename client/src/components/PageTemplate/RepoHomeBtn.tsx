import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../Button';
import { AppNavigationContext } from '../../context/appNavigationContext';
import { UIContext } from '../../context/uiContext';
import { Repository } from '../../icons';

const RepoHomeBtn = () => {
  const { t } = useTranslation();
  const { navigateRepoPath } = useContext(AppNavigationContext);
  const { tab } = useContext(UIContext);

  return (
    <Button
      onlyIcon
      title={t('Repo home')}
      onClick={() => navigateRepoPath(tab.repoName)}
      variant="tertiary"
      size="small"
    >
      <Repository />
    </Button>
  );
};

export default RepoHomeBtn;
