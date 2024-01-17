import React, {
  ChangeEvent,
  memo,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import TextInput from '../components/TextInput';
import { ProjectContext } from '../context/projectContext';
import Button from '../components/Button';
import { deleteProject, updateProject } from '../services/api';
import { UIContext } from '../context/uiContext';
import Dropdown from '../components/Dropdown';
import { ChevronDownIcon, RunIcon, WalkIcon } from '../icons';
import AnswerSpeedDropdown from '../Settings/General/AnswerSpeedDropdown';

type Props = {};

const General = ({}: Props) => {
  const { t } = useTranslation();
  const { project, refreshCurrentProject, setCurrentProjectId } = useContext(
    ProjectContext.Current,
  );
  const { refreshAllProjects, projects } = useContext(ProjectContext.All);
  const { setProjectSettingsOpen } = useContext(UIContext.ProjectSettings);
  const [name, setName] = useState(project?.name || '');

  useEffect(() => {
    setName(project?.name || '');
  }, [project?.name]);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (project?.id && name) {
      await updateProject(project?.id, { name });
      refreshCurrentProject();
    }
  }, [project?.id, name, refreshCurrentProject]);

  const handleDelete = useCallback(async () => {
    if (project?.id) {
      await deleteProject(project?.id);
      if (projects.length > 1) {
        setCurrentProjectId(
          projects.find((p) => p.id !== project.id)?.id || '',
        );
      }
      refreshAllProjects();
      refreshCurrentProject();
      setProjectSettingsOpen(false);
    }
  }, [project?.id, projects, refreshCurrentProject]);

  return (
    <div className="w-[36.25rem] flex flex-col flex-2">
      <div className="flex flex-col gap-3 ">
        <p className="body-m text-label-title">
          <Trans>General</Trans>
        </p>
        <p className="body-s-b text-label-muted">
          <Trans>Manage your general project settings</Trans>
        </p>
      </div>
      <hr className="border-bg-divider my-8" />
      <div className="flex flex-col gap-5 max-w-[25rem]">
        <TextInput
          value={name}
          name={'projectName'}
          onChange={handleChange}
          label={t('Project title')}
          onBlur={handleSubmit}
          onSubmit={handleSubmit}
        />
      </div>
      <hr className="border-bg-divider my-8" />
      <div className="flex items-start gap-8 w-full">
        <p className="body-s text-label-base">
          <Trans>
            Permanently delete{' '}
            <span className="body-s-b text-label-title">{project?.name}</span>{' '}
            and remove all the data associated to it. Repositories will remain
            accessible in your GitHub account.
          </Trans>
        </p>
        <Button variant="danger" size="small" onClick={handleDelete}>
          <Trans>Delete project</Trans>
        </Button>
      </div>
    </div>
  );
};

export default memo(General);
