import React, {
  FormEvent,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useCombobox } from 'downshift';
import throttle from 'lodash.throttle';
import TextInput from '../TextInput';
import { ArrowRevert, Clipboard, TrashCan } from '../../icons';
import { DropdownWithIcon } from '../Dropdown';
import { useArrowKeyNavigation } from '../../hooks/useArrowNavigationHook';
import { SearchContext } from '../../context/searchContext';
import Button from '../Button';
import { copyToClipboard, parseFilters } from '../../utils';
import { MenuListItemType } from '../ContextMenu';
import { saveJsonToStorage, SEARCH_HISTORY_KEY } from '../../services/storage';
import { getAutocomplete } from '../../services/api';
import {
  LangResult,
  ResultItemType,
  SuggestionType,
} from '../../types/results';
import { mapResults } from '../../mappers/results';
import useAppNavigation from '../../hooks/useAppNavigation';
import AutocompleteMenu from './AutocompleteMenu';

const INPUT_POSITION_LEFT = 47;

const getAutocompleteThrottled = throttle(
  async (
    query: string,
    setOptions: (o: SuggestionType[]) => void,
  ): Promise<void> => {
    const newOptions = await getAutocomplete(query);
    setOptions(mapResults(newOptions));
  },
  100,
  { trailing: true, leading: false },
);

function SearchInput() {
  const {
    inputValue,
    setInputValue,
    searchHistory,
    setFilters,
    filters,
    setSearchHistory,
  } = useContext(SearchContext);
  const [options, setOptions] = useState<SuggestionType[]>([]);
  const [left] = useState<number>(INPUT_POSITION_LEFT);
  const inputRef = useRef<HTMLInputElement>(null);
  const { globalRegex, setGlobalRegex } = useContext(SearchContext);
  const { navigateSearch, navigateRepoPath } = useAppNavigation();
  const arrowNavContainerRef = useArrowKeyNavigation({
    selectors: 'input, .arrow-navigate',
    tabSelects: true,
  });
  const {
    isOpen,
    getMenuProps,
    getInputProps,
    getComboboxProps,
    getItemProps,
    closeMenu,
  } = useCombobox({
    inputValue,
    onStateChange: async (state) => {
      if (state.type === useCombobox.stateChangeTypes.ItemClick) {
        if (state.selectedItem?.type === ResultItemType.FLAG) {
          const words = inputValue.split(' ');
          words[words.length - 1] =
            state.selectedItem?.data || words[words.length - 1];
          const newInputValue = words.join(' ') + ':';
          setInputValue(newInputValue);
          if (state.selectedItem?.data) {
            const [filterName, filterValue] =
              state.selectedItem.data.split(':');
            setFilters((prev) => {
              const newFilters = [...prev];
              const sectionIndex = newFilters.findIndex(
                (f) => f.name === filterName,
              );
              if (sectionIndex >= 0) {
                const newItems = [...newFilters[sectionIndex].items];
                const itemIndex = newItems.findIndex(
                  (i) => i.label === filterValue,
                );
                if (itemIndex >= 0) {
                  newItems[itemIndex] = {
                    ...newItems[itemIndex],
                    checked: true,
                  };
                  newFilters[sectionIndex] = {
                    ...newFilters[sectionIndex],
                    items: newItems,
                  };
                }
              }
              return newFilters;
            });
          }
        } else if (state.selectedItem?.type === ResultItemType.LANG) {
          setInputValue(
            (prev) =>
              prev.split(':').slice(0, -1).join(':') +
              ':' +
              (state.selectedItem as LangResult)?.data,
          );
        } else {
          if (
            state.selectedItem?.type === ResultItemType.FILE ||
            state.selectedItem?.type === ResultItemType.CODE
          ) {
            navigateRepoPath(
              state.selectedItem.repoName,
              state.selectedItem.relativePath,
            );
          } else if (state.selectedItem?.type === ResultItemType.REPO) {
            navigateRepoPath(state.selectedItem.repository);
          }
        }
        inputRef.current?.focus();
      } else if (state.type === useCombobox.stateChangeTypes.InputChange) {
        if (state.inputValue === '') {
          setInputValue(state.inputValue);
          setOptions([]);
          return;
        }
        if (!state.inputValue) {
          setFilters([]);
          return;
        }
        getAutocompleteThrottled(state.inputValue, setOptions);
        const parsedFilters = parseFilters(state.inputValue);
        if (Object.entries(parsedFilters).some((filters) => filters.length)) {
          const newFilters = filters.map((filterItem) => ({
            ...filterItem,
            items: filterItem.items.map((item) => ({
              ...item,
              checked: parsedFilters[filterItem.name]?.includes(item.label),
            })),
          }));

          if (JSON.stringify(newFilters) !== JSON.stringify(filters)) {
            setFilters(newFilters);
          }
        }
      }
    },
    items: options,
    itemToString(item) {
      return (
        (item?.type === ResultItemType.FLAG ||
        item?.type === ResultItemType.LANG
          ? item?.data
          : '') || ''
      );
    },
  });

  const onSubmit = useCallback((val: string) => {
    navigateSearch(val);
    closeMenu();
    setSearchHistory((prev) => {
      const newHistory = [val, ...prev].slice(0, 4);
      saveJsonToStorage(SEARCH_HISTORY_KEY, newHistory);
      return newHistory;
    });
  }, []);

  const handleClearHistory = useCallback(() => {
    setSearchHistory([]);
    saveJsonToStorage(SEARCH_HISTORY_KEY, []);
  }, []);

  const historyItems = useMemo(
    () => [
      ...searchHistory.map((s) => ({
        text: s,
        type: MenuListItemType.DEFAULT,
        onClick: () => {
          setInputValue(s);
          onSubmit(s);
        },
      })),
      {
        text: 'Clear search history',
        type: MenuListItemType.DANGER,
        icon: <TrashCan />,
        onClick: handleClearHistory,
      },
    ],
    [searchHistory, onSubmit, handleClearHistory],
  );

  return (
    <div className="relative flex gap-2" ref={arrowNavContainerRef}>
      <Button
        variant="tertiary"
        onlyIcon
        title="Copy search query to clipboard"
        onClick={() => copyToClipboard(inputValue)}
      >
        <Clipboard />
      </Button>
      <div className="w-98">
        <div {...getComboboxProps()}>
          <TextInput
            type="search"
            placeholder="My search"
            regex
            {...getInputProps(
              {
                onChange: (e: FormEvent<HTMLInputElement>) => {
                  // @ts-ignore
                  setInputValue(e.target.value);
                },
              },
              { suppressRefError: true },
            )}
            ref={inputRef}
            onSubmit={() => onSubmit(inputValue)}
            onRegexClick={() => {
              setGlobalRegex(!globalRegex);
            }}
            regexEnabled={globalRegex}
          />
        </div>
      </div>

      <AutocompleteMenu
        getMenuProps={getMenuProps}
        getItemProps={getItemProps}
        left={INPUT_POSITION_LEFT}
        isOpen={isOpen && !!options.length}
        options={options}
      />

      <DropdownWithIcon
        items={historyItems}
        icon={<ArrowRevert />}
        hint="Search history"
      />
    </div>
  );
}

export default SearchInput;
