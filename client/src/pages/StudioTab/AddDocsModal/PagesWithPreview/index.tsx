import { memo, useCallback, useEffect, useState } from 'react';
import { getDocSections, getIndexedPages } from '../../../../services/api';
import { DocPageType, DocSectionType } from '../../../../types/api';
import useKeyboardNavigation from '../../../../hooks/useKeyboardNavigation';
import RenderedSection from '../Sections/RenderedSection';
import IndexedPage from './IndexedPage';

type Props = {
  docId: string;
  handleSelectPage: (url: string, title: string) => void;
};

const PagesWithPreview = ({ docId, handleSelectPage }: Props) => {
  const [indexedPages, setIndexedPages] = useState<DocPageType[]>([]);
  const [previewingSections, setPreviewingSections] = useState<
    DocSectionType[]
  >([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'Enter') {
          handleSelectPage(
            indexedPages[highlightedIndex].relative_url,
            indexedPages[highlightedIndex].doc_title,
          );
        }
      } else {
        if (e.key === 'ArrowDown') {
          setHighlightedIndex((prev) =>
            prev < indexedPages.length - 1 ? prev + 1 : 0,
          );
        } else if (e.key === 'ArrowUp') {
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : indexedPages.length - 1,
          );
        }
      }
    },
    [indexedPages, highlightedIndex],
  );
  useKeyboardNavigation(handleKeyEvent);

  useEffect(() => {
    getIndexedPages(docId).then((resp) => {
      setIndexedPages(resp);
    });
  }, [docId]);

  useEffect(() => {
    if (indexedPages[highlightedIndex]) {
      getDocSections(docId, indexedPages[highlightedIndex].relative_url).then(
        (resp) => {
          setPreviewingSections(resp);
        },
      );
    }
  }, [docId, indexedPages, highlightedIndex]);

  return (
    <div className="w-full flex flex-col overflow-hidden">
      <div className="flex overflow-hidden">
        <div className="w-2/5 border-r border-bg-border overflow-y-auto">
          {indexedPages.map((p, i) => (
            <IndexedPage
              setHighlightedIndex={setHighlightedIndex}
              handleSelectPage={handleSelectPage}
              doc_title={p.doc_title}
              i={i}
              relative_url={p.relative_url}
              isFocused={highlightedIndex === i}
              key={p.relative_url}
            />
          ))}
        </div>
        <div className="w-3/5 flex flex-col gap-3 p-3 overflow-y-auto">
          {previewingSections.map((s) => {
            return <RenderedSection text={s.text} key={s.point_id} />;
          })}
        </div>
      </div>
    </div>
  );
};

export default memo(PagesWithPreview);
