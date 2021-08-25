
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.42.1' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const appUserStructure = {
      id: null,
      firstName: "",
      lastName: "",
      username: "",
      jwtToken: null
    };
    const appUser = writable(appUserStructure);

    const appConfigStructure = {
      auth: null
    };
    const appConfig = writable(appConfigStructure);

    const STORAGEITEMS = {
      EXPDATE: "__expDate",
      ERRTITLE: "%c Storage features are not available ",
      ERRSTYLE: "background: #333; color: #ffb3c5; margin: 10px; padding: 10px; border-bottom-right-radius: 10px;",
    };

    var storageSupported = true;
    try {
      const checkKey = Math.random().toString(36).substring(2);
      localStorage.setItem(checkKey, checkKey);
      localStorage.removeItem(checkKey);
    } catch {
      storageSupported = false;
    }

    var labelMessage;
    const isSupported = (callback) => {
      if (storageSupported) {
        return callback()
      }
      if (!labelMessage) {
        console.log((labelMessage = STORAGEITEMS.ERRTITLE), STORAGEITEMS.ERRSTYLE);
      }
      return null
    };

    const containerSet = (key, json, storage = localStorage) => isSupported(() => storage.setItem(key, JSON.stringify(json)));
    const containerGet = (key, callbackOnEmpty, storage = localStorage) => {
      return isSupported(() => {
        if (storage.hasOwnProperty(key)) {
          const returnJSON = JSON.parse(storage.getItem(key));
          if (returnJSON.hasOwnProperty(STORAGEITEMS.EXPDATE))
            if (Date.parse(new Date()) > Date.parse(returnJSON[STORAGEITEMS.EXPDATE])) {
              storage.removeItem(key);
              return null
            }
          return returnJSON
        } else if (callbackOnEmpty) callbackOnEmpty(key);
      })
    };
    const containerRemove = (key, storage = localStorage) => isSupported(() => storage.removeItem(key));

    const sessionSet = (key, json) => containerSet(key, json, sessionStorage);
    const sessionGet = (key, callbackOnEmpty) => {
      return containerGet(key, callbackOnEmpty, sessionStorage)
    };
    const sessionDelete = (key) => containerRemove(key, sessionStorage);

    const permanentSet = (key, json, expireDate) => containerSet(key, { ...json, ...{ [STORAGEITEMS.EXPDATE]: expireDate } });
    const permanentGet = (key, callbackOnEmpty) => {
      return containerGet(key, callbackOnEmpty)
    };
    const permanentDelete = (key) => containerRemove(key);

    const DataStorage = {
      sessionSet: sessionSet,
      sessionGet: sessionGet,
      sessionDelete: sessionDelete,

      permanentSet: permanentSet,
      permanentGet: permanentGet,
      permanentDelete: permanentDelete,
    };

    const isNullOrEmpty = (str) => {
      var returnValue = false;
      if (!str || str == null || str === "null" || str === "" || str === "{}" || str === "undefined" || str.length === 0) {
        returnValue = true;
      }
      return returnValue
    };

    const fetchPost = async (url, data, token, callback) => {
      if (isNullOrEmpty(url.trim())) return
      const settings = {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          'Authorization': `${isNullOrEmpty(token) ? '' : 'Bearer ' + token}`
        },
        body: JSON.stringify(data),
      };

      try {
        const response = await fetch(`${url}`, settings);
        {
          try {
            const data = await response.json();
            callback(data);
          } catch (err) {
            console.error(error);
            callback(null);
          }
        }
      } catch {}
    };

    const fetchWeb = async (url, callback) => {
      if (isNullOrEmpty(url.trim())) return
      await fetch(`${url}`)
        .then((response) => {
          if (!response.ok) throw new Error("Bad response from server")
          return response.json()
        })
        .then((json) => {
          callback(json);
        })
        .catch((error) => {
          console.error(error);
          callback(null);
        });
    };

    const callWebAPI = async (urlAPI, requestId, callback) => {
      if (isNullOrEmpty(urlAPI.trim()) || isNullOrEmpty(requestId.trim())) return
      fetchWeb(`${urlAPI}${requestId}`, callback);
    };

    const pingWebAPI = async (url, callback) => {
      await fetch(`${url}`)
        .then((response) => {
          callback(response.ok);
        })
        .catch((error) => {
          console.error(error);
          callback(null);
        });
    };

    const Server = {
      fetchPost: fetchPost,
      fetchWeb: fetchWeb,
      callWebAPI: callWebAPI,
      pingWebAPI: pingWebAPI,
    };

    /* src/helpers/Loader.svelte generated by Svelte v3.42.1 */

    const urlAuth = "https://localhost:5001/user/authenticate";
    let authData = null;

    Array.prototype.first = function () {
    	return this[0];
    };

    Date.prototype.addDays = function (days) {
    	var date = new Date(this.valueOf());
    	date.setDate(date.getDate() + days);
    	return date;
    };

    // LOAD QUERY DATA
    const loadQueryData = callback => {
    	console.log("Load Query Data...");

    	// EXTRA: SAVE WIDGET TYPE PARAMETER
    	// widgetType.set(appConfigStructure.tournamentType)
    	// SAVE APP PARAMETERS
    	// appConfig.set(appConfigStructure)
    	if (callback) callback();
    };

    // LOAD SERVER AUTH
    /* const loadServerAuth = (data, callback) => {
      console.log("Load Server Auth...")
      Server.fetchPost(urlAuth, data, null, (value) => {
        console.log("Auth.")
        if (callback) callback(value)
      })
    } */
    // LOAD SERVER DATA
    const loadUserAuth = callback => {
    	authData = DataStorage.permanentGet("auth", () => {
    		Server.fetchPost(urlAuth, { username: "test", password: "test" }, null, value => {
    			if (value.id != null) {
    				DataStorage.permanentSet("auth", value, new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).addDays(1));
    				authData = value;
    				appUser.set(authData);
    				console.log("Reload User Auth...", authData);
    			} else {
    				console.log("No User Auth.");
    			}

    			callback();
    		});
    	});

    	if (authData != null) {
    		console.log("Stored User Auth...", authData);
    		appUser.set(authData);
    		callback();
    	}
    };

    // PROCESS LOADED DATA
    const processData = callback => {
    	console.log("Process Data...");

    	// SAVE APP PARAMETERS
    	/* appConfig.set(appConfigStructure)
    appLabels.set(appLabelsStructure)
    gamesCarousel.set(gamesCarouselStructure) */
    	if (callback) callback();
    };

    const setupApp = callback => {
    	console.log("Setup...");
    	loadQueryData(() => loadUserAuth(() => processData(result => console.log("Show."))));
    };

    /* src/components/Menu.svelte generated by Svelte v3.42.1 */
    const file$3 = "src/components/Menu.svelte";

    function create_fragment$5(ctx) {
    	let section;
    	let nav;
    	let div3;
    	let div0;
    	let span0;
    	let a0;
    	let t1;
    	let button;
    	let div1;
    	let span1;
    	let t2;
    	let span2;
    	let t3;
    	let span3;
    	let t4;
    	let span4;
    	let t5;
    	let div2;
    	let ul;
    	let li0;
    	let a1;
    	let span5;
    	let t6_value = /*userDetails*/ ctx[0].firstName + "";
    	let t6;
    	let t7;
    	let t8_value = /*userDetails*/ ctx[0].lastName + "";
    	let t8;
    	let t9;
    	let li1;
    	let a2;
    	let span6;
    	let t10;
    	let t11;
    	let li2;
    	let a3;
    	let span7;
    	let t12;

    	const block = {
    		c: function create() {
    			section = element("section");
    			nav = element("nav");
    			div3 = element("div");
    			div0 = element("div");
    			span0 = element("span");
    			a0 = element("a");
    			a0.textContent = "WISHDATE";
    			t1 = space();
    			button = element("button");
    			div1 = element("div");
    			span1 = element("span");
    			t2 = space();
    			span2 = element("span");
    			t3 = space();
    			span3 = element("span");
    			t4 = space();
    			span4 = element("span");
    			t5 = space();
    			div2 = element("div");
    			ul = element("ul");
    			li0 = element("li");
    			a1 = element("a");
    			span5 = element("span");
    			t6 = text(t6_value);
    			t7 = space();
    			t8 = text(t8_value);
    			t9 = space();
    			li1 = element("li");
    			a2 = element("a");
    			span6 = element("span");
    			t10 = text("\n              Желание");
    			t11 = space();
    			li2 = element("li");
    			a3 = element("a");
    			span7 = element("span");
    			t12 = text("Уведомления");
    			attr_dev(a0, "class", "navbar-caption text-primary display-5");
    			attr_dev(a0, "href", "/");
    			add_location(a0, file$3, 13, 42, 402);
    			attr_dev(span0, "class", "navbar-caption-wrap");
    			add_location(span0, file$3, 13, 8, 368);
    			attr_dev(div0, "class", "navbar-brand");
    			add_location(div0, file$3, 12, 6, 333);
    			add_location(span1, file$3, 24, 10, 792);
    			add_location(span2, file$3, 25, 10, 816);
    			add_location(span3, file$3, 26, 10, 840);
    			add_location(span4, file$3, 27, 10, 864);
    			attr_dev(div1, "class", "hamburger");
    			add_location(div1, file$3, 23, 8, 758);
    			attr_dev(button, "class", "navbar-toggler");
    			attr_dev(button, "type", "button");
    			attr_dev(button, "data-toggle", "collapse");
    			attr_dev(button, "data-target", "#navbarSupportedContent");
    			attr_dev(button, "aria-controls", "navbarNavAltMarkup");
    			attr_dev(button, "aria-expanded", "false");
    			attr_dev(button, "aria-label", "Toggle navigation");
    			add_location(button, file$3, 15, 6, 499);
    			attr_dev(span5, "class", "mobi-mbri mobi-mbri-smile-face mbr-iconfont mbr-iconfont-btn");
    			add_location(span5, file$3, 34, 15, 1201);
    			attr_dev(a1, "class", "nav-link link text-black text-primary display-4");
    			attr_dev(a1, "href", "index.html");
    			add_location(a1, file$3, 33, 12, 1109);
    			attr_dev(li0, "class", "nav-item");
    			add_location(li0, file$3, 32, 10, 1075);
    			attr_dev(span6, "class", "mobi-mbri mobi-mbri-plus mbr-iconfont mbr-iconfont-btn");
    			add_location(span6, file$3, 38, 15, 1486);
    			attr_dev(a2, "class", "nav-link link text-black text-primary display-4");
    			attr_dev(a2, "href", "index.html");
    			add_location(a2, file$3, 37, 12, 1394);
    			attr_dev(li1, "class", "nav-item");
    			add_location(li1, file$3, 36, 10, 1360);
    			attr_dev(span7, "class", "mobi-mbri mobi-mbri-alert mbr-iconfont mbr-iconfont-btn");
    			add_location(span7, file$3, 43, 15, 1741);
    			attr_dev(a3, "class", "nav-link link text-black text-primary display-4");
    			attr_dev(a3, "href", "index.html");
    			add_location(a3, file$3, 42, 12, 1649);
    			attr_dev(li2, "class", "nav-item");
    			add_location(li2, file$3, 41, 10, 1615);
    			attr_dev(ul, "class", "navbar-nav nav-dropdown nav-right");
    			attr_dev(ul, "data-app-modern-menu", "true");
    			add_location(ul, file$3, 31, 8, 990);
    			attr_dev(div2, "class", "collapse navbar-collapse");
    			attr_dev(div2, "id", "navbarSupportedContent");
    			add_location(div2, file$3, 30, 6, 915);
    			attr_dev(div3, "class", "container");
    			add_location(div3, file$3, 11, 4, 303);
    			attr_dev(nav, "class", "navbar navbar-dropdown navbar-fixed-top navbar-expand-lg");
    			add_location(nav, file$3, 10, 2, 228);
    			attr_dev(section, "class", "menu menu3 cid-shi7GCIidK");
    			attr_dev(section, "once", "menu");
    			attr_dev(section, "id", "menu3-0");
    			add_location(section, file$3, 9, 0, 157);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, nav);
    			append_dev(nav, div3);
    			append_dev(div3, div0);
    			append_dev(div0, span0);
    			append_dev(span0, a0);
    			append_dev(div3, t1);
    			append_dev(div3, button);
    			append_dev(button, div1);
    			append_dev(div1, span1);
    			append_dev(div1, t2);
    			append_dev(div1, span2);
    			append_dev(div1, t3);
    			append_dev(div1, span3);
    			append_dev(div1, t4);
    			append_dev(div1, span4);
    			append_dev(div3, t5);
    			append_dev(div3, div2);
    			append_dev(div2, ul);
    			append_dev(ul, li0);
    			append_dev(li0, a1);
    			append_dev(a1, span5);
    			append_dev(a1, t6);
    			append_dev(a1, t7);
    			append_dev(a1, t8);
    			append_dev(ul, t9);
    			append_dev(ul, li1);
    			append_dev(li1, a2);
    			append_dev(a2, span6);
    			append_dev(a2, t10);
    			append_dev(ul, t11);
    			append_dev(ul, li2);
    			append_dev(li2, a3);
    			append_dev(a3, span7);
    			append_dev(a3, t12);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*userDetails*/ 1 && t6_value !== (t6_value = /*userDetails*/ ctx[0].firstName + "")) set_data_dev(t6, t6_value);
    			if (dirty & /*userDetails*/ 1 && t8_value !== (t8_value = /*userDetails*/ ctx[0].lastName + "")) set_data_dev(t8, t8_value);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Menu', slots, []);
    	let userDetails;
    	appUser.subscribe(value => $$invalidate(0, userDetails = value));
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Menu> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ appUser, userDetails });

    	$$self.$inject_state = $$props => {
    		if ('userDetails' in $$props) $$invalidate(0, userDetails = $$props.userDetails);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [userDetails];
    }

    class Menu extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Menu",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src/components/Header.svelte generated by Svelte v3.42.1 */

    const file$2 = "src/components/Header.svelte";

    function create_fragment$4(ctx) {
    	let section;
    	let div13;
    	let div12;
    	let div2;
    	let div1;
    	let div0;
    	let a0;
    	let span0;
    	let t0;
    	let h40;
    	let strong0;
    	let t2;
    	let div5;
    	let div4;
    	let div3;
    	let a1;
    	let span1;
    	let t3;
    	let h41;
    	let strong1;
    	let strong2;
    	let br;
    	let t5;
    	let div8;
    	let div7;
    	let div6;
    	let a2;
    	let span2;
    	let t6;
    	let h42;
    	let strong3;
    	let t8;
    	let div11;
    	let div10;
    	let div9;
    	let a3;
    	let span3;
    	let t9;
    	let h43;
    	let strong4;

    	const block = {
    		c: function create() {
    			section = element("section");
    			div13 = element("div");
    			div12 = element("div");
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			a0 = element("a");
    			span0 = element("span");
    			t0 = space();
    			h40 = element("h4");
    			strong0 = element("strong");
    			strong0.textContent = "События";
    			t2 = space();
    			div5 = element("div");
    			div4 = element("div");
    			div3 = element("div");
    			a1 = element("a");
    			span1 = element("span");
    			t3 = space();
    			h41 = element("h4");
    			strong1 = element("strong");
    			strong1.textContent = "Желания";
    			strong2 = element("strong");
    			br = element("br");
    			t5 = space();
    			div8 = element("div");
    			div7 = element("div");
    			div6 = element("div");
    			a2 = element("a");
    			span2 = element("span");
    			t6 = space();
    			h42 = element("h4");
    			strong3 = element("strong");
    			strong3.textContent = "Друзья";
    			t8 = space();
    			div11 = element("div");
    			div10 = element("div");
    			div9 = element("div");
    			a3 = element("a");
    			span3 = element("span");
    			t9 = space();
    			h43 = element("h4");
    			strong4 = element("strong");
    			strong4.textContent = "Бронь";
    			attr_dev(span0, "class", "mbr-iconfont mobi-mbri-image-gallery mobi-mbri");
    			add_location(span0, file$2, 10, 33, 313);
    			attr_dev(a0, "href", "index.html");
    			add_location(a0, file$2, 10, 12, 292);
    			add_location(strong0, file$2, 11, 84, 470);
    			attr_dev(h40, "class", "card-title align-center mbr-black mbr-fonts-style display-7");
    			add_location(h40, file$2, 11, 12, 398);
    			attr_dev(div0, "class", "card-box align-center");
    			add_location(div0, file$2, 9, 10, 244);
    			attr_dev(div1, "class", "card-wrapper");
    			add_location(div1, file$2, 8, 8, 207);
    			attr_dev(div2, "class", "card p-0 col-3 col-md-3 col-lg-2");
    			add_location(div2, file$2, 7, 6, 152);
    			attr_dev(span1, "class", "mbr-iconfont mobi-mbri-gift mobi-mbri");
    			add_location(span1, file$2, 18, 33, 712);
    			attr_dev(a1, "href", "index.html");
    			add_location(a1, file$2, 18, 12, 691);
    			add_location(strong1, file$2, 19, 84, 860);
    			add_location(br, file$2, 19, 116, 892);
    			add_location(strong2, file$2, 19, 108, 884);
    			attr_dev(h41, "class", "card-title align-center mbr-black mbr-fonts-style display-7");
    			add_location(h41, file$2, 19, 12, 788);
    			attr_dev(div3, "class", "card-box align-center");
    			add_location(div3, file$2, 17, 10, 643);
    			attr_dev(div4, "class", "card-wrapper");
    			add_location(div4, file$2, 16, 8, 606);
    			attr_dev(div5, "class", "card p-0 col-3 col-md-3 col-lg-2");
    			add_location(div5, file$2, 15, 6, 551);
    			attr_dev(span2, "class", "mbr-iconfont mobi-mbri-features mobi-mbri");
    			add_location(span2, file$2, 26, 33, 1125);
    			attr_dev(a2, "href", "index.html");
    			add_location(a2, file$2, 26, 12, 1104);
    			add_location(strong3, file$2, 27, 84, 1277);
    			attr_dev(h42, "class", "card-title align-center mbr-black mbr-fonts-style display-7");
    			add_location(h42, file$2, 27, 12, 1205);
    			attr_dev(div6, "class", "card-box align-center");
    			add_location(div6, file$2, 25, 10, 1056);
    			attr_dev(div7, "class", "card-wrapper");
    			add_location(div7, file$2, 24, 8, 1019);
    			attr_dev(div8, "class", "card p-0 col-3 col-md-3 col-lg-2");
    			add_location(div8, file$2, 23, 6, 964);
    			attr_dev(span3, "class", "mbr-iconfont mobi-mbri-shopping-bag mobi-mbri");
    			add_location(span3, file$2, 34, 33, 1518);
    			attr_dev(a3, "href", "index.html");
    			add_location(a3, file$2, 34, 12, 1497);
    			add_location(strong4, file$2, 35, 84, 1674);
    			attr_dev(h43, "class", "card-title align-center mbr-black mbr-fonts-style display-7");
    			add_location(h43, file$2, 35, 12, 1602);
    			attr_dev(div9, "class", "card-box align-center");
    			add_location(div9, file$2, 33, 10, 1449);
    			attr_dev(div10, "class", "card-wrapper");
    			add_location(div10, file$2, 32, 8, 1412);
    			attr_dev(div11, "class", "card p-0 col-3 col-md-3 col-lg-2");
    			add_location(div11, file$2, 31, 6, 1357);
    			attr_dev(div12, "class", "row");
    			add_location(div12, file$2, 6, 4, 128);
    			attr_dev(div13, "class", "container");
    			add_location(div13, file$2, 5, 2, 100);
    			attr_dev(section, "class", "features13 cid-shi8eTGcZg");
    			attr_dev(section, "id", "features14-1");
    			add_location(section, file$2, 4, 0, 36);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, div13);
    			append_dev(div13, div12);
    			append_dev(div12, div2);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div0, a0);
    			append_dev(a0, span0);
    			append_dev(div0, t0);
    			append_dev(div0, h40);
    			append_dev(h40, strong0);
    			append_dev(div12, t2);
    			append_dev(div12, div5);
    			append_dev(div5, div4);
    			append_dev(div4, div3);
    			append_dev(div3, a1);
    			append_dev(a1, span1);
    			append_dev(div3, t3);
    			append_dev(div3, h41);
    			append_dev(h41, strong1);
    			append_dev(h41, strong2);
    			append_dev(strong2, br);
    			append_dev(div12, t5);
    			append_dev(div12, div8);
    			append_dev(div8, div7);
    			append_dev(div7, div6);
    			append_dev(div6, a2);
    			append_dev(a2, span2);
    			append_dev(div6, t6);
    			append_dev(div6, h42);
    			append_dev(h42, strong3);
    			append_dev(div12, t8);
    			append_dev(div12, div11);
    			append_dev(div11, div10);
    			append_dev(div10, div9);
    			append_dev(div9, a3);
    			append_dev(a3, span3);
    			append_dev(div9, t9);
    			append_dev(div9, h43);
    			append_dev(h43, strong4);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Header', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Header> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Header extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Header",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src/components/Stream.svelte generated by Svelte v3.42.1 */

    const { console: console_1 } = globals;
    const file$1 = "src/components/Stream.svelte";

    function create_fragment$3(ctx) {
    	let section;
    	let div108;
    	let div11;
    	let div10;
    	let div9;
    	let div1;
    	let div0;
    	let img0;
    	let img0_src_value;
    	let t0;
    	let div8;
    	let div7;
    	let div6;
    	let div2;
    	let h60;
    	let strong0;
    	let t2;
    	let p0;
    	let t4;
    	let div4;
    	let p1;
    	let t6;
    	let div3;
    	let a0;
    	let t8;
    	let div5;
    	let t9;
    	let div23;
    	let div22;
    	let div21;
    	let div13;
    	let div12;
    	let img1;
    	let img1_src_value;
    	let t10;
    	let div20;
    	let div19;
    	let div18;
    	let div14;
    	let h61;
    	let strong1;
    	let t12;
    	let p2;
    	let t14;
    	let div16;
    	let p3;
    	let t16;
    	let div15;
    	let a1;
    	let t18;
    	let div17;
    	let t19;
    	let div35;
    	let div34;
    	let div33;
    	let div25;
    	let div24;
    	let img2;
    	let img2_src_value;
    	let t20;
    	let div32;
    	let div31;
    	let div30;
    	let div26;
    	let h62;
    	let strong2;
    	let t22;
    	let p4;
    	let t24;
    	let div28;
    	let p5;
    	let t26;
    	let div27;
    	let a2;
    	let t28;
    	let div29;
    	let t29;
    	let div47;
    	let div46;
    	let div45;
    	let div37;
    	let div36;
    	let img3;
    	let img3_src_value;
    	let t30;
    	let div44;
    	let div43;
    	let div42;
    	let div38;
    	let h63;
    	let strong3;
    	let t32;
    	let p6;
    	let t34;
    	let div40;
    	let p7;
    	let t36;
    	let div39;
    	let a3;
    	let t38;
    	let div41;
    	let t39;
    	let div59;
    	let div58;
    	let div57;
    	let div49;
    	let div48;
    	let img4;
    	let img4_src_value;
    	let t40;
    	let div56;
    	let div55;
    	let div54;
    	let div50;
    	let h64;
    	let strong4;
    	let t42;
    	let p8;
    	let t44;
    	let div52;
    	let p9;
    	let t46;
    	let div51;
    	let a4;
    	let t48;
    	let div53;
    	let t49;
    	let div71;
    	let div70;
    	let div69;
    	let div61;
    	let div60;
    	let img5;
    	let img5_src_value;
    	let t50;
    	let div68;
    	let div67;
    	let div66;
    	let div62;
    	let h65;
    	let strong5;
    	let t52;
    	let p10;
    	let t54;
    	let div64;
    	let p11;
    	let t56;
    	let div63;
    	let a5;
    	let t58;
    	let div65;
    	let t59;
    	let div83;
    	let div82;
    	let div81;
    	let div73;
    	let div72;
    	let img6;
    	let img6_src_value;
    	let t60;
    	let div80;
    	let div79;
    	let div78;
    	let div74;
    	let h66;
    	let strong6;
    	let t62;
    	let p12;
    	let t64;
    	let div76;
    	let p13;
    	let t66;
    	let div75;
    	let a6;
    	let t68;
    	let div77;
    	let t69;
    	let div95;
    	let div94;
    	let div93;
    	let div85;
    	let div84;
    	let img7;
    	let img7_src_value;
    	let t70;
    	let div92;
    	let div91;
    	let div90;
    	let div86;
    	let h67;
    	let strong7;
    	let t72;
    	let p14;
    	let t74;
    	let div88;
    	let p15;
    	let t76;
    	let div87;
    	let a7;
    	let t78;
    	let div89;
    	let t79;
    	let div107;
    	let div106;
    	let div105;
    	let div97;
    	let div96;
    	let img8;
    	let img8_src_value;
    	let t80;
    	let div104;
    	let div103;
    	let div102;
    	let div98;
    	let h68;
    	let strong8;
    	let t82;
    	let p16;
    	let t84;
    	let div100;
    	let p17;
    	let t86;
    	let div99;
    	let a8;
    	let t88;
    	let div101;

    	const block = {
    		c: function create() {
    			section = element("section");
    			div108 = element("div");
    			div11 = element("div");
    			div10 = element("div");
    			div9 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			img0 = element("img");
    			t0 = space();
    			div8 = element("div");
    			div7 = element("div");
    			div6 = element("div");
    			div2 = element("div");
    			h60 = element("h6");
    			strong0 = element("strong");
    			strong0.textContent = "Камера";
    			t2 = space();
    			p0 = element("p");
    			p0.textContent = "Polaroid производит фотоаппараты, которые сразу после съёмки выдают готовый снимок. Для этого фирма выпускает специальные аппараты\n                    и специальные кассеты к ним.";
    			t4 = space();
    			div4 = element("div");
    			p1 = element("p");
    			p1.textContent = "$29";
    			t6 = space();
    			div3 = element("div");
    			a0 = element("a");
    			a0.textContent = "Подарить";
    			t8 = space();
    			div5 = element("div");
    			t9 = space();
    			div23 = element("div");
    			div22 = element("div");
    			div21 = element("div");
    			div13 = element("div");
    			div12 = element("div");
    			img1 = element("img");
    			t10 = space();
    			div20 = element("div");
    			div19 = element("div");
    			div18 = element("div");
    			div14 = element("div");
    			h61 = element("h6");
    			strong1 = element("strong");
    			strong1.textContent = "Чашечка";
    			t12 = space();
    			p2 = element("p");
    			p2.textContent = "Сосуд используется для непосредственного питья горячих напитков. В некоторых культурах из чашек принято также есть, во многих\n                    странах Азии распространена чашка без ручки.";
    			t14 = space();
    			div16 = element("div");
    			p3 = element("p");
    			p3.textContent = "$29";
    			t16 = space();
    			div15 = element("div");
    			a1 = element("a");
    			a1.textContent = "Подарить";
    			t18 = space();
    			div17 = element("div");
    			t19 = space();
    			div35 = element("div");
    			div34 = element("div");
    			div33 = element("div");
    			div25 = element("div");
    			div24 = element("div");
    			img2 = element("img");
    			t20 = space();
    			div32 = element("div");
    			div31 = element("div");
    			div30 = element("div");
    			div26 = element("div");
    			h62 = element("h6");
    			strong2 = element("strong");
    			strong2.textContent = "Вишенки";
    			t22 = space();
    			p4 = element("p");
    			p4.textContent = "Русское слово «вишня» считается общеславянским производным от той же основы, что и нем. Weichsel «вишня», лат. viscum «птичий\n                    клей».";
    			t24 = space();
    			div28 = element("div");
    			p5 = element("p");
    			p5.textContent = "$29";
    			t26 = space();
    			div27 = element("div");
    			a2 = element("a");
    			a2.textContent = "Подарить";
    			t28 = space();
    			div29 = element("div");
    			t29 = space();
    			div47 = element("div");
    			div46 = element("div");
    			div45 = element("div");
    			div37 = element("div");
    			div36 = element("div");
    			img3 = element("img");
    			t30 = space();
    			div44 = element("div");
    			div43 = element("div");
    			div42 = element("div");
    			div38 = element("div");
    			h63 = element("h6");
    			strong3 = element("strong");
    			strong3.textContent = "Камера";
    			t32 = space();
    			p6 = element("p");
    			p6.textContent = "Polaroid производит фотоаппараты, которые сразу после съёмки выдают готовый снимок. Для этого фирма выпускает специальные аппараты\n                    и специальные кассеты к ним.";
    			t34 = space();
    			div40 = element("div");
    			p7 = element("p");
    			p7.textContent = "$29";
    			t36 = space();
    			div39 = element("div");
    			a3 = element("a");
    			a3.textContent = "Подарить";
    			t38 = space();
    			div41 = element("div");
    			t39 = space();
    			div59 = element("div");
    			div58 = element("div");
    			div57 = element("div");
    			div49 = element("div");
    			div48 = element("div");
    			img4 = element("img");
    			t40 = space();
    			div56 = element("div");
    			div55 = element("div");
    			div54 = element("div");
    			div50 = element("div");
    			h64 = element("h6");
    			strong4 = element("strong");
    			strong4.textContent = "Чашечка";
    			t42 = space();
    			p8 = element("p");
    			p8.textContent = "Сосуд используется для непосредственного питья горячих напитков. В некоторых культурах из чашек принято также есть, во многих\n                    странах Азии распространена чашка без ручки.";
    			t44 = space();
    			div52 = element("div");
    			p9 = element("p");
    			p9.textContent = "$29";
    			t46 = space();
    			div51 = element("div");
    			a4 = element("a");
    			a4.textContent = "Подарить";
    			t48 = space();
    			div53 = element("div");
    			t49 = space();
    			div71 = element("div");
    			div70 = element("div");
    			div69 = element("div");
    			div61 = element("div");
    			div60 = element("div");
    			img5 = element("img");
    			t50 = space();
    			div68 = element("div");
    			div67 = element("div");
    			div66 = element("div");
    			div62 = element("div");
    			h65 = element("h6");
    			strong5 = element("strong");
    			strong5.textContent = "Вишенки";
    			t52 = space();
    			p10 = element("p");
    			p10.textContent = "Русское слово «вишня» считается общеславянским производным от той же основы, что и нем. Weichsel «вишня», лат. viscum «птичий\n                    клей».";
    			t54 = space();
    			div64 = element("div");
    			p11 = element("p");
    			p11.textContent = "$29";
    			t56 = space();
    			div63 = element("div");
    			a5 = element("a");
    			a5.textContent = "Подарить";
    			t58 = space();
    			div65 = element("div");
    			t59 = space();
    			div83 = element("div");
    			div82 = element("div");
    			div81 = element("div");
    			div73 = element("div");
    			div72 = element("div");
    			img6 = element("img");
    			t60 = space();
    			div80 = element("div");
    			div79 = element("div");
    			div78 = element("div");
    			div74 = element("div");
    			h66 = element("h6");
    			strong6 = element("strong");
    			strong6.textContent = "Камера";
    			t62 = space();
    			p12 = element("p");
    			p12.textContent = "Polaroid производит фотоаппараты, которые сразу после съёмки выдают готовый снимок. Для этого фирма выпускает специальные аппараты\n                    и специальные кассеты к ним.";
    			t64 = space();
    			div76 = element("div");
    			p13 = element("p");
    			p13.textContent = "$29";
    			t66 = space();
    			div75 = element("div");
    			a6 = element("a");
    			a6.textContent = "Подарить";
    			t68 = space();
    			div77 = element("div");
    			t69 = space();
    			div95 = element("div");
    			div94 = element("div");
    			div93 = element("div");
    			div85 = element("div");
    			div84 = element("div");
    			img7 = element("img");
    			t70 = space();
    			div92 = element("div");
    			div91 = element("div");
    			div90 = element("div");
    			div86 = element("div");
    			h67 = element("h6");
    			strong7 = element("strong");
    			strong7.textContent = "Чашечка";
    			t72 = space();
    			p14 = element("p");
    			p14.textContent = "Сосуд используется для непосредственного питья горячих напитков. В некоторых культурах из чашек принято также есть, во многих\n                    странах Азии распространена чашка без ручки.";
    			t74 = space();
    			div88 = element("div");
    			p15 = element("p");
    			p15.textContent = "$29";
    			t76 = space();
    			div87 = element("div");
    			a7 = element("a");
    			a7.textContent = "Подарить";
    			t78 = space();
    			div89 = element("div");
    			t79 = space();
    			div107 = element("div");
    			div106 = element("div");
    			div105 = element("div");
    			div97 = element("div");
    			div96 = element("div");
    			img8 = element("img");
    			t80 = space();
    			div104 = element("div");
    			div103 = element("div");
    			div102 = element("div");
    			div98 = element("div");
    			h68 = element("h6");
    			strong8 = element("strong");
    			strong8.textContent = "Вишенки";
    			t82 = space();
    			p16 = element("p");
    			p16.textContent = "Русское слово «вишня» считается общеславянским производным от той же основы, что и нем. Weichsel «вишня», лат. viscum «птичий\n                    клей».";
    			t84 = space();
    			div100 = element("div");
    			p17 = element("p");
    			p17.textContent = "$29";
    			t86 = space();
    			div99 = element("div");
    			a8 = element("a");
    			a8.textContent = "Подарить";
    			t88 = space();
    			div101 = element("div");
    			if (!src_url_equal(img0.src, img0_src_value = "assets/images/product1.jpg")) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "");
    			add_location(img0, file$1, 30, 14, 719);
    			attr_dev(div0, "class", "image-wrapper");
    			add_location(div0, file$1, 29, 12, 677);
    			attr_dev(div1, "class", "col-12 col-md-4");
    			add_location(div1, file$1, 28, 10, 635);
    			add_location(strong0, file$1, 38, 20, 1033);
    			attr_dev(h60, "class", "card-title mbr-fonts-style display-5");
    			add_location(h60, file$1, 37, 18, 963);
    			attr_dev(p0, "class", "mbr-text mbr-fonts-style display-7");
    			add_location(p0, file$1, 40, 18, 1099);
    			attr_dev(div2, "class", "col-md");
    			add_location(div2, file$1, 36, 16, 924);
    			attr_dev(p1, "class", "price mbr-fonts-style display-2");
    			add_location(p1, file$1, 46, 18, 1452);
    			attr_dev(a0, "href", "index.html");
    			attr_dev(a0, "class", "btn btn-primary display-4");
    			add_location(a0, file$1, 47, 47, 1550);
    			attr_dev(div3, "class", "mbr-section-btn");
    			add_location(div3, file$1, 47, 18, 1521);
    			attr_dev(div4, "class", "col-md-auto");
    			add_location(div4, file$1, 45, 16, 1408);
    			add_location(div5, file$1, 49, 16, 1664);
    			attr_dev(div6, "class", "row");
    			add_location(div6, file$1, 35, 14, 890);
    			attr_dev(div7, "class", "card-box");
    			add_location(div7, file$1, 34, 12, 853);
    			attr_dev(div8, "class", "col-12 col-md");
    			add_location(div8, file$1, 33, 10, 813);
    			attr_dev(div9, "class", "row align-items-center");
    			add_location(div9, file$1, 27, 8, 588);
    			attr_dev(div10, "class", "card-wrapper");
    			add_location(div10, file$1, 26, 6, 553);
    			attr_dev(div11, "class", "card");
    			add_location(div11, file$1, 25, 4, 528);
    			if (!src_url_equal(img1.src, img1_src_value = "assets/images/product2.jpg")) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "");
    			add_location(img1, file$1, 61, 14, 1967);
    			attr_dev(div12, "class", "image-wrapper");
    			add_location(div12, file$1, 60, 12, 1925);
    			attr_dev(div13, "class", "col-12 col-md-4");
    			add_location(div13, file$1, 59, 10, 1883);
    			add_location(strong1, file$1, 69, 20, 2281);
    			attr_dev(h61, "class", "card-title mbr-fonts-style display-5");
    			add_location(h61, file$1, 68, 18, 2211);
    			attr_dev(p2, "class", "mbr-text mbr-fonts-style display-7");
    			add_location(p2, file$1, 71, 18, 2348);
    			attr_dev(div14, "class", "col-md");
    			add_location(div14, file$1, 67, 16, 2172);
    			attr_dev(p3, "class", "price mbr-fonts-style display-2");
    			add_location(p3, file$1, 77, 18, 2712);
    			attr_dev(a1, "href", "index.html");
    			attr_dev(a1, "class", "btn btn-primary display-4");
    			add_location(a1, file$1, 78, 47, 2810);
    			attr_dev(div15, "class", "mbr-section-btn");
    			add_location(div15, file$1, 78, 18, 2781);
    			attr_dev(div16, "class", "col-md-auto");
    			add_location(div16, file$1, 76, 16, 2668);
    			add_location(div17, file$1, 80, 16, 2924);
    			attr_dev(div18, "class", "row");
    			add_location(div18, file$1, 66, 14, 2138);
    			attr_dev(div19, "class", "card-box");
    			add_location(div19, file$1, 65, 12, 2101);
    			attr_dev(div20, "class", "col-12 col-md");
    			add_location(div20, file$1, 64, 10, 2061);
    			attr_dev(div21, "class", "row align-items-center");
    			add_location(div21, file$1, 58, 8, 1836);
    			attr_dev(div22, "class", "card-wrapper");
    			add_location(div22, file$1, 57, 6, 1801);
    			attr_dev(div23, "class", "card");
    			add_location(div23, file$1, 56, 4, 1776);
    			if (!src_url_equal(img2.src, img2_src_value = "assets/images/product3.jpg")) attr_dev(img2, "src", img2_src_value);
    			attr_dev(img2, "alt", "");
    			add_location(img2, file$1, 92, 14, 3227);
    			attr_dev(div24, "class", "image-wrapper");
    			add_location(div24, file$1, 91, 12, 3185);
    			attr_dev(div25, "class", "col-12 col-md-4");
    			add_location(div25, file$1, 90, 10, 3143);
    			add_location(strong2, file$1, 100, 20, 3541);
    			attr_dev(h62, "class", "card-title mbr-fonts-style display-5");
    			add_location(h62, file$1, 99, 18, 3471);
    			attr_dev(p4, "class", "mbr-text mbr-fonts-style display-7");
    			add_location(p4, file$1, 102, 18, 3608);
    			attr_dev(div26, "class", "col-md");
    			add_location(div26, file$1, 98, 16, 3432);
    			attr_dev(p5, "class", "price mbr-fonts-style display-2");
    			add_location(p5, file$1, 108, 18, 3934);
    			attr_dev(a2, "href", "index.html");
    			attr_dev(a2, "class", "btn btn-primary display-4");
    			add_location(a2, file$1, 109, 47, 4032);
    			attr_dev(div27, "class", "mbr-section-btn");
    			add_location(div27, file$1, 109, 18, 4003);
    			attr_dev(div28, "class", "col-md-auto");
    			add_location(div28, file$1, 107, 16, 3890);
    			add_location(div29, file$1, 111, 16, 4146);
    			attr_dev(div30, "class", "row");
    			add_location(div30, file$1, 97, 14, 3398);
    			attr_dev(div31, "class", "card-box");
    			add_location(div31, file$1, 96, 12, 3361);
    			attr_dev(div32, "class", "col-12 col-md");
    			add_location(div32, file$1, 95, 10, 3321);
    			attr_dev(div33, "class", "row align-items-center");
    			add_location(div33, file$1, 89, 8, 3096);
    			attr_dev(div34, "class", "card-wrapper");
    			add_location(div34, file$1, 88, 6, 3061);
    			attr_dev(div35, "class", "card");
    			add_location(div35, file$1, 87, 4, 3036);
    			if (!src_url_equal(img3.src, img3_src_value = "assets/images/product1.jpg")) attr_dev(img3, "src", img3_src_value);
    			attr_dev(img3, "alt", "");
    			add_location(img3, file$1, 123, 14, 4449);
    			attr_dev(div36, "class", "image-wrapper");
    			add_location(div36, file$1, 122, 12, 4407);
    			attr_dev(div37, "class", "col-12 col-md-4");
    			add_location(div37, file$1, 121, 10, 4365);
    			add_location(strong3, file$1, 131, 20, 4763);
    			attr_dev(h63, "class", "card-title mbr-fonts-style display-5");
    			add_location(h63, file$1, 130, 18, 4693);
    			attr_dev(p6, "class", "mbr-text mbr-fonts-style display-7");
    			add_location(p6, file$1, 133, 18, 4829);
    			attr_dev(div38, "class", "col-md");
    			add_location(div38, file$1, 129, 16, 4654);
    			attr_dev(p7, "class", "price mbr-fonts-style display-2");
    			add_location(p7, file$1, 139, 18, 5182);
    			attr_dev(a3, "href", "index.html");
    			attr_dev(a3, "class", "btn btn-primary display-4");
    			add_location(a3, file$1, 140, 47, 5280);
    			attr_dev(div39, "class", "mbr-section-btn");
    			add_location(div39, file$1, 140, 18, 5251);
    			attr_dev(div40, "class", "col-md-auto");
    			add_location(div40, file$1, 138, 16, 5138);
    			add_location(div41, file$1, 142, 16, 5394);
    			attr_dev(div42, "class", "row");
    			add_location(div42, file$1, 128, 14, 4620);
    			attr_dev(div43, "class", "card-box");
    			add_location(div43, file$1, 127, 12, 4583);
    			attr_dev(div44, "class", "col-12 col-md");
    			add_location(div44, file$1, 126, 10, 4543);
    			attr_dev(div45, "class", "row align-items-center");
    			add_location(div45, file$1, 120, 8, 4318);
    			attr_dev(div46, "class", "card-wrapper");
    			add_location(div46, file$1, 119, 6, 4283);
    			attr_dev(div47, "class", "card");
    			add_location(div47, file$1, 118, 4, 4258);
    			if (!src_url_equal(img4.src, img4_src_value = "assets/images/product2.jpg")) attr_dev(img4, "src", img4_src_value);
    			attr_dev(img4, "alt", "");
    			add_location(img4, file$1, 154, 14, 5697);
    			attr_dev(div48, "class", "image-wrapper");
    			add_location(div48, file$1, 153, 12, 5655);
    			attr_dev(div49, "class", "col-12 col-md-4");
    			add_location(div49, file$1, 152, 10, 5613);
    			add_location(strong4, file$1, 162, 20, 6011);
    			attr_dev(h64, "class", "card-title mbr-fonts-style display-5");
    			add_location(h64, file$1, 161, 18, 5941);
    			attr_dev(p8, "class", "mbr-text mbr-fonts-style display-7");
    			add_location(p8, file$1, 164, 18, 6078);
    			attr_dev(div50, "class", "col-md");
    			add_location(div50, file$1, 160, 16, 5902);
    			attr_dev(p9, "class", "price mbr-fonts-style display-2");
    			add_location(p9, file$1, 170, 18, 6442);
    			attr_dev(a4, "href", "index.html");
    			attr_dev(a4, "class", "btn btn-primary display-4");
    			add_location(a4, file$1, 171, 47, 6540);
    			attr_dev(div51, "class", "mbr-section-btn");
    			add_location(div51, file$1, 171, 18, 6511);
    			attr_dev(div52, "class", "col-md-auto");
    			add_location(div52, file$1, 169, 16, 6398);
    			add_location(div53, file$1, 173, 16, 6654);
    			attr_dev(div54, "class", "row");
    			add_location(div54, file$1, 159, 14, 5868);
    			attr_dev(div55, "class", "card-box");
    			add_location(div55, file$1, 158, 12, 5831);
    			attr_dev(div56, "class", "col-12 col-md");
    			add_location(div56, file$1, 157, 10, 5791);
    			attr_dev(div57, "class", "row align-items-center");
    			add_location(div57, file$1, 151, 8, 5566);
    			attr_dev(div58, "class", "card-wrapper");
    			add_location(div58, file$1, 150, 6, 5531);
    			attr_dev(div59, "class", "card");
    			add_location(div59, file$1, 149, 4, 5506);
    			if (!src_url_equal(img5.src, img5_src_value = "assets/images/product3.jpg")) attr_dev(img5, "src", img5_src_value);
    			attr_dev(img5, "alt", "");
    			add_location(img5, file$1, 185, 14, 6957);
    			attr_dev(div60, "class", "image-wrapper");
    			add_location(div60, file$1, 184, 12, 6915);
    			attr_dev(div61, "class", "col-12 col-md-4");
    			add_location(div61, file$1, 183, 10, 6873);
    			add_location(strong5, file$1, 193, 20, 7271);
    			attr_dev(h65, "class", "card-title mbr-fonts-style display-5");
    			add_location(h65, file$1, 192, 18, 7201);
    			attr_dev(p10, "class", "mbr-text mbr-fonts-style display-7");
    			add_location(p10, file$1, 195, 18, 7338);
    			attr_dev(div62, "class", "col-md");
    			add_location(div62, file$1, 191, 16, 7162);
    			attr_dev(p11, "class", "price mbr-fonts-style display-2");
    			add_location(p11, file$1, 201, 18, 7664);
    			attr_dev(a5, "href", "index.html");
    			attr_dev(a5, "class", "btn btn-primary display-4");
    			add_location(a5, file$1, 202, 47, 7762);
    			attr_dev(div63, "class", "mbr-section-btn");
    			add_location(div63, file$1, 202, 18, 7733);
    			attr_dev(div64, "class", "col-md-auto");
    			add_location(div64, file$1, 200, 16, 7620);
    			add_location(div65, file$1, 204, 16, 7876);
    			attr_dev(div66, "class", "row");
    			add_location(div66, file$1, 190, 14, 7128);
    			attr_dev(div67, "class", "card-box");
    			add_location(div67, file$1, 189, 12, 7091);
    			attr_dev(div68, "class", "col-12 col-md");
    			add_location(div68, file$1, 188, 10, 7051);
    			attr_dev(div69, "class", "row align-items-center");
    			add_location(div69, file$1, 182, 8, 6826);
    			attr_dev(div70, "class", "card-wrapper");
    			add_location(div70, file$1, 181, 6, 6791);
    			attr_dev(div71, "class", "card");
    			add_location(div71, file$1, 180, 4, 6766);
    			if (!src_url_equal(img6.src, img6_src_value = "assets/images/product1.jpg")) attr_dev(img6, "src", img6_src_value);
    			attr_dev(img6, "alt", "");
    			add_location(img6, file$1, 216, 14, 8179);
    			attr_dev(div72, "class", "image-wrapper");
    			add_location(div72, file$1, 215, 12, 8137);
    			attr_dev(div73, "class", "col-12 col-md-4");
    			add_location(div73, file$1, 214, 10, 8095);
    			add_location(strong6, file$1, 224, 20, 8493);
    			attr_dev(h66, "class", "card-title mbr-fonts-style display-5");
    			add_location(h66, file$1, 223, 18, 8423);
    			attr_dev(p12, "class", "mbr-text mbr-fonts-style display-7");
    			add_location(p12, file$1, 226, 18, 8559);
    			attr_dev(div74, "class", "col-md");
    			add_location(div74, file$1, 222, 16, 8384);
    			attr_dev(p13, "class", "price mbr-fonts-style display-2");
    			add_location(p13, file$1, 232, 18, 8912);
    			attr_dev(a6, "href", "index.html");
    			attr_dev(a6, "class", "btn btn-primary display-4");
    			add_location(a6, file$1, 233, 47, 9010);
    			attr_dev(div75, "class", "mbr-section-btn");
    			add_location(div75, file$1, 233, 18, 8981);
    			attr_dev(div76, "class", "col-md-auto");
    			add_location(div76, file$1, 231, 16, 8868);
    			add_location(div77, file$1, 235, 16, 9124);
    			attr_dev(div78, "class", "row");
    			add_location(div78, file$1, 221, 14, 8350);
    			attr_dev(div79, "class", "card-box");
    			add_location(div79, file$1, 220, 12, 8313);
    			attr_dev(div80, "class", "col-12 col-md");
    			add_location(div80, file$1, 219, 10, 8273);
    			attr_dev(div81, "class", "row align-items-center");
    			add_location(div81, file$1, 213, 8, 8048);
    			attr_dev(div82, "class", "card-wrapper");
    			add_location(div82, file$1, 212, 6, 8013);
    			attr_dev(div83, "class", "card");
    			add_location(div83, file$1, 211, 4, 7988);
    			if (!src_url_equal(img7.src, img7_src_value = "assets/images/product2.jpg")) attr_dev(img7, "src", img7_src_value);
    			attr_dev(img7, "alt", "");
    			add_location(img7, file$1, 247, 14, 9427);
    			attr_dev(div84, "class", "image-wrapper");
    			add_location(div84, file$1, 246, 12, 9385);
    			attr_dev(div85, "class", "col-12 col-md-4");
    			add_location(div85, file$1, 245, 10, 9343);
    			add_location(strong7, file$1, 255, 20, 9741);
    			attr_dev(h67, "class", "card-title mbr-fonts-style display-5");
    			add_location(h67, file$1, 254, 18, 9671);
    			attr_dev(p14, "class", "mbr-text mbr-fonts-style display-7");
    			add_location(p14, file$1, 257, 18, 9808);
    			attr_dev(div86, "class", "col-md");
    			add_location(div86, file$1, 253, 16, 9632);
    			attr_dev(p15, "class", "price mbr-fonts-style display-2");
    			add_location(p15, file$1, 263, 18, 10172);
    			attr_dev(a7, "href", "index.html");
    			attr_dev(a7, "class", "btn btn-primary display-4");
    			add_location(a7, file$1, 264, 47, 10270);
    			attr_dev(div87, "class", "mbr-section-btn");
    			add_location(div87, file$1, 264, 18, 10241);
    			attr_dev(div88, "class", "col-md-auto");
    			add_location(div88, file$1, 262, 16, 10128);
    			add_location(div89, file$1, 266, 16, 10384);
    			attr_dev(div90, "class", "row");
    			add_location(div90, file$1, 252, 14, 9598);
    			attr_dev(div91, "class", "card-box");
    			add_location(div91, file$1, 251, 12, 9561);
    			attr_dev(div92, "class", "col-12 col-md");
    			add_location(div92, file$1, 250, 10, 9521);
    			attr_dev(div93, "class", "row align-items-center");
    			add_location(div93, file$1, 244, 8, 9296);
    			attr_dev(div94, "class", "card-wrapper");
    			add_location(div94, file$1, 243, 6, 9261);
    			attr_dev(div95, "class", "card");
    			add_location(div95, file$1, 242, 4, 9236);
    			if (!src_url_equal(img8.src, img8_src_value = "assets/images/product3.jpg")) attr_dev(img8, "src", img8_src_value);
    			attr_dev(img8, "alt", "");
    			add_location(img8, file$1, 278, 14, 10687);
    			attr_dev(div96, "class", "image-wrapper");
    			add_location(div96, file$1, 277, 12, 10645);
    			attr_dev(div97, "class", "col-12 col-md-4");
    			add_location(div97, file$1, 276, 10, 10603);
    			add_location(strong8, file$1, 286, 20, 11001);
    			attr_dev(h68, "class", "card-title mbr-fonts-style display-5");
    			add_location(h68, file$1, 285, 18, 10931);
    			attr_dev(p16, "class", "mbr-text mbr-fonts-style display-7");
    			add_location(p16, file$1, 288, 18, 11068);
    			attr_dev(div98, "class", "col-md");
    			add_location(div98, file$1, 284, 16, 10892);
    			attr_dev(p17, "class", "price mbr-fonts-style display-2");
    			add_location(p17, file$1, 294, 18, 11394);
    			attr_dev(a8, "href", "index.html");
    			attr_dev(a8, "class", "btn btn-primary display-4");
    			add_location(a8, file$1, 295, 47, 11492);
    			attr_dev(div99, "class", "mbr-section-btn");
    			add_location(div99, file$1, 295, 18, 11463);
    			attr_dev(div100, "class", "col-md-auto");
    			add_location(div100, file$1, 293, 16, 11350);
    			add_location(div101, file$1, 297, 16, 11606);
    			attr_dev(div102, "class", "row");
    			add_location(div102, file$1, 283, 14, 10858);
    			attr_dev(div103, "class", "card-box");
    			add_location(div103, file$1, 282, 12, 10821);
    			attr_dev(div104, "class", "col-12 col-md");
    			add_location(div104, file$1, 281, 10, 10781);
    			attr_dev(div105, "class", "row align-items-center");
    			add_location(div105, file$1, 275, 8, 10556);
    			attr_dev(div106, "class", "card-wrapper");
    			add_location(div106, file$1, 274, 6, 10521);
    			attr_dev(div107, "class", "card");
    			add_location(div107, file$1, 273, 4, 10496);
    			attr_dev(div108, "class", "container");
    			add_location(div108, file$1, 24, 2, 500);
    			attr_dev(section, "class", "features8 cid-shi8I9qCDA");
    			attr_dev(section, "id", "features9-2");
    			add_location(section, file$1, 23, 0, 438);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, div108);
    			append_dev(div108, div11);
    			append_dev(div11, div10);
    			append_dev(div10, div9);
    			append_dev(div9, div1);
    			append_dev(div1, div0);
    			append_dev(div0, img0);
    			append_dev(div9, t0);
    			append_dev(div9, div8);
    			append_dev(div8, div7);
    			append_dev(div7, div6);
    			append_dev(div6, div2);
    			append_dev(div2, h60);
    			append_dev(h60, strong0);
    			append_dev(div2, t2);
    			append_dev(div2, p0);
    			append_dev(div6, t4);
    			append_dev(div6, div4);
    			append_dev(div4, p1);
    			append_dev(div4, t6);
    			append_dev(div4, div3);
    			append_dev(div3, a0);
    			append_dev(div6, t8);
    			append_dev(div6, div5);
    			append_dev(div108, t9);
    			append_dev(div108, div23);
    			append_dev(div23, div22);
    			append_dev(div22, div21);
    			append_dev(div21, div13);
    			append_dev(div13, div12);
    			append_dev(div12, img1);
    			append_dev(div21, t10);
    			append_dev(div21, div20);
    			append_dev(div20, div19);
    			append_dev(div19, div18);
    			append_dev(div18, div14);
    			append_dev(div14, h61);
    			append_dev(h61, strong1);
    			append_dev(div14, t12);
    			append_dev(div14, p2);
    			append_dev(div18, t14);
    			append_dev(div18, div16);
    			append_dev(div16, p3);
    			append_dev(div16, t16);
    			append_dev(div16, div15);
    			append_dev(div15, a1);
    			append_dev(div18, t18);
    			append_dev(div18, div17);
    			append_dev(div108, t19);
    			append_dev(div108, div35);
    			append_dev(div35, div34);
    			append_dev(div34, div33);
    			append_dev(div33, div25);
    			append_dev(div25, div24);
    			append_dev(div24, img2);
    			append_dev(div33, t20);
    			append_dev(div33, div32);
    			append_dev(div32, div31);
    			append_dev(div31, div30);
    			append_dev(div30, div26);
    			append_dev(div26, h62);
    			append_dev(h62, strong2);
    			append_dev(div26, t22);
    			append_dev(div26, p4);
    			append_dev(div30, t24);
    			append_dev(div30, div28);
    			append_dev(div28, p5);
    			append_dev(div28, t26);
    			append_dev(div28, div27);
    			append_dev(div27, a2);
    			append_dev(div30, t28);
    			append_dev(div30, div29);
    			append_dev(div108, t29);
    			append_dev(div108, div47);
    			append_dev(div47, div46);
    			append_dev(div46, div45);
    			append_dev(div45, div37);
    			append_dev(div37, div36);
    			append_dev(div36, img3);
    			append_dev(div45, t30);
    			append_dev(div45, div44);
    			append_dev(div44, div43);
    			append_dev(div43, div42);
    			append_dev(div42, div38);
    			append_dev(div38, h63);
    			append_dev(h63, strong3);
    			append_dev(div38, t32);
    			append_dev(div38, p6);
    			append_dev(div42, t34);
    			append_dev(div42, div40);
    			append_dev(div40, p7);
    			append_dev(div40, t36);
    			append_dev(div40, div39);
    			append_dev(div39, a3);
    			append_dev(div42, t38);
    			append_dev(div42, div41);
    			append_dev(div108, t39);
    			append_dev(div108, div59);
    			append_dev(div59, div58);
    			append_dev(div58, div57);
    			append_dev(div57, div49);
    			append_dev(div49, div48);
    			append_dev(div48, img4);
    			append_dev(div57, t40);
    			append_dev(div57, div56);
    			append_dev(div56, div55);
    			append_dev(div55, div54);
    			append_dev(div54, div50);
    			append_dev(div50, h64);
    			append_dev(h64, strong4);
    			append_dev(div50, t42);
    			append_dev(div50, p8);
    			append_dev(div54, t44);
    			append_dev(div54, div52);
    			append_dev(div52, p9);
    			append_dev(div52, t46);
    			append_dev(div52, div51);
    			append_dev(div51, a4);
    			append_dev(div54, t48);
    			append_dev(div54, div53);
    			append_dev(div108, t49);
    			append_dev(div108, div71);
    			append_dev(div71, div70);
    			append_dev(div70, div69);
    			append_dev(div69, div61);
    			append_dev(div61, div60);
    			append_dev(div60, img5);
    			append_dev(div69, t50);
    			append_dev(div69, div68);
    			append_dev(div68, div67);
    			append_dev(div67, div66);
    			append_dev(div66, div62);
    			append_dev(div62, h65);
    			append_dev(h65, strong5);
    			append_dev(div62, t52);
    			append_dev(div62, p10);
    			append_dev(div66, t54);
    			append_dev(div66, div64);
    			append_dev(div64, p11);
    			append_dev(div64, t56);
    			append_dev(div64, div63);
    			append_dev(div63, a5);
    			append_dev(div66, t58);
    			append_dev(div66, div65);
    			append_dev(div108, t59);
    			append_dev(div108, div83);
    			append_dev(div83, div82);
    			append_dev(div82, div81);
    			append_dev(div81, div73);
    			append_dev(div73, div72);
    			append_dev(div72, img6);
    			append_dev(div81, t60);
    			append_dev(div81, div80);
    			append_dev(div80, div79);
    			append_dev(div79, div78);
    			append_dev(div78, div74);
    			append_dev(div74, h66);
    			append_dev(h66, strong6);
    			append_dev(div74, t62);
    			append_dev(div74, p12);
    			append_dev(div78, t64);
    			append_dev(div78, div76);
    			append_dev(div76, p13);
    			append_dev(div76, t66);
    			append_dev(div76, div75);
    			append_dev(div75, a6);
    			append_dev(div78, t68);
    			append_dev(div78, div77);
    			append_dev(div108, t69);
    			append_dev(div108, div95);
    			append_dev(div95, div94);
    			append_dev(div94, div93);
    			append_dev(div93, div85);
    			append_dev(div85, div84);
    			append_dev(div84, img7);
    			append_dev(div93, t70);
    			append_dev(div93, div92);
    			append_dev(div92, div91);
    			append_dev(div91, div90);
    			append_dev(div90, div86);
    			append_dev(div86, h67);
    			append_dev(h67, strong7);
    			append_dev(div86, t72);
    			append_dev(div86, p14);
    			append_dev(div90, t74);
    			append_dev(div90, div88);
    			append_dev(div88, p15);
    			append_dev(div88, t76);
    			append_dev(div88, div87);
    			append_dev(div87, a7);
    			append_dev(div90, t78);
    			append_dev(div90, div89);
    			append_dev(div108, t79);
    			append_dev(div108, div107);
    			append_dev(div107, div106);
    			append_dev(div106, div105);
    			append_dev(div105, div97);
    			append_dev(div97, div96);
    			append_dev(div96, img8);
    			append_dev(div105, t80);
    			append_dev(div105, div104);
    			append_dev(div104, div103);
    			append_dev(div103, div102);
    			append_dev(div102, div98);
    			append_dev(div98, h68);
    			append_dev(h68, strong8);
    			append_dev(div98, t82);
    			append_dev(div98, p16);
    			append_dev(div102, t84);
    			append_dev(div102, div100);
    			append_dev(div100, p17);
    			append_dev(div100, t86);
    			append_dev(div100, div99);
    			append_dev(div99, a8);
    			append_dev(div102, t88);
    			append_dev(div102, div101);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const urlConfiguration = "https://localhost:5001/user/stream/0";

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Stream', slots, []);

    	const loadServerData = callback => {
    		console.log("Load Server Data...");

    		Server.fetchWeb(urlConfiguration, value => {
    			console.log("Loaded.");
    			if (callback) callback(value);
    		});
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Stream> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Server, urlConfiguration, loadServerData });
    	return [];
    }

    class Stream extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Stream",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src/components/Footer.svelte generated by Svelte v3.42.1 */

    const file = "src/components/Footer.svelte";

    function create_fragment$2(ctx) {
    	let section;
    	let div2;
    	let div1;
    	let div0;
    	let p;

    	const block = {
    		c: function create() {
    			section = element("section");
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			p = element("p");
    			p.textContent = `©${new Date().getFullYear()} WishDate - All Rights Reserved`;
    			attr_dev(p, "class", "mbr-text mb-0 mbr-fonts-style display-7");
    			add_location(p, file, 8, 8, 229);
    			attr_dev(div0, "class", "col-12");
    			add_location(div0, file, 7, 6, 200);
    			attr_dev(div1, "class", "media-container-row align-center mbr-white");
    			add_location(div1, file, 6, 4, 137);
    			attr_dev(div2, "class", "container");
    			add_location(div2, file, 5, 2, 109);
    			attr_dev(section, "class", "footer7 cid-shieg1OXdb");
    			attr_dev(section, "once", "footers");
    			attr_dev(section, "id", "footer7-3");
    			add_location(section, file, 4, 0, 36);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, div2);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div0, p);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Footer', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Footer> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Footer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Footer",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src/components/Application.svelte generated by Svelte v3.42.1 */

    function create_fragment$1(ctx) {
    	let menu;
    	let t0;
    	let header;
    	let t1;
    	let stream;
    	let t2;
    	let footer;
    	let current;
    	menu = new Menu({ $$inline: true });
    	header = new Header({ $$inline: true });
    	stream = new Stream({ $$inline: true });
    	footer = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(menu.$$.fragment);
    			t0 = space();
    			create_component(header.$$.fragment);
    			t1 = space();
    			create_component(stream.$$.fragment);
    			t2 = space();
    			create_component(footer.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(menu, target, anchor);
    			insert_dev(target, t0, anchor);
    			mount_component(header, target, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(stream, target, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(footer, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(menu.$$.fragment, local);
    			transition_in(header.$$.fragment, local);
    			transition_in(stream.$$.fragment, local);
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(menu.$$.fragment, local);
    			transition_out(header.$$.fragment, local);
    			transition_out(stream.$$.fragment, local);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(menu, detaching);
    			if (detaching) detach_dev(t0);
    			destroy_component(header, detaching);
    			if (detaching) detach_dev(t1);
    			destroy_component(stream, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(footer, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Application', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Application> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Menu, Header, Stream, Footer });
    	return [];
    }

    class Application extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Application",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.42.1 */

    function create_fragment(ctx) {
    	let application;
    	let current;
    	application = new Application({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(application.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(application, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(application.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(application.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(application, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	setupApp();
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		onMount,
    		appConfig,
    		setupApp,
    		Application
    	});

    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const target = document.body;

    const app = new App({
      target: target,
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
