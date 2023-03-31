import { useCallback, useContext, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import isEqual from 'lodash.isequal';
import Button from '../Button';
import {
  ChevronFoldIn,
  ChevronFoldOut,
  DoubleChevronLeft,
  DoubleChevronRight,
} from '../../icons';
import { SearchContext } from '../../context/searchContext';
import {
  FILTER_TEXT_ANIMATION,
  FILTER_PARENT_ANIMATION,
} from '../../consts/animations';
import { saveJsonToStorage, SEARCH_HISTORY_KEY } from '../../services/storage';
import useAppNavigation from '../../hooks/useAppNavigation';
import FilterSection from './FilterSection';

type Props = {
  isOpen: boolean;
  toggleOpen: () => void;
  showHeader?: boolean;
};

const Filters = ({ isOpen, toggleOpen, showHeader = true }: Props) => {
  const {
    filters,
    setFilters,
    inputValue,
    setInputValue,
    setSearchHistory,
    searchType,
  } = useContext(SearchContext);
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [newFilters, setNewFilters] = useState(filters);
  const [hasFiltersChanged, setFiltersChanged] = useState(false);

  useEffect(() => {
    setOpenSections(Object.keys(newFilters));
  }, [newFilters]);
  const allOpen = openSections.length === Object.keys(newFilters).length;
  const { navigateSearch } = useAppNavigation();

  useEffect(() => {
    setNewFilters(filters);
  }, [filters]);

  useEffect(() => {
    setFiltersChanged(!isEqual(newFilters, filters));
  }, [newFilters]);

  const handleSubmit = useCallback(() => {
    const regex = inputValue.includes('open:true')
      ? /((lang):[^\s)]+)|\(((lang):[^\s)]+\sor\s)+(lang):[^\s)]+\)/gim
      : /((repo|lang):[^\s)]+)|\(((repo|lang):[^\s)]+\sor\s)+(repo|lang):[^\s)]+\)/gim;
    const subst = ``;

    let result = inputValue.replace(regex, subst).replace(/ {2,}/g, ' ');

    newFilters.forEach((filter) => {
      if (filter.disabled) {
        return;
      }
      const filterItems = filter.items.filter((item) => item.checked);
      if (filterItems.length) {
        let filterString = `${filter.name}:${filterItems
          .map((item) => item.label)
          .join(` or ${filter.name}:`)}`;
        if (filterItems.length > 1) {
          filterString = `(${filterString})`;
        }
        result = `${result.trim()} ${filterString}`;
      }
    });

    if (result.length) {
      setInputValue(result);
    }

    setFilters(newFilters);
    navigateSearch(result, searchType);
    setSearchHistory((prev) => {
      const newHistory = [
        { searchType, query: result, timestamp: new Date().toISOString() },
        ...prev,
      ].slice(0, 29);
      saveJsonToStorage(SEARCH_HISTORY_KEY, newHistory);
      return newHistory;
    });
  }, [newFilters, searchType]);

  const handleFiltersChange = useCallback(
    (s: number, i: number, b: boolean) => {
      setNewFilters((prev) => {
        const newFilters = [...prev];
        const newItems = newFilters[s].singleSelect
          ? [
              ...newFilters[s].items.map((filterItem) => ({
                ...filterItem,
                checked: false,
              })),
            ]
          : [...newFilters[s].items];

        newItems[i] = { ...newItems[i], checked: b };
        newFilters[s] = { ...newFilters[s], items: newItems };

        return newFilters;
      });
    },
    [],
  );

  const handleFiltersAllSelected = useCallback((s: number, b: boolean) => {
    setNewFilters((prev) => {
      const newFilters = [...prev];
      newFilters[s] = {
        ...newFilters[s],
        items: newFilters[s].items.map((item) => ({
          ...item,
          checked: b,
        })),
      };

      return newFilters;
    });
  }, []);

  const onReset = useCallback(() => {
    setNewFilters([]);
  }, []);

  return (
    <motion.div
      className={`text-gray-300 border-r border-gray-800  flex-shrink-0 select-none overflow-x-hidden relative`}
      animate={{ width: isOpen ? '20.25rem' : '5rem' }}
      transition={FILTER_PARENT_ANIMATION}
    >
      <div
        className={`overflow-y-auto h-full ${hasFiltersChanged ? 'pb-10' : ''}`}
      >
        {showHeader && (
          <div
            className={`px-8 subhead-m py-6 border-b border-gray-800 flex items-center justify-between ${
              isOpen ? 'px-8' : 'px-6'
            }`}
          >
            <span className={isOpen ? '' : 'hidden'}>Filters</span>
            <div className="flex items-center gap-2 caption-strong">
              {isOpen && (
                <Button
                  variant="tertiary"
                  size="small"
                  onlyIcon
                  onClick={() => {
                    setOpenSections(allOpen ? [] : Object.keys(newFilters));
                  }}
                  title={allOpen ? 'Fold everything' : 'Expand everything'}
                >
                  {allOpen ? <ChevronFoldIn /> : <ChevronFoldOut />}
                </Button>
              )}
              <Button
                variant="secondary"
                size="small"
                onClick={onReset}
                className={isOpen ? '' : 'hidden'}
              >
                Reset filters
              </Button>
              <Button
                variant="tertiary"
                size="small"
                onlyIcon
                onClick={toggleOpen}
                title={isOpen ? 'Hide filters' : 'Show filters'}
              >
                {isOpen ? <DoubleChevronLeft /> : <DoubleChevronRight />}
              </Button>
            </div>
          </div>
        )}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              className={`w-full`}
              animate={{ visibility: 'visible' }}
              exit={{ visibility: 'hidden' }}
              transition={FILTER_TEXT_ANIMATION}
            >
              {newFilters.map((s, index) => (
                <FilterSection
                  key={s.name}
                  items={s.items}
                  type={s.type}
                  onChange={(i, b) => handleFiltersChange(index, i, b)}
                  name={s.name}
                  title={s.title}
                  singleSelect={s.singleSelect}
                  open={openSections.includes(index.toString())}
                  onToggle={() => {
                    const newOpenSection = openSections.includes(
                      index.toString(),
                    )
                      ? openSections.filter((s) => s !== index.toString())
                      : openSections.concat(index.toString());
                    setOpenSections(newOpenSection);
                  }}
                  onSelectAll={(b) => handleFiltersAllSelected(index, b)}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {hasFiltersChanged && (
          <motion.div
            className={`absolute bottom-4 left-8 flex flex-col right-8`}
            initial={{ height: 0 }}
            exit={{ height: 0 }}
            animate={{ height: 46 }}
          >
            <Button onClick={handleSubmit} size="large">
              Apply filters
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Filters;
