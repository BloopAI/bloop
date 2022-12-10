import React, {
  Dispatch,
  Fragment,
  SetStateAction,
  useCallback,
  useContext,
} from 'react';
import { Repository } from '../../icons';
import Checkbox from '../Checkbox';
import Button from '../Button';
import SkeletonItem from '../SkeletonItem';
import { RepoType } from '../../types/general';
import { DeviceContext } from '../../context/deviceContext';

type RepoSelectType = RepoType & {
  selected: boolean;
  shortName: string;
  folderName: string;
};

type Props = {
  repos: RepoSelectType[];
  setRepos: Dispatch<SetStateAction<RepoSelectType[]>>;
  source: 'local' | 'GitHub';
  activeTab: number;
};

const listItemClassName =
  'bg-gray-900 border-b border-l border-r first:border-t first:rounded-t-md last:border-b last:rounded-b-md border-gray-800 pl-3 p-1.5 body-s group h-11';

const RepoList = ({ repos, setRepos, source, activeTab }: Props) => {
  const { openFolderInExplorer, openLink } = useContext(DeviceContext);

  const handleSelectAll = useCallback((selected: boolean) => {
    setRepos((prev) => prev.map((r) => ({ ...r, selected })));
  }, []);

  const handleSelectOne = useCallback((selected: boolean, i: number) => {
    setRepos((prev) => {
      const newRepos = JSON.parse(JSON.stringify(prev));
      newRepos[i].selected = selected;
      return newRepos;
    });
  }, []);

  return (
    <div className={`fade-bottom relative mt-3 overflow-auto`}>
      {activeTab === 1 && (
        <div className="bg-gray-900 p-3 h-11 border border-b-4 border-transparent">
          <Checkbox
            checked={!!repos.length && repos.every((r) => r.selected)}
            intermediary={
              repos.some((r) => r.selected) && repos.some((r) => !r.selected)
            }
            label="Select all"
            onChange={handleSelectAll}
            disabled={!repos.length}
          />
        </div>
      )}
      <ul className="bg-gray-900 shadow-light overflow-y-auto pb-6">
        {repos.length
          ? repos.map((repo, i) => (
              <Fragment key={repo.name + i}>
                {i === 0 ||
                (repos[i - 1] &&
                  repos[i - 1].folderName !== repo.folderName) ? (
                  <span
                    className={`bg-gray-800 text-sm w-full py-1 px-4 block ${
                      i === 0 ? 'rounded-t-md' : ''
                    }`}
                  >
                    {repo.folderName}
                  </span>
                ) : (
                  ''
                )}
                <li className={listItemClassName} title={repo.name}>
                  <div className="flex items-center justify-between w-full gap-2">
                    {activeTab === 0 ? (
                      <div className="py-1.5 flex items-center gap-2 overflow-hidden">
                        <span className="w-4 h-5 flex-shrink-0">
                          <Repository raw />
                        </span>
                        <span className="whitespace-nowrap">
                          {repo.shortName}
                        </span>
                      </div>
                    ) : (
                      <Checkbox
                        checked={repo.selected}
                        label={repo.shortName}
                        onChange={(val) => handleSelectOne(val, i)}
                      />
                    )}
                    <Button
                      variant="secondary"
                      size="small"
                      className="opacity-0 group-hover:opacity-100"
                      onClick={() =>
                        source === 'local'
                          ? openFolderInExplorer(repo.ref.slice(6))
                          : openLink('https://github.com/' + repo.ref)
                      }
                    >
                      View {source === 'local' ? 'in Finder' : 'on GitHub'}
                    </Button>
                  </div>
                </li>
              </Fragment>
            ))
          : [1, 2, 3, 4, 5].map((i) => (
              <li key={i} className={`${listItemClassName} flex items-center`}>
                <span className="h-4 w-full inline-block">
                  <SkeletonItem />
                </span>
              </li>
            ))}
      </ul>
    </div>
  );
};

export default RepoList;
