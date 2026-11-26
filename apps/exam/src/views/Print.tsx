import {
  KNOWLEDGE_CHAPTERS,
  KNOWLEDGE_SOURCE,
  type KnowledgeBlock,
} from '../data/knowledge';
import type { Paper, SingleChoice } from '../lib/types';

type Props = {
  paper: Paper | null;
  paperId: string;
};

const CHAPTER_NUMBERS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

export default function PrintView({ paper, paperId }: Props) {
  if (paperId && !paper) {
    return (
      <main className="sheet print-shell">
        <PrintToolbar title="打印理论卷" />
        <div className="page print-error" role="alert">
          <div className="section-pad">
            <h2>未找到理论卷</h2>
            <p>
              试卷编号「{paperId}」不存在或尚未接入，请返回考卷列表重新选择。
            </p>
            <div className="btn-row">
              <a className="btn" href="#/list">
                返回考卷列表
              </a>
              <a className="btn" href="#/print">
                查看知识点汇总
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return paper ? <TheoryPaper paper={paper} /> : <KnowledgeSummary />;
}

function PrintToolbar({ title }: { title: string }) {
  return (
    <header className="print-toolbar">
      <div>
        <strong>{title}</strong>
        <span>A4 打印预览</span>
      </div>
      <div className="btn-row">
        <a className="btn btn--sm" href="#/list">
          返回
        </a>
        <button className="btn btn--sm btn--primary" type="button" onClick={() => window.print()}>
          打印
        </button>
      </div>
    </header>
  );
}

function TheoryPaper({ paper }: { paper: Paper }) {
  const theoryQuestions = paper.sections
    .filter((section) => section.kind === 'theory')
    .flatMap((section) => section.questions);
  const hasUnsupportedTheoryQuestions = theoryQuestions.some((question) => question.type !== 'single');
  const questions = theoryQuestions.filter(
    (question): question is SingleChoice => question.type === 'single'
  );

  return (
    <main className="sheet print-shell">
      <PrintToolbar title={`${paper.name} · 理论卷`} />
      {hasUnsupportedTheoryQuestions && (
        <div className="page print-error" role="alert">
          <div className="section-pad">
            <h2>该卷含不支持打印的理论题型</h2>
            <p>
              打印页仅支持单选题，下面仍会完整展示所有单选题；请返回考卷列表核对其他理论题。
            </p>
            <div className="btn-row">
              <a className="btn" href="#/list">
                返回考卷列表
              </a>
            </div>
          </div>
        </div>
      )}
      <article className="print-document theory-document" aria-label={`${paper.name}信息技术理论卷`}>
        <header className="paper-print-head">
          <div className="paper-print-kicker">普通高中学业水平合格性考试</div>
          <h1>{paper.name} · 信息技术理论卷</h1>
          <div className="paper-identification">
            <span>班级：<i /></span>
            <span>姓名：<i /></span>
            <span>考号：<i /></span>
          </div>
          <div className="paper-instructions">
            <strong>第一部分　基础理论</strong>
            <span>共 {questions.length} 题，每题只有一个正确答案。</span>
          </div>
        </header>

        <div className="print-questions">
          {questions.map((question, index) => (
            <PrintQuestion key={question.id} question={question} number={index + 1} />
          ))}
        </div>

        <AnswerSheet paper={paper} questions={questions} />
      </article>
    </main>
  );
}

function PrintQuestion({ question, number }: { question: SingleChoice; number: number }) {
  return (
    <section className="print-question">
      <h2>
        <span>{number}.</span>
        <span className="print-question-score">（{question.score} 分）</span>
      </h2>
      <p className="print-stem">
        <RichStem text={question.stem} />
      </p>
      <ol className="print-options">
        {question.options.map((option, index) => (
          <li key={index}>
            <span className="print-option">
              <span>
                <b>{String.fromCharCode(65 + index)}.</b> {option}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function RichStem({ text }: { text: string }) {
  const clean = (value: string) => value.replace(/^(?:\r?\n)+/, '').replace(/(?:\r?\n)+$/, '');
  return (
    <>
      {text.split('```').map((part, index) =>
        index % 2 === 1 ? (
          <pre className="print-code" key={index}>
            {clean(part)}
          </pre>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}

function AnswerSheet({ paper, questions }: { paper: Paper; questions: SingleChoice[] }) {
  return (
    <section className="answer-sheet" aria-labelledby="answer-title">
      <header>
        <div className="paper-print-kicker">{paper.name}</div>
        <h2 id="answer-title">参考答案</h2>
        <p>本页仅供核对，学生用卷请勿提前发放。</p>
      </header>
      <table>
        <thead>
          <tr>
            <th scope="col">题号</th>
            <th scope="col">选项</th>
            <th scope="col">对应知识点</th>
          </tr>
        </thead>
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

function KnowledgeSummary() {
  return (
    <main className="sheet print-shell">
      <PrintToolbar title="信息技术知识点汇总" />
      <article className="print-document knowledge-document">
        <header className="knowledge-head">
          <div className="paper-print-kicker">高中信息技术 · 合格考复习</div>
          <h1>信息技术知识点汇总</h1>
          <p className="knowledge-source">{KNOWLEDGE_SOURCE}</p>
          <p>按核心概念、复习要点和易错点整理，建议在理解基础上结合题目练习。</p>
        </header>

        {KNOWLEDGE_CHAPTERS.map((chapter, index) => (
          <section className="knowledge-chapter" key={chapter.id} aria-labelledby={`chapter-${chapter.id}`}>
            <header className="knowledge-chapter-head">
              <h2 id={`chapter-${chapter.id}`}>
                {CHAPTER_NUMBERS[index] || String(index + 1)}、{chapter.title}
              </h2>
              <p>{chapter.summary}</p>
            </header>
            {chapter.blocks.map((block) => (
              <KnowledgeContent key={block.title} block={block} />
            ))}
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
            <thead>
              <tr>
                {block.table.headers.map((header) => (
                  <th scope="col" key={header}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.table.rows.map((row, index) => (
                <tr key={index}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
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
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
