import React, { memo, useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { CODE_LINE_HEIGHT } from '../../../consts/code';
import Button from '../../Button';

type TemporaryRangeProps = {
  range: [number, number];
  isTemporary: true;
  i?: never;
  deleteRange?: never;
};

type StaticRangeProps = {
  range: [number, number];
  i: number;
  deleteRange: (i: number) => void;
  isTemporary?: false;
};

type Props = TemporaryRangeProps | StaticRangeProps;

const SelectionRect = ({ range, isTemporary, deleteRange, i }: Props) => {
  useTranslation();
  const style = useMemo(() => {
    return {
      top: range[0] * CODE_LINE_HEIGHT,
      height: (range[1] - range[0] + 1) * CODE_LINE_HEIGHT,
    };
  }, [range]);
  return (
    <div className="absolute left-0 right-0 z-10 group" style={style}>
      <div className="w-full h-full bg-bg-main opacity-20 hover:opacity-30 z-10" />
      {!isTemporary && (
        <Button
          size="tiny"
          variant="secondary"
          className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100"
          onClick={() => deleteRange(i)}
        >
          <Trans>Clear range</Trans>
        </Button>
      )}
    </div>
  );
};

export default memo(SelectionRect);
