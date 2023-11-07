import FileIcon from '../../FileIcon';
import { getFileExtensionForLang, getPrettyLangName } from '../../../utils';
import BreadcrumbsPath from '../../BreadcrumbsPath';
import CopyButton from '../../MarkdownWithCode/CopyButton';
import Code from '../Code';

type Props = {
  code: string;
  language: string;
  filePath: string;
  lineStart: number;
};

const CodeDiff = ({ code, language, filePath, lineStart }: Props) => {
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
        <CopyButton isInHeader code={code} />
      </div>
      <div className={`overflow-auto py-2`}>
        <Code
          showLines
          code={code}
          language={language}
          isDiff
          lineStart={lineStart}
        />
      </div>
    </div>
  );
};

export default CodeDiff;
