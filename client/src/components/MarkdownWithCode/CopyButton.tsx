import { memo, useCallback, useState } from 'react';
import Button from '../Button';
import { copyToClipboard } from '../../utils';
import { CheckIcon, Clipboard, CopyMD } from '../../icons';

type Props = {
  isInHeader?: boolean;
  code: string;
};

const CopyButton = ({ isInHeader, code }: Props) => {
  const [codeCopied, setCodeCopied] = useState(false);

  const onClick = useCallback(() => {
    copyToClipboard(code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }, [code]);

  return (
    <div
      className={`${
        isInHeader
          ? ''
          : code.split('\n').length > 1
          ? 'absolute top-4 right-4 opacity-0 group-code-hover:opacity-100 transition-opacity'
          : 'absolute top-2.5 right-2.5 opacity-0 group-code-hover:opacity-100 transition-opacity'
      } `}
    >
      <Button
        variant="secondary"
        size={isInHeader ? 'tiny' : 'small'}
        onClick={onClick}
      >
        {codeCopied ? (
          <CheckIcon />
        ) : isInHeader ? (
          <CopyMD raw sizeClassName="w-3.5 h-3.5" />
        ) : (
          <Clipboard />
        )}
        {codeCopied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
};

export default memo(CopyButton);
