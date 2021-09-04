var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
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

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
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
    function append_empty_stylesheet(node) {
        const style_element = element('style');
        append_stylesheet(get_root_for_style(node), style_element);
        return style_element;
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

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = get_root_for_style(node);
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = append_empty_stylesheet(node).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
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

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
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
    const null_transition = { duration: 0 };
    function create_in_transition(node, fn, params) {
        let config = fn(node, params);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            add_render_callback(() => dispatch(node, true, 'start'));
            task = loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(1, 0);
                        dispatch(node, true, 'end');
                        cleanup();
                        return running = false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                started = true;
                delete_rule(node);
                if (is_function(config)) {
                    config = config();
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
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

    const urlRoot = "https://coreapi.work";
    const urlAuth = `${urlRoot}/user/authenticate`;
    const urlStream = `${urlRoot}/user/stream/`; // 0 - INITIAL PAGE

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
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data),
      };
      if (!isNullOrEmpty(token))
        settings.headers["Authorization"] = "Bearer " + token;

      try {
        const response = await fetch(`${url}`, settings);
        {
          try {
            const data = await response.json();
            callback(data);
          } catch (err) {
            console.error(err);
            callback(null);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    const fetchGet = async (url, token, callback) => {
      if (isNullOrEmpty(url.trim())) return
      const settings = {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
      };
      if (!isNullOrEmpty(token))
        settings.headers["Authorization"] = "Bearer " + token;

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
    	const authCredentials = { "username": "test", "password": "test" };

    	authData = DataStorage.permanentGet("auth", () => {
    		Server.fetchPost(urlAuth, authCredentials, null, value => {
    			if (value != null && value.id !== null) {
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

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 } = {}) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
        };
    }

    /* src/components/Stream.svelte generated by Svelte v3.42.1 */

    const { Object: Object_1, console: console_1 } = globals;
    const file$1 = "src/components/Stream.svelte";

    function add_css(target) {
    	append_styles(target, "svelte-1pfdwgq", "sup.svelte-1pfdwgq{font-size:1.2rem;font-weight:500}.loader.svelte-1pfdwgq{position:absolute;height:50px;width:100%;margin-top:8px}.loading.svelte-1pfdwgq{background-image:url(\"assets/loading.svg\");height:100%;width:100%;background-position:center;background-repeat:no-repeat;background-size:contain}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU3RyZWFtLnN2ZWx0ZSIsInNvdXJjZXMiOlsiU3RyZWFtLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxuICBpbXBvcnQgU2VydmVyIGZyb20gXCIuLi9oZWxwZXJzL3NlcnZlci5qc1wiXG4gIGltcG9ydCB7IHVybFN0cmVhbSwgYXBwVXNlciB9IGZyb20gXCIuLi9zdG9yZXMvc2V0dXAuanNcIlxuICBpbXBvcnQgeyBmbHkgfSBmcm9tIFwic3ZlbHRlL3RyYW5zaXRpb25cIlxuXG4gIGNvbnN0IGZvcm1hdERhdGUgPSAoZGF0ZSkgPT4ge1xuICAgIGNvbnN0IGV2ZW50RGF0ZSA9IG5ldyBEYXRlKGRhdGUpXG4gICAgY29uc3Qgbm93RGF0ZSA9IG5ldyBEYXRlKClcbiAgICBjb25zdCBtb250aE5hbWVzID0gW1wi0K/QvdCy0LDRgNGPXCIsIFwi0KTQtdCy0YDQsNC70Y9cIiwgXCLQnNCw0YDRgtCwXCIsIFwi0JDQv9GA0LXQu9GPXCIsIFwi0JzQsNGPXCIsIFwi0JjRjtC90Y9cIiwgXCLQmNGO0LvRj1wiLCBcItCQ0LLQs9GD0YHRgtCwXCIsIFwi0KHQtdC90YLRj9Cx0YDRj1wiLCBcItCe0LrRgtGP0LHRgNGPXCIsIFwi0J3QvtGP0LHRgNGPXCIsIFwi0JTQtdC60LDQsdGA0Y9cIl1cbiAgICByZXR1cm4gYFxuICAgICAgJHtldmVudERhdGUuZ2V0RGF0ZSgpfVxuICAgICAgJHttb250aE5hbWVzW2V2ZW50RGF0ZS5nZXRNb250aCgpXX1cbiAgICAgICR7ZXZlbnREYXRlLmdldEZ1bGxZZWFyKCkgPT0gbm93RGF0ZS5nZXRGdWxsWWVhcigpICsgMSA/IFwi0YHQu9C10LTRg9GO0YnQtdCz0L4g0LPQvtC00LBcIiA6IFwiXCJ9XG4gICAgYFxuICB9XG5cbiAgbGV0IHBhZ2VJbmRleCA9IDBcbiAgbGV0IHBhZ2VJdGVtc1NpemUgPSAtMSAvLyBERVRFQ1QgT05FIFBBR0UgRUxFTUVOVFMgQU1PVU5UIChGT1IgRkxZLkRFTEFZIENBTENVTEFUSU9OIEFORCBQUkUtREVURUNUIEVORCBPRiBBIExJU1QpXG4gIGxldCBpc05leHRQYWdlTG9hZGVkID0gZmFsc2VcbiAgbGV0IGlzTGFzdFBhZ2VMb2FkZWQgPSBmYWxzZVxuICBsZXQgc3RyZWFtRGljdGlvbmFyeSA9IHt9XG4gIGxldCBzdHJlYW1TaG93ID0gW11cblxuICAvLyBMT0FEIFNUUkVBTSBEQVRBXG4gIGNvbnN0IGxvYWRTdHJlYW1QYWdlID0gKHBhZ2UsIHRva2VuLCBjYWxsYmFjaykgPT4ge1xuXG4gICAgaWYgKHRva2VuID09IG51bGwgfHwgaXNMYXN0UGFnZUxvYWRlZCkgcmV0dXJuXG5cbiAgICBjb25zb2xlLmxvZyh0b2tlbilcbiAgICBTZXJ2ZXIuZmV0Y2hHZXQoYCR7dXJsU3RyZWFtfSR7cGFnZX1gLCB0b2tlbiwgKHZhbHVlKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhcIkxvYWQgU3RyZWFtIFBhZ2UgI1wiLCBwYWdlLCB2YWx1ZSlcblxuICAgICAgY29uc3QgY29tcGlsZWRWYWx1ZSA9ICgwLCBldmFsKShgKCR7dmFsdWUuZGV0YWlsc30pYClcblxuICAgICAgaWYgKGNvbXBpbGVkVmFsdWUubGVuZ3RoID09IDApIHtcbiAgICAgICAgaXNMYXN0UGFnZUxvYWRlZCA9IHRydWVcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIHBhZ2VJdGVtc1NpemUgPSBwYWdlSXRlbXNTaXplID09IC0xID8gY29tcGlsZWRWYWx1ZS5sZW5ndGggOiBwYWdlSXRlbXNTaXplXG5cbiAgICAgIHN0cmVhbURpY3Rpb25hcnlbcGFnZV0gPSBjb21waWxlZFZhbHVlXG4gICAgICBzdHJlYW1TaG93ID0gT2JqZWN0LmtleXMoc3RyZWFtRGljdGlvbmFyeSkucmVkdWNlKGZ1bmN0aW9uIChyLCBrKSB7XG4gICAgICAgIHJldHVybiByLmNvbmNhdChzdHJlYW1EaWN0aW9uYXJ5W2tdKVxuICAgICAgfSwgW10pXG5cbiAgICAgIGNvbnNvbGUubG9nKFwiTG9hZGVkIHN0cmVhbSBlbGVtZW50c1wiLCBzdHJlYW1TaG93KVxuXG4gICAgICBpZiAoY29tcGlsZWRWYWx1ZS5sZW5ndGggIT0gcGFnZUl0ZW1zU2l6ZSkge1xuICAgICAgICBpc0xhc3RQYWdlTG9hZGVkID0gdHJ1ZVxuICAgICAgfVxuXG4gICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKHZhbHVlKVxuICAgIH0pXG4gIH1cblxuICBsZXQgdXNlckRldGFpbHNcbiAgYXBwVXNlci5zdWJzY3JpYmUoKHZhbHVlKSA9PiB7XG4gICAgdXNlckRldGFpbHMgPSB2YWx1ZVxuICAgIGxvYWRTdHJlYW1QYWdlKHBhZ2VJbmRleCwgdXNlckRldGFpbHMuand0VG9rZW4sICh2YWx1ZSkgPT4gKGlzTmV4dFBhZ2VMb2FkZWQgPSB0cnVlKSlcbiAgfSlcblxuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcInNjcm9sbFwiLCAoZSkgPT4ge1xuICAgIHZhciBoID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LFxuICAgICAgYiA9IGRvY3VtZW50LmJvZHksXG4gICAgICBzdCA9IFwic2Nyb2xsVG9wXCIsXG4gICAgICBzaCA9IFwic2Nyb2xsSGVpZ2h0XCJcbiAgICBjb25zdCBzY3IgPSAoKGhbc3RdIHx8IGJbc3RdKSAvICgoaFtzaF0gfHwgYltzaF0pIC0gaC5jbGllbnRIZWlnaHQpKSAqIDEwMFxuXG4gICAgaWYgKGlzTmV4dFBhZ2VMb2FkZWQgJiYgc2NyID4gNTApIHtcbiAgICAgIGlzTmV4dFBhZ2VMb2FkZWQgPSBmYWxzZVxuICAgICAgcGFnZUluZGV4KytcbiAgICAgIGxvYWRTdHJlYW1QYWdlKHBhZ2VJbmRleCwgdXNlckRldGFpbHMuand0VG9rZW4sICh2YWx1ZSkgPT4gKGlzTmV4dFBhZ2VMb2FkZWQgPSB0cnVlKSlcbiAgICB9XG4gIH0pXG48L3NjcmlwdD5cblxuPHN0eWxlPlxuICBzdXAge1xuICAgIGZvbnQtc2l6ZTogMS4ycmVtO1xuICAgIGZvbnQtd2VpZ2h0OiA1MDA7XG4gIH1cblxuICAubG9hZGVyIHtcbiAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgaGVpZ2h0OiA1MHB4O1xuICAgIHdpZHRoOiAxMDAlO1xuICAgIG1hcmdpbi10b3A6IDhweDtcbiAgfVxuXG4gIC5sb2FkaW5nIHtcbiAgICBiYWNrZ3JvdW5kLWltYWdlOiB1cmwoXCJhc3NldHMvbG9hZGluZy5zdmdcIik7XG4gICAgaGVpZ2h0OiAxMDAlO1xuICAgIHdpZHRoOiAxMDAlO1xuICAgIGJhY2tncm91bmQtcG9zaXRpb246IGNlbnRlcjtcbiAgICBiYWNrZ3JvdW5kLXJlcGVhdDogbm8tcmVwZWF0O1xuICAgIGJhY2tncm91bmQtc2l6ZTogY29udGFpbjtcbiAgfVxuPC9zdHlsZT5cblxuPHNlY3Rpb24gY2xhc3M9XCJmZWF0dXJlczggY2lkLXNoaThJOXFDREFcIiBpZD1cImZlYXR1cmVzOS0yXCI+XG4gIDxkaXYgY2xhc3M9XCJjb250YWluZXJcIj5cbiAgICB7I2VhY2ggc3RyZWFtU2hvdyBhcyBjYXJkLCBpfVxuICAgICAgPGRpdiBpbjpmbHk9XCJ7eyB5OiAtMjUsIGRlbGF5OiAoaSAlIHBhZ2VJdGVtc1NpemUpICogMTAwIH19XCIgY2xhc3M9XCJjYXJkXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJjYXJkLXdyYXBwZXJcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwicm93IGFsaWduLWl0ZW1zLWNlbnRlclwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbC0xMiBjb2wtbWQtNFwiPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaW1hZ2Utd3JhcHBlclwiIHN0eWxlPVwiYmFja2dyb3VuZC1pbWFnZTogdXJsKCd7Y2FyZC5JbWFnZX0nKTtcIj48L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbC0xMiBjb2wtbWRcIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhcmQtYm94XCI+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInJvd1wiPlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbC1tZFwiPlxuICAgICAgICAgICAgICAgICAgICA8aDYgY2xhc3M9XCJjYXJkLXRpdGxlIG1ici1mb250cy1zdHlsZSBkaXNwbGF5LTVcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8c3Ryb25nPntjYXJkLlRpdGxlfTwvc3Ryb25nPlxuICAgICAgICAgICAgICAgICAgICA8L2g2PlxuICAgICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cIm1ici10ZXh0IG1ici1mb250cy1zdHlsZSBncmV5IGJvdHRvbS1sZXNzXCI+XG4gICAgICAgICAgICAgICAgICAgICAge2NhcmQuRnJpZW5kRmlyc3ROYW1lfVxuICAgICAgICAgICAgICAgICAgICAgIHtjYXJkLkZyaWVuZExhc3ROYW1lfSxcbiAgICAgICAgICAgICAgICAgICAgICB7Zm9ybWF0RGF0ZShjYXJkLkV2ZW50RGF0ZSl9XG4gICAgICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3M9XCJtYnItdGV4dCBtYnItZm9udHMtc3R5bGUgZGlzcGxheS03XCI+XG4gICAgICAgICAgICAgICAgICAgICAge2NhcmQuRGVzY3JpcHRpb24xfVxuICAgICAgICAgICAgICAgICAgICAgIDxpXG4gICAgICAgICAgICAgICAgICAgICAgICA+0L3QsFxuICAgICAgICAgICAgICAgICAgICAgICAge2NhcmQuRXZlbnRUaXRsZX1cbiAgICAgICAgICAgICAgICAgICAgICAgIHtuZXcgRGF0ZShjYXJkLkV2ZW50RGF0ZSkuZ2V0RnVsbFllYXIoKSA9PSBuZXcgRGF0ZSgpLmdldEZ1bGxZZWFyKCkgKyAyID8gXCLRh9C10YDQtdC3INCz0L7QtFwiIDogXCJcIn1cbiAgICAgICAgICAgICAgICAgICAgICA8L2k+XG4gICAgICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbC1tZC1hdXRvXCI+XG4gICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzPVwicHJpY2UgbWJyLWZvbnRzLXN0eWxlIGRpc3BsYXktMlwiPntjYXJkLlByaWNlfTxzdXA+MDA8L3N1cD48L3A+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtYnItc2VjdGlvbi1idG5cIj5cbiAgICAgICAgICAgICAgICAgICAgICA8YSBocmVmPVwiaW5kZXguaHRtbFwiIGNsYXNzPVwiYnRuIGJ0bi1wcmltYXJ5IGRpc3BsYXktNCB7Y2FyZC5Jc1Jlc2VydmVkID09IDEgPyAnYmxvY2tlZCcgOiAnJ31cIlxuICAgICAgICAgICAgICAgICAgICAgICAgPntjYXJkLklzUmVzZXJ2ZWQgPT0gMSA/IFwi0JHRgNC+0L3RjFwiIDogXCLQn9C+0LTQsNGA0LjRgtGMXCJ9PC9hPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPGRpdj48L2Rpdj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICB7L2VhY2h9XG4gIDwvZGl2PlxuXG4gIHsjaWYgIWlzTmV4dFBhZ2VMb2FkZWQgJiYgIWlzTGFzdFBhZ2VMb2FkZWR9XG4gICAgPGRpdiBjbGFzcz1cImxvYWRlclwiPlxuICAgICAgPGRpdiBjbGFzcz1cImxvYWRpbmdcIj48L2Rpdj5cbiAgICA8L2Rpdj5cbiAgey9pZn1cbjwvc2VjdGlvbj5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUE4RUUsR0FBRyxlQUFDLENBQUMsQUFDSCxTQUFTLENBQUUsTUFBTSxDQUNqQixXQUFXLENBQUUsR0FBRyxBQUNsQixDQUFDLEFBRUQsT0FBTyxlQUFDLENBQUMsQUFDUCxRQUFRLENBQUUsUUFBUSxDQUNsQixNQUFNLENBQUUsSUFBSSxDQUNaLEtBQUssQ0FBRSxJQUFJLENBQ1gsVUFBVSxDQUFFLEdBQUcsQUFDakIsQ0FBQyxBQUVELFFBQVEsZUFBQyxDQUFDLEFBQ1IsZ0JBQWdCLENBQUUsSUFBSSxvQkFBb0IsQ0FBQyxDQUMzQyxNQUFNLENBQUUsSUFBSSxDQUNaLEtBQUssQ0FBRSxJQUFJLENBQ1gsbUJBQW1CLENBQUUsTUFBTSxDQUMzQixpQkFBaUIsQ0FBRSxTQUFTLENBQzVCLGVBQWUsQ0FBRSxPQUFPLEFBQzFCLENBQUMifQ== */");
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	child_ctx[11] = i;
    	return child_ctx;
    }

    // (103:4) {#each streamShow as card, i}
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
    	let t1_value = /*card*/ ctx[9].Title + "";
    	let t1;
    	let t2;
    	let p0;
    	let t3_value = /*card*/ ctx[9].FriendFirstName + "";
    	let t3;
    	let t4;
    	let t5_value = /*card*/ ctx[9].FriendLastName + "";
    	let t5;
    	let t6;
    	let t7_value = /*formatDate*/ ctx[4](/*card*/ ctx[9].EventDate) + "";
    	let t7;
    	let t8;
    	let p1;
    	let t9_value = /*card*/ ctx[9].Description1 + "";
    	let t9;
    	let t10;
    	let i_1;
    	let t11;
    	let t12_value = /*card*/ ctx[9].EventTitle + "";
    	let t12;
    	let t13;

    	let t14_value = (new Date(/*card*/ ctx[9].EventDate).getFullYear() == new Date().getFullYear() + 2
    	? "через год"
    	: "") + "";

    	let t14;
    	let t15;
    	let div4;
    	let p2;
    	let t16_value = /*card*/ ctx[9].Price + "";
    	let t16;
    	let sup;
    	let t18;
    	let div3;
    	let a;
    	let t19_value = (/*card*/ ctx[9].IsReserved == 1 ? "Бронь" : "Подарить") + "";
    	let t19;
    	let a_class_value;
    	let t20;
    	let div5;
    	let t21;
    	let div11_intro;

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
    			set_style(div0, "background-image", "url('" + /*card*/ ctx[9].Image + "')");
    			add_location(div0, file$1, 107, 14, 3032);
    			attr_dev(div1, "class", "col-12 col-md-4");
    			add_location(div1, file$1, 106, 12, 2988);
    			add_location(strong, file$1, 114, 22, 3374);
    			attr_dev(h6, "class", "card-title mbr-fonts-style display-5");
    			add_location(h6, file$1, 113, 20, 3302);
    			attr_dev(p0, "class", "mbr-text mbr-fonts-style grey bottom-less");
    			add_location(p0, file$1, 116, 20, 3450);
    			add_location(i_1, file$1, 123, 22, 3801);
    			attr_dev(p1, "class", "mbr-text mbr-fonts-style display-7");
    			add_location(p1, file$1, 121, 20, 3690);
    			attr_dev(div2, "class", "col-md");
    			add_location(div2, file$1, 112, 18, 3261);
    			attr_dev(sup, "class", "svelte-1pfdwgq");
    			add_location(sup, file$1, 131, 75, 4186);
    			attr_dev(p2, "class", "price mbr-fonts-style display-2");
    			add_location(p2, file$1, 131, 20, 4131);
    			attr_dev(a, "href", "index.html");
    			attr_dev(a, "class", a_class_value = "btn btn-primary display-4 " + (/*card*/ ctx[9].IsReserved == 1 ? 'blocked' : ''));
    			add_location(a, file$1, 133, 22, 4276);
    			attr_dev(div3, "class", "mbr-section-btn");
    			add_location(div3, file$1, 132, 20, 4224);
    			attr_dev(div4, "class", "col-md-auto");
    			add_location(div4, file$1, 130, 18, 4085);
    			add_location(div5, file$1, 137, 18, 4516);
    			attr_dev(div6, "class", "row");
    			add_location(div6, file$1, 111, 16, 3225);
    			attr_dev(div7, "class", "card-box");
    			add_location(div7, file$1, 110, 14, 3186);
    			attr_dev(div8, "class", "col-12 col-md");
    			add_location(div8, file$1, 109, 12, 3144);
    			attr_dev(div9, "class", "row align-items-center");
    			add_location(div9, file$1, 105, 10, 2939);
    			attr_dev(div10, "class", "card-wrapper");
    			add_location(div10, file$1, 104, 8, 2902);
    			attr_dev(div11, "class", "card");
    			add_location(div11, file$1, 103, 6, 2819);
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
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*streamShow*/ 8) {
    				set_style(div0, "background-image", "url('" + /*card*/ ctx[9].Image + "')");
    			}

    			if (dirty & /*streamShow*/ 8 && t1_value !== (t1_value = /*card*/ ctx[9].Title + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*streamShow*/ 8 && t3_value !== (t3_value = /*card*/ ctx[9].FriendFirstName + "")) set_data_dev(t3, t3_value);
    			if (dirty & /*streamShow*/ 8 && t5_value !== (t5_value = /*card*/ ctx[9].FriendLastName + "")) set_data_dev(t5, t5_value);
    			if (dirty & /*streamShow*/ 8 && t7_value !== (t7_value = /*formatDate*/ ctx[4](/*card*/ ctx[9].EventDate) + "")) set_data_dev(t7, t7_value);
    			if (dirty & /*streamShow*/ 8 && t9_value !== (t9_value = /*card*/ ctx[9].Description1 + "")) set_data_dev(t9, t9_value);
    			if (dirty & /*streamShow*/ 8 && t12_value !== (t12_value = /*card*/ ctx[9].EventTitle + "")) set_data_dev(t12, t12_value);

    			if (dirty & /*streamShow*/ 8 && t14_value !== (t14_value = (new Date(/*card*/ ctx[9].EventDate).getFullYear() == new Date().getFullYear() + 2
    			? "через год"
    			: "") + "")) set_data_dev(t14, t14_value);

    			if (dirty & /*streamShow*/ 8 && t16_value !== (t16_value = /*card*/ ctx[9].Price + "")) set_data_dev(t16, t16_value);
    			if (dirty & /*streamShow*/ 8 && t19_value !== (t19_value = (/*card*/ ctx[9].IsReserved == 1 ? "Бронь" : "Подарить") + "")) set_data_dev(t19, t19_value);

    			if (dirty & /*streamShow*/ 8 && a_class_value !== (a_class_value = "btn btn-primary display-4 " + (/*card*/ ctx[9].IsReserved == 1 ? 'blocked' : ''))) {
    				attr_dev(a, "class", a_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (!div11_intro) {
    				add_render_callback(() => {
    					div11_intro = create_in_transition(div11, fly, {
    						y: -25,
    						delay: /*i*/ ctx[11] % /*pageItemsSize*/ ctx[0] * 100
    					});

    					div11_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div11);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(103:4) {#each streamShow as card, i}",
    		ctx
    	});

    	return block;
    }

    // (148:2) {#if !isNextPageLoaded && !isLastPageLoaded}
    function create_if_block(ctx) {
    	let div1;
    	let div0;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			attr_dev(div0, "class", "loading svelte-1pfdwgq");
    			add_location(div0, file$1, 149, 6, 4736);
    			attr_dev(div1, "class", "loader svelte-1pfdwgq");
    			add_location(div1, file$1, 148, 4, 4709);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(148:2) {#if !isNextPageLoaded && !isLastPageLoaded}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let section;
    	let div;
    	let t;
    	let each_value = /*streamShow*/ ctx[3];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	let if_block = !/*isNextPageLoaded*/ ctx[1] && !/*isLastPageLoaded*/ ctx[2] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			section = element("section");
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			if (if_block) if_block.c();
    			attr_dev(div, "class", "container");
    			add_location(div, file$1, 101, 2, 2755);
    			attr_dev(section, "class", "features8 cid-shi8I9qCDA");
    			attr_dev(section, "id", "features9-2");
    			add_location(section, file$1, 100, 0, 2693);
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

    			append_dev(section, t);
    			if (if_block) if_block.m(section, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*streamShow, Date, formatDate*/ 24) {
    				each_value = /*streamShow*/ ctx[3];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (!/*isNextPageLoaded*/ ctx[1] && !/*isLastPageLoaded*/ ctx[2]) {
    				if (if_block) ; else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(section, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: function intro(local) {
    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			destroy_each(each_blocks, detaching);
    			if (if_block) if_block.d();
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
    		const nowDate = new Date();

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
      ${eventDate.getFullYear() == nowDate.getFullYear() + 1
		? "следующего года"
		: ""}
    `;
    	};

    	let pageIndex = 0;
    	let pageItemsSize = -1; // DETECT ONE PAGE ELEMENTS AMOUNT (FOR FLY.DELAY CALCULATION AND PRE-DETECT END OF A LIST)
    	let isNextPageLoaded = false;
    	let isLastPageLoaded = false;
    	let streamDictionary = {};
    	let streamShow = [];

    	// LOAD STREAM DATA
    	const loadStreamPage = (page, token, callback) => {
    		if (token == null || isLastPageLoaded) return;
    		console.log(token);

    		Server.fetchGet(`${urlStream}${page}`, token, value => {
    			console.log("Load Stream Page #", page, value);
    			const compiledValue = (0, eval)(`(${value.details})`);

    			if (compiledValue.length == 0) {
    				$$invalidate(2, isLastPageLoaded = true);
    				return;
    			}

    			$$invalidate(0, pageItemsSize = pageItemsSize == -1
    			? compiledValue.length
    			: pageItemsSize);

    			streamDictionary[page] = compiledValue;

    			$$invalidate(3, streamShow = Object.keys(streamDictionary).reduce(
    				function (r, k) {
    					return r.concat(streamDictionary[k]);
    				},
    				[]
    			));

    			console.log("Loaded stream elements", streamShow);

    			if (compiledValue.length != pageItemsSize) {
    				$$invalidate(2, isLastPageLoaded = true);
    			}

    			if (callback) callback(value);
    		});
    	};

    	let userDetails;

    	appUser.subscribe(value => {
    		userDetails = value;
    		loadStreamPage(pageIndex, userDetails.jwtToken, value => $$invalidate(1, isNextPageLoaded = true));
    	});

    	window.addEventListener("scroll", e => {
    		var h = document.documentElement,
    			b = document.body,
    			st = "scrollTop",
    			sh = "scrollHeight";

    		const scr = (h[st] || b[st]) / ((h[sh] || b[sh]) - h.clientHeight) * 100;

    		if (isNextPageLoaded && scr > 50) {
    			$$invalidate(1, isNextPageLoaded = false);
    			pageIndex++;
    			loadStreamPage(pageIndex, userDetails.jwtToken, value => $$invalidate(1, isNextPageLoaded = true));
    		}
    	});

    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Stream> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		Server,
    		urlStream,
    		appUser,
    		fly,
    		formatDate,
    		pageIndex,
    		pageItemsSize,
    		isNextPageLoaded,
    		isLastPageLoaded,
    		streamDictionary,
    		streamShow,
    		loadStreamPage,
    		userDetails
    	});

    	$$self.$inject_state = $$props => {
    		if ('pageIndex' in $$props) pageIndex = $$props.pageIndex;
    		if ('pageItemsSize' in $$props) $$invalidate(0, pageItemsSize = $$props.pageItemsSize);
    		if ('isNextPageLoaded' in $$props) $$invalidate(1, isNextPageLoaded = $$props.isNextPageLoaded);
    		if ('isLastPageLoaded' in $$props) $$invalidate(2, isLastPageLoaded = $$props.isLastPageLoaded);
    		if ('streamDictionary' in $$props) streamDictionary = $$props.streamDictionary;
    		if ('streamShow' in $$props) $$invalidate(3, streamShow = $$props.streamShow);
    		if ('userDetails' in $$props) userDetails = $$props.userDetails;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [pageItemsSize, isNextPageLoaded, isLastPageLoaded, streamShow, formatDate];
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
