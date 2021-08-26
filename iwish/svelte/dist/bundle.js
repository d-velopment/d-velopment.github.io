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
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function append_styles(target, style_sheet_id, styles) {
        const append_styles_to = get_root_for_style(target);
        if (!append_styles_to.getElementById(style_sheet_id)) {
            const style = element('style');
            style.id = style_sheet_id;
            style.textContent = styles;
            append_stylesheet(append_styles_to, style);
        }
    }
    function get_root_for_style(node) {
        if (!node)
            return document;
        const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
        if (root.host) {
            return root;
        }
        return document;
    }
    function append_stylesheet(node, style) {
        append(node.head || node, style);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
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
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
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
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
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

    const urlAuth = "https://localhost:5001/user/authenticate";
    const urlStream = "https://localhost:5001/user/stream/"; // 0 - INITIAL PAGE

    const appUserStructure = {
      id: null,
      firstName: "",
      lastName: "",
      username: "",
      jwtToken: null,
    };
    const appUser = writable(appUserStructure);

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
          Authorization: `${isNullOrEmpty(token) ? "" : "Bearer " + token}`,
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

    const fetchGet = async (url, token, callback) => {
      if (isNullOrEmpty(url.trim())) return
      const settings = {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `${isNullOrEmpty(token) ? "" : "Bearer " + token}`,
        },
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
      fetchGet: fetchGet,
      fetchWeb: fetchWeb,
      callWebAPI: callWebAPI,
      pingWebAPI: pingWebAPI,
    };

    /* src/helpers/Loader.svelte generated by Svelte v3.42.1 */

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

    const { Object: Object_1, console: console_1 } = globals;
    const file$1 = "src/components/Stream.svelte";

    function add_css(target) {
    	append_styles(target, "svelte-152tipk", "sup.svelte-152tipk{font-size:1.2rem;font-weight:500}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU3RyZWFtLnN2ZWx0ZSIsInNvdXJjZXMiOlsiU3RyZWFtLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxuICBpbXBvcnQgU2VydmVyIGZyb20gXCIuLi9oZWxwZXJzL3NlcnZlci5qc1wiXG4gIGltcG9ydCB7IHVybFN0cmVhbSwgYXBwVXNlciB9IGZyb20gXCIuLi9zdG9yZXMvc2V0dXAuanNcIlxuXG4gIGNvbnN0IGZvcm1hdERhdGUgPSAoZGF0ZSkgPT4ge1xuICAgIGNvbnN0IGV2ZW50RGF0ZSA9IG5ldyBEYXRlKGRhdGUpXG4gICAgY29uc3QgbW9udGhOYW1lcyA9IFtcItCv0L3QstCw0YDRj1wiLCBcItCk0LXQstGA0LDQu9GPXCIsIFwi0JzQsNGA0YLQsFwiLCBcItCQ0L/RgNC10LvRj1wiLCBcItCc0LDRj1wiLCBcItCY0Y7QvdGPXCIsIFwi0JjRjtC70Y9cIiwgXCLQkNCy0LPRg9GB0YLQsFwiLCBcItCh0LXQvdGC0Y/QsdGA0Y9cIiwgXCLQntC60YLRj9Cx0YDRj1wiLCBcItCd0L7Rj9Cx0YDRj1wiLCBcItCU0LXQutCw0LHRgNGPXCJdXG4gICAgcmV0dXJuIGBcbiAgICAgICR7ZXZlbnREYXRlLmdldERhdGUoKX1cbiAgICAgICR7bW9udGhOYW1lc1tldmVudERhdGUuZ2V0TW9udGgoKV19XG4gICAgICAke2V2ZW50RGF0ZS5nZXRGdWxsWWVhcigpfVxuICAgICAg0LPQvtC00LBcbiAgICBgXG4gIH1cblxuICBsZXQgcGFnZUluZGV4ID0gMFxuICBsZXQgc3RyZWFtRGljdGlvbmFyeSA9IHt9XG4gIGxldCBzdHJlYW1TaG93ID0gW11cblxuICAvLyBMT0FEIFNUUkVBTSBEQVRBXG4gIGNvbnN0IGxvYWRTdHJlYW1QYWdlID0gKHBhZ2UsIHRva2VuLCBjYWxsYmFjaykgPT4ge1xuICAgIGlmICh0b2tlbiA9PSBudWxsKSByZXR1cm5cbiAgICBTZXJ2ZXIuZmV0Y2hHZXQoYCR7dXJsU3RyZWFtfSR7cGFnZX1gLCB0b2tlbiwgKHZhbHVlKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhcIkxvYWQgU3RyZWFtIFBhZ2UgI1wiLCBwYWdlKVxuXG4gICAgICBjb25zdCBjb21waWxlZFZhbHVlID0gKDAsIGV2YWwpKGAoJHt2YWx1ZS5kZXRhaWxzfSlgKVxuICAgICAgc3RyZWFtRGljdGlvbmFyeVtwYWdlXSA9IGNvbXBpbGVkVmFsdWVcbiAgICAgIHN0cmVhbVNob3cgPSBPYmplY3Qua2V5cyhzdHJlYW1EaWN0aW9uYXJ5KS5yZWR1Y2UoZnVuY3Rpb24gKHIsIGspIHtcbiAgICAgICAgcmV0dXJuIHIuY29uY2F0KHN0cmVhbURpY3Rpb25hcnlba10pXG4gICAgICB9LCBbXSlcblxuICAgICAgY29uc29sZS5sb2coXCJMb2FkZWQgc3RyZWFtIGVsZW1lbnRzXCIsIHN0cmVhbVNob3cpXG5cbiAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sodmFsdWUpXG4gICAgfSlcbiAgfVxuXG4gIGxldCB1c2VyRGV0YWlsc1xuICBhcHBVc2VyLnN1YnNjcmliZSgodmFsdWUpID0+IHtcbiAgICB1c2VyRGV0YWlscyA9IHZhbHVlXG5cbiAgICBsb2FkU3RyZWFtUGFnZShwYWdlSW5kZXgsIHVzZXJEZXRhaWxzLmp3dFRva2VuLCAodmFsdWUpID0+IHtcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4gbG9hZFN0cmVhbVBhZ2UocGFnZUluZGV4ICsgMSwgdXNlckRldGFpbHMuand0VG9rZW4pLCAyMDAwKVxuICAgIH0pXG4gIH0pXG48L3NjcmlwdD5cblxuPHN0eWxlPlxuICBzdXAge1xuICAgIGZvbnQtc2l6ZTogMS4ycmVtO1xuICAgIGZvbnQtd2VpZ2h0OiA1MDA7XG4gIH1cbjwvc3R5bGU+XG5cbjxzZWN0aW9uIGNsYXNzPVwiZmVhdHVyZXM4IGNpZC1zaGk4STlxQ0RBXCIgaWQ9XCJmZWF0dXJlczktMlwiPlxuICA8ZGl2IGNsYXNzPVwiY29udGFpbmVyXCI+XG4gICAgeyNlYWNoIHN0cmVhbVNob3cgYXMgY2FyZCwgaX1cbiAgICAgIDxkaXYgY2xhc3M9XCJjYXJkXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJjYXJkLXdyYXBwZXJcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwicm93IGFsaWduLWl0ZW1zLWNlbnRlclwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbC0xMiBjb2wtbWQtNFwiPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaW1hZ2Utd3JhcHBlclwiIHN0eWxlPVwiYmFja2dyb3VuZC1pbWFnZTogdXJsKCd7Y2FyZC5JbWFnZX0nKTtcIj5cbiAgICAgICAgICAgICAgICA8IS0taW1nIHNyYz1cIntjYXJkLkltYWdlfVwiIGFsdD1cIntjYXJkLlRpdGxlfVwiIC8tLT5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb2wtMTIgY29sLW1kXCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjYXJkLWJveFwiPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJyb3dcIj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb2wtbWRcIj5cbiAgICAgICAgICAgICAgICAgICAgPGg2IGNsYXNzPVwiY2FyZC10aXRsZSBtYnItZm9udHMtc3R5bGUgZGlzcGxheS01XCI+XG4gICAgICAgICAgICAgICAgICAgICAgPHN0cm9uZz57Y2FyZC5UaXRsZX08L3N0cm9uZz5cbiAgICAgICAgICAgICAgICAgICAgPC9oNj5cbiAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJtYnItdGV4dCBtYnItZm9udHMtc3R5bGUgZ3JleSBib3R0b20tbGVzc1wiPlxuICAgICAgICAgICAgICAgICAgICAgIHtjYXJkLkZyaWVuZEZpcnN0TmFtZX1cbiAgICAgICAgICAgICAgICAgICAgICB7Y2FyZC5GcmllbmRMYXN0TmFtZX0sXG4gICAgICAgICAgICAgICAgICAgICAge2Zvcm1hdERhdGUoY2FyZC5FdmVudERhdGUpfVxuICAgICAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwibWJyLXRleHQgbWJyLWZvbnRzLXN0eWxlIGRpc3BsYXktN1wiPlxuICAgICAgICAgICAgICAgICAgICAgIHtjYXJkLkRlc2NyaXB0aW9uMX1cbiAgICAgICAgICAgICAgICAgICAgICA8aVxuICAgICAgICAgICAgICAgICAgICAgICAgPtC90LBcbiAgICAgICAgICAgICAgICAgICAgICAgIHtjYXJkLkV2ZW50VGl0bGV9XG4gICAgICAgICAgICAgICAgICAgICAgICB7bmV3IERhdGUoY2FyZC5FdmVudERhdGUpLmdldEZ1bGxZZWFyKCkgPT0gbmV3IERhdGUoKS5nZXRGdWxsWWVhcigpICsgMiA/IFwi0YfQtdGA0LXQtyDQs9C+0LRcIiA6IFwiXCJ9XG4gICAgICAgICAgICAgICAgICAgICAgPC9pPlxuICAgICAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb2wtbWQtYXV0b1wiPlxuICAgICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cInByaWNlIG1ici1mb250cy1zdHlsZSBkaXNwbGF5LTJcIj57Y2FyZC5QcmljZX08c3VwPjAwPC9zdXA+PC9wPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWJyLXNlY3Rpb24tYnRuXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPGEgaHJlZj1cImluZGV4Lmh0bWxcIiBjbGFzcz1cImJ0biBidG4tcHJpbWFyeSBkaXNwbGF5LTQge2NhcmQuSXNSZXNlcnZlZCA9PSAxID8gJ2Jsb2NrZWQnIDogJyd9XCJcbiAgICAgICAgICAgICAgICAgICAgICAgID57Y2FyZC5Jc1Jlc2VydmVkID09IDEgPyBcItCR0YDQvtC90YxcIiA6IFwi0J/QvtC00LDRgNC40YLRjFwifTwvYT5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDxkaXY+PC9kaXY+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgey9lYWNofVxuICA8L2Rpdj5cbjwvc2VjdGlvbj5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFnREUsR0FBRyxlQUFDLENBQUMsQUFDSCxTQUFTLENBQUUsTUFBTSxDQUNqQixXQUFXLENBQUUsR0FBRyxBQUNsQixDQUFDIn0= */");
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	child_ctx[8] = i;
    	return child_ctx;
    }

    // (57:4) {#each streamShow as card, i}
    function create_each_block(ctx) {
    	let div11;
    	let div10;
    	let div9;
    	let div1;
    	let div0;
    	let t0;
    	let div8;
    	let div7;
    	let div6;
    	let div2;
    	let h6;
    	let strong;
    	let t1_value = /*card*/ ctx[6].Title + "";
    	let t1;
    	let t2;
    	let p0;
    	let t3_value = /*card*/ ctx[6].FriendFirstName + "";
    	let t3;
    	let t4;
    	let t5_value = /*card*/ ctx[6].FriendLastName + "";
    	let t5;
    	let t6;
    	let t7_value = /*formatDate*/ ctx[1](/*card*/ ctx[6].EventDate) + "";
    	let t7;
    	let t8;
    	let p1;
    	let t9_value = /*card*/ ctx[6].Description1 + "";
    	let t9;
    	let t10;
    	let i_1;
    	let t11;
    	let t12_value = /*card*/ ctx[6].EventTitle + "";
    	let t12;
    	let t13;

    	let t14_value = (new Date(/*card*/ ctx[6].EventDate).getFullYear() == new Date().getFullYear() + 2
    	? "через год"
    	: "") + "";

    	let t14;
    	let t15;
    	let div4;
    	let p2;
    	let t16_value = /*card*/ ctx[6].Price + "";
    	let t16;
    	let sup;
    	let t18;
    	let div3;
    	let a;
    	let t19_value = (/*card*/ ctx[6].IsReserved == 1 ? "Бронь" : "Подарить") + "";
    	let t19;
    	let a_class_value;
    	let t20;
    	let div5;
    	let t21;

    	const block = {
    		c: function create() {
    			div11 = element("div");
    			div10 = element("div");
    			div9 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			t0 = space();
    			div8 = element("div");
    			div7 = element("div");
    			div6 = element("div");
    			div2 = element("div");
    			h6 = element("h6");
    			strong = element("strong");
    			t1 = text(t1_value);
    			t2 = space();
    			p0 = element("p");
    			t3 = text(t3_value);
    			t4 = space();
    			t5 = text(t5_value);
    			t6 = text(",\n                      ");
    			t7 = text(t7_value);
    			t8 = space();
    			p1 = element("p");
    			t9 = text(t9_value);
    			t10 = space();
    			i_1 = element("i");
    			t11 = text("на\n                        ");
    			t12 = text(t12_value);
    			t13 = space();
    			t14 = text(t14_value);
    			t15 = space();
    			div4 = element("div");
    			p2 = element("p");
    			t16 = text(t16_value);
    			sup = element("sup");
    			sup.textContent = "00";
    			t18 = space();
    			div3 = element("div");
    			a = element("a");
    			t19 = text(t19_value);
    			t20 = space();
    			div5 = element("div");
    			t21 = space();
    			attr_dev(div0, "class", "image-wrapper");
    			set_style(div0, "background-image", "url('" + /*card*/ ctx[6].Image + "')");
    			add_location(div0, file$1, 61, 14, 1697);
    			attr_dev(div1, "class", "col-12 col-md-4");
    			add_location(div1, file$1, 60, 12, 1653);
    			add_location(strong, file$1, 70, 22, 2121);
    			attr_dev(h6, "class", "card-title mbr-fonts-style display-5");
    			add_location(h6, file$1, 69, 20, 2049);
    			attr_dev(p0, "class", "mbr-text mbr-fonts-style grey bottom-less");
    			add_location(p0, file$1, 72, 20, 2197);
    			add_location(i_1, file$1, 79, 22, 2548);
    			attr_dev(p1, "class", "mbr-text mbr-fonts-style display-7");
    			add_location(p1, file$1, 77, 20, 2437);
    			attr_dev(div2, "class", "col-md");
    			add_location(div2, file$1, 68, 18, 2008);
    			attr_dev(sup, "class", "svelte-152tipk");
    			add_location(sup, file$1, 87, 75, 2933);
    			attr_dev(p2, "class", "price mbr-fonts-style display-2");
    			add_location(p2, file$1, 87, 20, 2878);
    			attr_dev(a, "href", "index.html");
    			attr_dev(a, "class", a_class_value = "btn btn-primary display-4 " + (/*card*/ ctx[6].IsReserved == 1 ? 'blocked' : ''));
    			add_location(a, file$1, 89, 22, 3023);
    			attr_dev(div3, "class", "mbr-section-btn");
    			add_location(div3, file$1, 88, 20, 2971);
    			attr_dev(div4, "class", "col-md-auto");
    			add_location(div4, file$1, 86, 18, 2832);
    			add_location(div5, file$1, 93, 18, 3263);
    			attr_dev(div6, "class", "row");
    			add_location(div6, file$1, 67, 16, 1972);
    			attr_dev(div7, "class", "card-box");
    			add_location(div7, file$1, 66, 14, 1933);
    			attr_dev(div8, "class", "col-12 col-md");
    			add_location(div8, file$1, 65, 12, 1891);
    			attr_dev(div9, "class", "row align-items-center");
    			add_location(div9, file$1, 59, 10, 1604);
    			attr_dev(div10, "class", "card-wrapper");
    			add_location(div10, file$1, 58, 8, 1567);
    			attr_dev(div11, "class", "card");
    			add_location(div11, file$1, 57, 6, 1540);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div11, anchor);
    			append_dev(div11, div10);
    			append_dev(div10, div9);
    			append_dev(div9, div1);
    			append_dev(div1, div0);
    			append_dev(div9, t0);
    			append_dev(div9, div8);
    			append_dev(div8, div7);
    			append_dev(div7, div6);
    			append_dev(div6, div2);
    			append_dev(div2, h6);
    			append_dev(h6, strong);
    			append_dev(strong, t1);
    			append_dev(div2, t2);
    			append_dev(div2, p0);
    			append_dev(p0, t3);
    			append_dev(p0, t4);
    			append_dev(p0, t5);
    			append_dev(p0, t6);
    			append_dev(p0, t7);
    			append_dev(div2, t8);
    			append_dev(div2, p1);
    			append_dev(p1, t9);
    			append_dev(p1, t10);
    			append_dev(p1, i_1);
    			append_dev(i_1, t11);
    			append_dev(i_1, t12);
    			append_dev(i_1, t13);
    			append_dev(i_1, t14);
    			append_dev(div6, t15);
    			append_dev(div6, div4);
    			append_dev(div4, p2);
    			append_dev(p2, t16);
    			append_dev(p2, sup);
    			append_dev(div4, t18);
    			append_dev(div4, div3);
    			append_dev(div3, a);
    			append_dev(a, t19);
    			append_dev(div6, t20);
    			append_dev(div6, div5);
    			append_dev(div11, t21);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*streamShow*/ 1) {
    				set_style(div0, "background-image", "url('" + /*card*/ ctx[6].Image + "')");
    			}

    			if (dirty & /*streamShow*/ 1 && t1_value !== (t1_value = /*card*/ ctx[6].Title + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*streamShow*/ 1 && t3_value !== (t3_value = /*card*/ ctx[6].FriendFirstName + "")) set_data_dev(t3, t3_value);
    			if (dirty & /*streamShow*/ 1 && t5_value !== (t5_value = /*card*/ ctx[6].FriendLastName + "")) set_data_dev(t5, t5_value);
    			if (dirty & /*streamShow*/ 1 && t7_value !== (t7_value = /*formatDate*/ ctx[1](/*card*/ ctx[6].EventDate) + "")) set_data_dev(t7, t7_value);
    			if (dirty & /*streamShow*/ 1 && t9_value !== (t9_value = /*card*/ ctx[6].Description1 + "")) set_data_dev(t9, t9_value);
    			if (dirty & /*streamShow*/ 1 && t12_value !== (t12_value = /*card*/ ctx[6].EventTitle + "")) set_data_dev(t12, t12_value);

    			if (dirty & /*streamShow*/ 1 && t14_value !== (t14_value = (new Date(/*card*/ ctx[6].EventDate).getFullYear() == new Date().getFullYear() + 2
    			? "через год"
    			: "") + "")) set_data_dev(t14, t14_value);

    			if (dirty & /*streamShow*/ 1 && t16_value !== (t16_value = /*card*/ ctx[6].Price + "")) set_data_dev(t16, t16_value);
    			if (dirty & /*streamShow*/ 1 && t19_value !== (t19_value = (/*card*/ ctx[6].IsReserved == 1 ? "Бронь" : "Подарить") + "")) set_data_dev(t19, t19_value);

    			if (dirty & /*streamShow*/ 1 && a_class_value !== (a_class_value = "btn btn-primary display-4 " + (/*card*/ ctx[6].IsReserved == 1 ? 'blocked' : ''))) {
    				attr_dev(a, "class", a_class_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div11);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(57:4) {#each streamShow as card, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let section;
    	let div;
    	let each_value = /*streamShow*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			section = element("section");
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(div, "class", "container");
    			add_location(div, file$1, 55, 2, 1476);
    			attr_dev(section, "class", "features8 cid-shi8I9qCDA");
    			attr_dev(section, "id", "features9-2");
    			add_location(section, file$1, 54, 0, 1414);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, div);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*streamShow, Date, formatDate*/ 3) {
    				each_value = /*streamShow*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			destroy_each(each_blocks, detaching);
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

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Stream', slots, []);

    	const formatDate = date => {
    		const eventDate = new Date(date);

    		const monthNames = [
    			"Января",
    			"Февраля",
    			"Марта",
    			"Апреля",
    			"Мая",
    			"Июня",
    			"Июля",
    			"Августа",
    			"Сентября",
    			"Октября",
    			"Ноября",
    			"Декабря"
    		];

    		return `
      ${eventDate.getDate()}
      ${monthNames[eventDate.getMonth()]}
      ${eventDate.getFullYear()}
      года
    `;
    	};

    	let pageIndex = 0;
    	let streamDictionary = {};
    	let streamShow = [];

    	// LOAD STREAM DATA
    	const loadStreamPage = (page, token, callback) => {
    		if (token == null) return;

    		Server.fetchGet(`${urlStream}${page}`, token, value => {
    			console.log("Load Stream Page #", page);
    			const compiledValue = (0, eval)(`(${value.details})`);
    			streamDictionary[page] = compiledValue;

    			$$invalidate(0, streamShow = Object.keys(streamDictionary).reduce(
    				function (r, k) {
    					return r.concat(streamDictionary[k]);
    				},
    				[]
    			));

    			console.log("Loaded stream elements", streamShow);
    			if (callback) callback(value);
    		});
    	};

    	let userDetails;

    	appUser.subscribe(value => {
    		userDetails = value;

    		loadStreamPage(pageIndex, userDetails.jwtToken, value => {
    			setTimeout(() => loadStreamPage(pageIndex + 1, userDetails.jwtToken), 2000);
    		});
    	});

    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Stream> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		Server,
    		urlStream,
    		appUser,
    		formatDate,
    		pageIndex,
    		streamDictionary,
    		streamShow,
    		loadStreamPage,
    		userDetails
    	});

    	$$self.$inject_state = $$props => {
    		if ('pageIndex' in $$props) pageIndex = $$props.pageIndex;
    		if ('streamDictionary' in $$props) streamDictionary = $$props.streamDictionary;
    		if ('streamShow' in $$props) $$invalidate(0, streamShow = $$props.streamShow);
    		if ('userDetails' in $$props) userDetails = $$props.userDetails;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [streamShow, formatDate];
    }

    class Stream extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {}, add_css);

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

    	$$self.$capture_state = () => ({ onMount, setupApp, Application });
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
