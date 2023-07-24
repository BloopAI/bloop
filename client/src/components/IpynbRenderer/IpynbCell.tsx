import React from 'react';
import ReactMarkdown from 'react-markdown';
import sanitizeHtml from 'sanitize-html';
import Code from '../CodeBlock/Code';
import { IpynbCellType } from '../../types/general';

type CellProps = {
  cell: IpynbCellType;
  seq: number;
};

const Cell: React.FC<CellProps> = ({ cell, seq }) => {
  if (!cell.outputs?.length && !cell.source?.length) {
    return null;
  }

  return (
    <div className="">
      <div className="flex gap-2">
        <div className="prompt input_prompt">
          {cell.cell_type === 'code' ? (
            <div className="caption flex-shrink-0 w-13 mt-1">
              In [{cell.execution_count || cell.prompt_number || ' '}]:
            </div>
          ) : null}
        </div>
        <div className="overflow-auto w-full border rounded-md border-bg-border">
          {(() => {
            let source = '';
            if (cell.input) {
              source = stringify(cell.input);
            } else if (cell.source) {
              source = stringify(cell.source);
            }
            if (cell.cell_type === 'markdown') {
              return (
                <ReactMarkdown>
                  {embedAttachments(source, cell.attachments)}
                </ReactMarkdown>
              );
            }
            if (cell.cell_type === 'code') {
              return (
                <div className="input_area">
                  <div
                    className="highlight hl-ipython3 p-1 code-s"
                    onDoubleClick={(e) => {
                      const selection = window.getSelection();
                      const range = document.createRange();
                      range.selectNodeContents(e.currentTarget);
                      selection?.removeAllRanges();
                      selection?.addRange(range);
                    }}
                  >
                    {source && (
                      <Code
                        code={source}
                        language="python"
                        showLines={false}
                        removePaddings
                      />
                    )}
                  </div>
                </div>
              );
            }
            if (cell.cell_type === 'heading') {
              return <h2>{source}</h2>;
            }
          })()}
        </div>
      </div>

      <div className="output_wrapper">
        <div className="output caption">
          {(cell.outputs || []).map((output, j) => (
            <div className="flex gap-2 mt-2" key={j}>
              <div className="prompt output_prompt">
                {output.execution_count ? (
                  <div className="caption flex-shrink-0 w-13 mt-1">
                    Out [{output.execution_count}]:
                  </div>
                ) : (
                  <div className="caption flex-shrink-0 w-13 mt-1" />
                )}
              </div>
              <div className="overflow-auto w-full border rounded-md border-bg-border p-1">
                {(() => {
                  if (output.data == null) {
                    if (output.png) {
                      return (
                        <div className="output_png output_subarea">
                          <img
                            src={`data:image/png;base64,${output.png}`}
                            alt="output png"
                          />
                        </div>
                      );
                    }
                    if (output.jpeg) {
                      return (
                        <div className="output_jpeg output_subarea">
                          <img
                            src={`data:image/jpeg;base64,${output.jpeg}`}
                            alt="output jpeg"
                          />
                        </div>
                      );
                    }
                    if (output.gif) {
                      return (
                        <div className="output_gif output_subarea">
                          <img
                            src={`data:image/gif;base64,${output.gif}`}
                            alt="output gif"
                          />
                        </div>
                      );
                    }
                    if (output.svg) {
                      return (
                        <div
                          className="output_svg output_subarea"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeHtml(output.svg),
                          }}
                        ></div>
                      );
                    }
                    if (output.text) {
                      return (
                        <div
                          className={`output_subarea output_text output_${output.output_type} output_${output.name} output-${output.name}`}
                        >
                          <pre>{stringify(output.text)}</pre>
                        </div>
                      );
                    }
                    if (output.traceback) {
                      return (
                        <div className="output_subarea bg-bg-danger">
                          <p>{stringify(output.traceback)}</p>
                        </div>
                      );
                    }
                    return null;
                  }
                  if (output.data['text/latex']) {
                    return (
                      <ReactMarkdown>
                        {stringify(output.data['text/latex'])}
                      </ReactMarkdown>
                    );
                  }
                  if (output.data['text/html']) {
                    const html = stringify(output.data['text/html']);
                    return (
                      <div
                        className="output_html rendered_html output_subarea"
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHtml(html),
                        }}
                      ></div>
                    );
                  }
                  if (output.data['image/png']) {
                    return (
                      <div className="output_png output_subarea">
                        <img
                          src={`data:image/png;base64,${output.data['image/png']}`}
                          alt="output png"
                        />
                      </div>
                    );
                  }
                  if (output.data['image/jpeg']) {
                    return (
                      <div className="output_jpeg output_subarea">
                        <img
                          src={`data:image/jpeg;base64,${output.data['image/jpeg']}`}
                          alt="output jpeg"
                        />
                      </div>
                    );
                  }
                  if (output.data['image/gif']) {
                    return (
                      <div className="output_gif output_subarea">
                        <img
                          src={`data:image/gif;base64,${output.data['image/gif']}`}
                          alt="output gif"
                        />
                      </div>
                    );
                  }
                  if (output.data['image/svg+xml']) {
                    return (
                      <div
                        className="output_svg output_subarea"
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHtml(output.data['image/svg+xml']),
                        }}
                      ></div>
                    );
                  }
                  if (output.data['text/plain']) {
                    return (
                      <div className="output_text output_subarea output_execute_result">
                        <pre className={``}>{output.data['text/plain']}</pre>
                      </div>
                    );
                  }
                })()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const embedAttachments = (
  source: string,
  attachments: IpynbCellType['attachments'] = {},
) => {
  Object.entries(attachments).map(([name, mimes]) => {
    const mime = [...Object.keys(mimes)][0];
    if (mime == null) {
      return;
    }
    const data = `data:${mime};base64,${mimes[mime]}`;
    const re = new RegExp(`attachment:${name}`, 'g');
    source = source.replace(re, data);
  });
  return source;
};

const stringify = (output: string | string[]): string => {
  if (Array.isArray(output)) {
    return output.join('');
  }
  return output;
};

export default Cell;
