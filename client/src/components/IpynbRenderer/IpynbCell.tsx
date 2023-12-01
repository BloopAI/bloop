import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeMathJax from 'rehype-mathjax';
import sanitizeHtml from 'sanitize-html';
import Convert from 'ansi-to-html';
import { IpynbCellType } from '../../types/general';
import { escapeHtml } from '../../utils';
import CodeFragment from '../Code/CodeFragment';

const convertAnsi = new Convert();

type CellProps = {
  cell: IpynbCellType;
  seq: number;
};

const Cell: React.FC<CellProps> = ({ cell, seq }) => {
  if (!cell.outputs?.length && !cell.source?.length && !cell.input?.length) {
    return null;
  }

  return (
    <div className="">
      <div className="flex gap-2">
        {cell.cell_type === 'code' ? (
          <div className="prompt input_prompt">
            <div className="caption flex-shrink-0 w-13 mt-1">
              In [{cell.execution_count || cell.prompt_number || ' '}]:
            </div>
          </div>
        ) : null}
        <div className="overflow-auto w-full">
          {(() => {
            let source = '';
            if (cell.input) {
              source = stringify(cell.input);
            } else if (cell.source) {
              source = stringify(cell.source);
            }
            if (cell.cell_type === 'markdown') {
              return (
                <div className="markdown ipynb-markdown body-s">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeMathJax]}
                  >
                    {embedAttachments(source, cell.attachments)}
                  </ReactMarkdown>
                </div>
              );
            }
            if (cell.cell_type === 'code') {
              return (
                <div className="input_area border rounded-md border-bg-border">
                  <div
                    className="p-1 code-s"
                    onDoubleClick={(e) => {
                      const selection = window.getSelection();
                      const range = document.createRange();
                      range.selectNodeContents(e.currentTarget);
                      selection?.removeAllRanges();
                      selection?.addRange(range);
                    }}
                  >
                    {source && (
                      <CodeFragment
                        code={source}
                        language={cell.language || 'python'}
                        showLines={false}
                        removePaddings
                      />
                    )}
                  </div>
                </div>
              );
            }
            if (cell.cell_type === 'heading') {
              return (
                <div className="markdown ipynb-markdown">
                  {cell.level === 1 ? (
                    <h1>{source}</h1>
                  ) : cell.level === 2 ? (
                    <h2>{source}</h2>
                  ) : cell.level === 3 ? (
                    <h3>{source}</h3>
                  ) : (
                    <h4>{source}</h4>
                  )}
                </div>
              );
            }
          })()}
        </div>
      </div>

      <div className="output_wrapper">
        <div className="output caption">
          {(cell.outputs || []).map((output, j) => (
            <div className="flex gap-2 mt-2" key={j}>
              <div className="prompt output_prompt">
                {output.execution_count || output.prompt_number ? (
                  <div className="caption flex-shrink-0 w-13 mt-1">
                    Out [{output.execution_count || output.prompt_number}]:
                  </div>
                ) : (
                  <div className="caption flex-shrink-0 w-13 mt-1" />
                )}
              </div>
              <div className="overflow-auto w-full">
                {(() => {
                  if (output.data == null) {
                    if (output.latex) {
                      return (
                        <div className="markdown body-s ipynb-markdown">
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeMathJax]}
                          >
                            {stringify(output.latex)}
                          </ReactMarkdown>
                        </div>
                      );
                    }
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
                            __html: sanitizeHtml(stringify(output.svg)),
                          }}
                        ></div>
                      );
                    }
                    if (output.html) {
                      return (
                        <div
                          className="output_html output_subarea markdown ipynb-markdown"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeHtml(stringify(output.html)),
                          }}
                        ></div>
                      );
                    }
                    if (output.text) {
                      return (
                        <div
                          className={`output_subarea output_text ${
                            output.stream === 'stderr' ||
                            output.name === 'stderr' ||
                            output.output_type === 'stderr'
                              ? 'bg-bg-danger/30'
                              : ''
                          } output_${output.output_type} output_${
                            output.stream
                          } output-${output.name}`}
                        >
                          <pre
                            dangerouslySetInnerHTML={{
                              __html: convertAnsi.toHtml(
                                escapeHtml(stringify(output.text)),
                              ),
                            }}
                          />
                        </div>
                      );
                    }
                    if (output.traceback) {
                      return (
                        <div className="output_subarea bg-bg-danger/30 overflow-auto">
                          <pre
                            dangerouslySetInnerHTML={{
                              __html: convertAnsi.toHtml(
                                stringify(output.traceback),
                              ),
                            }}
                          />
                        </div>
                      );
                    }
                    return null;
                  }
                  if (output.data['text/latex']) {
                    return (
                      <div className="markdown body-s ipynb-markdown">
                        <ReactMarkdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[rehypeMathJax]}
                        >
                          {stringify(output.data['text/latex'])}
                        </ReactMarkdown>
                      </div>
                    );
                  }
                  if (output.data['text/html']) {
                    const html = stringify(output.data['text/html']);
                    return (
                      <div
                        className="output_html rendered_html output_subarea markdown ipynb-markdown"
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHtml(stringify(html)),
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
                          __html: sanitizeHtml(
                            stringify(output.data['image/svg+xml']),
                          ),
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
    return output.filter((l) => !l.startsWith('<!--====-->')).join('');
  }
  return output;
};

export default Cell;
