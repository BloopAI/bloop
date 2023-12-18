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
  singleFileExplanation?: boolean;
  isCodeStudio?: boolean;
  side: 'left' | 'right';
};

const MarkdownWithCode = ({
  markdown,
  singleFileExplanation,
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
            href={(props.node.properties?.href as string) || props.href}
            fileChips={fileChips}
            singleFileExplanation={singleFileExplanation}
            setFileHighlights={setFileHighlights}
            setHoveredLines={setHoveredLines}
            side={side}
          >
            {props.children}
          </LinkRenderer>
        );
      },
      code({ node, inline, className, children, ...props }: CodeProps) {
        return (
          <CodeRenderer
            inline={inline}
            className={className}
            propsJSON={JSON.stringify(props)}
            isCodeStudio={isCodeStudio}
            side={side}
          >
            {children}
          </CodeRenderer>
        );
      },
    };
  }, [singleFileExplanation]);

  return <ReactMarkdown components={components}>{markdown}</ReactMarkdown>;
};

export default MarkdownWithCode;
