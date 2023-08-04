import { useLocation } from 'react-router-dom';
import { useMemo } from 'react';

const useUrlParser = () => {
  const location = useLocation();
  const repoRef = useMemo(
    () =>
      decodeURIComponent(location.pathname.slice(1).split('/')[0] || 'initial'),
    [location.pathname],
  );
  const page = useMemo(
    () => location.pathname.slice(1).split('/')[2],
    [location.pathname],
  );
  const branch = useMemo(
    () => decodeURIComponent(location.pathname.slice(1).split('/')[1]),
    [location.pathname],
  );

  const result = useMemo(
    () => ({ repoRef, page, branch }),
    [repoRef, page, branch],
  );

  return result;
};

export default useUrlParser;
