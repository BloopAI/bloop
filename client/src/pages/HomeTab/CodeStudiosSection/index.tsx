import React, { memo } from 'react';
import { Trans } from 'react-i18next';
import { CodeStudioShortType, RepoType } from '../../../types/general';
import NoRepos from '../ReposSection/RepoCard/NoRepos';
import CodeStudioCard from './CodeStudioCard';

type Props = {
  codeStudios: CodeStudioShortType[];
  shouldShowFull?: boolean;
  isFiltered?: boolean;
  showAll: () => void;
  refetchStudios: () => void;
  showCodeStudioIndexingPopup: () => void;
  handleRename: (studio: CodeStudioShortType) => void;
  repositories?: RepoType[];
};

const LIMIT = 7;

const CodeStudiosSection = ({
  codeStudios,
  shouldShowFull,
  isFiltered,
  showAll,
  refetchStudios,
  handleRename,
  repositories,
  showCodeStudioIndexingPopup,
}: Props) => {
  return (
    <div className="p-8 overflow-x-auto relative">
      {!!codeStudios.length && (
        <h4 className="h4 text-label-title mb-3">
          <Trans>All studio projects</Trans>
        </h4>
      )}
      <div className="flex flex-wrap gap-3.5 w-full relative items-start">
        {(shouldShowFull ? codeStudios : codeStudios.slice(0, LIMIT)).map(
          (cs) => (
            <CodeStudioCard
              key={cs.id}
              {...cs}
              refetchStudios={refetchStudios}
              handleRename={() => handleRename(cs)}
              showCodeStudioIndexingPopup={showCodeStudioIndexingPopup}
              isIndexing={
                !!repositories?.find(
                  (r) =>
                    cs.repos.includes(
                      r.ref.replace(/^(local\/)|(github\.com\/)/, ''),
                    ) &&
                    (!r.last_index || r.last_index === '1970-01-01T00:00:00Z'),
                )
              }
            />
          ),
        )}
        {codeStudios.length > LIMIT && !shouldShowFull && (
          <button
            onClick={showAll}
            className="border border-bg-border rounded-md hover:border-bg-border-hover focus:border-bg-border-hover
            p-4 w-67 h-36 group flex-shrink-0 flex flex-col justify-between cursor-pointer transition-all duration-150 select-none"
          >
            <p className="body-s text-label-link">
              <Trans>View all</Trans>
            </p>
            <p className="caption-strong text-label-base">
              <Trans count={codeStudios.length - LIMIT}>+ # more</Trans>
            </p>
          </button>
        )}
      </div>
      {!codeStudios.length && shouldShowFull ? (
        !isFiltered ? (
          <div className="flex w-full flex-col items-center justify-center gap-4 px-4 py-11 bg-bg-sub border border-bg-border rounded-md">
            <NoRepos />
            <div className="flex flex-col gap-3 items-center">
              <p className="subhead-m text-label-title">
                <Trans>No Studio projects</Trans>
              </p>
              <p className="body-s text-label-muted">
                <Trans>
                  As soon as you create a new Studio project it will appear
                  here.
                </Trans>
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 mx-auto text-center select-none">
            <p className="body-s text-label-title">
              <Trans>No results...</Trans>
            </p>
            <p className="caption text-label-muted">
              <Trans>
                Nothing matched your search. Try a different combination!
              </Trans>
            </p>
          </div>
        )
      ) : null}
    </div>
  );
};

export default memo(CodeStudiosSection);
