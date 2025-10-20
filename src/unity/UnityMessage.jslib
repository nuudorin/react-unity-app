mergeInto(LibraryManager.library, {
  // Example: notify React that Unity is ready using the typed UnityMessage pattern
  NotifyReactUnityIsReady: function () {
    const msg = { type: 'UnityReady', payload: null };
    window.dispatchEvent(new CustomEvent('UnityMessage', { detail: msg }));
  },

  // Example: send game results to React using the typed UnityMessage pattern
  // jsonPtr is a pointer to a UTF8 C-string containing JSON
  SendGameResultsToJS: function (jsonPtr) {
    const jsonStr = UTF8ToString(jsonPtr);
    const payload = jsonStr;
    const msg = { type: 'GameResult', payload };
    window.dispatchEvent(new CustomEvent('UnityMessage', { detail: msg }));
  }
});
