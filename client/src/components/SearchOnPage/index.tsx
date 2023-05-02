import React, {
  ChangeEvent,
  Dispatch,
  SetStateAction,
  useCallback,
} from 'react';
import TextInput from '../TextInput';
import { ChevronDown, ChevronUp } from '../../icons';

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
      className={`z-50 bg-gray-900 bg-opacity-80 ${containerClassName}`}
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
      <div className="flex items-center absolute top-0.5 right-9 caption text-gray-300">
        {resultNum ? (
          <span>
            {currentResult}/{resultNum}
          </span>
        ) : null}
        <button
          className="p-2 hover:text-gray-50 disabled:hover:text-gray-300"
          onClick={() =>
            setCurrentResult((prev) => (prev > 1 ? prev - 1 : resultNum))
          }
          disabled={!searchValue}
        >
          <ChevronUp />
        </button>
        <button
          className="p-2 hover:text-gray-50 disabled:hover:text-gray-300"
          onClick={() =>
            setCurrentResult((prev) => (prev < resultNum ? prev + 1 : 1))
          }
          disabled={!searchValue}
        >
          <ChevronDown />
        </button>
      </div>
    </div>
  ) : null;
};

export default SearchOnPage;
