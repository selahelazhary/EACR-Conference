<?xml version="1.0" encoding="UTF-8"?>
<!-- ورقةُ تنسيقٍ للخلاصة: يقرؤها المتصفّحُ فيعرض صفحةً مفهومة،
     ويتجاهلها قارئُ الخلاصات فيأخذ الـ XML كما هو. -->
<xsl:stylesheet version="1.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:atom="http://www.w3.org/2005/Atom"
                xmlns:dc="http://purl.org/dc/elements/1.1/">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>خلاصةُ <xsl:value-of select="rss/channel/title"/></title>
        <meta name="robots" content="noindex, follow"/>
        <link rel="icon" href="/assets/img/icon-32.png" sizes="32x32" type="image/png"/>
        <link rel="stylesheet"
              href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&amp;family=Tajawal:wght@500;700;900&amp;display=swap"/>
        <style>
          :root {
            --paper: #FBFAF7; --surface: #FFFFFF; --ink: #15141B; --muted: #6A6775;
            --line: #E4E0D7; --brand: #16597D;
            color-scheme: light dark;
          }
          @media (prefers-color-scheme: dark) {
            :root { --paper:#0B0B10; --surface:#14141D; --ink:#F3F1EC; --muted:#9B98A8;
                    --line:#272733; --brand:#5FB4E8; }
          }
          * { box-sizing: border-box; }
          body { margin:0; background:var(--paper); color:var(--ink);
                 font-family:"IBM Plex Sans Arabic",system-ui,sans-serif; line-height:1.8; }
          .wrap { max-width: 820px; margin: 0 auto; padding: 2.4rem 1.2rem 5rem; }
          .head { border-bottom: 2px solid var(--ink); padding-bottom: 1.6rem; margin-bottom: 1.4rem; }
          .eyebrow { display:inline-flex; align-items:center; gap:.5rem; font-size:.78rem; font-weight:600;
                     letter-spacing:.02em; color:var(--brand); background:color-mix(in srgb,var(--brand) 10%,transparent);
                     border-radius:999px; padding:.35rem .85rem; margin:0 0 1rem; }
          h1 { font-family:"Tajawal",sans-serif; font-size:clamp(1.8rem,1.2rem+2.4vw,2.9rem);
               font-weight:900; line-height:1.2; margin:0 0 .5rem; }
          h1 a { color:inherit; text-decoration:none; }
          .tagline { color:var(--muted); margin:0; font-size:1.02rem; }
          .note { background:var(--surface); border:1px solid var(--line); border-right:3px solid var(--brand);
                  border-radius:12px; padding:1.1rem 1.2rem; margin:1.6rem 0 2.4rem; }
          .note b { display:block; margin-bottom:.3rem; }
          .note p { margin:0; color:var(--muted); font-size:.95rem; }
          .note a { color:var(--brand); }
          .field { display:flex; gap:.6rem; align-items:center; flex-wrap:wrap; margin-top:.9rem; }
          .field code { flex:1; min-width:240px; background:var(--paper); border:1px solid var(--line);
                        border-radius:8px; padding:.55rem .7rem; font-size:.85rem; direction:ltr;
                        text-align:left; overflow-x:auto; white-space:nowrap; }
          .count { font-size:.85rem; color:var(--muted); margin:0 0 1rem; font-weight:600; }
          article { border-bottom:1px solid var(--line); padding:1.5rem 0; }
          article h2 { font-family:"Tajawal",sans-serif; font-size:1.28rem; line-height:1.45; margin:.35rem 0 .5rem; }
          article h2 a { color:var(--ink); text-decoration:none; }
          article h2 a:hover { color:var(--brand); }
          .meta { display:flex; gap:.6rem; flex-wrap:wrap; align-items:center;
                  font-size:.78rem; color:var(--muted); margin:0; }
          .tag { background:color-mix(in srgb,var(--brand) 12%,transparent); color:var(--brand);
                 border-radius:999px; padding:.15rem .6rem; font-weight:600; }
          .dek { color:var(--muted); margin:.5rem 0 0; font-size:.97rem; }
          footer { margin-top:2.5rem; color:var(--muted); font-size:.85rem; text-align:center; }
          footer a { color:var(--brand); }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="head">
            <p class="eyebrow">خلاصةٌ حيّة · RSS</p>
            <h1><a href="{rss/channel/link}"><xsl:value-of select="rss/channel/title"/></a></h1>
            <p class="tagline"><xsl:value-of select="rss/channel/description"/></p>
          </div>

          <div class="note">
            <b>هذه صفحةُ اشتراك، لا مقال.</b>
            <p>
              انسخ الرابطَ أدناه وألصقه في قارئ الخلاصات لديك، فيصلك كلُّ ما يُنشر هنا أوّلاً بأوّل.
              أو <a href="/subscribe/">افتح صفحةَ الاشتراك</a> لتفعيل الإشعارات بضغطةٍ واحدة.
            </p>
            <div class="field">
              <code><xsl:value-of select="rss/channel/atom:link/@href"/></code>
            </div>
          </div>

          <p class="count">
            أحدثُ <xsl:value-of select="count(rss/channel/item)"/> مادّةً في الخلاصة
          </p>

          <xsl:for-each select="rss/channel/item">
            <article>
              <p class="meta">
                <span class="tag"><xsl:value-of select="category"/></span>
                <span><xsl:value-of select="substring(pubDate, 1, 16)"/></span>
                <xsl:if test="dc:creator">
                  <span>·</span><span><xsl:value-of select="dc:creator"/></span>
                </xsl:if>
              </p>
              <h2><a href="{link}"><xsl:value-of select="title"/></a></h2>
              <p class="dek"><xsl:value-of select="description"/></p>
            </article>
          </xsl:for-each>

          <footer>
            <p>
              <a href="{rss/channel/link}">العودة إلى الموقع</a> ·
              <a href="/subscribe/">طرقُ المتابعة الأخرى</a>
            </p>
          </footer>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
