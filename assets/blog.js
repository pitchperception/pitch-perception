/* Blog (live 2026-11-12): #blog lists posts from data/blog/posts.json; #blog-<slug> shows data/blog/<slug>.html. */
(function(){
"use strict";
const esc = PP.esc;
let postsP = null;
PP.loadBlog = () => postsP || (postsP = fetch("data/blog/posts.json").then(r => r.ok ? r.json() : []).catch(() => []).then(d => (PP.data.blog = d)));
const when = p => p.date ? PP.dateLong(p.date) + ", " + p.date.slice(0,4) : "Draft";
const meta = p => `<p class="b-meta">${esc(when(p))}<span aria-hidden="true"> · </span>${p.minutes} min read</p>`;

function list(main, posts){
  main.innerHTML = `<div class="wrap"><section class="pid"><h1 class="r-name">Blog</h1>
    <p class="r-note standfirst">Longer reads from the data behind the site: studies, charts and what they mean for MLS.</p></section>
    <section class="blist">${posts.length ? posts.map(p => `
      <article class="bcard" data-href="blog-${esc(p.slug)}" tabindex="0">
        <a class="bthumb" href="#blog-${esc(p.slug)}" tabindex="-1" aria-hidden="true"><img src="${esc(p.image)}" alt="" loading="lazy" width="2400" height="1350"></a>
        <div class="btext">
          ${p.kicker ? `<p class="b-kicker">${esc(p.kicker)}</p>` : ""}
          <h2 class="b-title"><a href="#blog-${esc(p.slug)}">${esc(p.title)}</a></h2>
          <p class="b-snip">${esc(p.snippet)}</p>
          ${meta(p)}
        </div>
      </article>`).join("") : `<p class="r-note">No posts yet.</p>`}</section></div>`;
}

async function article(main, posts, slug){
  const p = posts.find(x => x.slug === slug);
  if(!p){ list(main, posts); return; }
  main.innerHTML = `<div class="wrap"><p class="r-small">Loading.</p></div>`;
  let body = "";
  try { const r = await fetch(`data/blog/${encodeURIComponent(slug)}.html`); if(!r.ok) throw new Error(r.status); body = await r.text(); }
  catch(e){ main.innerHTML = `<div class="wrap"><section class="holding"><h1 class="r-title">The post did not load</h1><p>${esc(String(e.message||e))}</p></section></div>`; return; }
  if(location.hash.slice(1) !== "blog-" + slug) return;
  main.innerHTML = `<div class="wrap"><article class="bpost">
    <header class="bhead"><a class="b-back" href="#blog">← Blog</a>
      ${p.kicker ? `<p class="b-kicker">${esc(p.kicker)}</p>` : ""}
      <h1 class="b-h1">${esc(p.title)}</h1>
      <p class="b-dek">${esc(p.snippet)}</p>
      <p class="b-meta">${esc(p.author || "Pitch Perception")}<span aria-hidden="true"> · </span>${esc(when(p))}<span aria-hidden="true"> · </span>${p.minutes} min read</p>
    </header>
    <div class="bbody">${body}</div>
    <footer class="bfoot"><a class="b-back" href="#blog">← All posts</a></footer>
  </article></div>`;
  document.title = p.title + " | Pitch Perception";
}

PP.pages.blog = async (main, h) => {
  const posts = await PP.loadBlog();
  const slug = (h || "blog").split("-").slice(1).join("-");
  if(slug) await article(main, posts, slug); else list(main, posts);
};
})();
