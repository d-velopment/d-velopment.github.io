import{S as A,i as I,s as D,k as m,q as $,a as H,l as v,m as g,r as y,h as p,c as x,n as h,p as N,b as F,C as _,B as E,D as K,E as O,w as j,x as q,y as z,F as R,G as U,H as k,f as b,t as w,z as C,o as G}from"../../chunks/index-a623bc35.js";import{p as P}from"../../chunks/stores-5993b49f.js";function T(f){let e,t,i,o,c,a,l,u,n,s;return{c(){e=m("header"),t=m("h1"),i=$("MINI BANK"),o=H(),c=m("nav"),a=m("ul"),l=m("li"),u=m("a"),n=$("Home"),this.h()},l(r){e=v(r,"HEADER",{class:!0});var d=g(e);t=v(d,"H1",{class:!0});var B=g(t);i=y(B,"MINI BANK"),B.forEach(p),o=x(d),c=v(d,"NAV",{style:!0,class:!0});var L=g(c);a=v(L,"UL",{class:!0});var M=g(a);l=v(M,"LI",{"aria-current":!0,class:!0});var V=g(l);u=v(V,"A",{href:!0,class:!0});var S=g(u);n=y(S,"Home"),S.forEach(p),V.forEach(p),M.forEach(p),L.forEach(p),d.forEach(p),this.h()},h(){h(t,"class","svelte-soeb3x"),h(u,"href","/"),h(u,"class","svelte-soeb3x"),h(l,"aria-current",s=f[0].url.pathname==="/"?"page":void 0),h(l,"class","svelte-soeb3x"),h(a,"class","svelte-soeb3x"),N(c,"display","none"),h(c,"class","svelte-soeb3x"),h(e,"class","svelte-soeb3x")},m(r,d){F(r,e,d),_(e,t),_(t,i),_(e,o),_(e,c),_(c,a),_(a,l),_(l,u),_(u,n)},p(r,[d]){d&1&&s!==(s=r[0].url.pathname==="/"?"page":void 0)&&h(l,"aria-current",s)},i:E,o:E,d(r){r&&p(e)}}}function Y(f,e,t){let i;return K(f,P,o=>t(0,i=o)),[i]}class J extends A{constructor(e){super(),I(this,e,Y,T,D,{})}}function Q(f){let e,t,i,o=new Date().getFullYear()+"",c,a;return{c(){e=m("footer"),t=m("span"),i=$("© "),c=$(o),a=$(" D-Velopment, Net."),this.h()},l(l){e=v(l,"FOOTER",{class:!0});var u=g(e);t=v(u,"SPAN",{class:!0});var n=g(t);i=y(n,"© "),c=y(n,o),a=y(n," D-Velopment, Net."),n.forEach(p),u.forEach(p),this.h()},h(){h(t,"class","svelte-11vntjt"),h(e,"class","svelte-11vntjt")},m(l,u){F(l,e,u),_(e,t),_(t,i),_(t,c),_(t,a)},p:E,i:E,o:E,d(l){l&&p(e)}}}class W extends A{constructor(e){super(),I(this,e,null,Q,D,{})}}function X(f){let e,t,i,o,c,a,l;t=new J({});const u=f[2].default,n=O(u,f,f[1],null);return a=new W({}),{c(){e=m("div"),j(t.$$.fragment),i=H(),o=m("main"),n&&n.c(),c=H(),j(a.$$.fragment),this.h()},l(s){e=v(s,"DIV",{class:!0});var r=g(e);q(t.$$.fragment,r),i=x(r),o=v(r,"MAIN",{class:!0});var d=g(o);n&&n.l(d),d.forEach(p),c=x(r),q(a.$$.fragment,r),r.forEach(p),this.h()},h(){h(o,"class","svelte-1fs2g73"),h(e,"class","app svelte-1fs2g73"),N(e,"height",f[0])},m(s,r){F(s,e,r),z(t,e,null),_(e,i),_(e,o),n&&n.m(o,null),_(e,c),z(a,e,null),l=!0},p(s,[r]){n&&n.p&&(!l||r&2)&&R(n,u,s,s[1],l?k(u,s[1],r,null):U(s[1]),null),r&1&&N(e,"height",s[0])},i(s){l||(b(t.$$.fragment,s),b(n,s),b(a.$$.fragment,s),l=!0)},o(s){w(t.$$.fragment,s),w(n,s),w(a.$$.fragment,s),l=!1},d(s){s&&p(e),C(t),n&&n.d(s),C(a)}}}function Z(f,e,t){let{$$slots:i={},$$scope:o}=e,c=0;return G(()=>{const a=()=>t(0,c=`${window.innerHeight}px`);a(),window.addEventListener("resize",a),document.body.style.marginBottom="0px"}),f.$$set=a=>{"$$scope"in a&&t(1,o=a.$$scope)},[c,o,i]}class se extends A{constructor(e){super(),I(this,e,Z,X,D,{})}}export{se as default};
