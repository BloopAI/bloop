import { memo, useCallback, useContext, useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { ProjectContext } from '../../../../context/projectContext';
import { PlusSignIcon, WarningSignIcon } from '../../../../icons';
import Button from '../../../../components/Button';
import { CommandBarContext } from '../../../../context/commandBarContext';
import { CommandBarStepEnum } from '../../../../types/general';

type Props = {
  studioId: string;
};

const NoFilesMessage = ({ studioId }: Props) => {
  useTranslation();
  const { project } = useContext(ProjectContext.Current);
  const { setChosenStep, setIsVisible } = useContext(
    CommandBarContext.Handlers,
  );

  const onAddFile = useCallback(() => {
    setChosenStep({ id: CommandBarStepEnum.SEARCH_FILES, data: { studioId } });
    setIsVisible(true);
  }, [studioId]);

  const isEmptyContext = useMemo(() => {
    const fullStudio = project?.studios.find(
      (s) => s.id.toString() === studioId.toString(),
    );
    return !!fullStudio && !fullStudio.context.length;
  }, [project?.studios, studioId]);

  return isEmptyContext ? (
    <div className="w-full flex items-center gap-4 p-4 select-none">
      <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full bg-yellow-subtle text-yellow">
        <WarningSignIcon sizeClassName="w-3.5 h-3.5" />
      </div>
      <p className="body-s text-yellow flex-1">
        <Trans>
          Add at least one context file before submitting your first request.
        </Trans>
      </p>
      <Button variant="studio" size="small" onClick={onAddFile}>
        <PlusSignIcon sizeClassName="w-4 h-4" />
        <Trans>Add files</Trans>
      </Button>
    </div>
  ) : null;
};

export default memo(NoFilesMessage);
