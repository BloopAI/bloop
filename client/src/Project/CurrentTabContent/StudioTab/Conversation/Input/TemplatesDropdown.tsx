import {
  ChangeEvent,
  MouseEvent,
  memo,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import DropdownSection from '../../../../../components/Dropdown/Section';
import { StudioTemplateType } from '../../../../../types/api';
import SectionItem from '../../../../../components/Dropdown/Section/SectionItem';
import { CogIcon, TemplatesIcon } from '../../../../../icons';
import { UIContext } from '../../../../../context/uiContext';
import { ProjectSettingSections } from '../../../../../types/general';
import { ArrowNavigationContext } from '../../../../../context/arrowNavigationContext';

type Props = {
  templates: StudioTemplateType[];
  onTemplateSelected: (t: string) => void;
  handleClose: () => void;
};

const TemplatesDropdown = ({ templates, onTemplateSelected }: Props) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [templatesToShow, setTemplatesToShow] = useState(templates);
  const { setProjectSettingsOpen, setProjectSettingsSection } = useContext(
    UIContext.ProjectSettings,
  );
  const { focusedIndex } = useContext(ArrowNavigationContext);

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!inputValue) {
      setTemplatesToShow(templates);
    } else {
      setTemplatesToShow(
        templates.filter((t) =>
          t.name.toLowerCase().includes(inputValue.toLowerCase()),
        ),
      );
    }
  }, [templates, inputValue]);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const handleManage = useCallback(() => {
    setProjectSettingsSection(ProjectSettingSections.TEMPLATES);
    setProjectSettingsOpen(true);
  }, []);

  const noPropagate = useCallback((e: MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
  }, []);

  useEffect(() => {
    if (focusedIndex === 'search-templates') {
      inputRef.current?.focus();
    }
  }, [focusedIndex]);

  return (
    <div>
      <DropdownSection borderBottom>
        <input
          className="w-full h-8 bg-transparent body-s px-2 outline-0 focus:outline-0 focus:outline-none placeholder:text-label-muted"
          value={inputValue}
          name={'search'}
          onChange={handleChange}
          type="search"
          autoComplete="off"
          autoCorrect="off"
          placeholder={t('Search templates...')}
          autoFocus
          onClick={noPropagate}
          ref={inputRef}
          data-node-index={'search-templates'}
        />
      </DropdownSection>
      <DropdownSection borderBottom>
        {templatesToShow.map((t) => (
          <SectionItem
            label={t.name}
            key={t.id}
            index={`templ-${t.id}`}
            onClick={() => onTemplateSelected(t.content)}
            icon={<TemplatesIcon sizeClassName="w-3.5 h-3.5" />}
          />
        ))}
      </DropdownSection>
      <DropdownSection>
        <SectionItem
          label={t('Manage templates')}
          icon={<CogIcon sizeClassName="w-3.5 h-3.5" />}
          onClick={handleManage}
          index={'manage-templ'}
        />
      </DropdownSection>
    </div>
  );
};

export default memo(TemplatesDropdown);
