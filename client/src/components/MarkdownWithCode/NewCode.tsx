import { getFileExtensionForLang, getPrettyLangName } from '../../utils';
import FileIcon from '../FileIcon';
import CodeFragment from '../Code/CodeFragment';
import CopyButton from './CopyButton';

type Props = {
  code: string;
  language: string;
  filePath: string;
  isSummary?: boolean;
  isCodeStudio?: boolean;
};

const NewCode = ({
  code,
  language,
  isSummary,
  isCodeStudio,
  filePath,
}: Props) => {
  return (
    <div
      className={`${
        !isSummary ? (isCodeStudio ? ' text-xs' : ' text-sm') : 'text-sm'
      } bg-bg-sub my-4 border border-bg-border rounded-md relative group-code`}
    >
      <div
        className={`border-bg-border border-b bg-bg-base rounded-t-md p-2 flex items-center justify-between gap-2`}
      >
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          <FileIcon
            filename={filePath || getFileExtensionForLang(language, true)}
            noMargin
          />
          {filePath ? (
            <span>BreadcrumbsPath nonInteractive</span>
          ) : (
            <span className="caption-strong">
              {getPrettyLangName(language) || language}
            </span>
          )}
        </div>
        <CopyButton isInHeader code={code} />
      </div>
      <div
        className={`overflow-auto ${isCodeStudio ? 'p-2' : 'py-2 code-mini'}`}
      >
        <CodeFragment
          showLines={false}
          code={code}
          language={language}
          canWrap
        />
      </div>
    </div>
  );
};

export default NewCode;
