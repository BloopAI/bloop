import Tippy from '@tippyjs/react';
import React, { useContext, useMemo, useRef, useState } from 'react';
import TextField from '../TextField';
import { ChevronDownFilled, ChevronUpFilled } from '../../icons';
import Button from '../Button';
import { useOnClickOutside } from '../../hooks/useOnClickOutsideHook';
import { sizesMap } from '../ContextMenu';
import { SearchContext } from '../../context/searchContext';
import { RepositoriesContext } from '../../context/repositoriesContext';
import { UIContext } from '../../context/uiContext';
import TextInput from '../TextInput';
import BranchItem from './BranchItem';

const BranchSelector = () => {
  const [search, setSearch] = useState('');
  const [isOpen, setOpen] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(contextMenuRef, () => setOpen(false));

  const { tab } = useContext(UIContext);
  const { repositories, fetchRepos } = useContext(RepositoriesContext);
  const { selectedBranch, setSelectedBranch } = useContext(SearchContext);

  const allBranches = useMemo(() => {
    return [
      ...(repositories?.find((r) => r.ref === tab.key)?.branches || []),
    ].reverse();
  }, [repositories, tab.key]);

  const branchesToShow = useMemo(() => {
    return allBranches.filter((b) => b.name.includes(search));
  }, [allBranches, search]);

  const indexedBranches = useMemo(() => {
    return (
      repositories?.find((r) => r.ref === tab.key)?.branch_filter?.select || []
    );
  }, [repositories, tab.key]);

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
          fetchRepos={fetchRepos}
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
            <div className="bg-bg-shade text-label-title caption-strong px-3 py-2.5 block ">
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
                    fetchRepos={fetchRepos}
                  />
                )}
                {items}
              </div>
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
            value={selectedBranch || 'All branches'}
            className="ellipsis"
          />
          <span>{isOpen ? <ChevronUpFilled /> : <ChevronDownFilled />}</span>
        </Button>
      </Tippy>
    </div>
  ) : null;
};

export default BranchSelector;
