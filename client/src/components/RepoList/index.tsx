import React, {
  Dispatch,
  Fragment,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { GitHubLogo, Repository } from '../../icons';
import Checkbox from '../Checkbox';
import Button from '../Button';
import SkeletonItem from '../SkeletonItem';
import { RepoUi } from '../../types/general';
import { DeviceContext } from '../../context/deviceContext';
import { getFileManagerName } from '../../utils';

type Props = {
  repos: RepoUi[];
  setRepos: Dispatch<SetStateAction<RepoUi[]>>;
  source: 'local' | 'GitHub';
  activeTab: number;
  removable?: boolean;
  handleRemoveOne?: (repoRef: string) => void;
  filter?: string;
};

const listItemClassName =
  'bg-gray-900 border-b border-l border-r first:border-t first:rounded-t-md last:border-b last:rounded-b-md border-gray-800 pl-3 p-1.5 body-s group h-11';

const RepoList = ({
  repos,
  setRepos,
  source,
  activeTab,
  removable,
  handleRemoveOne,
  filter,
}: Props) => {
  const [filteredRepos, setFilteredRepos] = useState(repos);
  const { openFolderInExplorer, openLink, os } = useContext(DeviceContext);

  const handleSelectAll = useCallback((selected: boolean) => {
    setRepos((prev) => prev.map((r) => ({ ...r, selected })));
  }, []);

  const handleSelectOne = useCallback((selected: boolean, repoRef: string) => {
    setRepos((prev) => {
      const newRepos = JSON.parse(JSON.stringify(prev));
      const i = prev.findIndex((r) => r.ref === repoRef);
      newRepos[i].selected = selected;
      return newRepos;
    });
  }, []);

  useEffect(() => {
    if (filter) {
      setFilteredRepos(repos.filter((r) => r.name.includes(filter)));
    } else {
      setFilteredRepos(repos);
    }
  }, [filter, repos]);

  return (
    <>
      {activeTab === 1 && (
        <div className="bg-gray-900 px-3 border border-b-4 border-transparent">
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
      <div className={`fade-bottom relative`}>
        <ul className="bg-gray-900 shadow-light overflow-y-auto pb-6">
          {repos.length ? (
            !filteredRepos.length ? (
              <div className="flex flex-col gap-2 py-6 text-center">
                <p className="body-s text-gray-300">No results...</p>
                <p className="text-gray-500 caption">
                  Nothing matched your search. Try a different combination!
                </p>
              </div>
            ) : (
              filteredRepos.map((repo, i) => (
                <Fragment key={repo.name + i}>
                  {i === 0 ||
                  (filteredRepos[i - 1] &&
                    filteredRepos[i - 1].folderName !== repo.folderName) ? (
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
                          {source === 'local' ? (
                            <span className="w-4 h-5 flex-shrink-0">
                              <Repository raw />
                            </span>
                          ) : (
                            <GitHubLogo />
                          )}
                          <span className="whitespace-nowrap">
                            {repo.shortName}
                          </span>
                        </div>
                      ) : (
                        <Checkbox
                          checked={repo.selected}
                          label={repo.shortName}
                          onChange={(val) => handleSelectOne(val, repo.ref)}
                        />
                      )}
                      <Button
                        variant="secondary"
                        size="small"
                        className="opacity-0 group-hover:opacity-100"
                        onClick={() => {
                          if (removable && handleRemoveOne) {
                            handleRemoveOne(repo.ref);
                          } else {
                            source === 'local'
                              ? openFolderInExplorer(repo.ref.slice(6))
                              : openLink('https://' + repo.ref);
                          }
                        }}
                      >
                        {removable
                          ? 'Remove'
                          : `View ${
                              source === 'local'
                                ? `in ${getFileManagerName(os.type)}`
                                : 'on GitHub'
                            }
                        `}
                      </Button>
                    </div>
                  </li>
                </Fragment>
              ))
            )
          ) : (
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <li key={i} className={`${listItemClassName} flex items-center`}>
                <span className="h-4 w-full inline-block">
                  <SkeletonItem />
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </>
  );
};

export default RepoList;
