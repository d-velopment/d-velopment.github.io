import {
	S as le,
	i as re,
	s as ae,
	k as b,
	a as T,
	e as z,
	I as ie,
	l as E,
	h as _,
	c as B,
	n as l,
	C as m,
	b as C,
	B as W,
	o as ne,
	q as D,
	m as g,
	r as J,
	u as M,
	J as O,
	K as L,
	p as $,
	L as G,
	M as Q,
	N as oe,
	O as ce,
	P as ue
} from "../../chunks/index-47d25441.js"
const te = "https://sheetdb.io/api/v1/mzs4zi0dmgs4i",
	X = "sheets_loaded",
	se = async (c, e) => {
		await fetch(`${c}`)
			.then((t) => {
				if (!t.ok) throw new Error("Bad response from server")
				return t.json()
			})
			.then((t) => {
				e(t)
			})
			.catch((t) => {
				e(null)
			})
	},
	fe = (c, e) => {
		const t = c.toLowerCase().trim(),
			a = `data_${t}`,
			n = `history_${t}`,
			r = `time_${t}`
		let f = JSON.parse(localStorage.getItem(a)) || [],
			s =
				(Date.now() - Number.parseInt(localStorage.getItem(r) || Date.now())) / (24 * 60 * 60 * 1e3)
		f.length == 0 || s > 1
			? se(`${te}?sheet=${c}`, (i) => {
					if (i !== null) {
						localStorage.setItem(r, Date.now()), localStorage.setItem(a, JSON.stringify(i[0]))
						let d = []
						i.forEach((h, u) => {
							u > 0 && d.push({ Start: h.Start, Extra: h.Extra, Description: h.Description })
						}),
							localStorage.setItem(n, JSON.stringify(d)),
							e(!0)
						return
					} else {
						e(!1)
						return
					}
			  })
			: e(!0)
	},
	he = (c) => {
		let e = JSON.parse(localStorage.getItem(X)) || []
		e.length == 0 &&
			se(`${te}/sheets`, (t) => {
				if (t !== null) {
					;(e = t.sheets.map((a) => a.toLowerCase())),
						localStorage.setItem(X, JSON.stringify(e)),
						c(e)
					return
				} else {
					c([])
					return
				}
			}),
			c(e)
	}
function Y(c, e, t) {
	const a = c.slice()
	return (a[8] = e[t]), (a[10] = t), a
}
function de(c) {
	let e,
		t,
		a,
		n,
		r,
		f = c[4][0].Left + "",
		s,
		i,
		d,
		h = c[4][1].length !== 0 && Z(c)
	return {
		c() {
			;(e = b("section")),
				(t = b("h2")),
				(a = D(c[3])),
				(n = T()),
				(r = b("h1")),
				(s = D(f)),
				(i = T()),
				h && h.c(),
				(d = z()),
				this.h()
		},
		l(u) {
			e = E(u, "SECTION", { class: !0 })
			var o = g(e)
			t = E(o, "H2", { class: !0 })
			var p = g(t)
			;(a = J(p, c[3])), p.forEach(_), (n = B(o)), (r = E(o, "H1", { class: !0 }))
			var v = g(r)
			;(s = J(v, f)), v.forEach(_), o.forEach(_), (i = B(u)), h && h.l(u), (d = z()), this.h()
		},
		h() {
			l(t, "class", "upper-case shadow svelte-47c25g"),
				l(r, "class", "shadow svelte-47c25g"),
				l(e, "class", "svelte-47c25g")
		},
		m(u, o) {
			C(u, e, o),
				m(e, t),
				m(t, a),
				m(e, n),
				m(e, r),
				m(r, s),
				C(u, i, o),
				h && h.m(u, o),
				C(u, d, o)
		},
		p(u, o) {
			o & 8 && M(a, u[3]),
				o & 16 && f !== (f = u[4][0].Left + "") && M(s, f),
				u[4][1].length !== 0
					? h
						? h.p(u, o)
						: ((h = Z(u)), h.c(), h.m(d.parentNode, d))
					: h && (h.d(1), (h = null))
		},
		d(u) {
			u && _(e), u && _(i), h && h.d(u), u && _(d)
		}
	}
}
function me(c) {
	let e, t, a, n, r, f, s, i, d, h, u, o, p, v, y, S, k, I, H, K
	return {
		c() {
			;(e = b("section")),
				(t = b("form")),
				(a = b("fieldset")),
				(n = b("label")),
				(r = b("input")),
				(f = T()),
				(s = b("button")),
				(i = D("🔍")),
				(h = T()),
				(u = b("div")),
				(o = O("svg")),
				(p = O("circle")),
				(v = O("animate")),
				(y = O("circle")),
				(S = O("animate")),
				(k = O("circle")),
				(I = O("animate")),
				this.h()
		},
		l(N) {
			e = E(N, "SECTION", { class: !0 })
			var w = g(e)
			t = E(w, "FORM", {})
			var P = g(t)
			a = E(P, "FIELDSET", { class: !0 })
			var A = g(a)
			n = E(A, "LABEL", {})
			var q = g(n)
			;(r = E(q, "INPUT", { class: !0 })),
				q.forEach(_),
				(f = B(A)),
				(s = E(A, "BUTTON", { class: !0 }))
			var x = g(s)
			;(i = J(x, "🔍")),
				x.forEach(_),
				A.forEach(_),
				P.forEach(_),
				(h = B(w)),
				(u = E(w, "DIV", { class: !0, style: !0 }))
			var F = g(u)
			o = L(F, "svg", {
				version: !0,
				id: !0,
				xmlns: !0,
				"xmlns:xlink": !0,
				x: !0,
				y: !0,
				viewBox: !0,
				"enable-background": !0,
				"xml:space": !0
			})
			var U = g(o)
			p = L(U, "circle", { fill: !0, stroke: !0, cx: !0, cy: !0, r: !0 })
			var R = g(p)
			;(v = L(R, "animate", {
				attributeName: !0,
				dur: !0,
				values: !0,
				repeatCount: !0,
				begin: !0
			})),
				g(v).forEach(_),
				R.forEach(_),
				(y = L(U, "circle", { fill: !0, stroke: !0, cx: !0, cy: !0, r: !0 }))
			var j = g(y)
			;(S = L(j, "animate", {
				attributeName: !0,
				dur: !0,
				values: !0,
				repeatCount: !0,
				begin: !0
			})),
				g(S).forEach(_),
				j.forEach(_),
				(k = L(U, "circle", { fill: !0, stroke: !0, cx: !0, cy: !0, r: !0 }))
			var V = g(k)
			;(I = L(V, "animate", {
				attributeName: !0,
				dur: !0,
				values: !0,
				repeatCount: !0,
				begin: !0
			})),
				g(I).forEach(_),
				V.forEach(_),
				U.forEach(_),
				F.forEach(_),
				w.forEach(_),
				this.h()
		},
		h() {
			l(r, "class", "upper-case svelte-47c25g"),
				l(s, "class", "svelte-47c25g"),
				(a.disabled = d = c[1] || c[0].length == 0 ? "disabled" : ""),
				l(a, "class", "svelte-47c25g"),
				l(v, "attributeName", "opacity"),
				l(v, "dur", "1s"),
				l(v, "values", "0;1;0"),
				l(v, "repeatCount", "indefinite"),
				l(v, "begin", "0.1"),
				l(p, "fill", "#fff"),
				l(p, "stroke", "none"),
				l(p, "cx", "6"),
				l(p, "cy", "50"),
				l(p, "r", "6"),
				l(S, "attributeName", "opacity"),
				l(S, "dur", "1s"),
				l(S, "values", "0;1;0"),
				l(S, "repeatCount", "indefinite"),
				l(S, "begin", "0.2"),
				l(y, "fill", "#fff"),
				l(y, "stroke", "none"),
				l(y, "cx", "26"),
				l(y, "cy", "50"),
				l(y, "r", "6"),
				l(I, "attributeName", "opacity"),
				l(I, "dur", "1s"),
				l(I, "values", "0;1;0"),
				l(I, "repeatCount", "indefinite"),
				l(I, "begin", "0.3"),
				l(k, "fill", "#fff"),
				l(k, "stroke", "none"),
				l(k, "cx", "46"),
				l(k, "cy", "50"),
				l(k, "r", "6"),
				l(o, "version", "1.1"),
				l(o, "id", "L4"),
				l(o, "xmlns", "http://www.w3.org/2000/svg"),
				l(o, "xmlns:xlink", "http://www.w3.org/1999/xlink"),
				l(o, "x", "0px"),
				l(o, "y", "0px"),
				l(o, "viewBox", "0 0 52 100"),
				l(o, "enable-background", "new 0 0 0 0"),
				l(o, "xml:space", "preserve"),
				l(u, "class", "loader svelte-47c25g"),
				$(u, "display", c[1] ? "block" : "none"),
				l(e, "class", "svelte-47c25g")
		},
		m(N, w) {
			C(N, e, w),
				m(e, t),
				m(t, a),
				m(a, n),
				m(n, r),
				G(r, c[3]),
				m(a, f),
				m(a, s),
				m(s, i),
				m(e, h),
				m(e, u),
				m(u, o),
				m(o, p),
				m(p, v),
				m(o, y),
				m(y, S),
				m(o, k),
				m(k, I),
				H || ((K = [Q(r, "input", c[6]), Q(t, "submit", oe(c[7]))]), (H = !0))
		},
		p(N, w) {
			w & 8 && r.value !== N[3] && G(r, N[3]),
				w & 3 && d !== (d = N[1] || N[0].length == 0 ? "disabled" : "") && (a.disabled = d),
				w & 2 && $(u, "display", N[1] ? "block" : "none")
		},
		d(N) {
			N && _(e), (H = !1), ce(K)
		}
	}
}
function Z(c) {
	let e,
		t,
		a = c[4][1].reverse(),
		n = []
	for (let r = 0; r < a.length; r += 1) n[r] = ee(Y(c, a, r))
	return {
		c() {
			;(e = b("section")), (t = b("ol"))
			for (let r = 0; r < n.length; r += 1) n[r].c()
			this.h()
		},
		l(r) {
			e = E(r, "SECTION", { class: !0 })
			var f = g(e)
			t = E(f, "OL", { class: !0 })
			var s = g(t)
			for (let i = 0; i < n.length; i += 1) n[i].l(s)
			s.forEach(_), f.forEach(_), this.h()
		},
		h() {
			l(t, "class", "list svelte-47c25g"), l(e, "class", "centered svelte-47c25g")
		},
		m(r, f) {
			C(r, e, f), m(e, t)
			for (let s = 0; s < n.length; s += 1) n[s].m(t, null)
		},
		p(r, f) {
			if (f & 16) {
				a = r[4][1].reverse()
				let s
				for (s = 0; s < a.length; s += 1) {
					const i = Y(r, a, s)
					n[s] ? n[s].p(i, f) : ((n[s] = ee(i)), n[s].c(), n[s].m(t, null))
				}
				for (; s < n.length; s += 1) n[s].d(1)
				n.length = a.length
			}
		},
		d(r) {
			r && _(e), ue(n, r)
		}
	}
}
function ee(c) {
	let e,
		t,
		a = c[8].Extra + "",
		n,
		r,
		f,
		s = c[8].Start + "",
		i,
		d,
		h = c[8].Description + "",
		u,
		o
	return {
		c() {
			;(e = b("li")),
				(t = b("h2")),
				(n = D(a)),
				(r = T()),
				(f = b("span")),
				(i = D(s)),
				(d = D(" / ")),
				(u = D(h)),
				(o = T()),
				this.h()
		},
		l(p) {
			e = E(p, "LI", { class: !0 })
			var v = g(e)
			t = E(v, "H2", { class: !0 })
			var y = g(t)
			;(n = J(y, a)), y.forEach(_), (r = B(v)), (f = E(v, "SPAN", {}))
			var S = g(f)
			;(i = J(S, s)),
				(d = J(S, " / ")),
				(u = J(S, h)),
				S.forEach(_),
				(o = B(v)),
				v.forEach(_),
				this.h()
		},
		h() {
			l(t, "class", "headline svelte-47c25g"), l(e, "class", "item svelte-47c25g")
		},
		m(p, v) {
			C(p, e, v), m(e, t), m(t, n), m(e, r), m(e, f), m(f, i), m(f, d), m(f, u), m(e, o)
		},
		p(p, v) {
			v & 16 && a !== (a = p[8].Extra + "") && M(n, a),
				v & 16 && s !== (s = p[8].Start + "") && M(i, s),
				v & 16 && h !== (h = p[8].Description + "") && M(u, h)
		},
		d(p) {
			p && _(e)
		}
	}
}
function _e(c) {
	let e, t, a, n
	document.title = e = c[2] ? c[3].toUpperCase().trim() : "Mini-Bank"
	function r(i, d) {
		return i[2] ? de : me
	}
	let f = r(c),
		s = f(c)
	return {
		c() {
			;(t = b("meta")), (a = T()), s.c(), (n = z()), this.h()
		},
		l(i) {
			const d = ie("svelte-27pv3k", document.head)
			;(t = E(d, "META", { name: !0, content: !0 })),
				d.forEach(_),
				(a = B(i)),
				s.l(i),
				(n = z()),
				this.h()
		},
		h() {
			l(t, "name", "description"), l(t, "content", "Mini-Bank")
		},
		m(i, d) {
			m(document.head, t), C(i, a, d), s.m(i, d), C(i, n, d)
		},
		p(i, [d]) {
			d & 12 && e !== (e = i[2] ? i[3].toUpperCase().trim() : "Mini-Bank") && (document.title = e),
				f === (f = r(i)) && s ? s.p(i, d) : (s.d(1), (s = f(i)), s && (s.c(), s.m(n.parentNode, n)))
		},
		i: W,
		o: W,
		d(i) {
			_(t), i && _(a), s.d(i), i && _(n)
		}
	}
}
function pe(c, e, t) {
	let a = !1,
		n = !1,
		r = [],
		f = "",
		s = []
	const i = (u) => {
		setTimeout(() => {
			n || (t(1, (a = !1)), t(3, (f = "")))
		}, 5e3)
		const o = u.toLowerCase().trim()
		o == "reset" && localStorage.clear(),
			r.includes(o) &&
				fe(o, (p) => {
					p &&
						(t(
							4,
							(s = [
								JSON.parse(localStorage.getItem(`data_${o}`)),
								JSON.parse(localStorage.getItem(`history_${o}`))
							])
						),
						t(2, (n = !0)))
				})
	}
	ne(() => {
		he((u) => t(0, (r = u)))
	})
	function d() {
		;(f = this.value), t(3, f)
	}
	const h = () => {
		t(1, (a = !0)), i(f)
	}
	return (
		(c.$$.update = () => {
			c.$$.dirty & 1
		}),
		[r, a, n, f, s, i, d, h]
	)
}
class ge extends le {
	constructor(e) {
		super(), re(this, e, pe, _e, ae, {})
	}
}
export { ge as default }
