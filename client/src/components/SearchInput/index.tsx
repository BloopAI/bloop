import React, {
  ChangeEvent,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { useCombobox } from 'downshift';
import throttle from 'lodash.throttle';
import { useTranslation } from 'react-i18next';
import { useArrowKeyNavigation } from '../../hooks/useArrowNavigationHook';
import { SearchContext } from '../../context/searchContext';
import { parseFilters } from '../../utils';
import { saveJsonToStorage, SEARCH_HISTORY_KEY } from '../../services/storage';
import { getAutocomplete } from '../../services/api';
import {
  LangResult,
  ResultItemType,
  SuggestionType,
} from '../../types/results';
import { mapResults } from '../../mappers/results';
import useAppNavigation from '../../hooks/useAppNavigation';
import { SearchType } from '../../types/general';
import useKeyboardNavigation from '../../hooks/useKeyboardNavigation';
import { UIContext } from '../../context/uiContext';
import AutocompleteMenu from './AutocompleteMenu';
import SearchTextInput from './SearchTextInput';

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
  const { t } = useTranslation();
  const {
    inputValue,
    setInputValue,
    setFilters,
    filters,
    setSearchHistory,
    globalRegex,
    setGlobalRegex,
    selectedBranch,
  } = useContext(SearchContext);
  const { tab } = useContext(UIContext);
  const [options, setOptions] = useState<SuggestionType[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { navigateSearch, navigateRepoPath } = useAppNavigation();
  const arrowNavContainerRef = useArrowKeyNavigation({
    selectors: 'input, .arrow-navigate',
    tabSelects: true,
  });

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'l' && (e.metaKey || e.ctrlKey)) {
        e.stopPropagation();
        e.preventDefault();
        inputRef.current?.focus();
      }
    },
    [inputValue],
  );
  useKeyboardNavigation(handleKeyEvent);

  const { isOpen, getMenuProps, getInputProps, getItemProps, closeMenu } =
    useCombobox({
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
          let autocompleteQuery = state.inputValue;
          if (selectedBranch) {
            autocompleteQuery += ` branch:${selectedBranch}`;
          }
          if (!state.inputValue.includes(`repo:${tab.name}`)) {
            autocompleteQuery += ` repo:${tab.name}`;
          }
          getAutocompleteThrottled(autocompleteQuery, setOptions);
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
          // const input = inputRef.current;
          // if (input) {
          //   if (input.getBoundingClientRect().left) {
          //     setLeft(input.getBoundingClientRect().left - 272);
          //   }
          // }
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

  const onSubmit = useCallback(
    (val: string) => {
      if (!val.trim()) {
        return;
      }
      if (!val.includes(' branch:') && selectedBranch) {
        val += ` branch:${selectedBranch}`;
      }
      navigateSearch(val);
      closeMenu();
      setSearchHistory((prev) => {
        const newHistory = [
          {
            query: val,
            searchType: SearchType.REGEX,
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 29);
        saveJsonToStorage(SEARCH_HISTORY_KEY, newHistory);
        return newHistory;
      });
    },
    [tab.name, selectedBranch],
  );

  return (
    <div
      className="relative flex gap-2 flex-1 justify-center"
      ref={arrowNavContainerRef}
    >
      <div className="flex-1 max-w-3xl">
        <SearchTextInput
          type="search"
          placeholder={t('Regex search...')}
          regex
          {...getInputProps(
            {
              onChange: (e: ChangeEvent<HTMLInputElement>) => {
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

      <AutocompleteMenu
        getMenuProps={getMenuProps}
        getItemProps={getItemProps}
        left={INPUT_POSITION_LEFT}
        isOpen={isOpen && !!options.length}
        options={options}
      />
    </div>
  );
}

export default SearchInput;
