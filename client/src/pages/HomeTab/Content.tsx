import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import LiteLoader from '../../components/Loaders/LiteLoader';
import Button from '../../components/Button';
import { CloseSign, Info, WarningSign } from '../../icons';
import { RepositoriesContext } from '../../context/repositoriesContext';
import { CodeStudioShortType, RepoType, SyncStatus } from '../../types/general';
import { DeviceContext } from '../../context/deviceContext';
import PageTemplate from '../../components/PageTemplate';
import { TabsContext } from '../../context/tabsContext';
import {
  getCodeStudios,
  patchCodeStudio,
  postCodeStudio,
} from '../../services/api';
import { UIContext } from '../../context/uiContext';
import { PersonalQuotaContext } from '../../context/personalQuotaContext';
import AddRepos from './AddRepos';
import ReposSection from './ReposSection';
import AddRepoCard from './AddRepoCard';
import CodeStudiosSection from './CodeStudiosSection';

const filterRepositories = (repos?: RepoType[], search?: string) => {
  const indexed =
    repos?.filter(
      (r) =>
        r.sync_status !== SyncStatus.Uninitialized &&
        r.sync_status !== SyncStatus.Removed,
    ) || [];
  if (search) {
    return indexed.filter((r) =>
      r.name.toLowerCase().includes(search.toLowerCase()),
    );
  }
  return indexed;
};

const HomePage = ({ randomKey }: { randomKey?: any }) => {
  const { t } = useTranslation();
  const { fetchRepos, repositories } = useContext(RepositoriesContext);
  const { isPastDue } = useContext(PersonalQuotaContext.Values);
  const { isSelfServe } = useContext(DeviceContext);
  const { handleAddStudioTab } = useContext(TabsContext);
  const { search, filterType, setFilterType } = useContext(
    UIContext.HomeScreen,
  );
  const [popupOpen, setPopupOpen] = useState<false | 'repo' | 'studio'>(false);
  const [addReposOpen, setAddReposOpen] = useState<
    null | 'local' | 'github' | 'public' | 'studio'
  >(null);
  const [reposToShow, setReposToShow] = useState<RepoType[]>(
    filterRepositories(repositories),
  );
  const [codeStudios, setCodeStudios] = useState<CodeStudioShortType[]>([]);
  const [codeStudiosToShow, setCodeStudiosToShow] = useState<
    CodeStudioShortType[]
  >([]);
  const [studioToEdit, setStudioToEdit] = useState<null | CodeStudioShortType>(
    null,
  );

  const refreshCodeStudios = useCallback(() => {
    getCodeStudios().then((cs: CodeStudioShortType[]) => {
      setCodeStudios(
        cs.sort((a, b) => (a.modified_at > b.modified_at ? -1 : 1)),
      );
    });
  }, []);

  useEffect(() => {
    setCodeStudiosToShow(
      codeStudios.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()),
      ),
    );
  }, [codeStudios, search]);

  useEffect(() => {
    refreshCodeStudios();
  }, [randomKey]);

  useEffect(() => {
    if (repositories) {
      setReposToShow(filterRepositories(repositories, search));
    }
  }, [repositories, search]);

  // const onAddClick = useCallback(
  //   (type: 'local' | 'github' | 'public' | 'studio') => {
  //     if (type === 'studio') {
  //       handleAddStudioTab();
  //     } else {
  //       setAddReposOpen(type);
  //     }
  //   },
  //   [],
  // );

  const handleRename = useCallback((studio: CodeStudioShortType) => {
    setStudioToEdit(studio);
    setAddReposOpen('studio');
  }, []);

  const handleNewStudio = useCallback(() => {
    postCodeStudio().then((id) => {
      handleAddStudioTab('New Studio', id);
      refreshCodeStudios();
    });
  }, []);

  return (
    <PageTemplate renderPage="home">
      <div className="flex flex-col w-full">
        {isPastDue && (
          <div className="bg-warning-300/12 py-2 px-8 flex items-center justify-center gap-2 text-warning-300 caption">
            <WarningSign raw sizeClassName="w-4.5 h-4.5" />
            <Trans>
              Your subscription has expired. Please update your payment details
              to avoid being unsubscribed.
            </Trans>
          </div>
        )}
        <div className="w-full flex flex-col mx-auto max-w-6.5xl overflow-auto">
          <div className="p-8 pb-0">
            <h4 className="mb-3">
              <Trans>Add</Trans>
            </h4>
            <div className="flex gap-3.5 pb-2">
              <AddRepoCard type="github" onClick={setAddReposOpen} />
              <AddRepoCard type="public" onClick={setAddReposOpen} />
              {!isSelfServe && (
                <AddRepoCard type="local" onClick={setAddReposOpen} />
              )}
              <AddRepoCard type="studio" onClick={handleNewStudio} />
            </div>
          </div>
          <div className="overflow-auto">
            {(filterType === 'all' || filterType === 'repos') && (
              <ReposSection
                reposToShow={reposToShow}
                setReposToShow={setReposToShow}
                repositories={repositories}
                shouldShowFull={filterType === 'repos'}
                isFiltered={!!search}
                showAll={() => setFilterType('repos')}
              />
            )}
            {(filterType === 'all' || filterType === 'studios') && (
              <CodeStudiosSection
                codeStudios={codeStudiosToShow}
                shouldShowFull={filterType === 'studios'}
                isFiltered={!!search}
                showAll={() => setFilterType('studios')}
                refetchStudios={refreshCodeStudios}
                handleRename={handleRename}
                handleNewStudio={handleNewStudio}
              />
            )}
            {!!search &&
              ((filterType === 'all' &&
                !reposToShow.length &&
                !codeStudiosToShow.length) ||
                (filterType === 'repos' && !reposToShow.length) ||
                (filterType === 'studios' && !codeStudiosToShow.length)) && (
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
              )}
          </div>
          <AddRepos
            addRepos={addReposOpen}
            onClose={(isSubmitted, name) => {
              if (isSubmitted && name) {
                if (studioToEdit) {
                  setStudioToEdit(null);
                  patchCodeStudio(studioToEdit.id, { name }).then(
                    refreshCodeStudios,
                  );
                }
              } else if (isSubmitted) {
                fetchRepos();
                setTimeout(() => fetchRepos(), 1000);
                setPopupOpen('repo');
                setTimeout(() => setPopupOpen(false), 3000);
              }
              setStudioToEdit(null);
              setAddReposOpen(null);
            }}
            initialValue={studioToEdit?.name}
          />
          {!!popupOpen && (
            <div
              className={`fixed w-85 p-3 flex gap-3 bg-bg-shade border border-bg-border rounded-lg shadow-high left-8 bottom-24 z-40 text-bg-main`}
            >
              {popupOpen === 'repo' ? (
                <LiteLoader />
              ) : (
                <Info className="text-bg-danger" />
              )}
              <div className="flex flex-col gap-1">
                <p className="body-s text-label-title">
                  {popupOpen === 'repo' ? (
                    <Trans>Syncing repository</Trans>
                  ) : (
                    <Trans>Can’t open studio project</Trans>
                  )}
                </p>
                <p className="caption text-label-base">
                  {popupOpen === 'repo' ? (
                    <Trans>
                      We are syncing your repository to bloop. This might take a
                      couple of minutes
                    </Trans>
                  ) : (
                    <Trans>
                      One or more repositories used in this studio project is
                      being indexed. Try again when this process in complete.
                    </Trans>
                  )}
                </p>
              </div>
              <Button
                variant="tertiary"
                size="tiny"
                onlyIcon
                title={t('Close')}
                onClick={() => setPopupOpen(false)}
              >
                <CloseSign />
              </Button>
            </div>
          )}
        </div>
      </div>
    </PageTemplate>
  );
};

export default memo(HomePage);
