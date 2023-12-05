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
import { FileHighlightsContext } from '../../context/fileHighlightsContext';
import LinkRenderer from './LinkRenderer';
import CodeRenderer from './CodeRenderer';

type Props = {
  markdown: string;
  hideCode?: boolean;
  recordId?: number;
  threadId?: string;
  isCodeStudio?: boolean;
  side: 'left' | 'right';
};

const MarkdownWithCode = ({
  markdown,
  hideCode,
  recordId,
  threadId,
  isCodeStudio,
  side,
}: Props) => {
  const fileChips = useRef([]);
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
            fileChips={fileChips}
            hideCode={hideCode}
            setFileHighlights={setFileHighlights}
            setHoveredLines={setHoveredLines}
            recordId={recordId}
            threadId={threadId}
            side={side}
          >
            {props.children}
          </LinkRenderer>
        );
      },
      code({ node, inline, className, children, ...props }: CodeProps) {
        return (
          <CodeRenderer
            hideCode={hideCode}
            setFileHighlights={setFileHighlights}
            setHoveredLines={setHoveredLines}
            fileChips={fileChips}
            inline={inline}
            className={className}
            propsJSON={JSON.stringify(props)}
            recordId={recordId}
            threadId={threadId}
            isCodeStudio={isCodeStudio}
            side={side}
          >
            {children}
          </CodeRenderer>
        );
      },
    };
  }, [hideCode]);

  return <ReactMarkdown components={components}>{markdown}</ReactMarkdown>;
};

export default MarkdownWithCode;
