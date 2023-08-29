import { useTranslation } from 'react-i18next';
import { memo } from 'react';
import {
  ChevronRight,
  CodeStudioIcon,
  Globe2,
  HardDrive,
  RepositoryFilled,
} from '../../icons';

type Props = {
  type: 'local' | 'github' | 'public' | 'studio';
  onClick: (type: 'local' | 'github' | 'public' | 'studio') => void;
};

const typeMap = {
  local: {
    icon: <HardDrive raw sizeClassName="w-4 h-4" />,
    title: 'Local repository',
    description: 'Add a repository from your local machine',
  },
  github: {
    icon: <RepositoryFilled raw sizeClassName="w-3.5 h-4" />,
    title: 'Your GitHub repository',
    description: 'Any repository from you private GitHub account',
  },
  public: {
    icon: <Globe2 raw sizeClassName="w-4 h-4" />,
    title: 'Public repository',
    description: 'Any public repository hosted on GitHub',
  },
  studio: {
    icon: <CodeStudioIcon raw sizeClassName="w-4 h-4" />,
    title: 'Studio project',
    description: 'Use generative AI with a user defined context',
  },
};

const AddRepoCard = ({ type, onClick }: Props) => {
  const { t } = useTranslation();

  return (
    <button
      className="flex flex-1 flex-col text-left gap-1 p-4 bg-bg-base border border-bg-base hover:bg-bg-base-hover hover:border-bg-border-hover focus:bg-bg-base-hover focus:border-bg-border-hover rounded-md cursor-pointer group"
      onClick={() => onClick(type)}
    >
      <div className="flex gap-2 items-center text-label-muted group-hover:text-label-title w-full">
        {typeMap[type].icon}
        <p className="subhead-s text-label-title flex-1">
          {t(typeMap[type].title)}
          {type === 'studio' && (
            <span className="code-s text-label-control rounded bg-[linear-gradient(135deg,#C7363E_0%,#C7369E_100%)] px-1 py-0.5 ml-2">
              New
            </span>
          )}
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
