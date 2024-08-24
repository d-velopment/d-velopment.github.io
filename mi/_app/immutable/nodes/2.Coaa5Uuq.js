import{s as J,n as K,r as U,b as R}from"../chunks/scheduler.C5382k6v.js";import{S as L,i as Q,k as W,g as N,d as b,e as w,t as X,s as z,H as Y,c as k,a as T,b as Z,f as F,y as B,o as m,h as y,z as j,j as x,u as $,A as ee,v as te,w as se,n as le,l as ne,x as re}from"../chunks/index.DyK4i1d3.js";import{s as ie,g as oe,a as q}from"../chunks/store.OczDbIoW.js";const ae=!0,pe=Object.freeze(Object.defineProperty({__proto__:null,prerender:ae},Symbol.toStringTag,{value:"Module"}));function G(r){var d,h,D,M;let n,e,l,t=r[3].name+"",a,s,o,p,E=(((d=r[3])==null?void 0:d.details)||"")+"",I,f,C,H=((r[4]?(D=(h=r[3])==null?void 0:h.bbc)==null?void 0:D.replaceAll(`
`,"<br>"):(M=r[3])==null?void 0:M.table)||"")+"",P,S,g,A,i;return{c(){n=w("div"),e=w("div"),l=w("div"),a=X(t),s=z(),o=w("div"),p=new Y(!1),I=z(),f=w("div"),C=new Y(!1),S=z(),g=w("div"),this.h()},l(c){n=k(c,"DIV",{class:!0});var u=T(n);e=k(u,"DIV",{class:!0});var _=T(e);l=k(_,"DIV",{class:!0});var v=T(l);a=Z(v,t),v.forEach(b),s=F(_),o=k(_,"DIV",{class:!0,contenteditable:!0});var V=T(o);p=B(V,!1),V.forEach(b),_.forEach(b),I=F(u),f=k(u,"DIV",{class:!0,style:!0});var O=T(f);C=B(O,!1),O.forEach(b),S=F(u),g=k(u,"DIV",{class:!0,contenteditable:!0}),T(g).forEach(b),u.forEach(b),this.h()},h(){m(l,"class","title svelte-1r71l1"),p.a=null,m(o,"class","extra svelte-1r71l1"),m(o,"contenteditable","true"),m(e,"class","details svelte-1r71l1"),C.a=null,m(f,"class","chat svelte-1r71l1"),m(f,"style",P=r[4]?`max-height: ${r[5]}px;`:""),m(g,"class","message svelte-1r71l1"),m(g,"contenteditable","true"),m(n,"class","conversation svelte-1r71l1")},m(c,u){N(c,n,u),y(n,e),y(e,l),y(l,a),y(e,s),y(e,o),p.m(E,o),r[9](o),y(n,I),y(n,f),C.m(H,f),r[12](f),y(n,S),y(n,g),r[13](g),A||(i=[j(o,"keydown",r[8]),j(f,"keydown",r[7]),j(f,"dblclick",r[10]),j(f,"blur",r[11]),j(g,"keydown",r[6])],A=!0)},p(c,u){var _,v,V,O;u&8&&t!==(t=c[3].name+"")&&x(a,t),u&8&&E!==(E=(((_=c[3])==null?void 0:_.details)||"")+"")&&p.p(E),u&24&&H!==(H=((c[4]?(V=(v=c[3])==null?void 0:v.bbc)==null?void 0:V.replaceAll(`
`,"<br>"):(O=c[3])==null?void 0:O.table)||"")+"")&&C.p(H),u&48&&P!==(P=c[4]?`max-height: ${c[5]}px;`:"")&&m(f,"style",P)},d(c){c&&b(n),r[9](null),r[12](null),r[13](null),A=!1,U(i)}}}function ce(r){let n,e=r[3]&&G(r);return{c(){e&&e.c(),n=W()},l(l){e&&e.l(l),n=W()},m(l,t){e&&e.m(l,t),N(l,n,t)},p(l,[t]){l[3]?e?e.p(l,t):(e=G(l),e.c(),e.m(n.parentNode,n)):e&&(e.d(1),e=null)},i:K,o:K,d(l){l&&b(n),e&&e.d(l)}}}function ue(r,n,e){let l,t,a,s,o=!1,p;const E=i=>{if(!i)return;const d=(D,M,c,u)=>{let _=!1,v=`${D}`;for(;v.indexOf(M)!=-1;)_=!_,v=v.replace(M,_?c:u);return v};let h="";return i.split(`
`).forEach(D=>{D.length>0&&(h+=`<p>${D}</p>`)}),h=d(h,"**","<b>","</b>"),h=d(h,"@@","<div class='wide'><div class='dating'>","</div></div>"),h};ie.subscribe(i=>{e(3,s=void 0),e(3,s=oe(i)),s&&(e(3,s.table=E(s.bbc),s),e(4,o=!1),setTimeout(()=>{t&&t.scrollTo({top:(t==null?void 0:t.scrollHeight)||0,behavior:"smooth"})},0))});const I=i=>{if(i.key==="Enter"){i.preventDefault();const d=l.innerText.trim();for(;l.firstChild;)l.removeChild(l.firstChild);const h=new Date,D=`${h.getDate()}.${("0"+(h.getMonth()+1)).slice(-2)}.${h.getFullYear()}`;s.bbc||e(3,s.bbc="",s),e(3,s.bbc+=`

`+(d.startsWith("**")?`

@@${D}@@

${d}`:`**Esther:** ${d}`),s),q(s),e(3,s.table=E(s.bbc),s),setTimeout(()=>e(0,t.scrollTop=(t==null?void 0:t.scrollHeight)||0,t),100)}},f=i=>{if(i.key==="Enter"&&!i.shiftKey){i.preventDefault();let d=t.innerText.trim();for(;t.firstChild;)t.removeChild(t.firstChild);e(3,s.bbc=d,s),q(s),e(3,s.table=E(s.bbc),s),e(4,o=!1),t.blur(),setTimeout(()=>e(0,t.scrollTop=(t==null?void 0:t.scrollHeight)||0,t),100)}},C=i=>{if(i.key==="Enter"){i.preventDefault();const d=a.innerText.trim();for(;a.firstChild;)a.removeChild(a.firstChild);e(3,s.details=d,s),q(s),a.blur()}};function H(i){R[i?"unshift":"push"](()=>{a=i,e(2,a)})}const P=()=>{e(0,t.contentEditable=!0,t),e(4,o=!0),t.focus()},S=()=>{e(0,t.contentEditable=!1,t),e(4,o=!1)};function g(i){R[i?"unshift":"push"](()=>{t=i,e(0,t)})}function A(i){R[i?"unshift":"push"](()=>{l=i,e(1,l)})}return r.$$.update=()=>{r.$$.dirty&1&&e(5,p=t==null?void 0:t.clientHeight)},[t,l,a,s,o,p,I,f,C,H,P,S,g,A]}class fe extends L{constructor(n){super(),Q(this,n,ue,ce,J,{})}}function de(r){let n,e,l,t,a;return t=new fe({}),{c(){n=w("meta"),e=z(),l=w("section"),$(t.$$.fragment),this.h()},l(s){const o=ee("svelte-yurd7d",document.head);n=k(o,"META",{name:!0,content:!0}),o.forEach(b),e=F(s),l=k(s,"SECTION",{class:!0});var p=T(l);te(t.$$.fragment,p),p.forEach(b),this.h()},h(){document.title="Home",m(n,"name","description"),m(n,"content","ConVersatile"),m(l,"class","svelte-1jlhe5t")},m(s,o){y(document.head,n),N(s,e,o),N(s,l,o),se(t,l,null),a=!0},p:K,i(s){a||(le(t.$$.fragment,s),a=!0)},o(s){ne(t.$$.fragment,s),a=!1},d(s){s&&(b(e),b(l)),b(n),re(t)}}}class _e extends L{constructor(n){super(),Q(this,n,null,de,J,{})}}export{_e as component,pe as universal};
