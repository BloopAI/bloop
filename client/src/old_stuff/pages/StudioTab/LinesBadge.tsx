import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import BlueChip from './BlueChip';

type Props = {
  ranges: ([number, number] | [number])[];
  isShort?: boolean;
};

const LinesBadge = ({ ranges, isShort }: Props) => {
  const { t } = useTranslation();
  return (
    <BlueChip
      text={
        !ranges.length
          ? t('Whole file')
          : ranges.length === 1
          ? isShort
            ? `${ranges[0][0] + 1} - ${ranges[0][1] ? ranges[0][1] + 1 : ''}`
            : t('Lines # - #', {
                start: ranges[0][0] + 1,
                end: ranges[0][1] ? ranges[0][1] + 1 : '',
              })
          : t('# ranges', { count: ranges.length })
      }
    />
  );
};

export default memo(LinesBadge);
