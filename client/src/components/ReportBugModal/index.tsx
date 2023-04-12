import React, {
  ChangeEvent,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import ModalOrSidebar from '../ModalOrSidebar';
import { Bug, CloseSign } from '../../icons';
import TextInput from '../TextInput';
import Button from '../Button';
import { UIContext } from '../../context/uiContext';
import { EMAIL_REGEX } from '../../consts/validations';
import { saveBugReport, saveCrashReport } from '../../services/api';
import { DeviceContext } from '../../context/deviceContext';

type Props = {
  errorBoundaryMessage?: string;
  handleSubmit?: () => void;
  forceShow?: boolean;
};
const ReportBugModal = ({
  errorBoundaryMessage,
  handleSubmit,
  forceShow,
}: Props) => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    text: '',
    emailError: '',
  });
  const [isSubmitted, setSubmitted] = useState(false);
  const [serverCrashedMessage, setServerCrashedMessage] = useState('');
  const { onBoardingState, isBugReportModalOpen, setBugReportModalOpen } =
    useContext(UIContext);
  const { envConfig, listen, os } = useContext(DeviceContext);

  useEffect(() => {
    listen('server-crashed', (event) => {
      console.log(event);
      setBugReportModalOpen(true);
      setServerCrashedMessage(event.payload.message);
    });
  }, [listen]);

  useEffect(() => {
    if (errorBoundaryMessage) {
      setServerCrashedMessage(errorBoundaryMessage);
    }
  }, [errorBoundaryMessage]);

  useEffect(() => {
    const savedForm = onBoardingState['STEP_DATA_FORM'];

    setForm((prev) => ({
      ...prev,
      name: (savedForm?.firstName || '') + (savedForm?.lastName || ''),
      email: savedForm?.email || '',
    }));
  }, [onBoardingState]);

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({
        ...prev,
        [e.target.name]: e.target.value,
        emailError: e.target.name === 'email' ? '' : prev.emailError,
      }));
    },
    [],
  );

  const onSubmit = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault();
    if (serverCrashedMessage) {
      saveCrashReport({
        text: form.text,
        unique_id: envConfig.tracking_id || '',
        info: serverCrashedMessage,
        metadata: JSON.stringify(os),
      });
    } else {
      const { emailError, ...values } = form;
      saveBugReport({ ...values, unique_id: envConfig.tracking_id || '' });
    }
    setSubmitted(true);
    setServerCrashedMessage('');
  };

  const resetState = () => {
    setForm((prev) => ({ ...prev, text: '', emailError: '' }));
    setSubmitted(false);
    setBugReportModalOpen(false);
    setServerCrashedMessage('');
    handleSubmit?.();
  };

  return (
    <ModalOrSidebar
      isSidebar={false}
      shouldShow={isBugReportModalOpen || !!forceShow}
      onClose={() => setBugReportModalOpen(false)}
      isModalSidebarTransition={false}
      setIsModalSidebarTransition={() => {}}
      shouldStretch={false}
      fullOverlay
      containerClassName="max-w-md2 max-h-[80vh]"
    >
      <div className="p-6 flex flex-col gap-8 relative bg-gray-900 overflow-auto">
        {!isSubmitted ? (
          serverCrashedMessage ? (
            <>
              <div className="flex flex-col gap-3 items-center">
                <h4>bloop crashed unexpectedly</h4>
                <p className="body-s text-gray-500 text-center">
                  By submitting this crash report you agree to send it to bloop
                  for investigation.
                </p>
              </div>
              <form className="flex flex-col gap-4 overflow-auto">
                <TextInput
                  value={form.text}
                  onChange={onChange}
                  name="text"
                  multiline
                  variant="filled"
                  placeholder="Provide any steps necessary to reproduce the problem..."
                />
                <div className="flex flex-col overflow-auto">
                  <p className="body-s text-gray-100 mb-1">
                    Problem details and System configuration
                  </p>
                  <p className="body-s text-gray-400 border border-gray-800 p-2.5 rounded-4 overflow-auto">
                    {serverCrashedMessage}
                    <br />
                    <br />
                    Type: {os.type}
                    <br />
                    Platform: {os.platform}
                    <br />
                    Arch: {os.arch}
                    <br />
                    Version: {os.version}
                    <br />
                  </p>
                </div>
              </form>
              <Button type="submit" onClick={onSubmit}>
                Submit crash report
              </Button>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-3 items-center">
                <Bug />
                <h4>Report a bug</h4>
                <p className="body-s text-gray-500 text-center">
                  We want to make this the best experience for you. If you
                  encountered a bug, please submit this bug report to us. Our
                  team will investigate as soon as possible.
                </p>
              </div>
              <form className="flex flex-col gap-4">
                <TextInput
                  value={form.name}
                  onChange={onChange}
                  name="name"
                  placeholder="Full name"
                />
                <TextInput
                  value={form.email}
                  onChange={onChange}
                  validate={() => {
                    if (!EMAIL_REGEX.test(form.email)) {
                      setForm((prev) => ({
                        ...prev,
                        emailError: 'Email is not valid',
                      }));
                    }
                  }}
                  error={form.emailError}
                  name="email"
                  placeholder="Email address"
                />
                <TextInput
                  value={form.text}
                  onChange={onChange}
                  name="text"
                  multiline
                  placeholder="Describe the bug to help us reproduce it..."
                />
              </form>
              <Button type="submit" onClick={onSubmit}>
                Submit bug report
              </Button>
            </>
          )
        ) : (
          <>
            <div className="flex flex-col gap-3 items-center">
              <h4>Thank you!</h4>
              <p className="body-s text-gray-500 text-center">
                We’ll investigate and reach out back soon if necessary.
              </p>
            </div>
            <div className="w-full">
              <img src="/bug_report_confirm.png" alt="Confirmation" />
            </div>
            <Button variant="secondary" onClick={() => resetState()}>
              Got it!
            </Button>
          </>
        )}
        <div className="absolute top-2 right-2">
          <Button
            onlyIcon
            title="Close"
            variant="tertiary"
            size="small"
            onClick={() => resetState()}
          >
            <CloseSign />
          </Button>
        </div>
      </div>
    </ModalOrSidebar>
  );
};

export default ReportBugModal;
