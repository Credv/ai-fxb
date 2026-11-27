import { PAPERS } from '../data/papers';
import { SHEET_PREVIEWS } from '../data/sheetPreviews';
import {
  KNOWLEDGE_CHAPTERS,
  KNOWLEDGE_SOURCE,
  type KnowledgeBlock,
} from '../data/knowledge';
import {
  EXAM_NAME,
  type IpTask,
  type Paper,
  type PythonTask,
  type Question,
  type Section,
  type SheetTask,
  type SingleChoice,
} from '../lib/types';

type Props = {
  paper: Paper | null;
  paperId: string;
};

const CHAPTER_NUMBERS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

export default function PrintView({ paper, paperId }: Props) {
  if (paperId === 'knowledge') return <KnowledgeSummary />;
  if (paperId && !paper) {
    return (
      <main className="sheet print-shell">
        <PrintToolbar title="打印完整试卷" />
        <div className="page print-error" role="alert">
          <div className="section-pad">
            <h2>未找到试卷</h2>
            <p>试卷编号「{paperId}」不存在，请返回打印首页重新选择。</p>
            <div className="btn-row">
              <a className="btn" href="#/print">返回打印首页</a>
            </div>
          </div>
        </div>
      </main>
    );
  }
  if (paper) return <FullPaper paper={paper} />;
  return <PrintIndex />;
}

function PrintIndex() {
  return (
    <main className="sheet print-index">
      <header className="print-index-head">
        <div className="paper-print-kicker">普通高中学业水平合格性考试 · 信息技术</div>
        <h1>{EXAM_NAME}</h1>
        <p>选择一份完整试卷。学生卷与参考答案、解析分开排版，打印时请按需要选择页面。</p>
      </header>
      <section className="print-picker" aria-label="试卷打印列表">
        {[...PAPERS].reverse().map((paper) => (
          <a className="print-picker-card" href={`#/print/${paper.id}`} key={paper.id}>
            <span className="print-picker-no">{paper.name.replace('模拟试卷', '').replace(/[（）]/g, '')}</span>
            <span className="print-picker-main">
              <strong>{paper.name}</strong>
              <small>基础理论 40 分 · 操作技能 60 分 · 70 分钟</small>
            </span>
            <span className="print-picker-action">打印完整试卷</span>
          </a>
        ))}
        <a className="print-picker-card print-picker-card--knowledge" href="#/print/knowledge">
          <span className="print-picker-no">知</span>
          <span className="print-picker-main">
            <strong>信息技术知识点汇总</strong>
            <small>核心概念 · 复习要点 · 易错点 · 示例</small>
          </span>
          <span className="print-picker-action">打印知识点</span>
        </a>
      </section>
    </main>
  );
}

function PrintToolbar({ title }: { title: string }) {
  return (
    <header className="print-toolbar">
      <div>
        <strong>{title}</strong>
        <span>A4 打印预览</span>
      </div>
      <div className="btn-row">
        <a className="btn btn--sm" href="#/print">全部试卷</a>
        <button className="btn btn--sm btn--primary" type="button" onClick={() => window.print()}>
          打印
        </button>
      </div>
    </header>
  );
}

function FullPaper({ paper }: { paper: Paper }) {
  let next = 1;
  const sections = paper.sections.map((section) => ({
    ...section,
    numbered: section.questions.map((question) => ({ question, number: next++ })),
  }));
  const theory = paper.sections
    .filter((section) => section.kind === 'theory')
    .flatMap((section) => section.questions)
    .filter((question): question is SingleChoice => question.type === 'single');

  return (
    <main className="sheet print-shell">
      <PrintToolbar title={`${paper.name} · 完整试卷`} />
      <article className="print-document theory-document" aria-label={`${paper.name}学生卷`}>
        <header className="paper-print-head">
          <div className="paper-print-kicker">{EXAM_NAME}</div>
          <h1>{EXAM_NAME}</h1>
          <p className="paper-print-subtitle">{paper.name} · 信息技术</p>
          <div className="paper-identification">
            <span>班级：<i /></span>
            <span>姓名：<i /></span>
            <span>考号：<i /></span>
          </div>
          <div className="paper-instructions">
            <strong>基础理论 40 分 · 操作技能 60 分</strong>
            <span>满分 100 分，考试时间 {paper.minutes} 分钟。</span>
          </div>
        </header>

        {sections.map((section) => (
          <section className="print-part" key={section.id}>
            <header className="print-part-head">
              <h2>{section.name}</h2>
              <p>{section.instruction}</p>
            </header>
            <div className="print-questions">
              {section.numbered.map(({ question, number }) => (
                <StudentQuestion key={question.id} question={question} number={number} />
              ))}
            </div>
          </section>
        ))}
      </article>

      <article className="print-document answer-document" aria-label={`${paper.name}参考答案与解析`}>
        <header className="answer-document-head">
          <div className="paper-print-kicker">{EXAM_NAME}</div>
          <h1>{paper.name} · 参考答案与解析</h1>
          <p>本部分供教师核对与讲评，学生用卷请勿提前发放。</p>
        </header>
        <TheoryAnswers paper={paper} questions={theory} />
        <OperationAnswers sections={sections} />
      </article>
    </main>
  );
}

function StudentQuestion({ question, number }: { question: Question; number: number }) {
  if (question.type === 'single') return <PrintQuestion question={question} number={number} />;
  if (question.type === 'python') return <PrintPython question={question} number={number} />;
  if (question.type === 'sheet') return <PrintSheet question={question} number={number} />;
  return <PrintIp question={question} number={number} />;
}

function PrintQuestion({ question, number }: { question: SingleChoice; number: number }) {
  return (
    <section className="print-question">
      <PrintHeading number={number} score={question.score} kind="单项选择题" />
      <p className="print-stem"><RichStem text={question.stem} /></p>
      <ol className="print-options">
        {question.options.map((option, index) => (
          <li key={index}>
            <span className="print-option"><span><b>{String.fromCharCode(65 + index)}.</b> {option}</span></span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PrintPython({ question, number }: { question: PythonTask; number: number }) {
  const blanks = question.blanks ?? [];
  return (
    <section className="print-question print-operation">
      <PrintHeading number={number} score={question.score} kind="程序设计" />
      <p className="print-stem"><RichStem text={question.stem} /></p>
      {question.program ? <CodeEditor code={question.program} title="题目程序" /> : null}
      {question.requirements?.length ? (
        <ol className="print-step-list">
          {question.requirements.map((item, index) => <li key={index}>{item}</li>)}
        </ol>
      ) : null}
      <PrintAssets assets={question.assets ?? []} />
      {blanks.length ? (
        <div className="print-blanks">
          {blanks.map((blank) => (
            <div className="print-blank" key={blank.label}>
              <span>{blank.label}</span>
              <i style={{ minHeight: `${Math.max(1, blank.answer.split('\n').length) * 7}mm` }} />
            </div>
          ))}
        </div>
      ) : (
        <PrintWritingArea title="程序编写" lines={8} />
      )}
      <PrintShotBox title={blanks.length ? '需要时附运行结果截图' : '程序与运行结果截图'} />
    </section>
  );
}

function PrintSheet({ question, number }: { question: SheetTask; number: number }) {
  return (
    <section className="print-question print-operation">
      <PrintHeading number={number} score={question.score} kind="电子表格操作" />
      <p className="print-stem"><RichStem text={question.stem} /></p>
      <ol className="print-step-list">
        {question.steps.map((step, index) => <li key={index}>{step}</li>)}
      </ol>
      <PrintAssets assets={question.assets} />
      <SheetDiagram question={question} />
      <PrintShotBox title="操作结果截图" />
    </section>
  );
}

function PrintIp({ question, number }: { question: IpTask; number: number }) {
  return (
    <section className="print-question print-operation">
      <PrintHeading number={number} score={question.score} kind="网络参数设置" />
      <p className="print-stem"><RichStem text={question.stem} /></p>
      <div className="print-table-wrap">
        <table className="print-ip-table">
          <thead>
            <tr><th>计算机</th><th>IP 地址</th><th>子网掩码</th><th>默认网关</th><th>DNS 服务器</th></tr>
          </thead>
          <tbody>
            {question.given.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td><td>{row.ip}</td><td>{row.mask}</td><td>{row.gateway}</td><td>{row.dns}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="print-fields">
        {question.fields.map((field) => (
          <div className="print-field" key={field.key}><span>{field.label}</span><i /></div>
        ))}
      </div>
    </section>
  );
}

function PrintHeading({ number, score, kind }: { number: number; score: number; kind: string }) {
  return (
    <h2 className="print-question-head">
      <span>{number}.</span>
      <span className="print-question-kind">{kind}</span>
      <span className="print-question-score">（{score} 分）</span>
    </h2>
  );
}

function PrintAssets({ assets }: { assets: { file: string; label: string; note?: string }[] }) {
  if (!assets.length) return null;
  return (
    <div className="print-assets">
      {assets.map((asset) => (
        <div className="print-asset" key={asset.file}>
          <strong>{asset.label}</strong>
          {asset.note ? <span>{asset.note}</span> : null}
        </div>
      ))}
    </div>
  );
}

function SheetDiagram({ question }: { question: SheetTask }) {
  const preview = SHEET_PREVIEWS[question.id];
  if (!preview) return null;
  return (
    <figure className="print-sheet-preview">
      <figcaption>素材表格预览 {preview.title ? `· ${preview.title}` : ''}</figcaption>
      <div className="print-table-wrap">
        <table className="sheet-grid" aria-label={`${question.assets[0]?.label ?? '表格'}预览`}>
          <thead>
            <tr>
              <th className="sheet-corner" aria-hidden="true" />
              {preview.columns.map((column) => <th key={column}>{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row, rowIndex) => (
              <tr key={row.number}>
                <th className="sheet-row-head" scope="row">{row.number}</th>
                {row.cells.map((cell, cellIndex) => rowIndex === 0 ? (
                  <th key={cellIndex}>{cell}</th>
                ) : (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

function PrintWritingArea({ title, lines }: { title: string; lines: number }) {
  return (
    <div className="print-writing-area">
      <strong>{title}</strong>
      {Array.from({ length: lines }, (_, index) => <i key={index} />)}
    </div>
  );
}

function PrintShotBox({ title }: { title: string }) {
  return <div className="print-shot-box"><span>{title}粘贴处</span></div>;
}

function TheoryAnswers({ paper, questions }: { paper: Paper; questions: SingleChoice[] }) {
  return (
    <section className="answer-sheet theory-answers">
      <header>
        <div className="paper-print-kicker">{paper.name}</div>
        <h2>基础理论参考答案</h2>
      </header>
      <table>
        <thead><tr><th scope="col">题号</th><th scope="col">选项</th><th scope="col">对应知识点</th></tr></thead>
        <tbody>
          {questions.map((question, index) => (
            <tr key={question.id}>
              <td>{index + 1}</td>
              <td>{String.fromCharCode(65 + question.answer)}</td>
              <td>{question.topic || '综合知识'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function OperationAnswers({ sections }: { sections: (Section & { numbered: { question: Question; number: number }[] })[] }) {
  return (
    <section className="operation-answers">
      <header className="operation-answers-head">
        <div className="paper-print-kicker">操作技能</div>
        <h2>操作题参考答案与解析</h2>
      </header>
      {sections.filter((section) => section.kind === 'practice').flatMap((section) =>
        section.numbered.map(({ question, number }) => (
          <AnswerOperation key={question.id} question={question} number={number} />
        ))
      )}
    </section>
  );
}

function AnswerOperation({ question, number }: { question: Question; number: number }) {
  if (question.type === 'single') return null;
  return (
    <section className="answer-operation">
      <header>
        <h3>{number}. {question.type === 'python' ? '程序设计' : question.type === 'sheet' ? '电子表格操作' : '网络参数设置'}</h3>
        <span>{question.score} 分{question.topic ? ` · ${question.topic}` : ''}</span>
      </header>
      {question.type === 'python' ? <PythonAnswer question={question} /> : null}
      {question.type === 'sheet' ? <SheetAnswer question={question} /> : null}
      {question.type === 'ip' ? <IpAnswer question={question} /> : null}
      <p className="answer-explain"><strong>答题解析：</strong>{question.explain}</p>
    </section>
  );
}

function PythonAnswer({ question }: { question: PythonTask }) {
  const blanks = question.blanks ?? [];
  const code = question.answer || question.program || '';
  return (
    <>
      {code ? <CodeEditor code={code} title="Python 3 · 参考程序" /> : null}
      {blanks.length ? (
        <table className="answer-blanks">
          <thead><tr><th>空</th><th>参考答案</th><th>分值</th></tr></thead>
          <tbody>
            {blanks.map((blank) => (
              <tr key={blank.label}><td>{blank.label}</td><td><code>{blank.answer}</code></td><td>{blank.score}</td></tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {question.demo?.length ? (
        <div className="answer-demo">
          <strong>运行示例</strong>
          {question.demo.map((demo, index) => (
            <div className="answer-demo-case" key={index}>
              <span>输入</span><code>{demo.stdin}</code>
              <span>输出</span><pre>{demo.expect}</pre>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function SheetAnswer({ question }: { question: SheetTask }) {
  return (
    <div className="answer-sheet-result">
      <strong>核对结果</strong>
      <p>{question.expected || '按操作步骤完成，表格画面应与素材数据和公式结果一致。'}</p>
    </div>
  );
}

function IpAnswer({ question }: { question: IpTask }) {
  return (
    <table className="answer-blanks answer-ip">
      <thead><tr><th>参数</th><th>参考答案</th><th>分值</th></tr></thead>
      <tbody>
        {question.answers.map((answer) => (
          <tr key={answer.key}>
            <td>{question.fields.find((field) => field.key === answer.key)?.label ?? answer.key}</td>
            <td><code>{answer.value}</code></td>
            <td>{answer.score}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CodeEditor({ code, title }: { code: string; title: string }) {
  const clean = code.replace(/^(?:\r?\n)+/, '').replace(/(?:\r?\n)+$/, '');
  const lines = clean.split(/\r?\n/);
  return (
    <figure className="print-editor">
      <figcaption className="print-editor-bar">
        <span className="print-editor-dots" aria-hidden="true"><i /><i /><i /></span>
        <span>{title}</span>
        <span className="print-editor-env">Python 3</span>
      </figcaption>
      <pre>
        {lines.map((line, index) => (
          <span className="print-code-line" key={index}>
            <span className="print-line-no">{index + 1}</span>
            <code>{highlightPython(line) || ' '}</code>
          </span>
        ))}
      </pre>
    </figure>
  );
}

function highlightPython(line: string) {
  const pattern = /(#.*$)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\b(False|None|True|and|as|break|continue|def|elif|else|for|from|if|import|in|is|not|or|pass|return|while)\b|\b(\d+(?:\.\d+)?)\b/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line))) {
    if (match.index > last) parts.push(line.slice(last, match.index));
    const value = match[0];
    const cls = match[1] ? 'py-comment' : match[2] ? 'py-string' : match[3] ? 'py-keyword' : 'py-number';
    parts.push(<span className={cls} key={`${match.index}-${value}`}>{value}</span>);
    last = match.index + value.length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}

function RichStem({ text }: { text: string }) {
  const clean = (value: string) => value.replace(/^(?:\r?\n)+/, '').replace(/(?:\r?\n)+$/, '');
  return (
    <>
      {text.split('```').map((part, index) =>
        index % 2 === 1 ? (
          <pre className="print-code" key={index}>{clean(part)}</pre>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}

function KnowledgeSummary() {
  return (
    <main className="sheet print-shell">
      <PrintToolbar title="信息技术知识点汇总" />
      <article className="print-document knowledge-document">
        <header className="knowledge-head">
          <div className="paper-print-kicker">{EXAM_NAME}</div>
          <h1>信息技术知识点汇总</h1>
          <p className="knowledge-source">{KNOWLEDGE_SOURCE}</p>
          <p>按核心概念、复习要点和易错点整理，建议在理解基础上结合题目练习。</p>
        </header>
        {KNOWLEDGE_CHAPTERS.map((chapter, index) => (
          <section className="knowledge-chapter" key={chapter.id} aria-labelledby={`chapter-${chapter.id}`}>
            <header className="knowledge-chapter-head">
              <h2 id={`chapter-${chapter.id}`}>{CHAPTER_NUMBERS[index] || String(index + 1)}、{chapter.title}</h2>
              <p>{chapter.summary}</p>
            </header>
            {chapter.blocks.map((block) => <KnowledgeContent key={block.title} block={block} />)}
          </section>
        ))}
      </article>
    </main>
  );
}

function KnowledgeContent({ block }: { block: KnowledgeBlock }) {
  return (
    <section className="knowledge-block">
      <h3>{block.title}</h3>
      <KnowledgeList title="核心概念" items={block.concepts} />
      <KnowledgeList title="复习要点" items={block.points} />
      <KnowledgeList title="易错点" items={block.pitfalls} warning />
      {block.examples?.map((example) => (
        <figure className="knowledge-example" key={example.title}>
          <figcaption>{example.title}</figcaption>
          <pre>{example.code}</pre>
          {example.note ? <p>{example.note}</p> : null}
        </figure>
      ))}
      {block.table ? (
        <div className="knowledge-table-wrap">
          <table>
            <thead><tr>{block.table.headers.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead>
            <tbody>{block.table.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function KnowledgeList({ title, items, warning = false }: { title: string; items: string[]; warning?: boolean }) {
  return (
    <div className={warning ? 'knowledge-points knowledge-points--warning' : 'knowledge-points'}>
      <h4>{title}</h4>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </div>
  );
}
