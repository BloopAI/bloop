import { useTranslation } from 'react-i18next';
import { memo } from 'react';
import {
  ChevronRight,
  Globe2,
  HardDrive,
  Repository,
  RepositoryFilled,
} from '../../icons';

type Props = {
  type: 'local' | 'github' | 'public';
  onClick: (type: 'local' | 'github' | 'public') => void;
};

const typeMap = {
  local: {
    icon: (
      <div className="w-4 h-4">
        <HardDrive raw />
      </div>
    ),
    title: 'Local repository',
    description: 'Add a repository from your local machine',
  },
  github: {
    icon: (
      <div className="w-3.5 h-4">
        <RepositoryFilled raw />
      </div>
    ),
    title: 'Your GitHub repository',
    description: 'Any repository from you private GitHub account',
  },
  public: {
    icon: (
      <div className="w-4 h-4">
        <Globe2 raw />
      </div>
    ),
    title: 'Public repository',
    description: 'Any public repository hosted on GitHub',
  },
};

const AddRepoCard = ({ type, onClick }: Props) => {
  const { t } = useTranslation();

  return (
    <button
      className="flex flex-1 flex-col text-left gap-1 p-4 bg-bg-base border border-bg-base hover:bg-bg-base-hover hover:border-bg-border-hover focus:bg-bg-base-hover focus:border-bg-border-hover rounded-md cursor-pointer group"
      onClick={() => onClick(type)}
    >
      <div className="flex gap-2 items-center text-label-muted group-hover:text-label-title">
        {typeMap[type].icon}
        <p className="subhead-s text-label-title flex-1">
          {t(typeMap[type].title)}
        </p>
        <ChevronRight className="group-hover:text-bg-main" />
      </div>
      <p className="pl-6 caption text-label-muted group-hover:text-label-base">
        {t(typeMap[type].description)}
      </p>
    </button>
  );
};

export default memo(AddRepoCard);
