import { memo, useCallback, useEffect, useState } from 'react';
import { getDocSections, getIndexedPages } from '../../../../services/api';
import {
  DocPageType,
  DocSectionType,
  DocShortType,
} from '../../../../types/api';
import useKeyboardNavigation from '../../../../hooks/useKeyboardNavigation';
import RenderedSection from '../Sections/RenderedSection';
import BreadcrumbsPath from '../../../../components/BreadcrumbsPath';
import Tooltip from '../../../../components/Tooltip';
import IndexedPage from './IndexedPage';

type Props = {
  docId: string;
  handleSelectPage: (url: string, absoluteUrl: string, title: string) => void;
  handleDocSubmit: (
    docProvider: DocShortType,
    url: string,
    absoluteUrl: string,
    title: string,
    selectedSection?: string,
  ) => void;
  filteredSections: DocSectionType[];
  search: string;
  selectedProvider: DocShortType;
};

const PagesWithPreview = ({
  docId,
  handleSelectPage,
  handleDocSubmit,
  search,
  filteredSections,
  selectedProvider,
}: Props) => {
  const [indexedPages, setIndexedPages] = useState<DocPageType[]>([]);
  const [previewingSections, setPreviewingSections] = useState<
    DocSectionType[]
  >([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'Enter') {
          if (search) {
            handleDocSubmit(
              selectedProvider,
              filteredSections[highlightedIndex].relative_url,
              filteredSections[highlightedIndex].absolute_url,
              filteredSections[highlightedIndex].doc_title,
              filteredSections[highlightedIndex].point_id,
            );
          } else {
            handleSelectPage(
              indexedPages[highlightedIndex].relative_url,
              indexedPages[highlightedIndex].absolute_url,
              indexedPages[highlightedIndex].doc_title,
            );
          }
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
    [indexedPages, highlightedIndex, search],
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

  const constructSectionTitle = useCallback(
    (docTitle: string, ancestry: string[], sectionHeader: string) => {
      let title = docTitle;
      if (ancestry.length) {
        title += '/';
      }
      ancestry.forEach((h, i) => {
        title += h.replace(/#/g, '');
        if (i !== ancestry.length - 1) {
          title += '/';
        }
      });
      if (sectionHeader) {
        title += '/';
        title += sectionHeader.replace(/#/g, '');
      }
      return title;
    },
    [],
  );

  const handleSelectSection = useCallback(
    (url: string, title: string, pointId: string) => {
      handleDocSubmit(selectedProvider, url, title, pointId);
    },
    [],
  );

  return (
    <div className="w-full flex flex-col overflow-hidden">
      <div className="flex overflow-hidden">
        <div className="w-2/5 border-r border-bg-border overflow-y-auto">
          {search
            ? filteredSections.map((s, i) => (
                <IndexedPage
                  setHighlightedIndex={setHighlightedIndex}
                  handleDocSubmit={handleSelectSection}
                  displayTitle={
                    <Tooltip
                      placement="top-start"
                      text={constructSectionTitle(
                        s.doc_title,
                        s.ancestry,
                        s.header,
                      )}
                    >
                      <BreadcrumbsPath
                        path={constructSectionTitle(
                          s.doc_title,
                          s.ancestry,
                          s.header,
                        )}
                        repo={''}
                        limitSectionWidth
                        nonInteractive
                      />
                    </Tooltip>
                  }
                  doc_title={s.doc_title}
                  i={i}
                  relative_url={s.relative_url}
                  absolute_url={s.absolute_url}
                  isFocused={highlightedIndex === i}
                  key={s.point_id + '-' + i}
                  point_id={s.point_id}
                />
              ))
            : indexedPages.map((p, i) => (
                <IndexedPage
                  setHighlightedIndex={setHighlightedIndex}
                  handleSelectPage={handleSelectPage}
                  doc_title={p.doc_title}
                  displayTitle={p.doc_title}
                  i={i}
                  relative_url={p.relative_url}
                  absolute_url={p.absolute_url}
                  isFocused={highlightedIndex === i}
                  key={p.relative_url + '-' + i}
                />
              ))}
        </div>
        <div className="w-3/5 flex flex-col gap-3 p-3 overflow-y-auto">
          {search ? (
            filteredSections[highlightedIndex] ? (
              <RenderedSection
                text={filteredSections[highlightedIndex].text}
                key={filteredSections[highlightedIndex].point_id}
                baseUrl={selectedProvider.url}
              />
            ) : null
          ) : (
            previewingSections.map((s) => {
              return (
                <RenderedSection
                  text={s.text}
                  key={s.point_id}
                  baseUrl={selectedProvider.url}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(PagesWithPreview);
