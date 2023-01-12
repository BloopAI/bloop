import { useContext } from 'react';
import Button from '../../../components/Button';
import {
  IS_ANALYTICS_ALLOWED_KEY,
  savePlainToStorage,
} from '../../../services/storage';
import { AnalyticsContext } from '../../../context/analyticsContext';

const backdropFilterVisible = {
  transition:
    'background-color 150ms linear 0s, backdrop-filter 150ms linear 0s',
};

const backdropFilterInvisible = {
  transition:
    'background-color 150ms linear 0s, visibility 0s linear 200ms, backdrop-filter 150ms linear 0ms',
};

type Props = {
  onClose: () => void;
  visible: boolean;
};

const TelemetryPopup = ({ onClose, visible }: Props) => {
  const { setIsAnalyticsAllowed } = useContext(AnalyticsContext);
  return (
    <div
      className={`fixed top-16 bottom-16 left-0 right-0 bg-gray-900 bg-opacity-75 z-10 ${
        visible
          ? 'visible bg-opacity-75 backdrop-blur-2'
          : 'invisible bg-opacity-0 backdrop-blur-0'
      }`}
      style={visible ? backdropFilterVisible : backdropFilterInvisible}
    >
      <div
        className={`mx-auto max-w-md3 bg-gray-900 border border-gray-800 rounded-lg shadow-big ${
          visible ? 'mt-14 opacity-100' : 'mt-20 opacity-0'
        } transition-all duration-150`}
      >
        <div className="w-full h-60 flex justify-center items-center">
          <img src="/telemetryImg.png" alt="bloop telemetry" className="w-30" />
        </div>
        <div className="p-6 flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h4 className="text-center">Your privacy</h4>
            <p className="caption text-gray-500">
              Natural language search shares your query and select code snippets
              from your indexed repositories with bloop and OpenAI. Data is
              encrypted during transit and at rest. Access is strictly
              controlled.
            </p>
            <p className="caption text-gray-500">
              We may retain search and telemetry data to improve the quality of
              bloop search and to investigate abuse. Further details can be
              found within our{' '}
              <a
                className="underline"
                href="https://bloop.ai/terms"
                target="_blank"
                rel="noreferrer noopener"
              >
                Terms and Conditions
              </a>{' '}
              and{' '}
              <a
                className="underline"
                href="https://bloop.ai/privacy"
                target="_blank"
                rel="noreferrer noopener"
              >
                Privacy Policy
              </a>
              .
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <Button
              variant="primary"
              onClick={() => {
                savePlainToStorage(IS_ANALYTICS_ALLOWED_KEY, 'true');
                setIsAnalyticsAllowed(true);
                onClose();
              }}
            >
              I Understand
            </Button>
            {/*<Button*/}
            {/*  variant="tertiary"*/}
            {/*  onClick={() => {*/}
            {/*    savePlainToStorage(IS_ANALYTICS_ALLOWED_KEY, 'false');*/}
            {/*    setIsAnalyticsAllowed(false);*/}
            {/*    onClose();*/}
            {/*  }}*/}
            {/*>*/}
            {/*  Don&apos;t share*/}
            {/*</Button>*/}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelemetryPopup;
