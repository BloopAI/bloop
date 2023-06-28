import Tippy from '@tippyjs/react';
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
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
import CloudFeaturePopup from '../CloudFeaturePopup';
import BranchItem from './BranchItem';

let eventSource: EventSource;

const BranchSelector = () => {
  const [search, setSearch] = useState('');
  const [isOpen, setOpen] = useState(false);
  const [isPopupOpen, setPopupOpen] = useState(false);
  const [isIndexing, setIndexing] = useState(false);
  const [indexingBranch, setIndexingBranch] = useState('');
  const [percentage, setPercentage] = useState(0);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(contextMenuRef, () => setOpen(false));

  const { apiUrl, isSelfServe } = useContext(DeviceContext);
  const { tab } = useContext(UIContext);
  const { repositories, setRepositories } = useContext(RepositoriesContext);
  const { selectedBranch, setSelectedBranch } = useContext(SearchContext);

  const currentRepo = useMemo(() => {
    return repositories?.find((r) => r.ref === tab.key);
  }, [repositories]);

  const allBranches = useMemo(() => {
    return [...(currentRepo?.branches || [])].reverse();
  }, [currentRepo, tab.key]);

  const branchesToShow = useMemo(() => {
    return allBranches.filter((b) => b.name.includes(search));
  }, [allBranches, search]);

  const indexedBranches = useMemo(() => {
    return currentRepo?.branch_filter?.select || [];
  }, [currentRepo, tab.key]);

  useEffect(() => {
    if (!indexedBranches.includes(selectedBranch || '')) {
      setSelectedBranch(indexedBranches[0] || null);
    }
  }, [indexedBranches]);

  useEffect(() => {
    setIndexing(currentRepo?.sync_status !== SyncStatus.Done);
    eventSource?.close();
    eventSource = new EventSource(
      `${apiUrl.replace('https:', '')}/repos/status`,
    );
    eventSource.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.ref !== tab.key) {
          return;
        }
        if (data.ev?.status_change) {
          if (data.ev.status_change.branch_filter) {
            setIndexingBranch(data.ev.status_change.branch_filter.select[0]);
            setPercentage(1);
          }
          setRepositories((prev: RepoType[] | undefined) => {
            if (!prev) {
              return prev;
            }
            const index = prev.findIndex((r) => r.ref === data.ref);
            const newRepos = [...prev];
            newRepos[index] = {
              ...newRepos[index],
              sync_status: data.ev?.status_change,
              last_index:
                data.ev?.status_change === SyncStatus.Done
                  ? new Date().toISOString()
                  : '',
              branch_filter: {
                select:
                  data.ev.status_change.branch_filter &&
                  data.ev.status_change.status === SyncStatus.Done
                    ? [
                        ...(newRepos[index].branch_filter?.select || []),
                        data.ev.status_change.branch_filter.select[0],
                      ]
                    : newRepos[index].branch_filter?.select || [],
              },
            };
            return newRepos;
          });
        }
        if (data.ev?.index_percent) {
          setPercentage(data.ev?.index_percent || 1);
        }
      } catch {}
    };
    eventSource.onerror = (err) => {
      console.error('EventSource failed:', err);
    };
    return () => {
      eventSource?.close();
    };
  }, [currentRepo?.sync_status, tab.key]);

  useEffect(() => {
    if (!isIndexing) {
      setPercentage(0);
    }
  }, [isIndexing]);

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
          repoRef={tab.key}
          isIndexed={indexedBranches.includes(itemName)}
          isIndexing={indexingBranch === itemName}
          percentage={percentage}
        />
      ));
  }, [
    branchesToShow,
    indexedBranches,
    selectedBranch,
    indexingBranch,
    percentage,
  ]);

  return allBranches.length > 1 ? (
    <div ref={contextMenuRef} className="max-w-full">
      <CloudFeaturePopup
        isOpen={isPopupOpen}
        onClose={() => setPopupOpen(false)}
      />
      <Tippy
        onHide={() => setOpen(false)}
        visible={isOpen}
        placement="bottom-end"
        interactive
        appendTo="parent"
        render={() => (
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
                Switch branch
              </div>
              <div className="border-b border-bg-border">
                <TextInput
                  value={search}
                  name={'search'}
                  onChange={(e) => setSearch(e.target.value)}
                  type="search"
                  placeholder="Search branches..."
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
        )}
      >
        <Button
          variant="secondary"
          size="medium"
          type="button"
          onClick={() => {
            if (isSelfServe) {
              setOpen((prev) => !prev);
            } else {
              setPopupOpen(true);
            }
          }}
          className="ellipsis"
        >
          <TextField
            value={selectedBranch?.replace('origin/', '') || 'All branches'}
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
