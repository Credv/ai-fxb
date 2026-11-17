import { useEffect, useState } from 'react';

interface SecItem {
  id: string;
  label: string;
}

/**
 * 这一页的小节导航:宽屏贴在正文右边,窄屏收成导航条下面的一排。
 * 条目从 DOM 里的 [data-sec] 现取,所以改标题、加图块都不用再维护第二份名单。
 */
export function SectionRail({ pageId }: { pageId: string }) {
  const [secs, setSecs] = useState<SecItem[]>([]);
  const [here, setHere] = useState('');

  useEffect(() => {
    const root = document.getElementById(pageId);
    if (!root) {
      setSecs([]);
      return;
    }
    const list: SecItem[] = [];
    root.querySelectorAll<HTMLElement>('[data-sec]').forEach((el, i) => {
      el.id = pageId + '-sec-' + i;
      list.push({ id: el.id, label: el.dataset.sec || '' });
    });
    setSecs(list);

    let busy = false;
    const sync = () => {
      busy = false;
      let cur = list.length ? list[0].id : '';
      for (const s of list) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= 130) cur = s.id;
      }
      setHere(cur);
    };
    const onScroll = () => {
      if (busy) return;
      busy = true;
      requestAnimationFrame(sync);
    };
    sync();
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, [pageId]);

  if (secs.length < 3) return null;

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setHere(id);
  };
  const item = (s: SecItem) => (
    <button key={s.id} type="button" className={'rnav__i' + (here === s.id ? ' is-on' : '')} onClick={() => jump(s.id)}>
      {s.label}
    </button>
  );

  return (
    <>
      <nav className="rnav rnav--side" aria-label="这一页的小节">
        <p className="rnav__t">这一页</p>
        {secs.map(item)}
      </nav>
      <nav className="rnav rnav--strip" aria-label="这一页的小节">
        {secs.map(item)}
      </nav>
    </>
  );
}

/** 长页滚到底想回头看一眼开头,不用手动拖。 */
export function BackToTop() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(scrollY > 520);
    sync();
    addEventListener('scroll', sync, { passive: true });
    return () => removeEventListener('scroll', sync);
  }, []);
  if (!on) return null;
  return (
    <button type="button" className="totop" onClick={() => scrollTo({ top: 0, behavior: 'smooth' })}>
      ↑ 回顶部
    </button>
  );
}
