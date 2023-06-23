import Tippy from '@tippyjs/react';
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import TextField from '../TextField';
import { ChevronDownFilled, ChevronUpFilled } from '../../icons';
import Button from '../Button';
import { useOnClickOutside } from '../../hooks/useOnClickOutsideHook';
import { sizesMap } from '../ContextMenu';
import { SearchContext } from '../../context/searchContext';
import { RepositoriesContext } from '../../context/repositoriesContext';
import { UIContext } from '../../context/uiContext';
import TextInput from '../TextInput';
import { RepoType, SyncStatus } from '../../types/general';
import { DeviceContext } from '../../context/deviceContext';
import BarLoader from '../Loaders/BarLoader';
import BranchItem from './BranchItem';

let eventSource: EventSource;

const BranchSelector = () => {
  const [search, setSearch] = useState('');
  const [isOpen, setOpen] = useState(false);
  const [isIndexing, setIndexing] = useState(false);
  const [percentage, setPercentage] = useState(0);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(contextMenuRef, () => setOpen(false));

  const { apiUrl } = useContext(DeviceContext);
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
    setIndexing(currentRepo?.sync_status !== SyncStatus.Done);
    if (currentRepo?.sync_status !== SyncStatus.Done) {
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
    }
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
        />
      ));
  }, [branchesToShow, indexedBranches, selectedBranch]);

  return allBranches.length > 1 ? (
    <div ref={contextMenuRef} className="max-w-full">
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
            {isIndexing ? (
              <div className="bg-bg-shade text-label-title caption-strong px-3 py-2.5 flex flex-col gap-2">
                <p className="body-s text-label-title">Indexing branch...</p>
                <BarLoader percentage={percentage} />
                <p className="caption text-label-muted">
                  {percentage}% complete
                </p>
              </div>
            ) : (
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
                    {!search && (
                      <BranchItem
                        key="all"
                        name="All branches"
                        selectedBranch={selectedBranch || 'All branches'}
                        setSelectedBranch={() => setSelectedBranch(null)}
                        setOpen={setOpen}
                        repoRef={tab.key}
                        isIndexed={true}
                      />
                    )}
                    {items}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      >
        <Button
          variant="secondary"
          size="medium"
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="ellipsis"
        >
          <TextField
            value={selectedBranch?.replace('origin/', '') || 'All branches'}
            className="ellipsis"
          />
          <span>{isOpen ? <ChevronUpFilled /> : <ChevronDownFilled />}</span>
        </Button>
      </Tippy>
    </div>
  ) : null;
};

export default BranchSelector;
