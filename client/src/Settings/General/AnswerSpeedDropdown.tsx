import { memo, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import DropdownSection from '../../components/Dropdown/Section';
import SectionItem from '../../components/Dropdown/Section/SectionItem';
import { ProjectContext } from '../../context/projectContext';
import { RunIcon, WalkIcon } from '../../icons';

type Props = {};

const AnswerSpeedDropdown = ({}: Props) => {
  const { t } = useTranslation();
  const { preferredAnswerSpeed, setPreferredAnswerSpeed } = useContext(
    ProjectContext.AnswerSpeed,
  );
  return (
    <div>
      <DropdownSection borderBottom>
        <SectionItem
          label={t('Normal')}
          isSelected={preferredAnswerSpeed === 'normal'}
          onClick={() => setPreferredAnswerSpeed('normal')}
          icon={<WalkIcon sizeClassName="w-4 h-4" />}
          description={t('Recommended: The classic response type')}
        />
      </DropdownSection>
      <DropdownSection>
        <SectionItem
          label={t('Fast')}
          isSelected={preferredAnswerSpeed === 'fast'}
          onClick={() => setPreferredAnswerSpeed('fast')}
          icon={<RunIcon sizeClassName="w-4 h-4" />}
          description={t('Experimental: Faster but less accurate')}
        />
      </DropdownSection>
    </div>
  );
};

export default memo(AnswerSpeedDropdown);
