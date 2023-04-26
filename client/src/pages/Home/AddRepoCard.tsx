import { ChevronRight, Globe2, HardDrive, LockFilled } from '../../icons';

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
      <div className="w-4 h-4">
        <LockFilled raw />
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
  return (
    <div
      className="flex flex-1 flex-col gap-1 p-4 bg-gray-800 hover:bg-gray-700 rounded-md cursor-pointer group"
      onClick={() => onClick(type)}
    >
      <div className="flex gap-2 items-center text-gray-600 group-hover:text-gray-100">
        {typeMap[type].icon}
        <p className="subhead-s text-gray-200 group-hover:text-gray-100 flex-1">
          {typeMap[type].title}
        </p>
        <ChevronRight className="group-hover:text-primary-300" />
      </div>
      <p className="pl-6 caption text-gray-500 group-hover:text-gray-400">
        {typeMap[type].description}
      </p>
    </div>
  );
};

export default AddRepoCard;
