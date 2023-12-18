import { memo, ReactNode, useCallback, useContext, useMemo } from 'react';
import { TabTypesEnum } from '../../types/general';
import { TabsContext } from '../../context/tabsContext';
import CodeWithBreadcrumbs from './CodeWithBreadcrumbs';
import NewCode from './NewCode';

type Props = {
  children: ReactNode[];
  className?: string;
  propsJSON: string;
  inline?: boolean;
  isCodeStudio?: boolean;
  side: 'left' | 'right';
};

const CodeRenderer = ({
  className,
  children,
  inline,
  propsJSON,
  isCodeStudio,
  side,
}: Props) => {
  const { openNewTab } = useContext(TabsContext.Handlers);
  const matchLang = useMemo(
    () =>
      /lang:(\w+)/.exec(className || '') ||
      /language:(\w+)/.exec(className || '') ||
      /language-(\w+)/.exec(className || ''),
    [className],
  );
  const matchType = useMemo(
    () => /language-type:(\w+)/.exec(className || ''),
    [className],
  );
  const matchPath = useMemo(
    () => /path:(.*?)(,|$)/.exec(className || ''),
    [className],
  );
  const [repoRef, filePath] = useMemo(
    () => matchPath?.[1].split(':') || [],
    [matchPath],
  );
  const matchLines = useMemo(
    () => /lines:(.+)/.exec(className || ''),
    [className],
  );
  const code = useMemo(
    () =>
      typeof children[0] === 'string' ? children[0].replace(/\n$/, '') : '',
    [children],
  );
  const lines = useMemo(
    () => matchLines?.[1].split('-').map((l) => Number(l)) || [],
    [matchLines],
  );
  const colorPreview = useMemo(
    () =>
      children[0] &&
      children.length === 1 &&
      typeof children[0] === 'string' &&
      /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(children[0]) ? (
        <span
          className="w-3 h-3 inline-block"
          style={{ backgroundColor: children[0] }}
        />
      ) : null,
    [children],
  );

  const onClick = useCallback(
    (path?: string, linesToGo?: string) => {
      openNewTab(
        {
          type: TabTypesEnum.FILE,
          path: path || filePath,
          repoRef,
          scrollToLine:
            linesToGo || lines
              ? `${lines[0]}_${lines[1] ?? lines[0]}`
              : undefined,
        },
        side === 'left' ? 'right' : 'left',
      );
    },
    [openNewTab, filePath, repoRef, lines, side],
  );

  return (
    <>
      {!inline &&
      (matchType?.[1] || matchLang?.[1]) &&
      typeof children[0] === 'string' ? (
        matchType?.[1] === 'Quoted' ? (
          <CodeWithBreadcrumbs
            code={code}
            repoRef={repoRef}
            language={matchLang?.[1] || ''}
            filePath={filePath || ''}
            onResultClick={onClick}
            startLine={lines[0] ? lines[0] : null}
          />
        ) : (
          <NewCode
            code={code}
            language={matchLang?.[1] || ''}
            filePath={filePath || ''}
            isCodeStudio={isCodeStudio}
          />
        )
      ) : colorPreview ? (
        <span className="inline-flex gap-1.5 items-center">
          {colorPreview}
          <code {...JSON.parse(propsJSON)} className={className}>
            {children}
          </code>
        </span>
      ) : (
        <code {...JSON.parse(propsJSON)} className={className}>
          {children}
        </code>
      )}
    </>
  );
};

export default memo(CodeRenderer);
