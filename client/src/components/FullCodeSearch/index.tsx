import React, {
  ChangeEvent,
  Dispatch,
  KeyboardEvent,
  SetStateAction,
  useCallback,
  useState,
} from 'react';
import TextInput from '../TextInput';
import { ChevronDown, ChevronUp } from '../../icons';

type Props = {
  handleSearch: (v: string) => void;
  isSearchActive: boolean;
  resultNum: number;
  currentResult: number;
  setCurrentResult: Dispatch<SetStateAction<number>>;
  onCancel?: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
};

const FullCodeSearch = ({
  handleSearch,
  isSearchActive,
  resultNum,
  onCancel,
  currentResult,
  setCurrentResult,
}: Props) => {
  const [searchValue, setSearchValue] = useState('');

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const searchTerm = e.target.value;
      setSearchValue(searchTerm);
      handleSearch(searchTerm);
    },
    [handleSearch],
  );

  return isSearchActive ? (
    <div
      className="absolute top-0 -right-4 z-50 bg-gray-900 bg-opacity-80"
      style={{
        backdropFilter: 'blur(1px)',
        WebkitBackdropFilter: 'blur(1px)',
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setCurrentResult((prev) => (prev < resultNum ? prev + 1 : 1));
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
      </form>
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

export default FullCodeSearch;
