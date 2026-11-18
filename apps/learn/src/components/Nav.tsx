import { useEffect, useState } from 'react';
import { COURSEWARE, neighbors, shortTitle } from '../lib/courseware';
import { hashFor, studentHref, type Sec } from '../lib/store';
import type { Lesson } from '../lib/types';

/** 全站导航：公开区任何一个页面都能到任何一个页面。私密区不放入口（只走直达链接）。 */
export function LessonNav({ sec, lesson }: { sec: Sec; lesson: Lesson | null }) {
  const [open, setOpen] = useState(false);
  const { prev, next } = neighbors(lesson?.id);

  // 换页面就把抽屉收掉:不然从抽屉点进某一课后,它还张着挡下面的内容。
  useEffect(() => {
    setOpen(false);
  }, [sec, lesson?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <nav className={'lnav' + (open ? ' is-open' : '')}>
      <a className={'lnav__home' + (sec === 'catalog' ? ' is-on' : '')} href={hashFor('catalog')}>
        章节目录
      </a>

      <div className="lnav__pick">
        <button type="button" className={'lnav__btn' + (open ? ' is-on' : '')} aria-expanded={open} onClick={() => setOpen(!open)}>
          全部课件 <span className="lnav__n">{lesson ? shortTitle(lesson) : COURSEWARE.chapters.length + ' 章'}</span> ▾
        </button>
        {open ? (
          <>
            <div className="lnav__mask" onClick={() => setOpen(false)} />
            <div className="lnav__pop">
              {COURSEWARE.chapters.map((c) => (
                <div key={c.id} className={'lnav__ch' + (c.lessons.length ? '' : ' is-empty')}>
                  <p className="lnav__chT">
                    {c.no} · {c.title}
                    {c.lessons.length ? null : <span className="lnav__none">未备课件</span>}
                  </p>
                  {c.lessons.map((l) => (
                    <div key={l.id} className={'lnav__row' + (l.id === lesson?.id ? ' is-here' : '')}>
                      <span className="lnav__rowT">{l.title}</span>
                      <span className="lnav__rowG">
                        <a href={hashFor('course', l.id)} title="给老师看的那一页：教案、板书、图解都在">
                          课件
                        </a>
                        <a href={studentHref(l.id)} target="_blank" rel="noopener" title="只剩图和能自己拖的那一张页，是另建的网页，链接可以直接发给学生">
                          学生版
                        </a>
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>

      {lesson ? (
        <>
          <a className="lnav__out" href={studentHref(lesson.id)} target="_blank" rel="noopener" title="打开学生手里那一张：只剩图和能自己拖的参数">
            学生版 <span className="lnav__outX">↗</span>
          </a>
          <div className="lnav__step">
            {prev ? <a href={hashFor('course', prev.id)}>‹ {shortTitle(prev)}</a> : <span className="is-off">‹ 已是第一课</span>}
            {next ? <a href={hashFor('course', next.id)}>{shortTitle(next)} ›</a> : <span className="is-off">最后一课 ›</span>}
          </div>
        </>
      ) : null}
    </nav>
  );
}

/** 页面底部那一条:读到一半想跳去别处,不用滚回顶上。 */
export function PageFoot({ lesson }: { lesson: Lesson | null }) {
  const { prev, next } = neighbors(lesson?.id);
  return (
    <div className="lfoot">
      <a className="btn btn--ghost" href={hashFor('catalog')}>
        章节目录
      </a>
      {lesson ? (
        <>
          <a className="btn btn--ghost" href={studentHref(lesson.id)} target="_blank" rel="noopener">
            学生版 ↗
          </a>
          {prev ? <a className="btn btn--ghost" href={hashFor('course', prev.id)}>‹ {shortTitle(prev)}</a> : null}
          {next ? <a className="btn btn--ghost" href={hashFor('course', next.id)}>{shortTitle(next)} ›</a> : null}
        </>
      ) : null}
    </div>
  );
}
