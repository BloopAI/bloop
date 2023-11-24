import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { SnippetItem } from '../../../../types/api';
import { ChevronRightIcon } from '../../../../icons';
import FileIcon from '../../../../components/FileIcon';
import { TabsContext } from '../../../../context/tabsContext';
import { TabTypesEnum } from '../../../../types/general';
import useKeyboardNavigation from '../../../../hooks/useKeyboardNavigation';
import { UIContext } from '../../../../context/uiContext';
import CodeLine from './CodeLine';

type Props = {
  relative_path: string;
  repo_ref: string;
  lang: string;
  snippets: SnippetItem[];
  index: string;
  focusedIndex: string;
  isFirst: boolean;
};

const CodeResult = ({
  relative_path,
  repo_ref,
  lang,
  snippets,
  index,
  focusedIndex,
  isFirst,
}: Props) => {
  const { openNewTab } = useContext(TabsContext.Handlers);
  const { isLeftSidebarFocused } = useContext(UIContext.Focus);
  const ref = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  useEffect(() => {
    if (focusedIndex === index) {
      ref.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex, index]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.stopPropagation();
        e.preventDefault();
        openNewTab({
          type: TabTypesEnum.FILE,
          path: relative_path,
          repoRef: repo_ref,
          scrollToLine: `${snippets[0].line_range.start}_${snippets[0].line_range.end}`,
        });
      }
    },
    [repo_ref, relative_path, openNewTab],
  );
  useKeyboardNavigation(
    handleKeyEvent,
    focusedIndex !== index || !isLeftSidebarFocused,
  );

  const handleClick = useCallback(() => {
    openNewTab({
      type: TabTypesEnum.FILE,
      path: relative_path,
      repoRef: repo_ref,
    });
  }, [repo_ref, relative_path, openNewTab]);

  return (
    <div className="relative flex flex-col">
      <span className="absolute top-7 bottom-0 left-11.5 w-px bg-bg-border" />
      <div
        className={`flex w-max min-w-full items-center gap-3 whitespace-nowrap body-mini text-label-title h-7 flex-shrink-0 ${
          isFirst ? 'scroll-mt-10' : ''
        } ${focusedIndex === index ? 'bg-bg-shade-hover' : ''} pl-10 pr-4`}
        onClick={toggleExpanded}
        ref={ref}
        data-node-index={index}
      >
        <ChevronRightIcon
          sizeClassName="w-3.5 h-3.5"
          className={`${
            isExpanded ? 'rotate-90' : 'rotate-0'
          } transition-transform duration-150 ease-in-out`}
        />
        <FileIcon filename={relative_path} noMargin />
        {/*<BreadcrumbsPathContainer*/}
        {/*  path={relative_path}*/}
        {/*  onClick={handleClick}*/}
        {/*  repo={repo_ref}*/}
        {/*/>*/}
        <div onClick={handleClick}>{relative_path}</div>
      </div>
      <ul className="pl-2.5 ml-10 pr-4">
        {isExpanded
          ? snippets.map((s, i) => (
              <CodeLine
                key={i}
                code={s.data}
                path={relative_path}
                language={lang}
                repoRef={repo_ref}
                lineStart={s.line_range.start}
                lineEnd={s.line_range.end}
                highlights={s.highlights}
              />
            ))
          : null}
      </ul>
    </div>
  );
};

export default memo(CodeResult);
