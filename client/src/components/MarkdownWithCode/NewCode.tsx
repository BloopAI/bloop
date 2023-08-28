import { useState } from 'react';
import Code from '../CodeBlock/Code';
import Button from '../Button';
import { CheckIcon, Clipboard } from '../../icons';
import {
  copyToClipboard,
  getFileExtensionForLang,
  getPrettyLangName,
} from '../../utils';
import FileIcon from '../FileIcon';

type Props = {
  code: string;
  language: string;
  isSummary?: boolean;
  isCodeStudio?: boolean;
};

const NewCode = ({ code, language, isSummary, isCodeStudio }: Props) => {
  const [codeCopied, setCodeCopied] = useState(false);
  return (
    <div
      className={`${
        !isSummary
          ? isCodeStudio
            ? 'my-4 bg-bg-sub'
            : 'my-4 p-4 bg-bg-shade'
          : 'bg-chat-bg-sub'
      } text-sm border border-bg-border rounded-md relative group-code`}
    >
      {isCodeStudio && (
        <div className="bg-bg-shade border-b border-bg-border p-2 flex items-center gap-2">
          <FileIcon
            filename={getFileExtensionForLang(language, true)}
            noMargin
          />
          {getPrettyLangName(language)}
        </div>
      )}
      <div className={`overflow-auto ${isCodeStudio ? 'p-2' : ''}`}>
        <Code showLines={false} code={code} language={language} canWrap />
      </div>
      <div
        className={`absolute ${
          code.split('\n').length > 1 ? 'top-4 right-4' : 'top-2.5 right-2.5'
        } opacity-0 group-code-hover:opacity-100 transition-opacity`}
      >
        <Button
          variant="secondary"
          size="small"
          onClick={() => {
            copyToClipboard(code);
            setCodeCopied(true);
            setTimeout(() => setCodeCopied(false), 2000);
          }}
        >
          {codeCopied ? <CheckIcon /> : <Clipboard />}
          {codeCopied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
};

export default NewCode;
