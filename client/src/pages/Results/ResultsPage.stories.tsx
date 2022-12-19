import { MemoryRouter, Routes, Route } from 'react-router-dom';
import xhrMock from 'xhr-mock';
import { codeSearch, fileContent } from '../../mocks/api_mocks';
import ResultsPage from './index';
import '../../index.css';

export default {
  title: 'pages/ResultsPage',
  component: ResultsPage,
  parameters: {
    layout: 'fullscreen',
  },
};
xhrMock.setup();

export const CodeResults = () => {
  xhrMock.get('http://localhost:3003/search?q=&limit=5', (req, res) => {
    return res.status(200).body(JSON.stringify(codeSearch));
  });
  xhrMock.get(/http:\/\/localhost:3003\/file.*/, (req, res) => {
    return res.status(200).body(JSON.stringify({ content: fileContent }));
  });

  xhrMock.get(/http:\/\/localhost:3003\/hoverable.*/, (req, res) => {
    return res.status(200).body(JSON.stringify({ content: fileContent }));
  });
  return (
    <MemoryRouter initialEntries={['']}>
      <Routes>
        <Route
          path="/"
          element={<ResultsPage loading={false} resultsData={codeSearch} />}
        />
      </Routes>
    </MemoryRouter>
  );
};

export const CodeSymbolsResults = () => {
  return (
    <MemoryRouter initialEntries={['']}>
      <Routes>
        <Route
          path="/"
          element={<ResultsPage loading={false} resultsData={codeSearch} />}
        />
      </Routes>
    </MemoryRouter>
  );
};

export const RepoResults = () => {
  return (
    <MemoryRouter initialEntries={['']}>
      <Routes>
        <Route
          path="/"
          element={<ResultsPage loading={false} resultsData={codeSearch} />}
        />
      </Routes>
    </MemoryRouter>
  );
};
export const FileResults = () => {
  return (
    <MemoryRouter initialEntries={['']}>
      <Routes>
        <Route
          path="/"
          element={<ResultsPage loading={false} resultsData={codeSearch} />}
        />
      </Routes>
    </MemoryRouter>
  );
};
