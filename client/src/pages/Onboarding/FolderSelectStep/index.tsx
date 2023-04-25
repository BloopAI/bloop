import React, { useCallback, useContext, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import DialogText from '../DialogText';
import Button from '../../../components/Button';
import { ArrowRight } from '../../../icons';
import GoBackButton from '../GoBackButton';
import { DeviceContext } from '../../../context/deviceContext';
import { UIContext } from '../../../context/uiContext';
import {
  CHOSEN_SCAN_FOLDER_KEY,
  savePlainToStorage,
} from '../../../services/storage';

type Props = {
  handleNext: (e?: any, skipOne?: boolean) => void;
  handleBack?: (e: any) => void;
};

const FolderSelectStep = ({ handleNext, handleBack }: Props) => {
  const { homeDir, chooseFolder } = useContext(DeviceContext);
  const { setOnBoardingState } = useContext(UIContext);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    setOnBoardingState((prev) => ({
      ...prev,
      indexFolder: undefined,
    }));
  }, []);

  const handleSkip = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      handleNext(e, true);
    },
    [],
  );
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
    if (!folder) {
      folder = searchParams.get('chosen_scan_folder');
    }
    if (typeof folder === 'string') {
      setOnBoardingState((prev) => ({
        ...prev,
        indexFolder: folder,
      }));
      savePlainToStorage(CHOSEN_SCAN_FOLDER_KEY, folder);
      handleNext();
    }
  }, [chooseFolder, homeDir]);

  return (
    <>
      <DialogText
        title="Local repository"
        description="Sync a repository on your local machine"
      />
      <div className="flex flex-col overflow-auto gap-8">
        <div className="py-5 px-3 flex flex-col gap-2 rounded-md bg-gradient-to-t to-gray-800 from-transparent items-center text-center">
          <p className="body-s text-gray-300">Scan a folder</p>
          <p className="body-s text-gray-400">
            Scan a folder to sync it’s repositories
          </p>
          <Button variant="secondary" onClick={handleChooseFolder}>
            Select folder
          </Button>
        </div>
        <div className={`flex flex-col gap-4`}>
          <Button disabled>Sync repository</Button>
          {handleBack ? (
            <Button variant="secondary" onClick={handleSkip}>
              Skip this step
              <ArrowRight />
            </Button>
          ) : null}
        </div>
      </div>
      {handleBack ? <GoBackButton handleBack={handleBack} /> : null}
    </>
  );
};

export default FolderSelectStep;
