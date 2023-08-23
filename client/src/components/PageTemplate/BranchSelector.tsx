import Tippy from '@tippyjs/react';
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import TextField from '../TextField';
import { Branch, ChevronDownFilled, ChevronUpFilled } from '../../icons';
import Button from '../Button';
import { useOnClickOutside } from '../../hooks/useOnClickOutsideHook';
import { sizesMap } from '../ContextMenu';
import { SearchContext } from '../../context/searchContext';
import { RepositoriesContext } from '../../context/repositoriesContext';
import { UIContext } from '../../context/uiContext';
import TextInput from '../TextInput';
import { RepoType, SyncStatus } from '../../types/general';
import { DeviceContext } from '../../context/deviceContext';
import BranchItem from './BranchItem';

let eventSource: EventSource;

const BranchSelector = () => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [isOpen, setOpen] = useState(false);
  const [indexing, setIndexing] = useState({ branch: '', percentage: 0 });
  const [branchesToSync, setBranchesToSync] = useState<string[]>([]);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(contextMenuRef, () => setOpen(false));

  const { apiUrl, isSelfServe } = useContext(DeviceContext);
  const { tab } = useContext(UIContext.Tab);
  const { repositories, setRepositories } = useContext(RepositoriesContext);
  const { selectedBranch, setSelectedBranch } = useContext(
    SearchContext.SelectedBranch,
  );
  const { setCloudFeaturePopupOpen } = useContext(UIContext.CloudFeaturePopup);

  const currentRepo = useMemo(() => {
    return repositories?.find((r) => r.ref === tab.repoRef);
  }, [repositories, tab.repoRef]);

  const allBranches = useMemo(() => {
    return [...(currentRepo?.branches || [])].reverse();
  }, [currentRepo, tab.repoRef]);

  const indexedBranches = useMemo(() => {
    return currentRepo?.branch_filter?.select || [];
  }, [currentRepo, tab.repoRef]);

  const branchesToShow = useMemo(() => {
    return indexedBranches
      .map((b) => ({ name: b }))
      .concat(allBranches.filter((b) => !indexedBranches.includes(b.name)))
      .filter((b) => b.name.includes(search));
  }, [allBranches, search, indexedBranches]);

  useEffect(() => {
    if (!indexedBranches.includes(selectedBranch || '')) {
      setSelectedBranch(indexedBranches[0] || null);
    }
  }, [indexedBranches, selectedBranch]);

  useEffect(() => {
    eventSource?.close();
    eventSource = new EventSource(
      `${apiUrl.replace('https:', '')}/repos/status`,
    );
    eventSource.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.ref !== tab.repoRef) {
          return;
        }
        if (data.ev?.status_change) {
          if (data.b && data.ev.status_change.status === 'indexing') {
            setIndexing({
              branch: data.b.select[0],
              percentage: 1,
            });
          }
          setRepositories((prev: RepoType[] | undefined) => {
            if (!prev) {
              return prev;
            }
            const index = prev.findIndex((r) => r.ref === data.ref);
            const newRepos = [...prev];
            newRepos[index] = {
              ...newRepos[index],
              sync_status: data.ev?.status_change.status,
              last_index:
                data.ev?.status_change === SyncStatus.Done
                  ? new Date().toISOString()
                  : '',
              branch_filter: {
                select:
                  data.b && data.ev.status_change.status === SyncStatus.Done
                    ? Array.from(
                        new Set([
                          ...(newRepos[index].branch_filter?.select || []),
                          data.b.select[0],
                        ]),
                      )
                    : newRepos[index].branch_filter?.select || [],
              },
            };
            return newRepos;
          });
        }
        if (data.ev?.index_percent) {
          setIndexing(() => ({
            branch: data.b?.select[0],
            percentage: data.ev?.index_percent || 1,
          }));
        }
      } catch {}
    };
    eventSource.onerror = (err) => {
      console.error('EventSource failed:', err);
    };
    return () => {
      eventSource?.close();
    };
  }, [tab.repoRef]);

  const items = useMemo(() => {
    return branchesToShow
      .map((b) => b.name)
      .map((itemName) => (
        <BranchItem
          key={itemName}
          name={itemName}
          selectedBranch={selectedBranch}
          setSelectedBranch={setSelectedBranch}
          setOpen={setOpen}
          repoRef={tab.repoRef}
          isIndexed={indexedBranches.includes(itemName)}
          isIndexing={indexing.branch === itemName}
          percentage={indexing.percentage}
          isWaitingSync={branchesToSync.includes(itemName)}
          onSyncClicked={(b) => setBranchesToSync((prev) => [...prev, b])}
        />
      ));
  }, [branchesToShow, indexedBranches, selectedBranch, indexing]);

  return allBranches.length > 1 ? (
    <div ref={contextMenuRef} className="max-w-full">
      <Tippy
        onHide={() => setOpen(false)}
        visible={isOpen}
        placement="bottom-end"
        interactive
        appendTo="parent"
        render={() =>
          !isOpen ? null : (
            <div
              id="dropdown"
              className={`${isOpen ? '' : 'scale-0 opacity-0'}
      transition-all duration-300 ease-in-slow max-h-96 overflow-auto
       rounded-md bg-bg-base border border-bg-border shadow-high ${
         sizesMap.medium
       } flex flex-col max-w-full`}
            >
              <>
                <div className="bg-bg-shade text-label-title caption-strong px-3 py-2.5 block">
                  <Trans>Switch branch</Trans>
                </div>
                <div className="border-b border-bg-border">
                  <TextInput
                    value={search}
                    name={'search'}
                    onChange={(e) => setSearch(e.target.value)}
                    type="search"
                    placeholder={t('Search branches...')}
                    noBorder
                  />
                </div>
                {branchesToShow.length < 1 ? (
                  <div className="p-1.5 body-s text-label-base text-center">
                    No branches found
                  </div>
                ) : (
                  <div className="flex flex-col p-1.5 gap-1 overflow-y-auto">
                    {items}
                  </div>
                )}
              </>
            </div>
          )
        }
      >
        <Button
          variant="secondary"
          size="medium"
          type="button"
          onClick={() => {
            if (isSelfServe) {
              setOpen((prev) => !prev);
            } else {
              setCloudFeaturePopupOpen(true);
            }
          }}
          className="ellipsis"
        >
          <TextField
            value={selectedBranch?.replace('origin/', '') || t('All branches')}
            icon={<Branch />}
            className="ellipsis"
          />
          <span>{isOpen ? <ChevronUpFilled /> : <ChevronDownFilled />}</span>
        </Button>
      </Tippy>
    </div>
  ) : null;
};

export default BranchSelector;
