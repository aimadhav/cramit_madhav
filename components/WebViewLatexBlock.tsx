import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import WebView from 'react-native-webview';
import { useThemeColors } from '@/hooks/useThemeColors';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

interface WebViewLatexBlockProps {
  latex: string;
}

// Global cache and loading lock for MathJax script content
let mathjaxScriptCache: string | null = null;
let mathjaxLoadingPromise: Promise<string | null> | null = null;

const WebViewLatexBlock: React.FC<WebViewLatexBlockProps> = ({ latex }) => {
  const [webViewHeight, setWebViewHeight] = useState(50); 
  const webViewRef = useRef<WebView>(null);
  const [webViewKey, setWebViewKey] = useState(Date.now().toString());
  const [mathjaxScript, setMathjaxScript] = useState<string | null>(mathjaxScriptCache);
  const colors = useThemeColors();

  useEffect(() => {
    const loadMathjax = async () => {
      // 1. Check memory cache (fastest)
      if (mathjaxScriptCache) {
        setMathjaxScript(mathjaxScriptCache);
        return;
      }

      // 2. If another instance is already loading, wait for it
      if (mathjaxLoadingPromise) {
        const content = await mathjaxLoadingPromise;
        if (content) setMathjaxScript(content);
        return;
      }

      // 3. Start loading and set the promise lock
      mathjaxLoadingPromise = (async () => {
        const cachePath = `${FileSystem.documentDirectory}mathjax-script.txt`;

        try {
          // Check persistent disk cache
          const fileInfo = await FileSystem.getInfoAsync(cachePath);
          if (fileInfo.exists) {
            const content = await FileSystem.readAsStringAsync(cachePath);
            mathjaxScriptCache = content;
            return content;
          }

          // If not in cache, we MUST try to load from assets
          // This will only fail if we are in DEV mode and the SERVER is OFF and it's the FIRST run
          const asset = Asset.fromModule(require('../assets/mathjax/mathjax-script.txt'));
          
          // In production, asset.localUri is often already populated for bundled assets
          if (!asset.localUri) {
            try {
              await asset.downloadAsync();
            } catch (downloadError) {
              // Only log this if we actually need it
              throw new Error(`Asset download failed. Is the dev server running for the initial load? ${downloadError}`);
            }
          }
          
          if (asset.localUri) {
            const content = await FileSystem.readAsStringAsync(asset.localUri);
            
            // Save to persistent cache for future offline uses
            try {
              await FileSystem.writeAsStringAsync(cachePath, content);
            } catch (writeError) {
              console.warn('Failed to save MathJax to persistent cache:', writeError);
            }

            mathjaxScriptCache = content;
            return content;
          }
        } catch (error) {
          // Silencing this error as requested to avoid the red error screen in development.
          // The rendering usually still works via persistent cache or CDN fallback.
          console.log('MathJax load sequence notification (not a critical error):', error);
        } finally {
          mathjaxLoadingPromise = null;
        }
        return null;
      })();

      const finalContent = await mathjaxLoadingPromise;
      if (finalContent) setMathjaxScript(finalContent);
    };

    loadMathjax();
  }, []);

  // If the content was heuristic-flagged as LaTeX but lacks standard delimiters, auto-wrap it.
  const hasDelimiters = /(\$\$|\$|\\\(|\\\[)/.test(latex);
  const contentForMathJaxDisplay = hasDelimiters ? latex : `\\(${latex}\\)`;
  const scriptLatexStringLiteral = JSON.stringify(latex);

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <style>
      body {
        margin: 0;
       padding: 12px 16px 20px 16px;
        background-color: transparent; 
        color: ${colors.textDark}; 
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 22px;
        line-height: 1.45;
        visibility: hidden; 
        overflow-x: hidden;
        overflow-y: hidden; 
      }
      #math-content {
          overflow-wrap: break-word; 
          word-wrap: break-word;
          width: 100%; 
          text-align: center;
          white-space: pre-wrap; 
      }
      mjx-container svg {
          max-width: 100%;
          height: auto !important;
      }
    </style>
  </head>
  <body>
    <div id="math-content">${contentForMathJaxDisplay}</div>
    <script type="text/javascript">
      const originalLatexPropValue = ${scriptLatexStringLiteral};

      function sendMessage(type, data) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, latex: originalLatexPropValue, data }));
      }

    function updateHeight() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {

      const exactHeight =
        Math.ceil(
          Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight
          )
        ) + 40;

      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          type: 'rendered_height',
          height: exactHeight,
          latex: originalLatexPropValue
        })
      );
    });
  });
}

      try {
        sendMessage('DEBUG_MSG', 'WebView script loaded. Latex prop for msg: ' + originalLatexPropValue);
      } catch(e) {
         window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', data: 'Initial sendMessage failed: ' + e.toString()}));
      }

      document.addEventListener('DOMContentLoaded', function() {
        sendMessage('dom_content_loaded', 'DOMContentLoaded event fired.');
      });

      window.MathJax = {
        tex: {
          inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
          displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']]
        },
        svg: { 
          fontCache: 'global' 
        },
        startup: {
          ready: function () {
            sendMessage('mathjax_status', 'MathJax startup.ready function called.');
            MathJax.startup.defaultReady();
            sendMessage('mathjax_status', 'MathJax defaultReady executed. Typesetting should be complete.');
            MathJax.typesetPromise()
              .then(() => {
                document.body.style.visibility = 'visible';

                sendMessage(
                  'mathjax_status',
                  'MathJax.typesetPromise() completed.'
                );

                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    updateHeight();
                  });
                });
              })
              .catch((e) => {
                document.body.style.visibility = 'visible';
                sendMessage('mathjax_status', 'Error: ' + e.toString());
              });
              
          }
        },
        options: {
          skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
          ignoreHtmlClass: 'tex2jax_ignore',
          processHtmlClass: 'tex2jax_process'
        }
      };
    </script>
    <script type="text/javascript">
      ${mathjaxScript || ''}
    </script>
    ${!mathjaxScript ? '<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js" async></script>' : ''}
  </body>
  </html>
`;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'rendered_height' && data.latex === latex) {
        setWebViewHeight(prev => {
          if (Math.abs(prev - data.height) > 2) {
            return data.height;
          }
          return prev;
        });
      } else if (data.type === 'ERROR') {
        console.error('[WebView Error]', data.data);
      }
    } catch (error) {
      console.error('Error parsing message from WebView:', error, event.nativeEvent.data);
    }
  };

  useEffect(() => {
    setWebViewKey(Date.now().toString()); // Force re-render if latex prop changes
    setWebViewHeight(50); // Reset height when latex changes
  }, [latex]);

  return (
    <View style={[styles.container, { height: webViewHeight }]}>
      <WebView
        key={webViewKey}
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent, baseUrl: '' }}
        style={styles.webView}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        onMessage={handleMessage}
        onError={(syntheticEvent) => {
          const {nativeEvent} = syntheticEvent;
          console.warn('WebView error: ', nativeEvent);
        }}
        onHttpError={(syntheticEvent) => {
          const {nativeEvent} = syntheticEvent;
          console.warn('WebView HTTP error: ', nativeEvent.url, nativeEvent.statusCode, nativeEvent.description);
        }}
        onLoadProgress={({ nativeEvent }) => {
          // console.log('WebView load progress: ', nativeEvent.progress);
        }}
        onShouldStartLoadWithRequest={(request) => {
          // Intercept navigation
          return true;
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    // height is dynamic
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default WebViewLatexBlock;

