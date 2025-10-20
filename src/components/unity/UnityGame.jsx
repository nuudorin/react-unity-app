import { useEffect, useRef, useState } from "react";
import useUnityLoader from "../../unity/useUnityLoader";
import UnityOverlay from "./UnityOverlay";
import unityBridge from "../../unity/unityBridge";

export default function UnityGame({
    canvasStyle = { width: 960, height: 600, background: '#000' },
    onReady,
    dataUrl = '/Build/UnityGame.data',
    frameworkUrl = '/Build/UnityGame.framework.js',
    codeUrl = '/Build/UnityGame.wasm',
    loaderSrc = '/Build/UnityGame.loader.js',
}) {

    // unity instance is provided by the loader hook (loadedInstance)
    const [unityReady, setUnityReady] = useState(false);
    const unityCanvasRef = useRef(null);

    // Track whether UnityReady fired early (we'll consult the loader's createdRef)
    const pendingReadyRef = useRef(false);

    // Keep mounted state for safety in handlers
    const mountedRef = useRef(false);

    
    // === Hook: load/create Unity instance ===
    const { unityInstance: loadedInstance, createdRef: loaderCreatedRef, loadError, reload, loadingState, isLoading, isReady } =
        useUnityLoader(unityCanvasRef, {
            dataUrl,
            frameworkUrl,
            codeUrl,
            loaderSrc,
        });

    // === Handle messages FROM Unity to React ===
    // Most notable is our custom UnityReady event
    // For other events, register using eventBus.subscribe in parent components.
    useEffect(() => {
        mountedRef.current = true;
        const handleUnityReady = () => {
            if (!mountedRef.current) return;
            if (loaderCreatedRef.current) setUnityReady(true);
            else pendingReadyRef.current = true;
        };

        unityBridge.registerHandler('UnityReady', handleUnityReady);

        return () => {
            mountedRef.current = false;
            unityBridge.unregisterHandler('UnityReady', handleUnityReady);
        };
    }, []);


    // When loader provides an instance, flush any pending UnityReady flag
    useEffect(() => {
        if (loadedInstance) {
            if (loaderCreatedRef.current && pendingReadyRef.current) {
                setUnityReady(true);
                pendingReadyRef.current = false;
            }
            unityBridge.setInstance(loadedInstance);
        } else {
            // if instance became null/undefined, clear bridge to avoid stale references
            unityBridge.clearInstance();
            setUnityReady(false);
        }
    }, [loadedInstance]);


    // When we become ready, call onReady
    useEffect(() => {
        if (!mountedRef.current) return;
        if (loadedInstance && unityReady) {
            if (typeof onReady === 'function') {
                try { onReady({ unityInstance: loadedInstance }); } catch (e) { /* ignore */ }
            }
        }
    }, [loadedInstance, unityReady]);


    // Clear local ready flag when the loader begins loading or raises an error.
    // This avoids sending stale queued data to a new instance and keeps unityReady in sync with loader state.
    useEffect(() => {
        if (isLoading) {
            if (unityReady) {
                console.info('[React] Loader started loading. Clearing unityReady');
            }
            setUnityReady(false);
            return;
        }
        if (loadError) {
            console.warn('[React] Loader reported an error. Clearing unityReady', loadError);
            setUnityReady(false);
        }
    }, [isLoading, loadError]);



    return (
        <div id="unity-container" style={{ position: 'relative' }}>
            <UnityOverlay loadError={loadError} unityReady={unityReady} isLoading={isLoading} isReady={isReady} onRetry={() => {
                if (typeof reload === 'function') reload();
                else window.location.reload();
            }} />
            <canvas
                id="unity-canvas"
                ref={unityCanvasRef}
                style={canvasStyle}
            />
        </div>
    );
}
