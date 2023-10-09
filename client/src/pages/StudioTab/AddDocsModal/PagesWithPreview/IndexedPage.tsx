import { memo, useCallback, useEffect, useRef } from 'react';
import KeyboardChip from '../../KeyboardChip';

type Props = {
  relative_url: string;
  i: number;
  doc_title: string;
  setHighlightedIndex: (i: number) => void;
  handleSelectPage: (url: string, title: string) => void;
  isFocused: boolean;
};

const IndexedPage = ({
  relative_url,
  i,
  doc_title,
  setHighlightedIndex,
  handleSelectPage,
  isFocused,
}: Props) => {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isFocused) {
      ref.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [isFocused]);

  const handleMouseOver = useCallback(() => {
    setHighlightedIndex(i);
  }, []);

  const handleClick = useCallback(() => {
    handleSelectPage(relative_url, doc_title);
  }, []);
  return (
    <button
      ref={ref}
      key={relative_url}
      type="button"
      onMouseOver={handleMouseOver}
      onFocus={handleMouseOver}
      onClick={handleClick}
      className={`relative h-9 px-3 group rounded-6 hover:bg-bg-base-hover focus:bg-bg-base-hover ${
        isFocused ? 'bg-bg-base-hover' : 'bg-bg-shade'
      } focus:outline-0 focus:outline-none w-full cursor-pointer body-s ellipsis flex-shrink-0`}
    >
      <div
        className={`body-s group-hover:text-label-title group-focus:text-label-title ${
          isFocused ? 'text-label-title' : 'text-label-base'
        } ellipsis flex gap-2 items-center`}
      >
        {doc_title}
      </div>
      <div
        className={`absolute top-1 right-0 bg-bg-base-hover px-2 py-1 flex gap-1.5 ${
          isFocused ? 'opacity-100' : 'opacity-0'
        } group-hover:opacity-100 group-focus:opacity-100 transition-all items-center caption text-label-base`}
      >
        Select
        <KeyboardChip type="cmd" variant="tertiary" />
        <KeyboardChip type="entr" variant="tertiary" />
      </div>
    </button>
  );
};

export default memo(IndexedPage);
