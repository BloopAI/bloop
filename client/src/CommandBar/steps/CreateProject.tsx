import {
  ChangeEvent,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import Header from '../Header';
import Footer from '../Footer';
import { CommandBarStepEnum } from '../../types/general';
import { CommandBarContext } from '../../context/commandBarContext';
import { createProject } from '../../services/api';
import { ProjectContext } from '../../context/projectContext';

type Props = {};

const CreateProject = ({}: Props) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const { setChosenStep, setFocusedItem, setIsVisible } = useContext(
    CommandBarContext.Handlers,
  );
  const { setCurrentProjectId } = useContext(ProjectContext.Current);
  const { refreshAllProjects } = useContext(ProjectContext.All);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  useEffect(() => {
    setFocusedItem({
      footerHint: t('Provide a short, concise title for your project'),
      footerBtns: [{ label: t('Create project'), shortcut: ['entr'] }],
    });
  }, [t]);

  const switchProject = useCallback((id: string) => {
    setCurrentProjectId(id);
    setIsVisible(false);
    refreshAllProjects();
    setChosenStep({
      id: CommandBarStepEnum.INITIAL,
    });
  }, []);

  const breadcrumbs = useMemo(() => {
    return [t('Create project')];
  }, [t]);

  const handleBack = useCallback(() => {
    setChosenStep({ id: CommandBarStepEnum.INITIAL });
  }, []);

  const submitHandler = useCallback(
    async (value: string) => {
      setInputValue('');
      const newId = await createProject(value);
      switchProject(newId);
    },
    [switchProject],
  );

  return (
    <div className="w-full flex flex-col h-[28.875rem] max-w-[40rem] overflow-auto">
      <Header
        breadcrumbs={breadcrumbs}
        handleBack={handleBack}
        customSubmitHandler={submitHandler}
        placeholder={t('Untitled project')}
        value={inputValue}
        onChange={handleInputChange}
      />
      <div className="flex-1" />
      <Footer />
    </div>
  );
};

export default memo(CreateProject);
