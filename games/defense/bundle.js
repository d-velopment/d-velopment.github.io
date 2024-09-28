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
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function get_store_value(store) {
        let value;
        subscribe(store, _ => value = _)();
        return value;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function split_css_unit(value) {
        const split = typeof value === 'string' && value.match(/^\s*(-?[\d.]+)([^\s]*)\s*$/);
        return split ? [parseFloat(split[1]), split[2] || 'px'] : [value, 'px'];
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
        if (root && root.host) {
            return root;
        }
        return node.ownerDocument;
    }
    function append_empty_stylesheet(node) {
        const style_element = element('style');
        append_stylesheet(get_root_for_style(node), style_element);
        return style_element.sheet;
    }
    function append_stylesheet(node, style) {
        append(node.head || node, style);
        return style.sheet;
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
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
    function empty() {
        return text('');
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
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    // we need to store the information for multiple documents because a Svelte application could also contain iframes
    // https://github.com/sveltejs/svelte/issues/3624
    const managed_styles = new Map();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_style_information(doc, node) {
        const info = { stylesheet: append_empty_stylesheet(node), rules: {} };
        managed_styles.set(doc, info);
        return info;
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
        const { stylesheet, rules } = managed_styles.get(doc) || create_style_information(doc, node);
        if (!rules[name]) {
            rules[name] = true;
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
            managed_styles.forEach(info => {
                const { ownerNode } = info.stylesheet;
                // there is no ownerNode if it runs on jsdom.
                if (ownerNode)
                    detach(ownerNode);
            });
            managed_styles.clear();
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
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    /**
     * Schedules a callback to run immediately before the component is unmounted.
     *
     * Out of `onMount`, `beforeUpdate`, `afterUpdate` and `onDestroy`, this is the
     * only one that runs inside a server-side component.
     *
     * https://svelte.dev/docs#run-time-svelte-ondestroy
     */
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
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
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
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
        seen_callbacks.clear();
        set_current_component(saved_component);
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
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
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
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
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
        else if (callback) {
            callback();
        }
    }
    const null_transition = { duration: 0 };
    function create_in_transition(node, fn, params) {
        const options = { direction: 'in' };
        let config = fn(node, params, options);
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
                    config = config(options);
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
    function create_out_transition(node, fn, params) {
        const options = { direction: 'out' };
        let config = fn(node, params, options);
        let running = true;
        let animation_name;
        const group = outros;
        group.r += 1;
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 1, 0, duration, delay, easing, css);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            add_render_callback(() => dispatch(node, false, 'start'));
            loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(0, 1);
                        dispatch(node, false, 'end');
                        if (!--group.r) {
                            // this will result in `end()` being called,
                            // so we don't need to clean up here
                            run_all(group.c);
                        }
                        return false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(1 - t, t);
                    }
                }
                return running;
            });
        }
        if (is_function(config)) {
            wait().then(() => {
                // @ts-ignore
                config = config(options);
                go();
            });
        }
        else {
            go();
        }
        return {
            end(reset) {
                if (reset && config.tick) {
                    config.tick(1, 0);
                }
                if (running) {
                    if (animation_name)
                        delete_rule(node, animation_name);
                    running = false;
                }
            }
        };
    }
    function create_bidirectional_transition(node, fn, params, intro) {
        const options = { direction: 'both' };
        let config = fn(node, params, options);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = (program.b - t);
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program || pending_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config(options);
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
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
            flush_render_callbacks($$.after_update);
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
            ctx: [],
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
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
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
            if (!is_function(callback)) {
                return noop;
            }
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
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.2' }, detail), { bubbles: true }));
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
        if (text.data === data)
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
     * @param {StartStopNotifier=} start
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
                if (subscribers.size === 0 && stop) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function is_date(obj) {
        return Object.prototype.toString.call(obj) === '[object Date]';
    }

    function tick_spring(ctx, last_value, current_value, target_value) {
        if (typeof current_value === 'number' || is_date(current_value)) {
            // @ts-ignore
            const delta = target_value - current_value;
            // @ts-ignore
            const velocity = (current_value - last_value) / (ctx.dt || 1 / 60); // guard div by 0
            const spring = ctx.opts.stiffness * delta;
            const damper = ctx.opts.damping * velocity;
            const acceleration = (spring - damper) * ctx.inv_mass;
            const d = (velocity + acceleration) * ctx.dt;
            if (Math.abs(d) < ctx.opts.precision && Math.abs(delta) < ctx.opts.precision) {
                return target_value; // settled
            }
            else {
                ctx.settled = false; // signal loop to keep ticking
                // @ts-ignore
                return is_date(current_value) ?
                    new Date(current_value.getTime() + d) : current_value + d;
            }
        }
        else if (Array.isArray(current_value)) {
            // @ts-ignore
            return current_value.map((_, i) => tick_spring(ctx, last_value[i], current_value[i], target_value[i]));
        }
        else if (typeof current_value === 'object') {
            const next_value = {};
            for (const k in current_value) {
                // @ts-ignore
                next_value[k] = tick_spring(ctx, last_value[k], current_value[k], target_value[k]);
            }
            // @ts-ignore
            return next_value;
        }
        else {
            throw new Error(`Cannot spring ${typeof current_value} values`);
        }
    }
    function spring(value, opts = {}) {
        const store = writable(value);
        const { stiffness = 0.15, damping = 0.8, precision = 0.01 } = opts;
        let last_time;
        let task;
        let current_token;
        let last_value = value;
        let target_value = value;
        let inv_mass = 1;
        let inv_mass_recovery_rate = 0;
        let cancel_task = false;
        function set(new_value, opts = {}) {
            target_value = new_value;
            const token = current_token = {};
            if (value == null || opts.hard || (spring.stiffness >= 1 && spring.damping >= 1)) {
                cancel_task = true; // cancel any running animation
                last_time = now();
                last_value = new_value;
                store.set(value = target_value);
                return Promise.resolve();
            }
            else if (opts.soft) {
                const rate = opts.soft === true ? .5 : +opts.soft;
                inv_mass_recovery_rate = 1 / (rate * 60);
                inv_mass = 0; // infinite mass, unaffected by spring forces
            }
            if (!task) {
                last_time = now();
                cancel_task = false;
                task = loop(now => {
                    if (cancel_task) {
                        cancel_task = false;
                        task = null;
                        return false;
                    }
                    inv_mass = Math.min(inv_mass + inv_mass_recovery_rate, 1);
                    const ctx = {
                        inv_mass,
                        opts: spring,
                        settled: true,
                        dt: (now - last_time) * 60 / 1000
                    };
                    const next_value = tick_spring(ctx, last_value, value, target_value);
                    last_time = now;
                    last_value = value;
                    store.set(value = next_value);
                    if (ctx.settled) {
                        task = null;
                    }
                    return !ctx.settled;
                });
            }
            return new Promise(fulfil => {
                task.promise.then(() => {
                    if (token === current_token)
                        fulfil();
                });
            });
        }
        const spring = {
            set,
            update: (fn, opts) => set(fn(target_value, value), opts),
            subscribe: store.subscribe,
            stiffness,
            damping,
            precision
        };
        return spring;
    }

    function fade(node, { delay = 0, duration = 400, easing = identity } = {}) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }
    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 } = {}) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        const [xValue, xUnit] = split_css_unit(x);
        const [yValue, yUnit] = split_css_unit(y);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * xValue}${xUnit}, ${(1 - t) * yValue}${yUnit});
			opacity: ${target_opacity - (od * u)}`
        };
    }

    let xyPersonage;

    // MAIN APPLICATION CONFIGURATION
    const setupPersonage = writable({
      x: -1,
      y: -1,
    });

    const setupDisplay = writable();

    const setupScore = writable({
      current: 0,
    });

    const setupApp = {
      size: 5,
      map: 16,
      speed: 330,
      touchPadding: 5,
    };

    const doReset = writable(false);

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function unwrapExports (x) {
    	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
    }

    function createCommonjsModule(fn, basedir, module) {
    	return module = {
    	  path: basedir,
    	  exports: {},
    	  require: function (path, base) {
          return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
        }
    	}, fn(module, module.exports), module.exports;
    }

    function commonjsRequire () {
    	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
    }

    var gsap$1 = createCommonjsModule(function (module, exports) {
    (function (global, factory) {
      factory(exports) ;
    }(commonjsGlobal, (function (exports) {
      function _inheritsLoose(subClass, superClass) {
        subClass.prototype = Object.create(superClass.prototype);
        subClass.prototype.constructor = subClass;
        subClass.__proto__ = superClass;
      }

      function _assertThisInitialized(self) {
        if (self === void 0) {
          throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
        }

        return self;
      }

      /*!
       * GSAP 3.12.5
       * https://gsap.com
       *
       * @license Copyright 2008-2024, GreenSock. All rights reserved.
       * Subject to the terms at https://gsap.com/standard-license or for
       * Club GSAP members, the agreement issued with that membership.
       * @author: Jack Doyle, jack@greensock.com
      */
      var _config = {
        autoSleep: 120,
        force3D: "auto",
        nullTargetWarn: 1,
        units: {
          lineHeight: ""
        }
      },
          _defaults = {
        duration: .5,
        overwrite: false,
        delay: 0
      },
          _suppressOverwrites,
          _reverting,
          _context,
          _bigNum = 1e8,
          _tinyNum = 1 / _bigNum,
          _2PI = Math.PI * 2,
          _HALF_PI = _2PI / 4,
          _gsID = 0,
          _sqrt = Math.sqrt,
          _cos = Math.cos,
          _sin = Math.sin,
          _isString = function _isString(value) {
        return typeof value === "string";
      },
          _isFunction = function _isFunction(value) {
        return typeof value === "function";
      },
          _isNumber = function _isNumber(value) {
        return typeof value === "number";
      },
          _isUndefined = function _isUndefined(value) {
        return typeof value === "undefined";
      },
          _isObject = function _isObject(value) {
        return typeof value === "object";
      },
          _isNotFalse = function _isNotFalse(value) {
        return value !== false;
      },
          _windowExists = function _windowExists() {
        return typeof window !== "undefined";
      },
          _isFuncOrString = function _isFuncOrString(value) {
        return _isFunction(value) || _isString(value);
      },
          _isTypedArray = typeof ArrayBuffer === "function" && ArrayBuffer.isView || function () {},
          _isArray = Array.isArray,
          _strictNumExp = /(?:-?\.?\d|\.)+/gi,
          _numExp = /[-+=.]*\d+[.e\-+]*\d*[e\-+]*\d*/g,
          _numWithUnitExp = /[-+=.]*\d+[.e-]*\d*[a-z%]*/g,
          _complexStringNumExp = /[-+=.]*\d+\.?\d*(?:e-|e\+)?\d*/gi,
          _relExp = /[+-]=-?[.\d]+/,
          _delimitedValueExp = /[^,'"\[\]\s]+/gi,
          _unitExp = /^[+\-=e\s\d]*\d+[.\d]*([a-z]*|%)\s*$/i,
          _globalTimeline,
          _win,
          _coreInitted,
          _doc,
          _globals = {},
          _installScope = {},
          _coreReady,
          _install = function _install(scope) {
        return (_installScope = _merge(scope, _globals)) && gsap;
      },
          _missingPlugin = function _missingPlugin(property, value) {
        return console.warn("Invalid property", property, "set to", value, "Missing plugin? gsap.registerPlugin()");
      },
          _warn = function _warn(message, suppress) {
        return !suppress && console.warn(message);
      },
          _addGlobal = function _addGlobal(name, obj) {
        return name && (_globals[name] = obj) && _installScope && (_installScope[name] = obj) || _globals;
      },
          _emptyFunc = function _emptyFunc() {
        return 0;
      },
          _startAtRevertConfig = {
        suppressEvents: true,
        isStart: true,
        kill: false
      },
          _revertConfigNoKill = {
        suppressEvents: true,
        kill: false
      },
          _revertConfig = {
        suppressEvents: true
      },
          _reservedProps = {},
          _lazyTweens = [],
          _lazyLookup = {},
          _lastRenderedFrame,
          _plugins = {},
          _effects = {},
          _nextGCFrame = 30,
          _harnessPlugins = [],
          _callbackNames = "",
          _harness = function _harness(targets) {
        var target = targets[0],
            harnessPlugin,
            i;
        _isObject(target) || _isFunction(target) || (targets = [targets]);

        if (!(harnessPlugin = (target._gsap || {}).harness)) {
          i = _harnessPlugins.length;

          while (i-- && !_harnessPlugins[i].targetTest(target)) {}

          harnessPlugin = _harnessPlugins[i];
        }

        i = targets.length;

        while (i--) {
          targets[i] && (targets[i]._gsap || (targets[i]._gsap = new GSCache(targets[i], harnessPlugin))) || targets.splice(i, 1);
        }

        return targets;
      },
          _getCache = function _getCache(target) {
        return target._gsap || _harness(toArray(target))[0]._gsap;
      },
          _getProperty = function _getProperty(target, property, v) {
        return (v = target[property]) && _isFunction(v) ? target[property]() : _isUndefined(v) && target.getAttribute && target.getAttribute(property) || v;
      },
          _forEachName = function _forEachName(names, func) {
        return (names = names.split(",")).forEach(func) || names;
      },
          _round = function _round(value) {
        return Math.round(value * 100000) / 100000 || 0;
      },
          _roundPrecise = function _roundPrecise(value) {
        return Math.round(value * 10000000) / 10000000 || 0;
      },
          _parseRelative = function _parseRelative(start, value) {
        var operator = value.charAt(0),
            end = parseFloat(value.substr(2));
        start = parseFloat(start);
        return operator === "+" ? start + end : operator === "-" ? start - end : operator === "*" ? start * end : start / end;
      },
          _arrayContainsAny = function _arrayContainsAny(toSearch, toFind) {
        var l = toFind.length,
            i = 0;

        for (; toSearch.indexOf(toFind[i]) < 0 && ++i < l;) {}

        return i < l;
      },
          _lazyRender = function _lazyRender() {
        var l = _lazyTweens.length,
            a = _lazyTweens.slice(0),
            i,
            tween;

        _lazyLookup = {};
        _lazyTweens.length = 0;

        for (i = 0; i < l; i++) {
          tween = a[i];
          tween && tween._lazy && (tween.render(tween._lazy[0], tween._lazy[1], true)._lazy = 0);
        }
      },
          _lazySafeRender = function _lazySafeRender(animation, time, suppressEvents, force) {
        _lazyTweens.length && !_reverting && _lazyRender();
        animation.render(time, suppressEvents, force || _reverting && time < 0 && (animation._initted || animation._startAt));
        _lazyTweens.length && !_reverting && _lazyRender();
      },
          _numericIfPossible = function _numericIfPossible(value) {
        var n = parseFloat(value);
        return (n || n === 0) && (value + "").match(_delimitedValueExp).length < 2 ? n : _isString(value) ? value.trim() : value;
      },
          _passThrough = function _passThrough(p) {
        return p;
      },
          _setDefaults = function _setDefaults(obj, defaults) {
        for (var p in defaults) {
          p in obj || (obj[p] = defaults[p]);
        }

        return obj;
      },
          _setKeyframeDefaults = function _setKeyframeDefaults(excludeDuration) {
        return function (obj, defaults) {
          for (var p in defaults) {
            p in obj || p === "duration" && excludeDuration || p === "ease" || (obj[p] = defaults[p]);
          }
        };
      },
          _merge = function _merge(base, toMerge) {
        for (var p in toMerge) {
          base[p] = toMerge[p];
        }

        return base;
      },
          _mergeDeep = function _mergeDeep(base, toMerge) {
        for (var p in toMerge) {
          p !== "__proto__" && p !== "constructor" && p !== "prototype" && (base[p] = _isObject(toMerge[p]) ? _mergeDeep(base[p] || (base[p] = {}), toMerge[p]) : toMerge[p]);
        }

        return base;
      },
          _copyExcluding = function _copyExcluding(obj, excluding) {
        var copy = {},
            p;

        for (p in obj) {
          p in excluding || (copy[p] = obj[p]);
        }

        return copy;
      },
          _inheritDefaults = function _inheritDefaults(vars) {
        var parent = vars.parent || _globalTimeline,
            func = vars.keyframes ? _setKeyframeDefaults(_isArray(vars.keyframes)) : _setDefaults;

        if (_isNotFalse(vars.inherit)) {
          while (parent) {
            func(vars, parent.vars.defaults);
            parent = parent.parent || parent._dp;
          }
        }

        return vars;
      },
          _arraysMatch = function _arraysMatch(a1, a2) {
        var i = a1.length,
            match = i === a2.length;

        while (match && i-- && a1[i] === a2[i]) {}

        return i < 0;
      },
          _addLinkedListItem = function _addLinkedListItem(parent, child, firstProp, lastProp, sortBy) {
        if (firstProp === void 0) {
          firstProp = "_first";
        }

        if (lastProp === void 0) {
          lastProp = "_last";
        }

        var prev = parent[lastProp],
            t;

        if (sortBy) {
          t = child[sortBy];

          while (prev && prev[sortBy] > t) {
            prev = prev._prev;
          }
        }

        if (prev) {
          child._next = prev._next;
          prev._next = child;
        } else {
          child._next = parent[firstProp];
          parent[firstProp] = child;
        }

        if (child._next) {
          child._next._prev = child;
        } else {
          parent[lastProp] = child;
        }

        child._prev = prev;
        child.parent = child._dp = parent;
        return child;
      },
          _removeLinkedListItem = function _removeLinkedListItem(parent, child, firstProp, lastProp) {
        if (firstProp === void 0) {
          firstProp = "_first";
        }

        if (lastProp === void 0) {
          lastProp = "_last";
        }

        var prev = child._prev,
            next = child._next;

        if (prev) {
          prev._next = next;
        } else if (parent[firstProp] === child) {
          parent[firstProp] = next;
        }

        if (next) {
          next._prev = prev;
        } else if (parent[lastProp] === child) {
          parent[lastProp] = prev;
        }

        child._next = child._prev = child.parent = null;
      },
          _removeFromParent = function _removeFromParent(child, onlyIfParentHasAutoRemove) {
        child.parent && (!onlyIfParentHasAutoRemove || child.parent.autoRemoveChildren) && child.parent.remove && child.parent.remove(child);
        child._act = 0;
      },
          _uncache = function _uncache(animation, child) {
        if (animation && (!child || child._end > animation._dur || child._start < 0)) {
          var a = animation;

          while (a) {
            a._dirty = 1;
            a = a.parent;
          }
        }

        return animation;
      },
          _recacheAncestors = function _recacheAncestors(animation) {
        var parent = animation.parent;

        while (parent && parent.parent) {
          parent._dirty = 1;
          parent.totalDuration();
          parent = parent.parent;
        }

        return animation;
      },
          _rewindStartAt = function _rewindStartAt(tween, totalTime, suppressEvents, force) {
        return tween._startAt && (_reverting ? tween._startAt.revert(_revertConfigNoKill) : tween.vars.immediateRender && !tween.vars.autoRevert || tween._startAt.render(totalTime, true, force));
      },
          _hasNoPausedAncestors = function _hasNoPausedAncestors(animation) {
        return !animation || animation._ts && _hasNoPausedAncestors(animation.parent);
      },
          _elapsedCycleDuration = function _elapsedCycleDuration(animation) {
        return animation._repeat ? _animationCycle(animation._tTime, animation = animation.duration() + animation._rDelay) * animation : 0;
      },
          _animationCycle = function _animationCycle(tTime, cycleDuration) {
        var whole = Math.floor(tTime /= cycleDuration);
        return tTime && whole === tTime ? whole - 1 : whole;
      },
          _parentToChildTotalTime = function _parentToChildTotalTime(parentTime, child) {
        return (parentTime - child._start) * child._ts + (child._ts >= 0 ? 0 : child._dirty ? child.totalDuration() : child._tDur);
      },
          _setEnd = function _setEnd(animation) {
        return animation._end = _roundPrecise(animation._start + (animation._tDur / Math.abs(animation._ts || animation._rts || _tinyNum) || 0));
      },
          _alignPlayhead = function _alignPlayhead(animation, totalTime) {
        var parent = animation._dp;

        if (parent && parent.smoothChildTiming && animation._ts) {
          animation._start = _roundPrecise(parent._time - (animation._ts > 0 ? totalTime / animation._ts : ((animation._dirty ? animation.totalDuration() : animation._tDur) - totalTime) / -animation._ts));

          _setEnd(animation);

          parent._dirty || _uncache(parent, animation);
        }

        return animation;
      },
          _postAddChecks = function _postAddChecks(timeline, child) {
        var t;

        if (child._time || !child._dur && child._initted || child._start < timeline._time && (child._dur || !child.add)) {
          t = _parentToChildTotalTime(timeline.rawTime(), child);

          if (!child._dur || _clamp(0, child.totalDuration(), t) - child._tTime > _tinyNum) {
            child.render(t, true);
          }
        }

        if (_uncache(timeline, child)._dp && timeline._initted && timeline._time >= timeline._dur && timeline._ts) {
          if (timeline._dur < timeline.duration()) {
            t = timeline;

            while (t._dp) {
              t.rawTime() >= 0 && t.totalTime(t._tTime);
              t = t._dp;
            }
          }

          timeline._zTime = -_tinyNum;
        }
      },
          _addToTimeline = function _addToTimeline(timeline, child, position, skipChecks) {
        child.parent && _removeFromParent(child);
        child._start = _roundPrecise((_isNumber(position) ? position : position || timeline !== _globalTimeline ? _parsePosition(timeline, position, child) : timeline._time) + child._delay);
        child._end = _roundPrecise(child._start + (child.totalDuration() / Math.abs(child.timeScale()) || 0));

        _addLinkedListItem(timeline, child, "_first", "_last", timeline._sort ? "_start" : 0);

        _isFromOrFromStart(child) || (timeline._recent = child);
        skipChecks || _postAddChecks(timeline, child);
        timeline._ts < 0 && _alignPlayhead(timeline, timeline._tTime);
        return timeline;
      },
          _scrollTrigger = function _scrollTrigger(animation, trigger) {
        return (_globals.ScrollTrigger || _missingPlugin("scrollTrigger", trigger)) && _globals.ScrollTrigger.create(trigger, animation);
      },
          _attemptInitTween = function _attemptInitTween(tween, time, force, suppressEvents, tTime) {
        _initTween(tween, time, tTime);

        if (!tween._initted) {
          return 1;
        }

        if (!force && tween._pt && !_reverting && (tween._dur && tween.vars.lazy !== false || !tween._dur && tween.vars.lazy) && _lastRenderedFrame !== _ticker.frame) {
          _lazyTweens.push(tween);

          tween._lazy = [tTime, suppressEvents];
          return 1;
        }
      },
          _parentPlayheadIsBeforeStart = function _parentPlayheadIsBeforeStart(_ref) {
        var parent = _ref.parent;
        return parent && parent._ts && parent._initted && !parent._lock && (parent.rawTime() < 0 || _parentPlayheadIsBeforeStart(parent));
      },
          _isFromOrFromStart = function _isFromOrFromStart(_ref2) {
        var data = _ref2.data;
        return data === "isFromStart" || data === "isStart";
      },
          _renderZeroDurationTween = function _renderZeroDurationTween(tween, totalTime, suppressEvents, force) {
        var prevRatio = tween.ratio,
            ratio = totalTime < 0 || !totalTime && (!tween._start && _parentPlayheadIsBeforeStart(tween) && !(!tween._initted && _isFromOrFromStart(tween)) || (tween._ts < 0 || tween._dp._ts < 0) && !_isFromOrFromStart(tween)) ? 0 : 1,
            repeatDelay = tween._rDelay,
            tTime = 0,
            pt,
            iteration,
            prevIteration;

        if (repeatDelay && tween._repeat) {
          tTime = _clamp(0, tween._tDur, totalTime);
          iteration = _animationCycle(tTime, repeatDelay);
          tween._yoyo && iteration & 1 && (ratio = 1 - ratio);

          if (iteration !== _animationCycle(tween._tTime, repeatDelay)) {
            prevRatio = 1 - ratio;
            tween.vars.repeatRefresh && tween._initted && tween.invalidate();
          }
        }

        if (ratio !== prevRatio || _reverting || force || tween._zTime === _tinyNum || !totalTime && tween._zTime) {
          if (!tween._initted && _attemptInitTween(tween, totalTime, force, suppressEvents, tTime)) {
            return;
          }

          prevIteration = tween._zTime;
          tween._zTime = totalTime || (suppressEvents ? _tinyNum : 0);
          suppressEvents || (suppressEvents = totalTime && !prevIteration);
          tween.ratio = ratio;
          tween._from && (ratio = 1 - ratio);
          tween._time = 0;
          tween._tTime = tTime;
          pt = tween._pt;

          while (pt) {
            pt.r(ratio, pt.d);
            pt = pt._next;
          }

          totalTime < 0 && _rewindStartAt(tween, totalTime, suppressEvents, true);
          tween._onUpdate && !suppressEvents && _callback(tween, "onUpdate");
          tTime && tween._repeat && !suppressEvents && tween.parent && _callback(tween, "onRepeat");

          if ((totalTime >= tween._tDur || totalTime < 0) && tween.ratio === ratio) {
            ratio && _removeFromParent(tween, 1);

            if (!suppressEvents && !_reverting) {
              _callback(tween, ratio ? "onComplete" : "onReverseComplete", true);

              tween._prom && tween._prom();
            }
          }
        } else if (!tween._zTime) {
          tween._zTime = totalTime;
        }
      },
          _findNextPauseTween = function _findNextPauseTween(animation, prevTime, time) {
        var child;

        if (time > prevTime) {
          child = animation._first;

          while (child && child._start <= time) {
            if (child.data === "isPause" && child._start > prevTime) {
              return child;
            }

            child = child._next;
          }
        } else {
          child = animation._last;

          while (child && child._start >= time) {
            if (child.data === "isPause" && child._start < prevTime) {
              return child;
            }

            child = child._prev;
          }
        }
      },
          _setDuration = function _setDuration(animation, duration, skipUncache, leavePlayhead) {
        var repeat = animation._repeat,
            dur = _roundPrecise(duration) || 0,
            totalProgress = animation._tTime / animation._tDur;
        totalProgress && !leavePlayhead && (animation._time *= dur / animation._dur);
        animation._dur = dur;
        animation._tDur = !repeat ? dur : repeat < 0 ? 1e10 : _roundPrecise(dur * (repeat + 1) + animation._rDelay * repeat);
        totalProgress > 0 && !leavePlayhead && _alignPlayhead(animation, animation._tTime = animation._tDur * totalProgress);
        animation.parent && _setEnd(animation);
        skipUncache || _uncache(animation.parent, animation);
        return animation;
      },
          _onUpdateTotalDuration = function _onUpdateTotalDuration(animation) {
        return animation instanceof Timeline ? _uncache(animation) : _setDuration(animation, animation._dur);
      },
          _zeroPosition = {
        _start: 0,
        endTime: _emptyFunc,
        totalDuration: _emptyFunc
      },
          _parsePosition = function _parsePosition(animation, position, percentAnimation) {
        var labels = animation.labels,
            recent = animation._recent || _zeroPosition,
            clippedDuration = animation.duration() >= _bigNum ? recent.endTime(false) : animation._dur,
            i,
            offset,
            isPercent;

        if (_isString(position) && (isNaN(position) || position in labels)) {
          offset = position.charAt(0);
          isPercent = position.substr(-1) === "%";
          i = position.indexOf("=");

          if (offset === "<" || offset === ">") {
            i >= 0 && (position = position.replace(/=/, ""));
            return (offset === "<" ? recent._start : recent.endTime(recent._repeat >= 0)) + (parseFloat(position.substr(1)) || 0) * (isPercent ? (i < 0 ? recent : percentAnimation).totalDuration() / 100 : 1);
          }

          if (i < 0) {
            position in labels || (labels[position] = clippedDuration);
            return labels[position];
          }

          offset = parseFloat(position.charAt(i - 1) + position.substr(i + 1));

          if (isPercent && percentAnimation) {
            offset = offset / 100 * (_isArray(percentAnimation) ? percentAnimation[0] : percentAnimation).totalDuration();
          }

          return i > 1 ? _parsePosition(animation, position.substr(0, i - 1), percentAnimation) + offset : clippedDuration + offset;
        }

        return position == null ? clippedDuration : +position;
      },
          _createTweenType = function _createTweenType(type, params, timeline) {
        var isLegacy = _isNumber(params[1]),
            varsIndex = (isLegacy ? 2 : 1) + (type < 2 ? 0 : 1),
            vars = params[varsIndex],
            irVars,
            parent;

        isLegacy && (vars.duration = params[1]);
        vars.parent = timeline;

        if (type) {
          irVars = vars;
          parent = timeline;

          while (parent && !("immediateRender" in irVars)) {
            irVars = parent.vars.defaults || {};
            parent = _isNotFalse(parent.vars.inherit) && parent.parent;
          }

          vars.immediateRender = _isNotFalse(irVars.immediateRender);
          type < 2 ? vars.runBackwards = 1 : vars.startAt = params[varsIndex - 1];
        }

        return new Tween(params[0], vars, params[varsIndex + 1]);
      },
          _conditionalReturn = function _conditionalReturn(value, func) {
        return value || value === 0 ? func(value) : func;
      },
          _clamp = function _clamp(min, max, value) {
        return value < min ? min : value > max ? max : value;
      },
          getUnit = function getUnit(value, v) {
        return !_isString(value) || !(v = _unitExp.exec(value)) ? "" : v[1];
      },
          clamp = function clamp(min, max, value) {
        return _conditionalReturn(value, function (v) {
          return _clamp(min, max, v);
        });
      },
          _slice = [].slice,
          _isArrayLike = function _isArrayLike(value, nonEmpty) {
        return value && _isObject(value) && "length" in value && (!nonEmpty && !value.length || value.length - 1 in value && _isObject(value[0])) && !value.nodeType && value !== _win;
      },
          _flatten = function _flatten(ar, leaveStrings, accumulator) {
        if (accumulator === void 0) {
          accumulator = [];
        }

        return ar.forEach(function (value) {
          var _accumulator;

          return _isString(value) && !leaveStrings || _isArrayLike(value, 1) ? (_accumulator = accumulator).push.apply(_accumulator, toArray(value)) : accumulator.push(value);
        }) || accumulator;
      },
          toArray = function toArray(value, scope, leaveStrings) {
        return _context && !scope && _context.selector ? _context.selector(value) : _isString(value) && !leaveStrings && (_coreInitted || !_wake()) ? _slice.call((scope || _doc).querySelectorAll(value), 0) : _isArray(value) ? _flatten(value, leaveStrings) : _isArrayLike(value) ? _slice.call(value, 0) : value ? [value] : [];
      },
          selector = function selector(value) {
        value = toArray(value)[0] || _warn("Invalid scope") || {};
        return function (v) {
          var el = value.current || value.nativeElement || value;
          return toArray(v, el.querySelectorAll ? el : el === value ? _warn("Invalid scope") || _doc.createElement("div") : value);
        };
      },
          shuffle = function shuffle(a) {
        return a.sort(function () {
          return .5 - Math.random();
        });
      },
          distribute = function distribute(v) {
        if (_isFunction(v)) {
          return v;
        }

        var vars = _isObject(v) ? v : {
          each: v
        },
            ease = _parseEase(vars.ease),
            from = vars.from || 0,
            base = parseFloat(vars.base) || 0,
            cache = {},
            isDecimal = from > 0 && from < 1,
            ratios = isNaN(from) || isDecimal,
            axis = vars.axis,
            ratioX = from,
            ratioY = from;

        if (_isString(from)) {
          ratioX = ratioY = {
            center: .5,
            edges: .5,
            end: 1
          }[from] || 0;
        } else if (!isDecimal && ratios) {
          ratioX = from[0];
          ratioY = from[1];
        }

        return function (i, target, a) {
          var l = (a || vars).length,
              distances = cache[l],
              originX,
              originY,
              x,
              y,
              d,
              j,
              max,
              min,
              wrapAt;

          if (!distances) {
            wrapAt = vars.grid === "auto" ? 0 : (vars.grid || [1, _bigNum])[1];

            if (!wrapAt) {
              max = -_bigNum;

              while (max < (max = a[wrapAt++].getBoundingClientRect().left) && wrapAt < l) {}

              wrapAt < l && wrapAt--;
            }

            distances = cache[l] = [];
            originX = ratios ? Math.min(wrapAt, l) * ratioX - .5 : from % wrapAt;
            originY = wrapAt === _bigNum ? 0 : ratios ? l * ratioY / wrapAt - .5 : from / wrapAt | 0;
            max = 0;
            min = _bigNum;

            for (j = 0; j < l; j++) {
              x = j % wrapAt - originX;
              y = originY - (j / wrapAt | 0);
              distances[j] = d = !axis ? _sqrt(x * x + y * y) : Math.abs(axis === "y" ? y : x);
              d > max && (max = d);
              d < min && (min = d);
            }

            from === "random" && shuffle(distances);
            distances.max = max - min;
            distances.min = min;
            distances.v = l = (parseFloat(vars.amount) || parseFloat(vars.each) * (wrapAt > l ? l - 1 : !axis ? Math.max(wrapAt, l / wrapAt) : axis === "y" ? l / wrapAt : wrapAt) || 0) * (from === "edges" ? -1 : 1);
            distances.b = l < 0 ? base - l : base;
            distances.u = getUnit(vars.amount || vars.each) || 0;
            ease = ease && l < 0 ? _invertEase(ease) : ease;
          }

          l = (distances[i] - distances.min) / distances.max || 0;
          return _roundPrecise(distances.b + (ease ? ease(l) : l) * distances.v) + distances.u;
        };
      },
          _roundModifier = function _roundModifier(v) {
        var p = Math.pow(10, ((v + "").split(".")[1] || "").length);
        return function (raw) {
          var n = _roundPrecise(Math.round(parseFloat(raw) / v) * v * p);

          return (n - n % 1) / p + (_isNumber(raw) ? 0 : getUnit(raw));
        };
      },
          snap = function snap(snapTo, value) {
        var isArray = _isArray(snapTo),
            radius,
            is2D;

        if (!isArray && _isObject(snapTo)) {
          radius = isArray = snapTo.radius || _bigNum;

          if (snapTo.values) {
            snapTo = toArray(snapTo.values);

            if (is2D = !_isNumber(snapTo[0])) {
              radius *= radius;
            }
          } else {
            snapTo = _roundModifier(snapTo.increment);
          }
        }

        return _conditionalReturn(value, !isArray ? _roundModifier(snapTo) : _isFunction(snapTo) ? function (raw) {
          is2D = snapTo(raw);
          return Math.abs(is2D - raw) <= radius ? is2D : raw;
        } : function (raw) {
          var x = parseFloat(is2D ? raw.x : raw),
              y = parseFloat(is2D ? raw.y : 0),
              min = _bigNum,
              closest = 0,
              i = snapTo.length,
              dx,
              dy;

          while (i--) {
            if (is2D) {
              dx = snapTo[i].x - x;
              dy = snapTo[i].y - y;
              dx = dx * dx + dy * dy;
            } else {
              dx = Math.abs(snapTo[i] - x);
            }

            if (dx < min) {
              min = dx;
              closest = i;
            }
          }

          closest = !radius || min <= radius ? snapTo[closest] : raw;
          return is2D || closest === raw || _isNumber(raw) ? closest : closest + getUnit(raw);
        });
      },
          random = function random(min, max, roundingIncrement, returnFunction) {
        return _conditionalReturn(_isArray(min) ? !max : roundingIncrement === true ? !!(roundingIncrement = 0) : !returnFunction, function () {
          return _isArray(min) ? min[~~(Math.random() * min.length)] : (roundingIncrement = roundingIncrement || 1e-5) && (returnFunction = roundingIncrement < 1 ? Math.pow(10, (roundingIncrement + "").length - 2) : 1) && Math.floor(Math.round((min - roundingIncrement / 2 + Math.random() * (max - min + roundingIncrement * .99)) / roundingIncrement) * roundingIncrement * returnFunction) / returnFunction;
        });
      },
          pipe = function pipe() {
        for (var _len = arguments.length, functions = new Array(_len), _key = 0; _key < _len; _key++) {
          functions[_key] = arguments[_key];
        }

        return function (value) {
          return functions.reduce(function (v, f) {
            return f(v);
          }, value);
        };
      },
          unitize = function unitize(func, unit) {
        return function (value) {
          return func(parseFloat(value)) + (unit || getUnit(value));
        };
      },
          normalize = function normalize(min, max, value) {
        return mapRange(min, max, 0, 1, value);
      },
          _wrapArray = function _wrapArray(a, wrapper, value) {
        return _conditionalReturn(value, function (index) {
          return a[~~wrapper(index)];
        });
      },
          wrap = function wrap(min, max, value) {
        var range = max - min;
        return _isArray(min) ? _wrapArray(min, wrap(0, min.length), max) : _conditionalReturn(value, function (value) {
          return (range + (value - min) % range) % range + min;
        });
      },
          wrapYoyo = function wrapYoyo(min, max, value) {
        var range = max - min,
            total = range * 2;
        return _isArray(min) ? _wrapArray(min, wrapYoyo(0, min.length - 1), max) : _conditionalReturn(value, function (value) {
          value = (total + (value - min) % total) % total || 0;
          return min + (value > range ? total - value : value);
        });
      },
          _replaceRandom = function _replaceRandom(value) {
        var prev = 0,
            s = "",
            i,
            nums,
            end,
            isArray;

        while (~(i = value.indexOf("random(", prev))) {
          end = value.indexOf(")", i);
          isArray = value.charAt(i + 7) === "[";
          nums = value.substr(i + 7, end - i - 7).match(isArray ? _delimitedValueExp : _strictNumExp);
          s += value.substr(prev, i - prev) + random(isArray ? nums : +nums[0], isArray ? 0 : +nums[1], +nums[2] || 1e-5);
          prev = end + 1;
        }

        return s + value.substr(prev, value.length - prev);
      },
          mapRange = function mapRange(inMin, inMax, outMin, outMax, value) {
        var inRange = inMax - inMin,
            outRange = outMax - outMin;
        return _conditionalReturn(value, function (value) {
          return outMin + ((value - inMin) / inRange * outRange || 0);
        });
      },
          interpolate = function interpolate(start, end, progress, mutate) {
        var func = isNaN(start + end) ? 0 : function (p) {
          return (1 - p) * start + p * end;
        };

        if (!func) {
          var isString = _isString(start),
              master = {},
              p,
              i,
              interpolators,
              l,
              il;

          progress === true && (mutate = 1) && (progress = null);

          if (isString) {
            start = {
              p: start
            };
            end = {
              p: end
            };
          } else if (_isArray(start) && !_isArray(end)) {
            interpolators = [];
            l = start.length;
            il = l - 2;

            for (i = 1; i < l; i++) {
              interpolators.push(interpolate(start[i - 1], start[i]));
            }

            l--;

            func = function func(p) {
              p *= l;
              var i = Math.min(il, ~~p);
              return interpolators[i](p - i);
            };

            progress = end;
          } else if (!mutate) {
            start = _merge(_isArray(start) ? [] : {}, start);
          }

          if (!interpolators) {
            for (p in end) {
              _addPropTween.call(master, start, p, "get", end[p]);
            }

            func = function func(p) {
              return _renderPropTweens(p, master) || (isString ? start.p : start);
            };
          }
        }

        return _conditionalReturn(progress, func);
      },
          _getLabelInDirection = function _getLabelInDirection(timeline, fromTime, backward) {
        var labels = timeline.labels,
            min = _bigNum,
            p,
            distance,
            label;

        for (p in labels) {
          distance = labels[p] - fromTime;

          if (distance < 0 === !!backward && distance && min > (distance = Math.abs(distance))) {
            label = p;
            min = distance;
          }
        }

        return label;
      },
          _callback = function _callback(animation, type, executeLazyFirst) {
        var v = animation.vars,
            callback = v[type],
            prevContext = _context,
            context = animation._ctx,
            params,
            scope,
            result;

        if (!callback) {
          return;
        }

        params = v[type + "Params"];
        scope = v.callbackScope || animation;
        executeLazyFirst && _lazyTweens.length && _lazyRender();
        context && (_context = context);
        result = params ? callback.apply(scope, params) : callback.call(scope);
        _context = prevContext;
        return result;
      },
          _interrupt = function _interrupt(animation) {
        _removeFromParent(animation);

        animation.scrollTrigger && animation.scrollTrigger.kill(!!_reverting);
        animation.progress() < 1 && _callback(animation, "onInterrupt");
        return animation;
      },
          _quickTween,
          _registerPluginQueue = [],
          _createPlugin = function _createPlugin(config) {
        if (!config) return;
        config = !config.name && config["default"] || config;

        if (_windowExists() || config.headless) {
          var name = config.name,
              isFunc = _isFunction(config),
              Plugin = name && !isFunc && config.init ? function () {
            this._props = [];
          } : config,
              instanceDefaults = {
            init: _emptyFunc,
            render: _renderPropTweens,
            add: _addPropTween,
            kill: _killPropTweensOf,
            modifier: _addPluginModifier,
            rawVars: 0
          },
              statics = {
            targetTest: 0,
            get: 0,
            getSetter: _getSetter,
            aliases: {},
            register: 0
          };

          _wake();

          if (config !== Plugin) {
            if (_plugins[name]) {
              return;
            }

            _setDefaults(Plugin, _setDefaults(_copyExcluding(config, instanceDefaults), statics));

            _merge(Plugin.prototype, _merge(instanceDefaults, _copyExcluding(config, statics)));

            _plugins[Plugin.prop = name] = Plugin;

            if (config.targetTest) {
              _harnessPlugins.push(Plugin);

              _reservedProps[name] = 1;
            }

            name = (name === "css" ? "CSS" : name.charAt(0).toUpperCase() + name.substr(1)) + "Plugin";
          }

          _addGlobal(name, Plugin);

          config.register && config.register(gsap, Plugin, PropTween);
        } else {
          _registerPluginQueue.push(config);
        }
      },
          _255 = 255,
          _colorLookup = {
        aqua: [0, _255, _255],
        lime: [0, _255, 0],
        silver: [192, 192, 192],
        black: [0, 0, 0],
        maroon: [128, 0, 0],
        teal: [0, 128, 128],
        blue: [0, 0, _255],
        navy: [0, 0, 128],
        white: [_255, _255, _255],
        olive: [128, 128, 0],
        yellow: [_255, _255, 0],
        orange: [_255, 165, 0],
        gray: [128, 128, 128],
        purple: [128, 0, 128],
        green: [0, 128, 0],
        red: [_255, 0, 0],
        pink: [_255, 192, 203],
        cyan: [0, _255, _255],
        transparent: [_255, _255, _255, 0]
      },
          _hue = function _hue(h, m1, m2) {
        h += h < 0 ? 1 : h > 1 ? -1 : 0;
        return (h * 6 < 1 ? m1 + (m2 - m1) * h * 6 : h < .5 ? m2 : h * 3 < 2 ? m1 + (m2 - m1) * (2 / 3 - h) * 6 : m1) * _255 + .5 | 0;
      },
          splitColor = function splitColor(v, toHSL, forceAlpha) {
        var a = !v ? _colorLookup.black : _isNumber(v) ? [v >> 16, v >> 8 & _255, v & _255] : 0,
            r,
            g,
            b,
            h,
            s,
            l,
            max,
            min,
            d,
            wasHSL;

        if (!a) {
          if (v.substr(-1) === ",") {
            v = v.substr(0, v.length - 1);
          }

          if (_colorLookup[v]) {
            a = _colorLookup[v];
          } else if (v.charAt(0) === "#") {
            if (v.length < 6) {
              r = v.charAt(1);
              g = v.charAt(2);
              b = v.charAt(3);
              v = "#" + r + r + g + g + b + b + (v.length === 5 ? v.charAt(4) + v.charAt(4) : "");
            }

            if (v.length === 9) {
              a = parseInt(v.substr(1, 6), 16);
              return [a >> 16, a >> 8 & _255, a & _255, parseInt(v.substr(7), 16) / 255];
            }

            v = parseInt(v.substr(1), 16);
            a = [v >> 16, v >> 8 & _255, v & _255];
          } else if (v.substr(0, 3) === "hsl") {
            a = wasHSL = v.match(_strictNumExp);

            if (!toHSL) {
              h = +a[0] % 360 / 360;
              s = +a[1] / 100;
              l = +a[2] / 100;
              g = l <= .5 ? l * (s + 1) : l + s - l * s;
              r = l * 2 - g;
              a.length > 3 && (a[3] *= 1);
              a[0] = _hue(h + 1 / 3, r, g);
              a[1] = _hue(h, r, g);
              a[2] = _hue(h - 1 / 3, r, g);
            } else if (~v.indexOf("=")) {
              a = v.match(_numExp);
              forceAlpha && a.length < 4 && (a[3] = 1);
              return a;
            }
          } else {
            a = v.match(_strictNumExp) || _colorLookup.transparent;
          }

          a = a.map(Number);
        }

        if (toHSL && !wasHSL) {
          r = a[0] / _255;
          g = a[1] / _255;
          b = a[2] / _255;
          max = Math.max(r, g, b);
          min = Math.min(r, g, b);
          l = (max + min) / 2;

          if (max === min) {
            h = s = 0;
          } else {
            d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
            h *= 60;
          }

          a[0] = ~~(h + .5);
          a[1] = ~~(s * 100 + .5);
          a[2] = ~~(l * 100 + .5);
        }

        forceAlpha && a.length < 4 && (a[3] = 1);
        return a;
      },
          _colorOrderData = function _colorOrderData(v) {
        var values = [],
            c = [],
            i = -1;
        v.split(_colorExp).forEach(function (v) {
          var a = v.match(_numWithUnitExp) || [];
          values.push.apply(values, a);
          c.push(i += a.length + 1);
        });
        values.c = c;
        return values;
      },
          _formatColors = function _formatColors(s, toHSL, orderMatchData) {
        var result = "",
            colors = (s + result).match(_colorExp),
            type = toHSL ? "hsla(" : "rgba(",
            i = 0,
            c,
            shell,
            d,
            l;

        if (!colors) {
          return s;
        }

        colors = colors.map(function (color) {
          return (color = splitColor(color, toHSL, 1)) && type + (toHSL ? color[0] + "," + color[1] + "%," + color[2] + "%," + color[3] : color.join(",")) + ")";
        });

        if (orderMatchData) {
          d = _colorOrderData(s);
          c = orderMatchData.c;

          if (c.join(result) !== d.c.join(result)) {
            shell = s.replace(_colorExp, "1").split(_numWithUnitExp);
            l = shell.length - 1;

            for (; i < l; i++) {
              result += shell[i] + (~c.indexOf(i) ? colors.shift() || type + "0,0,0,0)" : (d.length ? d : colors.length ? colors : orderMatchData).shift());
            }
          }
        }

        if (!shell) {
          shell = s.split(_colorExp);
          l = shell.length - 1;

          for (; i < l; i++) {
            result += shell[i] + colors[i];
          }
        }

        return result + shell[l];
      },
          _colorExp = function () {
        var s = "(?:\\b(?:(?:rgb|rgba|hsl|hsla)\\(.+?\\))|\\B#(?:[0-9a-f]{3,4}){1,2}\\b",
            p;

        for (p in _colorLookup) {
          s += "|" + p + "\\b";
        }

        return new RegExp(s + ")", "gi");
      }(),
          _hslExp = /hsl[a]?\(/,
          _colorStringFilter = function _colorStringFilter(a) {
        var combined = a.join(" "),
            toHSL;
        _colorExp.lastIndex = 0;

        if (_colorExp.test(combined)) {
          toHSL = _hslExp.test(combined);
          a[1] = _formatColors(a[1], toHSL);
          a[0] = _formatColors(a[0], toHSL, _colorOrderData(a[1]));
          return true;
        }
      },
          _tickerActive,
          _ticker = function () {
        var _getTime = Date.now,
            _lagThreshold = 500,
            _adjustedLag = 33,
            _startTime = _getTime(),
            _lastUpdate = _startTime,
            _gap = 1000 / 240,
            _nextTime = _gap,
            _listeners = [],
            _id,
            _req,
            _raf,
            _self,
            _delta,
            _i,
            _tick = function _tick(v) {
          var elapsed = _getTime() - _lastUpdate,
              manual = v === true,
              overlap,
              dispatch,
              time,
              frame;

          (elapsed > _lagThreshold || elapsed < 0) && (_startTime += elapsed - _adjustedLag);
          _lastUpdate += elapsed;
          time = _lastUpdate - _startTime;
          overlap = time - _nextTime;

          if (overlap > 0 || manual) {
            frame = ++_self.frame;
            _delta = time - _self.time * 1000;
            _self.time = time = time / 1000;
            _nextTime += overlap + (overlap >= _gap ? 4 : _gap - overlap);
            dispatch = 1;
          }

          manual || (_id = _req(_tick));

          if (dispatch) {
            for (_i = 0; _i < _listeners.length; _i++) {
              _listeners[_i](time, _delta, frame, v);
            }
          }
        };

        _self = {
          time: 0,
          frame: 0,
          tick: function tick() {
            _tick(true);
          },
          deltaRatio: function deltaRatio(fps) {
            return _delta / (1000 / (fps || 60));
          },
          wake: function wake() {
            if (_coreReady) {
              if (!_coreInitted && _windowExists()) {
                _win = _coreInitted = window;
                _doc = _win.document || {};
                _globals.gsap = gsap;
                (_win.gsapVersions || (_win.gsapVersions = [])).push(gsap.version);

                _install(_installScope || _win.GreenSockGlobals || !_win.gsap && _win || {});

                _registerPluginQueue.forEach(_createPlugin);
              }

              _raf = typeof requestAnimationFrame !== "undefined" && requestAnimationFrame;
              _id && _self.sleep();

              _req = _raf || function (f) {
                return setTimeout(f, _nextTime - _self.time * 1000 + 1 | 0);
              };

              _tickerActive = 1;

              _tick(2);
            }
          },
          sleep: function sleep() {
            (_raf ? cancelAnimationFrame : clearTimeout)(_id);
            _tickerActive = 0;
            _req = _emptyFunc;
          },
          lagSmoothing: function lagSmoothing(threshold, adjustedLag) {
            _lagThreshold = threshold || Infinity;
            _adjustedLag = Math.min(adjustedLag || 33, _lagThreshold);
          },
          fps: function fps(_fps) {
            _gap = 1000 / (_fps || 240);
            _nextTime = _self.time * 1000 + _gap;
          },
          add: function add(callback, once, prioritize) {
            var func = once ? function (t, d, f, v) {
              callback(t, d, f, v);

              _self.remove(func);
            } : callback;

            _self.remove(callback);

            _listeners[prioritize ? "unshift" : "push"](func);

            _wake();

            return func;
          },
          remove: function remove(callback, i) {
            ~(i = _listeners.indexOf(callback)) && _listeners.splice(i, 1) && _i >= i && _i--;
          },
          _listeners: _listeners
        };
        return _self;
      }(),
          _wake = function _wake() {
        return !_tickerActive && _ticker.wake();
      },
          _easeMap = {},
          _customEaseExp = /^[\d.\-M][\d.\-,\s]/,
          _quotesExp = /["']/g,
          _parseObjectInString = function _parseObjectInString(value) {
        var obj = {},
            split = value.substr(1, value.length - 3).split(":"),
            key = split[0],
            i = 1,
            l = split.length,
            index,
            val,
            parsedVal;

        for (; i < l; i++) {
          val = split[i];
          index = i !== l - 1 ? val.lastIndexOf(",") : val.length;
          parsedVal = val.substr(0, index);
          obj[key] = isNaN(parsedVal) ? parsedVal.replace(_quotesExp, "").trim() : +parsedVal;
          key = val.substr(index + 1).trim();
        }

        return obj;
      },
          _valueInParentheses = function _valueInParentheses(value) {
        var open = value.indexOf("(") + 1,
            close = value.indexOf(")"),
            nested = value.indexOf("(", open);
        return value.substring(open, ~nested && nested < close ? value.indexOf(")", close + 1) : close);
      },
          _configEaseFromString = function _configEaseFromString(name) {
        var split = (name + "").split("("),
            ease = _easeMap[split[0]];
        return ease && split.length > 1 && ease.config ? ease.config.apply(null, ~name.indexOf("{") ? [_parseObjectInString(split[1])] : _valueInParentheses(name).split(",").map(_numericIfPossible)) : _easeMap._CE && _customEaseExp.test(name) ? _easeMap._CE("", name) : ease;
      },
          _invertEase = function _invertEase(ease) {
        return function (p) {
          return 1 - ease(1 - p);
        };
      },
          _propagateYoyoEase = function _propagateYoyoEase(timeline, isYoyo) {
        var child = timeline._first,
            ease;

        while (child) {
          if (child instanceof Timeline) {
            _propagateYoyoEase(child, isYoyo);
          } else if (child.vars.yoyoEase && (!child._yoyo || !child._repeat) && child._yoyo !== isYoyo) {
            if (child.timeline) {
              _propagateYoyoEase(child.timeline, isYoyo);
            } else {
              ease = child._ease;
              child._ease = child._yEase;
              child._yEase = ease;
              child._yoyo = isYoyo;
            }
          }

          child = child._next;
        }
      },
          _parseEase = function _parseEase(ease, defaultEase) {
        return !ease ? defaultEase : (_isFunction(ease) ? ease : _easeMap[ease] || _configEaseFromString(ease)) || defaultEase;
      },
          _insertEase = function _insertEase(names, easeIn, easeOut, easeInOut) {
        if (easeOut === void 0) {
          easeOut = function easeOut(p) {
            return 1 - easeIn(1 - p);
          };
        }

        if (easeInOut === void 0) {
          easeInOut = function easeInOut(p) {
            return p < .5 ? easeIn(p * 2) / 2 : 1 - easeIn((1 - p) * 2) / 2;
          };
        }

        var ease = {
          easeIn: easeIn,
          easeOut: easeOut,
          easeInOut: easeInOut
        },
            lowercaseName;

        _forEachName(names, function (name) {
          _easeMap[name] = _globals[name] = ease;
          _easeMap[lowercaseName = name.toLowerCase()] = easeOut;

          for (var p in ease) {
            _easeMap[lowercaseName + (p === "easeIn" ? ".in" : p === "easeOut" ? ".out" : ".inOut")] = _easeMap[name + "." + p] = ease[p];
          }
        });

        return ease;
      },
          _easeInOutFromOut = function _easeInOutFromOut(easeOut) {
        return function (p) {
          return p < .5 ? (1 - easeOut(1 - p * 2)) / 2 : .5 + easeOut((p - .5) * 2) / 2;
        };
      },
          _configElastic = function _configElastic(type, amplitude, period) {
        var p1 = amplitude >= 1 ? amplitude : 1,
            p2 = (period || (type ? .3 : .45)) / (amplitude < 1 ? amplitude : 1),
            p3 = p2 / _2PI * (Math.asin(1 / p1) || 0),
            easeOut = function easeOut(p) {
          return p === 1 ? 1 : p1 * Math.pow(2, -10 * p) * _sin((p - p3) * p2) + 1;
        },
            ease = type === "out" ? easeOut : type === "in" ? function (p) {
          return 1 - easeOut(1 - p);
        } : _easeInOutFromOut(easeOut);

        p2 = _2PI / p2;

        ease.config = function (amplitude, period) {
          return _configElastic(type, amplitude, period);
        };

        return ease;
      },
          _configBack = function _configBack(type, overshoot) {
        if (overshoot === void 0) {
          overshoot = 1.70158;
        }

        var easeOut = function easeOut(p) {
          return p ? --p * p * ((overshoot + 1) * p + overshoot) + 1 : 0;
        },
            ease = type === "out" ? easeOut : type === "in" ? function (p) {
          return 1 - easeOut(1 - p);
        } : _easeInOutFromOut(easeOut);

        ease.config = function (overshoot) {
          return _configBack(type, overshoot);
        };

        return ease;
      };

      _forEachName("Linear,Quad,Cubic,Quart,Quint,Strong", function (name, i) {
        var power = i < 5 ? i + 1 : i;

        _insertEase(name + ",Power" + (power - 1), i ? function (p) {
          return Math.pow(p, power);
        } : function (p) {
          return p;
        }, function (p) {
          return 1 - Math.pow(1 - p, power);
        }, function (p) {
          return p < .5 ? Math.pow(p * 2, power) / 2 : 1 - Math.pow((1 - p) * 2, power) / 2;
        });
      });

      _easeMap.Linear.easeNone = _easeMap.none = _easeMap.Linear.easeIn;

      _insertEase("Elastic", _configElastic("in"), _configElastic("out"), _configElastic());

      (function (n, c) {
        var n1 = 1 / c,
            n2 = 2 * n1,
            n3 = 2.5 * n1,
            easeOut = function easeOut(p) {
          return p < n1 ? n * p * p : p < n2 ? n * Math.pow(p - 1.5 / c, 2) + .75 : p < n3 ? n * (p -= 2.25 / c) * p + .9375 : n * Math.pow(p - 2.625 / c, 2) + .984375;
        };

        _insertEase("Bounce", function (p) {
          return 1 - easeOut(1 - p);
        }, easeOut);
      })(7.5625, 2.75);

      _insertEase("Expo", function (p) {
        return p ? Math.pow(2, 10 * (p - 1)) : 0;
      });

      _insertEase("Circ", function (p) {
        return -(_sqrt(1 - p * p) - 1);
      });

      _insertEase("Sine", function (p) {
        return p === 1 ? 1 : -_cos(p * _HALF_PI) + 1;
      });

      _insertEase("Back", _configBack("in"), _configBack("out"), _configBack());

      _easeMap.SteppedEase = _easeMap.steps = _globals.SteppedEase = {
        config: function config(steps, immediateStart) {
          if (steps === void 0) {
            steps = 1;
          }

          var p1 = 1 / steps,
              p2 = steps + (immediateStart ? 0 : 1),
              p3 = immediateStart ? 1 : 0,
              max = 1 - _tinyNum;
          return function (p) {
            return ((p2 * _clamp(0, max, p) | 0) + p3) * p1;
          };
        }
      };
      _defaults.ease = _easeMap["quad.out"];

      _forEachName("onComplete,onUpdate,onStart,onRepeat,onReverseComplete,onInterrupt", function (name) {
        return _callbackNames += name + "," + name + "Params,";
      });

      var GSCache = function GSCache(target, harness) {
        this.id = _gsID++;
        target._gsap = this;
        this.target = target;
        this.harness = harness;
        this.get = harness ? harness.get : _getProperty;
        this.set = harness ? harness.getSetter : _getSetter;
      };
      var Animation = function () {
        function Animation(vars) {
          this.vars = vars;
          this._delay = +vars.delay || 0;

          if (this._repeat = vars.repeat === Infinity ? -2 : vars.repeat || 0) {
            this._rDelay = vars.repeatDelay || 0;
            this._yoyo = !!vars.yoyo || !!vars.yoyoEase;
          }

          this._ts = 1;

          _setDuration(this, +vars.duration, 1, 1);

          this.data = vars.data;

          if (_context) {
            this._ctx = _context;

            _context.data.push(this);
          }

          _tickerActive || _ticker.wake();
        }

        var _proto = Animation.prototype;

        _proto.delay = function delay(value) {
          if (value || value === 0) {
            this.parent && this.parent.smoothChildTiming && this.startTime(this._start + value - this._delay);
            this._delay = value;
            return this;
          }

          return this._delay;
        };

        _proto.duration = function duration(value) {
          return arguments.length ? this.totalDuration(this._repeat > 0 ? value + (value + this._rDelay) * this._repeat : value) : this.totalDuration() && this._dur;
        };

        _proto.totalDuration = function totalDuration(value) {
          if (!arguments.length) {
            return this._tDur;
          }

          this._dirty = 0;
          return _setDuration(this, this._repeat < 0 ? value : (value - this._repeat * this._rDelay) / (this._repeat + 1));
        };

        _proto.totalTime = function totalTime(_totalTime, suppressEvents) {
          _wake();

          if (!arguments.length) {
            return this._tTime;
          }

          var parent = this._dp;

          if (parent && parent.smoothChildTiming && this._ts) {
            _alignPlayhead(this, _totalTime);

            !parent._dp || parent.parent || _postAddChecks(parent, this);

            while (parent && parent.parent) {
              if (parent.parent._time !== parent._start + (parent._ts >= 0 ? parent._tTime / parent._ts : (parent.totalDuration() - parent._tTime) / -parent._ts)) {
                parent.totalTime(parent._tTime, true);
              }

              parent = parent.parent;
            }

            if (!this.parent && this._dp.autoRemoveChildren && (this._ts > 0 && _totalTime < this._tDur || this._ts < 0 && _totalTime > 0 || !this._tDur && !_totalTime)) {
              _addToTimeline(this._dp, this, this._start - this._delay);
            }
          }

          if (this._tTime !== _totalTime || !this._dur && !suppressEvents || this._initted && Math.abs(this._zTime) === _tinyNum || !_totalTime && !this._initted && (this.add || this._ptLookup)) {
            this._ts || (this._pTime = _totalTime);

            _lazySafeRender(this, _totalTime, suppressEvents);
          }

          return this;
        };

        _proto.time = function time(value, suppressEvents) {
          return arguments.length ? this.totalTime(Math.min(this.totalDuration(), value + _elapsedCycleDuration(this)) % (this._dur + this._rDelay) || (value ? this._dur : 0), suppressEvents) : this._time;
        };

        _proto.totalProgress = function totalProgress(value, suppressEvents) {
          return arguments.length ? this.totalTime(this.totalDuration() * value, suppressEvents) : this.totalDuration() ? Math.min(1, this._tTime / this._tDur) : this.rawTime() > 0 ? 1 : 0;
        };

        _proto.progress = function progress(value, suppressEvents) {
          return arguments.length ? this.totalTime(this.duration() * (this._yoyo && !(this.iteration() & 1) ? 1 - value : value) + _elapsedCycleDuration(this), suppressEvents) : this.duration() ? Math.min(1, this._time / this._dur) : this.rawTime() > 0 ? 1 : 0;
        };

        _proto.iteration = function iteration(value, suppressEvents) {
          var cycleDuration = this.duration() + this._rDelay;

          return arguments.length ? this.totalTime(this._time + (value - 1) * cycleDuration, suppressEvents) : this._repeat ? _animationCycle(this._tTime, cycleDuration) + 1 : 1;
        };

        _proto.timeScale = function timeScale(value, suppressEvents) {
          if (!arguments.length) {
            return this._rts === -_tinyNum ? 0 : this._rts;
          }

          if (this._rts === value) {
            return this;
          }

          var tTime = this.parent && this._ts ? _parentToChildTotalTime(this.parent._time, this) : this._tTime;
          this._rts = +value || 0;
          this._ts = this._ps || value === -_tinyNum ? 0 : this._rts;
          this.totalTime(_clamp(-Math.abs(this._delay), this._tDur, tTime), suppressEvents !== false);

          _setEnd(this);

          return _recacheAncestors(this);
        };

        _proto.paused = function paused(value) {
          if (!arguments.length) {
            return this._ps;
          }

          if (this._ps !== value) {
            this._ps = value;

            if (value) {
              this._pTime = this._tTime || Math.max(-this._delay, this.rawTime());
              this._ts = this._act = 0;
            } else {
              _wake();

              this._ts = this._rts;
              this.totalTime(this.parent && !this.parent.smoothChildTiming ? this.rawTime() : this._tTime || this._pTime, this.progress() === 1 && Math.abs(this._zTime) !== _tinyNum && (this._tTime -= _tinyNum));
            }
          }

          return this;
        };

        _proto.startTime = function startTime(value) {
          if (arguments.length) {
            this._start = value;
            var parent = this.parent || this._dp;
            parent && (parent._sort || !this.parent) && _addToTimeline(parent, this, value - this._delay);
            return this;
          }

          return this._start;
        };

        _proto.endTime = function endTime(includeRepeats) {
          return this._start + (_isNotFalse(includeRepeats) ? this.totalDuration() : this.duration()) / Math.abs(this._ts || 1);
        };

        _proto.rawTime = function rawTime(wrapRepeats) {
          var parent = this.parent || this._dp;
          return !parent ? this._tTime : wrapRepeats && (!this._ts || this._repeat && this._time && this.totalProgress() < 1) ? this._tTime % (this._dur + this._rDelay) : !this._ts ? this._tTime : _parentToChildTotalTime(parent.rawTime(wrapRepeats), this);
        };

        _proto.revert = function revert(config) {
          if (config === void 0) {
            config = _revertConfig;
          }

          var prevIsReverting = _reverting;
          _reverting = config;

          if (this._initted || this._startAt) {
            this.timeline && this.timeline.revert(config);
            this.totalTime(-0.01, config.suppressEvents);
          }

          this.data !== "nested" && config.kill !== false && this.kill();
          _reverting = prevIsReverting;
          return this;
        };

        _proto.globalTime = function globalTime(rawTime) {
          var animation = this,
              time = arguments.length ? rawTime : animation.rawTime();

          while (animation) {
            time = animation._start + time / (Math.abs(animation._ts) || 1);
            animation = animation._dp;
          }

          return !this.parent && this._sat ? this._sat.globalTime(rawTime) : time;
        };

        _proto.repeat = function repeat(value) {
          if (arguments.length) {
            this._repeat = value === Infinity ? -2 : value;
            return _onUpdateTotalDuration(this);
          }

          return this._repeat === -2 ? Infinity : this._repeat;
        };

        _proto.repeatDelay = function repeatDelay(value) {
          if (arguments.length) {
            var time = this._time;
            this._rDelay = value;

            _onUpdateTotalDuration(this);

            return time ? this.time(time) : this;
          }

          return this._rDelay;
        };

        _proto.yoyo = function yoyo(value) {
          if (arguments.length) {
            this._yoyo = value;
            return this;
          }

          return this._yoyo;
        };

        _proto.seek = function seek(position, suppressEvents) {
          return this.totalTime(_parsePosition(this, position), _isNotFalse(suppressEvents));
        };

        _proto.restart = function restart(includeDelay, suppressEvents) {
          return this.play().totalTime(includeDelay ? -this._delay : 0, _isNotFalse(suppressEvents));
        };

        _proto.play = function play(from, suppressEvents) {
          from != null && this.seek(from, suppressEvents);
          return this.reversed(false).paused(false);
        };

        _proto.reverse = function reverse(from, suppressEvents) {
          from != null && this.seek(from || this.totalDuration(), suppressEvents);
          return this.reversed(true).paused(false);
        };

        _proto.pause = function pause(atTime, suppressEvents) {
          atTime != null && this.seek(atTime, suppressEvents);
          return this.paused(true);
        };

        _proto.resume = function resume() {
          return this.paused(false);
        };

        _proto.reversed = function reversed(value) {
          if (arguments.length) {
            !!value !== this.reversed() && this.timeScale(-this._rts || (value ? -_tinyNum : 0));
            return this;
          }

          return this._rts < 0;
        };

        _proto.invalidate = function invalidate() {
          this._initted = this._act = 0;
          this._zTime = -_tinyNum;
          return this;
        };

        _proto.isActive = function isActive() {
          var parent = this.parent || this._dp,
              start = this._start,
              rawTime;
          return !!(!parent || this._ts && this._initted && parent.isActive() && (rawTime = parent.rawTime(true)) >= start && rawTime < this.endTime(true) - _tinyNum);
        };

        _proto.eventCallback = function eventCallback(type, callback, params) {
          var vars = this.vars;

          if (arguments.length > 1) {
            if (!callback) {
              delete vars[type];
            } else {
              vars[type] = callback;
              params && (vars[type + "Params"] = params);
              type === "onUpdate" && (this._onUpdate = callback);
            }

            return this;
          }

          return vars[type];
        };

        _proto.then = function then(onFulfilled) {
          var self = this;
          return new Promise(function (resolve) {
            var f = _isFunction(onFulfilled) ? onFulfilled : _passThrough,
                _resolve = function _resolve() {
              var _then = self.then;
              self.then = null;
              _isFunction(f) && (f = f(self)) && (f.then || f === self) && (self.then = _then);
              resolve(f);
              self.then = _then;
            };

            if (self._initted && self.totalProgress() === 1 && self._ts >= 0 || !self._tTime && self._ts < 0) {
              _resolve();
            } else {
              self._prom = _resolve;
            }
          });
        };

        _proto.kill = function kill() {
          _interrupt(this);
        };

        return Animation;
      }();

      _setDefaults(Animation.prototype, {
        _time: 0,
        _start: 0,
        _end: 0,
        _tTime: 0,
        _tDur: 0,
        _dirty: 0,
        _repeat: 0,
        _yoyo: false,
        parent: null,
        _initted: false,
        _rDelay: 0,
        _ts: 1,
        _dp: 0,
        ratio: 0,
        _zTime: -_tinyNum,
        _prom: 0,
        _ps: false,
        _rts: 1
      });

      var Timeline = function (_Animation) {
        _inheritsLoose(Timeline, _Animation);

        function Timeline(vars, position) {
          var _this;

          if (vars === void 0) {
            vars = {};
          }

          _this = _Animation.call(this, vars) || this;
          _this.labels = {};
          _this.smoothChildTiming = !!vars.smoothChildTiming;
          _this.autoRemoveChildren = !!vars.autoRemoveChildren;
          _this._sort = _isNotFalse(vars.sortChildren);
          _globalTimeline && _addToTimeline(vars.parent || _globalTimeline, _assertThisInitialized(_this), position);
          vars.reversed && _this.reverse();
          vars.paused && _this.paused(true);
          vars.scrollTrigger && _scrollTrigger(_assertThisInitialized(_this), vars.scrollTrigger);
          return _this;
        }

        var _proto2 = Timeline.prototype;

        _proto2.to = function to(targets, vars, position) {
          _createTweenType(0, arguments, this);

          return this;
        };

        _proto2.from = function from(targets, vars, position) {
          _createTweenType(1, arguments, this);

          return this;
        };

        _proto2.fromTo = function fromTo(targets, fromVars, toVars, position) {
          _createTweenType(2, arguments, this);

          return this;
        };

        _proto2.set = function set(targets, vars, position) {
          vars.duration = 0;
          vars.parent = this;
          _inheritDefaults(vars).repeatDelay || (vars.repeat = 0);
          vars.immediateRender = !!vars.immediateRender;
          new Tween(targets, vars, _parsePosition(this, position), 1);
          return this;
        };

        _proto2.call = function call(callback, params, position) {
          return _addToTimeline(this, Tween.delayedCall(0, callback, params), position);
        };

        _proto2.staggerTo = function staggerTo(targets, duration, vars, stagger, position, onCompleteAll, onCompleteAllParams) {
          vars.duration = duration;
          vars.stagger = vars.stagger || stagger;
          vars.onComplete = onCompleteAll;
          vars.onCompleteParams = onCompleteAllParams;
          vars.parent = this;
          new Tween(targets, vars, _parsePosition(this, position));
          return this;
        };

        _proto2.staggerFrom = function staggerFrom(targets, duration, vars, stagger, position, onCompleteAll, onCompleteAllParams) {
          vars.runBackwards = 1;
          _inheritDefaults(vars).immediateRender = _isNotFalse(vars.immediateRender);
          return this.staggerTo(targets, duration, vars, stagger, position, onCompleteAll, onCompleteAllParams);
        };

        _proto2.staggerFromTo = function staggerFromTo(targets, duration, fromVars, toVars, stagger, position, onCompleteAll, onCompleteAllParams) {
          toVars.startAt = fromVars;
          _inheritDefaults(toVars).immediateRender = _isNotFalse(toVars.immediateRender);
          return this.staggerTo(targets, duration, toVars, stagger, position, onCompleteAll, onCompleteAllParams);
        };

        _proto2.render = function render(totalTime, suppressEvents, force) {
          var prevTime = this._time,
              tDur = this._dirty ? this.totalDuration() : this._tDur,
              dur = this._dur,
              tTime = totalTime <= 0 ? 0 : _roundPrecise(totalTime),
              crossingStart = this._zTime < 0 !== totalTime < 0 && (this._initted || !dur),
              time,
              child,
              next,
              iteration,
              cycleDuration,
              prevPaused,
              pauseTween,
              timeScale,
              prevStart,
              prevIteration,
              yoyo,
              isYoyo;
          this !== _globalTimeline && tTime > tDur && totalTime >= 0 && (tTime = tDur);

          if (tTime !== this._tTime || force || crossingStart) {
            if (prevTime !== this._time && dur) {
              tTime += this._time - prevTime;
              totalTime += this._time - prevTime;
            }

            time = tTime;
            prevStart = this._start;
            timeScale = this._ts;
            prevPaused = !timeScale;

            if (crossingStart) {
              dur || (prevTime = this._zTime);
              (totalTime || !suppressEvents) && (this._zTime = totalTime);
            }

            if (this._repeat) {
              yoyo = this._yoyo;
              cycleDuration = dur + this._rDelay;

              if (this._repeat < -1 && totalTime < 0) {
                return this.totalTime(cycleDuration * 100 + totalTime, suppressEvents, force);
              }

              time = _roundPrecise(tTime % cycleDuration);

              if (tTime === tDur) {
                iteration = this._repeat;
                time = dur;
              } else {
                iteration = ~~(tTime / cycleDuration);

                if (iteration && iteration === tTime / cycleDuration) {
                  time = dur;
                  iteration--;
                }

                time > dur && (time = dur);
              }

              prevIteration = _animationCycle(this._tTime, cycleDuration);
              !prevTime && this._tTime && prevIteration !== iteration && this._tTime - prevIteration * cycleDuration - this._dur <= 0 && (prevIteration = iteration);

              if (yoyo && iteration & 1) {
                time = dur - time;
                isYoyo = 1;
              }

              if (iteration !== prevIteration && !this._lock) {
                var rewinding = yoyo && prevIteration & 1,
                    doesWrap = rewinding === (yoyo && iteration & 1);
                iteration < prevIteration && (rewinding = !rewinding);
                prevTime = rewinding ? 0 : tTime % dur ? dur : tTime;
                this._lock = 1;
                this.render(prevTime || (isYoyo ? 0 : _roundPrecise(iteration * cycleDuration)), suppressEvents, !dur)._lock = 0;
                this._tTime = tTime;
                !suppressEvents && this.parent && _callback(this, "onRepeat");
                this.vars.repeatRefresh && !isYoyo && (this.invalidate()._lock = 1);

                if (prevTime && prevTime !== this._time || prevPaused !== !this._ts || this.vars.onRepeat && !this.parent && !this._act) {
                  return this;
                }

                dur = this._dur;
                tDur = this._tDur;

                if (doesWrap) {
                  this._lock = 2;
                  prevTime = rewinding ? dur : -0.0001;
                  this.render(prevTime, true);
                  this.vars.repeatRefresh && !isYoyo && this.invalidate();
                }

                this._lock = 0;

                if (!this._ts && !prevPaused) {
                  return this;
                }

                _propagateYoyoEase(this, isYoyo);
              }
            }

            if (this._hasPause && !this._forcing && this._lock < 2) {
              pauseTween = _findNextPauseTween(this, _roundPrecise(prevTime), _roundPrecise(time));

              if (pauseTween) {
                tTime -= time - (time = pauseTween._start);
              }
            }

            this._tTime = tTime;
            this._time = time;
            this._act = !timeScale;

            if (!this._initted) {
              this._onUpdate = this.vars.onUpdate;
              this._initted = 1;
              this._zTime = totalTime;
              prevTime = 0;
            }

            if (!prevTime && time && !suppressEvents && !iteration) {
              _callback(this, "onStart");

              if (this._tTime !== tTime) {
                return this;
              }
            }

            if (time >= prevTime && totalTime >= 0) {
              child = this._first;

              while (child) {
                next = child._next;

                if ((child._act || time >= child._start) && child._ts && pauseTween !== child) {
                  if (child.parent !== this) {
                    return this.render(totalTime, suppressEvents, force);
                  }

                  child.render(child._ts > 0 ? (time - child._start) * child._ts : (child._dirty ? child.totalDuration() : child._tDur) + (time - child._start) * child._ts, suppressEvents, force);

                  if (time !== this._time || !this._ts && !prevPaused) {
                    pauseTween = 0;
                    next && (tTime += this._zTime = -_tinyNum);
                    break;
                  }
                }

                child = next;
              }
            } else {
              child = this._last;
              var adjustedTime = totalTime < 0 ? totalTime : time;

              while (child) {
                next = child._prev;

                if ((child._act || adjustedTime <= child._end) && child._ts && pauseTween !== child) {
                  if (child.parent !== this) {
                    return this.render(totalTime, suppressEvents, force);
                  }

                  child.render(child._ts > 0 ? (adjustedTime - child._start) * child._ts : (child._dirty ? child.totalDuration() : child._tDur) + (adjustedTime - child._start) * child._ts, suppressEvents, force || _reverting && (child._initted || child._startAt));

                  if (time !== this._time || !this._ts && !prevPaused) {
                    pauseTween = 0;
                    next && (tTime += this._zTime = adjustedTime ? -_tinyNum : _tinyNum);
                    break;
                  }
                }

                child = next;
              }
            }

            if (pauseTween && !suppressEvents) {
              this.pause();
              pauseTween.render(time >= prevTime ? 0 : -_tinyNum)._zTime = time >= prevTime ? 1 : -1;

              if (this._ts) {
                this._start = prevStart;

                _setEnd(this);

                return this.render(totalTime, suppressEvents, force);
              }
            }

            this._onUpdate && !suppressEvents && _callback(this, "onUpdate", true);
            if (tTime === tDur && this._tTime >= this.totalDuration() || !tTime && prevTime) if (prevStart === this._start || Math.abs(timeScale) !== Math.abs(this._ts)) if (!this._lock) {
              (totalTime || !dur) && (tTime === tDur && this._ts > 0 || !tTime && this._ts < 0) && _removeFromParent(this, 1);

              if (!suppressEvents && !(totalTime < 0 && !prevTime) && (tTime || prevTime || !tDur)) {
                _callback(this, tTime === tDur && totalTime >= 0 ? "onComplete" : "onReverseComplete", true);

                this._prom && !(tTime < tDur && this.timeScale() > 0) && this._prom();
              }
            }
          }

          return this;
        };

        _proto2.add = function add(child, position) {
          var _this2 = this;

          _isNumber(position) || (position = _parsePosition(this, position, child));

          if (!(child instanceof Animation)) {
            if (_isArray(child)) {
              child.forEach(function (obj) {
                return _this2.add(obj, position);
              });
              return this;
            }

            if (_isString(child)) {
              return this.addLabel(child, position);
            }

            if (_isFunction(child)) {
              child = Tween.delayedCall(0, child);
            } else {
              return this;
            }
          }

          return this !== child ? _addToTimeline(this, child, position) : this;
        };

        _proto2.getChildren = function getChildren(nested, tweens, timelines, ignoreBeforeTime) {
          if (nested === void 0) {
            nested = true;
          }

          if (tweens === void 0) {
            tweens = true;
          }

          if (timelines === void 0) {
            timelines = true;
          }

          if (ignoreBeforeTime === void 0) {
            ignoreBeforeTime = -_bigNum;
          }

          var a = [],
              child = this._first;

          while (child) {
            if (child._start >= ignoreBeforeTime) {
              if (child instanceof Tween) {
                tweens && a.push(child);
              } else {
                timelines && a.push(child);
                nested && a.push.apply(a, child.getChildren(true, tweens, timelines));
              }
            }

            child = child._next;
          }

          return a;
        };

        _proto2.getById = function getById(id) {
          var animations = this.getChildren(1, 1, 1),
              i = animations.length;

          while (i--) {
            if (animations[i].vars.id === id) {
              return animations[i];
            }
          }
        };

        _proto2.remove = function remove(child) {
          if (_isString(child)) {
            return this.removeLabel(child);
          }

          if (_isFunction(child)) {
            return this.killTweensOf(child);
          }

          _removeLinkedListItem(this, child);

          if (child === this._recent) {
            this._recent = this._last;
          }

          return _uncache(this);
        };

        _proto2.totalTime = function totalTime(_totalTime2, suppressEvents) {
          if (!arguments.length) {
            return this._tTime;
          }

          this._forcing = 1;

          if (!this._dp && this._ts) {
            this._start = _roundPrecise(_ticker.time - (this._ts > 0 ? _totalTime2 / this._ts : (this.totalDuration() - _totalTime2) / -this._ts));
          }

          _Animation.prototype.totalTime.call(this, _totalTime2, suppressEvents);

          this._forcing = 0;
          return this;
        };

        _proto2.addLabel = function addLabel(label, position) {
          this.labels[label] = _parsePosition(this, position);
          return this;
        };

        _proto2.removeLabel = function removeLabel(label) {
          delete this.labels[label];
          return this;
        };

        _proto2.addPause = function addPause(position, callback, params) {
          var t = Tween.delayedCall(0, callback || _emptyFunc, params);
          t.data = "isPause";
          this._hasPause = 1;
          return _addToTimeline(this, t, _parsePosition(this, position));
        };

        _proto2.removePause = function removePause(position) {
          var child = this._first;
          position = _parsePosition(this, position);

          while (child) {
            if (child._start === position && child.data === "isPause") {
              _removeFromParent(child);
            }

            child = child._next;
          }
        };

        _proto2.killTweensOf = function killTweensOf(targets, props, onlyActive) {
          var tweens = this.getTweensOf(targets, onlyActive),
              i = tweens.length;

          while (i--) {
            _overwritingTween !== tweens[i] && tweens[i].kill(targets, props);
          }

          return this;
        };

        _proto2.getTweensOf = function getTweensOf(targets, onlyActive) {
          var a = [],
              parsedTargets = toArray(targets),
              child = this._first,
              isGlobalTime = _isNumber(onlyActive),
              children;

          while (child) {
            if (child instanceof Tween) {
              if (_arrayContainsAny(child._targets, parsedTargets) && (isGlobalTime ? (!_overwritingTween || child._initted && child._ts) && child.globalTime(0) <= onlyActive && child.globalTime(child.totalDuration()) > onlyActive : !onlyActive || child.isActive())) {
                a.push(child);
              }
            } else if ((children = child.getTweensOf(parsedTargets, onlyActive)).length) {
              a.push.apply(a, children);
            }

            child = child._next;
          }

          return a;
        };

        _proto2.tweenTo = function tweenTo(position, vars) {
          vars = vars || {};

          var tl = this,
              endTime = _parsePosition(tl, position),
              _vars = vars,
              startAt = _vars.startAt,
              _onStart = _vars.onStart,
              onStartParams = _vars.onStartParams,
              immediateRender = _vars.immediateRender,
              initted,
              tween = Tween.to(tl, _setDefaults({
            ease: vars.ease || "none",
            lazy: false,
            immediateRender: false,
            time: endTime,
            overwrite: "auto",
            duration: vars.duration || Math.abs((endTime - (startAt && "time" in startAt ? startAt.time : tl._time)) / tl.timeScale()) || _tinyNum,
            onStart: function onStart() {
              tl.pause();

              if (!initted) {
                var duration = vars.duration || Math.abs((endTime - (startAt && "time" in startAt ? startAt.time : tl._time)) / tl.timeScale());
                tween._dur !== duration && _setDuration(tween, duration, 0, 1).render(tween._time, true, true);
                initted = 1;
              }

              _onStart && _onStart.apply(tween, onStartParams || []);
            }
          }, vars));

          return immediateRender ? tween.render(0) : tween;
        };

        _proto2.tweenFromTo = function tweenFromTo(fromPosition, toPosition, vars) {
          return this.tweenTo(toPosition, _setDefaults({
            startAt: {
              time: _parsePosition(this, fromPosition)
            }
          }, vars));
        };

        _proto2.recent = function recent() {
          return this._recent;
        };

        _proto2.nextLabel = function nextLabel(afterTime) {
          if (afterTime === void 0) {
            afterTime = this._time;
          }

          return _getLabelInDirection(this, _parsePosition(this, afterTime));
        };

        _proto2.previousLabel = function previousLabel(beforeTime) {
          if (beforeTime === void 0) {
            beforeTime = this._time;
          }

          return _getLabelInDirection(this, _parsePosition(this, beforeTime), 1);
        };

        _proto2.currentLabel = function currentLabel(value) {
          return arguments.length ? this.seek(value, true) : this.previousLabel(this._time + _tinyNum);
        };

        _proto2.shiftChildren = function shiftChildren(amount, adjustLabels, ignoreBeforeTime) {
          if (ignoreBeforeTime === void 0) {
            ignoreBeforeTime = 0;
          }

          var child = this._first,
              labels = this.labels,
              p;

          while (child) {
            if (child._start >= ignoreBeforeTime) {
              child._start += amount;
              child._end += amount;
            }

            child = child._next;
          }

          if (adjustLabels) {
            for (p in labels) {
              if (labels[p] >= ignoreBeforeTime) {
                labels[p] += amount;
              }
            }
          }

          return _uncache(this);
        };

        _proto2.invalidate = function invalidate(soft) {
          var child = this._first;
          this._lock = 0;

          while (child) {
            child.invalidate(soft);
            child = child._next;
          }

          return _Animation.prototype.invalidate.call(this, soft);
        };

        _proto2.clear = function clear(includeLabels) {
          if (includeLabels === void 0) {
            includeLabels = true;
          }

          var child = this._first,
              next;

          while (child) {
            next = child._next;
            this.remove(child);
            child = next;
          }

          this._dp && (this._time = this._tTime = this._pTime = 0);
          includeLabels && (this.labels = {});
          return _uncache(this);
        };

        _proto2.totalDuration = function totalDuration(value) {
          var max = 0,
              self = this,
              child = self._last,
              prevStart = _bigNum,
              prev,
              start,
              parent;

          if (arguments.length) {
            return self.timeScale((self._repeat < 0 ? self.duration() : self.totalDuration()) / (self.reversed() ? -value : value));
          }

          if (self._dirty) {
            parent = self.parent;

            while (child) {
              prev = child._prev;
              child._dirty && child.totalDuration();
              start = child._start;

              if (start > prevStart && self._sort && child._ts && !self._lock) {
                self._lock = 1;
                _addToTimeline(self, child, start - child._delay, 1)._lock = 0;
              } else {
                prevStart = start;
              }

              if (start < 0 && child._ts) {
                max -= start;

                if (!parent && !self._dp || parent && parent.smoothChildTiming) {
                  self._start += start / self._ts;
                  self._time -= start;
                  self._tTime -= start;
                }

                self.shiftChildren(-start, false, -1e999);
                prevStart = 0;
              }

              child._end > max && child._ts && (max = child._end);
              child = prev;
            }

            _setDuration(self, self === _globalTimeline && self._time > max ? self._time : max, 1, 1);

            self._dirty = 0;
          }

          return self._tDur;
        };

        Timeline.updateRoot = function updateRoot(time) {
          if (_globalTimeline._ts) {
            _lazySafeRender(_globalTimeline, _parentToChildTotalTime(time, _globalTimeline));

            _lastRenderedFrame = _ticker.frame;
          }

          if (_ticker.frame >= _nextGCFrame) {
            _nextGCFrame += _config.autoSleep || 120;
            var child = _globalTimeline._first;
            if (!child || !child._ts) if (_config.autoSleep && _ticker._listeners.length < 2) {
              while (child && !child._ts) {
                child = child._next;
              }

              child || _ticker.sleep();
            }
          }
        };

        return Timeline;
      }(Animation);

      _setDefaults(Timeline.prototype, {
        _lock: 0,
        _hasPause: 0,
        _forcing: 0
      });

      var _addComplexStringPropTween = function _addComplexStringPropTween(target, prop, start, end, setter, stringFilter, funcParam) {
        var pt = new PropTween(this._pt, target, prop, 0, 1, _renderComplexString, null, setter),
            index = 0,
            matchIndex = 0,
            result,
            startNums,
            color,
            endNum,
            chunk,
            startNum,
            hasRandom,
            a;
        pt.b = start;
        pt.e = end;
        start += "";
        end += "";

        if (hasRandom = ~end.indexOf("random(")) {
          end = _replaceRandom(end);
        }

        if (stringFilter) {
          a = [start, end];
          stringFilter(a, target, prop);
          start = a[0];
          end = a[1];
        }

        startNums = start.match(_complexStringNumExp) || [];

        while (result = _complexStringNumExp.exec(end)) {
          endNum = result[0];
          chunk = end.substring(index, result.index);

          if (color) {
            color = (color + 1) % 5;
          } else if (chunk.substr(-5) === "rgba(") {
            color = 1;
          }

          if (endNum !== startNums[matchIndex++]) {
            startNum = parseFloat(startNums[matchIndex - 1]) || 0;
            pt._pt = {
              _next: pt._pt,
              p: chunk || matchIndex === 1 ? chunk : ",",
              s: startNum,
              c: endNum.charAt(1) === "=" ? _parseRelative(startNum, endNum) - startNum : parseFloat(endNum) - startNum,
              m: color && color < 4 ? Math.round : 0
            };
            index = _complexStringNumExp.lastIndex;
          }
        }

        pt.c = index < end.length ? end.substring(index, end.length) : "";
        pt.fp = funcParam;

        if (_relExp.test(end) || hasRandom) {
          pt.e = 0;
        }

        this._pt = pt;
        return pt;
      },
          _addPropTween = function _addPropTween(target, prop, start, end, index, targets, modifier, stringFilter, funcParam, optional) {
        _isFunction(end) && (end = end(index || 0, target, targets));
        var currentValue = target[prop],
            parsedStart = start !== "get" ? start : !_isFunction(currentValue) ? currentValue : funcParam ? target[prop.indexOf("set") || !_isFunction(target["get" + prop.substr(3)]) ? prop : "get" + prop.substr(3)](funcParam) : target[prop](),
            setter = !_isFunction(currentValue) ? _setterPlain : funcParam ? _setterFuncWithParam : _setterFunc,
            pt;

        if (_isString(end)) {
          if (~end.indexOf("random(")) {
            end = _replaceRandom(end);
          }

          if (end.charAt(1) === "=") {
            pt = _parseRelative(parsedStart, end) + (getUnit(parsedStart) || 0);

            if (pt || pt === 0) {
              end = pt;
            }
          }
        }

        if (!optional || parsedStart !== end || _forceAllPropTweens) {
          if (!isNaN(parsedStart * end) && end !== "") {
            pt = new PropTween(this._pt, target, prop, +parsedStart || 0, end - (parsedStart || 0), typeof currentValue === "boolean" ? _renderBoolean : _renderPlain, 0, setter);
            funcParam && (pt.fp = funcParam);
            modifier && pt.modifier(modifier, this, target);
            return this._pt = pt;
          }

          !currentValue && !(prop in target) && _missingPlugin(prop, end);
          return _addComplexStringPropTween.call(this, target, prop, parsedStart, end, setter, stringFilter || _config.stringFilter, funcParam);
        }
      },
          _processVars = function _processVars(vars, index, target, targets, tween) {
        _isFunction(vars) && (vars = _parseFuncOrString(vars, tween, index, target, targets));

        if (!_isObject(vars) || vars.style && vars.nodeType || _isArray(vars) || _isTypedArray(vars)) {
          return _isString(vars) ? _parseFuncOrString(vars, tween, index, target, targets) : vars;
        }

        var copy = {},
            p;

        for (p in vars) {
          copy[p] = _parseFuncOrString(vars[p], tween, index, target, targets);
        }

        return copy;
      },
          _checkPlugin = function _checkPlugin(property, vars, tween, index, target, targets) {
        var plugin, pt, ptLookup, i;

        if (_plugins[property] && (plugin = new _plugins[property]()).init(target, plugin.rawVars ? vars[property] : _processVars(vars[property], index, target, targets, tween), tween, index, targets) !== false) {
          tween._pt = pt = new PropTween(tween._pt, target, property, 0, 1, plugin.render, plugin, 0, plugin.priority);

          if (tween !== _quickTween) {
            ptLookup = tween._ptLookup[tween._targets.indexOf(target)];
            i = plugin._props.length;

            while (i--) {
              ptLookup[plugin._props[i]] = pt;
            }
          }
        }

        return plugin;
      },
          _overwritingTween,
          _forceAllPropTweens,
          _initTween = function _initTween(tween, time, tTime) {
        var vars = tween.vars,
            ease = vars.ease,
            startAt = vars.startAt,
            immediateRender = vars.immediateRender,
            lazy = vars.lazy,
            onUpdate = vars.onUpdate,
            runBackwards = vars.runBackwards,
            yoyoEase = vars.yoyoEase,
            keyframes = vars.keyframes,
            autoRevert = vars.autoRevert,
            dur = tween._dur,
            prevStartAt = tween._startAt,
            targets = tween._targets,
            parent = tween.parent,
            fullTargets = parent && parent.data === "nested" ? parent.vars.targets : targets,
            autoOverwrite = tween._overwrite === "auto" && !_suppressOverwrites,
            tl = tween.timeline,
            cleanVars,
            i,
            p,
            pt,
            target,
            hasPriority,
            gsData,
            harness,
            plugin,
            ptLookup,
            index,
            harnessVars,
            overwritten;
        tl && (!keyframes || !ease) && (ease = "none");
        tween._ease = _parseEase(ease, _defaults.ease);
        tween._yEase = yoyoEase ? _invertEase(_parseEase(yoyoEase === true ? ease : yoyoEase, _defaults.ease)) : 0;

        if (yoyoEase && tween._yoyo && !tween._repeat) {
          yoyoEase = tween._yEase;
          tween._yEase = tween._ease;
          tween._ease = yoyoEase;
        }

        tween._from = !tl && !!vars.runBackwards;

        if (!tl || keyframes && !vars.stagger) {
          harness = targets[0] ? _getCache(targets[0]).harness : 0;
          harnessVars = harness && vars[harness.prop];
          cleanVars = _copyExcluding(vars, _reservedProps);

          if (prevStartAt) {
            prevStartAt._zTime < 0 && prevStartAt.progress(1);
            time < 0 && runBackwards && immediateRender && !autoRevert ? prevStartAt.render(-1, true) : prevStartAt.revert(runBackwards && dur ? _revertConfigNoKill : _startAtRevertConfig);
            prevStartAt._lazy = 0;
          }

          if (startAt) {
            _removeFromParent(tween._startAt = Tween.set(targets, _setDefaults({
              data: "isStart",
              overwrite: false,
              parent: parent,
              immediateRender: true,
              lazy: !prevStartAt && _isNotFalse(lazy),
              startAt: null,
              delay: 0,
              onUpdate: onUpdate && function () {
                return _callback(tween, "onUpdate");
              },
              stagger: 0
            }, startAt)));

            tween._startAt._dp = 0;
            tween._startAt._sat = tween;
            time < 0 && (_reverting || !immediateRender && !autoRevert) && tween._startAt.revert(_revertConfigNoKill);

            if (immediateRender) {
              if (dur && time <= 0 && tTime <= 0) {
                time && (tween._zTime = time);
                return;
              }
            }
          } else if (runBackwards && dur) {
            if (!prevStartAt) {
              time && (immediateRender = false);
              p = _setDefaults({
                overwrite: false,
                data: "isFromStart",
                lazy: immediateRender && !prevStartAt && _isNotFalse(lazy),
                immediateRender: immediateRender,
                stagger: 0,
                parent: parent
              }, cleanVars);
              harnessVars && (p[harness.prop] = harnessVars);

              _removeFromParent(tween._startAt = Tween.set(targets, p));

              tween._startAt._dp = 0;
              tween._startAt._sat = tween;
              time < 0 && (_reverting ? tween._startAt.revert(_revertConfigNoKill) : tween._startAt.render(-1, true));
              tween._zTime = time;

              if (!immediateRender) {
                _initTween(tween._startAt, _tinyNum, _tinyNum);
              } else if (!time) {
                return;
              }
            }
          }

          tween._pt = tween._ptCache = 0;
          lazy = dur && _isNotFalse(lazy) || lazy && !dur;

          for (i = 0; i < targets.length; i++) {
            target = targets[i];
            gsData = target._gsap || _harness(targets)[i]._gsap;
            tween._ptLookup[i] = ptLookup = {};
            _lazyLookup[gsData.id] && _lazyTweens.length && _lazyRender();
            index = fullTargets === targets ? i : fullTargets.indexOf(target);

            if (harness && (plugin = new harness()).init(target, harnessVars || cleanVars, tween, index, fullTargets) !== false) {
              tween._pt = pt = new PropTween(tween._pt, target, plugin.name, 0, 1, plugin.render, plugin, 0, plugin.priority);

              plugin._props.forEach(function (name) {
                ptLookup[name] = pt;
              });

              plugin.priority && (hasPriority = 1);
            }

            if (!harness || harnessVars) {
              for (p in cleanVars) {
                if (_plugins[p] && (plugin = _checkPlugin(p, cleanVars, tween, index, target, fullTargets))) {
                  plugin.priority && (hasPriority = 1);
                } else {
                  ptLookup[p] = pt = _addPropTween.call(tween, target, p, "get", cleanVars[p], index, fullTargets, 0, vars.stringFilter);
                }
              }
            }

            tween._op && tween._op[i] && tween.kill(target, tween._op[i]);

            if (autoOverwrite && tween._pt) {
              _overwritingTween = tween;

              _globalTimeline.killTweensOf(target, ptLookup, tween.globalTime(time));

              overwritten = !tween.parent;
              _overwritingTween = 0;
            }

            tween._pt && lazy && (_lazyLookup[gsData.id] = 1);
          }

          hasPriority && _sortPropTweensByPriority(tween);
          tween._onInit && tween._onInit(tween);
        }

        tween._onUpdate = onUpdate;
        tween._initted = (!tween._op || tween._pt) && !overwritten;
        keyframes && time <= 0 && tl.render(_bigNum, true, true);
      },
          _updatePropTweens = function _updatePropTweens(tween, property, value, start, startIsRelative, ratio, time, skipRecursion) {
        var ptCache = (tween._pt && tween._ptCache || (tween._ptCache = {}))[property],
            pt,
            rootPT,
            lookup,
            i;

        if (!ptCache) {
          ptCache = tween._ptCache[property] = [];
          lookup = tween._ptLookup;
          i = tween._targets.length;

          while (i--) {
            pt = lookup[i][property];

            if (pt && pt.d && pt.d._pt) {
              pt = pt.d._pt;

              while (pt && pt.p !== property && pt.fp !== property) {
                pt = pt._next;
              }
            }

            if (!pt) {
              _forceAllPropTweens = 1;
              tween.vars[property] = "+=0";

              _initTween(tween, time);

              _forceAllPropTweens = 0;
              return skipRecursion ? _warn(property + " not eligible for reset") : 1;
            }

            ptCache.push(pt);
          }
        }

        i = ptCache.length;

        while (i--) {
          rootPT = ptCache[i];
          pt = rootPT._pt || rootPT;
          pt.s = (start || start === 0) && !startIsRelative ? start : pt.s + (start || 0) + ratio * pt.c;
          pt.c = value - pt.s;
          rootPT.e && (rootPT.e = _round(value) + getUnit(rootPT.e));
          rootPT.b && (rootPT.b = pt.s + getUnit(rootPT.b));
        }
      },
          _addAliasesToVars = function _addAliasesToVars(targets, vars) {
        var harness = targets[0] ? _getCache(targets[0]).harness : 0,
            propertyAliases = harness && harness.aliases,
            copy,
            p,
            i,
            aliases;

        if (!propertyAliases) {
          return vars;
        }

        copy = _merge({}, vars);

        for (p in propertyAliases) {
          if (p in copy) {
            aliases = propertyAliases[p].split(",");
            i = aliases.length;

            while (i--) {
              copy[aliases[i]] = copy[p];
            }
          }
        }

        return copy;
      },
          _parseKeyframe = function _parseKeyframe(prop, obj, allProps, easeEach) {
        var ease = obj.ease || easeEach || "power1.inOut",
            p,
            a;

        if (_isArray(obj)) {
          a = allProps[prop] || (allProps[prop] = []);
          obj.forEach(function (value, i) {
            return a.push({
              t: i / (obj.length - 1) * 100,
              v: value,
              e: ease
            });
          });
        } else {
          for (p in obj) {
            a = allProps[p] || (allProps[p] = []);
            p === "ease" || a.push({
              t: parseFloat(prop),
              v: obj[p],
              e: ease
            });
          }
        }
      },
          _parseFuncOrString = function _parseFuncOrString(value, tween, i, target, targets) {
        return _isFunction(value) ? value.call(tween, i, target, targets) : _isString(value) && ~value.indexOf("random(") ? _replaceRandom(value) : value;
      },
          _staggerTweenProps = _callbackNames + "repeat,repeatDelay,yoyo,repeatRefresh,yoyoEase,autoRevert",
          _staggerPropsToSkip = {};

      _forEachName(_staggerTweenProps + ",id,stagger,delay,duration,paused,scrollTrigger", function (name) {
        return _staggerPropsToSkip[name] = 1;
      });

      var Tween = function (_Animation2) {
        _inheritsLoose(Tween, _Animation2);

        function Tween(targets, vars, position, skipInherit) {
          var _this3;

          if (typeof vars === "number") {
            position.duration = vars;
            vars = position;
            position = null;
          }

          _this3 = _Animation2.call(this, skipInherit ? vars : _inheritDefaults(vars)) || this;
          var _this3$vars = _this3.vars,
              duration = _this3$vars.duration,
              delay = _this3$vars.delay,
              immediateRender = _this3$vars.immediateRender,
              stagger = _this3$vars.stagger,
              overwrite = _this3$vars.overwrite,
              keyframes = _this3$vars.keyframes,
              defaults = _this3$vars.defaults,
              scrollTrigger = _this3$vars.scrollTrigger,
              yoyoEase = _this3$vars.yoyoEase,
              parent = vars.parent || _globalTimeline,
              parsedTargets = (_isArray(targets) || _isTypedArray(targets) ? _isNumber(targets[0]) : "length" in vars) ? [targets] : toArray(targets),
              tl,
              i,
              copy,
              l,
              p,
              curTarget,
              staggerFunc,
              staggerVarsToMerge;
          _this3._targets = parsedTargets.length ? _harness(parsedTargets) : _warn("GSAP target " + targets + " not found. https://gsap.com", !_config.nullTargetWarn) || [];
          _this3._ptLookup = [];
          _this3._overwrite = overwrite;

          if (keyframes || stagger || _isFuncOrString(duration) || _isFuncOrString(delay)) {
            vars = _this3.vars;
            tl = _this3.timeline = new Timeline({
              data: "nested",
              defaults: defaults || {},
              targets: parent && parent.data === "nested" ? parent.vars.targets : parsedTargets
            });
            tl.kill();
            tl.parent = tl._dp = _assertThisInitialized(_this3);
            tl._start = 0;

            if (stagger || _isFuncOrString(duration) || _isFuncOrString(delay)) {
              l = parsedTargets.length;
              staggerFunc = stagger && distribute(stagger);

              if (_isObject(stagger)) {
                for (p in stagger) {
                  if (~_staggerTweenProps.indexOf(p)) {
                    staggerVarsToMerge || (staggerVarsToMerge = {});
                    staggerVarsToMerge[p] = stagger[p];
                  }
                }
              }

              for (i = 0; i < l; i++) {
                copy = _copyExcluding(vars, _staggerPropsToSkip);
                copy.stagger = 0;
                yoyoEase && (copy.yoyoEase = yoyoEase);
                staggerVarsToMerge && _merge(copy, staggerVarsToMerge);
                curTarget = parsedTargets[i];
                copy.duration = +_parseFuncOrString(duration, _assertThisInitialized(_this3), i, curTarget, parsedTargets);
                copy.delay = (+_parseFuncOrString(delay, _assertThisInitialized(_this3), i, curTarget, parsedTargets) || 0) - _this3._delay;

                if (!stagger && l === 1 && copy.delay) {
                  _this3._delay = delay = copy.delay;
                  _this3._start += delay;
                  copy.delay = 0;
                }

                tl.to(curTarget, copy, staggerFunc ? staggerFunc(i, curTarget, parsedTargets) : 0);
                tl._ease = _easeMap.none;
              }

              tl.duration() ? duration = delay = 0 : _this3.timeline = 0;
            } else if (keyframes) {
              _inheritDefaults(_setDefaults(tl.vars.defaults, {
                ease: "none"
              }));

              tl._ease = _parseEase(keyframes.ease || vars.ease || "none");
              var time = 0,
                  a,
                  kf,
                  v;

              if (_isArray(keyframes)) {
                keyframes.forEach(function (frame) {
                  return tl.to(parsedTargets, frame, ">");
                });
                tl.duration();
              } else {
                copy = {};

                for (p in keyframes) {
                  p === "ease" || p === "easeEach" || _parseKeyframe(p, keyframes[p], copy, keyframes.easeEach);
                }

                for (p in copy) {
                  a = copy[p].sort(function (a, b) {
                    return a.t - b.t;
                  });
                  time = 0;

                  for (i = 0; i < a.length; i++) {
                    kf = a[i];
                    v = {
                      ease: kf.e,
                      duration: (kf.t - (i ? a[i - 1].t : 0)) / 100 * duration
                    };
                    v[p] = kf.v;
                    tl.to(parsedTargets, v, time);
                    time += v.duration;
                  }
                }

                tl.duration() < duration && tl.to({}, {
                  duration: duration - tl.duration()
                });
              }
            }

            duration || _this3.duration(duration = tl.duration());
          } else {
            _this3.timeline = 0;
          }

          if (overwrite === true && !_suppressOverwrites) {
            _overwritingTween = _assertThisInitialized(_this3);

            _globalTimeline.killTweensOf(parsedTargets);

            _overwritingTween = 0;
          }

          _addToTimeline(parent, _assertThisInitialized(_this3), position);

          vars.reversed && _this3.reverse();
          vars.paused && _this3.paused(true);

          if (immediateRender || !duration && !keyframes && _this3._start === _roundPrecise(parent._time) && _isNotFalse(immediateRender) && _hasNoPausedAncestors(_assertThisInitialized(_this3)) && parent.data !== "nested") {
            _this3._tTime = -_tinyNum;

            _this3.render(Math.max(0, -delay) || 0);
          }

          scrollTrigger && _scrollTrigger(_assertThisInitialized(_this3), scrollTrigger);
          return _this3;
        }

        var _proto3 = Tween.prototype;

        _proto3.render = function render(totalTime, suppressEvents, force) {
          var prevTime = this._time,
              tDur = this._tDur,
              dur = this._dur,
              isNegative = totalTime < 0,
              tTime = totalTime > tDur - _tinyNum && !isNegative ? tDur : totalTime < _tinyNum ? 0 : totalTime,
              time,
              pt,
              iteration,
              cycleDuration,
              prevIteration,
              isYoyo,
              ratio,
              timeline,
              yoyoEase;

          if (!dur) {
            _renderZeroDurationTween(this, totalTime, suppressEvents, force);
          } else if (tTime !== this._tTime || !totalTime || force || !this._initted && this._tTime || this._startAt && this._zTime < 0 !== isNegative) {
            time = tTime;
            timeline = this.timeline;

            if (this._repeat) {
              cycleDuration = dur + this._rDelay;

              if (this._repeat < -1 && isNegative) {
                return this.totalTime(cycleDuration * 100 + totalTime, suppressEvents, force);
              }

              time = _roundPrecise(tTime % cycleDuration);

              if (tTime === tDur) {
                iteration = this._repeat;
                time = dur;
              } else {
                iteration = ~~(tTime / cycleDuration);

                if (iteration && iteration === _roundPrecise(tTime / cycleDuration)) {
                  time = dur;
                  iteration--;
                }

                time > dur && (time = dur);
              }

              isYoyo = this._yoyo && iteration & 1;

              if (isYoyo) {
                yoyoEase = this._yEase;
                time = dur - time;
              }

              prevIteration = _animationCycle(this._tTime, cycleDuration);

              if (time === prevTime && !force && this._initted && iteration === prevIteration) {
                this._tTime = tTime;
                return this;
              }

              if (iteration !== prevIteration) {
                timeline && this._yEase && _propagateYoyoEase(timeline, isYoyo);

                if (this.vars.repeatRefresh && !isYoyo && !this._lock && this._time !== cycleDuration && this._initted) {
                  this._lock = force = 1;
                  this.render(_roundPrecise(cycleDuration * iteration), true).invalidate()._lock = 0;
                }
              }
            }

            if (!this._initted) {
              if (_attemptInitTween(this, isNegative ? totalTime : time, force, suppressEvents, tTime)) {
                this._tTime = 0;
                return this;
              }

              if (prevTime !== this._time && !(force && this.vars.repeatRefresh && iteration !== prevIteration)) {
                return this;
              }

              if (dur !== this._dur) {
                return this.render(totalTime, suppressEvents, force);
              }
            }

            this._tTime = tTime;
            this._time = time;

            if (!this._act && this._ts) {
              this._act = 1;
              this._lazy = 0;
            }

            this.ratio = ratio = (yoyoEase || this._ease)(time / dur);

            if (this._from) {
              this.ratio = ratio = 1 - ratio;
            }

            if (time && !prevTime && !suppressEvents && !iteration) {
              _callback(this, "onStart");

              if (this._tTime !== tTime) {
                return this;
              }
            }

            pt = this._pt;

            while (pt) {
              pt.r(ratio, pt.d);
              pt = pt._next;
            }

            timeline && timeline.render(totalTime < 0 ? totalTime : timeline._dur * timeline._ease(time / this._dur), suppressEvents, force) || this._startAt && (this._zTime = totalTime);

            if (this._onUpdate && !suppressEvents) {
              isNegative && _rewindStartAt(this, totalTime, suppressEvents, force);

              _callback(this, "onUpdate");
            }

            this._repeat && iteration !== prevIteration && this.vars.onRepeat && !suppressEvents && this.parent && _callback(this, "onRepeat");

            if ((tTime === this._tDur || !tTime) && this._tTime === tTime) {
              isNegative && !this._onUpdate && _rewindStartAt(this, totalTime, true, true);
              (totalTime || !dur) && (tTime === this._tDur && this._ts > 0 || !tTime && this._ts < 0) && _removeFromParent(this, 1);

              if (!suppressEvents && !(isNegative && !prevTime) && (tTime || prevTime || isYoyo)) {
                _callback(this, tTime === tDur ? "onComplete" : "onReverseComplete", true);

                this._prom && !(tTime < tDur && this.timeScale() > 0) && this._prom();
              }
            }
          }

          return this;
        };

        _proto3.targets = function targets() {
          return this._targets;
        };

        _proto3.invalidate = function invalidate(soft) {
          (!soft || !this.vars.runBackwards) && (this._startAt = 0);
          this._pt = this._op = this._onUpdate = this._lazy = this.ratio = 0;
          this._ptLookup = [];
          this.timeline && this.timeline.invalidate(soft);
          return _Animation2.prototype.invalidate.call(this, soft);
        };

        _proto3.resetTo = function resetTo(property, value, start, startIsRelative, skipRecursion) {
          _tickerActive || _ticker.wake();
          this._ts || this.play();
          var time = Math.min(this._dur, (this._dp._time - this._start) * this._ts),
              ratio;
          this._initted || _initTween(this, time);
          ratio = this._ease(time / this._dur);

          if (_updatePropTweens(this, property, value, start, startIsRelative, ratio, time, skipRecursion)) {
            return this.resetTo(property, value, start, startIsRelative, 1);
          }

          _alignPlayhead(this, 0);

          this.parent || _addLinkedListItem(this._dp, this, "_first", "_last", this._dp._sort ? "_start" : 0);
          return this.render(0);
        };

        _proto3.kill = function kill(targets, vars) {
          if (vars === void 0) {
            vars = "all";
          }

          if (!targets && (!vars || vars === "all")) {
            this._lazy = this._pt = 0;
            return this.parent ? _interrupt(this) : this;
          }

          if (this.timeline) {
            var tDur = this.timeline.totalDuration();
            this.timeline.killTweensOf(targets, vars, _overwritingTween && _overwritingTween.vars.overwrite !== true)._first || _interrupt(this);
            this.parent && tDur !== this.timeline.totalDuration() && _setDuration(this, this._dur * this.timeline._tDur / tDur, 0, 1);
            return this;
          }

          var parsedTargets = this._targets,
              killingTargets = targets ? toArray(targets) : parsedTargets,
              propTweenLookup = this._ptLookup,
              firstPT = this._pt,
              overwrittenProps,
              curLookup,
              curOverwriteProps,
              props,
              p,
              pt,
              i;

          if ((!vars || vars === "all") && _arraysMatch(parsedTargets, killingTargets)) {
            vars === "all" && (this._pt = 0);
            return _interrupt(this);
          }

          overwrittenProps = this._op = this._op || [];

          if (vars !== "all") {
            if (_isString(vars)) {
              p = {};

              _forEachName(vars, function (name) {
                return p[name] = 1;
              });

              vars = p;
            }

            vars = _addAliasesToVars(parsedTargets, vars);
          }

          i = parsedTargets.length;

          while (i--) {
            if (~killingTargets.indexOf(parsedTargets[i])) {
              curLookup = propTweenLookup[i];

              if (vars === "all") {
                overwrittenProps[i] = vars;
                props = curLookup;
                curOverwriteProps = {};
              } else {
                curOverwriteProps = overwrittenProps[i] = overwrittenProps[i] || {};
                props = vars;
              }

              for (p in props) {
                pt = curLookup && curLookup[p];

                if (pt) {
                  if (!("kill" in pt.d) || pt.d.kill(p) === true) {
                    _removeLinkedListItem(this, pt, "_pt");
                  }

                  delete curLookup[p];
                }

                if (curOverwriteProps !== "all") {
                  curOverwriteProps[p] = 1;
                }
              }
            }
          }

          this._initted && !this._pt && firstPT && _interrupt(this);
          return this;
        };

        Tween.to = function to(targets, vars) {
          return new Tween(targets, vars, arguments[2]);
        };

        Tween.from = function from(targets, vars) {
          return _createTweenType(1, arguments);
        };

        Tween.delayedCall = function delayedCall(delay, callback, params, scope) {
          return new Tween(callback, 0, {
            immediateRender: false,
            lazy: false,
            overwrite: false,
            delay: delay,
            onComplete: callback,
            onReverseComplete: callback,
            onCompleteParams: params,
            onReverseCompleteParams: params,
            callbackScope: scope
          });
        };

        Tween.fromTo = function fromTo(targets, fromVars, toVars) {
          return _createTweenType(2, arguments);
        };

        Tween.set = function set(targets, vars) {
          vars.duration = 0;
          vars.repeatDelay || (vars.repeat = 0);
          return new Tween(targets, vars);
        };

        Tween.killTweensOf = function killTweensOf(targets, props, onlyActive) {
          return _globalTimeline.killTweensOf(targets, props, onlyActive);
        };

        return Tween;
      }(Animation);

      _setDefaults(Tween.prototype, {
        _targets: [],
        _lazy: 0,
        _startAt: 0,
        _op: 0,
        _onInit: 0
      });

      _forEachName("staggerTo,staggerFrom,staggerFromTo", function (name) {
        Tween[name] = function () {
          var tl = new Timeline(),
              params = _slice.call(arguments, 0);

          params.splice(name === "staggerFromTo" ? 5 : 4, 0, 0);
          return tl[name].apply(tl, params);
        };
      });

      var _setterPlain = function _setterPlain(target, property, value) {
        return target[property] = value;
      },
          _setterFunc = function _setterFunc(target, property, value) {
        return target[property](value);
      },
          _setterFuncWithParam = function _setterFuncWithParam(target, property, value, data) {
        return target[property](data.fp, value);
      },
          _setterAttribute = function _setterAttribute(target, property, value) {
        return target.setAttribute(property, value);
      },
          _getSetter = function _getSetter(target, property) {
        return _isFunction(target[property]) ? _setterFunc : _isUndefined(target[property]) && target.setAttribute ? _setterAttribute : _setterPlain;
      },
          _renderPlain = function _renderPlain(ratio, data) {
        return data.set(data.t, data.p, Math.round((data.s + data.c * ratio) * 1000000) / 1000000, data);
      },
          _renderBoolean = function _renderBoolean(ratio, data) {
        return data.set(data.t, data.p, !!(data.s + data.c * ratio), data);
      },
          _renderComplexString = function _renderComplexString(ratio, data) {
        var pt = data._pt,
            s = "";

        if (!ratio && data.b) {
          s = data.b;
        } else if (ratio === 1 && data.e) {
          s = data.e;
        } else {
          while (pt) {
            s = pt.p + (pt.m ? pt.m(pt.s + pt.c * ratio) : Math.round((pt.s + pt.c * ratio) * 10000) / 10000) + s;
            pt = pt._next;
          }

          s += data.c;
        }

        data.set(data.t, data.p, s, data);
      },
          _renderPropTweens = function _renderPropTweens(ratio, data) {
        var pt = data._pt;

        while (pt) {
          pt.r(ratio, pt.d);
          pt = pt._next;
        }
      },
          _addPluginModifier = function _addPluginModifier(modifier, tween, target, property) {
        var pt = this._pt,
            next;

        while (pt) {
          next = pt._next;
          pt.p === property && pt.modifier(modifier, tween, target);
          pt = next;
        }
      },
          _killPropTweensOf = function _killPropTweensOf(property) {
        var pt = this._pt,
            hasNonDependentRemaining,
            next;

        while (pt) {
          next = pt._next;

          if (pt.p === property && !pt.op || pt.op === property) {
            _removeLinkedListItem(this, pt, "_pt");
          } else if (!pt.dep) {
            hasNonDependentRemaining = 1;
          }

          pt = next;
        }

        return !hasNonDependentRemaining;
      },
          _setterWithModifier = function _setterWithModifier(target, property, value, data) {
        data.mSet(target, property, data.m.call(data.tween, value, data.mt), data);
      },
          _sortPropTweensByPriority = function _sortPropTweensByPriority(parent) {
        var pt = parent._pt,
            next,
            pt2,
            first,
            last;

        while (pt) {
          next = pt._next;
          pt2 = first;

          while (pt2 && pt2.pr > pt.pr) {
            pt2 = pt2._next;
          }

          if (pt._prev = pt2 ? pt2._prev : last) {
            pt._prev._next = pt;
          } else {
            first = pt;
          }

          if (pt._next = pt2) {
            pt2._prev = pt;
          } else {
            last = pt;
          }

          pt = next;
        }

        parent._pt = first;
      };

      var PropTween = function () {
        function PropTween(next, target, prop, start, change, renderer, data, setter, priority) {
          this.t = target;
          this.s = start;
          this.c = change;
          this.p = prop;
          this.r = renderer || _renderPlain;
          this.d = data || this;
          this.set = setter || _setterPlain;
          this.pr = priority || 0;
          this._next = next;

          if (next) {
            next._prev = this;
          }
        }

        var _proto4 = PropTween.prototype;

        _proto4.modifier = function modifier(func, tween, target) {
          this.mSet = this.mSet || this.set;
          this.set = _setterWithModifier;
          this.m = func;
          this.mt = target;
          this.tween = tween;
        };

        return PropTween;
      }();

      _forEachName(_callbackNames + "parent,duration,ease,delay,overwrite,runBackwards,startAt,yoyo,immediateRender,repeat,repeatDelay,data,paused,reversed,lazy,callbackScope,stringFilter,id,yoyoEase,stagger,inherit,repeatRefresh,keyframes,autoRevert,scrollTrigger", function (name) {
        return _reservedProps[name] = 1;
      });

      _globals.TweenMax = _globals.TweenLite = Tween;
      _globals.TimelineLite = _globals.TimelineMax = Timeline;
      _globalTimeline = new Timeline({
        sortChildren: false,
        defaults: _defaults,
        autoRemoveChildren: true,
        id: "root",
        smoothChildTiming: true
      });
      _config.stringFilter = _colorStringFilter;

      var _media = [],
          _listeners = {},
          _emptyArray = [],
          _lastMediaTime = 0,
          _contextID = 0,
          _dispatch = function _dispatch(type) {
        return (_listeners[type] || _emptyArray).map(function (f) {
          return f();
        });
      },
          _onMediaChange = function _onMediaChange() {
        var time = Date.now(),
            matches = [];

        if (time - _lastMediaTime > 2) {
          _dispatch("matchMediaInit");

          _media.forEach(function (c) {
            var queries = c.queries,
                conditions = c.conditions,
                match,
                p,
                anyMatch,
                toggled;

            for (p in queries) {
              match = _win.matchMedia(queries[p]).matches;
              match && (anyMatch = 1);

              if (match !== conditions[p]) {
                conditions[p] = match;
                toggled = 1;
              }
            }

            if (toggled) {
              c.revert();
              anyMatch && matches.push(c);
            }
          });

          _dispatch("matchMediaRevert");

          matches.forEach(function (c) {
            return c.onMatch(c, function (func) {
              return c.add(null, func);
            });
          });
          _lastMediaTime = time;

          _dispatch("matchMedia");
        }
      };

      var Context = function () {
        function Context(func, scope) {
          this.selector = scope && selector(scope);
          this.data = [];
          this._r = [];
          this.isReverted = false;
          this.id = _contextID++;
          func && this.add(func);
        }

        var _proto5 = Context.prototype;

        _proto5.add = function add(name, func, scope) {
          if (_isFunction(name)) {
            scope = func;
            func = name;
            name = _isFunction;
          }

          var self = this,
              f = function f() {
            var prev = _context,
                prevSelector = self.selector,
                result;
            prev && prev !== self && prev.data.push(self);
            scope && (self.selector = selector(scope));
            _context = self;
            result = func.apply(self, arguments);
            _isFunction(result) && self._r.push(result);
            _context = prev;
            self.selector = prevSelector;
            self.isReverted = false;
            return result;
          };

          self.last = f;
          return name === _isFunction ? f(self, function (func) {
            return self.add(null, func);
          }) : name ? self[name] = f : f;
        };

        _proto5.ignore = function ignore(func) {
          var prev = _context;
          _context = null;
          func(this);
          _context = prev;
        };

        _proto5.getTweens = function getTweens() {
          var a = [];
          this.data.forEach(function (e) {
            return e instanceof Context ? a.push.apply(a, e.getTweens()) : e instanceof Tween && !(e.parent && e.parent.data === "nested") && a.push(e);
          });
          return a;
        };

        _proto5.clear = function clear() {
          this._r.length = this.data.length = 0;
        };

        _proto5.kill = function kill(revert, matchMedia) {
          var _this4 = this;

          if (revert) {
            (function () {
              var tweens = _this4.getTweens(),
                  i = _this4.data.length,
                  t;

              while (i--) {
                t = _this4.data[i];

                if (t.data === "isFlip") {
                  t.revert();
                  t.getChildren(true, true, false).forEach(function (tween) {
                    return tweens.splice(tweens.indexOf(tween), 1);
                  });
                }
              }

              tweens.map(function (t) {
                return {
                  g: t._dur || t._delay || t._sat && !t._sat.vars.immediateRender ? t.globalTime(0) : -Infinity,
                  t: t
                };
              }).sort(function (a, b) {
                return b.g - a.g || -Infinity;
              }).forEach(function (o) {
                return o.t.revert(revert);
              });
              i = _this4.data.length;

              while (i--) {
                t = _this4.data[i];

                if (t instanceof Timeline) {
                  if (t.data !== "nested") {
                    t.scrollTrigger && t.scrollTrigger.revert();
                    t.kill();
                  }
                } else {
                  !(t instanceof Tween) && t.revert && t.revert(revert);
                }
              }

              _this4._r.forEach(function (f) {
                return f(revert, _this4);
              });

              _this4.isReverted = true;
            })();
          } else {
            this.data.forEach(function (e) {
              return e.kill && e.kill();
            });
          }

          this.clear();

          if (matchMedia) {
            var i = _media.length;

            while (i--) {
              _media[i].id === this.id && _media.splice(i, 1);
            }
          }
        };

        _proto5.revert = function revert(config) {
          this.kill(config || {});
        };

        return Context;
      }();

      var MatchMedia = function () {
        function MatchMedia(scope) {
          this.contexts = [];
          this.scope = scope;
          _context && _context.data.push(this);
        }

        var _proto6 = MatchMedia.prototype;

        _proto6.add = function add(conditions, func, scope) {
          _isObject(conditions) || (conditions = {
            matches: conditions
          });
          var context = new Context(0, scope || this.scope),
              cond = context.conditions = {},
              mq,
              p,
              active;
          _context && !context.selector && (context.selector = _context.selector);
          this.contexts.push(context);
          func = context.add("onMatch", func);
          context.queries = conditions;

          for (p in conditions) {
            if (p === "all") {
              active = 1;
            } else {
              mq = _win.matchMedia(conditions[p]);

              if (mq) {
                _media.indexOf(context) < 0 && _media.push(context);
                (cond[p] = mq.matches) && (active = 1);
                mq.addListener ? mq.addListener(_onMediaChange) : mq.addEventListener("change", _onMediaChange);
              }
            }
          }

          active && func(context, function (f) {
            return context.add(null, f);
          });
          return this;
        };

        _proto6.revert = function revert(config) {
          this.kill(config || {});
        };

        _proto6.kill = function kill(revert) {
          this.contexts.forEach(function (c) {
            return c.kill(revert, true);
          });
        };

        return MatchMedia;
      }();

      var _gsap = {
        registerPlugin: function registerPlugin() {
          for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
            args[_key2] = arguments[_key2];
          }

          args.forEach(function (config) {
            return _createPlugin(config);
          });
        },
        timeline: function timeline(vars) {
          return new Timeline(vars);
        },
        getTweensOf: function getTweensOf(targets, onlyActive) {
          return _globalTimeline.getTweensOf(targets, onlyActive);
        },
        getProperty: function getProperty(target, property, unit, uncache) {
          _isString(target) && (target = toArray(target)[0]);

          var getter = _getCache(target || {}).get,
              format = unit ? _passThrough : _numericIfPossible;

          unit === "native" && (unit = "");
          return !target ? target : !property ? function (property, unit, uncache) {
            return format((_plugins[property] && _plugins[property].get || getter)(target, property, unit, uncache));
          } : format((_plugins[property] && _plugins[property].get || getter)(target, property, unit, uncache));
        },
        quickSetter: function quickSetter(target, property, unit) {
          target = toArray(target);

          if (target.length > 1) {
            var setters = target.map(function (t) {
              return gsap.quickSetter(t, property, unit);
            }),
                l = setters.length;
            return function (value) {
              var i = l;

              while (i--) {
                setters[i](value);
              }
            };
          }

          target = target[0] || {};

          var Plugin = _plugins[property],
              cache = _getCache(target),
              p = cache.harness && (cache.harness.aliases || {})[property] || property,
              setter = Plugin ? function (value) {
            var p = new Plugin();
            _quickTween._pt = 0;
            p.init(target, unit ? value + unit : value, _quickTween, 0, [target]);
            p.render(1, p);
            _quickTween._pt && _renderPropTweens(1, _quickTween);
          } : cache.set(target, p);

          return Plugin ? setter : function (value) {
            return setter(target, p, unit ? value + unit : value, cache, 1);
          };
        },
        quickTo: function quickTo(target, property, vars) {
          var _merge2;

          var tween = gsap.to(target, _merge((_merge2 = {}, _merge2[property] = "+=0.1", _merge2.paused = true, _merge2), vars || {})),
              func = function func(value, start, startIsRelative) {
            return tween.resetTo(property, value, start, startIsRelative);
          };

          func.tween = tween;
          return func;
        },
        isTweening: function isTweening(targets) {
          return _globalTimeline.getTweensOf(targets, true).length > 0;
        },
        defaults: function defaults(value) {
          value && value.ease && (value.ease = _parseEase(value.ease, _defaults.ease));
          return _mergeDeep(_defaults, value || {});
        },
        config: function config(value) {
          return _mergeDeep(_config, value || {});
        },
        registerEffect: function registerEffect(_ref3) {
          var name = _ref3.name,
              effect = _ref3.effect,
              plugins = _ref3.plugins,
              defaults = _ref3.defaults,
              extendTimeline = _ref3.extendTimeline;
          (plugins || "").split(",").forEach(function (pluginName) {
            return pluginName && !_plugins[pluginName] && !_globals[pluginName] && _warn(name + " effect requires " + pluginName + " plugin.");
          });

          _effects[name] = function (targets, vars, tl) {
            return effect(toArray(targets), _setDefaults(vars || {}, defaults), tl);
          };

          if (extendTimeline) {
            Timeline.prototype[name] = function (targets, vars, position) {
              return this.add(_effects[name](targets, _isObject(vars) ? vars : (position = vars) && {}, this), position);
            };
          }
        },
        registerEase: function registerEase(name, ease) {
          _easeMap[name] = _parseEase(ease);
        },
        parseEase: function parseEase(ease, defaultEase) {
          return arguments.length ? _parseEase(ease, defaultEase) : _easeMap;
        },
        getById: function getById(id) {
          return _globalTimeline.getById(id);
        },
        exportRoot: function exportRoot(vars, includeDelayedCalls) {
          if (vars === void 0) {
            vars = {};
          }

          var tl = new Timeline(vars),
              child,
              next;
          tl.smoothChildTiming = _isNotFalse(vars.smoothChildTiming);

          _globalTimeline.remove(tl);

          tl._dp = 0;
          tl._time = tl._tTime = _globalTimeline._time;
          child = _globalTimeline._first;

          while (child) {
            next = child._next;

            if (includeDelayedCalls || !(!child._dur && child instanceof Tween && child.vars.onComplete === child._targets[0])) {
              _addToTimeline(tl, child, child._start - child._delay);
            }

            child = next;
          }

          _addToTimeline(_globalTimeline, tl, 0);

          return tl;
        },
        context: function context(func, scope) {
          return func ? new Context(func, scope) : _context;
        },
        matchMedia: function matchMedia(scope) {
          return new MatchMedia(scope);
        },
        matchMediaRefresh: function matchMediaRefresh() {
          return _media.forEach(function (c) {
            var cond = c.conditions,
                found,
                p;

            for (p in cond) {
              if (cond[p]) {
                cond[p] = false;
                found = 1;
              }
            }

            found && c.revert();
          }) || _onMediaChange();
        },
        addEventListener: function addEventListener(type, callback) {
          var a = _listeners[type] || (_listeners[type] = []);
          ~a.indexOf(callback) || a.push(callback);
        },
        removeEventListener: function removeEventListener(type, callback) {
          var a = _listeners[type],
              i = a && a.indexOf(callback);
          i >= 0 && a.splice(i, 1);
        },
        utils: {
          wrap: wrap,
          wrapYoyo: wrapYoyo,
          distribute: distribute,
          random: random,
          snap: snap,
          normalize: normalize,
          getUnit: getUnit,
          clamp: clamp,
          splitColor: splitColor,
          toArray: toArray,
          selector: selector,
          mapRange: mapRange,
          pipe: pipe,
          unitize: unitize,
          interpolate: interpolate,
          shuffle: shuffle
        },
        install: _install,
        effects: _effects,
        ticker: _ticker,
        updateRoot: Timeline.updateRoot,
        plugins: _plugins,
        globalTimeline: _globalTimeline,
        core: {
          PropTween: PropTween,
          globals: _addGlobal,
          Tween: Tween,
          Timeline: Timeline,
          Animation: Animation,
          getCache: _getCache,
          _removeLinkedListItem: _removeLinkedListItem,
          reverting: function reverting() {
            return _reverting;
          },
          context: function context(toAdd) {
            if (toAdd && _context) {
              _context.data.push(toAdd);

              toAdd._ctx = _context;
            }

            return _context;
          },
          suppressOverwrites: function suppressOverwrites(value) {
            return _suppressOverwrites = value;
          }
        }
      };

      _forEachName("to,from,fromTo,delayedCall,set,killTweensOf", function (name) {
        return _gsap[name] = Tween[name];
      });

      _ticker.add(Timeline.updateRoot);

      _quickTween = _gsap.to({}, {
        duration: 0
      });

      var _getPluginPropTween = function _getPluginPropTween(plugin, prop) {
        var pt = plugin._pt;

        while (pt && pt.p !== prop && pt.op !== prop && pt.fp !== prop) {
          pt = pt._next;
        }

        return pt;
      },
          _addModifiers = function _addModifiers(tween, modifiers) {
        var targets = tween._targets,
            p,
            i,
            pt;

        for (p in modifiers) {
          i = targets.length;

          while (i--) {
            pt = tween._ptLookup[i][p];

            if (pt && (pt = pt.d)) {
              if (pt._pt) {
                pt = _getPluginPropTween(pt, p);
              }

              pt && pt.modifier && pt.modifier(modifiers[p], tween, targets[i], p);
            }
          }
        }
      },
          _buildModifierPlugin = function _buildModifierPlugin(name, modifier) {
        return {
          name: name,
          rawVars: 1,
          init: function init(target, vars, tween) {
            tween._onInit = function (tween) {
              var temp, p;

              if (_isString(vars)) {
                temp = {};

                _forEachName(vars, function (name) {
                  return temp[name] = 1;
                });

                vars = temp;
              }

              if (modifier) {
                temp = {};

                for (p in vars) {
                  temp[p] = modifier(vars[p]);
                }

                vars = temp;
              }

              _addModifiers(tween, vars);
            };
          }
        };
      };

      var gsap = _gsap.registerPlugin({
        name: "attr",
        init: function init(target, vars, tween, index, targets) {
          var p, pt, v;
          this.tween = tween;

          for (p in vars) {
            v = target.getAttribute(p) || "";
            pt = this.add(target, "setAttribute", (v || 0) + "", vars[p], index, targets, 0, 0, p);
            pt.op = p;
            pt.b = v;

            this._props.push(p);
          }
        },
        render: function render(ratio, data) {
          var pt = data._pt;

          while (pt) {
            _reverting ? pt.set(pt.t, pt.p, pt.b, pt) : pt.r(ratio, pt.d);
            pt = pt._next;
          }
        }
      }, {
        name: "endArray",
        init: function init(target, value) {
          var i = value.length;

          while (i--) {
            this.add(target, i, target[i] || 0, value[i], 0, 0, 0, 0, 0, 1);
          }
        }
      }, _buildModifierPlugin("roundProps", _roundModifier), _buildModifierPlugin("modifiers"), _buildModifierPlugin("snap", snap)) || _gsap;
      Tween.version = Timeline.version = gsap.version = "3.12.5";
      _coreReady = 1;
      _windowExists() && _wake();
      var Power0 = _easeMap.Power0,
          Power1 = _easeMap.Power1,
          Power2 = _easeMap.Power2,
          Power3 = _easeMap.Power3,
          Power4 = _easeMap.Power4,
          Linear = _easeMap.Linear,
          Quad = _easeMap.Quad,
          Cubic = _easeMap.Cubic,
          Quart = _easeMap.Quart,
          Quint = _easeMap.Quint,
          Strong = _easeMap.Strong,
          Elastic = _easeMap.Elastic,
          Back = _easeMap.Back,
          SteppedEase = _easeMap.SteppedEase,
          Bounce = _easeMap.Bounce,
          Sine = _easeMap.Sine,
          Expo = _easeMap.Expo,
          Circ = _easeMap.Circ;

      var _win$1,
          _doc$1,
          _docElement,
          _pluginInitted,
          _tempDiv,
          _recentSetterPlugin,
          _reverting$1,
          _windowExists$1 = function _windowExists() {
        return typeof window !== "undefined";
      },
          _transformProps = {},
          _RAD2DEG = 180 / Math.PI,
          _DEG2RAD = Math.PI / 180,
          _atan2 = Math.atan2,
          _bigNum$1 = 1e8,
          _capsExp = /([A-Z])/g,
          _horizontalExp = /(left|right|width|margin|padding|x)/i,
          _complexExp = /[\s,\(]\S/,
          _propertyAliases = {
        autoAlpha: "opacity,visibility",
        scale: "scaleX,scaleY",
        alpha: "opacity"
      },
          _renderCSSProp = function _renderCSSProp(ratio, data) {
        return data.set(data.t, data.p, Math.round((data.s + data.c * ratio) * 10000) / 10000 + data.u, data);
      },
          _renderPropWithEnd = function _renderPropWithEnd(ratio, data) {
        return data.set(data.t, data.p, ratio === 1 ? data.e : Math.round((data.s + data.c * ratio) * 10000) / 10000 + data.u, data);
      },
          _renderCSSPropWithBeginning = function _renderCSSPropWithBeginning(ratio, data) {
        return data.set(data.t, data.p, ratio ? Math.round((data.s + data.c * ratio) * 10000) / 10000 + data.u : data.b, data);
      },
          _renderRoundedCSSProp = function _renderRoundedCSSProp(ratio, data) {
        var value = data.s + data.c * ratio;
        data.set(data.t, data.p, ~~(value + (value < 0 ? -.5 : .5)) + data.u, data);
      },
          _renderNonTweeningValue = function _renderNonTweeningValue(ratio, data) {
        return data.set(data.t, data.p, ratio ? data.e : data.b, data);
      },
          _renderNonTweeningValueOnlyAtEnd = function _renderNonTweeningValueOnlyAtEnd(ratio, data) {
        return data.set(data.t, data.p, ratio !== 1 ? data.b : data.e, data);
      },
          _setterCSSStyle = function _setterCSSStyle(target, property, value) {
        return target.style[property] = value;
      },
          _setterCSSProp = function _setterCSSProp(target, property, value) {
        return target.style.setProperty(property, value);
      },
          _setterTransform = function _setterTransform(target, property, value) {
        return target._gsap[property] = value;
      },
          _setterScale = function _setterScale(target, property, value) {
        return target._gsap.scaleX = target._gsap.scaleY = value;
      },
          _setterScaleWithRender = function _setterScaleWithRender(target, property, value, data, ratio) {
        var cache = target._gsap;
        cache.scaleX = cache.scaleY = value;
        cache.renderTransform(ratio, cache);
      },
          _setterTransformWithRender = function _setterTransformWithRender(target, property, value, data, ratio) {
        var cache = target._gsap;
        cache[property] = value;
        cache.renderTransform(ratio, cache);
      },
          _transformProp = "transform",
          _transformOriginProp = _transformProp + "Origin",
          _saveStyle = function _saveStyle(property, isNotCSS) {
        var _this = this;

        var target = this.target,
            style = target.style,
            cache = target._gsap;

        if (property in _transformProps && style) {
          this.tfm = this.tfm || {};

          if (property !== "transform") {
            property = _propertyAliases[property] || property;
            ~property.indexOf(",") ? property.split(",").forEach(function (a) {
              return _this.tfm[a] = _get(target, a);
            }) : this.tfm[property] = cache.x ? cache[property] : _get(target, property);
            property === _transformOriginProp && (this.tfm.zOrigin = cache.zOrigin);
          } else {
            return _propertyAliases.transform.split(",").forEach(function (p) {
              return _saveStyle.call(_this, p, isNotCSS);
            });
          }

          if (this.props.indexOf(_transformProp) >= 0) {
            return;
          }

          if (cache.svg) {
            this.svgo = target.getAttribute("data-svg-origin");
            this.props.push(_transformOriginProp, isNotCSS, "");
          }

          property = _transformProp;
        }

        (style || isNotCSS) && this.props.push(property, isNotCSS, style[property]);
      },
          _removeIndependentTransforms = function _removeIndependentTransforms(style) {
        if (style.translate) {
          style.removeProperty("translate");
          style.removeProperty("scale");
          style.removeProperty("rotate");
        }
      },
          _revertStyle = function _revertStyle() {
        var props = this.props,
            target = this.target,
            style = target.style,
            cache = target._gsap,
            i,
            p;

        for (i = 0; i < props.length; i += 3) {
          props[i + 1] ? target[props[i]] = props[i + 2] : props[i + 2] ? style[props[i]] = props[i + 2] : style.removeProperty(props[i].substr(0, 2) === "--" ? props[i] : props[i].replace(_capsExp, "-$1").toLowerCase());
        }

        if (this.tfm) {
          for (p in this.tfm) {
            cache[p] = this.tfm[p];
          }

          if (cache.svg) {
            cache.renderTransform();
            target.setAttribute("data-svg-origin", this.svgo || "");
          }

          i = _reverting$1();

          if ((!i || !i.isStart) && !style[_transformProp]) {
            _removeIndependentTransforms(style);

            if (cache.zOrigin && style[_transformOriginProp]) {
              style[_transformOriginProp] += " " + cache.zOrigin + "px";
              cache.zOrigin = 0;
              cache.renderTransform();
            }

            cache.uncache = 1;
          }
        }
      },
          _getStyleSaver = function _getStyleSaver(target, properties) {
        var saver = {
          target: target,
          props: [],
          revert: _revertStyle,
          save: _saveStyle
        };
        target._gsap || gsap.core.getCache(target);
        properties && properties.split(",").forEach(function (p) {
          return saver.save(p);
        });
        return saver;
      },
          _supports3D,
          _createElement = function _createElement(type, ns) {
        var e = _doc$1.createElementNS ? _doc$1.createElementNS((ns || "http://www.w3.org/1999/xhtml").replace(/^https/, "http"), type) : _doc$1.createElement(type);
        return e && e.style ? e : _doc$1.createElement(type);
      },
          _getComputedProperty = function _getComputedProperty(target, property, skipPrefixFallback) {
        var cs = getComputedStyle(target);
        return cs[property] || cs.getPropertyValue(property.replace(_capsExp, "-$1").toLowerCase()) || cs.getPropertyValue(property) || !skipPrefixFallback && _getComputedProperty(target, _checkPropPrefix(property) || property, 1) || "";
      },
          _prefixes = "O,Moz,ms,Ms,Webkit".split(","),
          _checkPropPrefix = function _checkPropPrefix(property, element, preferPrefix) {
        var e = element || _tempDiv,
            s = e.style,
            i = 5;

        if (property in s && !preferPrefix) {
          return property;
        }

        property = property.charAt(0).toUpperCase() + property.substr(1);

        while (i-- && !(_prefixes[i] + property in s)) {}

        return i < 0 ? null : (i === 3 ? "ms" : i >= 0 ? _prefixes[i] : "") + property;
      },
          _initCore = function _initCore() {
        if (_windowExists$1() && window.document) {
          _win$1 = window;
          _doc$1 = _win$1.document;
          _docElement = _doc$1.documentElement;
          _tempDiv = _createElement("div") || {
            style: {}
          };
          _createElement("div");
          _transformProp = _checkPropPrefix(_transformProp);
          _transformOriginProp = _transformProp + "Origin";
          _tempDiv.style.cssText = "border-width:0;line-height:0;position:absolute;padding:0";
          _supports3D = !!_checkPropPrefix("perspective");
          _reverting$1 = gsap.core.reverting;
          _pluginInitted = 1;
        }
      },
          _getBBoxHack = function _getBBoxHack(swapIfPossible) {
        var svg = _createElement("svg", this.ownerSVGElement && this.ownerSVGElement.getAttribute("xmlns") || "http://www.w3.org/2000/svg"),
            oldParent = this.parentNode,
            oldSibling = this.nextSibling,
            oldCSS = this.style.cssText,
            bbox;

        _docElement.appendChild(svg);

        svg.appendChild(this);
        this.style.display = "block";

        if (swapIfPossible) {
          try {
            bbox = this.getBBox();
            this._gsapBBox = this.getBBox;
            this.getBBox = _getBBoxHack;
          } catch (e) {}
        } else if (this._gsapBBox) {
          bbox = this._gsapBBox();
        }

        if (oldParent) {
          if (oldSibling) {
            oldParent.insertBefore(this, oldSibling);
          } else {
            oldParent.appendChild(this);
          }
        }

        _docElement.removeChild(svg);

        this.style.cssText = oldCSS;
        return bbox;
      },
          _getAttributeFallbacks = function _getAttributeFallbacks(target, attributesArray) {
        var i = attributesArray.length;

        while (i--) {
          if (target.hasAttribute(attributesArray[i])) {
            return target.getAttribute(attributesArray[i]);
          }
        }
      },
          _getBBox = function _getBBox(target) {
        var bounds;

        try {
          bounds = target.getBBox();
        } catch (error) {
          bounds = _getBBoxHack.call(target, true);
        }

        bounds && (bounds.width || bounds.height) || target.getBBox === _getBBoxHack || (bounds = _getBBoxHack.call(target, true));
        return bounds && !bounds.width && !bounds.x && !bounds.y ? {
          x: +_getAttributeFallbacks(target, ["x", "cx", "x1"]) || 0,
          y: +_getAttributeFallbacks(target, ["y", "cy", "y1"]) || 0,
          width: 0,
          height: 0
        } : bounds;
      },
          _isSVG = function _isSVG(e) {
        return !!(e.getCTM && (!e.parentNode || e.ownerSVGElement) && _getBBox(e));
      },
          _removeProperty = function _removeProperty(target, property) {
        if (property) {
          var style = target.style,
              first2Chars;

          if (property in _transformProps && property !== _transformOriginProp) {
            property = _transformProp;
          }

          if (style.removeProperty) {
            first2Chars = property.substr(0, 2);

            if (first2Chars === "ms" || property.substr(0, 6) === "webkit") {
              property = "-" + property;
            }

            style.removeProperty(first2Chars === "--" ? property : property.replace(_capsExp, "-$1").toLowerCase());
          } else {
            style.removeAttribute(property);
          }
        }
      },
          _addNonTweeningPT = function _addNonTweeningPT(plugin, target, property, beginning, end, onlySetAtEnd) {
        var pt = new PropTween(plugin._pt, target, property, 0, 1, onlySetAtEnd ? _renderNonTweeningValueOnlyAtEnd : _renderNonTweeningValue);
        plugin._pt = pt;
        pt.b = beginning;
        pt.e = end;

        plugin._props.push(property);

        return pt;
      },
          _nonConvertibleUnits = {
        deg: 1,
        rad: 1,
        turn: 1
      },
          _nonStandardLayouts = {
        grid: 1,
        flex: 1
      },
          _convertToUnit = function _convertToUnit(target, property, value, unit) {
        var curValue = parseFloat(value) || 0,
            curUnit = (value + "").trim().substr((curValue + "").length) || "px",
            style = _tempDiv.style,
            horizontal = _horizontalExp.test(property),
            isRootSVG = target.tagName.toLowerCase() === "svg",
            measureProperty = (isRootSVG ? "client" : "offset") + (horizontal ? "Width" : "Height"),
            amount = 100,
            toPixels = unit === "px",
            toPercent = unit === "%",
            px,
            parent,
            cache,
            isSVG;

        if (unit === curUnit || !curValue || _nonConvertibleUnits[unit] || _nonConvertibleUnits[curUnit]) {
          return curValue;
        }

        curUnit !== "px" && !toPixels && (curValue = _convertToUnit(target, property, value, "px"));
        isSVG = target.getCTM && _isSVG(target);

        if ((toPercent || curUnit === "%") && (_transformProps[property] || ~property.indexOf("adius"))) {
          px = isSVG ? target.getBBox()[horizontal ? "width" : "height"] : target[measureProperty];
          return _round(toPercent ? curValue / px * amount : curValue / 100 * px);
        }

        style[horizontal ? "width" : "height"] = amount + (toPixels ? curUnit : unit);
        parent = ~property.indexOf("adius") || unit === "em" && target.appendChild && !isRootSVG ? target : target.parentNode;

        if (isSVG) {
          parent = (target.ownerSVGElement || {}).parentNode;
        }

        if (!parent || parent === _doc$1 || !parent.appendChild) {
          parent = _doc$1.body;
        }

        cache = parent._gsap;

        if (cache && toPercent && cache.width && horizontal && cache.time === _ticker.time && !cache.uncache) {
          return _round(curValue / cache.width * amount);
        } else {
          if (toPercent && (property === "height" || property === "width")) {
            var v = target.style[property];
            target.style[property] = amount + unit;
            px = target[measureProperty];
            v ? target.style[property] = v : _removeProperty(target, property);
          } else {
            (toPercent || curUnit === "%") && !_nonStandardLayouts[_getComputedProperty(parent, "display")] && (style.position = _getComputedProperty(target, "position"));
            parent === target && (style.position = "static");
            parent.appendChild(_tempDiv);
            px = _tempDiv[measureProperty];
            parent.removeChild(_tempDiv);
            style.position = "absolute";
          }

          if (horizontal && toPercent) {
            cache = _getCache(parent);
            cache.time = _ticker.time;
            cache.width = parent[measureProperty];
          }
        }

        return _round(toPixels ? px * curValue / amount : px && curValue ? amount / px * curValue : 0);
      },
          _get = function _get(target, property, unit, uncache) {
        var value;
        _pluginInitted || _initCore();

        if (property in _propertyAliases && property !== "transform") {
          property = _propertyAliases[property];

          if (~property.indexOf(",")) {
            property = property.split(",")[0];
          }
        }

        if (_transformProps[property] && property !== "transform") {
          value = _parseTransform(target, uncache);
          value = property !== "transformOrigin" ? value[property] : value.svg ? value.origin : _firstTwoOnly(_getComputedProperty(target, _transformOriginProp)) + " " + value.zOrigin + "px";
        } else {
          value = target.style[property];

          if (!value || value === "auto" || uncache || ~(value + "").indexOf("calc(")) {
            value = _specialProps[property] && _specialProps[property](target, property, unit) || _getComputedProperty(target, property) || _getProperty(target, property) || (property === "opacity" ? 1 : 0);
          }
        }

        return unit && !~(value + "").trim().indexOf(" ") ? _convertToUnit(target, property, value, unit) + unit : value;
      },
          _tweenComplexCSSString = function _tweenComplexCSSString(target, prop, start, end) {
        if (!start || start === "none") {
          var p = _checkPropPrefix(prop, target, 1),
              s = p && _getComputedProperty(target, p, 1);

          if (s && s !== start) {
            prop = p;
            start = s;
          } else if (prop === "borderColor") {
            start = _getComputedProperty(target, "borderTopColor");
          }
        }

        var pt = new PropTween(this._pt, target.style, prop, 0, 1, _renderComplexString),
            index = 0,
            matchIndex = 0,
            a,
            result,
            startValues,
            startNum,
            color,
            startValue,
            endValue,
            endNum,
            chunk,
            endUnit,
            startUnit,
            endValues;
        pt.b = start;
        pt.e = end;
        start += "";
        end += "";

        if (end === "auto") {
          startValue = target.style[prop];
          target.style[prop] = end;
          end = _getComputedProperty(target, prop) || end;
          startValue ? target.style[prop] = startValue : _removeProperty(target, prop);
        }

        a = [start, end];

        _colorStringFilter(a);

        start = a[0];
        end = a[1];
        startValues = start.match(_numWithUnitExp) || [];
        endValues = end.match(_numWithUnitExp) || [];

        if (endValues.length) {
          while (result = _numWithUnitExp.exec(end)) {
            endValue = result[0];
            chunk = end.substring(index, result.index);

            if (color) {
              color = (color + 1) % 5;
            } else if (chunk.substr(-5) === "rgba(" || chunk.substr(-5) === "hsla(") {
              color = 1;
            }

            if (endValue !== (startValue = startValues[matchIndex++] || "")) {
              startNum = parseFloat(startValue) || 0;
              startUnit = startValue.substr((startNum + "").length);
              endValue.charAt(1) === "=" && (endValue = _parseRelative(startNum, endValue) + startUnit);
              endNum = parseFloat(endValue);
              endUnit = endValue.substr((endNum + "").length);
              index = _numWithUnitExp.lastIndex - endUnit.length;

              if (!endUnit) {
                endUnit = endUnit || _config.units[prop] || startUnit;

                if (index === end.length) {
                  end += endUnit;
                  pt.e += endUnit;
                }
              }

              if (startUnit !== endUnit) {
                startNum = _convertToUnit(target, prop, startValue, endUnit) || 0;
              }

              pt._pt = {
                _next: pt._pt,
                p: chunk || matchIndex === 1 ? chunk : ",",
                s: startNum,
                c: endNum - startNum,
                m: color && color < 4 || prop === "zIndex" ? Math.round : 0
              };
            }
          }

          pt.c = index < end.length ? end.substring(index, end.length) : "";
        } else {
          pt.r = prop === "display" && end === "none" ? _renderNonTweeningValueOnlyAtEnd : _renderNonTweeningValue;
        }

        _relExp.test(end) && (pt.e = 0);
        this._pt = pt;
        return pt;
      },
          _keywordToPercent = {
        top: "0%",
        bottom: "100%",
        left: "0%",
        right: "100%",
        center: "50%"
      },
          _convertKeywordsToPercentages = function _convertKeywordsToPercentages(value) {
        var split = value.split(" "),
            x = split[0],
            y = split[1] || "50%";

        if (x === "top" || x === "bottom" || y === "left" || y === "right") {
          value = x;
          x = y;
          y = value;
        }

        split[0] = _keywordToPercent[x] || x;
        split[1] = _keywordToPercent[y] || y;
        return split.join(" ");
      },
          _renderClearProps = function _renderClearProps(ratio, data) {
        if (data.tween && data.tween._time === data.tween._dur) {
          var target = data.t,
              style = target.style,
              props = data.u,
              cache = target._gsap,
              prop,
              clearTransforms,
              i;

          if (props === "all" || props === true) {
            style.cssText = "";
            clearTransforms = 1;
          } else {
            props = props.split(",");
            i = props.length;

            while (--i > -1) {
              prop = props[i];

              if (_transformProps[prop]) {
                clearTransforms = 1;
                prop = prop === "transformOrigin" ? _transformOriginProp : _transformProp;
              }

              _removeProperty(target, prop);
            }
          }

          if (clearTransforms) {
            _removeProperty(target, _transformProp);

            if (cache) {
              cache.svg && target.removeAttribute("transform");

              _parseTransform(target, 1);

              cache.uncache = 1;

              _removeIndependentTransforms(style);
            }
          }
        }
      },
          _specialProps = {
        clearProps: function clearProps(plugin, target, property, endValue, tween) {
          if (tween.data !== "isFromStart") {
            var pt = plugin._pt = new PropTween(plugin._pt, target, property, 0, 0, _renderClearProps);
            pt.u = endValue;
            pt.pr = -10;
            pt.tween = tween;

            plugin._props.push(property);

            return 1;
          }
        }
      },
          _identity2DMatrix = [1, 0, 0, 1, 0, 0],
          _rotationalProperties = {},
          _isNullTransform = function _isNullTransform(value) {
        return value === "matrix(1, 0, 0, 1, 0, 0)" || value === "none" || !value;
      },
          _getComputedTransformMatrixAsArray = function _getComputedTransformMatrixAsArray(target) {
        var matrixString = _getComputedProperty(target, _transformProp);

        return _isNullTransform(matrixString) ? _identity2DMatrix : matrixString.substr(7).match(_numExp).map(_round);
      },
          _getMatrix = function _getMatrix(target, force2D) {
        var cache = target._gsap || _getCache(target),
            style = target.style,
            matrix = _getComputedTransformMatrixAsArray(target),
            parent,
            nextSibling,
            temp,
            addedToDOM;

        if (cache.svg && target.getAttribute("transform")) {
          temp = target.transform.baseVal.consolidate().matrix;
          matrix = [temp.a, temp.b, temp.c, temp.d, temp.e, temp.f];
          return matrix.join(",") === "1,0,0,1,0,0" ? _identity2DMatrix : matrix;
        } else if (matrix === _identity2DMatrix && !target.offsetParent && target !== _docElement && !cache.svg) {
          temp = style.display;
          style.display = "block";
          parent = target.parentNode;

          if (!parent || !target.offsetParent) {
            addedToDOM = 1;
            nextSibling = target.nextElementSibling;

            _docElement.appendChild(target);
          }

          matrix = _getComputedTransformMatrixAsArray(target);
          temp ? style.display = temp : _removeProperty(target, "display");

          if (addedToDOM) {
            nextSibling ? parent.insertBefore(target, nextSibling) : parent ? parent.appendChild(target) : _docElement.removeChild(target);
          }
        }

        return force2D && matrix.length > 6 ? [matrix[0], matrix[1], matrix[4], matrix[5], matrix[12], matrix[13]] : matrix;
      },
          _applySVGOrigin = function _applySVGOrigin(target, origin, originIsAbsolute, smooth, matrixArray, pluginToAddPropTweensTo) {
        var cache = target._gsap,
            matrix = matrixArray || _getMatrix(target, true),
            xOriginOld = cache.xOrigin || 0,
            yOriginOld = cache.yOrigin || 0,
            xOffsetOld = cache.xOffset || 0,
            yOffsetOld = cache.yOffset || 0,
            a = matrix[0],
            b = matrix[1],
            c = matrix[2],
            d = matrix[3],
            tx = matrix[4],
            ty = matrix[5],
            originSplit = origin.split(" "),
            xOrigin = parseFloat(originSplit[0]) || 0,
            yOrigin = parseFloat(originSplit[1]) || 0,
            bounds,
            determinant,
            x,
            y;

        if (!originIsAbsolute) {
          bounds = _getBBox(target);
          xOrigin = bounds.x + (~originSplit[0].indexOf("%") ? xOrigin / 100 * bounds.width : xOrigin);
          yOrigin = bounds.y + (~(originSplit[1] || originSplit[0]).indexOf("%") ? yOrigin / 100 * bounds.height : yOrigin);
        } else if (matrix !== _identity2DMatrix && (determinant = a * d - b * c)) {
          x = xOrigin * (d / determinant) + yOrigin * (-c / determinant) + (c * ty - d * tx) / determinant;
          y = xOrigin * (-b / determinant) + yOrigin * (a / determinant) - (a * ty - b * tx) / determinant;
          xOrigin = x;
          yOrigin = y;
        }

        if (smooth || smooth !== false && cache.smooth) {
          tx = xOrigin - xOriginOld;
          ty = yOrigin - yOriginOld;
          cache.xOffset = xOffsetOld + (tx * a + ty * c) - tx;
          cache.yOffset = yOffsetOld + (tx * b + ty * d) - ty;
        } else {
          cache.xOffset = cache.yOffset = 0;
        }

        cache.xOrigin = xOrigin;
        cache.yOrigin = yOrigin;
        cache.smooth = !!smooth;
        cache.origin = origin;
        cache.originIsAbsolute = !!originIsAbsolute;
        target.style[_transformOriginProp] = "0px 0px";

        if (pluginToAddPropTweensTo) {
          _addNonTweeningPT(pluginToAddPropTweensTo, cache, "xOrigin", xOriginOld, xOrigin);

          _addNonTweeningPT(pluginToAddPropTweensTo, cache, "yOrigin", yOriginOld, yOrigin);

          _addNonTweeningPT(pluginToAddPropTweensTo, cache, "xOffset", xOffsetOld, cache.xOffset);

          _addNonTweeningPT(pluginToAddPropTweensTo, cache, "yOffset", yOffsetOld, cache.yOffset);
        }

        target.setAttribute("data-svg-origin", xOrigin + " " + yOrigin);
      },
          _parseTransform = function _parseTransform(target, uncache) {
        var cache = target._gsap || new GSCache(target);

        if ("x" in cache && !uncache && !cache.uncache) {
          return cache;
        }

        var style = target.style,
            invertedScaleX = cache.scaleX < 0,
            px = "px",
            deg = "deg",
            cs = getComputedStyle(target),
            origin = _getComputedProperty(target, _transformOriginProp) || "0",
            x,
            y,
            z,
            scaleX,
            scaleY,
            rotation,
            rotationX,
            rotationY,
            skewX,
            skewY,
            perspective,
            xOrigin,
            yOrigin,
            matrix,
            angle,
            cos,
            sin,
            a,
            b,
            c,
            d,
            a12,
            a22,
            t1,
            t2,
            t3,
            a13,
            a23,
            a33,
            a42,
            a43,
            a32;
        x = y = z = rotation = rotationX = rotationY = skewX = skewY = perspective = 0;
        scaleX = scaleY = 1;
        cache.svg = !!(target.getCTM && _isSVG(target));

        if (cs.translate) {
          if (cs.translate !== "none" || cs.scale !== "none" || cs.rotate !== "none") {
            style[_transformProp] = (cs.translate !== "none" ? "translate3d(" + (cs.translate + " 0 0").split(" ").slice(0, 3).join(", ") + ") " : "") + (cs.rotate !== "none" ? "rotate(" + cs.rotate + ") " : "") + (cs.scale !== "none" ? "scale(" + cs.scale.split(" ").join(",") + ") " : "") + (cs[_transformProp] !== "none" ? cs[_transformProp] : "");
          }

          style.scale = style.rotate = style.translate = "none";
        }

        matrix = _getMatrix(target, cache.svg);

        if (cache.svg) {
          if (cache.uncache) {
            t2 = target.getBBox();
            origin = cache.xOrigin - t2.x + "px " + (cache.yOrigin - t2.y) + "px";
            t1 = "";
          } else {
            t1 = !uncache && target.getAttribute("data-svg-origin");
          }

          _applySVGOrigin(target, t1 || origin, !!t1 || cache.originIsAbsolute, cache.smooth !== false, matrix);
        }

        xOrigin = cache.xOrigin || 0;
        yOrigin = cache.yOrigin || 0;

        if (matrix !== _identity2DMatrix) {
          a = matrix[0];
          b = matrix[1];
          c = matrix[2];
          d = matrix[3];
          x = a12 = matrix[4];
          y = a22 = matrix[5];

          if (matrix.length === 6) {
            scaleX = Math.sqrt(a * a + b * b);
            scaleY = Math.sqrt(d * d + c * c);
            rotation = a || b ? _atan2(b, a) * _RAD2DEG : 0;
            skewX = c || d ? _atan2(c, d) * _RAD2DEG + rotation : 0;
            skewX && (scaleY *= Math.abs(Math.cos(skewX * _DEG2RAD)));

            if (cache.svg) {
              x -= xOrigin - (xOrigin * a + yOrigin * c);
              y -= yOrigin - (xOrigin * b + yOrigin * d);
            }
          } else {
            a32 = matrix[6];
            a42 = matrix[7];
            a13 = matrix[8];
            a23 = matrix[9];
            a33 = matrix[10];
            a43 = matrix[11];
            x = matrix[12];
            y = matrix[13];
            z = matrix[14];
            angle = _atan2(a32, a33);
            rotationX = angle * _RAD2DEG;

            if (angle) {
              cos = Math.cos(-angle);
              sin = Math.sin(-angle);
              t1 = a12 * cos + a13 * sin;
              t2 = a22 * cos + a23 * sin;
              t3 = a32 * cos + a33 * sin;
              a13 = a12 * -sin + a13 * cos;
              a23 = a22 * -sin + a23 * cos;
              a33 = a32 * -sin + a33 * cos;
              a43 = a42 * -sin + a43 * cos;
              a12 = t1;
              a22 = t2;
              a32 = t3;
            }

            angle = _atan2(-c, a33);
            rotationY = angle * _RAD2DEG;

            if (angle) {
              cos = Math.cos(-angle);
              sin = Math.sin(-angle);
              t1 = a * cos - a13 * sin;
              t2 = b * cos - a23 * sin;
              t3 = c * cos - a33 * sin;
              a43 = d * sin + a43 * cos;
              a = t1;
              b = t2;
              c = t3;
            }

            angle = _atan2(b, a);
            rotation = angle * _RAD2DEG;

            if (angle) {
              cos = Math.cos(angle);
              sin = Math.sin(angle);
              t1 = a * cos + b * sin;
              t2 = a12 * cos + a22 * sin;
              b = b * cos - a * sin;
              a22 = a22 * cos - a12 * sin;
              a = t1;
              a12 = t2;
            }

            if (rotationX && Math.abs(rotationX) + Math.abs(rotation) > 359.9) {
              rotationX = rotation = 0;
              rotationY = 180 - rotationY;
            }

            scaleX = _round(Math.sqrt(a * a + b * b + c * c));
            scaleY = _round(Math.sqrt(a22 * a22 + a32 * a32));
            angle = _atan2(a12, a22);
            skewX = Math.abs(angle) > 0.0002 ? angle * _RAD2DEG : 0;
            perspective = a43 ? 1 / (a43 < 0 ? -a43 : a43) : 0;
          }

          if (cache.svg) {
            t1 = target.getAttribute("transform");
            cache.forceCSS = target.setAttribute("transform", "") || !_isNullTransform(_getComputedProperty(target, _transformProp));
            t1 && target.setAttribute("transform", t1);
          }
        }

        if (Math.abs(skewX) > 90 && Math.abs(skewX) < 270) {
          if (invertedScaleX) {
            scaleX *= -1;
            skewX += rotation <= 0 ? 180 : -180;
            rotation += rotation <= 0 ? 180 : -180;
          } else {
            scaleY *= -1;
            skewX += skewX <= 0 ? 180 : -180;
          }
        }

        uncache = uncache || cache.uncache;
        cache.x = x - ((cache.xPercent = x && (!uncache && cache.xPercent || (Math.round(target.offsetWidth / 2) === Math.round(-x) ? -50 : 0))) ? target.offsetWidth * cache.xPercent / 100 : 0) + px;
        cache.y = y - ((cache.yPercent = y && (!uncache && cache.yPercent || (Math.round(target.offsetHeight / 2) === Math.round(-y) ? -50 : 0))) ? target.offsetHeight * cache.yPercent / 100 : 0) + px;
        cache.z = z + px;
        cache.scaleX = _round(scaleX);
        cache.scaleY = _round(scaleY);
        cache.rotation = _round(rotation) + deg;
        cache.rotationX = _round(rotationX) + deg;
        cache.rotationY = _round(rotationY) + deg;
        cache.skewX = skewX + deg;
        cache.skewY = skewY + deg;
        cache.transformPerspective = perspective + px;

        if (cache.zOrigin = parseFloat(origin.split(" ")[2]) || !uncache && cache.zOrigin || 0) {
          style[_transformOriginProp] = _firstTwoOnly(origin);
        }

        cache.xOffset = cache.yOffset = 0;
        cache.force3D = _config.force3D;
        cache.renderTransform = cache.svg ? _renderSVGTransforms : _supports3D ? _renderCSSTransforms : _renderNon3DTransforms;
        cache.uncache = 0;
        return cache;
      },
          _firstTwoOnly = function _firstTwoOnly(value) {
        return (value = value.split(" "))[0] + " " + value[1];
      },
          _addPxTranslate = function _addPxTranslate(target, start, value) {
        var unit = getUnit(start);
        return _round(parseFloat(start) + parseFloat(_convertToUnit(target, "x", value + "px", unit))) + unit;
      },
          _renderNon3DTransforms = function _renderNon3DTransforms(ratio, cache) {
        cache.z = "0px";
        cache.rotationY = cache.rotationX = "0deg";
        cache.force3D = 0;

        _renderCSSTransforms(ratio, cache);
      },
          _zeroDeg = "0deg",
          _zeroPx = "0px",
          _endParenthesis = ") ",
          _renderCSSTransforms = function _renderCSSTransforms(ratio, cache) {
        var _ref = cache || this,
            xPercent = _ref.xPercent,
            yPercent = _ref.yPercent,
            x = _ref.x,
            y = _ref.y,
            z = _ref.z,
            rotation = _ref.rotation,
            rotationY = _ref.rotationY,
            rotationX = _ref.rotationX,
            skewX = _ref.skewX,
            skewY = _ref.skewY,
            scaleX = _ref.scaleX,
            scaleY = _ref.scaleY,
            transformPerspective = _ref.transformPerspective,
            force3D = _ref.force3D,
            target = _ref.target,
            zOrigin = _ref.zOrigin,
            transforms = "",
            use3D = force3D === "auto" && ratio && ratio !== 1 || force3D === true;

        if (zOrigin && (rotationX !== _zeroDeg || rotationY !== _zeroDeg)) {
          var angle = parseFloat(rotationY) * _DEG2RAD,
              a13 = Math.sin(angle),
              a33 = Math.cos(angle),
              cos;

          angle = parseFloat(rotationX) * _DEG2RAD;
          cos = Math.cos(angle);
          x = _addPxTranslate(target, x, a13 * cos * -zOrigin);
          y = _addPxTranslate(target, y, -Math.sin(angle) * -zOrigin);
          z = _addPxTranslate(target, z, a33 * cos * -zOrigin + zOrigin);
        }

        if (transformPerspective !== _zeroPx) {
          transforms += "perspective(" + transformPerspective + _endParenthesis;
        }

        if (xPercent || yPercent) {
          transforms += "translate(" + xPercent + "%, " + yPercent + "%) ";
        }

        if (use3D || x !== _zeroPx || y !== _zeroPx || z !== _zeroPx) {
          transforms += z !== _zeroPx || use3D ? "translate3d(" + x + ", " + y + ", " + z + ") " : "translate(" + x + ", " + y + _endParenthesis;
        }

        if (rotation !== _zeroDeg) {
          transforms += "rotate(" + rotation + _endParenthesis;
        }

        if (rotationY !== _zeroDeg) {
          transforms += "rotateY(" + rotationY + _endParenthesis;
        }

        if (rotationX !== _zeroDeg) {
          transforms += "rotateX(" + rotationX + _endParenthesis;
        }

        if (skewX !== _zeroDeg || skewY !== _zeroDeg) {
          transforms += "skew(" + skewX + ", " + skewY + _endParenthesis;
        }

        if (scaleX !== 1 || scaleY !== 1) {
          transforms += "scale(" + scaleX + ", " + scaleY + _endParenthesis;
        }

        target.style[_transformProp] = transforms || "translate(0, 0)";
      },
          _renderSVGTransforms = function _renderSVGTransforms(ratio, cache) {
        var _ref2 = cache || this,
            xPercent = _ref2.xPercent,
            yPercent = _ref2.yPercent,
            x = _ref2.x,
            y = _ref2.y,
            rotation = _ref2.rotation,
            skewX = _ref2.skewX,
            skewY = _ref2.skewY,
            scaleX = _ref2.scaleX,
            scaleY = _ref2.scaleY,
            target = _ref2.target,
            xOrigin = _ref2.xOrigin,
            yOrigin = _ref2.yOrigin,
            xOffset = _ref2.xOffset,
            yOffset = _ref2.yOffset,
            forceCSS = _ref2.forceCSS,
            tx = parseFloat(x),
            ty = parseFloat(y),
            a11,
            a21,
            a12,
            a22,
            temp;

        rotation = parseFloat(rotation);
        skewX = parseFloat(skewX);
        skewY = parseFloat(skewY);

        if (skewY) {
          skewY = parseFloat(skewY);
          skewX += skewY;
          rotation += skewY;
        }

        if (rotation || skewX) {
          rotation *= _DEG2RAD;
          skewX *= _DEG2RAD;
          a11 = Math.cos(rotation) * scaleX;
          a21 = Math.sin(rotation) * scaleX;
          a12 = Math.sin(rotation - skewX) * -scaleY;
          a22 = Math.cos(rotation - skewX) * scaleY;

          if (skewX) {
            skewY *= _DEG2RAD;
            temp = Math.tan(skewX - skewY);
            temp = Math.sqrt(1 + temp * temp);
            a12 *= temp;
            a22 *= temp;

            if (skewY) {
              temp = Math.tan(skewY);
              temp = Math.sqrt(1 + temp * temp);
              a11 *= temp;
              a21 *= temp;
            }
          }

          a11 = _round(a11);
          a21 = _round(a21);
          a12 = _round(a12);
          a22 = _round(a22);
        } else {
          a11 = scaleX;
          a22 = scaleY;
          a21 = a12 = 0;
        }

        if (tx && !~(x + "").indexOf("px") || ty && !~(y + "").indexOf("px")) {
          tx = _convertToUnit(target, "x", x, "px");
          ty = _convertToUnit(target, "y", y, "px");
        }

        if (xOrigin || yOrigin || xOffset || yOffset) {
          tx = _round(tx + xOrigin - (xOrigin * a11 + yOrigin * a12) + xOffset);
          ty = _round(ty + yOrigin - (xOrigin * a21 + yOrigin * a22) + yOffset);
        }

        if (xPercent || yPercent) {
          temp = target.getBBox();
          tx = _round(tx + xPercent / 100 * temp.width);
          ty = _round(ty + yPercent / 100 * temp.height);
        }

        temp = "matrix(" + a11 + "," + a21 + "," + a12 + "," + a22 + "," + tx + "," + ty + ")";
        target.setAttribute("transform", temp);
        forceCSS && (target.style[_transformProp] = temp);
      },
          _addRotationalPropTween = function _addRotationalPropTween(plugin, target, property, startNum, endValue) {
        var cap = 360,
            isString = _isString(endValue),
            endNum = parseFloat(endValue) * (isString && ~endValue.indexOf("rad") ? _RAD2DEG : 1),
            change = endNum - startNum,
            finalValue = startNum + change + "deg",
            direction,
            pt;

        if (isString) {
          direction = endValue.split("_")[1];

          if (direction === "short") {
            change %= cap;

            if (change !== change % (cap / 2)) {
              change += change < 0 ? cap : -cap;
            }
          }

          if (direction === "cw" && change < 0) {
            change = (change + cap * _bigNum$1) % cap - ~~(change / cap) * cap;
          } else if (direction === "ccw" && change > 0) {
            change = (change - cap * _bigNum$1) % cap - ~~(change / cap) * cap;
          }
        }

        plugin._pt = pt = new PropTween(plugin._pt, target, property, startNum, change, _renderPropWithEnd);
        pt.e = finalValue;
        pt.u = "deg";

        plugin._props.push(property);

        return pt;
      },
          _assign = function _assign(target, source) {
        for (var p in source) {
          target[p] = source[p];
        }

        return target;
      },
          _addRawTransformPTs = function _addRawTransformPTs(plugin, transforms, target) {
        var startCache = _assign({}, target._gsap),
            exclude = "perspective,force3D,transformOrigin,svgOrigin",
            style = target.style,
            endCache,
            p,
            startValue,
            endValue,
            startNum,
            endNum,
            startUnit,
            endUnit;

        if (startCache.svg) {
          startValue = target.getAttribute("transform");
          target.setAttribute("transform", "");
          style[_transformProp] = transforms;
          endCache = _parseTransform(target, 1);

          _removeProperty(target, _transformProp);

          target.setAttribute("transform", startValue);
        } else {
          startValue = getComputedStyle(target)[_transformProp];
          style[_transformProp] = transforms;
          endCache = _parseTransform(target, 1);
          style[_transformProp] = startValue;
        }

        for (p in _transformProps) {
          startValue = startCache[p];
          endValue = endCache[p];

          if (startValue !== endValue && exclude.indexOf(p) < 0) {
            startUnit = getUnit(startValue);
            endUnit = getUnit(endValue);
            startNum = startUnit !== endUnit ? _convertToUnit(target, p, startValue, endUnit) : parseFloat(startValue);
            endNum = parseFloat(endValue);
            plugin._pt = new PropTween(plugin._pt, endCache, p, startNum, endNum - startNum, _renderCSSProp);
            plugin._pt.u = endUnit || 0;

            plugin._props.push(p);
          }
        }

        _assign(endCache, startCache);
      };

      _forEachName("padding,margin,Width,Radius", function (name, index) {
        var t = "Top",
            r = "Right",
            b = "Bottom",
            l = "Left",
            props = (index < 3 ? [t, r, b, l] : [t + l, t + r, b + r, b + l]).map(function (side) {
          return index < 2 ? name + side : "border" + side + name;
        });

        _specialProps[index > 1 ? "border" + name : name] = function (plugin, target, property, endValue, tween) {
          var a, vars;

          if (arguments.length < 4) {
            a = props.map(function (prop) {
              return _get(plugin, prop, property);
            });
            vars = a.join(" ");
            return vars.split(a[0]).length === 5 ? a[0] : vars;
          }

          a = (endValue + "").split(" ");
          vars = {};
          props.forEach(function (prop, i) {
            return vars[prop] = a[i] = a[i] || a[(i - 1) / 2 | 0];
          });
          plugin.init(target, vars, tween);
        };
      });

      var CSSPlugin = {
        name: "css",
        register: _initCore,
        targetTest: function targetTest(target) {
          return target.style && target.nodeType;
        },
        init: function init(target, vars, tween, index, targets) {
          var props = this._props,
              style = target.style,
              startAt = tween.vars.startAt,
              startValue,
              endValue,
              endNum,
              startNum,
              type,
              specialProp,
              p,
              startUnit,
              endUnit,
              relative,
              isTransformRelated,
              transformPropTween,
              cache,
              smooth,
              hasPriority,
              inlineProps;
          _pluginInitted || _initCore();
          this.styles = this.styles || _getStyleSaver(target);
          inlineProps = this.styles.props;
          this.tween = tween;

          for (p in vars) {
            if (p === "autoRound") {
              continue;
            }

            endValue = vars[p];

            if (_plugins[p] && _checkPlugin(p, vars, tween, index, target, targets)) {
              continue;
            }

            type = typeof endValue;
            specialProp = _specialProps[p];

            if (type === "function") {
              endValue = endValue.call(tween, index, target, targets);
              type = typeof endValue;
            }

            if (type === "string" && ~endValue.indexOf("random(")) {
              endValue = _replaceRandom(endValue);
            }

            if (specialProp) {
              specialProp(this, target, p, endValue, tween) && (hasPriority = 1);
            } else if (p.substr(0, 2) === "--") {
              startValue = (getComputedStyle(target).getPropertyValue(p) + "").trim();
              endValue += "";
              _colorExp.lastIndex = 0;

              if (!_colorExp.test(startValue)) {
                startUnit = getUnit(startValue);
                endUnit = getUnit(endValue);
              }

              endUnit ? startUnit !== endUnit && (startValue = _convertToUnit(target, p, startValue, endUnit) + endUnit) : startUnit && (endValue += startUnit);
              this.add(style, "setProperty", startValue, endValue, index, targets, 0, 0, p);
              props.push(p);
              inlineProps.push(p, 0, style[p]);
            } else if (type !== "undefined") {
              if (startAt && p in startAt) {
                startValue = typeof startAt[p] === "function" ? startAt[p].call(tween, index, target, targets) : startAt[p];
                _isString(startValue) && ~startValue.indexOf("random(") && (startValue = _replaceRandom(startValue));
                getUnit(startValue + "") || startValue === "auto" || (startValue += _config.units[p] || getUnit(_get(target, p)) || "");
                (startValue + "").charAt(1) === "=" && (startValue = _get(target, p));
              } else {
                startValue = _get(target, p);
              }

              startNum = parseFloat(startValue);
              relative = type === "string" && endValue.charAt(1) === "=" && endValue.substr(0, 2);
              relative && (endValue = endValue.substr(2));
              endNum = parseFloat(endValue);

              if (p in _propertyAliases) {
                if (p === "autoAlpha") {
                  if (startNum === 1 && _get(target, "visibility") === "hidden" && endNum) {
                    startNum = 0;
                  }

                  inlineProps.push("visibility", 0, style.visibility);

                  _addNonTweeningPT(this, style, "visibility", startNum ? "inherit" : "hidden", endNum ? "inherit" : "hidden", !endNum);
                }

                if (p !== "scale" && p !== "transform") {
                  p = _propertyAliases[p];
                  ~p.indexOf(",") && (p = p.split(",")[0]);
                }
              }

              isTransformRelated = p in _transformProps;

              if (isTransformRelated) {
                this.styles.save(p);

                if (!transformPropTween) {
                  cache = target._gsap;
                  cache.renderTransform && !vars.parseTransform || _parseTransform(target, vars.parseTransform);
                  smooth = vars.smoothOrigin !== false && cache.smooth;
                  transformPropTween = this._pt = new PropTween(this._pt, style, _transformProp, 0, 1, cache.renderTransform, cache, 0, -1);
                  transformPropTween.dep = 1;
                }

                if (p === "scale") {
                  this._pt = new PropTween(this._pt, cache, "scaleY", cache.scaleY, (relative ? _parseRelative(cache.scaleY, relative + endNum) : endNum) - cache.scaleY || 0, _renderCSSProp);
                  this._pt.u = 0;
                  props.push("scaleY", p);
                  p += "X";
                } else if (p === "transformOrigin") {
                  inlineProps.push(_transformOriginProp, 0, style[_transformOriginProp]);
                  endValue = _convertKeywordsToPercentages(endValue);

                  if (cache.svg) {
                    _applySVGOrigin(target, endValue, 0, smooth, 0, this);
                  } else {
                    endUnit = parseFloat(endValue.split(" ")[2]) || 0;
                    endUnit !== cache.zOrigin && _addNonTweeningPT(this, cache, "zOrigin", cache.zOrigin, endUnit);

                    _addNonTweeningPT(this, style, p, _firstTwoOnly(startValue), _firstTwoOnly(endValue));
                  }

                  continue;
                } else if (p === "svgOrigin") {
                  _applySVGOrigin(target, endValue, 1, smooth, 0, this);

                  continue;
                } else if (p in _rotationalProperties) {
                  _addRotationalPropTween(this, cache, p, startNum, relative ? _parseRelative(startNum, relative + endValue) : endValue);

                  continue;
                } else if (p === "smoothOrigin") {
                  _addNonTweeningPT(this, cache, "smooth", cache.smooth, endValue);

                  continue;
                } else if (p === "force3D") {
                  cache[p] = endValue;
                  continue;
                } else if (p === "transform") {
                  _addRawTransformPTs(this, endValue, target);

                  continue;
                }
              } else if (!(p in style)) {
                p = _checkPropPrefix(p) || p;
              }

              if (isTransformRelated || (endNum || endNum === 0) && (startNum || startNum === 0) && !_complexExp.test(endValue) && p in style) {
                startUnit = (startValue + "").substr((startNum + "").length);
                endNum || (endNum = 0);
                endUnit = getUnit(endValue) || (p in _config.units ? _config.units[p] : startUnit);
                startUnit !== endUnit && (startNum = _convertToUnit(target, p, startValue, endUnit));
                this._pt = new PropTween(this._pt, isTransformRelated ? cache : style, p, startNum, (relative ? _parseRelative(startNum, relative + endNum) : endNum) - startNum, !isTransformRelated && (endUnit === "px" || p === "zIndex") && vars.autoRound !== false ? _renderRoundedCSSProp : _renderCSSProp);
                this._pt.u = endUnit || 0;

                if (startUnit !== endUnit && endUnit !== "%") {
                  this._pt.b = startValue;
                  this._pt.r = _renderCSSPropWithBeginning;
                }
              } else if (!(p in style)) {
                if (p in target) {
                  this.add(target, p, startValue || target[p], relative ? relative + endValue : endValue, index, targets);
                } else if (p !== "parseTransform") {
                  _missingPlugin(p, endValue);

                  continue;
                }
              } else {
                _tweenComplexCSSString.call(this, target, p, startValue, relative ? relative + endValue : endValue);
              }

              isTransformRelated || (p in style ? inlineProps.push(p, 0, style[p]) : inlineProps.push(p, 1, startValue || target[p]));
              props.push(p);
            }
          }

          hasPriority && _sortPropTweensByPriority(this);
        },
        render: function render(ratio, data) {
          if (data.tween._time || !_reverting$1()) {
            var pt = data._pt;

            while (pt) {
              pt.r(ratio, pt.d);
              pt = pt._next;
            }
          } else {
            data.styles.revert();
          }
        },
        get: _get,
        aliases: _propertyAliases,
        getSetter: function getSetter(target, property, plugin) {
          var p = _propertyAliases[property];
          p && p.indexOf(",") < 0 && (property = p);
          return property in _transformProps && property !== _transformOriginProp && (target._gsap.x || _get(target, "x")) ? plugin && _recentSetterPlugin === plugin ? property === "scale" ? _setterScale : _setterTransform : (_recentSetterPlugin = plugin || {}) && (property === "scale" ? _setterScaleWithRender : _setterTransformWithRender) : target.style && !_isUndefined(target.style[property]) ? _setterCSSStyle : ~property.indexOf("-") ? _setterCSSProp : _getSetter(target, property);
        },
        core: {
          _removeProperty: _removeProperty,
          _getMatrix: _getMatrix
        }
      };
      gsap.utils.checkPrefix = _checkPropPrefix;
      gsap.core.getStyleSaver = _getStyleSaver;

      (function (positionAndScale, rotation, others, aliases) {
        var all = _forEachName(positionAndScale + "," + rotation + "," + others, function (name) {
          _transformProps[name] = 1;
        });

        _forEachName(rotation, function (name) {
          _config.units[name] = "deg";
          _rotationalProperties[name] = 1;
        });

        _propertyAliases[all[13]] = positionAndScale + "," + rotation;

        _forEachName(aliases, function (name) {
          var split = name.split(":");
          _propertyAliases[split[1]] = all[split[0]];
        });
      })("x,y,z,scale,scaleX,scaleY,xPercent,yPercent", "rotation,rotationX,rotationY,skewX,skewY", "transform,transformOrigin,svgOrigin,force3D,smoothOrigin,transformPerspective", "0:translateX,1:translateY,2:translateZ,8:rotate,8:rotationZ,8:rotateZ,9:rotateX,10:rotateY");

      _forEachName("x,y,z,top,right,bottom,left,width,height,fontSize,padding,margin,perspective", function (name) {
        _config.units[name] = "px";
      });

      gsap.registerPlugin(CSSPlugin);

      var gsapWithCSS = gsap.registerPlugin(CSSPlugin) || gsap,
          TweenMaxWithCSS = gsapWithCSS.core.Tween;

      exports.Back = Back;
      exports.Bounce = Bounce;
      exports.CSSPlugin = CSSPlugin;
      exports.Circ = Circ;
      exports.Cubic = Cubic;
      exports.Elastic = Elastic;
      exports.Expo = Expo;
      exports.Linear = Linear;
      exports.Power0 = Power0;
      exports.Power1 = Power1;
      exports.Power2 = Power2;
      exports.Power3 = Power3;
      exports.Power4 = Power4;
      exports.Quad = Quad;
      exports.Quart = Quart;
      exports.Quint = Quint;
      exports.Sine = Sine;
      exports.SteppedEase = SteppedEase;
      exports.Strong = Strong;
      exports.TimelineLite = Timeline;
      exports.TimelineMax = Timeline;
      exports.TweenLite = Tween;
      exports.TweenMax = TweenMaxWithCSS;
      exports.default = gsapWithCSS;
      exports.gsap = gsapWithCSS;

      if (typeof(window) === 'undefined' || window !== exports) {Object.defineProperty(exports, '__esModule', { value: true });} else {delete window.default;}

    })));
    });

    var gsap$2 = unwrapExports(gsap$1);

    /*!
     * paths 3.12.5
     * https://gsap.com
     *
     * Copyright 2008-2024, GreenSock. All rights reserved.
     * Subject to the terms at https://gsap.com/standard-license or for
     * Club GSAP members, the agreement issued with that membership.
     * @author: Jack Doyle, jack@greensock.com
    */

    /* eslint-disable */
    var _svgPathExp = /[achlmqstvz]|(-?\d*\.?\d*(?:e[\-+]?\d+)?)[0-9]/ig,
        _numbersExp = /(?:(-)?\d*\.?\d*(?:e[\-+]?\d+)?)[0-9]/ig,
        _scientific = /[\+\-]?\d*\.?\d+e[\+\-]?\d+/ig,
        _selectorExp = /(^[#\.][a-z]|[a-y][a-z])/i,
        _DEG2RAD$1 = Math.PI / 180,
        _RAD2DEG = 180 / Math.PI,
        _sin = Math.sin,
        _cos = Math.cos,
        _abs = Math.abs,
        _sqrt = Math.sqrt,
        _atan2 = Math.atan2,
        _largeNum = 1e8,
        _isString = function _isString(value) {
      return typeof value === "string";
    },
        _isNumber = function _isNumber(value) {
      return typeof value === "number";
    },
        _isUndefined = function _isUndefined(value) {
      return typeof value === "undefined";
    },
        _temp = {},
        _temp2 = {},
        _roundingNum = 1e5,
        _wrapProgress = function _wrapProgress(progress) {
      return Math.round((progress + _largeNum) % 1 * _roundingNum) / _roundingNum || (progress < 0 ? 0 : 1);
    },
        //if progress lands on 1, the % will make it 0 which is why we || 1, but not if it's negative because it makes more sense for motion to end at 0 in that case.
    _round = function _round(value) {
      return Math.round(value * _roundingNum) / _roundingNum || 0;
    },
        _roundPrecise = function _roundPrecise(value) {
      return Math.round(value * 1e10) / 1e10 || 0;
    },
        _splitSegment = function _splitSegment(rawPath, segIndex, i, t) {
      var segment = rawPath[segIndex],
          shift = t === 1 ? 6 : subdivideSegment(segment, i, t);

      if ((shift || !t) && shift + i + 2 < segment.length) {
        rawPath.splice(segIndex, 0, segment.slice(0, i + shift + 2));
        segment.splice(0, i + shift);
        return 1;
      }
    },
        _getSampleIndex = function _getSampleIndex(samples, length, progress) {
      // slightly slower way than doing this (when there's no lookup): segment.lookup[progress < 1 ? ~~(length / segment.minLength) : segment.lookup.length - 1] || 0;
      var l = samples.length,
          i = ~~(progress * l);

      if (samples[i] > length) {
        while (--i && samples[i] > length) {}

        i < 0 && (i = 0);
      } else {
        while (samples[++i] < length && i < l) {}
      }

      return i < l ? i : l - 1;
    },
        _reverseRawPath = function _reverseRawPath(rawPath, skipOuter) {
      var i = rawPath.length;
      skipOuter || rawPath.reverse();

      while (i--) {
        rawPath[i].reversed || reverseSegment(rawPath[i]);
      }
    },
        _copyMetaData = function _copyMetaData(source, copy) {
      copy.totalLength = source.totalLength;

      if (source.samples) {
        //segment
        copy.samples = source.samples.slice(0);
        copy.lookup = source.lookup.slice(0);
        copy.minLength = source.minLength;
        copy.resolution = source.resolution;
      } else if (source.totalPoints) {
        //rawPath
        copy.totalPoints = source.totalPoints;
      }

      return copy;
    },
        //pushes a new segment into a rawPath, but if its starting values match the ending values of the last segment, it'll merge it into that same segment (to reduce the number of segments)
    _appendOrMerge = function _appendOrMerge(rawPath, segment) {
      var index = rawPath.length,
          prevSeg = rawPath[index - 1] || [],
          l = prevSeg.length;

      if (index && segment[0] === prevSeg[l - 2] && segment[1] === prevSeg[l - 1]) {
        segment = prevSeg.concat(segment.slice(2));
        index--;
      }

      rawPath[index] = segment;
    };
    /* TERMINOLOGY
     - RawPath - an array of arrays, one for each Segment. A single RawPath could have multiple "M" commands, defining Segments (paths aren't always connected).
     - Segment - an array containing a sequence of Cubic Bezier coordinates in alternating x, y, x, y format. Starting anchor, then control point 1, control point 2, and ending anchor, then the next control point 1, control point 2, anchor, etc. Uses less memory than an array with a bunch of {x, y} points.
     - Bezier - a single cubic Bezier with a starting anchor, two control points, and an ending anchor.
     - the variable "t" is typically the position along an individual Bezier path (time) and it's NOT linear, meaning it could accelerate/decelerate based on the control points whereas the "p" or "progress" value is linearly mapped to the whole path, so it shouldn't really accelerate/decelerate based on control points. So a progress of 0.2 would be almost exactly 20% along the path. "t" is ONLY in an individual Bezier piece.
     */
    //accepts basic selector text, a path instance, a RawPath instance, or a Segment and returns a RawPath (makes it easy to homogenize things). If an element or selector text is passed in, it'll also cache the value so that if it's queried again, it'll just take the path data from there instead of parsing it all over again (as long as the path data itself hasn't changed - it'll check).


    function getRawPath(value) {
      value = _isString(value) && _selectorExp.test(value) ? document.querySelector(value) || value : value;
      var e = value.getAttribute ? value : 0,
          rawPath;

      if (e && (value = value.getAttribute("d"))) {
        //implements caching
        if (!e._gsPath) {
          e._gsPath = {};
        }

        rawPath = e._gsPath[value];
        return rawPath && !rawPath._dirty ? rawPath : e._gsPath[value] = stringToRawPath(value);
      }

      return !value ? console.warn("Expecting a <path> element or an SVG path data string") : _isString(value) ? stringToRawPath(value) : _isNumber(value[0]) ? [value] : value;
    } //copies a RawPath WITHOUT the length meta data (for speed)

    function copyRawPath(rawPath) {
      var a = [],
          i = 0;

      for (; i < rawPath.length; i++) {
        a[i] = _copyMetaData(rawPath[i], rawPath[i].slice(0));
      }

      return _copyMetaData(rawPath, a);
    }
    function reverseSegment(segment) {
      var i = 0,
          y;
      segment.reverse(); //this will invert the order y, x, y, x so we must flip it back.

      for (; i < segment.length; i += 2) {
        y = segment[i];
        segment[i] = segment[i + 1];
        segment[i + 1] = y;
      }

      segment.reversed = !segment.reversed;
    }

    var _createPath = function _createPath(e, ignore) {
      var path = document.createElementNS("http://www.w3.org/2000/svg", "path"),
          attr = [].slice.call(e.attributes),
          i = attr.length,
          name;
      ignore = "," + ignore + ",";

      while (--i > -1) {
        name = attr[i].nodeName.toLowerCase(); //in Microsoft Edge, if you don't set the attribute with a lowercase name, it doesn't render correctly! Super weird.

        if (ignore.indexOf("," + name + ",") < 0) {
          path.setAttributeNS(null, name, attr[i].nodeValue);
        }
      }

      return path;
    },
        _typeAttrs = {
      rect: "rx,ry,x,y,width,height",
      circle: "r,cx,cy",
      ellipse: "rx,ry,cx,cy",
      line: "x1,x2,y1,y2"
    },
        _attrToObj = function _attrToObj(e, attrs) {
      var props = attrs ? attrs.split(",") : [],
          obj = {},
          i = props.length;

      while (--i > -1) {
        obj[props[i]] = +e.getAttribute(props[i]) || 0;
      }

      return obj;
    }; //converts an SVG shape like <circle>, <rect>, <polygon>, <polyline>, <ellipse>, etc. to a <path>, swapping it in and copying the attributes to match.


    function convertToPath(element, swap) {
      var type = element.tagName.toLowerCase(),
          circ = 0.552284749831,
          data,
          x,
          y,
          r,
          ry,
          path,
          rcirc,
          rycirc,
          points,
          w,
          h,
          x2,
          x3,
          x4,
          x5,
          x6,
          y2,
          y3,
          y4,
          y5,
          y6,
          attr;

      if (type === "path" || !element.getBBox) {
        return element;
      }

      path = _createPath(element, "x,y,width,height,cx,cy,rx,ry,r,x1,x2,y1,y2,points");
      attr = _attrToObj(element, _typeAttrs[type]);

      if (type === "rect") {
        r = attr.rx;
        ry = attr.ry || r;
        x = attr.x;
        y = attr.y;
        w = attr.width - r * 2;
        h = attr.height - ry * 2;

        if (r || ry) {
          //if there are rounded corners, render cubic beziers
          x2 = x + r * (1 - circ);
          x3 = x + r;
          x4 = x3 + w;
          x5 = x4 + r * circ;
          x6 = x4 + r;
          y2 = y + ry * (1 - circ);
          y3 = y + ry;
          y4 = y3 + h;
          y5 = y4 + ry * circ;
          y6 = y4 + ry;
          data = "M" + x6 + "," + y3 + " V" + y4 + " C" + [x6, y5, x5, y6, x4, y6, x4 - (x4 - x3) / 3, y6, x3 + (x4 - x3) / 3, y6, x3, y6, x2, y6, x, y5, x, y4, x, y4 - (y4 - y3) / 3, x, y3 + (y4 - y3) / 3, x, y3, x, y2, x2, y, x3, y, x3 + (x4 - x3) / 3, y, x4 - (x4 - x3) / 3, y, x4, y, x5, y, x6, y2, x6, y3].join(",") + "z";
        } else {
          data = "M" + (x + w) + "," + y + " v" + h + " h" + -w + " v" + -h + " h" + w + "z";
        }
      } else if (type === "circle" || type === "ellipse") {
        if (type === "circle") {
          r = ry = attr.r;
          rycirc = r * circ;
        } else {
          r = attr.rx;
          ry = attr.ry;
          rycirc = ry * circ;
        }

        x = attr.cx;
        y = attr.cy;
        rcirc = r * circ;
        data = "M" + (x + r) + "," + y + " C" + [x + r, y + rycirc, x + rcirc, y + ry, x, y + ry, x - rcirc, y + ry, x - r, y + rycirc, x - r, y, x - r, y - rycirc, x - rcirc, y - ry, x, y - ry, x + rcirc, y - ry, x + r, y - rycirc, x + r, y].join(",") + "z";
      } else if (type === "line") {
        data = "M" + attr.x1 + "," + attr.y1 + " L" + attr.x2 + "," + attr.y2; //previously, we just converted to "Mx,y Lx,y" but Safari has bugs that cause that not to render properly when using a stroke-dasharray that's not fully visible! Using a cubic bezier fixes that issue.
      } else if (type === "polyline" || type === "polygon") {
        points = (element.getAttribute("points") + "").match(_numbersExp) || [];
        x = points.shift();
        y = points.shift();
        data = "M" + x + "," + y + " L" + points.join(",");

        if (type === "polygon") {
          data += "," + x + "," + y + "z";
        }
      }

      path.setAttribute("d", rawPathToString(path._gsRawPath = stringToRawPath(data)));

      if (swap && element.parentNode) {
        element.parentNode.insertBefore(path, element);
        element.parentNode.removeChild(element);
      }

      return path;
    } //returns the rotation (in degrees) at a particular progress on a rawPath (the slope of the tangent)

    function getRotationAtBezierT(segment, i, t) {
      var a = segment[i],
          b = segment[i + 2],
          c = segment[i + 4],
          x;
      a += (b - a) * t;
      b += (c - b) * t;
      a += (b - a) * t;
      x = b + (c + (segment[i + 6] - c) * t - b) * t - a;
      a = segment[i + 1];
      b = segment[i + 3];
      c = segment[i + 5];
      a += (b - a) * t;
      b += (c - b) * t;
      a += (b - a) * t;
      return _round(_atan2(b + (c + (segment[i + 7] - c) * t - b) * t - a, x) * _RAD2DEG);
    }

    function sliceRawPath(rawPath, start, end) {
      end = _isUndefined(end) ? 1 : _roundPrecise(end) || 0; // we must round to avoid issues like 4.15 / 8 = 0.8300000000000001 instead of 0.83 or 2.8 / 5 = 0.5599999999999999 instead of 0.56 and if someone is doing a loop like start: 2.8 / 0.5, end: 2.8 / 0.5 + 1.

      start = _roundPrecise(start) || 0;
      var loops = Math.max(0, ~~(_abs(end - start) - 1e-8)),
          path = copyRawPath(rawPath);

      if (start > end) {
        start = 1 - start;
        end = 1 - end;

        _reverseRawPath(path);

        path.totalLength = 0;
      }

      if (start < 0 || end < 0) {
        var offset = Math.abs(~~Math.min(start, end)) + 1;
        start += offset;
        end += offset;
      }

      path.totalLength || cacheRawPathMeasurements(path);
      var wrap = end > 1,
          s = getProgressData(path, start, _temp, true),
          e = getProgressData(path, end, _temp2),
          eSeg = e.segment,
          sSeg = s.segment,
          eSegIndex = e.segIndex,
          sSegIndex = s.segIndex,
          ei = e.i,
          si = s.i,
          sameSegment = sSegIndex === eSegIndex,
          sameBezier = ei === si && sameSegment,
          wrapsBehind,
          sShift,
          eShift,
          i,
          copy,
          totalSegments,
          l,
          j;

      if (wrap || loops) {
        wrapsBehind = eSegIndex < sSegIndex || sameSegment && ei < si || sameBezier && e.t < s.t;

        if (_splitSegment(path, sSegIndex, si, s.t)) {
          sSegIndex++;

          if (!wrapsBehind) {
            eSegIndex++;

            if (sameBezier) {
              e.t = (e.t - s.t) / (1 - s.t);
              ei = 0;
            } else if (sameSegment) {
              ei -= si;
            }
          }
        }

        if (Math.abs(1 - (end - start)) < 1e-5) {
          eSegIndex = sSegIndex - 1;
        } else if (!e.t && eSegIndex) {
          eSegIndex--;
        } else if (_splitSegment(path, eSegIndex, ei, e.t) && wrapsBehind) {
          sSegIndex++;
        }

        if (s.t === 1) {
          sSegIndex = (sSegIndex + 1) % path.length;
        }

        copy = [];
        totalSegments = path.length;
        l = 1 + totalSegments * loops;
        j = sSegIndex;
        l += (totalSegments - sSegIndex + eSegIndex) % totalSegments;

        for (i = 0; i < l; i++) {
          _appendOrMerge(copy, path[j++ % totalSegments]);
        }

        path = copy;
      } else {
        eShift = e.t === 1 ? 6 : subdivideSegment(eSeg, ei, e.t);

        if (start !== end) {
          sShift = subdivideSegment(sSeg, si, sameBezier ? s.t / e.t : s.t);
          sameSegment && (eShift += sShift);
          eSeg.splice(ei + eShift + 2);
          (sShift || si) && sSeg.splice(0, si + sShift);
          i = path.length;

          while (i--) {
            //chop off any extra segments
            (i < sSegIndex || i > eSegIndex) && path.splice(i, 1);
          }
        } else {
          eSeg.angle = getRotationAtBezierT(eSeg, ei + eShift, 0); //record the value before we chop because it'll be impossible to determine the angle after its length is 0!

          ei += eShift;
          s = eSeg[ei];
          e = eSeg[ei + 1];
          eSeg.length = eSeg.totalLength = 0;
          eSeg.totalPoints = path.totalPoints = 8;
          eSeg.push(s, e, s, e, s, e, s, e);
        }
      }

      path.totalLength = 0;
      return path;
    } //measures a Segment according to its resolution (so if segment.resolution is 6, for example, it'll take 6 samples equally across each Bezier) and create/populate a "samples" Array that has the length up to each of those sample points (always increasing from the start) as well as a "lookup" array that's broken up according to the smallest distance between 2 samples. This gives us a very fast way of looking up a progress position rather than looping through all the points/Beziers. You can optionally have it only measure a subset, starting at startIndex and going for a specific number of beziers (remember, there are 3 x/y pairs each, for a total of 6 elements for each Bezier). It will also populate a "totalLength" property, but that's not generally super accurate because by default it'll only take 6 samples per Bezier. But for performance reasons, it's perfectly adequate for measuring progress values along the path. If you need a more accurate totalLength, either increase the resolution or use the more advanced bezierToPoints() method which keeps adding points until they don't deviate by more than a certain precision value.

    function measureSegment(segment, startIndex, bezierQty) {
      startIndex = startIndex || 0;

      if (!segment.samples) {
        segment.samples = [];
        segment.lookup = [];
      }

      var resolution = ~~segment.resolution || 12,
          inc = 1 / resolution,
          endIndex = bezierQty ? startIndex + bezierQty * 6 + 1 : segment.length,
          x1 = segment[startIndex],
          y1 = segment[startIndex + 1],
          samplesIndex = startIndex ? startIndex / 6 * resolution : 0,
          samples = segment.samples,
          lookup = segment.lookup,
          min = (startIndex ? segment.minLength : _largeNum) || _largeNum,
          prevLength = samples[samplesIndex + bezierQty * resolution - 1],
          length = startIndex ? samples[samplesIndex - 1] : 0,
          i,
          j,
          x4,
          x3,
          x2,
          xd,
          xd1,
          y4,
          y3,
          y2,
          yd,
          yd1,
          inv,
          t,
          lengthIndex,
          l,
          segLength;
      samples.length = lookup.length = 0;

      for (j = startIndex + 2; j < endIndex; j += 6) {
        x4 = segment[j + 4] - x1;
        x3 = segment[j + 2] - x1;
        x2 = segment[j] - x1;
        y4 = segment[j + 5] - y1;
        y3 = segment[j + 3] - y1;
        y2 = segment[j + 1] - y1;
        xd = xd1 = yd = yd1 = 0;

        if (_abs(x4) < .01 && _abs(y4) < .01 && _abs(x2) + _abs(y2) < .01) {
          //dump points that are sufficiently close (basically right on top of each other, making a bezier super tiny or 0 length)
          if (segment.length > 8) {
            segment.splice(j, 6);
            j -= 6;
            endIndex -= 6;
          }
        } else {
          for (i = 1; i <= resolution; i++) {
            t = inc * i;
            inv = 1 - t;
            xd = xd1 - (xd1 = (t * t * x4 + 3 * inv * (t * x3 + inv * x2)) * t);
            yd = yd1 - (yd1 = (t * t * y4 + 3 * inv * (t * y3 + inv * y2)) * t);
            l = _sqrt(yd * yd + xd * xd);

            if (l < min) {
              min = l;
            }

            length += l;
            samples[samplesIndex++] = length;
          }
        }

        x1 += x4;
        y1 += y4;
      }

      if (prevLength) {
        prevLength -= length;

        for (; samplesIndex < samples.length; samplesIndex++) {
          samples[samplesIndex] += prevLength;
        }
      }

      if (samples.length && min) {
        segment.totalLength = segLength = samples[samples.length - 1] || 0;
        segment.minLength = min;

        if (segLength / min < 9999) {
          // if the lookup would require too many values (memory problem), we skip this and instead we use a loop to lookup values directly in the samples Array
          l = lengthIndex = 0;

          for (i = 0; i < segLength; i += min) {
            lookup[l++] = samples[lengthIndex] < i ? ++lengthIndex : lengthIndex;
          }
        }
      } else {
        segment.totalLength = samples[0] = 0;
      }

      return startIndex ? length - samples[startIndex / 2 - 1] : length;
    }

    function cacheRawPathMeasurements(rawPath, resolution) {
      var pathLength, points, i;

      for (i = pathLength = points = 0; i < rawPath.length; i++) {
        rawPath[i].resolution = ~~resolution || 12; //steps per Bezier curve (anchor, 2 control points, to anchor)

        points += rawPath[i].length;
        pathLength += measureSegment(rawPath[i]);
      }

      rawPath.totalPoints = points;
      rawPath.totalLength = pathLength;
      return rawPath;
    } //divide segment[i] at position t (value between 0 and 1, progress along that particular cubic bezier segment that starts at segment[i]). Returns how many elements were spliced into the segment array (either 0 or 6)

    function subdivideSegment(segment, i, t) {
      if (t <= 0 || t >= 1) {
        return 0;
      }

      var ax = segment[i],
          ay = segment[i + 1],
          cp1x = segment[i + 2],
          cp1y = segment[i + 3],
          cp2x = segment[i + 4],
          cp2y = segment[i + 5],
          bx = segment[i + 6],
          by = segment[i + 7],
          x1a = ax + (cp1x - ax) * t,
          x2 = cp1x + (cp2x - cp1x) * t,
          y1a = ay + (cp1y - ay) * t,
          y2 = cp1y + (cp2y - cp1y) * t,
          x1 = x1a + (x2 - x1a) * t,
          y1 = y1a + (y2 - y1a) * t,
          x2a = cp2x + (bx - cp2x) * t,
          y2a = cp2y + (by - cp2y) * t;
      x2 += (x2a - x2) * t;
      y2 += (y2a - y2) * t;
      segment.splice(i + 2, 4, _round(x1a), //first control point
      _round(y1a), _round(x1), //second control point
      _round(y1), _round(x1 + (x2 - x1) * t), //new fabricated anchor on line
      _round(y1 + (y2 - y1) * t), _round(x2), //third control point
      _round(y2), _round(x2a), //fourth control point
      _round(y2a));
      segment.samples && segment.samples.splice(i / 6 * segment.resolution | 0, 0, 0, 0, 0, 0, 0, 0);
      return 6;
    } // returns an object {path, segment, segIndex, i, t}

    function getProgressData(rawPath, progress, decoratee, pushToNextIfAtEnd) {
      decoratee = decoratee || {};
      rawPath.totalLength || cacheRawPathMeasurements(rawPath);

      if (progress < 0 || progress > 1) {
        progress = _wrapProgress(progress);
      }

      var segIndex = 0,
          segment = rawPath[0],
          samples,
          resolution,
          length,
          min,
          max,
          i,
          t;

      if (!progress) {
        t = i = segIndex = 0;
        segment = rawPath[0];
      } else if (progress === 1) {
        t = 1;
        segIndex = rawPath.length - 1;
        segment = rawPath[segIndex];
        i = segment.length - 8;
      } else {
        if (rawPath.length > 1) {
          //speed optimization: most of the time, there's only one segment so skip the recursion.
          length = rawPath.totalLength * progress;
          max = i = 0;

          while ((max += rawPath[i++].totalLength) < length) {
            segIndex = i;
          }

          segment = rawPath[segIndex];
          min = max - segment.totalLength;
          progress = (length - min) / (max - min) || 0;
        }

        samples = segment.samples;
        resolution = segment.resolution; //how many samples per cubic bezier chunk

        length = segment.totalLength * progress;
        i = segment.lookup.length ? segment.lookup[~~(length / segment.minLength)] || 0 : _getSampleIndex(samples, length, progress);
        min = i ? samples[i - 1] : 0;
        max = samples[i];

        if (max < length) {
          min = max;
          max = samples[++i];
        }

        t = 1 / resolution * ((length - min) / (max - min) + i % resolution);
        i = ~~(i / resolution) * 6;

        if (pushToNextIfAtEnd && t === 1) {
          if (i + 6 < segment.length) {
            i += 6;
            t = 0;
          } else if (segIndex + 1 < rawPath.length) {
            i = t = 0;
            segment = rawPath[++segIndex];
          }
        }
      }

      decoratee.t = t;
      decoratee.i = i;
      decoratee.path = rawPath;
      decoratee.segment = segment;
      decoratee.segIndex = segIndex;
      return decoratee;
    }

    function getPositionOnPath(rawPath, progress, includeAngle, point) {
      var segment = rawPath[0],
          result = point || {},
          samples,
          resolution,
          length,
          min,
          max,
          i,
          t,
          a,
          inv;

      if (progress < 0 || progress > 1) {
        progress = _wrapProgress(progress);
      }

      segment.lookup || cacheRawPathMeasurements(rawPath);

      if (rawPath.length > 1) {
        //speed optimization: most of the time, there's only one segment so skip the recursion.
        length = rawPath.totalLength * progress;
        max = i = 0;

        while ((max += rawPath[i++].totalLength) < length) {
          segment = rawPath[i];
        }

        min = max - segment.totalLength;
        progress = (length - min) / (max - min) || 0;
      }

      samples = segment.samples;
      resolution = segment.resolution;
      length = segment.totalLength * progress;
      i = segment.lookup.length ? segment.lookup[progress < 1 ? ~~(length / segment.minLength) : segment.lookup.length - 1] || 0 : _getSampleIndex(samples, length, progress);
      min = i ? samples[i - 1] : 0;
      max = samples[i];

      if (max < length) {
        min = max;
        max = samples[++i];
      }

      t = 1 / resolution * ((length - min) / (max - min) + i % resolution) || 0;
      inv = 1 - t;
      i = ~~(i / resolution) * 6;
      a = segment[i];
      result.x = _round((t * t * (segment[i + 6] - a) + 3 * inv * (t * (segment[i + 4] - a) + inv * (segment[i + 2] - a))) * t + a);
      result.y = _round((t * t * (segment[i + 7] - (a = segment[i + 1])) + 3 * inv * (t * (segment[i + 5] - a) + inv * (segment[i + 3] - a))) * t + a);

      if (includeAngle) {
        result.angle = segment.totalLength ? getRotationAtBezierT(segment, i, t >= 1 ? 1 - 1e-9 : t ? t : 1e-9) : segment.angle || 0;
      }

      return result;
    } //applies a matrix transform to RawPath (or a segment in a RawPath) and returns whatever was passed in (it transforms the values in the array(s), not a copy).

    function transformRawPath(rawPath, a, b, c, d, tx, ty) {
      var j = rawPath.length,
          segment,
          l,
          i,
          x,
          y;

      while (--j > -1) {
        segment = rawPath[j];
        l = segment.length;

        for (i = 0; i < l; i += 2) {
          x = segment[i];
          y = segment[i + 1];
          segment[i] = x * a + y * c + tx;
          segment[i + 1] = x * b + y * d + ty;
        }
      }

      rawPath._dirty = 1;
      return rawPath;
    } // translates SVG arc data into a segment (cubic beziers). Angle is in degrees.

    function arcToSegment(lastX, lastY, rx, ry, angle, largeArcFlag, sweepFlag, x, y) {
      if (lastX === x && lastY === y) {
        return;
      }

      rx = _abs(rx);
      ry = _abs(ry);

      var angleRad = angle % 360 * _DEG2RAD$1,
          cosAngle = _cos(angleRad),
          sinAngle = _sin(angleRad),
          PI = Math.PI,
          TWOPI = PI * 2,
          dx2 = (lastX - x) / 2,
          dy2 = (lastY - y) / 2,
          x1 = cosAngle * dx2 + sinAngle * dy2,
          y1 = -sinAngle * dx2 + cosAngle * dy2,
          x1_sq = x1 * x1,
          y1_sq = y1 * y1,
          radiiCheck = x1_sq / (rx * rx) + y1_sq / (ry * ry);

      if (radiiCheck > 1) {
        rx = _sqrt(radiiCheck) * rx;
        ry = _sqrt(radiiCheck) * ry;
      }

      var rx_sq = rx * rx,
          ry_sq = ry * ry,
          sq = (rx_sq * ry_sq - rx_sq * y1_sq - ry_sq * x1_sq) / (rx_sq * y1_sq + ry_sq * x1_sq);

      if (sq < 0) {
        sq = 0;
      }

      var coef = (largeArcFlag === sweepFlag ? -1 : 1) * _sqrt(sq),
          cx1 = coef * (rx * y1 / ry),
          cy1 = coef * -(ry * x1 / rx),
          sx2 = (lastX + x) / 2,
          sy2 = (lastY + y) / 2,
          cx = sx2 + (cosAngle * cx1 - sinAngle * cy1),
          cy = sy2 + (sinAngle * cx1 + cosAngle * cy1),
          ux = (x1 - cx1) / rx,
          uy = (y1 - cy1) / ry,
          vx = (-x1 - cx1) / rx,
          vy = (-y1 - cy1) / ry,
          temp = ux * ux + uy * uy,
          angleStart = (uy < 0 ? -1 : 1) * Math.acos(ux / _sqrt(temp)),
          angleExtent = (ux * vy - uy * vx < 0 ? -1 : 1) * Math.acos((ux * vx + uy * vy) / _sqrt(temp * (vx * vx + vy * vy)));

      isNaN(angleExtent) && (angleExtent = PI); //rare edge case. Math.cos(-1) is NaN.

      if (!sweepFlag && angleExtent > 0) {
        angleExtent -= TWOPI;
      } else if (sweepFlag && angleExtent < 0) {
        angleExtent += TWOPI;
      }

      angleStart %= TWOPI;
      angleExtent %= TWOPI;

      var segments = Math.ceil(_abs(angleExtent) / (TWOPI / 4)),
          rawPath = [],
          angleIncrement = angleExtent / segments,
          controlLength = 4 / 3 * _sin(angleIncrement / 2) / (1 + _cos(angleIncrement / 2)),
          ma = cosAngle * rx,
          mb = sinAngle * rx,
          mc = sinAngle * -ry,
          md = cosAngle * ry,
          i;

      for (i = 0; i < segments; i++) {
        angle = angleStart + i * angleIncrement;
        x1 = _cos(angle);
        y1 = _sin(angle);
        ux = _cos(angle += angleIncrement);
        uy = _sin(angle);
        rawPath.push(x1 - controlLength * y1, y1 + controlLength * x1, ux + controlLength * uy, uy - controlLength * ux, ux, uy);
      } //now transform according to the actual size of the ellipse/arc (the beziers were noramlized, between 0 and 1 on a circle).


      for (i = 0; i < rawPath.length; i += 2) {
        x1 = rawPath[i];
        y1 = rawPath[i + 1];
        rawPath[i] = x1 * ma + y1 * mc + cx;
        rawPath[i + 1] = x1 * mb + y1 * md + cy;
      }

      rawPath[i - 2] = x; //always set the end to exactly where it's supposed to be

      rawPath[i - 1] = y;
      return rawPath;
    } //Spits back a RawPath with absolute coordinates. Each segment starts with a "moveTo" command (x coordinate, then y) and then 2 control points (x, y, x, y), then anchor. The goal is to minimize memory and maximize speed.


    function stringToRawPath(d) {
      var a = (d + "").replace(_scientific, function (m) {
        var n = +m;
        return n < 0.0001 && n > -0.0001 ? 0 : n;
      }).match(_svgPathExp) || [],
          //some authoring programs spit out very small numbers in scientific notation like "1e-5", so make sure we round that down to 0 first.
      path = [],
          relativeX = 0,
          relativeY = 0,
          twoThirds = 2 / 3,
          elements = a.length,
          points = 0,
          errorMessage = "ERROR: malformed path: " + d,
          i,
          j,
          x,
          y,
          command,
          isRelative,
          segment,
          startX,
          startY,
          difX,
          difY,
          beziers,
          prevCommand,
          flag1,
          flag2,
          line = function line(sx, sy, ex, ey) {
        difX = (ex - sx) / 3;
        difY = (ey - sy) / 3;
        segment.push(sx + difX, sy + difY, ex - difX, ey - difY, ex, ey);
      };

      if (!d || !isNaN(a[0]) || isNaN(a[1])) {
        console.log(errorMessage);
        return path;
      }

      for (i = 0; i < elements; i++) {
        prevCommand = command;

        if (isNaN(a[i])) {
          command = a[i].toUpperCase();
          isRelative = command !== a[i]; //lower case means relative
        } else {
          //commands like "C" can be strung together without any new command characters between.
          i--;
        }

        x = +a[i + 1];
        y = +a[i + 2];

        if (isRelative) {
          x += relativeX;
          y += relativeY;
        }

        if (!i) {
          startX = x;
          startY = y;
        } // "M" (move)


        if (command === "M") {
          if (segment) {
            if (segment.length < 8) {
              //if the path data was funky and just had a M with no actual drawing anywhere, skip it.
              path.length -= 1;
            } else {
              points += segment.length;
            }
          }

          relativeX = startX = x;
          relativeY = startY = y;
          segment = [x, y];
          path.push(segment);
          i += 2;
          command = "L"; //an "M" with more than 2 values gets interpreted as "lineTo" commands ("L").
          // "C" (cubic bezier)
        } else if (command === "C") {
          if (!segment) {
            segment = [0, 0];
          }

          if (!isRelative) {
            relativeX = relativeY = 0;
          } //note: "*1" is just a fast/short way to cast the value as a Number. WAAAY faster in Chrome, slightly slower in Firefox.


          segment.push(x, y, relativeX + a[i + 3] * 1, relativeY + a[i + 4] * 1, relativeX += a[i + 5] * 1, relativeY += a[i + 6] * 1);
          i += 6; // "S" (continuation of cubic bezier)
        } else if (command === "S") {
          difX = relativeX;
          difY = relativeY;

          if (prevCommand === "C" || prevCommand === "S") {
            difX += relativeX - segment[segment.length - 4];
            difY += relativeY - segment[segment.length - 3];
          }

          if (!isRelative) {
            relativeX = relativeY = 0;
          }

          segment.push(difX, difY, x, y, relativeX += a[i + 3] * 1, relativeY += a[i + 4] * 1);
          i += 4; // "Q" (quadratic bezier)
        } else if (command === "Q") {
          difX = relativeX + (x - relativeX) * twoThirds;
          difY = relativeY + (y - relativeY) * twoThirds;

          if (!isRelative) {
            relativeX = relativeY = 0;
          }

          relativeX += a[i + 3] * 1;
          relativeY += a[i + 4] * 1;
          segment.push(difX, difY, relativeX + (x - relativeX) * twoThirds, relativeY + (y - relativeY) * twoThirds, relativeX, relativeY);
          i += 4; // "T" (continuation of quadratic bezier)
        } else if (command === "T") {
          difX = relativeX - segment[segment.length - 4];
          difY = relativeY - segment[segment.length - 3];
          segment.push(relativeX + difX, relativeY + difY, x + (relativeX + difX * 1.5 - x) * twoThirds, y + (relativeY + difY * 1.5 - y) * twoThirds, relativeX = x, relativeY = y);
          i += 2; // "H" (horizontal line)
        } else if (command === "H") {
          line(relativeX, relativeY, relativeX = x, relativeY);
          i += 1; // "V" (vertical line)
        } else if (command === "V") {
          //adjust values because the first (and only one) isn't x in this case, it's y.
          line(relativeX, relativeY, relativeX, relativeY = x + (isRelative ? relativeY - relativeX : 0));
          i += 1; // "L" (line) or "Z" (close)
        } else if (command === "L" || command === "Z") {
          if (command === "Z") {
            x = startX;
            y = startY;
            segment.closed = true;
          }

          if (command === "L" || _abs(relativeX - x) > 0.5 || _abs(relativeY - y) > 0.5) {
            line(relativeX, relativeY, x, y);

            if (command === "L") {
              i += 2;
            }
          }

          relativeX = x;
          relativeY = y; // "A" (arc)
        } else if (command === "A") {
          flag1 = a[i + 4];
          flag2 = a[i + 5];
          difX = a[i + 6];
          difY = a[i + 7];
          j = 7;

          if (flag1.length > 1) {
            // for cases when the flags are merged, like "a8 8 0 018 8" (the 0 and 1 flags are WITH the x value of 8, but it could also be "a8 8 0 01-8 8" so it may include x or not)
            if (flag1.length < 3) {
              difY = difX;
              difX = flag2;
              j--;
            } else {
              difY = flag2;
              difX = flag1.substr(2);
              j -= 2;
            }

            flag2 = flag1.charAt(1);
            flag1 = flag1.charAt(0);
          }

          beziers = arcToSegment(relativeX, relativeY, +a[i + 1], +a[i + 2], +a[i + 3], +flag1, +flag2, (isRelative ? relativeX : 0) + difX * 1, (isRelative ? relativeY : 0) + difY * 1);
          i += j;

          if (beziers) {
            for (j = 0; j < beziers.length; j++) {
              segment.push(beziers[j]);
            }
          }

          relativeX = segment[segment.length - 2];
          relativeY = segment[segment.length - 1];
        } else {
          console.log(errorMessage);
        }
      }

      i = segment.length;

      if (i < 6) {
        //in case there's odd SVG like a M0,0 command at the very end.
        path.pop();
        i = 0;
      } else if (segment[0] === segment[i - 2] && segment[1] === segment[i - 1]) {
        segment.closed = true;
      }

      path.totalPoints = points + i;
      return path;
    } //populates the points array in alternating x/y values (like [x, y, x, y...] instead of individual point objects [{x, y}, {x, y}...] to conserve memory and stay in line with how we're handling segment arrays
    /*
    function getAngleBetweenPoints(x0, y0, x1, y1, x2, y2) { //angle between 3 points in radians
    	var dx1 = x1 - x0,
    		dy1 = y1 - y0,
    		dx2 = x2 - x1,
    		dy2 = y2 - y1,
    		dx3 = x2 - x0,
    		dy3 = y2 - y0,
    		a = dx1 * dx1 + dy1 * dy1,
    		b = dx2 * dx2 + dy2 * dy2,
    		c = dx3 * dx3 + dy3 * dy3;
    	return Math.acos( (a + b - c) / _sqrt(4 * a * b) );
    },
    */
    //pointsToSegment() doesn't handle flat coordinates (where y is always 0) the way we need (the resulting control points are always right on top of the anchors), so this function basically makes the control points go directly up and down, varying in length based on the curviness (more curvy, further control points)

    function flatPointsToSegment(points, curviness) {
      if (curviness === void 0) {
        curviness = 1;
      }

      var x = points[0],
          y = 0,
          segment = [x, y],
          i = 2;

      for (; i < points.length; i += 2) {
        segment.push(x, y, points[i], y = (points[i] - x) * curviness / 2, x = points[i], -y);
      }

      return segment;
    } //points is an array of x/y points, like [x, y, x, y, x, y]

    function pointsToSegment(points, curviness) {
      //points = simplifyPoints(points, tolerance);
      _abs(points[0] - points[2]) < 1e-4 && _abs(points[1] - points[3]) < 1e-4 && (points = points.slice(2)); // if the first two points are super close, dump the first one.

      var l = points.length - 2,
          x = +points[0],
          y = +points[1],
          nextX = +points[2],
          nextY = +points[3],
          segment = [x, y, x, y],
          dx2 = nextX - x,
          dy2 = nextY - y,
          closed = Math.abs(points[l] - x) < 0.001 && Math.abs(points[l + 1] - y) < 0.001,
          prevX,
          prevY,
          i,
          dx1,
          dy1,
          r1,
          r2,
          r3,
          tl,
          mx1,
          mx2,
          mxm,
          my1,
          my2,
          mym;

      if (closed) {
        // if the start and end points are basically on top of each other, close the segment by adding the 2nd point to the end, and the 2nd-to-last point to the beginning (we'll remove them at the end, but this allows the curvature to look perfect)
        points.push(nextX, nextY);
        nextX = x;
        nextY = y;
        x = points[l - 2];
        y = points[l - 1];
        points.unshift(x, y);
        l += 4;
      }

      curviness = curviness || curviness === 0 ? +curviness : 1;

      for (i = 2; i < l; i += 2) {
        prevX = x;
        prevY = y;
        x = nextX;
        y = nextY;
        nextX = +points[i + 2];
        nextY = +points[i + 3];

        if (x === nextX && y === nextY) {
          continue;
        }

        dx1 = dx2;
        dy1 = dy2;
        dx2 = nextX - x;
        dy2 = nextY - y;
        r1 = _sqrt(dx1 * dx1 + dy1 * dy1); // r1, r2, and r3 correlate x and y (and z in the future). Basically 2D or 3D hypotenuse

        r2 = _sqrt(dx2 * dx2 + dy2 * dy2);
        r3 = _sqrt(Math.pow(dx2 / r2 + dx1 / r1, 2) + Math.pow(dy2 / r2 + dy1 / r1, 2));
        tl = (r1 + r2) * curviness * 0.25 / r3;
        mx1 = x - (x - prevX) * (r1 ? tl / r1 : 0);
        mx2 = x + (nextX - x) * (r2 ? tl / r2 : 0);
        mxm = x - (mx1 + ((mx2 - mx1) * (r1 * 3 / (r1 + r2) + 0.5) / 4 || 0));
        my1 = y - (y - prevY) * (r1 ? tl / r1 : 0);
        my2 = y + (nextY - y) * (r2 ? tl / r2 : 0);
        mym = y - (my1 + ((my2 - my1) * (r1 * 3 / (r1 + r2) + 0.5) / 4 || 0));

        if (x !== prevX || y !== prevY) {
          segment.push(_round(mx1 + mxm), // first control point
          _round(my1 + mym), _round(x), // anchor
          _round(y), _round(mx2 + mxm), // second control point
          _round(my2 + mym));
        }
      }

      x !== nextX || y !== nextY || segment.length < 4 ? segment.push(_round(nextX), _round(nextY), _round(nextX), _round(nextY)) : segment.length -= 2;

      if (segment.length === 2) {
        // only one point!
        segment.push(x, y, x, y, x, y);
      } else if (closed) {
        segment.splice(0, 6);
        segment.length = segment.length - 6;
      }

      return segment;
    } //returns the squared distance between an x/y coordinate and a segment between x1/y1 and x2/y2
    /*
    Takes any of the following and converts it to an all Cubic Bezier SVG data string:
    - A <path> data string like "M0,0 L2,4 v20,15 H100"
    - A RawPath, like [[x, y, x, y, x, y, x, y][[x, y, x, y, x, y, x, y]]
    - A Segment, like [x, y, x, y, x, y, x, y]

    Note: all numbers are rounded down to the closest 0.001 to minimize memory, maximize speed, and avoid odd numbers like 1e-13
    */

    function rawPathToString(rawPath) {
      if (_isNumber(rawPath[0])) {
        //in case a segment is passed in instead
        rawPath = [rawPath];
      }

      var result = "",
          l = rawPath.length,
          sl,
          s,
          i,
          segment;

      for (s = 0; s < l; s++) {
        segment = rawPath[s];
        result += "M" + _round(segment[0]) + "," + _round(segment[1]) + " C";
        sl = segment.length;

        for (i = 2; i < sl; i++) {
          result += _round(segment[i++]) + "," + _round(segment[i++]) + " " + _round(segment[i++]) + "," + _round(segment[i++]) + " " + _round(segment[i++]) + "," + _round(segment[i]) + " ";
        }

        if (segment.closed) {
          result += "z";
        }
      }

      return result;
    }
    /*
    // takes a segment with coordinates [x, y, x, y, ...] and converts the control points into angles and lengths [x, y, angle, length, angle, length, x, y, angle, length, ...] so that it animates more cleanly and avoids odd breaks/kinks. For example, if you animate from 1 o'clock to 6 o'clock, it'd just go directly/linearly rather than around. So the length would be very short in the middle of the tween.
    export function cpCoordsToAngles(segment, copy) {
    	var result = copy ? segment.slice(0) : segment,
    		x, y, i;
    	for (i = 0; i < segment.length; i+=6) {
    		x = segment[i+2] - segment[i];
    		y = segment[i+3] - segment[i+1];
    		result[i+2] = Math.atan2(y, x);
    		result[i+3] = Math.sqrt(x * x + y * y);
    		x = segment[i+6] - segment[i+4];
    		y = segment[i+7] - segment[i+5];
    		result[i+4] = Math.atan2(y, x);
    		result[i+5] = Math.sqrt(x * x + y * y);
    	}
    	return result;
    }

    // takes a segment that was converted with cpCoordsToAngles() to have angles and lengths instead of coordinates for the control points, and converts it BACK into coordinates.
    export function cpAnglesToCoords(segment, copy) {
    	var result = copy ? segment.slice(0) : segment,
    		length = segment.length,
    		rnd = 1000,
    		angle, l, i, j;
    	for (i = 0; i < length; i+=6) {
    		angle = segment[i+2];
    		l = segment[i+3]; //length
    		result[i+2] = (((segment[i] + Math.cos(angle) * l) * rnd) | 0) / rnd;
    		result[i+3] = (((segment[i+1] + Math.sin(angle) * l) * rnd) | 0) / rnd;
    		angle = segment[i+4];
    		l = segment[i+5]; //length
    		result[i+4] = (((segment[i+6] - Math.cos(angle) * l) * rnd) | 0) / rnd;
    		result[i+5] = (((segment[i+7] - Math.sin(angle) * l) * rnd) | 0) / rnd;
    	}
    	return result;
    }

    //adds an "isSmooth" array to each segment and populates it with a boolean value indicating whether or not it's smooth (the control points have basically the same slope). For any smooth control points, it converts the coordinates into angle (x, in radians) and length (y) and puts them into the same index value in a smoothData array.
    export function populateSmoothData(rawPath) {
    	let j = rawPath.length,
    		smooth, segment, x, y, x2, y2, i, l, a, a2, isSmooth, smoothData;
    	while (--j > -1) {
    		segment = rawPath[j];
    		isSmooth = segment.isSmooth = segment.isSmooth || [0, 0, 0, 0];
    		smoothData = segment.smoothData = segment.smoothData || [0, 0, 0, 0];
    		isSmooth.length = 4;
    		l = segment.length - 2;
    		for (i = 6; i < l; i += 6) {
    			x = segment[i] - segment[i - 2];
    			y = segment[i + 1] - segment[i - 1];
    			x2 = segment[i + 2] - segment[i];
    			y2 = segment[i + 3] - segment[i + 1];
    			a = _atan2(y, x);
    			a2 = _atan2(y2, x2);
    			smooth = (Math.abs(a - a2) < 0.09);
    			if (smooth) {
    				smoothData[i - 2] = a;
    				smoothData[i + 2] = a2;
    				smoothData[i - 1] = _sqrt(x * x + y * y);
    				smoothData[i + 3] = _sqrt(x2 * x2 + y2 * y2);
    			}
    			isSmooth.push(smooth, smooth, 0, 0, smooth, smooth);
    		}
    		//if the first and last points are identical, check to see if there's a smooth transition. We must handle this a bit differently due to their positions in the array.
    		if (segment[l] === segment[0] && segment[l+1] === segment[1]) {
    			x = segment[0] - segment[l-2];
    			y = segment[1] - segment[l-1];
    			x2 = segment[2] - segment[0];
    			y2 = segment[3] - segment[1];
    			a = _atan2(y, x);
    			a2 = _atan2(y2, x2);
    			if (Math.abs(a - a2) < 0.09) {
    				smoothData[l-2] = a;
    				smoothData[2] = a2;
    				smoothData[l-1] = _sqrt(x * x + y * y);
    				smoothData[3] = _sqrt(x2 * x2 + y2 * y2);
    				isSmooth[l-2] = isSmooth[l-1] = true; //don't change indexes 2 and 3 because we'll trigger everything from the END, and this will optimize file size a bit.
    			}
    		}
    	}
    	return rawPath;
    }
    export function pointToScreen(svgElement, point) {
    	if (arguments.length < 2) { //by default, take the first set of coordinates in the path as the point
    		let rawPath = getRawPath(svgElement);
    		point = svgElement.ownerSVGElement.createSVGPoint();
    		point.x = rawPath[0][0];
    		point.y = rawPath[0][1];
    	}
    	return point.matrixTransform(svgElement.getScreenCTM());
    }

    */

    /*!
     * matrix 3.12.5
     * https://gsap.com
     *
     * Copyright 2008-2024, GreenSock. All rights reserved.
     * Subject to the terms at https://gsap.com/standard-license or for
     * Club GSAP members, the agreement issued with that membership.
     * @author: Jack Doyle, jack@greensock.com
    */

    /* eslint-disable */
    var _doc,
        _win,
        _docElement,
        _body,
        _divContainer,
        _svgContainer,
        _identityMatrix,
        _gEl,
        _transformProp = "transform",
        _transformOriginProp = _transformProp + "Origin",
        _hasOffsetBug,
        _setDoc = function _setDoc(element) {
      var doc = element.ownerDocument || element;

      if (!(_transformProp in element.style) && "msTransform" in element.style) {
        //to improve compatibility with old Microsoft browsers
        _transformProp = "msTransform";
        _transformOriginProp = _transformProp + "Origin";
      }

      while (doc.parentNode && (doc = doc.parentNode)) {}

      _win = window;
      _identityMatrix = new Matrix2D();

      if (doc) {
        _doc = doc;
        _docElement = doc.documentElement;
        _body = doc.body;
        _gEl = _doc.createElementNS("http://www.w3.org/2000/svg", "g"); // prevent any existing CSS from transforming it

        _gEl.style.transform = "none"; // now test for the offset reporting bug. Use feature detection instead of browser sniffing to make things more bulletproof and future-proof. Hopefully Safari will fix their bug soon.

        var d1 = doc.createElement("div"),
            d2 = doc.createElement("div"),
            root = doc && (doc.body || doc.firstElementChild);

        if (root && root.appendChild) {
          root.appendChild(d1);
          d1.appendChild(d2);
          d1.setAttribute("style", "position:static;transform:translate3d(0,0,1px)");
          _hasOffsetBug = d2.offsetParent !== d1;
          root.removeChild(d1);
        }
      }

      return doc;
    },
        _forceNonZeroScale = function _forceNonZeroScale(e) {
      // walks up the element's ancestors and finds any that had their scale set to 0 via GSAP, and changes them to 0.0001 to ensure that measurements work. Firefox has a bug that causes it to incorrectly report getBoundingClientRect() when scale is 0.
      var a, cache;

      while (e && e !== _body) {
        cache = e._gsap;
        cache && cache.uncache && cache.get(e, "x"); // force re-parsing of transforms if necessary

        if (cache && !cache.scaleX && !cache.scaleY && cache.renderTransform) {
          cache.scaleX = cache.scaleY = 1e-4;
          cache.renderTransform(1, cache);
          a ? a.push(cache) : a = [cache];
        }

        e = e.parentNode;
      }

      return a;
    },
        // possible future addition: pass an element to _forceDisplay() and it'll walk up all its ancestors and make sure anything with display: none is set to display: block, and if there's no parentNode, it'll add it to the body. It returns an Array that you can then feed to _revertDisplay() to have it revert all the changes it made.
    // _forceDisplay = e => {
    // 	let a = [],
    // 		parent;
    // 	while (e && e !== _body) {
    // 		parent = e.parentNode;
    // 		(_win.getComputedStyle(e).display === "none" || !parent) && a.push(e, e.style.display, parent) && (e.style.display = "block");
    // 		parent || _body.appendChild(e);
    // 		e = parent;
    // 	}
    // 	return a;
    // },
    // _revertDisplay = a => {
    // 	for (let i = 0; i < a.length; i+=3) {
    // 		a[i+1] ? (a[i].style.display = a[i+1]) : a[i].style.removeProperty("display");
    // 		a[i+2] || a[i].parentNode.removeChild(a[i]);
    // 	}
    // },
    _svgTemps = [],
        //we create 3 elements for SVG, and 3 for other DOM elements and cache them for performance reasons. They get nested in _divContainer and _svgContainer so that just one element is added to the DOM on each successive attempt. Again, performance is key.
    _divTemps = [],
        _getDocScrollTop = function _getDocScrollTop() {
      return _win.pageYOffset || _doc.scrollTop || _docElement.scrollTop || _body.scrollTop || 0;
    },
        _getDocScrollLeft = function _getDocScrollLeft() {
      return _win.pageXOffset || _doc.scrollLeft || _docElement.scrollLeft || _body.scrollLeft || 0;
    },
        _svgOwner = function _svgOwner(element) {
      return element.ownerSVGElement || ((element.tagName + "").toLowerCase() === "svg" ? element : null);
    },
        _isFixed = function _isFixed(element) {
      if (_win.getComputedStyle(element).position === "fixed") {
        return true;
      }

      element = element.parentNode;

      if (element && element.nodeType === 1) {
        // avoid document fragments which will throw an error.
        return _isFixed(element);
      }
    },
        _createSibling = function _createSibling(element, i) {
      if (element.parentNode && (_doc || _setDoc(element))) {
        var svg = _svgOwner(element),
            ns = svg ? svg.getAttribute("xmlns") || "http://www.w3.org/2000/svg" : "http://www.w3.org/1999/xhtml",
            type = svg ? i ? "rect" : "g" : "div",
            x = i !== 2 ? 0 : 100,
            y = i === 3 ? 100 : 0,
            css = "position:absolute;display:block;pointer-events:none;margin:0;padding:0;",
            e = _doc.createElementNS ? _doc.createElementNS(ns.replace(/^https/, "http"), type) : _doc.createElement(type);

        if (i) {
          if (!svg) {
            if (!_divContainer) {
              _divContainer = _createSibling(element);
              _divContainer.style.cssText = css;
            }

            e.style.cssText = css + "width:0.1px;height:0.1px;top:" + y + "px;left:" + x + "px";

            _divContainer.appendChild(e);
          } else {
            _svgContainer || (_svgContainer = _createSibling(element));
            e.setAttribute("width", 0.01);
            e.setAttribute("height", 0.01);
            e.setAttribute("transform", "translate(" + x + "," + y + ")");

            _svgContainer.appendChild(e);
          }
        }

        return e;
      }

      throw "Need document and parent.";
    },
        _consolidate = function _consolidate(m) {
      // replaces SVGTransformList.consolidate() because a bug in Firefox causes it to break pointer events. See https://gsap.com/forums/topic/23248-touch-is-not-working-on-draggable-in-firefox-windows-v324/?tab=comments#comment-109800
      var c = new Matrix2D(),
          i = 0;

      for (; i < m.numberOfItems; i++) {
        c.multiply(m.getItem(i).matrix);
      }

      return c;
    },
        _getCTM = function _getCTM(svg) {
      var m = svg.getCTM(),
          transform;

      if (!m) {
        // Firefox returns null for getCTM() on root <svg> elements, so this is a workaround using a <g> that we temporarily append.
        transform = svg.style[_transformProp];
        svg.style[_transformProp] = "none"; // a bug in Firefox causes css transforms to contaminate the getCTM()

        svg.appendChild(_gEl);
        m = _gEl.getCTM();
        svg.removeChild(_gEl);
        transform ? svg.style[_transformProp] = transform : svg.style.removeProperty(_transformProp.replace(/([A-Z])/g, "-$1").toLowerCase());
      }

      return m || _identityMatrix.clone(); // Firefox will still return null if the <svg> has a width/height of 0 in the browser.
    },
        _placeSiblings = function _placeSiblings(element, adjustGOffset) {
      var svg = _svgOwner(element),
          isRootSVG = element === svg,
          siblings = svg ? _svgTemps : _divTemps,
          parent = element.parentNode,
          container,
          m,
          b,
          x,
          y,
          cs;

      if (element === _win) {
        return element;
      }

      siblings.length || siblings.push(_createSibling(element, 1), _createSibling(element, 2), _createSibling(element, 3));
      container = svg ? _svgContainer : _divContainer;

      if (svg) {
        if (isRootSVG) {
          b = _getCTM(element);
          x = -b.e / b.a;
          y = -b.f / b.d;
          m = _identityMatrix;
        } else if (element.getBBox) {
          b = element.getBBox();
          m = element.transform ? element.transform.baseVal : {}; // IE11 doesn't follow the spec.

          m = !m.numberOfItems ? _identityMatrix : m.numberOfItems > 1 ? _consolidate(m) : m.getItem(0).matrix; // don't call m.consolidate().matrix because a bug in Firefox makes pointer events not work when consolidate() is called on the same tick as getBoundingClientRect()! See https://gsap.com/forums/topic/23248-touch-is-not-working-on-draggable-in-firefox-windows-v324/?tab=comments#comment-109800

          x = m.a * b.x + m.c * b.y;
          y = m.b * b.x + m.d * b.y;
        } else {
          // may be a <mask> which has no getBBox() so just use defaults instead of throwing errors.
          m = new Matrix2D();
          x = y = 0;
        }

        if (adjustGOffset && element.tagName.toLowerCase() === "g") {
          x = y = 0;
        }

        (isRootSVG ? svg : parent).appendChild(container);
        container.setAttribute("transform", "matrix(" + m.a + "," + m.b + "," + m.c + "," + m.d + "," + (m.e + x) + "," + (m.f + y) + ")");
      } else {
        x = y = 0;

        if (_hasOffsetBug) {
          // some browsers (like Safari) have a bug that causes them to misreport offset values. When an ancestor element has a transform applied, it's supposed to treat it as if it's position: relative (new context). Safari botches this, so we need to find the closest ancestor (between the element and its offsetParent) that has a transform applied and if one is found, grab its offsetTop/Left and subtract them to compensate.
          m = element.offsetParent;
          b = element;

          while (b && (b = b.parentNode) && b !== m && b.parentNode) {
            if ((_win.getComputedStyle(b)[_transformProp] + "").length > 4) {
              x = b.offsetLeft;
              y = b.offsetTop;
              b = 0;
            }
          }
        }

        cs = _win.getComputedStyle(element);

        if (cs.position !== "absolute" && cs.position !== "fixed") {
          m = element.offsetParent;

          while (parent && parent !== m) {
            // if there's an ancestor element between the element and its offsetParent that's scrolled, we must factor that in.
            x += parent.scrollLeft || 0;
            y += parent.scrollTop || 0;
            parent = parent.parentNode;
          }
        }

        b = container.style;
        b.top = element.offsetTop - y + "px";
        b.left = element.offsetLeft - x + "px";
        b[_transformProp] = cs[_transformProp];
        b[_transformOriginProp] = cs[_transformOriginProp]; // b.border = m.border;
        // b.borderLeftStyle = m.borderLeftStyle;
        // b.borderTopStyle = m.borderTopStyle;
        // b.borderLeftWidth = m.borderLeftWidth;
        // b.borderTopWidth = m.borderTopWidth;

        b.position = cs.position === "fixed" ? "fixed" : "absolute";
        element.parentNode.appendChild(container);
      }

      return container;
    },
        _setMatrix = function _setMatrix(m, a, b, c, d, e, f) {
      m.a = a;
      m.b = b;
      m.c = c;
      m.d = d;
      m.e = e;
      m.f = f;
      return m;
    };

    var Matrix2D = /*#__PURE__*/function () {
      function Matrix2D(a, b, c, d, e, f) {
        if (a === void 0) {
          a = 1;
        }

        if (b === void 0) {
          b = 0;
        }

        if (c === void 0) {
          c = 0;
        }

        if (d === void 0) {
          d = 1;
        }

        if (e === void 0) {
          e = 0;
        }

        if (f === void 0) {
          f = 0;
        }

        _setMatrix(this, a, b, c, d, e, f);
      }

      var _proto = Matrix2D.prototype;

      _proto.inverse = function inverse() {
        var a = this.a,
            b = this.b,
            c = this.c,
            d = this.d,
            e = this.e,
            f = this.f,
            determinant = a * d - b * c || 1e-10;
        return _setMatrix(this, d / determinant, -b / determinant, -c / determinant, a / determinant, (c * f - d * e) / determinant, -(a * f - b * e) / determinant);
      };

      _proto.multiply = function multiply(matrix) {
        var a = this.a,
            b = this.b,
            c = this.c,
            d = this.d,
            e = this.e,
            f = this.f,
            a2 = matrix.a,
            b2 = matrix.c,
            c2 = matrix.b,
            d2 = matrix.d,
            e2 = matrix.e,
            f2 = matrix.f;
        return _setMatrix(this, a2 * a + c2 * c, a2 * b + c2 * d, b2 * a + d2 * c, b2 * b + d2 * d, e + e2 * a + f2 * c, f + e2 * b + f2 * d);
      };

      _proto.clone = function clone() {
        return new Matrix2D(this.a, this.b, this.c, this.d, this.e, this.f);
      };

      _proto.equals = function equals(matrix) {
        var a = this.a,
            b = this.b,
            c = this.c,
            d = this.d,
            e = this.e,
            f = this.f;
        return a === matrix.a && b === matrix.b && c === matrix.c && d === matrix.d && e === matrix.e && f === matrix.f;
      };

      _proto.apply = function apply(point, decoratee) {
        if (decoratee === void 0) {
          decoratee = {};
        }

        var x = point.x,
            y = point.y,
            a = this.a,
            b = this.b,
            c = this.c,
            d = this.d,
            e = this.e,
            f = this.f;
        decoratee.x = x * a + y * c + e || 0;
        decoratee.y = x * b + y * d + f || 0;
        return decoratee;
      };

      return Matrix2D;
    }(); // Feed in an element and it'll return a 2D matrix (optionally inverted) so that you can translate between coordinate spaces.
    // Inverting lets you translate a global point into a local coordinate space. No inverting lets you go the other way.
    // We needed this to work around various browser bugs, like Firefox doesn't accurately report getScreenCTM() when there
    // are transforms applied to ancestor elements.
    // The matrix math to convert any x/y coordinate is as follows, which is wrapped in a convenient apply() method of Matrix2D above:
    //     tx = m.a * x + m.c * y + m.e
    //     ty = m.b * x + m.d * y + m.f

    function getGlobalMatrix(element, inverse, adjustGOffset, includeScrollInFixed) {
      // adjustGOffset is typically used only when grabbing an element's PARENT's global matrix, and it ignores the x/y offset of any SVG <g> elements because they behave in a special way.
      if (!element || !element.parentNode || (_doc || _setDoc(element)).documentElement === element) {
        return new Matrix2D();
      }

      var zeroScales = _forceNonZeroScale(element),
          svg = _svgOwner(element),
          temps = svg ? _svgTemps : _divTemps,
          container = _placeSiblings(element, adjustGOffset),
          b1 = temps[0].getBoundingClientRect(),
          b2 = temps[1].getBoundingClientRect(),
          b3 = temps[2].getBoundingClientRect(),
          parent = container.parentNode,
          isFixed = !includeScrollInFixed && _isFixed(element),
          m = new Matrix2D((b2.left - b1.left) / 100, (b2.top - b1.top) / 100, (b3.left - b1.left) / 100, (b3.top - b1.top) / 100, b1.left + (isFixed ? 0 : _getDocScrollLeft()), b1.top + (isFixed ? 0 : _getDocScrollTop()));

      parent.removeChild(container);

      if (zeroScales) {
        b1 = zeroScales.length;

        while (b1--) {
          b2 = zeroScales[b1];
          b2.scaleX = b2.scaleY = 0;
          b2.renderTransform(1, b2);
        }
      }

      return inverse ? m.inverse() : m;
    }
    // 	_doc || _setDoc(element);
    // 	let m = (_win.getComputedStyle(element)[_transformProp] + "").substr(7).match(/[-.]*\d+[.e\-+]*\d*[e\-\+]*\d*/g),
    // 		is2D = m && m.length === 6;
    // 	return !m || m.length < 6 ? new Matrix2D() : new Matrix2D(+m[0], +m[1], +m[is2D ? 2 : 4], +m[is2D ? 3 : 5], +m[is2D ? 4 : 12], +m[is2D ? 5 : 13]);
    // }

    /*!
     * MotionPathPlugin 3.12.5
     * https://gsap.com
     *
     * @license Copyright 2008-2024, GreenSock. All rights reserved.
     * Subject to the terms at https://gsap.com/standard-license or for
     * Club GSAP members, the agreement issued with that membership.
     * @author: Jack Doyle, jack@greensock.com
    */

    var _xProps = "x,translateX,left,marginLeft,xPercent".split(","),
        _yProps = "y,translateY,top,marginTop,yPercent".split(","),
        _DEG2RAD = Math.PI / 180,
        gsap,
        PropTween,
        _getUnit,
        _toArray,
        _getStyleSaver,
        _reverting,
        _getGSAP = function _getGSAP() {
      return gsap || typeof window !== "undefined" && (gsap = window.gsap) && gsap.registerPlugin && gsap;
    },
        _populateSegmentFromArray = function _populateSegmentFromArray(segment, values, property, mode) {
      //mode: 0 = x but don't fill y yet, 1 = y, 2 = x and fill y with 0.
      var l = values.length,
          si = mode === 2 ? 0 : mode,
          i = 0;

      for (; i < l; i++) {
        segment[si] = parseFloat(values[i][property]);
        mode === 2 && (segment[si + 1] = 0);
        si += 2;
      }

      return segment;
    },
        _getPropNum = function _getPropNum(target, prop, unit) {
      return parseFloat(target._gsap.get(target, prop, unit || "px")) || 0;
    },
        _relativize = function _relativize(segment) {
      var x = segment[0],
          y = segment[1],
          i;

      for (i = 2; i < segment.length; i += 2) {
        x = segment[i] += x;
        y = segment[i + 1] += y;
      }
    },
        // feed in an array of quadratic bezier points like [{x: 0, y: 0}, ...] and it'll convert it to cubic bezier
    // _quadToCubic = points => {
    // 	let cubic = [],
    // 		l = points.length - 1,
    // 		i = 1,
    // 		a, b, c;
    // 	for (; i < l; i+=2) {
    // 		a = points[i-1];
    // 		b = points[i];
    // 		c = points[i+1];
    // 		cubic.push(a, {x: (2 * b.x + a.x) / 3, y: (2 * b.y + a.y) / 3}, {x: (2 * b.x + c.x) / 3, y: (2 * b.y + c.y) / 3});
    // 	}
    // 	cubic.push(points[l]);
    // 	return cubic;
    // },
    _segmentToRawPath = function _segmentToRawPath(plugin, segment, target, x, y, slicer, vars, unitX, unitY) {
      if (vars.type === "cubic") {
        segment = [segment];
      } else {
        vars.fromCurrent !== false && segment.unshift(_getPropNum(target, x, unitX), y ? _getPropNum(target, y, unitY) : 0);
        vars.relative && _relativize(segment);
        var pointFunc = y ? pointsToSegment : flatPointsToSegment;
        segment = [pointFunc(segment, vars.curviness)];
      }

      segment = slicer(_align(segment, target, vars));

      _addDimensionalPropTween(plugin, target, x, segment, "x", unitX);

      y && _addDimensionalPropTween(plugin, target, y, segment, "y", unitY);
      return cacheRawPathMeasurements(segment, vars.resolution || (vars.curviness === 0 ? 20 : 12)); //when curviness is 0, it creates control points right on top of the anchors which makes it more sensitive to resolution, thus we change the default accordingly.
    },
        _emptyFunc = function _emptyFunc(v) {
      return v;
    },
        _numExp = /[-+\.]*\d+\.?(?:e-|e\+)?\d*/g,
        _originToPoint = function _originToPoint(element, origin, parentMatrix) {
      // origin is an array of normalized values (0-1) in relation to the width/height, so [0.5, 0.5] would be the center. It can also be "auto" in which case it will be the top left unless it's a <path>, when it will start at the beginning of the path itself.
      var m = getGlobalMatrix(element),
          x = 0,
          y = 0,
          svg;

      if ((element.tagName + "").toLowerCase() === "svg") {
        svg = element.viewBox.baseVal;
        svg.width || (svg = {
          width: +element.getAttribute("width"),
          height: +element.getAttribute("height")
        });
      } else {
        svg = origin && element.getBBox && element.getBBox();
      }

      if (origin && origin !== "auto") {
        x = origin.push ? origin[0] * (svg ? svg.width : element.offsetWidth || 0) : origin.x;
        y = origin.push ? origin[1] * (svg ? svg.height : element.offsetHeight || 0) : origin.y;
      }

      return parentMatrix.apply(x || y ? m.apply({
        x: x,
        y: y
      }) : {
        x: m.e,
        y: m.f
      });
    },
        _getAlignMatrix = function _getAlignMatrix(fromElement, toElement, fromOrigin, toOrigin) {
      var parentMatrix = getGlobalMatrix(fromElement.parentNode, true, true),
          m = parentMatrix.clone().multiply(getGlobalMatrix(toElement)),
          fromPoint = _originToPoint(fromElement, fromOrigin, parentMatrix),
          _originToPoint2 = _originToPoint(toElement, toOrigin, parentMatrix),
          x = _originToPoint2.x,
          y = _originToPoint2.y,
          p;

      m.e = m.f = 0;

      if (toOrigin === "auto" && toElement.getTotalLength && toElement.tagName.toLowerCase() === "path") {
        p = toElement.getAttribute("d").match(_numExp) || [];
        p = m.apply({
          x: +p[0],
          y: +p[1]
        });
        x += p.x;
        y += p.y;
      } //if (p || (toElement.getBBox && fromElement.getBBox && toElement.ownerSVGElement === fromElement.ownerSVGElement)) {


      if (p) {
        p = m.apply(toElement.getBBox());
        x -= p.x;
        y -= p.y;
      }

      m.e = x - fromPoint.x;
      m.f = y - fromPoint.y;
      return m;
    },
        _align = function _align(rawPath, target, _ref) {
      var align = _ref.align,
          matrix = _ref.matrix,
          offsetX = _ref.offsetX,
          offsetY = _ref.offsetY,
          alignOrigin = _ref.alignOrigin;

      var x = rawPath[0][0],
          y = rawPath[0][1],
          curX = _getPropNum(target, "x"),
          curY = _getPropNum(target, "y"),
          alignTarget,
          m,
          p;

      if (!rawPath || !rawPath.length) {
        return getRawPath("M0,0L0,0");
      }

      if (align) {
        if (align === "self" || (alignTarget = _toArray(align)[0] || target) === target) {
          transformRawPath(rawPath, 1, 0, 0, 1, curX - x, curY - y);
        } else {
          if (alignOrigin && alignOrigin[2] !== false) {
            gsap.set(target, {
              transformOrigin: alignOrigin[0] * 100 + "% " + alignOrigin[1] * 100 + "%"
            });
          } else {
            alignOrigin = [_getPropNum(target, "xPercent") / -100, _getPropNum(target, "yPercent") / -100];
          }

          m = _getAlignMatrix(target, alignTarget, alignOrigin, "auto");
          p = m.apply({
            x: x,
            y: y
          });
          transformRawPath(rawPath, m.a, m.b, m.c, m.d, curX + m.e - (p.x - m.e), curY + m.f - (p.y - m.f));
        }
      }

      if (matrix) {
        transformRawPath(rawPath, matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
      } else if (offsetX || offsetY) {
        transformRawPath(rawPath, 1, 0, 0, 1, offsetX || 0, offsetY || 0);
      }

      return rawPath;
    },
        _addDimensionalPropTween = function _addDimensionalPropTween(plugin, target, property, rawPath, pathProperty, forceUnit) {
      var cache = target._gsap,
          harness = cache.harness,
          alias = harness && harness.aliases && harness.aliases[property],
          prop = alias && alias.indexOf(",") < 0 ? alias : property,
          pt = plugin._pt = new PropTween(plugin._pt, target, prop, 0, 0, _emptyFunc, 0, cache.set(target, prop, plugin));
      pt.u = _getUnit(cache.get(target, prop, forceUnit)) || 0;
      pt.path = rawPath;
      pt.pp = pathProperty;

      plugin._props.push(prop);
    },
        _sliceModifier = function _sliceModifier(start, end) {
      return function (rawPath) {
        return start || end !== 1 ? sliceRawPath(rawPath, start, end) : rawPath;
      };
    };

    var MotionPathPlugin = {
      version: "3.12.5",
      name: "motionPath",
      register: function register(core, Plugin, propTween) {
        gsap = core;
        _getUnit = gsap.utils.getUnit;
        _toArray = gsap.utils.toArray;
        _getStyleSaver = gsap.core.getStyleSaver;

        _reverting = gsap.core.reverting || function () {};

        PropTween = propTween;
      },
      init: function init(target, vars, tween) {
        if (!gsap) {
          console.warn("Please gsap.registerPlugin(MotionPathPlugin)");
          return false;
        }

        if (!(typeof vars === "object" && !vars.style) || !vars.path) {
          vars = {
            path: vars
          };
        }

        var rawPaths = [],
            _vars = vars,
            path = _vars.path,
            autoRotate = _vars.autoRotate,
            unitX = _vars.unitX,
            unitY = _vars.unitY,
            x = _vars.x,
            y = _vars.y,
            firstObj = path[0],
            slicer = _sliceModifier(vars.start, "end" in vars ? vars.end : 1),
            rawPath,
            p;

        this.rawPaths = rawPaths;
        this.target = target;
        this.tween = tween;
        this.styles = _getStyleSaver && _getStyleSaver(target, "transform");

        if (this.rotate = autoRotate || autoRotate === 0) {
          //get the rotational data FIRST so that the setTransform() method is called in the correct order in the render() loop - rotation gets set last.
          this.rOffset = parseFloat(autoRotate) || 0;
          this.radians = !!vars.useRadians;
          this.rProp = vars.rotation || "rotation"; // rotation property

          this.rSet = target._gsap.set(target, this.rProp, this); // rotation setter

          this.ru = _getUnit(target._gsap.get(target, this.rProp)) || 0; // rotation units
        }

        if (Array.isArray(path) && !("closed" in path) && typeof firstObj !== "number") {
          for (p in firstObj) {
            if (!x && ~_xProps.indexOf(p)) {
              x = p;
            } else if (!y && ~_yProps.indexOf(p)) {
              y = p;
            }
          }

          if (x && y) {
            //correlated values
            rawPaths.push(_segmentToRawPath(this, _populateSegmentFromArray(_populateSegmentFromArray([], path, x, 0), path, y, 1), target, x, y, slicer, vars, unitX || _getUnit(path[0][x]), unitY || _getUnit(path[0][y])));
          } else {
            x = y = 0;
          }

          for (p in firstObj) {
            p !== x && p !== y && rawPaths.push(_segmentToRawPath(this, _populateSegmentFromArray([], path, p, 2), target, p, 0, slicer, vars, _getUnit(path[0][p])));
          }
        } else {
          rawPath = slicer(_align(getRawPath(vars.path), target, vars));
          cacheRawPathMeasurements(rawPath, vars.resolution);
          rawPaths.push(rawPath);

          _addDimensionalPropTween(this, target, vars.x || "x", rawPath, "x", vars.unitX || "px");

          _addDimensionalPropTween(this, target, vars.y || "y", rawPath, "y", vars.unitY || "px");
        }
      },
      render: function render(ratio, data) {
        var rawPaths = data.rawPaths,
            i = rawPaths.length,
            pt = data._pt;

        if (data.tween._time || !_reverting()) {
          if (ratio > 1) {
            ratio = 1;
          } else if (ratio < 0) {
            ratio = 0;
          }

          while (i--) {
            getPositionOnPath(rawPaths[i], ratio, !i && data.rotate, rawPaths[i]);
          }

          while (pt) {
            pt.set(pt.t, pt.p, pt.path[pt.pp] + pt.u, pt.d, ratio);
            pt = pt._next;
          }

          data.rotate && data.rSet(data.target, data.rProp, rawPaths[0].angle * (data.radians ? _DEG2RAD : 1) + data.rOffset + data.ru, data, ratio);
        } else {
          data.styles.revert();
        }
      },
      getLength: function getLength(path) {
        return cacheRawPathMeasurements(getRawPath(path)).totalLength;
      },
      sliceRawPath: sliceRawPath,
      getRawPath: getRawPath,
      pointsToSegment: pointsToSegment,
      stringToRawPath: stringToRawPath,
      rawPathToString: rawPathToString,
      transformRawPath: transformRawPath,
      getGlobalMatrix: getGlobalMatrix,
      getPositionOnPath: getPositionOnPath,
      cacheRawPathMeasurements: cacheRawPathMeasurements,
      convertToPath: function convertToPath$1(targets, swap) {
        return _toArray(targets).map(function (target) {
          return convertToPath(target, swap !== false);
        });
      },
      convertCoordinates: function convertCoordinates(fromElement, toElement, point) {
        var m = getGlobalMatrix(toElement, true, true).multiply(getGlobalMatrix(fromElement));
        return point ? m.apply(point) : m;
      },
      getAlignMatrix: _getAlignMatrix,
      getRelativePosition: function getRelativePosition(fromElement, toElement, fromOrigin, toOrigin) {
        var m = _getAlignMatrix(fromElement, toElement, fromOrigin, toOrigin);

        return {
          x: m.e,
          y: m.f
        };
      },
      arrayToRawPath: function arrayToRawPath(value, vars) {
        vars = vars || {};

        var segment = _populateSegmentFromArray(_populateSegmentFromArray([], value, vars.x || "x", 0), value, vars.y || "y", 1);

        vars.relative && _relativize(segment);
        return [vars.type === "cubic" ? segment : pointsToSegment(segment, vars.curviness)];
      }
    };
    _getGSAP() && gsap.registerPlugin(MotionPathPlugin);

    /* src/items/Ruby.svelte generated by Svelte v3.59.2 */
    const file$5 = "src/items/Ruby.svelte";

    function add_css$5(target) {
    	append_styles(target, "svelte-1d3eml", ".ruby.svelte-1d3eml{position:absolute;background:url(\"./assets/diamond.svg\") no-repeat center center;width:5vmin;height:5vmin;transition:animation 1s}.show.svelte-1d3eml{-webkit-animation:svelte-1d3eml-filter-animation 3s infinite;animation:svelte-1d3eml-filter-animation 3s infinite}@-webkit-keyframes svelte-1d3eml-filter-animation{0%{-webkit-filter:saturate(3) hue-rotate(0deg)}100%{-webkit-filter:saturate(3) hue-rotate(360deg)}}@keyframes svelte-1d3eml-filter-animation{0%{filter:saturate(3) hue-rotate(0deg)}100%{filter:saturate(3) hue-rotate(360deg)}}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUnVieS5zdmVsdGUiLCJzb3VyY2VzIjpbIlJ1Ynkuc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGltcG9ydCB7IG9uTW91bnQsIG9uRGVzdHJveSB9IGZyb20gXCJzdmVsdGVcIlxuICBpbXBvcnQgeyBmYWRlLCBmbHkgfSBmcm9tIFwic3ZlbHRlL3RyYW5zaXRpb25cIlxuICBpbXBvcnQgeyBzZXR1cEFwcCB9IGZyb20gXCIuLi9zdG9yZXMvc3RvcmUuanNcIlxuXG4gIGV4cG9ydCBsZXQgaWRcbiAgZXhwb3J0IGxldCBtb2RlXG5cbiAgbGV0IGdvQW5pbWF0aW9uID0gZmFsc2VcbiAgbGV0IHJ1YnlcblxuICBvbk1vdW50KCgpID0+IHtcbiAgICBydWJ5LnN0eWxlLmxlZnQgPSBgJHttb2RlLnggKiBzZXR1cEFwcC5zaXplfXZtaW5gXG4gICAgcnVieS5zdHlsZS50b3AgPSBgJHttb2RlLnkgKiBzZXR1cEFwcC5zaXplfXZtaW5gXG4gICAgc2V0VGltZW91dCgoKSA9PiAoZ29BbmltYXRpb24gPSB0cnVlKSwgTWF0aC5yYW5kb20oKSAqIDUwMDApXG4gIH0pXG48L3NjcmlwdD5cblxuPHN0eWxlPlxuICAucnVieSB7XG4gICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgIGJhY2tncm91bmQ6IHVybChcIi4vYXNzZXRzL2RpYW1vbmQuc3ZnXCIpIG5vLXJlcGVhdCBjZW50ZXIgY2VudGVyO1xuICAgIHdpZHRoOiA1dm1pbjtcbiAgICBoZWlnaHQ6IDV2bWluO1xuICAgIHRyYW5zaXRpb246IGFuaW1hdGlvbiAxcztcbiAgfVxuICAuc2hvdyB7XG4gICAgLXdlYmtpdC1hbmltYXRpb246IGZpbHRlci1hbmltYXRpb24gM3MgaW5maW5pdGU7XG4gICAgYW5pbWF0aW9uOiBmaWx0ZXItYW5pbWF0aW9uIDNzIGluZmluaXRlO1xuICB9XG5cbiAgQC13ZWJraXQta2V5ZnJhbWVzIGZpbHRlci1hbmltYXRpb24ge1xuICAgIDAlIHtcbiAgICAgIC13ZWJraXQtZmlsdGVyOiBzYXR1cmF0ZSgzKSBodWUtcm90YXRlKDBkZWcpO1xuICAgIH1cbiAgICAxMDAlIHtcbiAgICAgIC13ZWJraXQtZmlsdGVyOiBzYXR1cmF0ZSgzKSBodWUtcm90YXRlKDM2MGRlZyk7XG4gICAgfVxuICB9XG4gIEBrZXlmcmFtZXMgZmlsdGVyLWFuaW1hdGlvbiB7XG4gICAgMCUge1xuICAgICAgZmlsdGVyOiBzYXR1cmF0ZSgzKSBodWUtcm90YXRlKDBkZWcpO1xuICAgIH1cbiAgICAxMDAlIHtcbiAgICAgIGZpbHRlcjogc2F0dXJhdGUoMykgaHVlLXJvdGF0ZSgzNjBkZWcpO1xuICAgIH1cbiAgfVxuPC9zdHlsZT5cblxuPGRpdlxuICBjbGFzcz1cInJ1Ynkge2dvQW5pbWF0aW9uID8gJ3Nob3cnIDogJyd9XCJcbiAgaW46Zmx5PVwie3sgZGVsYXk6IE1hdGgucmFuZG9tKCkgKiA3NTAsIGR1cmF0aW9uOiA3MDAsIHg6IE1hdGguc2lnbihNYXRoLnJhbmRvbSgpIC0gMC41KSAqIDI1LCB5OiBNYXRoLnNpZ24oTWF0aC5yYW5kb20oKSAtIDAuNSkgKiAyNSB9fVwiXG4gIG91dDpmbHk9XCJ7eyBkdXJhdGlvbjogMTAwMCwgeDogNTAsIHk6IC01MCB9fVwiXG4gIGJpbmQ6dGhpcz1cIntydWJ5fVwiXG4+PC9kaXY+XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBbUJFLG1CQUFNLENBQ0osUUFBUSxDQUFFLFFBQVEsQ0FDbEIsVUFBVSxDQUFFLDJCQUEyQixDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUMvRCxLQUFLLENBQUUsS0FBSyxDQUNaLE1BQU0sQ0FBRSxLQUFLLENBQ2IsVUFBVSxDQUFFLFNBQVMsQ0FBQyxFQUN4QixDQUNBLG1CQUFNLENBQ0osaUJBQWlCLENBQUUsOEJBQWdCLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FDL0MsU0FBUyxDQUFFLDhCQUFnQixDQUFDLEVBQUUsQ0FBQyxRQUNqQyxDQUVBLG1CQUFtQiw4QkFBaUIsQ0FDbEMsRUFBRyxDQUNELGNBQWMsQ0FBRSxTQUFTLENBQUMsQ0FBQyxDQUFDLFdBQVcsSUFBSSxDQUM3QyxDQUNBLElBQUssQ0FDSCxjQUFjLENBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxXQUFXLE1BQU0sQ0FDL0MsQ0FDRixDQUNBLFdBQVcsOEJBQWlCLENBQzFCLEVBQUcsQ0FDRCxNQUFNLENBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxXQUFXLElBQUksQ0FDckMsQ0FDQSxJQUFLLENBQ0gsTUFBTSxDQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsV0FBVyxNQUFNLENBQ3ZDLENBQ0YifQ== */");
    }

    function create_fragment$5(ctx) {
    	let div;
    	let div_class_value;
    	let div_intro;
    	let div_outro;
    	let current;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", div_class_value = "ruby " + (/*goAnimation*/ ctx[0] ? 'show' : '') + " svelte-1d3eml");
    			add_location(div, file$5, 49, 0, 1076);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			/*div_binding*/ ctx[4](div);
    			current = true;
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;

    			if (!current || dirty & /*goAnimation*/ 1 && div_class_value !== (div_class_value = "ruby " + (/*goAnimation*/ ctx[0] ? 'show' : '') + " svelte-1d3eml")) {
    				attr_dev(div, "class", div_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!current) return;
    				if (div_outro) div_outro.end(1);

    				div_intro = create_in_transition(div, fly, {
    					delay: Math.random() * 750,
    					duration: 700,
    					x: Math.sign(Math.random() - 0.5) * 25,
    					y: Math.sign(Math.random() - 0.5) * 25
    				});

    				div_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (div_intro) div_intro.invalidate();
    			div_outro = create_out_transition(div, fly, { duration: 1000, x: 50, y: -50 });
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			/*div_binding*/ ctx[4](null);
    			if (detaching && div_outro) div_outro.end();
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
    	validate_slots('Ruby', slots, []);
    	let { id } = $$props;
    	let { mode } = $$props;
    	let goAnimation = false;
    	let ruby;

    	onMount(() => {
    		$$invalidate(1, ruby.style.left = `${mode.x * setupApp.size}vmin`, ruby);
    		$$invalidate(1, ruby.style.top = `${mode.y * setupApp.size}vmin`, ruby);
    		setTimeout(() => $$invalidate(0, goAnimation = true), Math.random() * 5000);
    	});

    	$$self.$$.on_mount.push(function () {
    		if (id === undefined && !('id' in $$props || $$self.$$.bound[$$self.$$.props['id']])) {
    			console.warn("<Ruby> was created without expected prop 'id'");
    		}

    		if (mode === undefined && !('mode' in $$props || $$self.$$.bound[$$self.$$.props['mode']])) {
    			console.warn("<Ruby> was created without expected prop 'mode'");
    		}
    	});

    	const writable_props = ['id', 'mode'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Ruby> was created with unknown prop '${key}'`);
    	});

    	function div_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			ruby = $$value;
    			$$invalidate(1, ruby);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('id' in $$props) $$invalidate(2, id = $$props.id);
    		if ('mode' in $$props) $$invalidate(3, mode = $$props.mode);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		onDestroy,
    		fade,
    		fly,
    		setupApp,
    		id,
    		mode,
    		goAnimation,
    		ruby
    	});

    	$$self.$inject_state = $$props => {
    		if ('id' in $$props) $$invalidate(2, id = $$props.id);
    		if ('mode' in $$props) $$invalidate(3, mode = $$props.mode);
    		if ('goAnimation' in $$props) $$invalidate(0, goAnimation = $$props.goAnimation);
    		if ('ruby' in $$props) $$invalidate(1, ruby = $$props.ruby);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [goAnimation, ruby, id, mode, div_binding];
    }

    class Ruby extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, { id: 2, mode: 3 }, add_css$5);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Ruby",
    			options,
    			id: create_fragment$5.name
    		});
    	}

    	get id() {
    		throw new Error("<Ruby>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Ruby>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get mode() {
    		throw new Error("<Ruby>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set mode(value) {
    		throw new Error("<Ruby>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/items/Plant.svelte generated by Svelte v3.59.2 */
    const file$4 = "src/items/Plant.svelte";

    function add_css$4(target) {
    	append_styles(target, "svelte-jql2qn", ".plant.svelte-jql2qn{position:absolute;background:#28cf28;background:url(\"./assets/grass.png\") no-repeat center center;background-size:cover;width:5vmin;height:5vmin;border-radius:100%;transition:border-radius 1s}.have-left.svelte-jql2qn{border-bottom-left-radius:0;border-top-left-radius:0}.have-right.svelte-jql2qn{border-bottom-right-radius:0;border-top-right-radius:0}.have-top.svelte-jql2qn{border-top-left-radius:0;border-top-right-radius:0}.have-bottom.svelte-jql2qn{border-bottom-left-radius:0;border-bottom-right-radius:0}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGxhbnQuc3ZlbHRlIiwic291cmNlcyI6WyJQbGFudC5zdmVsdGUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdD5cbiAgaW1wb3J0IHsgb25Nb3VudCwgb25EZXN0cm95IH0gZnJvbSBcInN2ZWx0ZVwiXG4gIGltcG9ydCB7IGZhZGUsIGZseSB9IGZyb20gXCJzdmVsdGUvdHJhbnNpdGlvblwiXG4gIGltcG9ydCB7IHNldHVwQXBwIH0gZnJvbSBcIi4uL3N0b3Jlcy9zdG9yZS5qc1wiXG4gIGltcG9ydCB7IHNldHVwRGlzcGxheSB9IGZyb20gXCIuLi9zdG9yZXMvc3RvcmUuanNcIlxuXG4gIGV4cG9ydCBsZXQgaWRcblxuICBsZXQgcGxhbnRcbiAgbGV0IGlzTGVmdCwgaXNMZWZ0VG9wLCBpc1RvcCwgaXNSaWdodFRvcCwgaXNSaWdodCwgaXNSaWdodEJvdHRvbSwgaXNCb3R0b20sIGlzTGVmdEJvdHRvbVxuXG4gIG9uTW91bnQoKCkgPT4ge1xuICAgIHBsYW50LnN0eWxlLmxlZnQgPSBgJHsoaWQgJSBzZXR1cEFwcC5tYXApICogc2V0dXBBcHAuc2l6ZX12bWluYFxuICAgIHBsYW50LnN0eWxlLnRvcCA9IGAke01hdGguZmxvb3IoaWQgLyBzZXR1cEFwcC5tYXApICogc2V0dXBBcHAuc2l6ZX12bWluYFxuICB9KVxuXG4gICQ6IHtcbiAgICBpc0xlZnQgPSBpZCAlIHNldHVwQXBwLm1hcCA+IDAgJiYgJHNldHVwRGlzcGxheVtpZCAtIDFdID09IDIwMFxuICAgIGlzUmlnaHQgPSBpZCAlIHNldHVwQXBwLm1hcCA8IHNldHVwQXBwLm1hcCAtIDEgJiYgJHNldHVwRGlzcGxheVtpZCArIDFdID09IDIwMFxuICAgIGlzVG9wID0gJHNldHVwRGlzcGxheVtpZCAtIHNldHVwQXBwLm1hcF0gPT0gMjAwXG4gICAgaXNCb3R0b20gPSAkc2V0dXBEaXNwbGF5W2lkICsgc2V0dXBBcHAubWFwXSA9PSAyMDBcbiAgfVxuPC9zY3JpcHQ+XG5cbjxzdHlsZT5cbiAgLnBsYW50IHtcbiAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgYmFja2dyb3VuZDogIzI4Y2YyODtcbiAgICBiYWNrZ3JvdW5kOiB1cmwoXCIuL2Fzc2V0cy9ncmFzcy5wbmdcIikgbm8tcmVwZWF0IGNlbnRlciBjZW50ZXI7XG4gICAgYmFja2dyb3VuZC1zaXplOiBjb3ZlcjtcbiAgICB3aWR0aDogNXZtaW47XG4gICAgaGVpZ2h0OiA1dm1pbjtcbiAgICBib3JkZXItcmFkaXVzOiAxMDAlO1xuICAgIHRyYW5zaXRpb246IGJvcmRlci1yYWRpdXMgMXM7XG4gIH1cbiAgLmhhdmUtbGVmdCB7XG4gICAgYm9yZGVyLWJvdHRvbS1sZWZ0LXJhZGl1czogMDtcbiAgICBib3JkZXItdG9wLWxlZnQtcmFkaXVzOiAwO1xuICB9XG4gIC5oYXZlLXJpZ2h0IHtcbiAgICBib3JkZXItYm90dG9tLXJpZ2h0LXJhZGl1czogMDtcbiAgICBib3JkZXItdG9wLXJpZ2h0LXJhZGl1czogMDtcbiAgfVxuICAuaGF2ZS10b3Age1xuICAgIGJvcmRlci10b3AtbGVmdC1yYWRpdXM6IDA7XG4gICAgYm9yZGVyLXRvcC1yaWdodC1yYWRpdXM6IDA7XG4gIH1cbiAgLmhhdmUtYm90dG9tIHtcbiAgICBib3JkZXItYm90dG9tLWxlZnQtcmFkaXVzOiAwO1xuICAgIGJvcmRlci1ib3R0b20tcmlnaHQtcmFkaXVzOiAwO1xuICB9XG48L3N0eWxlPlxuXG48ZGl2XG4gIGNsYXNzPVwicGxhbnRcbiAgICB7aXNMZWZ0ID8gJ2hhdmUtbGVmdCcgOiAnJ31cbiAgICB7aXNSaWdodCA/ICdoYXZlLXJpZ2h0JyA6ICcnfVxuICAgIHtpc1RvcCA/ICdoYXZlLXRvcCcgOiAnJ31cbiAgICB7aXNCb3R0b20gPyAnaGF2ZS1ib3R0b20nIDogJyd9XCJcbiAgaW46ZmFkZT1cInt7IGRlbGF5OiBpZCwgZHVyYXRpb246IDUwMCwgeDogTWF0aC5zaWduKE1hdGgucmFuZG9tKCkgLSAwLjUpICogMiwgeTogTWF0aC5zaWduKE1hdGgucmFuZG9tKCkgLSAwLjUpICogMiB9fVwiXG4gIG91dDpmYWRlPVwie3sgZHVyYXRpb246IDEyNSwgeDogMCwgeTogMTAgfX1cIlxuICBiaW5kOnRoaXM9XCJ7cGxhbnR9XCJcbj48L2Rpdj5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUF5QkUsb0JBQU8sQ0FDTCxRQUFRLENBQUUsUUFBUSxDQUNsQixVQUFVLENBQUUsT0FBTyxDQUNuQixVQUFVLENBQUUseUJBQXlCLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQzdELGVBQWUsQ0FBRSxLQUFLLENBQ3RCLEtBQUssQ0FBRSxLQUFLLENBQ1osTUFBTSxDQUFFLEtBQUssQ0FDYixhQUFhLENBQUUsSUFBSSxDQUNuQixVQUFVLENBQUUsYUFBYSxDQUFDLEVBQzVCLENBQ0Esd0JBQVcsQ0FDVCx5QkFBeUIsQ0FBRSxDQUFDLENBQzVCLHNCQUFzQixDQUFFLENBQzFCLENBQ0EseUJBQVksQ0FDViwwQkFBMEIsQ0FBRSxDQUFDLENBQzdCLHVCQUF1QixDQUFFLENBQzNCLENBQ0EsdUJBQVUsQ0FDUixzQkFBc0IsQ0FBRSxDQUFDLENBQ3pCLHVCQUF1QixDQUFFLENBQzNCLENBQ0EsMEJBQWEsQ0FDWCx5QkFBeUIsQ0FBRSxDQUFDLENBQzVCLDBCQUEwQixDQUFFLENBQzlCIn0= */");
    }

    function create_fragment$4(ctx) {
    	let div;
    	let div_class_value;
    	let div_intro;
    	let div_outro;
    	let current;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", div_class_value = "plant " + (/*isLeft*/ ctx[2] ? 'have-left' : '') + " " + (/*isRight*/ ctx[4] ? 'have-right' : '') + " " + (/*isTop*/ ctx[3] ? 'have-top' : '') + " " + (/*isBottom*/ ctx[5] ? 'have-bottom' : '') + " svelte-jql2qn");
    			add_location(div, file$4, 53, 0, 1388);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			/*div_binding*/ ctx[7](div);
    			current = true;
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;

    			if (!current || dirty & /*isLeft, isRight, isTop, isBottom*/ 60 && div_class_value !== (div_class_value = "plant " + (/*isLeft*/ ctx[2] ? 'have-left' : '') + " " + (/*isRight*/ ctx[4] ? 'have-right' : '') + " " + (/*isTop*/ ctx[3] ? 'have-top' : '') + " " + (/*isBottom*/ ctx[5] ? 'have-bottom' : '') + " svelte-jql2qn")) {
    				attr_dev(div, "class", div_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!current) return;
    				if (div_outro) div_outro.end(1);

    				div_intro = create_in_transition(div, fade, {
    					delay: /*id*/ ctx[0],
    					duration: 500,
    					x: Math.sign(Math.random() - 0.5) * 2,
    					y: Math.sign(Math.random() - 0.5) * 2
    				});

    				div_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (div_intro) div_intro.invalidate();
    			div_outro = create_out_transition(div, fade, { duration: 125, x: 0, y: 10 });
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			/*div_binding*/ ctx[7](null);
    			if (detaching && div_outro) div_outro.end();
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

    function instance$4($$self, $$props, $$invalidate) {
    	let $setupDisplay;
    	validate_store(setupDisplay, 'setupDisplay');
    	component_subscribe($$self, setupDisplay, $$value => $$invalidate(6, $setupDisplay = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Plant', slots, []);
    	let { id } = $$props;
    	let plant;

    	let isLeft,
    		isLeftTop,
    		isTop,
    		isRightTop,
    		isRight,
    		isRightBottom,
    		isBottom,
    		isLeftBottom;

    	onMount(() => {
    		$$invalidate(1, plant.style.left = `${id % setupApp.map * setupApp.size}vmin`, plant);
    		$$invalidate(1, plant.style.top = `${Math.floor(id / setupApp.map) * setupApp.size}vmin`, plant);
    	});

    	$$self.$$.on_mount.push(function () {
    		if (id === undefined && !('id' in $$props || $$self.$$.bound[$$self.$$.props['id']])) {
    			console.warn("<Plant> was created without expected prop 'id'");
    		}
    	});

    	const writable_props = ['id'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Plant> was created with unknown prop '${key}'`);
    	});

    	function div_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			plant = $$value;
    			$$invalidate(1, plant);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		onDestroy,
    		fade,
    		fly,
    		setupApp,
    		setupDisplay,
    		id,
    		plant,
    		isLeft,
    		isLeftTop,
    		isTop,
    		isRightTop,
    		isRight,
    		isRightBottom,
    		isBottom,
    		isLeftBottom,
    		$setupDisplay
    	});

    	$$self.$inject_state = $$props => {
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    		if ('plant' in $$props) $$invalidate(1, plant = $$props.plant);
    		if ('isLeft' in $$props) $$invalidate(2, isLeft = $$props.isLeft);
    		if ('isLeftTop' in $$props) isLeftTop = $$props.isLeftTop;
    		if ('isTop' in $$props) $$invalidate(3, isTop = $$props.isTop);
    		if ('isRightTop' in $$props) isRightTop = $$props.isRightTop;
    		if ('isRight' in $$props) $$invalidate(4, isRight = $$props.isRight);
    		if ('isRightBottom' in $$props) isRightBottom = $$props.isRightBottom;
    		if ('isBottom' in $$props) $$invalidate(5, isBottom = $$props.isBottom);
    		if ('isLeftBottom' in $$props) isLeftBottom = $$props.isLeftBottom;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*id, $setupDisplay*/ 65) {
    			{
    				$$invalidate(2, isLeft = id % setupApp.map > 0 && $setupDisplay[id - 1] == 200);
    				$$invalidate(4, isRight = id % setupApp.map < setupApp.map - 1 && $setupDisplay[id + 1] == 200);
    				$$invalidate(3, isTop = $setupDisplay[id - setupApp.map] == 200);
    				$$invalidate(5, isBottom = $setupDisplay[id + setupApp.map] == 200);
    			}
    		}
    	};

    	return [id, plant, isLeft, isTop, isRight, isBottom, $setupDisplay, div_binding];
    }

    class Plant extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { id: 0 }, add_css$4);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Plant",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get id() {
    		throw new Error("<Plant>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Plant>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/items/Ground.svelte generated by Svelte v3.59.2 */

    const file$3 = "src/items/Ground.svelte";

    function add_css$3(target) {
    	append_styles(target, "svelte-14zizob", ".ground.svelte-14zizob{width:5vmin;height:5vmin}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiR3JvdW5kLnN2ZWx0ZSIsInNvdXJjZXMiOlsiR3JvdW5kLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxuICBleHBvcnQgbGV0IGlkXG4gIGV4cG9ydCBsZXQgbW9kZVxuPC9zY3JpcHQ+XG5cbjxzdHlsZT5cbiAgLmdyb3VuZCB7XG4gICAgd2lkdGg6IDV2bWluO1xuICAgIGhlaWdodDogNXZtaW47XG4gIH1cbjwvc3R5bGU+XG5cbjxkaXYgY2xhc3M9XCJncm91bmRcIj48L2Rpdj5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFNRSxzQkFBUSxDQUNOLEtBQUssQ0FBRSxLQUFLLENBQ1osTUFBTSxDQUFFLEtBQ1YifQ== */");
    }

    function create_fragment$3(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "ground svelte-14zizob");
    			add_location(div, file$3, 12, 0, 125);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
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
    	validate_slots('Ground', slots, []);
    	let { id } = $$props;
    	let { mode } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (id === undefined && !('id' in $$props || $$self.$$.bound[$$self.$$.props['id']])) {
    			console.warn("<Ground> was created without expected prop 'id'");
    		}

    		if (mode === undefined && !('mode' in $$props || $$self.$$.bound[$$self.$$.props['mode']])) {
    			console.warn("<Ground> was created without expected prop 'mode'");
    		}
    	});

    	const writable_props = ['id', 'mode'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Ground> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    		if ('mode' in $$props) $$invalidate(1, mode = $$props.mode);
    	};

    	$$self.$capture_state = () => ({ id, mode });

    	$$self.$inject_state = $$props => {
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    		if ('mode' in $$props) $$invalidate(1, mode = $$props.mode);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [id, mode];
    }

    class Ground extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { id: 0, mode: 1 }, add_css$3);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Ground",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get id() {
    		throw new Error("<Ground>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Ground>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get mode() {
    		throw new Error("<Ground>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set mode(value) {
    		throw new Error("<Ground>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/items/Personage.svelte generated by Svelte v3.59.2 */

    const file$2 = "src/items/Personage.svelte";

    function add_css$2(target) {
    	append_styles(target, "svelte-gg5k96", ".personage.svelte-gg5k96{position:absolute;background:url(\"./assets/personage.png\") no-repeat;background-position:-1% center;background-size:cover;width:5vmin;height:5vmin;transition:background-position 0.5s, left 0.33s linear, top 0.33s linear;animation:svelte-gg5k96-filter-stand 1s infinite;transform-origin:bottom}.go.svelte-gg5k96{-webkit-animation:svelte-gg5k96-filter-animation 1s infinite;animation:svelte-gg5k96-filter-animation 1s infinite}.go-invert.svelte-gg5k96{transform:scaleX(-1)}.reset.svelte-gg5k96{animation:none !important;transition:none !important}@keyframes svelte-gg5k96-filter-stand{0%{transform:scaleY(1)}50%{transform:scaleY(1.05)}100%{transform:scaleY(1)}}@-webkit-keyframes svelte-gg5k96-filter-animation{0%{background-position:32% center}24%{background-position:32% center}25%{background-position:64% center}49%{background-position:64% center}50%{background-position:98% center}74%{background-position:98% center}75%{background-position:64% center}100%{background-position:64% center}}@keyframes svelte-gg5k96-filter-animation{0%{background-position:32% center}24%{background-position:32% center}25%{background-position:64% center}49%{background-position:64% center}50%{background-position:98% center}74%{background-position:98% center}75%{background-position:64% center}100%{background-position:64% center}}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGVyc29uYWdlLnN2ZWx0ZSIsInNvdXJjZXMiOlsiUGVyc29uYWdlLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxuICBpbXBvcnQgeyBvbk1vdW50LCBvbkRlc3Ryb3kgfSBmcm9tIFwic3ZlbHRlXCJcbiAgaW1wb3J0IHsgZmFkZSwgZmx5IH0gZnJvbSBcInN2ZWx0ZS90cmFuc2l0aW9uXCJcbiAgaW1wb3J0IHsgc2V0dXBBcHAsIHNldHVwRGlzcGxheSwgc2V0dXBQZXJzb25hZ2UsIHNldHVwU2NvcmUsIGRvUmVzZXQsIHh5UGVyc29uYWdlIH0gZnJvbSBcIi4uL3N0b3Jlcy9zdG9yZS5qc1wiXG5cbiAgbGV0IHBsYXllclxuICBsZXQgeCwgeSwgcHJldlgsIHByZXZZXG4gIGxldCB0b3VjaFN0YXJ0Q29vcmRzXG4gIGxldCB0b3VjaE5vd0Nvb3Jkc1xuXG4gIGxldCBsYXN0R29MZWZ0ID0gZmFsc2VcblxuICBsZXQgaXNWaXNpYmxlID0gdHJ1ZVxuICBsZXQgaXNBbmltYXRlZCA9IGZhbHNlXG4gIGxldCB0aW1lckFuaW1hdGVkXG5cbiAgZG9SZXNldC5zdWJzY3JpYmUoKGl0ZW0pID0+IHtcbiAgICBpZiAoaXRlbSkge1xuICAgICAgc2V0VGltZW91dCgoKSA9PiBkb1Jlc2V0LnNldChmYWxzZSksIHNldHVwQXBwLnNwZWVkIC8gMilcbiAgICB9XG4gIH0pXG4gIFxuICBzZXR1cFBlcnNvbmFnZS5zdWJzY3JpYmUoKGl0ZW0pID0+IHtcbiAgICB4ID0gaXRlbS54XG4gICAgeSA9IGl0ZW0ueVxuXG4gICAgaWYgKHByZXZYID09IHVuZGVmaW5lZCkgcHJldlggPSB4XG4gICAgaWYgKHByZXZZID09IHVuZGVmaW5lZCkgcHJldlkgPSB5XG5cbiAgICBpZiAoIXBsYXllcikgcmV0dXJuXG5cbiAgICBwbGF5ZXIuc3R5bGUubGVmdCA9IGAkeyh4ICogc2V0dXBBcHAuc2l6ZSl9dm1pbmBcbiAgICBwbGF5ZXIuc3R5bGUudG9wID0gYCR7KHkgKiBzZXR1cEFwcC5zaXplKX12bWluYFxuICAgIGlmIChwcmV2WCAhPSB4IHx8IHByZXZZICE9IHkpIHtcbiAgICAgIGlmICh4IDwgcHJldlgpIHtcbiAgICAgICAgbGFzdEdvTGVmdCA9IHRydWVcbiAgICAgIH0gZWxzZSBpZiAoeCA+IHByZXZYKSBsYXN0R29MZWZ0ID0gZmFsc2VcblxuICAgICAgaXNBbmltYXRlZCA9IHRydWVcbiAgICAgIGlmICh0aW1lckFuaW1hdGVkKSBjbGVhclRpbWVvdXQodGltZXJBbmltYXRlZClcbiAgICAgIHRpbWVyQW5pbWF0ZWQgPSBzZXRUaW1lb3V0KCgpID0+IChpc0FuaW1hdGVkID0gZmFsc2UpLCA1MDApXG4gICAgICBwcmV2WCA9IHhcbiAgICAgIHByZXZZID0geVxuICAgIH1cbiAgfSlcblxuICBvbk1vdW50KCgpID0+IHtcbiAgICBwbGF5ZXIuc3R5bGUubGVmdCA9IGAkey0xICogc2V0dXBBcHAuc2l6ZX12bWluYFxuICAgIHBsYXllci5zdHlsZS50b3AgPSBgJHstMSAqIHNldHVwQXBwLnNpemV9dm1pbmBcbiAgfSlcblxuICBjb25zdCBtb3ZlUG9zaXRpb24gPSAoZHgsIGR5KSA9PiB7XG4gICAgeCA9IE1hdGgubWluKE1hdGgubWF4KDAsICh4ICs9IGR4KSksIHNldHVwQXBwLm1hcCAtIDEpXG4gICAgeSA9IE1hdGgubWluKE1hdGgubWF4KDAsICh5ICs9IGR5KSksIHNldHVwQXBwLm1hcCAtIDEpXG4gICAgc2V0dXBQZXJzb25hZ2Uuc2V0KHsgeDogeCwgeTogeSB9KVxuXG4gICAgbGV0IGRpc3BsYXkgPSAkc2V0dXBEaXNwbGF5XG4gICAgY29uc3Qgd2hhdE9uUGxhY2UgPSBkaXNwbGF5W3ggKyB5ICogc2V0dXBBcHAubWFwXVxuXG4gICAgaWYgKCRzZXR1cFNjb3JlLmdvdERpYW1vbmRzIDwgJHNldHVwU2NvcmUuZGlhbW9uZHMgJiYgd2hhdE9uUGxhY2UgPiAxMDApIHtcbiAgICAgIGxldCBzY29yZSA9ICRzZXR1cFNjb3JlXG4gICAgICBzd2l0Y2ggKHdoYXRPblBsYWNlKSB7XG4gICAgICAgIGNhc2UgMjAwOlxuICAgICAgICAgIHNjb3JlLmdvdFBsYW50cyArPSAxXG4gICAgICAgICAgc2NvcmUuY3VycmVudCA9IE1hdGgubWF4KHNjb3JlLmN1cnJlbnQgLSBzY29yZS5wbGFudHMsIDApXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAzMDA6XG4gICAgICAgICAgc2NvcmUuZ290RGlhbW9uZHMgKz0gMVxuICAgICAgICAgIHNjb3JlLmN1cnJlbnQgPSBzY29yZS5jdXJyZW50ICsgc2NvcmUuZGlhbW9uZHNcbiAgICAgICAgICBicmVha1xuICAgICAgfVxuICAgICAgc2V0dXBTY29yZS5zZXQoc2NvcmUpXG4gICAgfVxuXG4gICAgZGlzcGxheVt4ICsgeSAqIHNldHVwQXBwLm1hcF0gPSAxMDBcbiAgICBzZXR1cERpc3BsYXkuc2V0KGRpc3BsYXkpXG4gIH1cblxuICBsZXQgdGltZXJYLCB0aW1lcllcblxuICBjb25zdCBsZWZ0R28gPSAoKSA9PiB7XG4gICAgaWYgKHRpbWVyWCB8fCB0aW1lclkpIHJldHVyblxuICAgIHRpbWVyWCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIG1vdmVQb3NpdGlvbigtMSwgMClcbiAgICB9LCBzZXR1cEFwcC5zcGVlZClcbiAgICBtb3ZlUG9zaXRpb24oLTEsIDApXG4gIH1cbiAgY29uc3QgcmlnaHRHbyA9ICgpID0+IHtcbiAgICBpZiAodGltZXJYIHx8IHRpbWVyWSkgcmV0dXJuXG4gICAgdGltZXJYID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgbW92ZVBvc2l0aW9uKCsxLCAwKVxuICAgIH0sIHNldHVwQXBwLnNwZWVkKVxuICAgIG1vdmVQb3NpdGlvbigrMSwgMClcbiAgfVxuICBjb25zdCB1cEdvID0gKCkgPT4ge1xuICAgIGlmICh0aW1lclggfHwgdGltZXJZKSByZXR1cm5cbiAgICB0aW1lclkgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBtb3ZlUG9zaXRpb24oMCwgLTEpXG4gICAgfSwgc2V0dXBBcHAuc3BlZWQpXG4gICAgbW92ZVBvc2l0aW9uKDAsIC0xKVxuICB9XG4gIGNvbnN0IGRvd25HbyA9ICgpID0+IHtcbiAgICBpZiAodGltZXJYIHx8IHRpbWVyWSkgcmV0dXJuXG4gICAgdGltZXJZID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgbW92ZVBvc2l0aW9uKDAsICsxKVxuICAgIH0sIHNldHVwQXBwLnNwZWVkKVxuICAgIG1vdmVQb3NpdGlvbigwLCArMSlcbiAgfVxuICBjb25zdCB4U3RvcCA9ICgpID0+IHtcbiAgICBjbGVhckludGVydmFsKHRpbWVyWClcbiAgICB0aW1lclggPSB1bmRlZmluZWRcbiAgfVxuICBjb25zdCB5U3RvcCA9ICgpID0+IHtcbiAgICBjbGVhckludGVydmFsKHRpbWVyWSlcbiAgICB0aW1lclkgPSB1bmRlZmluZWRcbiAgfVxuXG4gIGNvbnN0IGNhbGxHbyA9IHtcbiAgICBBcnJvd0xlZnQ6IGxlZnRHbyxcbiAgICBBcnJvd1JpZ2h0OiByaWdodEdvLFxuICAgIEFycm93VXA6IHVwR28sXG4gICAgQXJyb3dEb3duOiBkb3duR28sXG4gIH1cbiAgY29uc3QgY2FsbFN0b3AgPSB7XG4gICAgQXJyb3dMZWZ0OiB4U3RvcCxcbiAgICBBcnJvd1JpZ2h0OiB4U3RvcCxcbiAgICBBcnJvd1VwOiB5U3RvcCxcbiAgICBBcnJvd0Rvd246IHlTdG9wLFxuICB9XG5cbiAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgKGV2ZW50KSA9PiB7XG4gICAgY2FsbEdvW2V2ZW50LmtleV0/LigpXG4gIH0pXG5cbiAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImtleXVwXCIsIChldmVudCkgPT4ge1xuICAgIGNhbGxTdG9wW2V2ZW50LmtleV0/LigpXG4gIH0pXG5cbiAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcInRvdWNoc3RhcnRcIiwgKGV2ZW50KSA9PiB7XG4gICAgdG91Y2hTdGFydENvb3JkcyA9IHsgeDogTWF0aC5mbG9vcihldmVudC50b3VjaGVzWzBdLmNsaWVudFgpLCB5OiBNYXRoLmZsb29yKGV2ZW50LnRvdWNoZXNbMF0uY2xpZW50WSkgfVxuICB9KVxuXG4gIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJ0b3VjaG1vdmVcIiwgKGV2ZW50KSA9PiB7XG4gICAgdG91Y2hOb3dDb29yZHMgPSB7IHg6IE1hdGguZmxvb3IoZXZlbnQudG91Y2hlc1swXS5jbGllbnRYKSwgeTogTWF0aC5mbG9vcihldmVudC50b3VjaGVzWzBdLmNsaWVudFkpIH1cblxuICAgIGlmICh0b3VjaE5vd0Nvb3Jkcy54IDwgdG91Y2hTdGFydENvb3Jkcy54IC0gc2V0dXBBcHAudG91Y2hQYWRkaW5nKSBjYWxsR28uQXJyb3dMZWZ0KClcbiAgICBpZiAodG91Y2hOb3dDb29yZHMueCA+IHRvdWNoU3RhcnRDb29yZHMueCArIHNldHVwQXBwLnRvdWNoUGFkZGluZykgY2FsbEdvLkFycm93UmlnaHQoKVxuICAgIGlmICh0b3VjaE5vd0Nvb3Jkcy55IDwgdG91Y2hTdGFydENvb3Jkcy55IC0gc2V0dXBBcHAudG91Y2hQYWRkaW5nKSBjYWxsR28uQXJyb3dVcCgpXG4gICAgaWYgKHRvdWNoTm93Q29vcmRzLnkgPiB0b3VjaFN0YXJ0Q29vcmRzLnkgKyBzZXR1cEFwcC50b3VjaFBhZGRpbmcpIGNhbGxHby5BcnJvd0Rvd24oKVxuICB9KVxuXG4gIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJ0b3VjaGVuZFwiLCAoZXZlbnQpID0+IHtcbiAgICB4U3RvcCgpXG4gICAgeVN0b3AoKVxuICB9KVxuPC9zY3JpcHQ+XG5cbjxzdHlsZT5cbiAgLnBlcnNvbmFnZSB7XG4gICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgIGJhY2tncm91bmQ6IHVybChcIi4vYXNzZXRzL3BlcnNvbmFnZS5wbmdcIikgbm8tcmVwZWF0O1xuICAgIGJhY2tncm91bmQtcG9zaXRpb246IC0xJSBjZW50ZXI7XG4gICAgYmFja2dyb3VuZC1zaXplOiBjb3ZlcjtcbiAgICB3aWR0aDogNXZtaW47XG4gICAgaGVpZ2h0OiA1dm1pbjtcbiAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kLXBvc2l0aW9uIDAuNXMsIGxlZnQgMC4zM3MgbGluZWFyLCB0b3AgMC4zM3MgbGluZWFyO1xuICAgIGFuaW1hdGlvbjogZmlsdGVyLXN0YW5kIDFzIGluZmluaXRlO1xuICAgIHRyYW5zZm9ybS1vcmlnaW46IGJvdHRvbTtcbiAgfVxuICAuZ28ge1xuICAgIC13ZWJraXQtYW5pbWF0aW9uOiBmaWx0ZXItYW5pbWF0aW9uIDFzIGluZmluaXRlO1xuICAgIGFuaW1hdGlvbjogZmlsdGVyLWFuaW1hdGlvbiAxcyBpbmZpbml0ZTtcbiAgfVxuICAuZ28taW52ZXJ0IHtcbiAgICB0cmFuc2Zvcm06IHNjYWxlWCgtMSk7XG4gIH1cbiAgLnJlc2V0IHtcbiAgICBhbmltYXRpb246IG5vbmUgIWltcG9ydGFudDtcbiAgICB0cmFuc2l0aW9uOiBub25lICFpbXBvcnRhbnQ7XG4gIH1cblxuICBAa2V5ZnJhbWVzIGZpbHRlci1zdGFuZCB7XG4gICAgMCUge1xuICAgICAgdHJhbnNmb3JtOiBzY2FsZVkoMSk7XG4gICAgfVxuICAgIDUwJSB7XG4gICAgICB0cmFuc2Zvcm06IHNjYWxlWSgxLjA1KTtcbiAgICB9XG4gICAgMTAwJSB7XG4gICAgICB0cmFuc2Zvcm06IHNjYWxlWSgxKTtcbiAgICB9XG4gIH1cblxuICBALXdlYmtpdC1rZXlmcmFtZXMgZmlsdGVyLWFuaW1hdGlvbiB7XG4gICAgMCUge1xuICAgICAgYmFja2dyb3VuZC1wb3NpdGlvbjogMzIlIGNlbnRlcjtcbiAgICB9XG4gICAgMjQlIHtcbiAgICAgIGJhY2tncm91bmQtcG9zaXRpb246IDMyJSBjZW50ZXI7XG4gICAgfVxuICAgIDI1JSB7XG4gICAgICBiYWNrZ3JvdW5kLXBvc2l0aW9uOiA2NCUgY2VudGVyO1xuICAgIH1cbiAgICA0OSUge1xuICAgICAgYmFja2dyb3VuZC1wb3NpdGlvbjogNjQlIGNlbnRlcjtcbiAgICB9XG4gICAgNTAlIHtcbiAgICAgIGJhY2tncm91bmQtcG9zaXRpb246IDk4JSBjZW50ZXI7XG4gICAgfVxuICAgIDc0JSB7XG4gICAgICBiYWNrZ3JvdW5kLXBvc2l0aW9uOiA5OCUgY2VudGVyO1xuICAgIH1cbiAgICA3NSUge1xuICAgICAgYmFja2dyb3VuZC1wb3NpdGlvbjogNjQlIGNlbnRlcjtcbiAgICB9XG4gICAgMTAwJSB7XG4gICAgICBiYWNrZ3JvdW5kLXBvc2l0aW9uOiA2NCUgY2VudGVyO1xuICAgIH1cbiAgfVxuICBAa2V5ZnJhbWVzIGZpbHRlci1hbmltYXRpb24ge1xuICAgIDAlIHtcbiAgICAgIGJhY2tncm91bmQtcG9zaXRpb246IDMyJSBjZW50ZXI7XG4gICAgfVxuICAgIDI0JSB7XG4gICAgICBiYWNrZ3JvdW5kLXBvc2l0aW9uOiAzMiUgY2VudGVyO1xuICAgIH1cbiAgICAyNSUge1xuICAgICAgYmFja2dyb3VuZC1wb3NpdGlvbjogNjQlIGNlbnRlcjtcbiAgICB9XG4gICAgNDklIHtcbiAgICAgIGJhY2tncm91bmQtcG9zaXRpb246IDY0JSBjZW50ZXI7XG4gICAgfVxuICAgIDUwJSB7XG4gICAgICBiYWNrZ3JvdW5kLXBvc2l0aW9uOiA5OCUgY2VudGVyO1xuICAgIH1cbiAgICA3NCUge1xuICAgICAgYmFja2dyb3VuZC1wb3NpdGlvbjogOTglIGNlbnRlcjtcbiAgICB9XG4gICAgNzUlIHtcbiAgICAgIGJhY2tncm91bmQtcG9zaXRpb246IDY0JSBjZW50ZXI7XG4gICAgfVxuICAgIDEwMCUge1xuICAgICAgYmFja2dyb3VuZC1wb3NpdGlvbjogNjQlIGNlbnRlcjtcbiAgICB9XG4gIH1cbjwvc3R5bGU+XG5cbnsjaWYgaXNWaXNpYmxlfVxuICA8ZGl2XG4gICAgY2xhc3M9XCJwZXJzb25hZ2VcbiAgICB7JGRvUmVzZXQgPyAncmVzZXQnIDogJyd9IFxuICAgIHtpc0FuaW1hdGVkID8gJ2dvJyA6ICcnfSBcbiAgICB7bGFzdEdvTGVmdCA/ICdnby1pbnZlcnQnIDogJyd9XCJcbiAgICBiaW5kOnRoaXM9XCJ7cGxheWVyfVwiXG4gID48L2Rpdj5cbnsvaWZ9XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBOEpFLHdCQUFXLENBQ1QsUUFBUSxDQUFFLFFBQVEsQ0FDbEIsVUFBVSxDQUFFLDZCQUE2QixDQUFDLFNBQVMsQ0FDbkQsbUJBQW1CLENBQUUsR0FBRyxDQUFDLE1BQU0sQ0FDL0IsZUFBZSxDQUFFLEtBQUssQ0FDdEIsS0FBSyxDQUFFLEtBQUssQ0FDWixNQUFNLENBQUUsS0FBSyxDQUNiLFVBQVUsQ0FBRSxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUN6RSxTQUFTLENBQUUsMEJBQVksQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUNuQyxnQkFBZ0IsQ0FBRSxNQUNwQixDQUNBLGlCQUFJLENBQ0YsaUJBQWlCLENBQUUsOEJBQWdCLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FDL0MsU0FBUyxDQUFFLDhCQUFnQixDQUFDLEVBQUUsQ0FBQyxRQUNqQyxDQUNBLHdCQUFXLENBQ1QsU0FBUyxDQUFFLE9BQU8sRUFBRSxDQUN0QixDQUNBLG9CQUFPLENBQ0wsU0FBUyxDQUFFLElBQUksQ0FBQyxVQUFVLENBQzFCLFVBQVUsQ0FBRSxJQUFJLENBQUMsVUFDbkIsQ0FFQSxXQUFXLDBCQUFhLENBQ3RCLEVBQUcsQ0FDRCxTQUFTLENBQUUsT0FBTyxDQUFDLENBQ3JCLENBQ0EsR0FBSSxDQUNGLFNBQVMsQ0FBRSxPQUFPLElBQUksQ0FDeEIsQ0FDQSxJQUFLLENBQ0gsU0FBUyxDQUFFLE9BQU8sQ0FBQyxDQUNyQixDQUNGLENBRUEsbUJBQW1CLDhCQUFpQixDQUNsQyxFQUFHLENBQ0QsbUJBQW1CLENBQUUsR0FBRyxDQUFDLE1BQzNCLENBQ0EsR0FBSSxDQUNGLG1CQUFtQixDQUFFLEdBQUcsQ0FBQyxNQUMzQixDQUNBLEdBQUksQ0FDRixtQkFBbUIsQ0FBRSxHQUFHLENBQUMsTUFDM0IsQ0FDQSxHQUFJLENBQ0YsbUJBQW1CLENBQUUsR0FBRyxDQUFDLE1BQzNCLENBQ0EsR0FBSSxDQUNGLG1CQUFtQixDQUFFLEdBQUcsQ0FBQyxNQUMzQixDQUNBLEdBQUksQ0FDRixtQkFBbUIsQ0FBRSxHQUFHLENBQUMsTUFDM0IsQ0FDQSxHQUFJLENBQ0YsbUJBQW1CLENBQUUsR0FBRyxDQUFDLE1BQzNCLENBQ0EsSUFBSyxDQUNILG1CQUFtQixDQUFFLEdBQUcsQ0FBQyxNQUMzQixDQUNGLENBQ0EsV0FBVyw4QkFBaUIsQ0FDMUIsRUFBRyxDQUNELG1CQUFtQixDQUFFLEdBQUcsQ0FBQyxNQUMzQixDQUNBLEdBQUksQ0FDRixtQkFBbUIsQ0FBRSxHQUFHLENBQUMsTUFDM0IsQ0FDQSxHQUFJLENBQ0YsbUJBQW1CLENBQUUsR0FBRyxDQUFDLE1BQzNCLENBQ0EsR0FBSSxDQUNGLG1CQUFtQixDQUFFLEdBQUcsQ0FBQyxNQUMzQixDQUNBLEdBQUksQ0FDRixtQkFBbUIsQ0FBRSxHQUFHLENBQUMsTUFDM0IsQ0FDQSxHQUFJLENBQ0YsbUJBQW1CLENBQUUsR0FBRyxDQUFDLE1BQzNCLENBQ0EsR0FBSSxDQUNGLG1CQUFtQixDQUFFLEdBQUcsQ0FBQyxNQUMzQixDQUNBLElBQUssQ0FDSCxtQkFBbUIsQ0FBRSxHQUFHLENBQUMsTUFDM0IsQ0FDRiJ9 */");
    }

    // (248:0) {#if isVisible}
    function create_if_block$2(ctx) {
    	let div;
    	let div_class_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", div_class_value = "personage " + (/*$doReset*/ ctx[3] ? 'reset' : '') + " " + (/*isAnimated*/ ctx[2] ? 'go' : '') + " " + (/*lastGoLeft*/ ctx[1] ? 'go-invert' : '') + " svelte-gg5k96");
    			add_location(div, file$2, 248, 2, 5821);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			/*div_binding*/ ctx[5](div);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$doReset, isAnimated, lastGoLeft*/ 14 && div_class_value !== (div_class_value = "personage " + (/*$doReset*/ ctx[3] ? 'reset' : '') + " " + (/*isAnimated*/ ctx[2] ? 'go' : '') + " " + (/*lastGoLeft*/ ctx[1] ? 'go-invert' : '') + " svelte-gg5k96")) {
    				attr_dev(div, "class", div_class_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			/*div_binding*/ ctx[5](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(248:0) {#if isVisible}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let if_block_anchor;
    	let if_block = /*isVisible*/ ctx[4] && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*isVisible*/ ctx[4]) if_block.p(ctx, dirty);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
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

    function instance$2($$self, $$props, $$invalidate) {
    	let $setupScore;
    	let $setupDisplay;
    	let $doReset;
    	validate_store(setupScore, 'setupScore');
    	component_subscribe($$self, setupScore, $$value => $$invalidate(15, $setupScore = $$value));
    	validate_store(setupDisplay, 'setupDisplay');
    	component_subscribe($$self, setupDisplay, $$value => $$invalidate(16, $setupDisplay = $$value));
    	validate_store(doReset, 'doReset');
    	component_subscribe($$self, doReset, $$value => $$invalidate(3, $doReset = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Personage', slots, []);
    	let player;
    	let x, y, prevX, prevY;
    	let touchStartCoords;
    	let touchNowCoords;
    	let lastGoLeft = false;
    	let isVisible = true;
    	let isAnimated = false;
    	let timerAnimated;

    	doReset.subscribe(item => {
    		if (item) {
    			setTimeout(() => doReset.set(false), setupApp.speed / 2);
    		}
    	});

    	setupPersonage.subscribe(item => {
    		x = item.x;
    		y = item.y;
    		if (prevX == undefined) prevX = x;
    		if (prevY == undefined) prevY = y;
    		if (!player) return;
    		$$invalidate(0, player.style.left = `${x * setupApp.size}vmin`, player);
    		$$invalidate(0, player.style.top = `${y * setupApp.size}vmin`, player);

    		if (prevX != x || prevY != y) {
    			if (x < prevX) {
    				$$invalidate(1, lastGoLeft = true);
    			} else if (x > prevX) $$invalidate(1, lastGoLeft = false);

    			$$invalidate(2, isAnimated = true);
    			if (timerAnimated) clearTimeout(timerAnimated);
    			timerAnimated = setTimeout(() => $$invalidate(2, isAnimated = false), 500);
    			prevX = x;
    			prevY = y;
    		}
    	});

    	onMount(() => {
    		$$invalidate(0, player.style.left = `${-1 * setupApp.size}vmin`, player);
    		$$invalidate(0, player.style.top = `${-1 * setupApp.size}vmin`, player);
    	});

    	const movePosition = (dx, dy) => {
    		x = Math.min(Math.max(0, x += dx), setupApp.map - 1);
    		y = Math.min(Math.max(0, y += dy), setupApp.map - 1);
    		setupPersonage.set({ x, y });
    		let display = $setupDisplay;
    		const whatOnPlace = display[x + y * setupApp.map];

    		if ($setupScore.gotDiamonds < $setupScore.diamonds && whatOnPlace > 100) {
    			let score = $setupScore;

    			switch (whatOnPlace) {
    				case 200:
    					score.gotPlants += 1;
    					score.current = Math.max(score.current - score.plants, 0);
    					break;
    				case 300:
    					score.gotDiamonds += 1;
    					score.current = score.current + score.diamonds;
    					break;
    			}

    			setupScore.set(score);
    		}

    		display[x + y * setupApp.map] = 100;
    		setupDisplay.set(display);
    	};

    	let timerX, timerY;

    	const leftGo = () => {
    		if (timerX || timerY) return;

    		timerX = setInterval(
    			() => {
    				movePosition(-1, 0);
    			},
    			setupApp.speed
    		);

    		movePosition(-1, 0);
    	};

    	const rightGo = () => {
    		if (timerX || timerY) return;

    		timerX = setInterval(
    			() => {
    				movePosition(+1, 0);
    			},
    			setupApp.speed
    		);

    		movePosition(+1, 0);
    	};

    	const upGo = () => {
    		if (timerX || timerY) return;

    		timerY = setInterval(
    			() => {
    				movePosition(0, -1);
    			},
    			setupApp.speed
    		);

    		movePosition(0, -1);
    	};

    	const downGo = () => {
    		if (timerX || timerY) return;

    		timerY = setInterval(
    			() => {
    				movePosition(0, +1);
    			},
    			setupApp.speed
    		);

    		movePosition(0, +1);
    	};

    	const xStop = () => {
    		clearInterval(timerX);
    		timerX = undefined;
    	};

    	const yStop = () => {
    		clearInterval(timerY);
    		timerY = undefined;
    	};

    	const callGo = {
    		ArrowLeft: leftGo,
    		ArrowRight: rightGo,
    		ArrowUp: upGo,
    		ArrowDown: downGo
    	};

    	const callStop = {
    		ArrowLeft: xStop,
    		ArrowRight: xStop,
    		ArrowUp: yStop,
    		ArrowDown: yStop
    	};

    	document.addEventListener("keydown", event => {
    		callGo[event.key]?.();
    	});

    	document.addEventListener("keyup", event => {
    		callStop[event.key]?.();
    	});

    	document.addEventListener("touchstart", event => {
    		touchStartCoords = {
    			x: Math.floor(event.touches[0].clientX),
    			y: Math.floor(event.touches[0].clientY)
    		};
    	});

    	document.addEventListener("touchmove", event => {
    		touchNowCoords = {
    			x: Math.floor(event.touches[0].clientX),
    			y: Math.floor(event.touches[0].clientY)
    		};

    		if (touchNowCoords.x < touchStartCoords.x - setupApp.touchPadding) callGo.ArrowLeft();
    		if (touchNowCoords.x > touchStartCoords.x + setupApp.touchPadding) callGo.ArrowRight();
    		if (touchNowCoords.y < touchStartCoords.y - setupApp.touchPadding) callGo.ArrowUp();
    		if (touchNowCoords.y > touchStartCoords.y + setupApp.touchPadding) callGo.ArrowDown();
    	});

    	document.addEventListener("touchend", event => {
    		xStop();
    		yStop();
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Personage> was created with unknown prop '${key}'`);
    	});

    	function div_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			player = $$value;
    			$$invalidate(0, player);
    		});
    	}

    	$$self.$capture_state = () => ({
    		onMount,
    		onDestroy,
    		fade,
    		fly,
    		setupApp,
    		setupDisplay,
    		setupPersonage,
    		setupScore,
    		doReset,
    		xyPersonage,
    		player,
    		x,
    		y,
    		prevX,
    		prevY,
    		touchStartCoords,
    		touchNowCoords,
    		lastGoLeft,
    		isVisible,
    		isAnimated,
    		timerAnimated,
    		movePosition,
    		timerX,
    		timerY,
    		leftGo,
    		rightGo,
    		upGo,
    		downGo,
    		xStop,
    		yStop,
    		callGo,
    		callStop,
    		$setupScore,
    		$setupDisplay,
    		$doReset
    	});

    	$$self.$inject_state = $$props => {
    		if ('player' in $$props) $$invalidate(0, player = $$props.player);
    		if ('x' in $$props) x = $$props.x;
    		if ('y' in $$props) y = $$props.y;
    		if ('prevX' in $$props) prevX = $$props.prevX;
    		if ('prevY' in $$props) prevY = $$props.prevY;
    		if ('touchStartCoords' in $$props) touchStartCoords = $$props.touchStartCoords;
    		if ('touchNowCoords' in $$props) touchNowCoords = $$props.touchNowCoords;
    		if ('lastGoLeft' in $$props) $$invalidate(1, lastGoLeft = $$props.lastGoLeft);
    		if ('isVisible' in $$props) $$invalidate(4, isVisible = $$props.isVisible);
    		if ('isAnimated' in $$props) $$invalidate(2, isAnimated = $$props.isAnimated);
    		if ('timerAnimated' in $$props) timerAnimated = $$props.timerAnimated;
    		if ('timerX' in $$props) timerX = $$props.timerX;
    		if ('timerY' in $$props) timerY = $$props.timerY;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [player, lastGoLeft, isAnimated, $doReset, isVisible, div_binding];
    }

    class Personage extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {}, add_css$2);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Personage",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src/items/Field.svelte generated by Svelte v3.59.2 */
    const file$1 = "src/items/Field.svelte";

    function add_css$1(target) {
    	append_styles(target, "svelte-rfkxdt", ".field.svelte-rfkxdt{position:relative;width:calc(16 * 5vmin);height:calc(16 * 5vmin);border-radius:1vmin;display:flex;flex-direction:row;flex-wrap:wrap;overflow:hidden;box-shadow:rgb(10, 10, 10) 0vmin 0vmin 10vmin}.overlay.svelte-rfkxdt{position:absolute;width:100%;height:100%;overflow:hidden}.road.svelte-rfkxdt{position:absolute;width:100%;height:100%;opacity:0.5;filter:blur(32px)}.ground-plot{position:absolute;width:15vmin;height:15vmin;background-color:#000;border-radius:50%}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRmllbGQuc3ZlbHRlIiwic291cmNlcyI6WyJGaWVsZC5zdmVsdGUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdD5cbiAgaW1wb3J0IHsgZ2V0LCB3cml0YWJsZSB9IGZyb20gXCJzdmVsdGUvc3RvcmVcIlxuICBpbXBvcnQgeyBzZXR1cEFwcCwgc2V0dXBEaXNwbGF5LCBzZXR1cFBlcnNvbmFnZSwgZG9SZXNldCwgc2V0dXBTY29yZSB9IGZyb20gXCIuLi9zdG9yZXMvc3RvcmUuanNcIlxuICBpbXBvcnQgZ3NhcCwgeyBMaW5lYXIgfSBmcm9tIFwiZ3NhcFwiXG4gIGltcG9ydCB7IE1vdGlvblBhdGhQbHVnaW4gfSBmcm9tIFwiZ3NhcC9Nb3Rpb25QYXRoUGx1Z2luXCJcblxuICBpbXBvcnQgUnVieSBmcm9tIFwiLi9SdWJ5LnN2ZWx0ZVwiXG4gIGltcG9ydCBQbGFudCBmcm9tIFwiLi9QbGFudC5zdmVsdGVcIlxuICBpbXBvcnQgR3JvdW5kIGZyb20gXCIuL0dyb3VuZC5zdmVsdGVcIlxuICBpbXBvcnQgUGVyc29uYWdlIGZyb20gXCIuL1BlcnNvbmFnZS5zdmVsdGVcIlxuICBpbXBvcnQgeyBvbk1vdW50IH0gZnJvbSBcInN2ZWx0ZVwiXG5cbiAgZ3NhcC5jb25maWcoe1xuICAgIGZvcmNlM0Q6IGZhbHNlLFxuICAgIG51bGxUYXJnZXRXYXJuOiBmYWxzZSxcbiAgICB0cmlhbFdhcm46IGZhbHNlLFxuICAgIHVuaXRzOiB7eDogXCJweFwiLCB5OiBcInB4XCIsIGxlZnQ6IFwiJVwiLCB0b3A6IFwiJVwiLCByb3RhdGlvbjogXCJyYWRcIn1cbiAgfSk7XG4gIGdzYXAucmVnaXN0ZXJQbHVnaW4oTW90aW9uUGF0aFBsdWdpbilcbiAgbGV0IGdyb3VuZHJvYWRcblxuICBjb25zdCBwbG90cyA9IDQ4XG4gIGNvbnN0IGR1cmF0aW9uID0gMTVcbiAgY29uc3Qgcm9hZCA9IFsgeyB4Oi0xLCB5Oi0xIH0sIHsgeDowLHk6MCB9LCB7IHg6Mix5OjR9LCB7IHg6Nyx5OjEwfSwgeyB4OjEwLHk6NCB9LCB7IHg6MTUseToxNSB9LCB7IHg6MTYseToxNiB9IF1cbiAgbGV0IGRvdHMgPSBbXSwgcnVieXMgPSBbXVxuICBsZXQgdGwsIHRyLCByZVJvYWRcblxuICBjb25zdCByZWNhbGN1bGF0ZVJvYWQgPSAoKSA9PiB7XG5cbiAgICAvLyBORVcgRURHRSBDT09SRElOQVRFU1xuICAgIGNvbnN0IGdldE5leHRQb3NpdGlvbiA9IChwcmV2aW91cykgPT4ge1xuICAgICAgbGV0IG5leHRQb3NpdGlvbiA9IE1hdGgubWluKE1hdGgubWF4KDAsIE1hdGguZmxvb3IocHJldmlvdXMgKyAxICsgKE1hdGgucmFuZG9tKCkgKiA0KSkpLCBzZXR1cEFwcC5tYXAgLSAxKVxuICAgICAgcmV0dXJuIG5leHRQb3NpdGlvblxuICAgIH1cbiAgICBsZXQgcG9zaXRpb24gPSB7IC4uLnJvYWRbMF0gfVxuICAgIGZvciAobGV0IGkgPSAxOyBpIDwgNjsgaSsrKSB7XG4gICAgICByb2FkW2ldID0ge1xuICAgICAgICB4OiBnZXROZXh0UG9zaXRpb24ocm9hZFtpLTFdLngpLFxuICAgICAgICB5OiBnZXROZXh0UG9zaXRpb24ocm9hZFtpLTFdLnkpXG4gICAgICB9XG4gICAgfVxuICAgIHNldHVwUGVyc29uYWdlLnNldChwb3NpdGlvbilcblxuICAgIC8vIFJFRFJBVyBSVUJZU1xuICAgIHJ1YnlzLmxlbmd0aCA9IDBcbiAgICBzZXRUaW1lb3V0KCgpID0+IHJ1YnlzID0gWyAuLi5yb2FkIF0sIDApXG5cbiAgICAvLyBSRURSQVcgUk9BRFxuICAgIGRvdHMuZm9yRWFjaCgoZG90KSA9PiB7XG4gICAgICBkb3QucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChkb3QpXG4gICAgfSlcbiAgICBkb3RzLmxlbmd0aCA9IDBcblxuICAgIGlmICghdHIpIHtcbiAgICAgIHRyID0gbmV3IGdzYXAudGltZWxpbmUoKVxuICAgIH0gZWxzZSB7XG4gICAgICB0ci5jbGVhcigpXG4gICAgICB0ci5zZWVrKDApXG4gICAgfVxuICAgIGxldCBjb3VudGVyID0gMFxuICAgIHRyLnRvKHBvc2l0aW9uLCB7IGR1cmF0aW9uOiAwLjUsIG1vdGlvblBhdGg6IHsgcGF0aDogcm9hZCwgY3VydmluZXNzOiAxIH0sIGVhc2U6IGBzdGVwcygke3Bsb3RzfSlgLCBpbW1lZGlhdGVSZW5kZXI6IHRydWUsIG9uVXBkYXRlKCkgeyBcbiAgICAgIGNvdW50ZXIrK1xuICAgICAgY29uc3QgZG90ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuICAgICAgZG90LmlkID0gYGdyb3VuZF8ke2NvdW50ZXJ9YFxuICAgICAgZG90LmNsYXNzTGlzdC5hZGQoJ2dyb3VuZC1wbG90JylcbiAgICAgIGRvdC5zdHlsZS5sZWZ0ID0gYCR7cG9zaXRpb24ueCAqIHNldHVwQXBwLnNpemV9dm1pbmBcbiAgICAgIGRvdC5zdHlsZS50b3AgPSBgJHtwb3NpdGlvbi55ICogc2V0dXBBcHAuc2l6ZX12bWluYFxuICAgICAgZ3JvdW5kcm9hZC5hcHBlbmRDaGlsZChkb3QpXG4gICAgICBkb3RzLnB1c2goZG90KVxuICAgIH0gfSApXG5cbiAgICAvLyBSVU4gVEhFIFBFUlNPTkFHRVxuICAgIGlmICghdGwpIHtcbiAgICAgIHRsID0gbmV3IGdzYXAudGltZWxpbmUoeyByZXBlYXQ6IC0xLCBvblJlcGVhdDogKCkgPT4geyBcbiAgICAgICAgZG9SZXNldC5zZXQodHJ1ZSlcbiAgICAgICAgcmVSb2FkID0gdW5kZWZpbmVkXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4gcmVjYWxjdWxhdGVSb2FkKCksIDApXG4gICAgICB9IH0pXG4gICAgfSBlbHNlIHtcbiAgICAgIHRsLmNsZWFyKClcbiAgICAgIHRsLnNlZWsoMClcbiAgICB9XG4gICAgdGwudG8ocG9zaXRpb24sIHsgZHVyYXRpb24sIG1vdGlvblBhdGg6IHsgcGF0aDogcm9hZCwgY3VydmluZXNzOiAxIH0sIGVhc2U6ICdub25lJywgb25VcGRhdGUoKSB7IFxuICAgICAgc2V0dXBQZXJzb25hZ2Uuc2V0KHBvc2l0aW9uKVxuXG4gICAgICBpZiAocnVieXMubGVuZ3RoICE9PSAwKSB7XG4gICAgICAgIGNvbnN0IHJvdW5kWCA9IE1hdGguZmxvb3IocG9zaXRpb24ueClcbiAgICAgICAgY29uc3Qgcm91bmRZID0gTWF0aC5mbG9vcihwb3NpdGlvbi55KVxuICAgICAgICBjb25zdCBmb3VuZFJ1YnkgPSBydWJ5cy5maW5kSW5kZXgoKHJ1YnkpID0+IHJvdW5kWCAhPT0gLTEgJiYgcnVieS54ID09IHJvdW5kWCAmJiBydWJ5LnkgPT0gcm91bmRZKVxuICAgICAgICBpZiAoZm91bmRSdWJ5ID4gLTEpIHtcbiAgICAgICAgICBydWJ5c1tmb3VuZFJ1YnldLnJlbW92ZWQgPSB0cnVlXG4gICAgICAgICAgc2V0dXBTY29yZS5zZXQoeyBjdXJyZW50OiAkc2V0dXBTY29yZS5jdXJyZW50KzEgfSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gfSlcbiAgfVxuICBcbiAgb25Nb3VudCgoKSA9PiB7XG4gICAgc2V0VGltZW91dCgoKSA9PiByZWNhbGN1bGF0ZVJvYWQoKSwgMTAwKVxuICB9KVxuXG48L3NjcmlwdD5cblxuPHN0eWxlPlxuICAuZmllbGQge1xuICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgICB3aWR0aDogY2FsYygxNiAqIDV2bWluKTtcbiAgICBoZWlnaHQ6IGNhbGMoMTYgKiA1dm1pbik7XG4gICAgYm9yZGVyLXJhZGl1czogMXZtaW47XG4gICAgZGlzcGxheTogZmxleDtcbiAgICBmbGV4LWRpcmVjdGlvbjogcm93O1xuICAgIGZsZXgtd3JhcDogd3JhcDtcbiAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgIGJveC1zaGFkb3c6IHJnYigxMCwgMTAsIDEwKSAwdm1pbiAwdm1pbiAxMHZtaW47XG4gIH1cbiAgLm92ZXJsYXkge1xuICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICB3aWR0aDogMTAwJTtcbiAgICBoZWlnaHQ6IDEwMCU7XG4gICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgfVxuICAucm9hZCB7XG4gICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgIHdpZHRoOiAxMDAlO1xuICAgIGhlaWdodDogMTAwJTtcbiAgICBvcGFjaXR5OiAwLjU7XG4gICAgZmlsdGVyOiBibHVyKDMycHgpO1xuICB9XG4gIDpnbG9iYWwoLmdyb3VuZC1wbG90KSB7XG4gICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgIHdpZHRoOiAxNXZtaW47XG4gICAgaGVpZ2h0OiAxNXZtaW47XG4gICAgYmFja2dyb3VuZC1jb2xvcjogIzAwMDtcbiAgICBib3JkZXItcmFkaXVzOiA1MCU7XG4gIH1cbjwvc3R5bGU+XG5cbjxkaXYgY2xhc3M9XCJmaWVsZFwiPlxuICBcbiAgPGRpdiBjbGFzcz1cInJvYWRcIiBiaW5kOnRoaXM9e2dyb3VuZHJvYWR9PjwvZGl2PlxuXG4gIDxkaXYgY2xhc3M9XCJvdmVybGF5XCI+XG4gICAgPFBlcnNvbmFnZSBpZD1cInswfVwiIG1vZGU9XCJ7MH1cIiAvPlxuICA8L2Rpdj5cblxuICB7I2lmIHJ1YnlzLmxlbmd0aCAhPT0gMH1cbiAgICB7I2VhY2ggcnVieXMgYXMgaXRlbSwgaX1cbiAgICAgIHsjaWYgKGk+MCkgJiYgKGk8Nil9XG4gICAgICAgIHsjaWYgIWl0ZW0ucmVtb3ZlZCB9XG4gICAgICAgICAgPFJ1YnkgaWQ9XCJ7aX1cIiBtb2RlPVwie2l0ZW19XCIgLz5cbiAgICAgICAgey9pZn1cbiAgICAgIHsvaWZ9XG4gICAgey9lYWNofVxuICB7L2lmfVxuXG5cblxuICA8IS0tIHsjZWFjaCAkc2V0dXBEaXNwbGF5IGFzIGl0ZW0sIGl9XG4gICAgeyNpZiBpdGVtID09IDMwMH1cbiAgICAgIDxSdWJ5IGlkPVwie2l9XCIgbW9kZT1cIntpdGVtfVwiIC8+XG4gICAgezplbHNlIGlmIGl0ZW0gPT0gMjAwfVxuICAgICAgPFBsYW50IGlkPVwie2l9XCIgbW9kZT1cIntpdGVtfVwiIC8+XG4gICAgezplbHNlfVxuICAgICAgPEdyb3VuZCBpZD1cIntpfVwiIG1vZGU9XCJ7aXRlbX1cIiAvPlxuICAgIHsvaWZ9XG4gIHsvZWFjaH1cbiAgPGRpdiBjbGFzcz1cIm92ZXJsYXlcIj5cbiAgICA8UGVyc29uYWdlIGlkPVwiezB9XCIgbW9kZT1cInswfVwiIC8+XG4gIDwvZGl2IC0tPlxuPC9kaXY+XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBd0dFLG9CQUFPLENBQ0wsUUFBUSxDQUFFLFFBQVEsQ0FDbEIsS0FBSyxDQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FDdkIsTUFBTSxDQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FDeEIsYUFBYSxDQUFFLEtBQUssQ0FDcEIsT0FBTyxDQUFFLElBQUksQ0FDYixjQUFjLENBQUUsR0FBRyxDQUNuQixTQUFTLENBQUUsSUFBSSxDQUNmLFFBQVEsQ0FBRSxNQUFNLENBQ2hCLFVBQVUsQ0FBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFDMUMsQ0FDQSxzQkFBUyxDQUNQLFFBQVEsQ0FBRSxRQUFRLENBQ2xCLEtBQUssQ0FBRSxJQUFJLENBQ1gsTUFBTSxDQUFFLElBQUksQ0FDWixRQUFRLENBQUUsTUFDWixDQUNBLG1CQUFNLENBQ0osUUFBUSxDQUFFLFFBQVEsQ0FDbEIsS0FBSyxDQUFFLElBQUksQ0FDWCxNQUFNLENBQUUsSUFBSSxDQUNaLE9BQU8sQ0FBRSxHQUFHLENBQ1osTUFBTSxDQUFFLEtBQUssSUFBSSxDQUNuQixDQUNRLFlBQWMsQ0FDcEIsUUFBUSxDQUFFLFFBQVEsQ0FDbEIsS0FBSyxDQUFFLE1BQU0sQ0FDYixNQUFNLENBQUUsTUFBTSxDQUNkLGdCQUFnQixDQUFFLElBQUksQ0FDdEIsYUFBYSxDQUFFLEdBQ2pCIn0= */");
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[10] = list[i];
    	child_ctx[12] = i;
    	return child_ctx;
    }

    // (146:2) {#if rubys.length !== 0}
    function create_if_block$1(ctx) {
    	let each_1_anchor;
    	let current;
    	let each_value = /*rubys*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(target, anchor);
    				}
    			}

    			insert_dev(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*rubys*/ 2) {
    				each_value = /*rubys*/ ctx[1];
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
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(146:2) {#if rubys.length !== 0}",
    		ctx
    	});

    	return block;
    }

    // (148:6) {#if (i>0) && (i<6)}
    function create_if_block_1$1(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = !/*item*/ ctx[10].removed && create_if_block_2(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!/*item*/ ctx[10].removed) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*rubys*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block_2(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(148:6) {#if (i>0) && (i<6)}",
    		ctx
    	});

    	return block;
    }

    // (149:8) {#if !item.removed }
    function create_if_block_2(ctx) {
    	let ruby;
    	let current;

    	ruby = new Ruby({
    			props: {
    				id: /*i*/ ctx[12],
    				mode: /*item*/ ctx[10]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(ruby.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(ruby, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const ruby_changes = {};
    			if (dirty & /*rubys*/ 2) ruby_changes.mode = /*item*/ ctx[10];
    			ruby.$set(ruby_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(ruby.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(ruby.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(ruby, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(149:8) {#if !item.removed }",
    		ctx
    	});

    	return block;
    }

    // (147:4) {#each rubys as item, i}
    function create_each_block(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*i*/ ctx[12] > 0 && /*i*/ ctx[12] < 6 && create_if_block_1$1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (/*i*/ ctx[12] > 0 && /*i*/ ctx[12] < 6) if_block.p(ctx, dirty);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(147:4) {#each rubys as item, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div2;
    	let div0;
    	let t0;
    	let div1;
    	let personage;
    	let t1;
    	let current;

    	personage = new Personage({
    			props: { id: 0, mode: 0 },
    			$$inline: true
    		});

    	let if_block = /*rubys*/ ctx[1].length !== 0 && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			t0 = space();
    			div1 = element("div");
    			create_component(personage.$$.fragment);
    			t1 = space();
    			if (if_block) if_block.c();
    			attr_dev(div0, "class", "road svelte-rfkxdt");
    			add_location(div0, file$1, 139, 2, 3666);
    			attr_dev(div1, "class", "overlay svelte-rfkxdt");
    			add_location(div1, file$1, 141, 2, 3717);
    			attr_dev(div2, "class", "field svelte-rfkxdt");
    			add_location(div2, file$1, 137, 0, 3641);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			/*div0_binding*/ ctx[2](div0);
    			append_dev(div2, t0);
    			append_dev(div2, div1);
    			mount_component(personage, div1, null);
    			append_dev(div2, t1);
    			if (if_block) if_block.m(div2, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*rubys*/ ctx[1].length !== 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*rubys*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div2, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(personage.$$.fragment, local);
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(personage.$$.fragment, local);
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			/*div0_binding*/ ctx[2](null);
    			destroy_component(personage);
    			if (if_block) if_block.d();
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

    const plots = 48;
    const duration = 15;

    function instance$1($$self, $$props, $$invalidate) {
    	let $setupScore;
    	validate_store(setupScore, 'setupScore');
    	component_subscribe($$self, setupScore, $$value => $$invalidate(8, $setupScore = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Field', slots, []);

    	gsap$2.config({
    		force3D: false,
    		nullTargetWarn: false,
    		trialWarn: false,
    		units: {
    			x: "px",
    			y: "px",
    			left: "%",
    			top: "%",
    			rotation: "rad"
    		}
    	});

    	gsap$2.registerPlugin(MotionPathPlugin);
    	let groundroad;

    	const road = [
    		{ x: -1, y: -1 },
    		{ x: 0, y: 0 },
    		{ x: 2, y: 4 },
    		{ x: 7, y: 10 },
    		{ x: 10, y: 4 },
    		{ x: 15, y: 15 },
    		{ x: 16, y: 16 }
    	];

    	let dots = [], rubys = [];
    	let tl, tr, reRoad;

    	const recalculateRoad = () => {
    		// NEW EDGE COORDINATES
    		const getNextPosition = previous => {
    			let nextPosition = Math.min(Math.max(0, Math.floor(previous + 1 + Math.random() * 4)), setupApp.map - 1);
    			return nextPosition;
    		};

    		let position = { ...road[0] };

    		for (let i = 1; i < 6; i++) {
    			road[i] = {
    				x: getNextPosition(road[i - 1].x),
    				y: getNextPosition(road[i - 1].y)
    			};
    		}

    		setupPersonage.set(position);

    		// REDRAW RUBYS
    		$$invalidate(1, rubys.length = 0, rubys);

    		setTimeout(() => $$invalidate(1, rubys = [...road]), 0);

    		// REDRAW ROAD
    		dots.forEach(dot => {
    			dot.parentElement.removeChild(dot);
    		});

    		dots.length = 0;

    		if (!tr) {
    			tr = new gsap$2.timeline();
    		} else {
    			tr.clear();
    			tr.seek(0);
    		}

    		let counter = 0;

    		tr.to(position, {
    			duration: 0.5,
    			motionPath: { path: road, curviness: 1 },
    			ease: `steps(${plots})`,
    			immediateRender: true,
    			onUpdate() {
    				counter++;
    				const dot = document.createElement("div");
    				dot.id = `ground_${counter}`;
    				dot.classList.add('ground-plot');
    				dot.style.left = `${position.x * setupApp.size}vmin`;
    				dot.style.top = `${position.y * setupApp.size}vmin`;
    				groundroad.appendChild(dot);
    				dots.push(dot);
    			}
    		});

    		// RUN THE PERSONAGE
    		if (!tl) {
    			tl = new gsap$2.timeline({
    					repeat: -1,
    					onRepeat: () => {
    						doReset.set(true);
    						reRoad = undefined;
    						setTimeout(() => recalculateRoad(), 0);
    					}
    				});
    		} else {
    			tl.clear();
    			tl.seek(0);
    		}

    		tl.to(position, {
    			duration,
    			motionPath: { path: road, curviness: 1 },
    			ease: 'none',
    			onUpdate() {
    				setupPersonage.set(position);

    				if (rubys.length !== 0) {
    					const roundX = Math.floor(position.x);
    					const roundY = Math.floor(position.y);
    					const foundRuby = rubys.findIndex(ruby => roundX !== -1 && ruby.x == roundX && ruby.y == roundY);

    					if (foundRuby > -1) {
    						$$invalidate(1, rubys[foundRuby].removed = true, rubys);
    						setupScore.set({ current: $setupScore.current + 1 });
    					}
    				}
    			}
    		});
    	};

    	onMount(() => {
    		setTimeout(() => recalculateRoad(), 100);
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Field> was created with unknown prop '${key}'`);
    	});

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			groundroad = $$value;
    			$$invalidate(0, groundroad);
    		});
    	}

    	$$self.$capture_state = () => ({
    		get: get_store_value,
    		writable,
    		setupApp,
    		setupDisplay,
    		setupPersonage,
    		doReset,
    		setupScore,
    		gsap: gsap$2,
    		Linear: gsap$2.Linear,
    		MotionPathPlugin,
    		Ruby,
    		Plant,
    		Ground,
    		Personage,
    		onMount,
    		groundroad,
    		plots,
    		duration,
    		road,
    		dots,
    		rubys,
    		tl,
    		tr,
    		reRoad,
    		recalculateRoad,
    		$setupScore
    	});

    	$$self.$inject_state = $$props => {
    		if ('groundroad' in $$props) $$invalidate(0, groundroad = $$props.groundroad);
    		if ('dots' in $$props) dots = $$props.dots;
    		if ('rubys' in $$props) $$invalidate(1, rubys = $$props.rubys);
    		if ('tl' in $$props) tl = $$props.tl;
    		if ('tr' in $$props) tr = $$props.tr;
    		if ('reRoad' in $$props) reRoad = $$props.reRoad;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [groundroad, rubys, div0_binding];
    }

    class Field extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {}, add_css$1);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Field",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.59.2 */
    const file = "src/App.svelte";

    function add_css(target) {
    	append_styles(target, "svelte-jeasp9", ":root{--widget-border-radius:5px;--widget-background:rgba(16, 16, 16, 0.8);--widget-background-blur-amount:10px;--widget-background-blur:blur(10px);--color-title:rgb(186, 225, 225);--color-max:#fff;--color-middle:#aaa;--color-dark:gray;--color-basic:#eee;--color-active:rgb(200, 200, 137);--color-warning:#f6f18b;--color-border:silver}html{-webkit-text-size-adjust:100%}*{-webkit-touch-callout:none;-webkit-user-select:none;-khtml-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none}.container.svelte-jeasp9.svelte-jeasp9{background:#1b2229;background:url(\"./assets/concrete.jpg\") center center;background-size:15vmin;background-repeat:repeat;display:flex;width:100vw;height:100vh;align-items:center;justify-content:center}.header.svelte-jeasp9.svelte-jeasp9{display:flex;position:absolute;top:0;width:100%;justify-content:space-between;font-family:\"Press Start 2P\", cursive;font-size:150%}.header.svelte-jeasp9>.svelte-jeasp9{color:#f0f0f0;padding:1em}.won.svelte-jeasp9.svelte-jeasp9{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100vw;height:100vh;backdrop-filter:blur(1vmin);-webkit-backdrop-filter:blur(1vmin);font-family:\"Press Start 2P\", cursive;color:#fff;text-align:center;z-index:1}.won.svelte-jeasp9 .title.svelte-jeasp9{font-size:clamp(1rem, 3vw, 3.5rem)}.won.svelte-jeasp9 .score.svelte-jeasp9{font-size:clamp(2rem, 6vw, 7rem)}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXBwLnN2ZWx0ZSIsInNvdXJjZXMiOlsiQXBwLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxuICBpbXBvcnQgeyBvbk1vdW50IH0gZnJvbSBcInN2ZWx0ZVwiXG4gIGltcG9ydCB7IHNwcmluZyB9IGZyb20gXCJzdmVsdGUvbW90aW9uXCJcbiAgaW1wb3J0IHsgZmFkZSwgZmx5IH0gZnJvbSBcInN2ZWx0ZS90cmFuc2l0aW9uXCJcbiAgaW1wb3J0IHsgc2V0dXBBcHAsIHNldHVwRGlzcGxheSwgc2V0dXBQZXJzb25hZ2UsIHNldHVwU2NvcmUsIGRvUmVzZXQgfSBmcm9tIFwiLi9zdG9yZXMvc3RvcmUuanNcIlxuICBpbXBvcnQgRmllbGQgZnJvbSBcIi4vaXRlbXMvRmllbGQuc3ZlbHRlXCJcblxuICBOdW1iZXIucHJvdG90eXBlLnBhZCA9IGZ1bmN0aW9uIChzaXplKSB7XG4gICAgdmFyIHMgPSBTdHJpbmcodGhpcylcbiAgICB3aGlsZSAocy5sZW5ndGggPCAoc2l6ZSB8fCAyKSkge1xuICAgICAgcyA9IFwiMFwiICsgc1xuICAgIH1cbiAgICByZXR1cm4gc1xuICB9XG5cbiAgbGV0IHNjb3JlID0gc3ByaW5nKFxuICAgIHsgY3VycmVudDogMCwgbGVmdDogMCB9LFxuICAgIHtcbiAgICAgIHN0aWZmbmVzczogMC4wMSxcbiAgICAgIGRhbXBpbmc6IDAuOSxcbiAgICB9XG4gIClcblxuICBsZXQgY29udGFpbmVyXG5cbiAgbGV0IGlzV29uID0gZmFsc2VcbiAgbGV0IGlzVmlzaWJsZSA9IGZhbHNlXG4gIFxuICBzZXR1cFNjb3JlLnNldCh7XG4gICAgY3VycmVudDogMCxcbiAgfSlcblxuICAkOiB7XG4gICAgc2NvcmUuc2V0KHsgY3VycmVudDogJHNldHVwU2NvcmUuY3VycmVudCB9KVxuICB9IFxuXG4gIG9uTW91bnQoKCkgPT4ge1xuICAgIGlzVmlzaWJsZSA9IHRydWVcbiAgICBjb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gYCR7d2luZG93LmlubmVySGVpZ2h0fXB4YFxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwicmVzaXplXCIsIGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgY29udGFpbmVyLnN0eWxlLmhlaWdodCA9IGAke3dpbmRvdy5pbm5lckhlaWdodH1weGBcbiAgICAgIGRvUmVzZXQuc2V0KHRydWUpXG4gICAgfSlcbiAgfSlcbjwvc2NyaXB0PlxuXG48c3R5bGU+XG4gIC8qIE9WRVJBTEwgVklFVyAqL1xuICA6cm9vdCB7XG4gICAgLS13aWRnZXQtYm9yZGVyLXJhZGl1czogNXB4O1xuICAgIC0td2lkZ2V0LWJhY2tncm91bmQ6IHJnYmEoMTYsIDE2LCAxNiwgMC44KTtcbiAgICAtLXdpZGdldC1iYWNrZ3JvdW5kLWJsdXItYW1vdW50OiAxMHB4O1xuICAgIC0td2lkZ2V0LWJhY2tncm91bmQtYmx1cjogYmx1cigxMHB4KTtcblxuICAgIC0tY29sb3ItdGl0bGU6IHJnYigxODYsIDIyNSwgMjI1KTtcbiAgICAtLWNvbG9yLW1heDogI2ZmZjtcbiAgICAtLWNvbG9yLW1pZGRsZTogI2FhYTtcbiAgICAtLWNvbG9yLWRhcms6IGdyYXk7XG4gICAgLS1jb2xvci1iYXNpYzogI2VlZTtcbiAgICAtLWNvbG9yLWFjdGl2ZTogcmdiKDIwMCwgMjAwLCAxMzcpO1xuICAgIC0tY29sb3Itd2FybmluZzogI2Y2ZjE4YjtcbiAgICAtLWNvbG9yLWJvcmRlcjogc2lsdmVyO1xuICB9XG4gIDpnbG9iYWwoaHRtbCkge1xuICAgIC13ZWJraXQtdGV4dC1zaXplLWFkanVzdDogMTAwJTtcbiAgfVxuICA6Z2xvYmFsKCopIHtcbiAgICAtd2Via2l0LXRvdWNoLWNhbGxvdXQ6IG5vbmU7IC8qIGlPUyBTYWZhcmkgKi9cbiAgICAtd2Via2l0LXVzZXItc2VsZWN0OiBub25lOyAvKiBTYWZhcmkgKi9cbiAgICAta2h0bWwtdXNlci1zZWxlY3Q6IG5vbmU7IC8qIEtvbnF1ZXJvciBIVE1MICovXG4gICAgLW1vei11c2VyLXNlbGVjdDogbm9uZTsgLyogT2xkIHZlcnNpb25zIG9mIEZpcmVmb3ggKi9cbiAgICAtbXMtdXNlci1zZWxlY3Q6IG5vbmU7IC8qIEludGVybmV0IEV4cGxvcmVyL0VkZ2UgKi9cbiAgICB1c2VyLXNlbGVjdDogbm9uZTsgLyogTm9uLXByZWZpeGVkIHZlcnNpb24sIGN1cnJlbnRseSBzdXBwb3J0ZWQgYnkgQ2hyb21lLCBFZGdlLCBPcGVyYSBhbmQgRmlyZWZveCAqL1xuICB9XG5cbiAgLmNvbnRhaW5lciB7XG4gICAgYmFja2dyb3VuZDogIzFiMjIyOTtcbiAgICBiYWNrZ3JvdW5kOiB1cmwoXCIuL2Fzc2V0cy9jb25jcmV0ZS5qcGdcIikgY2VudGVyIGNlbnRlcjtcbiAgICBiYWNrZ3JvdW5kLXNpemU6IDE1dm1pbjtcbiAgICBiYWNrZ3JvdW5kLXJlcGVhdDogcmVwZWF0O1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgd2lkdGg6IDEwMHZ3O1xuICAgIGhlaWdodDogMTAwdmg7XG4gICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgfVxuICAuaGVhZGVyIHtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICB0b3A6IDA7XG4gICAgd2lkdGg6IDEwMCU7XG4gICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgIGZvbnQtZmFtaWx5OiBcIlByZXNzIFN0YXJ0IDJQXCIsIGN1cnNpdmU7XG4gICAgZm9udC1zaXplOiAxNTAlO1xuICB9XG4gIC5oZWFkZXIgPiAqIHtcbiAgICBjb2xvcjogI2YwZjBmMDtcbiAgICBwYWRkaW5nOiAxZW07XG4gIH1cbiAgLndvbiB7XG4gICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgIHdpZHRoOiAxMDB2dztcbiAgICBoZWlnaHQ6IDEwMHZoO1xuICAgIGJhY2tkcm9wLWZpbHRlcjogYmx1cigxdm1pbik7XG4gICAgLXdlYmtpdC1iYWNrZHJvcC1maWx0ZXI6IGJsdXIoMXZtaW4pO1xuICAgIGZvbnQtZmFtaWx5OiBcIlByZXNzIFN0YXJ0IDJQXCIsIGN1cnNpdmU7XG4gICAgY29sb3I6ICNmZmY7XG4gICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgIHotaW5kZXg6IDE7XG4gIH1cbiAgLndvbiAudGl0bGUge1xuICAgIGZvbnQtc2l6ZTogY2xhbXAoMXJlbSwgM3Z3LCAzLjVyZW0pO1xuICB9XG4gIC53b24gLnNjb3JlIHtcbiAgICBmb250LXNpemU6IGNsYW1wKDJyZW0sIDZ2dywgN3JlbSk7XG4gIH1cbjwvc3R5bGU+XG5cbjxzdmVsdGU6aGVhZD5cbiAgPHN0eWxlPlxuICAgIEBpbXBvcnQgdXJsKFwiaHR0cHM6Ly9mb250cy5nb29nbGVhcGlzLmNvbS9jc3MyP2ZhbWlseT1QcmVzcytTdGFydCsyUCZkaXNwbGF5PXN3YXBcIik7XG4gIDwvc3R5bGU+XG48L3N2ZWx0ZTpoZWFkPlxuXG48ZGl2IGNsYXNzPVwiY29udGFpbmVyXCIgYmluZDp0aGlzPVwie2NvbnRhaW5lcn1cIj5cbiAgPGRpdiBjbGFzcz1cImhlYWRlclwiPlxuICAgIDxkaXYgY2xhc3M9XCJzY29yZVwiPlxuICAgICAge01hdGguZmxvb3IoJHNjb3JlLmN1cnJlbnQpLnBhZCg1KX1cbiAgICA8L2Rpdj5cbiAgPC9kaXY+XG4gIHsjaWYgaXNXb259XG4gICAgPGRpdiBjbGFzcz1cIndvblwiIHRyYW5zaXRpb246Zmx5PVwie3sgZHVyYXRpb246IDEwMDAsIHg6IDUwLCB5OiAtNTAgfX1cIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJ0aXRsZVwiPlxuICAgICAgICBDT05HUkFUVUxBVElPTlMhPGJyIC8+XG4gICAgICAgIFlPVSBXT04hXG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJzY29yZVwiPlxuICAgICAgICB7JHNldHVwU2NvcmUuY3VycmVudC5wYWQoNSl9XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgey9pZn1cbiAgeyNpZiBpc1Zpc2libGUgJiYgIWlzV29ufVxuICAgIDxGaWVsZCAvPlxuICB7L2lmfVxuPC9kaXY+XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBZ0RFLEtBQU0sQ0FDSixzQkFBc0IsQ0FBRSxHQUFHLENBQzNCLG1CQUFtQixDQUFFLHFCQUFxQixDQUMxQywrQkFBK0IsQ0FBRSxJQUFJLENBQ3JDLHdCQUF3QixDQUFFLFVBQVUsQ0FFcEMsYUFBYSxDQUFFLGtCQUFrQixDQUNqQyxXQUFXLENBQUUsSUFBSSxDQUNqQixjQUFjLENBQUUsSUFBSSxDQUNwQixZQUFZLENBQUUsSUFBSSxDQUNsQixhQUFhLENBQUUsSUFBSSxDQUNuQixjQUFjLENBQUUsa0JBQWtCLENBQ2xDLGVBQWUsQ0FBRSxPQUFPLENBQ3hCLGNBQWMsQ0FBRSxNQUNsQixDQUNRLElBQU0sQ0FDWix3QkFBd0IsQ0FBRSxJQUM1QixDQUNRLENBQUcsQ0FDVCxxQkFBcUIsQ0FBRSxJQUFJLENBQzNCLG1CQUFtQixDQUFFLElBQUksQ0FDekIsa0JBQWtCLENBQUUsSUFBSSxDQUN4QixnQkFBZ0IsQ0FBRSxJQUFJLENBQ3RCLGVBQWUsQ0FBRSxJQUFJLENBQ3JCLFdBQVcsQ0FBRSxJQUNmLENBRUEsc0NBQVcsQ0FDVCxVQUFVLENBQUUsT0FBTyxDQUNuQixVQUFVLENBQUUsNEJBQTRCLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FDdEQsZUFBZSxDQUFFLE1BQU0sQ0FDdkIsaUJBQWlCLENBQUUsTUFBTSxDQUN6QixPQUFPLENBQUUsSUFBSSxDQUNiLEtBQUssQ0FBRSxLQUFLLENBQ1osTUFBTSxDQUFFLEtBQUssQ0FDYixXQUFXLENBQUUsTUFBTSxDQUNuQixlQUFlLENBQUUsTUFDbkIsQ0FDQSxtQ0FBUSxDQUNOLE9BQU8sQ0FBRSxJQUFJLENBQ2IsUUFBUSxDQUFFLFFBQVEsQ0FDbEIsR0FBRyxDQUFFLENBQUMsQ0FDTixLQUFLLENBQUUsSUFBSSxDQUNYLGVBQWUsQ0FBRSxhQUFhLENBQzlCLFdBQVcsQ0FBRSxnQkFBZ0IsQ0FBQyxDQUFDLE9BQU8sQ0FDdEMsU0FBUyxDQUFFLElBQ2IsQ0FDQSxxQkFBTyxDQUFHLGNBQUUsQ0FDVixLQUFLLENBQUUsT0FBTyxDQUNkLE9BQU8sQ0FBRSxHQUNYLENBQ0EsZ0NBQUssQ0FDSCxRQUFRLENBQUUsUUFBUSxDQUNsQixPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxNQUFNLENBQ3RCLFdBQVcsQ0FBRSxNQUFNLENBQ25CLGVBQWUsQ0FBRSxNQUFNLENBQ3ZCLEtBQUssQ0FBRSxLQUFLLENBQ1osTUFBTSxDQUFFLEtBQUssQ0FDYixlQUFlLENBQUUsS0FBSyxLQUFLLENBQUMsQ0FDNUIsdUJBQXVCLENBQUUsS0FBSyxLQUFLLENBQUMsQ0FDcEMsV0FBVyxDQUFFLGdCQUFnQixDQUFDLENBQUMsT0FBTyxDQUN0QyxLQUFLLENBQUUsSUFBSSxDQUNYLFVBQVUsQ0FBRSxNQUFNLENBQ2xCLE9BQU8sQ0FBRSxDQUNYLENBQ0Esa0JBQUksQ0FBQyxvQkFBTyxDQUNWLFNBQVMsQ0FBRSxNQUFNLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FDcEMsQ0FDQSxrQkFBSSxDQUFDLG9CQUFPLENBQ1YsU0FBUyxDQUFFLE1BQU0sSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUNsQyJ9 */");
    }

    // (135:2) {#if isWon}
    function create_if_block_1(ctx) {
    	let div2;
    	let div0;
    	let t0;
    	let br;
    	let t1;
    	let t2;
    	let div1;
    	let t3_value = /*$setupScore*/ ctx[0].current.pad(5) + "";
    	let t3;
    	let div2_transition;
    	let current;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			t0 = text("CONGRATULATIONS!");
    			br = element("br");
    			t1 = text("\n        YOU WON!");
    			t2 = space();
    			div1 = element("div");
    			t3 = text(t3_value);
    			add_location(br, file, 137, 24, 3281);
    			attr_dev(div0, "class", "title svelte-jeasp9");
    			add_location(div0, file, 136, 6, 3237);
    			attr_dev(div1, "class", "score svelte-jeasp9");
    			add_location(div1, file, 140, 6, 3324);
    			attr_dev(div2, "class", "won svelte-jeasp9");
    			add_location(div2, file, 135, 4, 3160);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, t0);
    			append_dev(div0, br);
    			append_dev(div0, t1);
    			append_dev(div2, t2);
    			append_dev(div2, div1);
    			append_dev(div1, t3);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if ((!current || dirty & /*$setupScore*/ 1) && t3_value !== (t3_value = /*$setupScore*/ ctx[0].current.pad(5) + "")) set_data_dev(t3, t3_value);
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!current) return;
    				if (!div2_transition) div2_transition = create_bidirectional_transition(div2, fly, { duration: 1000, x: 50, y: -50 }, true);
    				div2_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div2_transition) div2_transition = create_bidirectional_transition(div2, fly, { duration: 1000, x: 50, y: -50 }, false);
    			div2_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if (detaching && div2_transition) div2_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(135:2) {#if isWon}",
    		ctx
    	});

    	return block;
    }

    // (146:2) {#if isVisible && !isWon}
    function create_if_block(ctx) {
    	let field;
    	let current;
    	field = new Field({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(field.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(field, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(field.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(field.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(field, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(146:2) {#if isVisible && !isWon}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let style;
    	let t1;
    	let div2;
    	let div1;
    	let div0;
    	let t2_value = Math.floor(/*$score*/ ctx[3].current).pad(5) + "";
    	let t2;
    	let t3;
    	let t4;
    	let current;
    	let if_block0 = /*isWon*/ ctx[5] && create_if_block_1(ctx);
    	let if_block1 = /*isVisible*/ ctx[2] && !/*isWon*/ ctx[5] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			style = element("style");
    			style.textContent = "@import url(\"https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap\");";
    			t1 = space();
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			t2 = text(t2_value);
    			t3 = space();
    			if (if_block0) if_block0.c();
    			t4 = space();
    			if (if_block1) if_block1.c();
    			add_location(style, file, 123, 2, 2861);
    			attr_dev(div0, "class", "score svelte-jeasp9");
    			add_location(div0, file, 130, 4, 3060);
    			attr_dev(div1, "class", "header svelte-jeasp9");
    			add_location(div1, file, 129, 2, 3035);
    			attr_dev(div2, "class", "container svelte-jeasp9");
    			add_location(div2, file, 128, 0, 2985);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			append_dev(document.head, style);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div0, t2);
    			append_dev(div2, t3);
    			if (if_block0) if_block0.m(div2, null);
    			append_dev(div2, t4);
    			if (if_block1) if_block1.m(div2, null);
    			/*div2_binding*/ ctx[6](div2);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if ((!current || dirty & /*$score*/ 8) && t2_value !== (t2_value = Math.floor(/*$score*/ ctx[3].current).pad(5) + "")) set_data_dev(t2, t2_value);
    			if (/*isWon*/ ctx[5]) if_block0.p(ctx, dirty);

    			if (/*isVisible*/ ctx[2] && !/*isWon*/ ctx[5]) {
    				if (if_block1) {
    					if (dirty & /*isVisible*/ 4) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(div2, null);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(if_block1);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			transition_out(if_block1);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			detach_dev(style);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div2);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			/*div2_binding*/ ctx[6](null);
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
    	let $setupScore;
    	let $score;
    	validate_store(setupScore, 'setupScore');
    	component_subscribe($$self, setupScore, $$value => $$invalidate(0, $setupScore = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);

    	Number.prototype.pad = function (size) {
    		var s = String(this);

    		while (s.length < (size || 2)) {
    			s = "0" + s;
    		}

    		return s;
    	};

    	let score = spring({ current: 0, left: 0 }, { stiffness: 0.01, damping: 0.9 });
    	validate_store(score, 'score');
    	component_subscribe($$self, score, value => $$invalidate(3, $score = value));
    	let container;
    	let isWon = false;
    	let isVisible = false;
    	setupScore.set({ current: 0 });

    	onMount(() => {
    		$$invalidate(2, isVisible = true);
    		$$invalidate(1, container.style.height = `${window.innerHeight}px`, container);

    		window.addEventListener("resize", function (event) {
    			$$invalidate(1, container.style.height = `${window.innerHeight}px`, container);
    			doReset.set(true);
    		});
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function div2_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			container = $$value;
    			$$invalidate(1, container);
    		});
    	}

    	$$self.$capture_state = () => ({
    		onMount,
    		spring,
    		fade,
    		fly,
    		setupApp,
    		setupDisplay,
    		setupPersonage,
    		setupScore,
    		doReset,
    		Field,
    		score,
    		container,
    		isWon,
    		isVisible,
    		$setupScore,
    		$score
    	});

    	$$self.$inject_state = $$props => {
    		if ('score' in $$props) $$invalidate(4, score = $$props.score);
    		if ('container' in $$props) $$invalidate(1, container = $$props.container);
    		if ('isWon' in $$props) $$invalidate(5, isWon = $$props.isWon);
    		if ('isVisible' in $$props) $$invalidate(2, isVisible = $$props.isVisible);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$setupScore*/ 1) {
    			{
    				score.set({ current: $setupScore.current });
    			}
    		}
    	};

    	return [$setupScore, container, isVisible, $score, score, isWon, div2_binding];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {}, add_css);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
      target: document.getElementById("overlay") || document.body,
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
