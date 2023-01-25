import React, { useCallback, useContext, useEffect, useState } from 'react';
import { UIContext } from '../../../context/uiContext';
import TelemetryPopup from '../TelemetryPopup';
import Step0 from './Step0';
import Step1 from './Step1';
import Step2 from './Step2';
import Step3 from './Step3';
import Step4 from './Step4';
import SelfServeStep0 from './SelfServeStep0';

type Props = {
  onFinish: () => void;
};

const Onboarding = ({ onFinish }: Props) => {
  const [step, setStep] = useState(0);
  const { onBoardingState } = useContext(UIContext);
  const [shouldShowTelemetry, setShouldShowTelemetry] = useState(true);

  const closeTelemetry = useCallback(() => {
    setShouldShowTelemetry(false);
  }, []);

  useEffect(() => {
    if (step === 1) {
      onFinish();
    }
  }, [step]);

  const handleNext = useCallback((e: any, skipOne = false) => {
    setStep((prev) => prev + (skipOne ? 2 : 1));
  }, []);

  const handlePrev = useCallback((e: any, skip: number = 1) => {
    setStep((prev) => prev - skip);
  }, []);

  return (
    <div className="fixed top-0 bottom-0 left-0 right-0 my-16 bg-[url('/onboarding-background.png')] bg-cover">
      <div className="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-start overflow-auto bg-gray-900 bg-opacity-75">
        <TelemetryPopup
          onClose={closeTelemetry}
          visible={shouldShowTelemetry}
        />
        {!shouldShowTelemetry && (
          <div className="flex flex-col items-center max-w-md2 w-full">
            <div className="mt-8 bg-gray-900 border border-gray-800 rounded-lg shadow-big p-6 flex flex-col gap-8 w-full max-w-md2 w-full relative max-h-[calc(100vh-12rem)]">
              <SelfServeStep0 handleNext={handleNext} />
              {/*{step === 0 ? (*/}
              {/*  <Step0 handleNext={handleNext} />*/}
              {/*) : step === 1 ? (*/}
              {/*  <Step1 handleNext={handleNext} handleBack={handlePrev} />*/}
              {/*) : step === 2 ? (*/}
              {/*  <Step2 handleNext={handleNext} handleBack={handlePrev} />*/}
              {/*) : step === 3 ? (*/}
              {/*  <Step3*/}
              {/*    handleNext={handleNext}*/}
              {/*    handleBack={(e) =>*/}
              {/*      handlePrev(e, onBoardingState.indexFolder ? 1 : 2)*/}
              {/*    }*/}
              {/*  />*/}
              {/*) : step === 4 ? (*/}
              {/*  <Step4*/}
              {/*    handleNext={handleNext}*/}
              {/*    handleBack={(e) =>*/}
              {/*      handlePrev(e, onBoardingState.indexFolder ? 2 : 3)*/}
              {/*    }*/}
              {/*  />*/}
              {/*) : null}*/}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
