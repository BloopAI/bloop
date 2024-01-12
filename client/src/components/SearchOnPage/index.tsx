import React, {
  ChangeEvent,
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
} from 'react';
import TextInput from '../TextInput';
import { ChevronDownIcon, ChevronUpIcon } from '../../icons';

type Props = {
  handleSearch: (v: string) => void;
  isSearchActive: boolean;
  resultNum: number;
  currentResult: number;
  setCurrentResult: Dispatch<SetStateAction<number>>;
  onCancel?: () => void;
  searchValue: string;
  containerClassName: string;
};

const SearchOnPage = ({
  handleSearch,
  isSearchActive,
  resultNum,
  onCancel,
  currentResult,
  setCurrentResult,
  searchValue,
  containerClassName,
}: Props) => {
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      handleSearch(e.target.value);
    },
    [handleSearch],
  );

  return isSearchActive ? (
    <div
      className={`z-50 bg-bg-sub/80 ${containerClassName}`}
      style={{
        backdropFilter: 'blur(1px)',
        WebkitBackdropFilter: 'blur(1px)',
      }}
    >
      <TextInput
        type="search"
        id="app-search"
        name="app-search"
        autoFocus
        value={searchValue}
        onChange={handleChange}
        forceClear
        inputClassName="pr-24"
        onEscape={onCancel}
      />
      <div className="flex items-center absolute top-0 right-9 caption text-label-base">
        {resultNum ? (
          <span>
            {currentResult}/{resultNum}
          </span>
        ) : null}
        <button
          className="p-2 hover:text-label-title disabled:hover:text-label-base flex items-center "
          onClick={() =>
            setCurrentResult((prev) => (prev > 1 ? prev - 1 : resultNum))
          }
          disabled={!searchValue}
        >
          <ChevronUpIcon sizeClassName="w-3.5 h-3.5" />
        </button>
        <button
          className="p-2 hover:text-label-title disabled:hover:text-label-base flex items-center "
          onClick={() =>
            setCurrentResult((prev) => (prev < resultNum ? prev + 1 : 1))
          }
          disabled={!searchValue}
        >
          <ChevronDownIcon sizeClassName="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  ) : null;
};

export default memo(SearchOnPage);
