/*
 * The teammate directory's browser side. Every feature here already works without it as a plain
 * link; this adds what a modern marketplace is expected to do in place: instant name search,
 * menus that behave like menus (one open, Escape, arrow keys), the quick view panel, "Help me
 * choose", saving a teammate, booking with the save first, and "Show more" without a reload.
 * Text from the server always goes in through textContent, never as HTML.
 */

/* Everything in init runs once per directory view. Switching game, filter or sort swaps the
   view in place (see the bottom of the file), so init runs again on the new markup and the
   signal drops what the old view hung on the document. */

type QuizCard = {
  slug: string;
  name: string;
  avatar: string;
  game: string;
  games: string[];
  languages: string[];
  vibes: string[];
  coaching: boolean;
  gamerGirl?: boolean;
  online: boolean;
  rank: string | null;
  rating: { average: number; count: number } | null;
  tier: string;
};
type QuizData = {
  games: { id: string; name: string; img: string }[];
  languages: string[];
  cards: QuizCard[];
};

/** A picture that fails to load hides itself, so the round backing shows instead of a broken icon. */
function quietOnError(img: HTMLImageElement) {
  img.addEventListener('error', () => (img.style.visibility = 'hidden'), {
    once: true,
  });
  return img;
}
/** Uploaded photos are square crops; the preset mascots are drawn as they are. */
const isPhoto = (src: string) => !src.startsWith('/assets/avatars/');

/** Build an element with a class and optional text, safely. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function init(root: HTMLElement, signal: AbortSignal) {
  const mode = root.dataset.saveMode ?? 'none';
  const csrf = root.dataset.csrf ?? '';

  /* ---------- menus ---------- */
  const menus = [...root.querySelectorAll<HTMLDetailsElement>('[data-menu]')];
  const options = (menu: HTMLDetailsElement) => [
    ...menu.querySelectorAll<HTMLAnchorElement>('.md-popover a'),
  ];
  for (const menu of menus) {
    menu.addEventListener('toggle', () => {
      if (!menu.open) return;
      for (const other of menus) if (other !== menu) other.open = false;
    });
    menu.addEventListener('keydown', (event) => {
      const list = options(menu);
      const at = list.indexOf(document.activeElement as HTMLAnchorElement);
      if (event.key === 'Escape' && menu.open) {
        menu.open = false;
        menu.querySelector('summary')?.focus();
        return;
      }
      if (!list.length) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!menu.open) menu.open = true;
        const next =
          at < 0
            ? event.key === 'ArrowDown'
              ? 0
              : list.length - 1
            : (at + (event.key === 'ArrowDown' ? 1 : -1) + list.length) %
              list.length;
        list[next]?.focus();
      } else if (event.key === 'Home' && menu.open) {
        event.preventDefault();
        list[0]?.focus();
      } else if (event.key === 'End' && menu.open) {
        event.preventDefault();
        list[list.length - 1]?.focus();
      }
    });
  }
  document.addEventListener(
    'click',
    (event) => {
      for (const menu of menus)
        if (menu.open && !menu.contains(event.target as Node))
          menu.open = false;
    },
    { signal },
  );

  /* The current game tile starts in view. */
  const track = root.querySelector<HTMLElement>('.md-games-track');
  const current = track?.querySelector<HTMLElement>('.md-tile.is-current');
  if (track && current && current.offsetLeft > track.clientWidth / 2)
    track.scrollLeft =
      current.offsetLeft - track.clientWidth / 2 + current.offsetWidth / 2;

  /* The strip hides its scrollbar, so a mouse without a sideways wheel needs the arrows. Each
     arrow shows only while there is more strip that way, and pages by most of a screen. */
  const prev = root.querySelector<HTMLButtonElement>('[data-games-prev]');
  const next = root.querySelector<HTMLButtonElement>('[data-games-next]');
  if (track && prev && next) {
    const games = track.parentElement!;
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      const atStart = track.scrollLeft <= 2;
      const atEnd = track.scrollLeft >= max - 2;
      prev.hidden = atStart;
      next.hidden = max <= 2 || atEnd;
      games.classList.toggle('has-before', !atStart);
      games.classList.toggle('has-after', max > 2 && !atEnd);
    };
    const page = (dir: 1 | -1) =>
      track.scrollBy({
        left: dir * track.clientWidth * 0.8,
        behavior: 'smooth',
      });
    prev.addEventListener('click', () => page(-1));
    next.addEventListener('click', () => page(1));
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { signal });
    update();
  }

  /* The search bar casts a shadow once it sticks under the header. */
  const sticky = root.querySelector<HTMLElement>('[data-sticky]');
  if (sticky && 'IntersectionObserver' in window) {
    const marker = document.createElement('div');
    marker.setAttribute('aria-hidden', 'true');
    sticky.before(marker);
    const observer = new IntersectionObserver(
      ([entry]) => sticky.classList.toggle('is-stuck', !entry!.isIntersecting),
      { rootMargin: '-80px 0px 0px 0px' },
    );
    observer.observe(marker);
    signal.addEventListener('abort', () => observer.disconnect());
  }

  /* ---------- results: instant search and show more ---------- */
  const grid = root.querySelector<HTMLElement>('[data-grid]');
  const cards = grid
    ? [...grid.querySelectorAll<HTMLElement>('[data-card]')]
    : [];
  const count = root.querySelector<HTMLElement>('[data-result-count]');
  const empty = root.querySelector<HTMLElement>('[data-search-empty]');
  const more = root.querySelector<HTMLAnchorElement>('[data-more]');
  const input = root.querySelector<HTMLInputElement>('[data-q]');
  /* Cards past the first page carry .is-extra, which is also what hides them without the
     script. Searching or "Show more" lifts it; clearing the search puts it back. */
  const extras = cards.filter((card) => card.classList.contains('is-extra'));
  let expanded = false;
  const filterByName = () => {
    const q = (input?.value ?? '').trim().toLowerCase();
    let shown = 0;
    for (const card of extras)
      card.classList.toggle('is-extra', !expanded && !q);
    for (const card of cards) {
      const match = !q || (card.dataset.name ?? '').includes(q);
      card.hidden = !match;
      if (match) shown += 1;
    }
    if (count) count.textContent = String(shown);
    if (empty) empty.hidden = shown > 0 || !cards.length;
    if (more) more.parentElement!.hidden = expanded || Boolean(q);
  };
  input?.addEventListener('input', filterByName);
  more?.addEventListener('click', (event) => {
    event.preventDefault();
    expanded = true;
    filterByName();
  });

  /* ---------- saving and booking ---------- */
  const resume = (slug: string) => {
    document.cookie = `duoly_resume=profile-save:${slug}; Max-Age=1800; Path=/; SameSite=Lax; Secure`;
  };
  const remember = (slug: string) => {
    document.cookie = `duoly_pending_favorite=${slug}; Max-Age=7200; Path=/; SameSite=Lax; Secure`;
  };
  const save = async (slug: string) => {
    try {
      const response = await fetch('/api/favorites/by-slug', {
        method: 'POST',
        credentials: 'same-origin',
        redirect: 'error',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csrf, slug }),
      });
      return response.ok;
    } catch {
      return false;
    }
  };
  const markSaved = (slug: string) => {
    for (const button of root.querySelectorAll<HTMLButtonElement>(
      `[data-card][data-slug="${CSS.escape(slug)}"] [data-dc-save]`,
    )) {
      button.setAttribute('aria-pressed', 'true');
      const name = button
        .closest<HTMLElement>('[data-card]')
        ?.querySelector('.tp-card-name')?.textContent;
      if (name) button.setAttribute('aria-label', `${name} is saved`);
    }
  };
  root.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;
    const card = target.closest<HTMLElement>('[data-card]');
    const slug = card?.dataset.slug ?? '';
    const saveButton = target.closest<HTMLButtonElement>('[data-dc-save]');
    if (saveButton && slug) {
      if (saveButton.getAttribute('aria-pressed') === 'true') return;
      saveButton.disabled = true;
      if (await save(slug)) markSaved(slug);
      saveButton.disabled = false;
      return;
    }
    if (target.closest('[data-dc-signin]') && slug) {
      resume(slug);
      return;
    }
    const book = target.closest<HTMLAnchorElement>(
      '[data-dc-book], [data-peek-book]',
    );
    const bookSlug = book?.dataset.slug || slug;
    if (book && bookSlug) {
      const plain =
        event instanceof MouseEvent &&
        event.button === 0 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey;
      if (!plain) return;
      if (mode === 'customer') {
        /* Booking wins over saving: whichever finishes first, the browser moves on. */
        event.preventDefault();
        const href = book.href;
        let left = false;
        const go = () => {
          if (left) return;
          left = true;
          location.href = href;
        };
        window.setTimeout(go, 1200);
        save(bookSlug).then(go, go);
      } else if (mode === 'signin') remember(bookSlug);
    }
  });

  /* ---------- panels ---------- */
  /* While a panel is open the page behind it does not scroll, so there is one scrollbar, the
     panel's own. */
  const openPanel = (dialog: HTMLDialogElement) => {
    document.documentElement.classList.add('md-locked');
    dialog.querySelector<HTMLElement>('.md-panel-scroll')?.scrollTo(0, 0);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  };
  for (const dialog of root.querySelectorAll<HTMLDialogElement>('dialog')) {
    dialog.addEventListener('close', () => {
      if (!root.querySelector('dialog[open]'))
        document.documentElement.classList.remove('md-locked');
    });
    dialog
      .querySelector('[data-panel-close]')
      ?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  /* ---------- quick view ---------- */
  const peek = root.querySelector<HTMLDialogElement>('[data-peek]');
  const peekBody = peek?.querySelector<HTMLElement>('[data-peek-body]');
  const peekFoot = peek?.querySelector<HTMLElement>('[data-peek-foot]');
  const skeleton = peekBody?.innerHTML ?? '';
  type Preview = {
    slug: string;
    name: string;
    avatar: string;
    photo: boolean;
    header: string | null;
    tier: string | null;
    online: boolean;
    gamerGirl?: boolean;
    bio: string;
    vibeTags: string[];
    languages: string[];
    country: string | null;
    memberSince: string;
    games: {
      name: string;
      img: string;
      rank: string | null;
      peak: string | null;
      roles: string[];
    }[];
    rating: { average: number; count: number } | null;
    sessions: number | null;
    winRate: { percent: number; games: number } | null;
    reviews: { rating: number; text: string; game: string; month: string }[];
    price: { display: string; unit: string } | null;
    book: string;
    profile: string;
    gameName: string;
  };
  const renderPreview = (p: Preview) => {
    const wrap = el('div', 'md-peek-inner');
    const head = el('div', 'md-peek-head');
    if (p.header) {
      const art = el('img', 'md-peek-art');
      art.src = p.header;
      art.alt = '';
      head.append(art);
    }
    const face = quietOnError(
      el('img', `md-peek-face${p.photo ? ' is-photo' : ''}`),
    );
    face.src = p.avatar;
    face.alt = '';
    const id = el('div', 'md-peek-id');
    const name = el('h2', '', p.name);
    name.id = 'md-peek-name';
    const meta = el('p', 'md-peek-meta');
    if (p.gamerGirl)
      meta.append(el('span', 'tp-gg-badge', 'Verified Gamer Girl'));
    if (p.tier) meta.append(el('span', 'md-peek-tier', p.tier));
    const status = el(
      'span',
      `md-peek-status${p.online ? ' is-online' : ''}`,
      p.online ? 'Online now' : 'Offline',
    );
    meta.append(status);
    if (p.rating)
      meta.append(
        el(
          'span',
          'md-peek-rating',
          `★ ${p.rating.average.toFixed(1)} (${p.rating.count})`,
        ),
      );
    id.append(name, meta);
    head.append(face, id);
    wrap.append(head);
    if (p.bio) wrap.append(el('p', 'md-peek-bio', p.bio));
    if (p.vibeTags.length) {
      const tags = el('div', 'md-peek-tags');
      for (const t of p.vibeTags) tags.append(el('span', 'dc-tag', t));
      wrap.append(tags);
    }
    const games = el('ul', 'md-peek-games');
    for (const g of p.games) {
      const li = el('li');
      const icon = el('img');
      icon.src = g.img;
      icon.alt = '';
      li.append(icon, el('strong', '', g.name));
      li.append(
        el(
          'span',
          g.rank ? 'is-verified' : '',
          g.rank
            ? `${g.rank}${g.peak && g.peak !== g.rank ? ` · peak ${g.peak}` : ''}`
            : 'Rank not verified',
        ),
      );
      if (g.roles.length) li.append(el('small', '', g.roles.join(', ')));
      games.append(li);
    }
    wrap.append(games);
    const facts = el('dl', 'md-peek-facts');
    const fact = (label: string, value: string) => {
      const row = el('div');
      row.append(el('dt', '', label), el('dd', '', value));
      facts.append(row);
    };
    if (p.sessions !== null)
      fact('Sessions', p.sessions.toLocaleString('en-US'));
    if (p.winRate) fact('Win rate', `${p.winRate.percent}%`);
    if (p.languages.length) fact('Speaks', p.languages.join(', '));
    fact('Member since', p.memberSince);
    wrap.append(facts);
    if (p.reviews.length) {
      const reviews = el('div', 'md-peek-reviews');
      for (const r of p.reviews) {
        const q = el('figure');
        q.append(
          el('span', 'md-peek-stars', '★'.repeat(r.rating)),
          el('blockquote', '', r.text),
          el('figcaption', '', `Verified customer, ${r.game}, ${r.month}`),
        );
        reviews.append(q);
      }
      wrap.append(reviews);
    }
    const foot = el('div', 'md-peek-foot');
    if (p.price) {
      const price = el('p', 'dc-price');
      price.append(
        'from ',
        el('strong', '', p.price.display),
        el('span', '', ` per ${p.price.unit}`),
      );
      foot.append(price);
    }
    const actions = el('div', 'md-peek-actions');
    const profile = el('a', 'tp-button tp-ghost', 'Full profile');
    profile.href = p.profile;
    const book = el('a', 'tp-button tp-primary', `Book ${p.name}`);
    book.href = p.book;
    book.dataset.peekBook = '';
    book.dataset.slug = p.slug;
    actions.append(profile, book);
    foot.append(actions);
    return { body: wrap, foot };
  };
  root.addEventListener('click', async (event) => {
    const button = (event.target as HTMLElement).closest('[data-dc-peek]');
    if (!button || !peek || !peekBody) return;
    const slug = button.closest<HTMLElement>('[data-card]')?.dataset.slug;
    if (!slug) return;
    peekBody.innerHTML = skeleton;
    if (peekFoot) {
      peekFoot.hidden = true;
      peekFoot.replaceChildren();
    }
    openPanel(peek);
    try {
      const response = await fetch(
        `/api/teammates/preview?slug=${encodeURIComponent(slug)}`,
      );
      if (!response.ok) throw new Error('preview');
      const data = (await response.json()) as Preview;
      const view = renderPreview(data);
      peekBody.replaceChildren(view.body);
      if (peekFoot) {
        peekFoot.replaceChildren(...view.foot.childNodes);
        peekFoot.hidden = false;
      }
    } catch {
      const fail = el('div', 'md-peek-fail');
      fail.append(el('p', '', 'This profile could not be loaded right now.'));
      const link = el('a', 'tp-button tp-ghost', 'Open the profile');
      link.href = `/teammates/${slug}`;
      fail.append(link);
      peekBody.replaceChildren(fail);
    }
  });

  /* ---------- help me choose ---------- */
  const quiz = root.querySelector<HTMLDialogElement>('[data-quiz]');
  const quizBody = quiz?.querySelector<HTMLElement>('[data-quiz-body]');
  const quizTitle = quiz?.querySelector<HTMLElement>('[data-quiz-title]');
  const steps = quiz ? [...quiz.querySelectorAll('.md-quiz-steps li')] : [];
  const json = root.querySelector('[data-directory-json]')?.textContent;
  const data: QuizData | null = json ? (JSON.parse(json) as QuizData) : null;
  const answers: { goal?: string; game?: string; lang?: string } = {};
  const GOALS = [
    {
      id: 'win',
      title: 'Climb and win',
      note: 'A strong ranked partner who plays to win.',
    },
    {
      id: 'learn',
      title: 'Get better',
      note: 'Someone who explains while you play.',
    },
    {
      id: 'chill',
      title: 'Relax and have fun',
      note: 'Good company, no rank pressure.',
    },
  ];
  const choice = (
    title: string,
    note: string | null,
    onPick: () => void,
    img?: string,
  ) => {
    const b = el('button', 'md-quiz-choice');
    b.type = 'button';
    if (img) {
      const i = el('img');
      i.src = img;
      i.alt = '';
      b.append(i);
    }
    const text = el('span');
    text.append(el('strong', '', title));
    if (note) text.append(el('small', '', note));
    b.append(text);
    b.addEventListener('click', onPick);
    return b;
  };
  const step = (n: number, title: string) => {
    steps.forEach((s, i) => s.classList.toggle('is-on', i <= n));
    if (quizTitle) quizTitle.textContent = title;
  };
  const showGoal = () => {
    if (!quizBody) return;
    step(0, 'What do you want from the session?');
    const list = el('div', 'md-quiz-choices');
    for (const g of GOALS)
      list.append(
        choice(g.title, g.note, () => ((answers.goal = g.id), showGame())),
      );
    quizBody.replaceChildren(list);
  };
  const showGame = () => {
    if (!quizBody || !data) return;
    step(1, 'Which game?');
    const list = el('div', 'md-quiz-choices md-quiz-games');
    list.append(
      choice('Any game', null, () => ((answers.game = ''), showLang())),
    );
    for (const g of data.games)
      list.append(
        choice(g.name, null, () => ((answers.game = g.id), showLang()), g.img),
      );
    quizBody.replaceChildren(list);
  };
  const showLang = () => {
    if (!quizBody || !data) return;
    step(2, 'Which language should they speak?');
    const list = el('div', 'md-quiz-choices md-quiz-langs');
    list.append(
      choice('Any language', null, () => ((answers.lang = ''), showResults())),
    );
    for (const l of data.languages)
      list.append(choice(l, null, () => ((answers.lang = l), showResults())));
    quizBody.replaceChildren(list);
  };
  /** Points per answer, with the reason each point is shown for. */
  const match = (c: QuizCard) => {
    const why: string[] = [];
    let score = 0;
    const has = (v: string) => c.vibes.includes(v);
    if (answers.goal === 'win') {
      if (c.rank) {
        score += 3;
        why.push(`Verified ${c.rank}`);
      }
      for (const v of ['Shotcaller', 'Tryhard', 'Mechanics first'])
        if (has(v)) {
          score += 1.5;
          why.push(v);
        }
    } else if (answers.goal === 'learn') {
      if (c.coaching) {
        score += 3;
        why.push('Also coaches');
      }
      for (const v of ['Teaches as we play', 'Patient', 'Strategy nerd'])
        if (has(v)) {
          score += 1.5;
          why.push(v);
        }
    } else if (answers.goal === 'chill') {
      if (c.gamerGirl) {
        score += 1.5;
        why.push('Gamer Girl');
      }
      for (const v of ['Chill', 'Funny', 'Patient'])
        if (has(v)) {
          score += 2;
          why.push(v);
        }
    }
    if (answers.lang && c.languages.includes(answers.lang)) {
      score += 2;
      why.push(`Speaks ${answers.lang}`);
    }
    if (c.online) {
      score += 1;
      why.push('Online now');
    }
    if (c.rating) score += c.rating.average * 0.4;
    return { card: c, score, why };
  };
  const showResults = () => {
    if (!quizBody || !data) return;
    step(2, 'Your best matches');
    const pool = data.cards.filter(
      (c) =>
        (!answers.game || c.games.includes(answers.game)) &&
        (!answers.lang || c.languages.includes(answers.lang)),
    );
    const ranked = pool
      .map(match)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    const out = el('div', 'md-quiz-results');
    if (!ranked.length) {
      out.append(
        el(
          'p',
          'md-quiz-none',
          'No public teammate fits all three answers yet. Order anyway and a verified teammate takes it from the queue, or loosen an answer.',
        ),
      );
    }
    for (const [i, r] of ranked.entries()) {
      const a = el('a', 'md-quiz-result');
      a.href = `/teammates/${r.card.slug}`;
      a.style.setProperty('--i', String(i));
      const face = quietOnError(
        el('img', isPhoto(r.card.avatar) ? 'is-photo' : ''),
      );
      face.src = r.card.avatar;
      face.alt = '';
      const text = el('span', 'md-quiz-result-text');
      text.append(el('strong', '', r.card.name));
      if (r.card.rating)
        text.append(
          el(
            'small',
            '',
            `★ ${r.card.rating.average.toFixed(1)} from ${r.card.rating.count} reviews`,
          ),
        );
      const why = el('span', 'md-quiz-why');
      for (const w of r.why.slice(0, 4)) why.append(el('span', 'dc-tag', w));
      text.append(why);
      a.append(face, text);
      if (i === 0) a.append(el('span', 'md-quiz-best', 'Best match'));
      out.append(a);
    }
    const again = el('button', 'md-text-link', 'Start over');
    again.type = 'button';
    again.addEventListener('click', showGoal);
    out.append(again);
    quizBody.replaceChildren(out);
  };
  root.querySelector('[data-quiz-open]')?.addEventListener('click', () => {
    if (!quiz) return;
    showGoal();
    openPanel(quiz);
  });
}

/* ---------- switching views in place ----------
   Every game tile, filter, chip and sort is a plain link to another directory URL, and the name
   search is a plain form, so the page works without the script. With it, those don't reload the
   whole page: the new view is fetched and swapped in, the scroll position stays, and the address
   bar and title follow. Back and forward do the same. Anything unexpected (an error, a redirect
   somewhere else, no directory in the answer) falls back to an ordinary page load. */
const isDirectoryPath = (path: string) =>
  /^\/teammates\/?$/.test(path) || /^\/games\/[^/]+\/teammates\/?$/.test(path);

let current = document.querySelector<HTMLElement>('[data-directory]');
let lifetime = new AbortController();
let inflight: AbortController | null = null;

const HEAD_TAGS = [
  'meta[name="description"]',
  'meta[name="robots"]',
  'link[rel="canonical"]',
  'meta[property="og:title"]',
  'meta[property="og:description"]',
  'meta[property="og:url"]',
];
const setHead = (next: Document) => {
  if (next.title) document.title = next.title;
  for (const selector of HEAD_TAGS) {
    const now = document.head.querySelector(selector);
    const then = next.head.querySelector(selector);
    if (now && then) now.replaceWith(document.importNode(then, true));
  }
};

async function show(
  url: URL,
  how: { push: boolean; from?: 'search' | 'link' },
) {
  if (!current) return;
  inflight?.abort();
  const request = new AbortController();
  inflight = request;
  current.classList.add('is-switching');
  current.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch(url.href, {
      credentials: 'same-origin',
      signal: request.signal,
      headers: { Accept: 'text/html' },
    });
    const landed = new URL(response.url || url.href);
    if (
      !response.ok ||
      landed.origin !== location.origin ||
      !isDirectoryPath(landed.pathname)
    )
      throw new Error('not a directory view');
    const next = new DOMParser().parseFromString(
      await response.text(),
      'text/html',
    );
    const fresh = next.querySelector<HTMLElement>('[data-directory]');
    if (!fresh) throw new Error('no directory in the answer');
    if (request.signal.aborted || !current) return;

    if (how.push) {
      const target = new URL(landed.href);
      target.hash = url.hash;
      history.pushState({ directory: true }, '', target.href);
    }
    const y = window.scrollY;
    const trackScroll =
      current.querySelector<HTMLElement>('.md-games-track')?.scrollLeft ?? 0;

    lifetime.abort();
    document.documentElement.classList.remove('md-locked');
    const node = document.importNode(fresh, true);
    current.replaceWith(node);
    current = node;
    setHead(next);
    lifetime = new AbortController();
    init(node, lifetime.signal);

    /* The game strip stays where it was scrolled to rather than jumping. */
    const track = node.querySelector<HTMLElement>('.md-games-track');
    if (track && how.push) track.scrollLeft = trackScroll;
    if (how.push && url.hash)
      node.querySelector(url.hash)?.scrollIntoView({ block: 'start' });
    else if (how.push) window.scrollTo(0, y);

    /* Keep focus where it was: in the search box after a search, or on the same link. */
    if (how.from === 'search') {
      const input = node.querySelector<HTMLInputElement>('[data-q]');
      if (input) {
        input.focus({ preventScroll: true });
        input.setSelectionRange(input.value.length, input.value.length);
      }
    } else if (how.from === 'link') {
      const path = landed.pathname + landed.search;
      const same = [
        ...node.querySelectorAll<HTMLAnchorElement>('a[href]'),
      ].find((a) => a.getAttribute('href') === path);
      same?.focus({ preventScroll: true });
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') return;
    location.href = url.href;
  } finally {
    if (inflight === request) {
      inflight = null;
      current?.classList.remove('is-switching');
      current?.removeAttribute('aria-busy');
    }
  }
}

if (current) {
  init(current, lifetime.signal);
  history.replaceState({ directory: true }, '', location.href);

  document.addEventListener('click', (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>(
      'a[href]',
    );
    if (!link || !current?.contains(link) || link.target || link.download)
      return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || !isDirectoryPath(url.pathname))
      return;
    /* A link to this same view with only a hash is ordinary in-page scrolling. */
    if (url.pathname + url.search === location.pathname + location.search)
      return;
    event.preventDefault();
    void show(url, { push: true, from: 'link' });
  });

  document.addEventListener('submit', (event) => {
    const form = event.target as HTMLFormElement;
    if (!current?.contains(form) || !form.matches('[data-query]')) return;
    const url = new URL(
      form.getAttribute('action') || location.pathname,
      location.href,
    );
    if (!isDirectoryPath(url.pathname)) return;
    event.preventDefault();
    for (const [key, value] of new FormData(form))
      if (typeof value === 'string' && value.trim())
        url.searchParams.set(key, value.trim());
    void show(url, { push: true, from: 'search' });
  });

  window.addEventListener('popstate', (event) => {
    if (!isDirectoryPath(location.pathname)) return;
    if (!(event.state as { directory?: boolean } | null)?.directory) return;
    void show(new URL(location.href), { push: false });
  });
}
