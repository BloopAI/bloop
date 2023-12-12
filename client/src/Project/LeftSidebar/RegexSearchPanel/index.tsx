import {
  ChangeEvent,
  FormEvent,
  memo,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
// import throttle from 'lodash.throttle';
// import { useCombobox } from 'downshift';
import { CloseSignIcon, HardDriveIcon, RegexSearchIcon } from '../../../icons';
import Button from '../../../components/Button';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
import { search } from '../../../services/api';
import {
  CodeItem,
  DirectoryItem,
  FileItem,
  FileResItem,
  RepoItem,
} from '../../../types/api';
import GitHubIcon from '../../../icons/GitHubIcon';
import { splitPath } from '../../../utils';
import { ProjectContext } from '../../../context/projectContext';
import CodeResult from './Results/CodeResult';
import RepoResult from './Results/RepoResult';
import FileResult from './Results/FileResult';

type Props = {
  projectId?: string;
};

// const getAutocompleteThrottled = throttle(
//   async (
//     query: string,
//     setOptions: (o: SuggestionType[]) => void,
//   ): Promise<void> => {
//     const newOptions = await getAutocomplete(query);
//     setOptions(mapResults(newOptions));
//   },
//   100,
//   { trailing: true, leading: false },
// );

type ResultType = CodeItem | RepoItem | FileResItem | DirectoryItem | FileItem;

const RegexSearchPanel = ({ projectId }: Props) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  // const [options, setOptions] = useState<SuggestionType[]>([]);
  const [results, setResults] = useState<Record<string, ResultType[]>>({});
  const [resultsRaw, setResultsRaw] = useState<ResultType[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setIsRegexSearchEnabled } = useContext(ProjectContext.RegexSearch);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setFocusedIndex(-1);
  }, []);

  const onClear = useCallback(() => {
    setInputValue('');
    if (!inputValue) {
      setIsRegexSearchEnabled(false);
    }
  }, [inputValue]);

  // const {
  //   isOpen,
  //   getMenuProps,
  //   getInputProps,
  //   getItemProps,
  //   closeMenu,
  //   highlightedIndex,
  // } = useCombobox({
  //   inputValue,
  //   onStateChange: async (state) => {
  //     if (
  //       state.type === useCombobox.stateChangeTypes.ItemClick ||
  //       state.type === useCombobox.stateChangeTypes.InputKeyDownEnter
  //     ) {
  //       if (state.selectedItem?.type === ResultItemType.FLAG) {
  //         const words = inputValue.split(' ');
  //         words[words.length - 1] =
  //           state.selectedItem?.data || words[words.length - 1];
  //         const newInputValue = words.join(' ') + ':';
  //         setInputValue(newInputValue);
  //       } else if (state.selectedItem?.type === ResultItemType.LANG) {
  //         setInputValue(
  //           (prev) =>
  //             prev.split(':').slice(0, -1).join(':') +
  //             ':' +
  //             (state.selectedItem as LangResult)?.data,
  //         );
  //       } else {
  //         if (
  //           state.selectedItem?.type === ResultItemType.FILE ||
  //           state.selectedItem?.type === ResultItemType.CODE
  //         ) {
  //           openNewTab({
  //             type: TabTypesEnum.FILE,
  //             branch: null,
  //             repoRef: state.selectedItem.repoRef,
  //             path: state.selectedItem.relativePath,
  //           });
  //         }
  //       }
  //       inputRef.current?.focus();
  //     } else if (state.type === useCombobox.stateChangeTypes.InputChange) {
  //       if (state.inputValue === '') {
  //         setInputValue(state.inputValue);
  //         setOptions([]);
  //         return;
  //       }
  //       if (!state.inputValue) {
  //         return;
  //       }
  //       let autocompleteQuery = state.inputValue;
  //       getAutocompleteThrottled(autocompleteQuery, setOptions);
  //     }
  //   },
  //   items: options,
  //   itemToString(item) {
  //     return (
  //       (item?.type === ResultItemType.FLAG ||
  //       item?.type === ResultItemType.LANG
  //         ? item?.data
  //         : '') || ''
  //     );
  //   },
  // });

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (projectId) {
        const data = await search(projectId, inputValue);
        const newResults: Record<string, ResultType[]> = {};
        data.data.forEach((d) => {
          if (!newResults[d.data.repo_ref]) {
            newResults[d.data.repo_ref] = [d];
          } else {
            newResults[d.data.repo_ref].push(d);
          }
        });
        setResults(newResults);
        setResultsRaw(data.data);
        // closeMenu();
      }
    },
    [inputValue],
  );

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        inputRef.current?.blur();
      } else if (e.key === 'ArrowDown' && resultsRaw.length) {
        e.preventDefault();
        e.stopPropagation();
        setFocusedIndex((prev) =>
          prev < resultsRaw.length - 1 ? prev + 1 : -1,
        );
      } else if (e.key === 'ArrowUp' && resultsRaw.length) {
        e.preventDefault();
        e.stopPropagation();
        setFocusedIndex((prev) =>
          prev > -1 ? prev - 1 : resultsRaw.length - 1,
        );
      }
    },
    [resultsRaw],
  );
  useKeyboardNavigation(handleKeyEvent);

  return (
    <div className="flex flex-col h-full flex-1 overflow-auto">
      <form
        className="flex items-center h-10 flex-shrink-0 px-4 py-1.5 gap-3 border-b border-bg-border text-label-title"
        onSubmit={onSubmit}
      >
        <RegexSearchIcon sizeClassName="w-3.5 h-3.5" />
        <input
          //{...getInputProps({
          //  onChange,
          // })}
          className="bg-transparent flex-1 placeholder:text-label-muted body-mini focus:outline-0 focus:outline-none ellipsis"
          placeholder={t('Files, paths or folders...')}
          value={inputValue}
          onChange={onChange}
          autoFocus
          type="search"
          autoCorrect="off"
          autoComplete="off"
        />
        <Button
          variant="danger"
          size="mini"
          onlyIcon
          title={t('Clear input')}
          type="button"
          onClick={onClear}
        >
          <CloseSignIcon sizeClassName="w-3 h-3" />
        </Button>
      </form>
      {/*<AutocompleteMenu*/}
      {/*  getMenuProps={getMenuProps}*/}
      {/*  getItemProps={getItemProps}*/}
      {/*  isOpen={isOpen && !!options.length}*/}
      {/*  options={options}*/}
      {/*  highlightedIndex={highlightedIndex}*/}
      {/*/>*/}
      {!!Object.keys(results).length && (
        <ul className="flex-1 flex flex-col overflow-auto">
          {Object.keys(results).map((repoRef, repoIndex, array) => (
            <li key={repoRef} className="relative flex flex-col">
              <span className="absolute top-10 bottom-0 left-5 w-px bg-bg-border" />
              <span className="h-10 flex-shrink-0 flex items-center gap-3 px-4 bg-bg-sub body-s-b text-label-title">
                {repoRef.startsWith('github.com/') ? (
                  <GitHubIcon sizeClassName="w-3 h-3" />
                ) : (
                  <HardDriveIcon sizeClassName="w-3 h-3" />
                )}
                {splitPath(repoRef)
                  .slice(repoRef.startsWith('github.com/') ? -2 : -1)
                  .join('/')}
              </span>
              <ul className="flex flex-col">
                {results[repoRef].map((r, i) => (
                  <li key={i} className="flex flex-col">
                    {r.kind === 'snippets' ? (
                      <CodeResult
                        {...r.data}
                        isFirst={i === 0}
                        isFocused={
                          focusedIndex ===
                          i + (array[repoIndex - 1]?.length || 0)
                        }
                      />
                    ) : r.kind === 'repository_result' ? (
                      <RepoResult />
                    ) : r.kind === 'file_result' ? (
                      <FileResult
                        {...r.data}
                        isFirst={i === 0}
                        isFocused={
                          focusedIndex ===
                          i + (array[repoIndex - 1]?.length || 0)
                        }
                      />
                    ) : (
                      r.kind
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default memo(RegexSearchPanel);
