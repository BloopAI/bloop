import ReactMarkdown from 'react-markdown';
import {
  AnchorHTMLAttributes,
  DetailedHTMLProps,
  ReactElement,
  useMemo,
} from 'react';
import { ReactMarkdownProps } from 'react-markdown/lib/complex-types';
import { CodeProps } from 'react-markdown/lib/ast-to-react';
import FileChip from '../Chat/ConversationMessage/FileChip';
import CodeWithBreadcrumbs from '../../pages/ArticleResponse/CodeWithBreadcrumbs';
import NewCode from '../../pages/ConversationResult/NewCode';

type Props = {
  openFileModal: (
    path: string,
    scrollToLine?: string,
    highlightColor?: string,
  ) => void;
  repoName: string;
  markdown: string;
};

const MarkdownWithCode = ({ openFileModal, repoName, markdown }: Props) => {
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
        const [filePath, lines] = props.href?.split('#') || [];
        const [start, end] =
          lines?.split('-').map((l) => Number(l.slice(1))) || [];
        let fileName: string = '';
        if (props.children?.[0]) {
          if (typeof props.children[0] === 'string') {
            fileName = props.children?.[0];
          }
          const child = props.children[0] as ReactElement;
          if (child?.props && typeof child.props.children?.[0] === 'string') {
            fileName = child.props.children?.[0];
          }
        }
        return (
          <FileChip
            fileName={fileName || filePath || ''}
            skipIcon={!!fileName && fileName !== filePath}
            onClick={() =>
              openFileModal(
                filePath,
                start ? `${start - 1}_${(end ?? start) - 1}` : undefined,
              )
            }
          />
        );
      },
      code({ node, inline, className, children, ...props }: CodeProps) {
        const matchLang = /language-(\w+)/.exec(className || '');
        const matchPath = /path:(.+),/.exec(className || '');
        const matchLines = /lines:(.+)/.exec(className || '');
        const code =
          typeof children[0] === 'string' ? children[0].replace(/\n$/, '') : '';
        const lines =
          matchLines?.[1].split('-').map((l) => Number(l.slice(1))) || [];
        const colorPreview =
          children[0] &&
          children.length === 1 &&
          typeof children[0] === 'string' &&
          /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(children[0]) ? (
            <span
              className="w-3 h-3 inline-block"
              style={{ backgroundColor: children[0] }}
            />
          ) : null;
        return !inline && matchLang?.[1] && typeof children[0] === 'string' ? (
          matchPath?.[1] ? (
            <CodeWithBreadcrumbs
              code={code}
              language={matchLang[1]}
              filePath={matchPath[1]}
              onResultClick={openFileModal}
              startLine={lines[0] - 1}
              repoName={repoName}
            />
          ) : (
            <NewCode code={code} language={matchLang[1]} />
          )
        ) : colorPreview ? (
          <span className="inline-flex gap-1.5 items-center">
            {colorPreview}
            <code {...props} className={className}>
              {children}
            </code>
          </span>
        ) : (
          <code {...props} className={className}>
            {children}
          </code>
        );
      },
    };
  }, [repoName, openFileModal]);

  return <ReactMarkdown components={components}>{markdown}</ReactMarkdown>;
};

export default MarkdownWithCode;
