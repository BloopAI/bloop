import ReactMarkdown from 'react-markdown';
import {
  AnchorHTMLAttributes,
  DetailedHTMLProps,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { ReactMarkdownProps } from 'react-markdown/lib/complex-types';
import { CodeProps } from 'react-markdown/lib/ast-to-react';
import { AppNavigationContext } from '../../old_stuff/context/appNavigationContext';
import { SearchContext } from '../../old_stuff/context/searchContext';
import { FileHighlightsContext } from '../../context/fileHighlightsContext';
import LinkRenderer from './LinkRenderer';
import CodeRenderer from './CodeRenderer';

type Props = {
  repoName?: string;
  markdown: string;
  hideCode?: boolean;
  recordId?: number;
  threadId?: string;
  isCodeStudio?: boolean;
};

const MarkdownWithCode = ({
  repoName,
  markdown,
  hideCode,
  recordId,
  threadId,
  isCodeStudio,
}: Props) => {
  const { navigateRepoPath, navigateFullResult } =
    useContext(AppNavigationContext);
  const { selectedBranch } = useContext(SearchContext.SelectedBranch);
  const fileChips = useRef([]);
  const { updateScrollToIndex } = useContext(AppNavigationContext);
  const { setFileHighlights, setHoveredLines } = useContext(
    FileHighlightsContext.Setters,
  );

  useEffect(() => {
    return () => {
      setFileHighlights({});
      setHoveredLines(null);
    };
  }, []);

  const components = useMemo(() => {
    return {
      a(
        props: Omit<
          DetailedHTMLProps<
            AnchorHTMLAttributes<HTMLAnchorElement>,
            HTMLAnchorElement
          >,
          'ref'
        > &
          ReactMarkdownProps,
      ) {
        return (
          <LinkRenderer
            href={props.href}
            navigateRepoPath={navigateRepoPath}
            repoName={repoName}
            selectedBranch={selectedBranch}
            fileChips={fileChips}
            hideCode={hideCode}
            updateScrollToIndex={updateScrollToIndex}
            setFileHighlights={setFileHighlights}
            setHoveredLines={setHoveredLines}
            navigateFullResult={navigateFullResult}
            recordId={recordId}
            threadId={threadId}
          >
            {props.children}
          </LinkRenderer>
        );
      },
      code({ node, inline, className, children, ...props }: CodeProps) {
        return (
          <CodeRenderer
            hideCode={hideCode}
            updateScrollToIndex={updateScrollToIndex}
            setFileHighlights={setFileHighlights}
            setHoveredLines={setHoveredLines}
            fileChips={fileChips}
            inline={inline}
            repoName={repoName}
            className={className}
            propsJSON={JSON.stringify(props)}
            navigateFullResult={navigateFullResult}
            recordId={recordId}
            threadId={threadId}
            isCodeStudio={isCodeStudio}
          >
            {children}
          </CodeRenderer>
        );
      },
    };
  }, [repoName, hideCode, updateScrollToIndex, selectedBranch]);

  return <ReactMarkdown components={components}>{markdown}</ReactMarkdown>;
};

export default MarkdownWithCode;
