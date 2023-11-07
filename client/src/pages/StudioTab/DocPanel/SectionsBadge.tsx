import { memo } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  sections: string[];
};

const SectionsBadge = ({ sections }: Props) => {
  const { t } = useTranslation();
  return (
    <div className="h-5 px-1 flex items-center rounded-sm bg-bg-main/15 caption text-bg-main flex-shrink-0 w-fit select-none">
      {!sections.length
        ? t('All sections')
        : t('# sections', { count: sections.length })}
    </div>
  );
};

export default memo(SectionsBadge);
