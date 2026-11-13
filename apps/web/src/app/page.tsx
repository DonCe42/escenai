import Link from 'next/link';
import { LocaleSwitch } from '@/components/LocaleSwitch';
import { LANDING } from '@/lib/landing';
import { getLocale } from '@/lib/locale-server';

/**
 * Landing. La regla que cambió respecto a la v1: el producto se demuestra antes
 * de pedir nada. El video del hero es un render real de este pipeline, y el
 * precio se enseña con sus números en vez de esconderse detrás de un "empieza gratis".
 */
export default async function HomePage() {
  const locale = await getLocale();
  const t = LANDING[locale];

  return (
    <main className="lp">
      <header className="lp-nav">
        <div className="lp-wrap lp-nav-inner">
          <Link href="/" className="wordmark">
            ESCEN<b>A</b>I
          </Link>
          <nav className="lp-nav-links">
            <Link href="/new">{t.nav.create}</Link>
            <Link href="/projects">{t.nav.projects}</Link>
            <Link href="/settings">{t.nav.settings}</Link>
            <a href="https://github.com/DonCe42/escenai" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </nav>
          <span className="lp-nav-spacer" />
          <LocaleSwitch locale={locale} />
          <Link href="/new" className="btn">
            {t.nav.cta}
          </Link>
        </div>
      </header>

      <div className="lp-wrap">
        <section className="lp-hero">
          <div>
            <span className="lp-kicker">
              <i />
              {t.hero.kicker}
            </span>
            <h1 className="lp-h1">
              {t.hero.titleLead}
              <em>{t.hero.titleAccent}</em>
            </h1>
            <p className="lp-sub">{t.hero.subtitle}</p>
            <div className="lp-actions">
              <Link href="/new" className="btn" style={{ height: 42, padding: '0 20px' }}>
                {t.hero.ctaPrimary}
              </Link>
              <Link href="/demo" className="lp-link">
                {t.hero.ctaSecondary}
              </Link>
            </div>
            <p className="lp-note">{t.hero.note}</p>
          </div>

          <div className="lp-phone">
            <div className="lp-phone-frame">
              <video
                src="/landing/demo-loop.mp4"
                poster="/landing/demo-poster.jpg"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
              />
            </div>
            <span className="lp-chip a">{t.hero.badge}</span>
            <span className="lp-chip b">{t.hero.badgeCost}</span>
          </div>
        </section>

        <section className="lp-stats" aria-label="Datos del ejemplo">
          {t.stats.map((stat) => (
            <div className="lp-stat" key={stat.label}>
              <b>{stat.value}</b>
              <span>{stat.label}</span>
            </div>
          ))}
        </section>

        <section className="lp-section" id="como-funciona">
          <div className="lp-section-head">
            <span className="kicker">{t.how.kicker}</span>
            <h2 className="lp-h2">{t.how.title}</h2>
          </div>

          <div className="lp-how">
            <div className="lp-steps">
              {t.how.steps.map((step, index) => (
                <div className="lp-step" key={step.title}>
                  <span className="lp-step-n">0{index + 1}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <figure style={{ margin: 0 }}>
              <div className="lp-shot">
                <div className="lp-shot-bar">
                  <i />
                  <i />
                  <i />
                  <span>escenai · /studio</span>
                </div>
                {/* Captura real del estudio con un proyecto de 7 escenas. */}
                <img src="/landing/studio.png" alt="El estudio de Escenai con un proyecto abierto" />
              </div>
              <figcaption className="lp-caption">{t.how.shotCaption}</figcaption>
            </figure>
          </div>
        </section>

        <section className="lp-section" id="ejemplo">
          <div className="lp-section-head">
            <span className="kicker">{t.example.kicker}</span>
            <h2 className="lp-h2">{t.example.title}</h2>
          </div>

          <div className="lp-example">
            <div className="lp-poster">
              <img src="/landing/demo-poster.jpg" alt="Fotograma del video de ejemplo" />
            </div>
            <div>
              <p className="lp-sub" style={{ marginTop: 0 }}>
                {t.example.body}
              </p>
              <div className="lp-breakdown">
                {t.example.breakdown.map((row) => (
                  <div className="lp-line" key={row.label}>
                    <span>{row.label}</span>
                    <b>{row.value}</b>
                  </div>
                ))}
                <div className="lp-line total">
                  <span>{t.example.totalLabel}</span>
                  <b>{t.example.total}</b>
                </div>
              </div>
              <p className="lp-caption">{t.example.note}</p>
              <Link href="/demo" className="btn" style={{ height: 40, marginTop: 8 }}>
                {t.example.cta}
              </Link>
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-section-head">
            <span className="kicker">{t.keys.kicker}</span>
            <h2 className="lp-h2">{t.keys.title}</h2>
          </div>
          <div className="lp-keys">
            {t.keys.items.map((item) => (
              <article className="lp-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-closing">
          <h2>{t.closing.title}</h2>
          <p>{t.closing.body}</p>
          <Link href="/new" className="btn" style={{ height: 42, padding: '0 22px' }}>
            {t.closing.cta}
          </Link>
        </section>

        <footer className="lp-footer">
          <span>{t.footer}</span>
          <span>escenai</span>
        </footer>
      </div>
    </main>
  );
}
