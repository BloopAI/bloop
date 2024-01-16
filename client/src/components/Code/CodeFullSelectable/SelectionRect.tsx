import React, { memo, useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { CODE_LINE_HEIGHT } from '../../../consts/code';
import Button from '../../Button';

type TemporaryRangeProps = {
  range: [number, number];
  isTemporary: true;
  i?: never;
  deleteRange?: never;
  invertRanges?: never;
  isEditingRanges?: boolean;
};

type StaticRangeProps = {
  range: [number, number];
  i: number;
  deleteRange: (i: number) => void;
  invertRanges: () => void;
  isTemporary?: false;
  isEditingRanges?: boolean;
};

type Props = TemporaryRangeProps | StaticRangeProps;

const SelectionRect = ({
  range,
  isTemporary,
  deleteRange,
  invertRanges,
  i,
  isEditingRanges,
}: Props) => {
  useTranslation();
  const style = useMemo(() => {
    return {
      top: range[0] * CODE_LINE_HEIGHT,
      height: (range[1] - range[0] + 1) * CODE_LINE_HEIGHT,
    };
  }, [range]);
  return (
    <div
      className="absolute left-0 right-0 z-10 group pointer-events-none"
      style={style}
    >
      <div className="w-full h-full bg-bg-selected z-10" />
      {!isTemporary && isEditingRanges && (
        <div className="absolute top-2 right-2 z-20 flex gap-1 items-center pointer-events-auto">
          <Button size="mini" variant="secondary" onClick={invertRanges}>
            <Trans>Invert</Trans>
          </Button>
          <Button
            size="mini"
            variant="secondary"
            onClick={() => deleteRange(i)}
          >
            <Trans>Clear range</Trans>
          </Button>
        </div>
      )}
    </div>
  );
};

export default memo(SelectionRect);
