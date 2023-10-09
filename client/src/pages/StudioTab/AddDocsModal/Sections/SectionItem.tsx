import React, { memo, useCallback, useEffect, useRef } from 'react';
import { DocSectionType, DocShortType } from '../../../../types/api';
import RenderedSection from './RenderedSection';

type Props = DocSectionType & {
  selectedProvider: DocShortType;
  handleDocSubmit: (
    id: string,
    name: string,
    baseUrl: string,
    url: string,
    selectedSection?: string,
  ) => void;
  i: number;
  isFocused: boolean;
  setHighlightedIndex: (i: number) => void;
};

const SectionItem = ({
  point_id,
  text,
  relative_url,
  selectedProvider,
  handleDocSubmit,
  i,
  isFocused,
  setHighlightedIndex,
}: Props) => {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (isFocused) {
      ref.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [isFocused]);

  const handleMouseOver = useCallback(() => {
    setHighlightedIndex(i);
  }, []);

  const handleClick = useCallback(() => {
    handleDocSubmit(
      selectedProvider.id,
      selectedProvider.name,
      selectedProvider.url,
      relative_url,
      point_id,
    );
  }, [selectedProvider, relative_url, point_id]);
  return (
    <a
      href="#"
      key={point_id}
      ref={ref}
      className={`px-4 py-4 w-full block border-b-2 border-bg-border hover:bg-bg-base-hover ${
        isFocused ? 'bg-bg-base-hover' : 'bg-transparent'
      }`}
      onClick={handleClick}
      onMouseOver={handleMouseOver}
    >
      <RenderedSection text={text} />
    </a>
  );
};

export default memo(SectionItem);
