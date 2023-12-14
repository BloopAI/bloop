import React, { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../Button';
import { copyToClipboard } from '../../utils';
import { CheckIcon, CopyTextIcon } from '../../icons';

type Props = {
  isInHeader?: boolean;
  code: string;
  className?: string;
  btnVariant?: 'tertiary' | 'secondary';
};

const CopyButton = ({
  isInHeader,
  code,
  className,
  btnVariant = 'secondary',
}: Props) => {
  const { t } = useTranslation();
  const [codeCopied, setCodeCopied] = useState(false);

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      copyToClipboard(code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    },
    [code],
  );

  return (
    <div
      className={`${
        isInHeader
          ? ''
          : code.split('\n').length > 1
          ? 'absolute top-4 right-4 opacity-0 group-code-hover:opacity-100 transition-opacity'
          : 'absolute top-2.5 right-2.5 opacity-0 group-code-hover:opacity-100 transition-opacity'
      } ${className}`}
    >
      <Button
        variant={btnVariant}
        size={isInHeader ? 'mini' : 'small'}
        onClick={onClick}
        onlyIcon
        title={codeCopied ? t('Copied') : t('Copy')}
      >
        {codeCopied ? (
          <CheckIcon sizeClassName="w-3.5 h-3.5" />
        ) : (
          <CopyTextIcon sizeClassName="w-3.5 h-3.5" />
        )}
      </Button>
    </div>
  );
};

export default memo(CopyButton);
