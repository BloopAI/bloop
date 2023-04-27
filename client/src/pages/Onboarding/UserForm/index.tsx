import React, {
  Dispatch,
  SetStateAction,
  useCallback,
  useContext,
} from 'react';
import {
  BloopLogo,
  ChevronRight,
  GitHubLogo,
  MailIcon,
  Person,
} from '../../../icons';
import TextInput from '../../../components/TextInput';
import { EMAIL_REGEX } from '../../../consts/validations';
import Button from '../../../components/Button';
import { UIContext } from '../../../context/uiContext';
import { DeviceContext } from '../../../context/deviceContext';
import { gitHubLogout } from '../../../services/api';
import { Form } from '../index';

type Props = {
  form: Form;
  setForm: Dispatch<SetStateAction<Form>>;
  setGitHubScreen: (b: boolean) => void;
  onContinue: () => void;
};

const UserForm = ({ form, setForm, setGitHubScreen, onContinue }: Props) => {
  const { isGithubConnected, setGithubConnected } = useContext(UIContext);
  const { envConfig, openLink } = useContext(DeviceContext);

  const handleLogout = useCallback(() => {
    gitHubLogout();
    setGithubConnected(false);
  }, []);

  return (
    <>
      <div className="w-11 h-11">
        <BloopLogo />
      </div>
      <div className="flex flex-col gap-3 text-center">
        <h4 className="">Setup bloop</h4>
        <p className="text-gray-400 body-s">
          Please log into your GitHub account to complete setup
        </p>
      </div>
      <form className="flex flex-col gap-4 w-full">
        <TextInput
          value={form.name}
          name="name"
          placeholder="Your name"
          variant="filled"
          startIcon={<Person />}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, name: e.target.value }))
          }
        />
        <TextInput
          value={form.email}
          variant="filled"
          startIcon={<MailIcon />}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              email: e.target.value,
              emailError: null,
            }))
          }
          validate={() => {
            if (form.email && !EMAIL_REGEX.test(form.email)) {
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
        <div className="flex items-center pl-2.5 gap-2.5 border border-gray-700 rounded-4">
          <GitHubLogo />
          <p className="callout text-gray-100 flex-1">
            {isGithubConnected ? envConfig.user_login : 'GitHub'}
          </p>
          <button
            type="button"
            className={`caption text-gray-100 ${
              isGithubConnected ? 'px-3' : 'pl-3 pr-2'
            } h-10 flex gap-1 items-center border-l border-gray-700 hover:bg-gray-800`}
            onClick={() =>
              isGithubConnected ? handleLogout() : setGitHubScreen(true)
            }
          >
            {isGithubConnected ? 'Disconnect' : 'Connect account'}{' '}
            {!isGithubConnected && <ChevronRight />}
          </button>
        </div>
        <Button
          disabled={!isGithubConnected || !form.name || !form.email}
          onClick={onContinue}
        >
          Continue
        </Button>
      </form>
      {isGithubConnected && (
        <p className="caption text-gray-400 text-center">
          By continuing you accept our
          <br />
          <button
            onClick={() => openLink('https://bloop.ai/terms')}
            className="text-primary-300"
          >
            Terms & conditions
          </button>{' '}
          and{' '}
          <button
            onClick={() => openLink('https://bloop.ai/privacy')}
            className="text-primary-300"
          >
            Privacy policy
          </button>
        </p>
      )}
    </>
  );
};

export default UserForm;
