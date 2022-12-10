import '../../index.css';

export default {
  title: 'Typography',
};

export const Default = () => {
  return (
    <div className="bg-gray-900 text-gray-100">
      <h1>Heading 1</h1>
      <h2>Heading 2</h2>
      <h3>Heading 3</h3>
      <h4>Heading 4</h4>
      <h5>Heading 5</h5>
      <p className="subhead-l">Subhead large</p>
      <p className="subhead-m">Subhead medium</p>
      <p className="subhead-s">Subhead small</p>
      <p className="body-l">Body large</p>
      <p className="body-m">Body medium</p>
      <p className="body-s">Body small</p>
      <p className="callout">Callout</p>
      <p className="caption">Caption</p>
      <p className="caption-strong">Caption strong</p>
      <p className="code-s">Code small</p>
    </div>
  );
};
