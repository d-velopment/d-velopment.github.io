import{S as ne,i as oe,s as ce,k as S,a as B,e as K,K as ue,l as y,h as m,c as M,n as l,C as u,b as O,E as Y,o as fe,q as z,m as g,r as C,u as P,L as T,M as J,p as A,N as Z,D as ee,O as he,P as me,Q as de}from"../../chunks/index-fc13d5be.js";import{c as _e}from"../../chunks/store-f9b58571.js";const ae="https://sheetdb.io/api/v1/mzs4zi0dmgs4i",te="sheets_loaded",ie=async(c,s)=>{await fetch(`${c}`).then(e=>{if(!e.ok)throw new Error("Bad response from server");return e.json()}).then(e=>{s(e)}).catch(e=>{s(null)})},pe=(c,s)=>{const e=c.toLowerCase().trim(),a=`data_${e}`,i=`history_${e}`,_=`time_${e}`;_e.set(e);let n=JSON.parse(localStorage.getItem(a))||[],r=(Date.now()-Number.parseInt(localStorage.getItem(_)||Date.now()))/(1*60*60*1e3);n.length==0||r>1?ie(`${ae}?sheet=${c}`,t=>{if(t!==null){localStorage.setItem(_,Date.now()),localStorage.setItem(a,JSON.stringify(t[0]));let o=[];t.forEach((b,E)=>{E>0&&o.push({Start:b.Start,Extra:b.Extra,Description:b.Description})}),localStorage.setItem(i,JSON.stringify(o)),s(!0);return}else{s(!1);return}}):s(!0)},ve=c=>{let s=JSON.parse(localStorage.getItem(te))||[];s.length==0&&ie(`${ae}/sheets`,e=>{if(e!==null){s=e.sheets.map(a=>a.toLowerCase()),localStorage.setItem(te,JSON.stringify(s)),c(s);return}else{c([]);return}}),c(s)};function se(c,s,e){const a=c.slice();return a[8]=s[e],a[10]=e,a}function ge(c){let s,e,a=c[4][0].Left+"",i,_,n,r=c[4][1].length!==0&&le(c);return{c(){s=S("section"),e=S("h1"),i=z(a),_=B(),r&&r.c(),n=K(),this.h()},l(t){s=y(t,"SECTION",{class:!0});var o=g(s);e=y(o,"H1",{class:!0});var b=g(e);i=C(b,a),b.forEach(m),o.forEach(m),_=M(t),r&&r.l(t),n=K(),this.h()},h(){l(e,"class","shadow svelte-1jjcm4z"),l(s,"class","svelte-1jjcm4z")},m(t,o){O(t,s,o),u(s,e),u(e,i),O(t,_,o),r&&r.m(t,o),O(t,n,o)},p(t,o){o&16&&a!==(a=t[4][0].Left+"")&&P(i,a),t[4][1].length!==0?r?r.p(t,o):(r=le(t),r.c(),r.m(n.parentNode,n)):r&&(r.d(1),r=null)},d(t){t&&m(s),t&&m(_),r&&r.d(t),t&&m(n)}}}function be(c){let s,e,a,i,_,n,r,t,o,b,E,p,v,f,h,N,d,j,k,w,D,V;return{c(){s=S("section"),e=S("form"),a=S("div"),i=S("fieldset"),_=S("label"),n=S("input"),r=B(),t=S("button"),o=z("🔍"),E=B(),p=S("div"),v=S("div"),f=T("svg"),h=T("circle"),N=T("animate"),d=T("circle"),j=T("animate"),k=T("circle"),w=T("animate"),this.h()},l(I){s=y(I,"SECTION",{class:!0});var L=g(s);e=y(L,"FORM",{});var q=g(e);a=y(q,"DIV",{style:!0});var U=g(a);i=y(U,"FIELDSET",{class:!0});var x=g(i);_=y(x,"LABEL",{});var F=g(_);n=y(F,"INPUT",{class:!0}),F.forEach(m),r=M(x),t=y(x,"BUTTON",{class:!0});var R=g(t);o=C(R,"🔍"),R.forEach(m),x.forEach(m),E=M(U),p=y(U,"DIV",{class:!0,style:!0});var Q=g(p);v=y(Q,"DIV",{style:!0});var W=g(v);f=J(W,"svg",{version:!0,id:!0,xmlns:!0,"xmlns:xlink":!0,x:!0,y:!0,viewBox:!0,"enable-background":!0,"xml:space":!0});var H=g(f);h=J(H,"circle",{fill:!0,stroke:!0,cx:!0,cy:!0,r:!0});var $=g(h);N=J($,"animate",{attributeName:!0,dur:!0,values:!0,repeatCount:!0,begin:!0}),g(N).forEach(m),$.forEach(m),d=J(H,"circle",{fill:!0,stroke:!0,cx:!0,cy:!0,r:!0});var G=g(d);j=J(G,"animate",{attributeName:!0,dur:!0,values:!0,repeatCount:!0,begin:!0}),g(j).forEach(m),G.forEach(m),k=J(H,"circle",{fill:!0,stroke:!0,cx:!0,cy:!0,r:!0});var X=g(k);w=J(X,"animate",{attributeName:!0,dur:!0,values:!0,repeatCount:!0,begin:!0}),g(w).forEach(m),X.forEach(m),H.forEach(m),W.forEach(m),Q.forEach(m),U.forEach(m),q.forEach(m),L.forEach(m),this.h()},h(){l(n,"class","upper-case united-width svelte-1jjcm4z"),l(t,"class","svelte-1jjcm4z"),i.disabled=b=c[0]||c[2].length==0?"disabled":"",l(i,"class","svelte-1jjcm4z"),l(N,"attributeName","opacity"),l(N,"dur","1s"),l(N,"values","0;0.7;0"),l(N,"repeatCount","indefinite"),l(N,"begin","0.1"),l(h,"fill","#f00"),l(h,"stroke","none"),l(h,"cx","6"),l(h,"cy","6"),l(h,"r","6"),l(j,"attributeName","opacity"),l(j,"dur","1s"),l(j,"values","0;0.7;0"),l(j,"repeatCount","indefinite"),l(j,"begin","0.2"),l(d,"fill","#0f0"),l(d,"stroke","none"),l(d,"cx","20"),l(d,"cy","6"),l(d,"r","6"),l(w,"attributeName","opacity"),l(w,"dur","1s"),l(w,"values","0;0.7;0"),l(w,"repeatCount","indefinite"),l(w,"begin","0.3"),l(k,"fill","#00f"),l(k,"stroke","none"),l(k,"cx","34"),l(k,"cy","6"),l(k,"r","6"),l(f,"version","1.1"),l(f,"id","L4"),l(f,"xmlns","http://www.w3.org/2000/svg"),l(f,"xmlns:xlink","http://www.w3.org/1999/xlink"),l(f,"x","0px"),l(f,"y","0px"),l(f,"viewBox","0 0 40 12"),l(f,"enable-background","new 0 0 0 0"),l(f,"xml:space","preserve"),A(v,"display","flex"),A(v,"width","3rem"),A(v,"height","3rem"),l(p,"class","loader united-width svelte-1jjcm4z"),A(p,"display",c[0]?"flex":"none"),A(a,"position","relative"),l(s,"class","svelte-1jjcm4z")},m(I,L){O(I,s,L),u(s,e),u(e,a),u(a,i),u(i,_),u(_,n),Z(n,c[3]),u(i,r),u(i,t),u(t,o),u(a,E),u(a,p),u(p,v),u(v,f),u(f,h),u(h,N),u(f,d),u(d,j),u(f,k),u(k,w),D||(V=[ee(n,"input",c[6]),ee(e,"submit",he(c[7]))],D=!0)},p(I,L){L&8&&n.value!==I[3]&&Z(n,I[3]),L&5&&b!==(b=I[0]||I[2].length==0?"disabled":"")&&(i.disabled=b),L&1&&A(p,"display",I[0]?"flex":"none")},d(I){I&&m(s),D=!1,me(V)}}}function le(c){let s,e,a,i,_,n=c[4][0].Earned+"",r,t,o,b,E=c[4][0].Start+"",p,v=c[4][1].reverse(),f=[];for(let h=0;h<v.length;h+=1)f[h]=re(se(c,v,h));return{c(){s=S("section"),e=S("ol");for(let h=0;h<f.length;h+=1)f[h].c();a=B(),i=S("li"),_=S("h2"),r=z(n),t=B(),o=S("span"),b=z("Накоплено с "),p=z(E),this.h()},l(h){s=y(h,"SECTION",{class:!0});var N=g(s);e=y(N,"OL",{class:!0});var d=g(e);for(let D=0;D<f.length;D+=1)f[D].l(d);a=M(d),i=y(d,"LI",{class:!0});var j=g(i);_=y(j,"H2",{class:!0});var k=g(_);r=C(k,n),k.forEach(m),t=M(j),o=y(j,"SPAN",{});var w=g(o);b=C(w,"Накоплено с "),p=C(w,E),w.forEach(m),j.forEach(m),d.forEach(m),N.forEach(m),this.h()},h(){l(_,"class","headline bold svelte-1jjcm4z"),l(i,"class","item svelte-1jjcm4z"),l(e,"class","list svelte-1jjcm4z"),l(s,"class","centered svelte-1jjcm4z")},m(h,N){O(h,s,N),u(s,e);for(let d=0;d<f.length;d+=1)f[d].m(e,null);u(e,a),u(e,i),u(i,_),u(_,r),u(i,t),u(i,o),u(o,b),u(o,p)},p(h,N){if(N&16){v=h[4][1].reverse();let d;for(d=0;d<v.length;d+=1){const j=se(h,v,d);f[d]?f[d].p(j,N):(f[d]=re(j),f[d].c(),f[d].m(e,a))}for(;d<f.length;d+=1)f[d].d(1);f.length=v.length}N&16&&n!==(n=h[4][0].Earned+"")&&P(r,n),N&16&&E!==(E=h[4][0].Start+"")&&P(p,E)},d(h){h&&m(s),de(f,h)}}}function re(c){let s,e,a=c[8].Extra.trim().replace(/^€/,"+ €")+"",i,_,n,r=c[8].Start+"",t,o,b=c[8].Description+"",E;return{c(){s=S("li"),e=S("h2"),i=z(a),_=B(),n=S("span"),t=z(r),o=z(" / "),E=z(b),this.h()},l(p){s=y(p,"LI",{class:!0});var v=g(s);e=y(v,"H2",{class:!0});var f=g(e);i=C(f,a),f.forEach(m),_=M(v),n=y(v,"SPAN",{});var h=g(n);t=C(h,r),o=C(h," / "),E=C(h,b),h.forEach(m),v.forEach(m),this.h()},h(){l(e,"class","headline svelte-1jjcm4z"),l(s,"class","item svelte-1jjcm4z")},m(p,v){O(p,s,v),u(s,e),u(e,i),u(s,_),u(s,n),u(n,t),u(n,o),u(n,E)},p(p,v){v&16&&a!==(a=p[8].Extra.trim().replace(/^€/,"+ €")+"")&&P(i,a),v&16&&r!==(r=p[8].Start+"")&&P(t,r),v&16&&b!==(b=p[8].Description+"")&&P(E,b)},d(p){p&&m(s)}}}function Ee(c){let s,e,a,i;document.title=s=c[1]?c[3].toUpperCase().trim():"Mini-Bank";function _(t,o){return t[1]?ge:be}let n=_(c),r=n(c);return{c(){e=S("meta"),a=B(),r.c(),i=K(),this.h()},l(t){const o=ue("svelte-27pv3k",document.head);e=y(o,"META",{name:!0,content:!0}),o.forEach(m),a=M(t),r.l(t),i=K(),this.h()},h(){l(e,"name","description"),l(e,"content","Mini-Bank")},m(t,o){u(document.head,e),O(t,a,o),r.m(t,o),O(t,i,o)},p(t,[o]){o&10&&s!==(s=t[1]?t[3].toUpperCase().trim():"Mini-Bank")&&(document.title=s),n===(n=_(t))&&r?r.p(t,o):(r.d(1),r=n(t),r&&(r.c(),r.m(i.parentNode,i)))},i:Y,o:Y,d(t){m(e),t&&m(a),r.d(t),t&&m(i)}}}function Se(c,s,e){let a=!1,i=!1,_=[],n="",r=[];const t=E=>{setTimeout(()=>{i||(e(0,a=!1),e(3,n=""))},3e3);const p=E.toLowerCase().trim();p=="reset"&&localStorage.clear(),_.includes(p)&&pe(p,v=>{v&&(e(4,r=[JSON.parse(localStorage.getItem(`data_${p}`)),JSON.parse(localStorage.getItem(`history_${p}`))]),e(1,i=!0))})};fe(()=>{ve(E=>e(2,_=E))});function o(){n=this.value,e(3,n)}return[a,i,_,n,r,t,o,()=>{e(0,a=!0),t(n)}]}class je extends ne{constructor(s){super(),oe(this,s,Se,Ee,ce,{})}}export{je as default};
