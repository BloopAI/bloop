import React, { memo, useCallback, useEffect, useRef } from 'react';
import { DocSectionType, DocShortType } from '../../../../types/api';
import { ChevronRight } from '../../../../icons';
import RenderedSection from './RenderedSection';

type Props = DocSectionType & {
  selectedProvider: DocShortType;
  handleDocSubmit: (
    docProvider: DocShortType,
    url: string,
    title: string,
    selectedSection?: string,
  ) => void;
  i: number;
  isFocused: boolean;
  setHighlightedIndex: (i: number) => void;
};

const SectionItem = ({
  point_id,
  text,
  doc_title,
  relative_url,
  selectedProvider,
  handleDocSubmit,
  i,
  isFocused,
  setHighlightedIndex,
  ancestry,
}: Props) => {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (isFocused) {
      ref.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [isFocused]);

  const handleClick = useCallback(() => {
    handleDocSubmit(selectedProvider, relative_url, doc_title, point_id);
  }, [selectedProvider, relative_url, doc_title, point_id]);
  return (
    <a
      href="#"
      key={point_id}
      ref={ref}
      className={`px-4 py-4 w-full block border-b-2 border-bg-border hover:bg-bg-base-hover ${
        isFocused ? 'bg-bg-base-hover' : 'bg-transparent'
      }`}
      onClick={handleClick}
    >
      <div className="flex gap-0.5 items-center text-label-base mb-2">
        {ancestry.map((a, i) => (
          <>
            {i !== 0 && <ChevronRight sizeClassName="w-4 h-4" />}
            <p className="caption">{a.replace(/#/g, '')}</p>
          </>
        ))}
      </div>
      <RenderedSection text={text} />
    </a>
  );
};

export default memo(SectionItem);
