function $() {}
function F(t, n) {
	for (const e in n) t[e] = n[e]
	return t
}
function M(t) {
	return t()
}
function C() {
	return Object.create(null)
}
function y(t) {
	t.forEach(M)
}
function k(t) {
	return typeof t == "function"
}
function ut(t, n) {
	return t != t ? n == n : t !== n || (t && typeof t == "object") || typeof t == "function"
}
function G(t) {
	return Object.keys(t).length === 0
}
function I(t, ...n) {
	if (t == null) return $
	const e = t.subscribe(...n)
	return e.unsubscribe ? () => e.unsubscribe() : e
}
function lt(t, n, e) {
	t.$$.on_destroy.push(I(n, e))
}
function st(t, n, e, i) {
	if (t) {
		const r = B(t, n, e, i)
		return t[0](r)
	}
}
function B(t, n, e, i) {
	return t[1] && i ? F(e.ctx.slice(), t[1](i(n))) : e.ctx
}
function ot(t, n, e, i) {
	if (t[2] && i) {
		const r = t[2](i(e))
		if (n.dirty === void 0) return r
		if (typeof r == "object") {
			const o = [],
				c = Math.max(n.dirty.length, r.length)
			for (let s = 0; s < c; s += 1) o[s] = n.dirty[s] | r[s]
			return o
		}
		return n.dirty | r
	}
	return n.dirty
}
function ft(t, n, e, i, r, o) {
	if (r) {
		const c = B(n, e, i, o)
		t.p(c, r)
	}
}
function at(t) {
	if (t.ctx.length > 32) {
		const n = [],
			e = t.ctx.length / 32
		for (let i = 0; i < e; i++) n[i] = -1
		return n
	}
	return -1
}
let w = !1
function J() {
	w = !0
}
function K() {
	w = !1
}
function R(t, n, e, i) {
	for (; t < n; ) {
		const r = t + ((n - t) >> 1)
		e(r) <= i ? (t = r + 1) : (n = r)
	}
	return t
}
function W(t) {
	if (t.hydrate_init) return
	t.hydrate_init = !0
	let n = t.childNodes
	if (t.nodeName === "HEAD") {
		const u = []
		for (let l = 0; l < n.length; l++) {
			const a = n[l]
			a.claim_order !== void 0 && u.push(a)
		}
		n = u
	}
	const e = new Int32Array(n.length + 1),
		i = new Int32Array(n.length)
	e[0] = -1
	let r = 0
	for (let u = 0; u < n.length; u++) {
		const l = n[u].claim_order,
			a = (r > 0 && n[e[r]].claim_order <= l ? r + 1 : R(1, r, (g) => n[e[g]].claim_order, l)) - 1
		i[u] = e[a] + 1
		const f = a + 1
		;(e[f] = u), (r = Math.max(f, r))
	}
	const o = [],
		c = []
	let s = n.length - 1
	for (let u = e[r] + 1; u != 0; u = i[u - 1]) {
		for (o.push(n[u - 1]); s >= u; s--) c.push(n[s])
		s--
	}
	for (; s >= 0; s--) c.push(n[s])
	o.reverse(), c.sort((u, l) => u.claim_order - l.claim_order)
	for (let u = 0, l = 0; u < c.length; u++) {
		for (; l < o.length && c[u].claim_order >= o[l].claim_order; ) l++
		const a = l < o.length ? o[l] : null
		t.insertBefore(c[u], a)
	}
}
function Q(t, n) {
	if (w) {
		for (
			W(t),
				(t.actual_end_child === void 0 ||
					(t.actual_end_child !== null && t.actual_end_child.parentNode !== t)) &&
					(t.actual_end_child = t.firstChild);
			t.actual_end_child !== null && t.actual_end_child.claim_order === void 0;

		)
			t.actual_end_child = t.actual_end_child.nextSibling
		n !== t.actual_end_child
			? (n.claim_order !== void 0 || n.parentNode !== t) && t.insertBefore(n, t.actual_end_child)
			: (t.actual_end_child = n.nextSibling)
	} else (n.parentNode !== t || n.nextSibling !== null) && t.appendChild(n)
}
function _t(t, n, e) {
	w && !e ? Q(t, n) : (n.parentNode !== t || n.nextSibling != e) && t.insertBefore(n, e || null)
}
function U(t) {
	t.parentNode && t.parentNode.removeChild(t)
}
function dt(t, n) {
	for (let e = 0; e < t.length; e += 1) t[e] && t[e].d(n)
}
function V(t) {
	return document.createElement(t)
}
function X(t) {
	return document.createElementNS("http://www.w3.org/2000/svg", t)
}
function A(t) {
	return document.createTextNode(t)
}
function ht() {
	return A(" ")
}
function mt() {
	return A("")
}
function pt(t, n, e, i) {
	return t.addEventListener(n, e, i), () => t.removeEventListener(n, e, i)
}
function yt(t) {
	return function (n) {
		return n.preventDefault(), t.call(this, n)
	}
}
function gt(t, n, e) {
	e == null ? t.removeAttribute(n) : t.getAttribute(n) !== e && t.setAttribute(n, e)
}
function Y(t) {
	return Array.from(t.childNodes)
}
function Z(t) {
	t.claim_info === void 0 && (t.claim_info = { last_index: 0, total_claimed: 0 })
}
function H(t, n, e, i, r = !1) {
	Z(t)
	const o = (() => {
		for (let c = t.claim_info.last_index; c < t.length; c++) {
			const s = t[c]
			if (n(s)) {
				const u = e(s)
				return u === void 0 ? t.splice(c, 1) : (t[c] = u), r || (t.claim_info.last_index = c), s
			}
		}
		for (let c = t.claim_info.last_index - 1; c >= 0; c--) {
			const s = t[c]
			if (n(s)) {
				const u = e(s)
				return (
					u === void 0 ? t.splice(c, 1) : (t[c] = u),
					r ? u === void 0 && t.claim_info.last_index-- : (t.claim_info.last_index = c),
					s
				)
			}
		}
		return i()
	})()
	return (o.claim_order = t.claim_info.total_claimed), (t.claim_info.total_claimed += 1), o
}
function L(t, n, e, i) {
	return H(
		t,
		(r) => r.nodeName === n,
		(r) => {
			const o = []
			for (let c = 0; c < r.attributes.length; c++) {
				const s = r.attributes[c]
				e[s.name] || o.push(s.name)
			}
			o.forEach((c) => r.removeAttribute(c))
		},
		() => i(n)
	)
}
function xt(t, n, e) {
	return L(t, n, e, V)
}
function bt(t, n, e) {
	return L(t, n, e, X)
}
function tt(t, n) {
	return H(
		t,
		(e) => e.nodeType === 3,
		(e) => {
			const i = "" + n
			if (e.data.startsWith(i)) {
				if (e.data.length !== i.length) return e.splitText(i.length)
			} else e.data = i
		},
		() => A(n),
		!0
	)
}
function $t(t) {
	return tt(t, " ")
}
function wt(t, n) {
	;(n = "" + n), t.wholeText !== n && (t.data = n)
}
function vt(t, n) {
	t.value = n ?? ""
}
function Et(t, n, e, i) {
	e === null ? t.style.removeProperty(n) : t.style.setProperty(n, e, i ? "important" : "")
}
function Nt(t, n) {
	const e = []
	let i = 0
	for (const r of n.childNodes)
		if (r.nodeType === 8) {
			const o = r.textContent.trim()
			o === `HEAD_${t}_END`
				? ((i -= 1), e.push(r))
				: o === `HEAD_${t}_START` && ((i += 1), e.push(r))
		} else i > 0 && e.push(r)
	return e
}
function At(t, n) {
	return new t(n)
}
let p
function m(t) {
	p = t
}
function O() {
	if (!p) throw new Error("Function called outside component initialization")
	return p
}
function St(t) {
	O().$$.on_mount.push(t)
}
function jt(t) {
	O().$$.after_update.push(t)
}
const h = [],
	T = [],
	x = [],
	D = [],
	P = Promise.resolve()
let E = !1
function q() {
	E || ((E = !0), P.then(z))
}
function Ct() {
	return q(), P
}
function N(t) {
	x.push(t)
}
const v = new Set()
let d = 0
function z() {
	if (d !== 0) return
	const t = p
	do {
		try {
			for (; d < h.length; ) {
				const n = h[d]
				d++, m(n), nt(n.$$)
			}
		} catch (n) {
			throw ((h.length = 0), (d = 0), n)
		}
		for (m(null), h.length = 0, d = 0; T.length; ) T.pop()()
		for (let n = 0; n < x.length; n += 1) {
			const e = x[n]
			v.has(e) || (v.add(e), e())
		}
		x.length = 0
	} while (h.length)
	for (; D.length; ) D.pop()()
	;(E = !1), v.clear(), m(t)
}
function nt(t) {
	if (t.fragment !== null) {
		t.update(), y(t.before_update)
		const n = t.dirty
		;(t.dirty = [-1]), t.fragment && t.fragment.p(t.ctx, n), t.after_update.forEach(N)
	}
}
const b = new Set()
let _
function Tt() {
	_ = { r: 0, c: [], p: _ }
}
function Dt() {
	_.r || y(_.c), (_ = _.p)
}
function et(t, n) {
	t && t.i && (b.delete(t), t.i(n))
}
function Mt(t, n, e, i) {
	if (t && t.o) {
		if (b.has(t)) return
		b.add(t),
			_.c.push(() => {
				b.delete(t), i && (e && t.d(1), i())
			}),
			t.o(n)
	} else i && i()
}
function kt(t) {
	t && t.c()
}
function Bt(t, n) {
	t && t.l(n)
}
function it(t, n, e, i) {
	const { fragment: r, after_update: o } = t.$$
	r && r.m(n, e),
		i ||
			N(() => {
				const c = t.$$.on_mount.map(M).filter(k)
				t.$$.on_destroy ? t.$$.on_destroy.push(...c) : y(c), (t.$$.on_mount = [])
			}),
		o.forEach(N)
}
function rt(t, n) {
	const e = t.$$
	e.fragment !== null &&
		(y(e.on_destroy),
		e.fragment && e.fragment.d(n),
		(e.on_destroy = e.fragment = null),
		(e.ctx = []))
}
function ct(t, n) {
	t.$$.dirty[0] === -1 && (h.push(t), q(), t.$$.dirty.fill(0)),
		(t.$$.dirty[(n / 31) | 0] |= 1 << n % 31)
}
function Ht(t, n, e, i, r, o, c, s = [-1]) {
	const u = p
	m(t)
	const l = (t.$$ = {
		fragment: null,
		ctx: [],
		props: o,
		update: $,
		not_equal: r,
		bound: C(),
		on_mount: [],
		on_destroy: [],
		on_disconnect: [],
		before_update: [],
		after_update: [],
		context: new Map(n.context || (u ? u.$$.context : [])),
		callbacks: C(),
		dirty: s,
		skip_bound: !1,
		root: n.target || u.$$.root
	})
	c && c(l.root)
	let a = !1
	if (
		((l.ctx = e
			? e(t, n.props || {}, (f, g, ...S) => {
					const j = S.length ? S[0] : g
					return (
						l.ctx &&
							r(l.ctx[f], (l.ctx[f] = j)) &&
							(!l.skip_bound && l.bound[f] && l.bound[f](j), a && ct(t, f)),
						g
					)
			  })
			: []),
		l.update(),
		(a = !0),
		y(l.before_update),
		(l.fragment = i ? i(l.ctx) : !1),
		n.target)
	) {
		if (n.hydrate) {
			J()
			const f = Y(n.target)
			l.fragment && l.fragment.l(f), f.forEach(U)
		} else l.fragment && l.fragment.c()
		n.intro && et(t.$$.fragment), it(t, n.target, n.anchor, n.customElement), K(), z()
	}
	m(u)
}
class Lt {
	$destroy() {
		rt(this, 1), (this.$destroy = $)
	}
	$on(n, e) {
		if (!k(e)) return $
		const i = this.$$.callbacks[n] || (this.$$.callbacks[n] = [])
		return (
			i.push(e),
			() => {
				const r = i.indexOf(e)
				r !== -1 && i.splice(r, 1)
			}
		)
	}
	$set(n) {
		this.$$set && !G(n) && ((this.$$.skip_bound = !0), this.$$set(n), (this.$$.skip_bound = !1))
	}
}
export {
	Ct as A,
	$ as B,
	Q as C,
	lt as D,
	st as E,
	ft as F,
	at as G,
	ot as H,
	Nt as I,
	X as J,
	bt as K,
	vt as L,
	pt as M,
	yt as N,
	y as O,
	dt as P,
	Lt as S,
	ht as a,
	_t as b,
	$t as c,
	Dt as d,
	mt as e,
	et as f,
	Tt as g,
	U as h,
	Ht as i,
	jt as j,
	V as k,
	xt as l,
	Y as m,
	gt as n,
	St as o,
	Et as p,
	A as q,
	tt as r,
	ut as s,
	Mt as t,
	wt as u,
	At as v,
	kt as w,
	Bt as x,
	it as y,
	rt as z
}
