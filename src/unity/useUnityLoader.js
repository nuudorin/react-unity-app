import { useEffect, useRef, useState } from 'react';

export const LOADING_STATES = {
    IDLE: 'idle',
    LOADING: 'loading',
    READY: 'ready',
    ERROR: 'error',
    RELOADING: 'reloading',
};

// useUnityLoader(canvasRef, options)
// options: { dataUrl, frameworkUrl, codeUrl, loaderSrc, streamingAssetsUrl, companyName, productName, productVersion }
// returns: { unityInstance, unityInstanceRef, createdRef, loadError, reload, getLoadingPromise, loadingState, isLoading, isReady }
/**
 * React hook that loads a Unity WebGL build into a provided canvas element.
 *
 * @param {React.RefObject<HTMLCanvasElement>} canvasRef - ref to the canvas element Unity will render into
 * @param {Object} [options] - loader options (dataUrl, frameworkUrl, codeUrl, loaderSrc, etc.)
 * @returns {Object} - { unityInstance, unityInstanceRef, createdRef, loadError, reload, getLoadingPromise, loadingState, isLoading, isReady }
 *
 * Notes:
 * - The hook injects the Unity loader script (loaderSrc) and calls createUnityInstance.
 * - It manages lifecycle: cleanup on unmount, reload(), and exposes the current loading promise.
 */
export default function useUnityLoader(canvasRef, options = {}) {
    const { dataUrl, frameworkUrl, codeUrl, loaderSrc, streamingAssetsUrl = 'StreamingAssets', companyName = 'DefaultCompany', productName = 'ReactUnityTest', productVersion = '0.1', integrity, crossOrigin } = options;

    const unityInstanceRef = useRef(null);
    const createdRef = useRef(false);
    const scriptRef = useRef(null);
    const onLoadRef = useRef(null);
    const onErrorRef = useRef(null);
    const mountedRef = useRef(false);
    const reloadingRef = useRef(false);
    const loadingPromiseRef = useRef(null);
    const loadIdRef = useRef(0);
    const [unityInstance, setUnityInstance] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [loadingState, setLoadingState] = useState(LOADING_STATES.IDLE);
    
    /**
     * Initialize/create the Unity instance once the loader script has executed.
     * This calls window.createUnityInstance(canvas, config) and returns the resulting promise.
     * It validates the canvas and guards against stale load results using myLoadId.
     *
     * @param {number} [myLoadId] - identifier for the load attempt to detect stale results
     * @returns {Promise<any>} resolves with the Unity instance
     */
    const initialize = (myLoadId) => {
        if (!canvasRef.current) {
            const err = new Error('Unity canvas not found.');
            console.error(err);
            setLoadError(err);
            return Promise.reject(err);
        }

        const create = window.createUnityInstance || globalThis.createUnityInstance;
        if (typeof create !== 'function') {
            const err = new Error('createUnityInstance is not available on window after loader loaded.');
            console.error(err);
            setLoadError(err);
            return Promise.reject(err);
        }

        return create(canvasRef.current, {
            dataUrl: dataUrl || '/Build/UnityGame.data',
            frameworkUrl: frameworkUrl || '/Build/UnityGame.framework.js',
            codeUrl: codeUrl || '/Build/UnityGame.wasm',
            streamingAssetsUrl,
            companyName,
            productName,
            productVersion,
        })
            .then((instance) => {
                // If this initialize call is from a previous load, ignore it
                if (typeof myLoadId !== 'undefined' && loadIdRef.current !== myLoadId) {
                    try { instance.Quit && instance.Quit(); } catch (e) { /* ignore */ }
                    return Promise.reject(new Error('Stale Unity load result'));
                }
                if (!mountedRef.current) {
                    // if unmounted while creating, try to quit immediately
                    try { instance.Quit && instance.Quit(); } catch (e) { /* ignore */ }
                    return Promise.reject(new Error('Unmounted before Unity instance finished creating'));
                }
                unityInstanceRef.current = instance;
                setUnityInstance(instance);
                setLoadingState(LOADING_STATES.READY);
                createdRef.current = true;
                return instance;
            })
            .catch((err) => {
                console.error('Failed to create Unity instance:', err);
                setLoadError(err);
                setLoadingState(LOADING_STATES.ERROR);
                throw err;
            });
    };

    /**
     * Inject the Unity loader script into the document and start initialization.
     * Returns a promise that resolves when createUnityInstance completes (or rejects on error).
     *
     * @returns {Promise<any>} resolves with the Unity instance
     */
    const injectLoader = () => {
        const loader = loaderSrc || '/Build/UnityGame.loader.js';
        setLoadError(null);

        // For security, remove any existing loader script and inject a fresh one.
        try {
            let existing = document.querySelector(`script[src="${loader}"]`);
            if (existing && existing.parentNode) {
                existing.parentNode.removeChild(existing);
            }
        } catch (err) {
            console.warn('Failed to remove existing Unity loader script, continuing to inject fresh copy.', err);
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = loader;
            script.async = true;

            if (integrity) {
                script.integrity = integrity;
                script.crossOrigin = crossOrigin || 'anonymous';
            } else if (crossOrigin) {
                script.crossOrigin = crossOrigin;
            }

            const onLoad = () => {
                // once the loader script is present, call initialize() which returns the instance promise
                const myLoadId = ++loadIdRef.current;
                initialize(myLoadId).then((instance) => {
                    resolve(instance);
                }).catch((err) => {
                    reject(err);
                });
            };

            const onError = (e) => {
                const err = new Error('Failed to load Unity loader script');
                console.error(err, e);
                // normalize to Error
                const normalized = e instanceof Error ? e : new Error(err.message + (e && e.message ? ': ' + e.message : ''));
                setLoadError(normalized);
                reject(normalized);
            };

            setLoadingState(LOADING_STATES.LOADING);
            script.addEventListener('load', onLoad);
            script.addEventListener('error', onError);
            document.body.appendChild(script);

            scriptRef.current = script;
            onLoadRef.current = onLoad;
            onErrorRef.current = onError;
            // no pendingInitRef stored; callers can await injectLoader() if needed
            // but we don't keep internal pending references.
        });
    };

    /**
     * Cleanup the injected loader script and the Unity instance.
     * - Removes script element and listeners
     * - Calls instance.Quit() if available and awaits it
     * - Resets hook state (unityInstance, loadError, loadingState)
     *
     * @returns {Promise<void>}
     */
    const doCleanup = async () => {
        // remove event listeners and script node
        if (scriptRef.current) {
            try {
                if (onLoadRef.current) scriptRef.current.removeEventListener('load', onLoadRef.current);
                if (onErrorRef.current) scriptRef.current.removeEventListener('error', onErrorRef.current);
            } catch (e) {
                // ignore
            }
            try {
                if (scriptRef.current.parentNode) scriptRef.current.parentNode.removeChild(scriptRef.current);
            } catch (e) {
                // ignore
            }
            scriptRef.current = null;
            onLoadRef.current = null;
            onErrorRef.current = null;
        }

        // quit the unity instance if present
        if (unityInstanceRef.current) {
            try {
                // Quit may return a promise
                const maybePromise = unityInstanceRef.current.Quit && unityInstanceRef.current.Quit();
                if (maybePromise && typeof maybePromise.then === 'function') {
                    await maybePromise.catch(() => { /* ignore */ });
                }
            } catch (err) {
                // ignore
            }
            unityInstanceRef.current = null;
        }

        setUnityInstance(null);
        createdRef.current = false;
        loadingPromiseRef.current = null;
        setLoadError(null);
        setLoadingState(LOADING_STATES.IDLE);
    };

    /**
     * Reload the Unity loader and instance. This guards against concurrent reloads.
     * It cleans up the previous instance then reinjects the loader.
     *
     * @returns {Promise<void>}
     */
    const reload = async () => {
        if (reloadingRef.current) return;
        reloadingRef.current = true;
        try {
            await doCleanup();
            // small delay to ensure DOM removal propagates
            await new Promise((r) => setTimeout(r, 50));
            setLoadingState(LOADING_STATES.RELOADING);
            const p = injectLoader();
            loadingPromiseRef.current = p;
            p.catch(() => { /* swallow here to avoid unhandled rejection warnings; callers can still await the promise */ });
            await p;
        } finally {
            reloadingRef.current = false;
        }
    };

    useEffect(() => {
        mountedRef.current = true;

        // start initial load and capture the loading promise so callers can await it
        setLoadingState(LOADING_STATES.LOADING);
        const p = injectLoader();
        loadingPromiseRef.current = p;
        p.catch(() => { /* initial load errors are surfaced in loadError state; swallow to avoid unhandled rejection */ });

        return () => {
            mountedRef.current = false;
            // cleanup listeners / instance / script
            // If an initialization is pending, clear its handlers
            (async () => {
                try {
                    await doCleanup();
                } catch (e) {
                    // ignore
                }
            })();
        };
    }, []);

    /**
     * Returns the current loading promise for the active loader/create operation.
     *
     * Notes:
     * - This is a function (not a snapshot) so callers can call it to retrieve the
     *   latest promise after re-renders or reloads: const p = getLoadingPromise();
     * - The promise resolves with the Unity instance (or rejects with an Error).
     * - The hook may swallow internal rejections to avoid unhandled rejection warnings;
     *   callers should still await and catch the returned promise.
     *
     * @returns {Promise<any>?} current loading promise or null
     */
    const getLoadingPromise = () => loadingPromiseRef.current;
    const isLoading = loadingState === LOADING_STATES.LOADING || loadingState === LOADING_STATES.RELOADING;
    const isReady = loadingState === LOADING_STATES.READY;
    return { unityInstance, unityInstanceRef, createdRef, loadError, reload, getLoadingPromise, loadingState, isLoading, isReady };
}
