import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import DialogText from '../DialogText';
import Button from '../../../components/Button';
import { ArrowRight } from '../../../icons';
import SearchableRepoList from '../../../components/RepoList/SearchableRepoList';
import { scanLocalRepos, syncRepo } from '../../../services/api';
import { RepoType, RepoUi } from '../../../types/general';
import GoBackButton from '../GoBackButton';
import { splitPath } from '../../../utils';
import { DeviceContext } from '../../../context/deviceContext';
import { RepositoriesContext } from '../../../context/repositoriesContext';

type Props = {
  handleNext: (e?: any) => void;
  handleBack?: (e: any) => void;
};

const LocalReposStep = ({ handleNext, handleBack }: Props) => {
  const { t } = useTranslation();
  const [repos, setRepos] = useState<RepoUi[]>([]);
  const [chosenFolder, setChosenFolder] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(true);
  const { homeDir, chooseFolder } = useContext(DeviceContext);
  const { repositories } = useContext(RepositoriesContext);

  const handleSkip = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      handleNext();
    },
    [],
  );

  useEffect(() => {
    if (chosenFolder) {
      scanLocalRepos(chosenFolder)
        .then((data) => {
          const mainFolder = splitPath(chosenFolder).pop() || '';

          if (data.list.length === 1) {
            syncRepo(data.list[0].ref);
            handleNext();
            return;
          }

          setRepos(
            data.list
              .map((r: RepoType) => {
                const pathParts = splitPath(r.ref);
                const folder = `/${pathParts
                  .slice(pathParts.indexOf(mainFolder), pathParts.length - 1)
                  .join('/')}`;
                return {
                  ...r,
                  folderName: folder,
                  shortName: pathParts[pathParts.length - 1],
                  alreadySynced: !!repositories?.find(
                    (repo) => repo.ref === r.ref,
                  ),
                };
              })
              .sort((a: RepoUi, b: RepoUi) => a.folderName > b.folderName),
          );
        })
        .finally(() => setLoading(false));
    }
  }, [chosenFolder]);

  const handleChooseFolder = useCallback(async () => {
    let folder: string | string[] | null;
    if (chooseFolder) {
      try {
        folder = await chooseFolder({
          directory: true,
          defaultPath: homeDir,
        });
      } catch (err) {
        console.log(err);
      }
    }
    // @ts-ignore
    if (typeof folder === 'string') {
      setChosenFolder(folder);
    }
  }, [chooseFolder, homeDir]);
  return (
    <>
      <DialogText
        title={t('Sync local repositories')}
        description={
          chosenFolder
            ? t(
                'Select the folders you want to add to bloop. You can always sync, unsync or remove unwanted repositories later.',
              )
            : ''
        }
      />
      {chosenFolder ? (
        <div className="flex flex-col overflow-auto h-full relative">
          <SearchableRepoList
            items={repos}
            type="local"
            isLoading={isLoading}
            onSync={handleNext}
            onFolderChange={() => {
              setChosenFolder('');
              setLoading(true);
              setRepos([]);
            }}
          />
          {handleBack ? (
            <Button variant="secondary" onClick={handleSkip}>
              <Trans>Skip this step</Trans>
              <ArrowRight />
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col overflow-auto gap-8">
          <div className="py-5 px-3 flex flex-col gap-2 rounded-md bg-bg-sub items-center text-center">
            <p className="body-s-strong text-label-title">
              <Trans>Scan a folder</Trans>
            </p>
            <p className="body-s text-label-muted">
              <Trans>Scan a folder to sync it’s repositories.</Trans>
            </p>
            <Button variant="secondary" onClick={handleChooseFolder}>
              <Trans>Select folder</Trans>
            </Button>
          </div>
          {handleBack ? (
            <Button variant="secondary" onClick={handleSkip}>
              <Trans>Skip this step</Trans>
              <ArrowRight />
            </Button>
          ) : null}
        </div>
      )}
      {handleBack ? <GoBackButton handleBack={handleBack} /> : null}
    </>
  );
};

export default LocalReposStep;
