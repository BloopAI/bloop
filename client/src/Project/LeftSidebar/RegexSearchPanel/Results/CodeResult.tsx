import { memo, useCallback, useContext, useMemo, useState } from 'react';
import { SnippetItem } from '../../../../types/api';
import { ChevronRightIcon } from '../../../../icons';
import FileIcon from '../../../../components/FileIcon';
import BreadcrumbsPathContainer from '../../../../components/Breadcrumbs/PathContainer';
import { TabsContext } from '../../../../context/tabsContext';
import { TabTypesEnum } from '../../../../types/general';
import CodeLine from './CodeLine';

type Props = {
  relative_path: string;
  repo_name: string;
  repo_ref: string;
  lang: string;
  snippets: SnippetItem[];
};

const CodeResult = ({
  relative_path,
  repo_name,
  repo_ref,
  lang,
  snippets,
}: Props) => {
  const { openNewTab } = useContext(TabsContext.Handlers);
  const [isExpanded, setIsExpanded] = useState(true);
  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const snippetsStyle = useMemo(() => {
    return { maxHeight: isExpanded ? undefined : 0 };
  }, [isExpanded]);

  const handleClick = useCallback(() => {
    openNewTab({
      type: TabTypesEnum.FILE,
      path: relative_path,
      repoName: repo_name,
      repoRef: repo_ref,
    });
  }, [repo_name, repo_ref, relative_path, openNewTab]);

  return (
    <div className="relative">
      <span className="absolute top-7 bottom-0 left-1.5 w-px bg-bg-border" />
      <div
        className="flex items-center gap-3 ellipsis body-mini text-label-title h-7 flex-shrink-0"
        onClick={toggleExpanded}
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
      <ul className="pl-2.5">
        {isExpanded
          ? snippets.map((s, i) => (
              <CodeLine
                key={i}
                code={s.data}
                path={relative_path}
                language={lang}
                repoRef={repo_ref}
                repoName={repo_name}
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
