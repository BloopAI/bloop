import { useState } from 'react';
import Code from '../../components/CodeBlock/Code';
import Button from '../../components/Button';
import { CheckIcon, Clipboard } from '../../icons';
import { copyToClipboard } from '../../utils';

type Props = {
  code: string;
  language: string;
};

const NewCode = ({ code, language }: Props) => {
  const [codeCopied, setCodeCopied] = useState(false);
  return (
    <div className="text-sm p-4 border border-bg-border rounded-md relative bg-bg-shade">
      <div className="overflow-auto">
        <Code showLines={false} code={code} language={language} />
      </div>
      <div
        className={`absolute ${
          code.split('\n').length > 1 ? 'top-4 right-4' : 'top-2.5 right-2.5'
        }`}
      >
        <Button
          variant="tertiary"
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
