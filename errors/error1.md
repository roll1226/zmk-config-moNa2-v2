react-dom_client.js?v=8a02d948:521 Warning: React has detected a change in the order of Hooks called by App. This will lead to bugs and errors if not fixed. For more information, read the Rules of Hooks: https://reactjs.org/link/rules-of-hooks

   Previous render            Next render
   ------------------------------------------------------
1. useState                   useState
2. useState                   useState
3. useState                   useState
4. useState                   useState
5. useState                   useState
6. useState                   useState
7. useState                   useState
8. useState                   useState
9. useState                   useState
10. useState                  useState
11. useCallback               useEffect
   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

    at App (http://localhost:5173/zmk-config-moNa2-v2/src/App.tsx?t=1781103022247:34:29)
printWarning @ react-dom_client.js?v=8a02d948:521
2react-dom_client.js?v=8a02d948:11730 Uncaught Error: Should have a queue. This is likely a bug in React. Please file an issue.
    at updateReducer (react-dom_client.js?v=8a02d948:11730:19)
    at updateState (react-dom_client.js?v=8a02d948:12021:18)
    at Object.useState (react-dom_client.js?v=8a02d948:12753:24)
    at useState (chunk-ZGXVMJTJ.js?v=230180b8:1066:29)
    at useBehaviors (useBehaviors.ts:12:33)
    at App (App.tsx?t=1781103022247:41:27)
    at renderWithHooks (react-dom_client.js?v=8a02d948:11548:26)
    at updateFunctionComponent (react-dom_client.js?v=8a02d948:14582:28)
    at beginWork (react-dom_client.js?v=8a02d948:15924:22)
    at HTMLUnknownElement.callCallback2 (react-dom_client.js?v=8a02d948:3674:22)
react-dom_client.js?v=8a02d948:14032 The above error occurred in the <App> component:

    at App (http://localhost:5173/zmk-config-moNa2-v2/src/App.tsx?t=1781103022247:34:29)

Consider adding an error boundary to your tree to customize error handling behavior.
Visit https://reactjs.org/link/error-boundaries to learn more about error boundaries.
logCapturedError @ react-dom_client.js?v=8a02d948:14032
react-dom_client.js?v=8a02d948:11730 Uncaught (in promise) Error: Should have a queue. This is likely a bug in React. Please file an issue.
    at updateReducer (react-dom_client.js?v=8a02d948:11730:19)
    at updateState (react-dom_client.js?v=8a02d948:12021:18)
    at Object.useState (react-dom_client.js?v=8a02d948:12753:24)
    at useState (chunk-ZGXVMJTJ.js?v=230180b8:1066:29)
    at useBehaviors (useBehaviors.ts:12:33)
