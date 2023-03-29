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
        title="Sync local repositories"
        description="Select the folders you want to add to bloop. You can always sync, unsync or remove unwanted repositories later."
      />
      <div className="flex flex-col overflow-auto">
        <div className={`flex flex-col gap-4`}>
          <Button onClick={handleChooseFolder}>Choose a folder</Button>
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
