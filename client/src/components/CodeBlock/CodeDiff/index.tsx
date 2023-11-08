import React from 'react';
import FileIcon from '../../FileIcon';
import { getFileExtensionForLang, getPrettyLangName } from '../../../utils';
import BreadcrumbsPath from '../../BreadcrumbsPath';
import CopyButton from '../../MarkdownWithCode/CopyButton';
import Code from '../Code';

type Props = {
  hunks: {
    line_start: number;
    patch: string;
  }[];
  language: string;
  filePath: string;
};

const CodeDiff = ({ hunks, language, filePath }: Props) => {
  return (
    <div
      className={`my-4 bg-bg-sub text-xs border-bg-border border rounded-md relative group-code`}
    >
      <div
        className={`bg-bg-shade border-bg-border border-b rounded-t-md p-2 flex items-center justify-between gap-2`}
      >
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          <FileIcon
            filename={filePath || getFileExtensionForLang(language, true)}
            noMargin
          />
          {filePath ? (
            <BreadcrumbsPath path={filePath} repo={''} nonInteractive />
          ) : (
            <span className="caption-strong">
              {getPrettyLangName(language) || language}
            </span>
          )}
        </div>
        <CopyButton isInHeader code={hunks.map((h) => h.patch).join('\n')} />
      </div>
      <div className={`overflow-auto py-2`}>
        {hunks.map((h, index) => (
          <>
            <Code
              key={h.line_start}
              showLines
              code={h.patch}
              language={language}
              isDiff
              lineStart={h.line_start}
            />
            {index !== hunks.length - 1 ? (
              <pre className={`bg-bg-sub my-0 px-2`}>
                <table>
                  <tbody>
                    <tr className="token-line">
                      <td className="text-label-muted min-w-6 text-right text-l select-none">
                        ..
                      </td>
                    </tr>
                  </tbody>
                </table>
              </pre>
            ) : null}
          </>
        ))}
      </div>
    </div>
  );
};

export default CodeDiff;
