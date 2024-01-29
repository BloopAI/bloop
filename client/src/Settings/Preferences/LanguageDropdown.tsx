import { memo, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import SectionItem from '../../components/Dropdown/Section/SectionItem';
import { LocaleContext } from '../../context/localeContext';
import { localesMap } from '../../consts/general';
import { LocaleType } from '../../types/general';

type Props = {};

const LanguageDropdown = ({}: Props) => {
  useTranslation();
  const { locale, setLocale } = useContext(LocaleContext);

  return (
    <div>
      <div className="flex flex-col p-1 items-start">
        {(Object.keys(localesMap) as LocaleType[]).map((k) => (
          <SectionItem
            key={k}
            index={`lang-${k}`}
            isSelected={locale === k}
            onClick={() => setLocale(k)}
            label={localesMap[k].name}
            icon={<span>{localesMap[k].icon}</span>}
          />
        ))}
      </div>
    </div>
  );
};

export default memo(LanguageDropdown);
