import { LogoSmall } from '../../icons';
import useAppNavigation from '../../hooks/useAppNavigation';
import NavBarNoUser from './NoUser';
import NavBarUser from './User';

type Props = {
  userSigned?: boolean;
  isSkeleton?: boolean;
};

const NavBar = ({ userSigned, isSkeleton }: Props) => {
  const { navigateHome } = useAppNavigation();
  return (
    <div
      className={`h-16 flex items-center gap-6 px-8 bg-gray-800/75 fixed top-0 left-0 right-0 z-30 ${
        userSigned ? '' : 'justify-between'
      } border-b border-gray-700 backdrop-blur-8`}
    >
      {!isSkeleton && (
        <span className="text-gray-50">
          <button onClick={navigateHome}>
            <LogoSmall />
          </button>
        </span>
      )}
      {userSigned ? <NavBarUser isSkeleton={isSkeleton} /> : <NavBarNoUser />}
    </div>
  );
};
export default NavBar;
