import { memo } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  ranges: ([number, number] | [number])[];
  isShort?: boolean;
};

const LinesBadge = ({ ranges, isShort }: Props) => {
  const { t } = useTranslation();
  return (
    <div className="h-5 px-1 flex items-center rounded-sm bg-bg-main/15 caption text-bg-main flex-shrink-0 w-fit">
      {!ranges.length
        ? t('Whole file')
        : ranges.length === 1
        ? isShort
          ? `${ranges[0][0] + 1} - ${ranges[0][1] ? ranges[0][1] + 1 : ''}`
          : t('Lines # - #', {
              start: ranges[0][0] + 1,
              end: ranges[0][1] ? ranges[0][1] + 1 : '',
            })
        : t('# ranges', { count: ranges.length })}
    </div>
  );
};

export default memo(LinesBadge);
